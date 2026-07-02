/**
 * Main-seitige Aufsicht ueber den Whisper-utilityProcess.
 *
 * Verantwortlich fuer:
 * - Fork des Worker-Entries (out/main/engine.worker.js) mit stdio:'pipe',
 *   damit native whisper.cpp-/ggml-Ausgaben ins Main-Log wandern.
 * - Absturz-Isolation: das `exit`-Event wird ueberwacht; bei unerwartetem
 *   Ende wird die Engine automatisch neu gestartet (max. 3 Versuche), danach
 *   eine deutsche Fehlermeldung an die UI.
 * - Getypte, zod-validierte Nachrichten in beide Richtungen. PCM wird als
 *   ArrayBuffer transferiert (zero-copy, aktiver Handoff).
 */
import { join } from 'node:path';
import { utilityProcess, type UtilityProcess } from 'electron';
import { err, ok, type Result } from '../../shared/result';
import type { Logger } from '../log/logger';
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

export interface EngineCallbacks {
  /** Ein Segment wurde transkribiert (kontinuierlicher Modus). */
  readonly onTranscript: (event: TranscriptEvent) => void;
  /** VAD hat keine Sprache erkannt (kontinuierlicher Modus). */
  readonly onSilence: () => void;
  /** Fataler, nicht mehr behebbarer Engine-Fehler (deutsche UI-Meldung). */
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
  private shuttingDown = false;
  private requestCounter = 0;
  private readonly pending = new Map<string, PendingSegment>();
  private readonly workerPath = join(import.meta.dirname, 'engine.worker.js');

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

      child.stdout?.on('data', (data: Buffer) => {
        this.logger.debug(`[whisper stdout] ${data.toString().trimEnd()}`);
      });
      child.stderr?.on('data', (data: Buffer) => {
        this.logger.debug(`[whisper stderr] ${data.toString().trimEnd()}`);
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
      case 'transcribe-error':
        this.logger.error(`Transkriptionsfehler: ${event.message}`);
        if (event.requestId !== undefined) {
          this.resolvePending(event.requestId, err(event.message));
        }
        return;
      case 'log':
        this.logger.debug(`[whisper ${event.level}] ${event.text}`);
        return;
    }
  }

  private handleExit(code: number, settleStart: (result: Result<void, string>) => void): void {
    this.ready = false;
    // Alle offenen Einmal-Transkriptionen scheitern lassen, nie haengen.
    for (const [requestId] of this.pending) {
      this.resolvePending(requestId, err('Engine wurde beendet, bevor ein Ergebnis vorlag.'));
    }
    if (this.shuttingDown) {
      this.logger.info('Whisper-Engine planmaessig beendet.');
      return;
    }

    this.logger.warn(`Whisper-Engine unerwartet beendet (Code ${String(code)}).`);
    if (this.restarts >= MAX_RESTARTS) {
      const message =
        'Die Spracherkennung ist mehrfach abgestuerzt und konnte nicht neu gestartet werden. Bitte VoiceWall neu starten; bleibt der Fehler, das Log unter userData pruefen.';
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

  /** Laufendes Segment ohne Transkription verwerfen. */
  reset(): void {
    this.post({ type: 'reset' });
  }

  /**
   * Einmal-Transkription eines vollstaendigen PCM-Segments (Dev-/Test-Injekt).
   * Durchlaeuft dieselbe VAD-Schleuse: Stille liefert `ok(null)`.
   */
  transcribeSegment(pcm: ArrayBuffer): Promise<Result<TranscriptEvent | null, string>> {
    if (!this.ready) {
      return Promise.resolve(err('Die Spracherkennung ist noch nicht bereit.'));
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
