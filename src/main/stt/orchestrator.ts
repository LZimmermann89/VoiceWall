/**
 * Zentrale Steuerung des STT-Kernpfads im Main-Prozess.
 *
 * Bindet zusammen: Einwilligung, OS-Mikrofonberechtigung, Modell-Praesenz und
 * -Download, Whisper-utilityProcess, das versteckte Capture-Fenster und die
 * Status-/Event-Kommunikation mit dem Hauptfenster.
 *
 * Datenfluss Aufnahme:
 *   Capture-Fenster (PCM) --IPC--> hier: RMS berechnen (Pegel), Chunk in den
 *   RAM-Ringpuffer (DoS-Schutz) kopieren, Original-ArrayBuffer an die Engine
 *   transferieren. Die Engine macht VAD-Endpointing und Transkription. Ergebnis
 *   kommt als Event zurueck und geht an das Hauptfenster.
 *
 * Kein Audio auf Platte: PCM existiert nur als ArrayBuffer im RAM. Nach jedem
 * Segment werden Ringpuffer und Engine-Pending aktiv genullt.
 */
import { app, BrowserWindow, ipcMain, type IpcMainEvent } from 'electron';
import { z } from 'zod';
import type {
  AccessibilityState,
  AppStatus,
  DictationFlowStateView,
  HotkeyStatus,
  MicrophoneState,
} from '../../shared/schema';
import { createCaptureWindow } from '../audio/capture-window';
import { DEFAULT_MAX_SAMPLES, PcmRingBuffer } from '../audio/ring-buffer';
import { rmsFromInt16 } from '../../shared/pcm';
import {
  CONSENT_TEXT_VERSION,
  isConsentCurrent,
  readConsent,
  recordConsent,
} from '../consent/consent-store';
import { readGlobalConfig } from '../config/config-store';
import { IpcChannel } from '../ipc/channels';
import type { Logger } from '../log/logger';
import {
  ALL_MODEL_DESCRIPTORS,
  MODEL_CATALOG,
  whisperDescriptorFor,
  type WhisperModelChoice,
} from '../model/model-catalog';
import { ensureModel, getModelStatuses } from '../model/model-store';
import { ensureMicrophoneAccess } from '../permission/microphone';
import { DEFAULT_ENGINE_TUNING, WhisperEngineManager } from '../whisper/engine-manager';

export interface OrchestratorDeps {
  readonly userDataPath: string;
  readonly logger: Logger;
  /** Liefert das Hauptfenster fuer Status-/Event-Versand. */
  readonly getMainWindow: () => BrowserWindow | null;
  /** Aktiviert den Dev-/Test-PCM-Injektionskanal. */
  readonly enableTestIpc: boolean;
  /** GPU nutzen (macOS Metal). */
  readonly useGpu: boolean;
}

/**
 * M3-Statusanteile des systemweiten Diktats. Liefert der FlowController per
 * Provider; solange keiner registriert ist, gelten neutrale Defaults.
 */
export interface FlowStatus {
  readonly flowState: DictationFlowStateView;
  readonly hotkey: HotkeyStatus;
  readonly accessibility: AccessibilityState;
  readonly lastTranscript: string | null;
  readonly clipboardRestoreEnabled: boolean;
}

const DEFAULT_FLOW_STATUS: FlowStatus = {
  flowState: 'idle',
  hotkey: { accelerator: '', registered: false },
  accessibility: 'not-applicable',
  lastTranscript: null,
  clipboardRestoreEnabled: true,
};

/** Timeout fuer das Warten auf das letzte Segment beim Hotkey-Stop. */
const FLUSH_TIMEOUT_MS = 30_000;

/** Fehlermeldungen des Capture-Fensters: nur begrenzte Strings. */
const captureErrorSchema = z.string().min(1).max(1000);

export class DictationOrchestrator {
  private consentGranted = false;
  private consentLoaded = false;
  /** Whisper-Modellwahl (globale Konfig; Wizard-Schritt Modell, M6). */
  private modelChoice: WhisperModelChoice = 'q5_0';
  private microphoneState: MicrophoneState = 'not-checked';
  private engineReady = false;
  private dictationActive = false;
  private lastError: string | null = null;
  private transcriptListener: ((text: string, audioMs: number) => void) | null = null;
  private flowStatusProvider: (() => FlowStatus) | null = null;

  private engine: WhisperEngineManager | null = null;
  private captureWindow: BrowserWindow | null = null;
  private readonly ringBuffer: PcmRingBuffer;

  constructor(private readonly deps: OrchestratorDeps) {
    this.ringBuffer = new PcmRingBuffer({
      maxSamples: DEFAULT_MAX_SAMPLES,
      onOverflow: (dropped) => {
        this.deps.logger.warn(
          `RAM-Ringpuffer-Obergrenze erreicht, aelteste ${String(dropped)} Samples verworfen (DoS-Schutz).`,
        );
      },
    });
  }

  /**
   * Faengt unerwartete Fehler eines invoke-Handlers ab: geloggt wird lokal,
   * der Renderer erhaelt NUR eine generische deutsche Meldung, nie einen
   * rohen Stacktrace oder interne Pfade (ABARBEITUNG 3.5).
   */
  private async guarded(
    action: () => Promise<{ ok: true } | { ok: false; message: string }>,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      return await action();
    } catch (error) {
      this.deps.logger.error(
        `Unerwarteter interner Fehler in einem IPC-Handler: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        ok: false,
        message: 'Unerwarteter interner Fehler. Details stehen im lokalen Log unter userData.',
      };
    }
  }

  /** Registriert alle IPC-Handler des STT-Kerns. */
  register(): void {
    ipcMain.handle(IpcChannel.GetStatus, async () => {
      try {
        return await this.getStatus();
      } catch (error) {
        this.deps.logger.error(
          `Statusabruf fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Nie den rohen Fehler an den Renderer geben: bewusst OHNE cause,
        // damit garantiert nichts Internes ueber IPC serialisiert wird.
        // eslint-disable-next-line preserve-caught-error
        throw new Error('Interner Fehler beim Statusabruf. Details stehen im lokalen Log.');
      }
    });
    ipcMain.handle(IpcChannel.GrantConsent, () => this.guarded(() => this.grantConsent()));
    ipcMain.handle(IpcChannel.PrepareModels, () => this.guarded(() => this.prepareModels()));
    ipcMain.handle(IpcChannel.StartDictation, () => this.guarded(() => this.startDictation()));
    ipcMain.handle(IpcChannel.StopDictation, () => this.guarded(() => this.stopDictation()));
    // Kontrollierter Neustart: macOS meldet frisch erteilte TCC-Freigaben
    // (Bedienungshilfen) einem laufenden Prozess oft erst nach Neustart.
    ipcMain.handle(IpcChannel.SystemRelaunch, () => {
      app.relaunch();
      // exit(0) statt quit(): keine erneuten Dialoge/Interceptoren im Weg.
      setTimeout(() => {
        app.exit(0);
      }, 150);
      return { ok: true as const };
    });

    // Nachrichten des Capture-Fensters.
    ipcMain.on(IpcChannel.CapturePcm, (_event: IpcMainEvent, pcm: unknown) => {
      const buffer = toArrayBuffer(pcm);
      if (buffer !== null) {
        this.handlePcmChunk(buffer);
      }
    });
    ipcMain.on(IpcChannel.CaptureError, (_event: IpcMainEvent, message: unknown) => {
      // Zod-Schema an der Vertrauensgrenze: nur begrenzte Strings akzeptieren.
      const parsed = captureErrorSchema.safeParse(message);
      if (parsed.success) {
        this.setError(parsed.data);
      }
    });
    ipcMain.on(IpcChannel.CaptureStarted, () => {
      this.deps.logger.info('Capture-Fenster meldet: Aufnahme laeuft.');
    });

    if (this.deps.enableTestIpc) {
      // Dev-/Test-only: injiziert ein vollstaendiges PCM-Segment (z. B. aus
      // einem Test-WAV) direkt in die Engine, ohne echtes Mikrofon. Nur aktiv,
      // wenn enableTestIpc gesetzt ist (nie im ausgelieferten Produkt).
      this.deps.logger.warn('Test-IPC-Kanal fuer PCM-Injektion ist AKTIV (nur Dev/Test).');
      ipcMain.handle(IpcChannel.DevInjectPcm, async (_event, pcm: unknown) => {
        const buffer = toArrayBuffer(pcm);
        if (buffer === null) {
          return { ok: false as const, message: 'Kein gültiger PCM-Puffer.' };
        }
        return this.guarded(() => this.injectSegment(buffer));
      });
    }
  }

  private async loadInitialState(): Promise<void> {
    const consent = await readConsent(this.deps.userDataPath);
    this.consentGranted = isConsentCurrent(consent);
    // Modellwahl aus der globalen Konfig (Default Q5_0).
    const config = await readGlobalConfig(this.deps.userDataPath, this.deps.logger);
    this.modelChoice = config.modell;
    this.consentLoaded = true;
  }

  /**
   * Setzt die Whisper-Modellwahl (Wizard/Konfig). Ein Wechsel beendet eine
   * ggf. laufende Engine, damit der naechste Start das gewaehlte Modell
   * laedt. Persistiert wird die Wahl vom FlowController (Konfig-Besitzer).
   */
  async setModelChoice(choice: WhisperModelChoice): Promise<void> {
    if (this.modelChoice === choice) {
      return;
    }
    this.modelChoice = choice;
    if (this.engine !== null) {
      await this.engine.shutdown();
      this.engine = null;
      this.engineReady = false;
    }
    await this.broadcastStatus();
  }

  /** Laedt den persistierten Zustand (Einwilligung) fruehzeitig. */
  async init(): Promise<void> {
    await this.loadInitialState();
  }

  /**
   * True, sobald das Onboarding einmal durchlaufen wurde (Einwilligung
   * erteilt). Steuert das window-all-closed-Verhalten: erst danach lebt die
   * App ohne Fenster weiter (Tray + Hotkey).
   */
  isOnboarded(): boolean {
    return this.consentGranted;
  }

  /**
   * Registriert den zusaetzlichen Transkript-Empfaenger (FlowController).
   * `audioMs` traegt die Audiolaenge des Segments (fuer `dauer_sekunden`
   * beim Diktat-Speichern in M5).
   */
  setTranscriptListener(listener: ((text: string, audioMs: number) => void) | null): void {
    this.transcriptListener = listener;
  }

  /** Registriert die M3-Statusanteile (FlowController). */
  setFlowStatusProvider(provider: (() => FlowStatus) | null): void {
    this.flowStatusProvider = provider;
  }

  /** Stoesst eine Statusmeldung an das Hauptfenster an (fuer den Controller). */
  notifyStatusChanged(): void {
    void this.broadcastStatus();
  }

  /** Meldet einen Fehler des Diktat-Flows (M3) an Log und UI. */
  reportFlowError(message: string): void {
    this.setError(message);
  }

  async getStatus(): Promise<AppStatus> {
    if (!this.consentLoaded) {
      await this.loadInitialState();
    }
    // Status ALLER bekannten Modelle (der Wizard zeigt auch das optionale
    // fp16-Modell); betriebsbereit ist die App, sobald das GEWAEHLTE
    // Whisper-Modell plus VAD vorhanden und verifiziert sind.
    const statuses = await getModelStatuses(this.deps.userDataPath, ALL_MODEL_DESCRIPTORS);
    const models = statuses.map((status) => ({
      id: status.descriptor.id,
      label: status.descriptor.label,
      present: status.present,
      byteSize: status.descriptor.byteSize,
    }));
    const requiredIds = [whisperDescriptorFor(this.modelChoice).id, MODEL_CATALOG.sileroVad.id];
    const flow = this.flowStatusProvider?.() ?? DEFAULT_FLOW_STATUS;
    return {
      consentGranted: this.consentGranted,
      microphoneState: this.microphoneState,
      models,
      modelChoice: this.modelChoice,
      modelsReady: models
        .filter((model) => requiredIds.includes(model.id))
        .every((model) => model.present),
      engineReady: this.engineReady,
      dictationActive: this.dictationActive,
      lastError: this.lastError,
      flowState: flow.flowState,
      hotkey: flow.hotkey,
      accessibility: flow.accessibility,
      lastTranscript: flow.lastTranscript,
      clipboardRestoreEnabled: flow.clipboardRestoreEnabled,
    };
  }

  private async broadcastStatus(): Promise<void> {
    const status = await this.getStatus();
    this.sendToMain(IpcChannel.StatusChanged, status);
  }

  private sendToMain(channel: string, payload: unknown): void {
    const window = this.deps.getMainWindow();
    if (window !== null && !window.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  }

  private setError(message: string): void {
    this.lastError = message;
    this.deps.logger.error(message);
    this.sendToMain(IpcChannel.DictationError, message);
    void this.broadcastStatus();
  }

  /** Einwilligung erteilen und OS-Mikrofonberechtigung anfragen. */
  async grantConsent(): Promise<{ ok: true } | { ok: false; message: string }> {
    await recordConsent(this.deps.userDataPath);
    this.consentGranted = true;
    this.deps.logger.info(
      `Mikrofon-Einwilligung erteilt (Textversion ${String(CONSENT_TEXT_VERSION)}), Zeitstempel gespeichert.`,
    );

    const access = await ensureMicrophoneAccess(this.deps.logger);
    if (access.ok) {
      this.microphoneState = access.value;
    } else {
      this.microphoneState = access.error.state;
      this.setError(access.error.message);
      await this.broadcastStatus();
      return { ok: false, message: access.error.message };
    }
    await this.broadcastStatus();
    return { ok: true };
  }

  /** Fehlende Modelle (gewaehltes Whisper plus VAD) laden und Engine starten. */
  async prepareModels(): Promise<{ ok: true } | { ok: false; message: string }> {
    const descriptors = [whisperDescriptorFor(this.modelChoice), MODEL_CATALOG.sileroVad];
    for (const descriptor of descriptors) {
      const result = await ensureModel(this.deps.userDataPath, descriptor, {
        allowDownload: true,
        onProgress: (progress) => {
          this.sendToMain(IpcChannel.ModelProgress, {
            id: descriptor.id,
            label: descriptor.label,
            receivedBytes: progress.receivedBytes,
            totalBytes: progress.totalBytes,
            percent: progress.percent,
          });
        },
      });
      if (!result.ok) {
        this.setError(result.error.message);
        return { ok: false, message: result.error.message };
      }
    }
    this.deps.logger.info('Alle Modelle vorhanden und verifiziert.');
    const started = await this.ensureEngine();
    if (!started.ok) {
      return { ok: false, message: started.message };
    }
    await this.broadcastStatus();
    return { ok: true };
  }

  private async ensureEngine(): Promise<{ ok: true } | { ok: false; message: string }> {
    if (this.engine !== null && this.engine.isReady) {
      return { ok: true };
    }
    const whisperId = whisperDescriptorFor(this.modelChoice).id;
    const statuses = await getModelStatuses(this.deps.userDataPath, ALL_MODEL_DESCRIPTORS);
    const whisper = statuses.find((status) => status.descriptor.id === whisperId);
    const silero = statuses.find((status) => status.descriptor.id === 'silero-vad');
    if (whisper === undefined || silero === undefined || !whisper.present || !silero.present) {
      const message =
        'Die Modelle fehlen. Bitte zuerst den einmaligen Modell-Download im Einrichtungs-Assistenten ausführen.';
      this.setError(message);
      return { ok: false, message };
    }

    this.engine = new WhisperEngineManager(
      {
        whisperModelPath: whisper.path,
        sileroModelPath: silero.path,
        useGpu: this.deps.useGpu,
        minSpeechDurationMs: DEFAULT_ENGINE_TUNING.minSpeechDurationMs,
        minSilenceDurationMs: DEFAULT_ENGINE_TUNING.minSilenceDurationMs,
        maxSpeechDurationS: DEFAULT_ENGINE_TUNING.maxSpeechDurationS,
        vadThreshold: DEFAULT_ENGINE_TUNING.vadThreshold,
      },
      {
        onTranscript: (event) => {
          this.sendToMain(IpcChannel.TranscriptNew, {
            text: event.text,
            durationMs: event.durationMs,
            audioMs: event.audioMs,
          });
          // M3: der FlowController sammelt Segmente des Hotkey-Diktats.
          this.transcriptListener?.(event.text, event.audioMs);
          // Segment fertig: Ringpuffer aktiv nullen (kein Rohaudio im RAM halten).
          this.ringBuffer.clear();
        },
        onSilence: () => {
          this.deps.logger.debug('VAD: Stille, kein Text erzeugt.');
        },
        onFatal: (message) => {
          this.engineReady = false;
          this.setError(message);
        },
      },
      this.deps.logger,
    );

    const start = await this.engine.start();
    if (!start.ok) {
      this.engineReady = false;
      this.setError(start.error);
      return { ok: false, message: start.error };
    }
    this.engineReady = true;
    return { ok: true };
  }

  private ensureCaptureWindow(): BrowserWindow {
    if (this.captureWindow === null || this.captureWindow.isDestroyed()) {
      this.captureWindow = createCaptureWindow();
      this.captureWindow.on('closed', () => {
        this.captureWindow = null;
      });
    }
    return this.captureWindow;
  }

  /** Testaufnahme starten. */
  async startDictation(): Promise<{ ok: true } | { ok: false; message: string }> {
    if (!this.consentGranted) {
      const message = 'Bitte zuerst die Mikrofon-Einwilligung erteilen.';
      return { ok: false, message };
    }
    const engineOk = await this.ensureEngine();
    if (!engineOk.ok) {
      return engineOk;
    }
    this.engine?.reset();
    this.ringBuffer.clear();
    this.lastError = null;

    const window = this.ensureCaptureWindow();
    const sendStart = (): void => {
      window.webContents.send(IpcChannel.CaptureStart);
    };
    if (window.webContents.isLoading()) {
      window.webContents.once('did-finish-load', sendStart);
    } else {
      sendStart();
    }
    this.dictationActive = true;
    await this.broadcastStatus();
    return { ok: true };
  }

  /** Testaufnahme stoppen und letztes Segment verarbeiten. */
  async stopDictation(): Promise<{ ok: true } | { ok: false; message: string }> {
    if (this.captureWindow !== null && !this.captureWindow.isDestroyed()) {
      this.captureWindow.webContents.send(IpcChannel.CaptureStop);
    }
    // Letztes akkumuliertes Segment verarbeiten, dann Ringpuffer nullen.
    this.engine?.flush();
    this.ringBuffer.clear();
    this.dictationActive = false;
    await this.broadcastStatus();
    return { ok: true };
  }

  /**
   * Hotkey-Stop (M3): Aufnahme beenden und deterministisch warten, bis die
   * Engine das letzte Segment verarbeitet hat. Alle Transkript-Events sind
   * beim Aufloesen des Promises bereits beim Transkript-Listener angekommen.
   */
  async stopDictationAndFlush(): Promise<void> {
    if (this.captureWindow !== null && !this.captureWindow.isDestroyed()) {
      this.captureWindow.webContents.send(IpcChannel.CaptureStop);
    }
    this.dictationActive = false;
    await this.broadcastStatus();
    await this.engine?.flushAndWait(FLUSH_TIMEOUT_MS);
    this.ringBuffer.clear();
  }

  /**
   * Aufnahme abbrechen, ohne zu transkribieren (Sperrbildschirm/Suspend):
   * Capture stoppen, akkumuliertes Audio in Engine und Ringpuffer verwerfen.
   */
  async abortDictation(): Promise<void> {
    if (this.captureWindow !== null && !this.captureWindow.isDestroyed()) {
      this.captureWindow.webContents.send(IpcChannel.CaptureStop);
    }
    this.engine?.reset();
    this.ringBuffer.clear();
    this.dictationActive = false;
    await this.broadcastStatus();
  }

  private handlePcmChunk(pcm: ArrayBuffer): void {
    // Pegel aus dem Chunk berechnen (fuer die Anzeige).
    const view = new Int16Array(pcm);
    const rms = rmsFromInt16(view);
    this.sendToMain(IpcChannel.AudioLevel, { rms });

    // Kopie in den RAM-Ringpuffer (DoS-Schutz, feste Obergrenze).
    this.ringBuffer.append(Int16Array.from(view));

    // Original-ArrayBuffer an die Engine transferieren (zero-copy Handoff).
    this.engine?.sendAudioChunk(pcm);
  }

  /**
   * Dev-/Test-Injektion: transkribiert ein vollstaendiges PCM-Segment. Laeuft
   * durch dieselbe VAD-Schleuse. Stille erzeugt bewusst keinen Text.
   */
  async injectSegment(pcm: ArrayBuffer): Promise<{ ok: true } | { ok: false; message: string }> {
    const engineOk = await this.ensureEngine();
    if (!engineOk.ok) {
      return engineOk;
    }
    if (this.engine === null) {
      return { ok: false, message: 'Engine nicht verfügbar.' };
    }
    const result = await this.engine.transcribeSegment(pcm);
    if (!result.ok) {
      this.setError(result.error);
      return { ok: false, message: result.error };
    }
    if (result.value !== null) {
      this.sendToMain(IpcChannel.TranscriptNew, {
        text: result.value.text,
        durationMs: result.value.durationMs,
        audioMs: result.value.audioMs,
      });
    } else {
      this.deps.logger.info('Injektion: VAD meldete Stille, kein Text erzeugt.');
    }
    return { ok: true };
  }

  /** Geordnetes Herunterfahren (Engine-Kind beenden). */
  async shutdown(): Promise<void> {
    this.ringBuffer.clear();
    if (this.engine !== null) {
      await this.engine.shutdown();
      this.engine = null;
    }
    if (this.captureWindow !== null && !this.captureWindow.isDestroyed()) {
      this.captureWindow.destroy();
      this.captureWindow = null;
    }
  }
}

/**
 * Normalisiert ein per IPC empfangenes PCM auf einen frischen ArrayBuffer.
 * Electron liefert je nach Pfad ArrayBuffer, Node-Buffer oder TypedArray; alle
 * werden hier auf genau die relevanten Bytes zugeschnitten.
 */
function toArrayBuffer(value: unknown): ArrayBuffer | null {
  if (value instanceof ArrayBuffer) {
    return value;
  }
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
  }
  return null;
}
