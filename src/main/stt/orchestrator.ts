/**
 * Zentrale Steuerung des STT-Kernpfads im Main-Prozess.
 *
 * Bindet zusammen: Einwilligung, OS-Mikrofonberechtigung, Modell-Praesenz und
 * -Download, Whisper-utilityProcess, das versteckte Capture-Fenster und die
 * Status-/Event-Kommunikation mit dem Hauptfenster.
 *
 * Datenfluss Aufnahme:
 *   Capture-Fenster (PCM) --IPC--> hier: RMS berechnen (Pegel), den PCM-Chunk an
 *   die Engine uebergeben. Die Engine macht VAD-Endpointing und Transkription.
 *   Ergebnis kommt als Event zurueck und geht an das Hauptfenster.
 *
 * Kein Audio auf Platte: PCM existiert nur als ArrayBuffer im RAM. Der Main-
 * Prozess haelt selbst keinen Audiopuffer; nur die Engine akkumuliert das
 * laufende Segment und nullt es nach jeder Transkription.
 */
import { app, BrowserWindow, ipcMain, type IpcMainEvent } from 'electron';
import { z } from 'zod';
import {
  dictationLanguageSchema,
  modelIdSchema,
  type AccessibilityState,
  type AppStatus,
  type AufbereitungConfig,
  type DictationFlowStateView,
  type DictationLanguage,
  type HotkeyStatus,
  type MicrophoneState,
  type ModelDetailsResult,
  type UiLanguage,
} from '../../shared/schema';
import { createCaptureWindow } from '../audio/capture-window';
import { rmsFromInt16 } from '../../shared/pcm';
import {
  CONSENT_TEXT_VERSION,
  isConsentCurrent,
  readConsent,
  recordConsent,
} from '../consent/consent-store';
import { readGlobalConfig } from '../config/config-store';
import { texte } from '../i18n';
import { IpcChannel } from '../ipc/channels';
import type { Logger } from '../log/logger';
import {
  ALL_MODEL_DESCRIPTORS,
  MODEL_CATALOG,
  modelLabelFor,
  whisperDescriptorForLanguage,
  type ModelId,
  type WhisperModelChoice,
} from '../model/model-catalog';
import {
  ensureModel,
  getModelStatuses,
  removeModelFile,
  type SourceFallbackInfo,
} from '../model/model-store';
import { ensureMicrophoneAccess } from '../permission/microphone';
import {
  DEFAULT_ENGINE_TUNING,
  WhisperEngineManager,
  type DictationContext,
  type TranscriptEvent,
} from '../whisper/engine-manager';

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
 * Statusanteile des systemweiten Diktats. Liefert der FlowController per
 * Provider; solange keiner registriert ist, gelten neutrale Defaults.
 */
export interface FlowStatus {
  readonly flowState: DictationFlowStateView;
  readonly hotkey: HotkeyStatus;
  readonly accessibility: AccessibilityState;
  readonly lastTranscript: string | null;
  readonly clipboardRestoreEnabled: boolean;
  /** Schalter der Textaufbereitung (Stufe 1, globale Konfig). */
  readonly aufbereitung: AufbereitungConfig;
  /** Sprache der Oberflaeche (globale Konfig). */
  readonly uiLanguage: UiLanguage;
}

const DEFAULT_FLOW_STATUS: FlowStatus = {
  flowState: 'idle',
  hotkey: { accelerator: '', registered: false },
  accessibility: 'not-applicable',
  lastTranscript: null,
  clipboardRestoreEnabled: true,
  aufbereitung: {
    fuellwoerterEntfernen: true,
    wortdopplungenEntfernen: false,
    sprachkommandos: false,
  },
  uiLanguage: 'de',
};

/** Timeout fuer das Warten auf das letzte Segment beim Hotkey-Stop. */
const FLUSH_TIMEOUT_MS = 30_000;

/**
 * Fehler-DETAILS des Capture-Fensters: nur begrenzte Strings. Das
 * Capture-Fenster sendet nur noch das technische Detail
 * (getUserMedia-Fehlertext); die nutzersichtbare Meldung baut der Main-
 * Prozess aus dem Katalog (UI-Sprache).
 */
const captureErrorSchema = z.string().min(1).max(1000);

export class DictationOrchestrator {
  private consentGranted = false;
  private consentLoaded = false;
  /** Whisper-Modellwahl (globale Konfig; Wizard-Schritt Modell). */
  private modelChoice: WhisperModelChoice = 'q5_0';
  private microphoneState: MicrophoneState = 'not-checked';
  private engineReady = false;
  private dictationActive = false;
  private lastError: string | null = null;
  private transcriptListener: ((text: string, audioMs: number) => void) | null = null;
  private flowStatusProvider: (() => FlowStatus) | null = null;
  /**
   * Liefert den Diktat-Kontext der aktiven Firma: feste
   * Diktatsprache plus Initial-Prompt des Fach-Woerterbuchs (Stufe 1).
   * Registriert vom Bootstrap (CompanyManager); solange keiner registriert
   * ist, laeuft die Engine auf Deutsch und ohne Prompt.
   */
  private contextProvider: (() => Promise<DictationContext>) | null = null;
  /** Sprache/Modell, mit der die laufende Engine gestartet wurde. */
  private engineLanguage: DictationLanguage | null = null;
  /** Statusmeldung der Engine in der UI-Sprache (z. B. Modellwechsel). */
  private engineHinweis: string | null = null;

  private engine: WhisperEngineManager | null = null;
  private captureWindow: BrowserWindow | null = null;
  /** Laeuft gerade ein Einzel-Download des Modelle-Reiters (seriell)? */
  private modelDownloadActive = false;

  constructor(private readonly deps: OrchestratorDeps) {}

  /**
   * Faengt unerwartete Fehler eines invoke-Handlers ab: geloggt wird lokal,
   * der Renderer erhaelt NUR eine generische Katalog-Meldung (UI-Sprache),
   * nie einen rohen Stacktrace oder interne Pfade.
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
      return { ok: false, message: texte().generisch.internerFehler };
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
        throw new Error(texte().generisch.statusFehler);
      }
    });
    ipcMain.handle(IpcChannel.GrantConsent, () => this.guarded(() => this.grantConsent()));
    // Optionaler Sprach-Parameter (Wizard: die Sprache steht fest, bevor die
    // Firma existiert); ohne Parameter gilt die Sprache der aktiven Firma.
    ipcMain.handle(IpcChannel.PrepareModels, (_event, raw: unknown) => {
      const parsed = dictationLanguageSchema.optional().safeParse(raw ?? undefined);
      if (!parsed.success) {
        return Promise.resolve({
          ok: false as const,
          message: texte().stt.ungueltigeDiktatsprache,
        });
      }
      return this.guarded(() => this.prepareModels(parsed.data));
    });
    ipcMain.handle(IpcChannel.StartDictation, () => this.guarded(() => this.startDictation()));
    ipcMain.handle(IpcChannel.StopDictation, () => this.guarded(() => this.stopDictation()));

    // Modelle-Reiter: Detailstatus, Einzel-Download, kontrolliertes
    // Loeschen. Eingaben werden per zod validiert; Fehler bleiben Results.
    ipcMain.handle(IpcChannel.ModelDetails, async (): Promise<ModelDetailsResult> => {
      try {
        return await this.modelDetails();
      } catch (error) {
        this.deps.logger.error(
          `Modell-Detailstatus fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
        );
        return { modelle: [] };
      }
    });
    ipcMain.handle(IpcChannel.ModelDownload, (_event, raw: unknown) => {
      const parsed = modelIdSchema.safeParse(raw);
      if (!parsed.success) {
        return Promise.resolve({
          ok: false as const,
          message: texte().modelle.unbekannteKennung,
        });
      }
      return this.guarded(() => this.downloadModelById(parsed.data));
    });
    ipcMain.handle(IpcChannel.ModelDelete, (_event, raw: unknown) => {
      const parsed = modelIdSchema.safeParse(raw);
      if (!parsed.success) {
        return Promise.resolve({
          ok: false as const,
          message: texte().modelle.unbekannteKennung,
        });
      }
      return this.guarded(() => this.deleteModelById(parsed.data));
    });
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
        this.setError(texte().stt.mikrofonZugriffFehler(parsed.data));
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
          return { ok: false as const, message: texte().stt.keinPcmPuffer };
        }
        return this.guarded(() => this.injectSegment(buffer));
      });
      // Prompt-Beweis: zuletzt an den Worker gesendeter Diktat-Kontext.
      // Nur Dev/Test; Prompt-Inhalte verlassen den Rechner nie und werden
      // weiterhin nie geloggt.
      ipcMain.handle(IpcChannel.DevGetLastContext, () => this.engine?.lastSentContext ?? null);
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
      this.engineLanguage = null;
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
   * beim Diktat-Speichern).
   */
  setTranscriptListener(listener: ((text: string, audioMs: number) => void) | null): void {
    this.transcriptListener = listener;
  }

  /** Registriert die Statusanteile des systemweiten Diktats (FlowController). */
  setFlowStatusProvider(provider: (() => FlowStatus) | null): void {
    this.flowStatusProvider = provider;
  }

  /**
   * Registriert den Diktat-Kontext-Lieferanten (Sprache der aktiven Firma
   * plus Fach-Woerterbuch-Prompt, Stufe 1).
   */
  setDictationContextProvider(provider: (() => Promise<DictationContext>) | null): void {
    this.contextProvider = provider;
  }

  /**
   * Loest den aktuellen Diktat-Kontext auf (vor jedem Diktat-Start und vor
   * jeder Test-Injektion, damit Vokabular-Aenderungen, Firmen- und
   * Sprachwechsel sofort greifen). Fehler blockieren das Diktat nie: der
   * Fallback ist Deutsch ohne Prompt; es werden nie Prompt-Inhalte geloggt.
   */
  private async resolveDictationContext(): Promise<DictationContext> {
    try {
      if (this.contextProvider !== null) {
        return await this.contextProvider();
      }
    } catch (error) {
      this.deps.logger.warn(
        `Diktat-Kontext konnte nicht geladen werden, Diktat läuft auf Deutsch ohne Prompt weiter: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return { language: 'de', prompt: null };
  }

  /** Stoesst eine Statusmeldung an das Hauptfenster an (fuer den Controller). */
  notifyStatusChanged(): void {
    void this.broadcastStatus();
  }

  /** Meldet einen Fehler des Diktat-Flows an Log und UI. */
  reportFlowError(message: string): void {
    this.setError(message);
  }

  async getStatus(): Promise<AppStatus> {
    if (!this.consentLoaded) {
      await this.loadInitialState();
    }
    // Status ALLER bekannten Modelle (der Wizard zeigt auch das optionale
    // fp16-Modell und das mehrsprachige EN-Modell); betriebsbereit ist die
    // App, sobald das fuer die AKTIVE Sprache noetige Whisper-Modell plus
    // VAD vorhanden und verifiziert sind.
    const statuses = await getModelStatuses(this.deps.userDataPath, ALL_MODEL_DESCRIPTORS);
    const models = statuses.map((status) => ({
      id: status.descriptor.id,
      // Anzeigename in der UI-Sprache; descriptor.label bleibt das
      // deutsche Log-/Audit-Label (model-manifest.json).
      label: modelLabelFor(status.descriptor.id),
      present: status.present,
      byteSize: status.descriptor.byteSize,
    }));
    const language = (await this.resolveDictationContext()).language;
    const requiredIds = [
      whisperDescriptorForLanguage(language, this.modelChoice).id,
      MODEL_CATALOG.sileroVad.id,
    ];
    const flow = this.flowStatusProvider?.() ?? DEFAULT_FLOW_STATUS;
    return {
      consentGranted: this.consentGranted,
      microphoneState: this.microphoneState,
      models,
      modelChoice: this.modelChoice,
      dictationLanguage: language,
      modelsReady: models
        .filter((model) => requiredIds.includes(model.id))
        .every((model) => model.present),
      engineReady: this.engineReady,
      engineHinweis: this.engineHinweis,
      dictationActive: this.dictationActive,
      lastError: this.lastError,
      flowState: flow.flowState,
      hotkey: flow.hotkey,
      accessibility: flow.accessibility,
      lastTranscript: flow.lastTranscript,
      clipboardRestoreEnabled: flow.clipboardRestoreEnabled,
      aufbereitung: flow.aufbereitung,
      uiLanguage: flow.uiLanguage,
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

  /**
   * Fehlende Modelle laden und Engine starten. Geladen werden NUR die fuer
   * die aktive Diktatsprache noetigen Modelle plus VAD (kein Auto-Download
   * des EN-Modells, solange keine Firma Englisch waehlt). `languageOverride`
   * nutzt der Wizard: dort steht die Sprache fest, BEVOR die Firma existiert.
   */
  /**
   * Betriebslog-Warnung, wenn eine Download-Quelle scheitert und die
   * naechste versucht wird. Nur Host und Fehlerart, nie die volle
   * URL; alle Meta-Felder sind in der Logger-Allowlist freigegeben.
   */
  private sourceFallbackLogger(modelId: ModelId): (info: SourceFallbackInfo) => void {
    return (info) => {
      this.deps.logger.warn('Modell-Download: Quelle fehlgeschlagen, versuche Rueckfallquelle.', {
        modelId,
        source: info.failedHost,
        reason: info.errorKind,
        attempt: info.attempt,
        maxAttempts: info.maxAttempts,
      });
    };
  }

  async prepareModels(
    languageOverride?: DictationLanguage,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const language = languageOverride ?? (await this.resolveDictationContext()).language;
    const descriptors = [
      whisperDescriptorForLanguage(language, this.modelChoice),
      MODEL_CATALOG.sileroVad,
    ];
    for (const descriptor of descriptors) {
      const result = await ensureModel(this.deps.userDataPath, descriptor, {
        allowDownload: true,
        onProgress: (progress) => {
          this.sendToMain(IpcChannel.ModelProgress, {
            id: descriptor.id,
            label: modelLabelFor(descriptor.id),
            receivedBytes: progress.receivedBytes,
            totalBytes: progress.totalBytes,
            percent: progress.percent,
          });
        },
        onSourceFallback: this.sourceFallbackLogger(descriptor.id),
      });
      if (!result.ok) {
        this.setError(result.error.message);
        return { ok: false, message: result.error.message };
      }
    }
    this.deps.logger.info('Alle Modelle vorhanden und verifiziert.');
    const started = await this.ensureEngine(language);
    if (!started.ok) {
      return { ok: false, message: started.message };
    }
    await this.broadcastStatus();
    return { ok: true };
  }

  /**
   * IDs der aktuell zwingend benoetigten Modelle: das Whisper-Modell der
   * aktiven Diktatsprache/Modellwahl plus das VAD-Modell. Diese Modelle
   * sind im Modelle-Reiter nicht loeschbar.
   */
  private async requiredModelIds(): Promise<readonly ModelId[]> {
    const language = (await this.resolveDictationContext()).language;
    return [
      whisperDescriptorForLanguage(language, this.modelChoice).id,
      MODEL_CATALOG.sileroVad.id,
    ];
  }

  /**
   * Detailstatus ALLER Katalog-Modelle fuer den Modelle-Reiter:
   * Anzeigename (UI-Sprache), Groesse und SHA-256 aus dem Katalog,
   * Praesenz-/Integritaetsstatus und die Loeschbarkeits-Regel.
   */
  async modelDetails(): Promise<ModelDetailsResult> {
    const statuses = await getModelStatuses(this.deps.userDataPath, ALL_MODEL_DESCRIPTORS);
    const required = await this.requiredModelIds();
    return {
      modelle: statuses.map((status) => ({
        id: status.descriptor.id,
        label: modelLabelFor(status.descriptor.id),
        byteSize: status.descriptor.byteSize,
        sha256: status.descriptor.sha256,
        present: status.present,
        erforderlich: required.includes(status.descriptor.id),
      })),
    };
  }

  /**
   * Einzel-Download eines Katalog-Modells (Modelle-Reiter). Downloads
   * laufen bewusst seriell (ein Download zur Zeit); der Fortschritt geht
   * ueber den bestehenden ModelProgress-Kanal an den Renderer. Verifiziert
   * wird wie immer gegen die fest hinterlegte SHA-256-Konstante.
   */
  async downloadModelById(id: ModelId): Promise<{ ok: true } | { ok: false; message: string }> {
    const descriptor = ALL_MODEL_DESCRIPTORS.find((entry) => entry.id === id);
    if (descriptor === undefined) {
      return { ok: false, message: texte().modelle.unbekannteKennung };
    }
    if (this.modelDownloadActive) {
      return { ok: false, message: texte().modelle.downloadLaeuftBereits };
    }
    this.modelDownloadActive = true;
    try {
      const result = await ensureModel(this.deps.userDataPath, descriptor, {
        allowDownload: true,
        onProgress: (progress) => {
          this.sendToMain(IpcChannel.ModelProgress, {
            id: descriptor.id,
            label: modelLabelFor(descriptor.id),
            receivedBytes: progress.receivedBytes,
            totalBytes: progress.totalBytes,
            percent: progress.percent,
          });
        },
        onSourceFallback: this.sourceFallbackLogger(descriptor.id),
      });
      if (!result.ok) {
        this.setError(result.error.message);
        return { ok: false, message: result.error.message };
      }
      this.deps.logger.info(`Modell geladen und verifiziert (Modelle-Reiter): ${descriptor.label}`);
      await this.broadcastStatus();
      return { ok: true };
    } finally {
      this.modelDownloadActive = false;
    }
  }

  /**
   * Kontrolliertes Loeschen einer Modelldatei (Modelle-Reiter).
   * Regeln: NIE das Whisper-Modell der aktiven Diktatsprache und NIE das
   * VAD-Modell (erklaerende Meldung). Laeuft die Engine noch mit dem zu
   * loeschenden Modell (z. B. nach einem Sprachwechsel), wird sie vorher
   * geordnet beendet. Der Integritaets-Marker wird mit ausgetragen; ein
   * spaeterer Download verifiziert wieder voll.
   */
  async deleteModelById(id: ModelId): Promise<{ ok: true } | { ok: false; message: string }> {
    const descriptor = ALL_MODEL_DESCRIPTORS.find((entry) => entry.id === id);
    if (descriptor === undefined) {
      return { ok: false, message: texte().modelle.unbekannteKennung };
    }
    const required = await this.requiredModelIds();
    if (required.includes(id)) {
      return { ok: false, message: texte().modelle.loeschenGesperrt(modelLabelFor(id)) };
    }
    if (this.engine !== null && this.engineLanguage !== null) {
      const engineModelId = whisperDescriptorForLanguage(this.engineLanguage, this.modelChoice).id;
      if (engineModelId === id) {
        await this.engine.shutdown();
        this.engine = null;
        this.engineReady = false;
        this.engineLanguage = null;
      }
    }
    const removed = await removeModelFile(this.deps.userDataPath, descriptor);
    if (!removed.ok) {
      return { ok: false, message: removed.error };
    }
    this.deps.logger.info(`Modelldatei geloescht (Modelle-Reiter): ${descriptor.fileName}`);
    await this.broadcastStatus();
    return { ok: true };
  }

  /**
   * Stellt die Engine fuer die gewuenschte Diktatsprache sicher. Laeuft
   * bereits eine Engine mit dem Modell einer ANDEREN Sprache, wird sie
   * geordnet beendet und mit dem richtigen Modell neu gestartet
   * (Modellwechsel = Engine-Neustart; deutsche Statusmeldung in der UI).
   */
  private async ensureEngine(
    language: DictationLanguage,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    if (this.engine !== null && this.engine.isReady && this.engineLanguage === language) {
      return { ok: true };
    }
    if (this.engine !== null && this.engineLanguage !== language) {
      this.engineHinweis =
        language === 'en' ? texte().stt.sprachwechselEnglisch : texte().stt.sprachwechselDeutsch;
      this.deps.logger.info(
        `Diktatsprache gewechselt (${this.engineLanguage ?? 'unbekannt'} -> ${language}): Engine wird mit dem passenden Modell neu gestartet.`,
      );
      await this.broadcastStatus();
      await this.engine.shutdown();
      this.engine = null;
      this.engineReady = false;
    }
    const whisperId = whisperDescriptorForLanguage(language, this.modelChoice).id;
    const statuses = await getModelStatuses(this.deps.userDataPath, ALL_MODEL_DESCRIPTORS);
    const whisper = statuses.find((status) => status.descriptor.id === whisperId);
    const silero = statuses.find((status) => status.descriptor.id === 'silero-vad');
    if (whisper === undefined || silero === undefined || !whisper.present || !silero.present) {
      this.engineHinweis = null;
      const message =
        language === 'en' ? texte().stt.modelleFehlenEnglisch : texte().stt.modelleFehlenDeutsch;
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
          // Der FlowController sammelt Segmente des Hotkey-Diktats.
          this.transcriptListener?.(event.text, event.audioMs);
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
      this.engineLanguage = null;
      this.engineHinweis = null;
      this.setError(start.error);
      return { ok: false, message: start.error };
    }
    this.engineReady = true;
    this.engineLanguage = language;
    this.engineHinweis = null;
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
      return { ok: false, message: texte().stt.einwilligungZuerst };
    }
    // Diktat-Kontext der aktiven Firma: Sprache bestimmt das Modell
    // (Engine-Neustart bei Wechsel), Prompt kommt aus dem Fach-Woerterbuch.
    const context = await this.resolveDictationContext();
    const engineOk = await this.ensureEngine(context.language);
    if (!engineOk.ok) {
      return engineOk;
    }
    this.engine?.setContext(context);
    this.engine?.reset();
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
    // Letztes akkumuliertes Segment verarbeiten.
    this.engine?.flush();
    this.dictationActive = false;
    await this.broadcastStatus();
    return { ok: true };
  }

  /**
   * Hotkey-Stop: Aufnahme beenden und deterministisch warten, bis die
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
  }

  /**
   * Aufnahme abbrechen, ohne zu transkribieren (Sperrbildschirm/Suspend):
   * Capture stoppen, akkumuliertes Audio in der Engine verwerfen.
   */
  async abortDictation(): Promise<void> {
    if (this.captureWindow !== null && !this.captureWindow.isDestroyed()) {
      this.captureWindow.webContents.send(IpcChannel.CaptureStop);
    }
    this.engine?.reset();
    this.dictationActive = false;
    await this.broadcastStatus();
  }

  private handlePcmChunk(pcm: ArrayBuffer): void {
    // Pegel aus dem Chunk berechnen (fuer die Anzeige).
    const view = new Int16Array(pcm);
    const rms = rmsFromInt16(view);
    this.sendToMain(IpcChannel.AudioLevel, { rms });

    // Den PCM-Chunk an die Engine geben. Sie uebergibt ihn per strukturiertem
    // Klonen an den utilityProcess (keine echte Transfer-Liste fuer ArrayBuffer,
    // siehe engine-manager). Der Main-Prozess selbst haelt kein Rohaudio.
    this.engine?.sendAudioChunk(pcm);
  }

  /**
   * Dev-/Test-Injektion (Kern): transkribiert ein vollstaendiges PCM-Segment
   * mit dem aktuellen Initial-Prompt und liefert das Ergebnis zurueck.
   * Laeuft durch dieselbe VAD-Schleuse: Stille liefert ok(null), auch mit
   * gesetztem Prompt (Anti-Halluzination).
   */
  async transcribeInjectedPcm(
    pcm: ArrayBuffer,
  ): Promise<{ ok: true; transcript: TranscriptEvent | null } | { ok: false; message: string }> {
    const context = await this.resolveDictationContext();
    const engineOk = await this.ensureEngine(context.language);
    if (!engineOk.ok) {
      return engineOk;
    }
    if (this.engine === null) {
      return { ok: false, message: texte().stt.engineNichtVerfuegbar };
    }
    this.engine.setContext(context);
    const result = await this.engine.transcribeSegment(pcm);
    if (!result.ok) {
      this.setError(result.error);
      return { ok: false, message: result.error };
    }
    return { ok: true, transcript: result.value };
  }

  /**
   * Dev-/Test-Injektion: transkribiert ein vollstaendiges PCM-Segment. Laeuft
   * durch dieselbe VAD-Schleuse. Stille erzeugt bewusst keinen Text.
   */
  async injectSegment(pcm: ArrayBuffer): Promise<{ ok: true } | { ok: false; message: string }> {
    const result = await this.transcribeInjectedPcm(pcm);
    if (!result.ok) {
      return result;
    }
    if (result.transcript !== null) {
      this.sendToMain(IpcChannel.TranscriptNew, {
        text: result.transcript.text,
        durationMs: result.transcript.durationMs,
        audioMs: result.transcript.audioMs,
      });
    } else {
      this.deps.logger.info('Injektion: VAD meldete Stille, kein Text erzeugt.');
    }
    return { ok: true };
  }

  /** Geordnetes Herunterfahren (Engine-Kind beenden). */
  async shutdown(): Promise<void> {
    if (this.engine !== null) {
      await this.engine.shutdown();
      this.engine = null;
      this.engineLanguage = null;
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
export function toArrayBuffer(value: unknown): ArrayBuffer | null {
  if (value instanceof ArrayBuffer) {
    return value;
  }
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
  }
  return null;
}
