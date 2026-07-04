/**
 * Main-seitige Aufsicht ueber den Whisper-utilityProcess.
 *
 * Verantwortlich fuer:
 * - Fork des Worker-Entries (out/main/engine.worker.js) mit stdio:'pipe',
 *   damit native whisper.cpp-/ggml-Ausgaben ins Main-Log wandern.
 * - Absturz-Isolation: das `exit`-Event wird ueberwacht; bei unerwartetem
 *   Ende wird die Engine automatisch neu gestartet (max. 3 Versuche), danach
 *   eine Katalog-Fehlermeldung (UI-Sprache) an die UI.
 * - Getypte, zod-validierte Nachrichten in beide Richtungen. PCM wird als
 *   ArrayBuffer transferiert (zero-copy, aktiver Handoff).
 */
import { join } from 'node:path';
import { utilityProcess, type UtilityProcess } from 'electron';
import { getUiLanguage, texte } from '../i18n';
import { err, ok, type Result } from '../../shared/result';
import type { DictationLanguage } from '../../shared/schema';
import type { Logger } from '../log/logger';
import { NativeLogRingBuffer, routeNativeOutput } from './native-log';
import { workerEventSchema, type WorkerCommand, type WorkerEvent } from './protocol';

export interface EngineConfig {
  readonly whisperModelPath: string;
  readonly sileroModelPath: string;
  readonly useGpu: boolean;
  readonly minSpeechDurationMs: number;
  readonly minSilenceDurationMs: number;
  readonly maxSpeechDurationS: number;
  readonly vadThreshold: number;
}

export interface TranscriptEvent {
  readonly text: string;
  readonly durationMs: number;
  readonly audioMs: number;
}

/** Diktat-Kontext: feste Sprache plus optionaler Woerterbuch-Prompt. */
export interface DictationContext {
  readonly language: DictationLanguage;
  readonly prompt: string | null;
}

export interface EngineCallbacks {
  /** Ein Segment wurde transkribiert (kontinuierlicher Modus). */
  readonly onTranscript: (event: TranscriptEvent) => void;
  /** VAD hat keine Sprache erkannt (kontinuierlicher Modus). */
  readonly onSilence: () => void;
  /** Fataler, nicht mehr behebbarer Engine-Fehler (Katalog-UI-Meldung). */
  readonly onFatal: (message: string) => void;
}

/** Sinnvolle Standardwerte fuer Endpointing/VAD aus dem Spike. */
export const DEFAULT_ENGINE_TUNING = {
  minSpeechDurationMs: 250,
  minSilenceDurationMs: 500,
  maxSpeechDurationS: 25,
  vadThreshold: 0.5,
} as const;

const MAX_RESTARTS = 3;

interface PendingSegment {
  resolve: (result: Result<TranscriptEvent | null, string>) => void;
}

export class WhisperEngineManager {
  private child: UtilityProcess | null = null;
  private ready = false;
  private restarts = 0;
  /**
   * Zuletzt gesetzter Diktat-Kontext (Sprache plus Initial-Prompt, Stufe 1
   * und Paket B1). Wird nach einem Engine-Neustart automatisch erneut
   * gesetzt, damit ein Absturz weder Sprache noch Prompt verliert.
   */
  private lastContext: DictationContext | null = null;
  private shuttingDown = false;
  private requestCounter = 0;
  private readonly pending = new Map<string, PendingSegment>();
  /** Wartende flushAndWait-Aufrufer (Hotkey-Stop), aufgeloest bei flush-done. */
  private readonly pendingFlushes = new Map<string, () => void>();
  private readonly workerPath = join(import.meta.dirname, 'engine.worker.js');
  /**
   * RAM-only-Puffer fuer native whisper.cpp-Zeilen, die die Allowlist nicht
   * passieren (M4-Befund: solche Zeilen koennen Transkripttext enthalten und
   * werden deshalb NIE persistiert, siehe native-log.ts).
   */
  private readonly nativeLogBuffer = new NativeLogRingBuffer();

  constructor(
    private readonly config: EngineConfig,
    private readonly callbacks: EngineCallbacks,
    private readonly logger: Logger,
  ) {}

  /** Startet die Engine und wartet, bis das Modell geladen ist. */
  async start(): Promise<Result<void, string>> {
    return this.spawnAndInit();
  }

  private spawnAndInit(): Promise<Result<void, string>> {
    return new Promise((resolve) => {
      this.ready = false;
      const child = utilityProcess.fork(this.workerPath, [], {
        stdio: 'pipe',
        serviceName: 'voicewall-whisper',
      });
      this.child = child;

      let settled = false;
      const settle = (result: Result<void, string>): void => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };

      // Native Ausgaben laufen durch die Allowlist-Schleuse: nur bekannt
      // unkritische Zeilen erreichen die Logdatei, alles andere bleibt im
      // RAM-Puffer (M4-Befund: Randfall-Zeilen koennen Transkripttext tragen).
      child.stdout?.on('data', (data: Buffer) => {
        routeNativeOutput(this.logger, this.nativeLogBuffer, 'stdout', data.toString());
      });
      child.stderr?.on('data', (data: Buffer) => {
        routeNativeOutput(this.logger, this.nativeLogBuffer, 'stderr', data.toString());
      });

      child.on('message', (raw: unknown) => {
        const parsed = workerEventSchema.safeParse(raw);
        if (!parsed.success) {
          this.logger.warn(`Ungueltiges Worker-Event verworfen: ${parsed.error.message}`);
          return;
        }
        this.handleEvent(parsed.data, settle);
      });

      child.on('exit', (code: number) => {
        this.handleExit(code, settle);
      });

      this.post({
        type: 'init',
        whisperModelPath: this.config.whisperModelPath,
        sileroModelPath: this.config.sileroModelPath,
        useGpu: this.config.useGpu,
        minSpeechDurationMs: this.config.minSpeechDurationMs,
        minSilenceDurationMs: this.config.minSilenceDurationMs,
        maxSpeechDurationS: this.config.maxSpeechDurationS,
        vadThreshold: this.config.vadThreshold,
        // UI-Sprache fuer die wenigen nutzersichtbaren Worker-Texte (B3).
        uiLanguage: getUiLanguage(),
      });
    });
  }

  private handleEvent(
    event: WorkerEvent,
    settleStart: (result: Result<void, string>) => void,
  ): void {
    switch (event.type) {
      case 'ready':
        this.ready = true;
        this.restarts = 0;
        this.logger.info('Whisper-Engine bereit (Modell geladen).');
        // Diktat-Kontext (Sprache, Prompt) nach (Neu-)Start wieder anlegen.
        if (this.lastContext !== null) {
          this.post({
            type: 'set-context',
            language: this.lastContext.language,
            prompt: this.lastContext.prompt,
            uiLanguage: getUiLanguage(),
          });
        }
        settleStart(ok(undefined));
        return;
      case 'init-error':
        this.logger.error(`Engine-Initialisierung fehlgeschlagen: ${event.message}`);
        settleStart(err(event.message));
        return;
      case 'transcript': {
        const transcript: TranscriptEvent = {
          text: event.text,
          durationMs: event.durationMs,
          audioMs: event.audioMs,
        };
        if (event.requestId !== undefined) {
          this.resolvePending(event.requestId, ok(transcript));
        } else {
          this.callbacks.onTranscript(transcript);
        }
        return;
      }
      case 'silence':
        if (event.requestId !== undefined) {
          this.resolvePending(event.requestId, ok(null));
        } else {
          this.callbacks.onSilence();
        }
        return;
      case 'flush-done': {
        const waiter = this.pendingFlushes.get(event.requestId);
        if (waiter !== undefined) {
          this.pendingFlushes.delete(event.requestId);
          waiter();
        }
        return;
      }
      case 'transcribe-error':
        this.logger.error(`Transkriptionsfehler: ${event.message}`);
        if (event.requestId !== undefined) {
          this.resolvePending(event.requestId, err(event.message));
        }
        return;
      case 'log':
        // Auch Log-Callbacks der nativen Bibliothek passieren die Schleuse.
        routeNativeOutput(this.logger, this.nativeLogBuffer, `native-${event.level}`, event.text);
        return;
    }
  }

  private handleExit(code: number, settleStart: (result: Result<void, string>) => void): void {
    this.ready = false;
    // Alle offenen Einmal-Transkriptionen scheitern lassen, nie haengen.
    for (const [requestId] of this.pending) {
      this.resolvePending(requestId, err(texte().engine.beendetVorErgebnis));
    }
    // Wartende Flushes aufloesen (der Aufrufer arbeitet mit dem bis dahin
    // eingegangenen Text weiter; haengen darf er nie).
    for (const [, waiter] of this.pendingFlushes) {
      waiter();
    }
    this.pendingFlushes.clear();
    if (this.shuttingDown) {
      this.logger.info('Whisper-Engine planmaessig beendet.');
      return;
    }

    // Nur METADATEN der zurueckgehaltenen nativen Zeilen loggen, nie Inhalt.
    this.logger.warn(`Whisper-Engine unerwartet beendet (Code ${String(code)}).`, {
      code,
      suppressedLines: this.nativeLogBuffer.size,
    });
    if (this.restarts >= MAX_RESTARTS) {
      const message = texte().engine.mehrfachAbgestuerzt;
      this.logger.error(message);
      this.callbacks.onFatal(message);
      settleStart(err(message));
      return;
    }
    this.restarts += 1;
    this.logger.info(
      `Starte Whisper-Engine neu (Versuch ${String(this.restarts)}/${String(MAX_RESTARTS)}).`,
    );
    void this.spawnAndInit().then((result) => {
      if (!result.ok) {
        this.callbacks.onFatal(result.error);
      }
    });
  }

  private resolvePending(requestId: string, result: Result<TranscriptEvent | null, string>): void {
    const entry = this.pending.get(requestId);
    if (entry !== undefined) {
      this.pending.delete(requestId);
      entry.resolve(result);
    }
  }

  private post(command: WorkerCommand): void {
    if (this.child === null) {
      return;
    }
    // Hinweis: Electron-IPC/utilityProcess unterstuetzt in der transfer-Liste
    // nur MessagePortMain, keine ArrayBuffer. PCM wird daher per strukturiertem
    // Klonen uebergeben (Kopie). Bei ca. 100-ms-Chunks unkritisch.
    this.child.postMessage(command);
  }

  /** Kontinuierlicher Modus: PCM-Chunk an die Engine geben. */
  sendAudioChunk(pcm: ArrayBuffer): void {
    if (!this.ready) {
      return;
    }
    this.post({ type: 'audio-chunk', pcm });
  }

  /** Laufendes Segment jetzt verarbeiten (z. B. bei Stop der Aufnahme). */
  flush(): void {
    this.post({ type: 'flush' });
  }

  /**
   * Wie flush(), wartet aber deterministisch, bis der Worker das letzte
   * Segment verarbeitet hat (alle Transkript-Events sind dann zugestellt).
   * Ein Timeout schuetzt gegen einen haengenden Worker; der Aufrufer arbeitet
   * dann mit dem bis dahin eingegangenen Text weiter.
   */
  flushAndWait(timeoutMs: number): Promise<void> {
    if (!this.ready || this.child === null) {
      return Promise.resolve();
    }
    this.requestCounter += 1;
    const requestId = `flush-${String(this.requestCounter)}`;
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (this.pendingFlushes.delete(requestId)) {
          this.logger.warn(
            `Flush-Timeout nach ${String(timeoutMs)} ms: verarbeite mit bisherigem Text weiter.`,
          );
          resolve();
        }
      }, timeoutMs);
      this.pendingFlushes.set(requestId, () => {
        clearTimeout(timer);
        resolve();
      });
      this.post({ type: 'flush', requestId });
    });
  }

  /** Laufendes Segment ohne Transkription verwerfen. */
  reset(): void {
    this.post({ type: 'reset' });
  }

  /**
   * Diktat-Kontext (Sprache plus Initial-Prompt des Fach-Woerterbuchs) fuer
   * alle folgenden Transkriptionen setzen; `prompt: null` loescht den
   * Prompt. Es werden NIE Prompt-Inhalte geloggt. Das passende Modell muss
   * bereits geladen sein (Modellwechsel = Neustart, siehe Orchestrator).
   */
  setContext(context: DictationContext): void {
    this.lastContext = context;
    this.post({
      type: 'set-context',
      language: context.language,
      prompt: context.prompt,
      // Sprache reist im Kontext mit (B3): der Worker uebersetzt damit
      // seine eigenen Fehlertexte, auch nach einem Sprachwechsel.
      uiLanguage: getUiLanguage(),
    });
  }

  /**
   * Einmal-Transkription eines vollstaendigen PCM-Segments (Dev-/Test-Injekt).
   * Durchlaeuft dieselbe VAD-Schleuse: Stille liefert `ok(null)`.
   */
  transcribeSegment(pcm: ArrayBuffer): Promise<Result<TranscriptEvent | null, string>> {
    if (!this.ready) {
      return Promise.resolve(err(texte().engine.nochNichtBereit));
    }
    this.requestCounter += 1;
    const requestId = `seg-${String(this.requestCounter)}`;
    return new Promise((resolve) => {
      this.pending.set(requestId, { resolve });
      this.post({ type: 'segment', pcm, requestId });
    });
  }

  /** Fährt die Engine geordnet herunter. */
  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    if (this.child !== null) {
      this.post({ type: 'shutdown' });
      // Kurze Kulanzzeit fuer sauberes release(), dann hart beenden.
      await new Promise((resolve) => setTimeout(resolve, 200));
      this.child.kill();
      this.child = null;
    }
  }

  get isReady(): boolean {
    return this.ready;
  }
}
