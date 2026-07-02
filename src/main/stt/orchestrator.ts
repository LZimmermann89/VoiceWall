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
import { BrowserWindow, ipcMain, type IpcMainEvent } from 'electron';
import type { AppStatus, MicrophoneState } from '../../shared/schema';
import { createCaptureWindow } from '../audio/capture-window';
import { DEFAULT_MAX_SAMPLES, PcmRingBuffer } from '../audio/ring-buffer';
import { rmsFromInt16 } from '../../shared/pcm';
import {
  CONSENT_TEXT_VERSION,
  isConsentCurrent,
  readConsent,
  recordConsent,
} from '../consent/consent-store';
import { IpcChannel } from '../ipc/channels';
import type { Logger } from '../log/logger';
import { MODEL_CATALOG } from '../model/model-catalog';
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

export class DictationOrchestrator {
  private consentGranted = false;
  private microphoneState: MicrophoneState = 'not-checked';
  private engineReady = false;
  private dictationActive = false;
  private lastError: string | null = null;

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

  /** Registriert alle IPC-Handler des STT-Kerns. */
  register(): void {
    ipcMain.handle(IpcChannel.GetStatus, () => this.getStatus());
    ipcMain.handle(IpcChannel.GrantConsent, () => this.grantConsent());
    ipcMain.handle(IpcChannel.PrepareModels, () => this.prepareModels());
    ipcMain.handle(IpcChannel.StartDictation, () => this.startDictation());
    ipcMain.handle(IpcChannel.StopDictation, () => this.stopDictation());

    // Nachrichten des Capture-Fensters.
    ipcMain.on(IpcChannel.CapturePcm, (_event: IpcMainEvent, pcm: unknown) => {
      const buffer = toArrayBuffer(pcm);
      if (buffer !== null) {
        this.handlePcmChunk(buffer);
      }
    });
    ipcMain.on(IpcChannel.CaptureError, (_event: IpcMainEvent, message: unknown) => {
      if (typeof message === 'string') {
        this.setError(message);
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
          return { ok: false as const, message: 'Kein gueltiger PCM-Puffer.' };
        }
        return this.injectSegment(buffer);
      });
    }
  }

  private async loadInitialState(): Promise<void> {
    const consent = await readConsent(this.deps.userDataPath);
    this.consentGranted = isConsentCurrent(consent);
  }

  async getStatus(): Promise<AppStatus> {
    if (this.microphoneState === 'not-checked') {
      await this.loadInitialState();
    }
    const statuses = await getModelStatuses(this.deps.userDataPath);
    const models = statuses.map((status) => ({
      id: status.descriptor.id,
      label: status.descriptor.label,
      present: status.present,
    }));
    return {
      consentGranted: this.consentGranted,
      microphoneState: this.microphoneState,
      models,
      modelsReady: models.every((model) => model.present),
      engineReady: this.engineReady,
      dictationActive: this.dictationActive,
      lastError: this.lastError,
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

  /** Fehlende Modelle laden und Engine starten. */
  async prepareModels(): Promise<{ ok: true } | { ok: false; message: string }> {
    const descriptors = [MODEL_CATALOG.whisperQ5, MODEL_CATALOG.sileroVad];
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
    const statuses = await getModelStatuses(this.deps.userDataPath);
    const whisper = statuses.find((status) => status.descriptor.id === 'whisper-q5');
    const silero = statuses.find((status) => status.descriptor.id === 'silero-vad');
    if (whisper === undefined || silero === undefined || !whisper.present || !silero.present) {
      const message =
        'Die Modelle fehlen. Bitte zuerst den einmaligen Modell-Download im Einrichtungs-Assistenten ausfuehren.';
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
      return { ok: false, message: 'Engine nicht verfuegbar.' };
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
