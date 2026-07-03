/**
 * Domänen- und Brückentypen, die Main, Preload und Renderer gemeinsam nutzen.
 * Dieses Modul darf weder Node- noch DOM-APIs verwenden.
 */
import type {
  CompanyDetails,
  CompanyListView,
  CompanyNamePreview,
  CompanyStorageStrategy,
  CreateCompanyResult,
  DictateListResult,
  DictateSearchFilter,
  SaveDictateResult,
  SyncCheckView,
} from './company';
import type {
  ActionResult,
  AppStatus,
  AudioLevel,
  DeliveryResult,
  ModelChoiceView,
  ModelProgress,
  PingResponse,
  SystemInfo,
  TranscriptPayload,
} from './schema';

/** Funktion zum Abmelden eines Event-Listeners. */
export type Unsubscribe = () => void;

/**
 * Die schmale, getypte API, die der Preload über die contextBridge als
 * `window.voicewall` in den Renderer (Hauptfenster) exponiert.
 */
export interface VoiceWallBridge {
  /** Erreichbarkeitstest der IPC-Brücke: liefert validiert `pong`. */
  readonly ping: () => Promise<PingResponse>;
  /** Aktuellen Gesamtstatus abfragen. */
  readonly getStatus: () => Promise<AppStatus>;
  /** Informierte Mikrofon-Einwilligung erteilen (mit Zeitstempel gespeichert). */
  readonly grantConsent: () => Promise<ActionResult>;
  /** Fehlende Modelle laden (einmaliger Download) und Engine starten. */
  readonly prepareModels: () => Promise<ActionResult>;
  /** Testaufnahme starten (oeffnet das versteckte Capture-Fenster). */
  readonly startDictation: () => Promise<ActionResult>;
  /** Testaufnahme stoppen und letztes Segment verarbeiten. */
  readonly stopDictation: () => Promise<ActionResult>;
  /** Abonniert Statusaenderungen. */
  readonly onStatus: (listener: (status: AppStatus) => void) => Unsubscribe;
  /** Abonniert Modell-Download-Fortschritt. */
  readonly onModelProgress: (listener: (progress: ModelProgress) => void) => Unsubscribe;
  /** Abonniert neue Transkript-Segmente. */
  readonly onTranscript: (listener: (transcript: TranscriptPayload) => void) => Unsubscribe;
  /** Abonniert Pegelaenderungen (RMS). */
  readonly onAudioLevel: (listener: (level: AudioLevel) => void) => Unsubscribe;
  /** Abonniert deutsche Fehlermeldungen. */
  readonly onError: (listener: (message: string) => void) => Unsubscribe;
  /** Hotkey des systemweiten Diktats aendern (validiert, persistiert). */
  readonly setHotkey: (accelerator: string) => Promise<ActionResult>;
  /** Zwischenablage-Wiederherstellung an-/abschalten (persistiert). */
  readonly setClipboardRestore: (enabled: boolean) => Promise<ActionResult>;
  /** Letztes Transkript (erneut) in die Zwischenablage kopieren. */
  readonly copyLastTranscript: () => Promise<ActionResult>;
  /** macOS: Systemeinstellungen, Bedienungshilfen-Bereich oeffnen. */
  readonly openAccessibilitySettings: () => Promise<ActionResult>;

  // First-Run-Wizard (M6).
  /** System- und App-Informationen (Hardware-Empfehlung, Beleg-Footer). */
  readonly systemInfo: () => Promise<SystemInfo>;
  /** Hotkey-Livetest: registriert kurz und gibt sofort wieder frei. */
  readonly testHotkey: (accelerator: string) => Promise<ActionResult>;
  /** Whisper-Modellwahl persistieren (Q5_0 Standard, fp16 optional). */
  readonly setModelChoice: (choice: ModelChoiceView) => Promise<ActionResult>;

  // Firmenverwaltung und Diktat-Speicher (M5, Ordner-als-Datenbank).
  /** Liste aller validierten Firmen plus aktive Firma und Auto-Speichern. */
  readonly listCompanies: () => Promise<CompanyListView>;
  /** Vorschau des sanitisierten Ordnernamens fuer einen Firmennamen. */
  readonly previewCompanyName: (name: string) => Promise<CompanyNamePreview>;
  /** Neue Firma anlegen (Desktop oder lokal mit Desktop-Verknuepfung). */
  readonly createCompany: (
    name: string,
    strategie: CompanyStorageStrategy,
    details?: CompanyDetails,
    modell?: ModelChoiceView,
    ordnername?: string,
  ) => Promise<CreateCompanyResult>;
  /** Aktive Firma wechseln. */
  readonly setActiveCompany: (pfad: string) => Promise<ActionResult>;
  /** Sync-Pruefung des Desktop-Zielordners (Risiko R8). */
  readonly checkDesktopSync: () => Promise<SyncCheckView>;
  /** Letztes Transkript als Diktat in der aktiven Firma speichern. */
  readonly saveLastDictate: () => Promise<SaveDictateResult>;
  /** Diktate der aktiven Firma auflisten/durchsuchen (Manifest-Schnellsuche). */
  readonly listDictates: (filter: DictateSearchFilter) => Promise<DictateListResult>;
  /** Diktate automatisch in der aktiven Firma speichern (an/aus). */
  readonly setDictateAutoSave: (enabled: boolean) => Promise<ActionResult>;
  /**
   * Nur Dev/Test: injiziert ein vollstaendiges PCM-Segment direkt in die
   * Engine (deterministischer Beweis ohne echtes Mikrofon). Ohne aktiven
   * Test-IPC-Kanal im Main-Prozess schlaegt der Aufruf kontrolliert fehl.
   */
  readonly devInjectPcm: (pcm: ArrayBuffer) => Promise<ActionResult>;
  /**
   * Nur Dev/Test: ersetzt den Paste-Adapter durch einen aufzeichnenden Mock
   * (kein echter osascript-/PowerShell-Aufruf, z. B. in der CI).
   */
  readonly devMockPaste: (enabled: boolean) => Promise<ActionResult>;
  /** Nur Dev/Test: Anzahl der aufgezeichneten Mock-Paste-Aufrufe. */
  readonly devGetPasteCalls: () => Promise<number>;
  /**
   * Nur Dev/Test: uebersteuert den Bedienungshilfen-Check (true/false) oder
   * setzt ihn mit null auf den echten OS-Check zurueck.
   */
  readonly devSetAccessibility: (trusted: boolean | null) => Promise<ActionResult>;
  /**
   * Nur Dev/Test: fuehrt die komplette Ergebnis-Zustellung (Clipboard-Sequenz,
   * Accessibility-Check, Auto-Paste) fuer einen gegebenen Text aus.
   */
  readonly devRunDictationResult: (text: string) => Promise<DeliveryResult>;
}

/**
 * Zustaende, die das Overlay-Fenster anzeigen kann. `done` und `error` zeigen
 * den Kopieren-Knopf (Resilienz-Primaerpfad: der Text geht nie verloren).
 */
export interface OverlayStatePayload {
  readonly kind: 'recording' | 'transcribing' | 'done' | 'no-speech' | 'error';
  /** Deutsche Meldung (bei done/error), sonst null. */
  readonly message: string | null;
}

/**
 * API des Overlay-Fensters ("Ich hoere zu"). Das Overlay ist nicht fokussierbar
 * und empfaengt nur Anzeige-Zustaende; einzige Rueckrichtung ist der
 * Kopieren-Knopf.
 */
export interface VoiceWallOverlayBridge {
  /** Abonniert Anzeige-Zustaende vom Main-Prozess. */
  readonly onState: (listener: (state: OverlayStatePayload) => void) => Unsubscribe;
  /** Kopiert das letzte Transkript erneut in die Zwischenablage. */
  readonly copyLastTranscript: () => void;
}

/**
 * API des versteckten Audio-Capture-Fensters. Reicht rohes PCM und Fehler an
 * den Main-Prozess und empfaengt Start-/Stop-Kommandos.
 */
export interface VoiceWallCaptureBridge {
  /** Sendet einen 16-bit-PCM-Chunk (ArrayBuffer, transferiert) an den Main. */
  readonly sendPcm: (pcm: ArrayBuffer) => void;
  /** Meldet einen Capture-Fehler (deutsche Meldung) an den Main. */
  readonly reportError: (message: string) => void;
  /** Meldet, dass die Aufnahme im Fenster tatsaechlich laeuft. */
  readonly reportStarted: () => void;
  /** Abonniert das Start-Kommando vom Main-Prozess. */
  readonly onStart: (listener: () => void) => Unsubscribe;
  /** Abonniert das Stop-Kommando vom Main-Prozess. */
  readonly onStop: (listener: () => void) => Unsubscribe;
}
