/**
 * Domänen- und Brückentypen, die Main, Preload und Renderer gemeinsam nutzen.
 * Dieses Modul darf weder Node- noch DOM-APIs verwenden.
 */
import type {
  BatchExportInput,
  BatchExportResult,
  BelegInfoResult,
  CompanyDetails,
  CompanyListView,
  CompanyNamePreview,
  CompanyStorageStrategy,
  CreateCompanyResult,
  DecryptFileResult,
  DictateDetailResult,
  DictateListResult,
  DictateMutationResult,
  DictateSearchFilter,
  DictateUpdateInput,
  EncryptedExportInput,
  ExportInput,
  ExportProgress,
  ExportResult,
  ManualNoteInput,
  SaveDictateResult,
  SyncCheckView,
  TagRenameInput,
  TagRenameResult,
  TrashListResult,
} from './company';
import type {
  ActionResult,
  AppStatus,
  AudioLevel,
  AufbereitungConfig,
  DeliveryResult,
  DevDictateResult,
  DictationLanguage,
  ModelChoiceView,
  ModelProgress,
  PingResponse,
  SystemInfo,
  TranscriptPayload,
  UiLanguage,
} from './schema';
import type { VokabularGetResult, VokabularSaveInput } from './vokabular';

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
  /**
   * Fehlende Modelle der aktiven Diktatsprache laden (einmaliger Download)
   * und Engine starten. Der optionale Sprach-Parameter dient dem Wizard
   * (die Sprache steht dort fest, bevor die Firma existiert).
   */
  readonly prepareModels: (sprache?: DictationLanguage) => Promise<ActionResult>;
  /** Testaufnahme starten (oeffnet das versteckte Capture-Fenster). */
  readonly startDictation: () => Promise<ActionResult>;
  /** Testaufnahme stoppen und letztes Segment verarbeiten. */
  readonly stopDictation: () => Promise<ActionResult>;
  /** App kontrolliert neu starten (TCC-Freigaben, siehe DiktatView). */
  readonly relaunchApp: () => Promise<ActionResult>;
  /** Offiziellen macOS-Bedienungshilfen-Dialog ausloesen (aktuelle Signatur). */
  readonly requestAccessibility: () => Promise<ActionResult>;
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

  // Rechtstexte (M9).
  /** Impressums-Quelle (statische URL) im Standard-Browser oeffnen. */
  readonly openImpressumSource: () => Promise<ActionResult>;

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
    sprache?: DictationLanguage,
  ) => Promise<CreateCompanyResult>;
  /** Aktive Firma wechseln. */
  readonly setActiveCompany: (pfad: string) => Promise<ActionResult>;
  /** Diktatsprache der aktiven Firma wechseln (Paket B1). */
  readonly setCompanyLanguage: (sprache: DictationLanguage) => Promise<ActionResult>;
  /** Sync-Pruefung des Desktop-Zielordners (Risiko R8). */
  readonly checkDesktopSync: () => Promise<SyncCheckView>;
  /** Letztes Transkript als Diktat in der aktiven Firma speichern. */
  readonly saveLastDictate: () => Promise<SaveDictateResult>;
  /** Diktate der aktiven Firma auflisten/durchsuchen (Manifest-Schnellsuche). */
  readonly listDictates: (filter: DictateSearchFilter) => Promise<DictateListResult>;
  /** Diktate automatisch in der aktiven Firma speichern (an/aus). */
  readonly setDictateAutoSave: (enabled: boolean) => Promise<ActionResult>;

  // Verwaltungs-UI (M7): Detail, Bearbeiten, Notiz, Tags, Export, Papierkorb, Beleg.
  /** Vollstaendige Detailansicht eines Diktats (Metadaten plus Body). */
  readonly getDictate: (pfad: string) => Promise<DictateDetailResult>;
  /** Diktat bearbeiten (Titel/Body/Tags; version wird nachgefuehrt). */
  readonly updateDictate: (input: DictateUpdateInput) => Promise<DictateMutationResult>;
  /** Manuelle Notiz anlegen (Quelle `manuell`, ohne Diktat). */
  readonly createManualNote: (input: ManualNoteInput) => Promise<SaveDictateResult>;
  /** Diktat in den Papierkorb verschieben (Soft-Delete). */
  readonly softDeleteDictate: (pfad: string) => Promise<ActionResult>;
  /** Diktat aus dem Papierkorb wiederherstellen. */
  readonly restoreDictate: (papierkorbPfad: string) => Promise<ActionResult>;
  /** Diktat endgueltig aus dem Papierkorb loeschen (unwiderruflich). */
  readonly hardDeleteDictate: (papierkorbPfad: string) => Promise<ActionResult>;
  /** Papierkorb der aktiven Firma auflisten. */
  readonly listTrash: () => Promise<TrashListResult>;
  /** Diktat als Markdown/TXT nach `Exporte/` exportieren. */
  readonly exportDictate: (input: ExportInput) => Promise<ExportResult>;
  /** Eine Exportdatei im Datei-Manager anzeigen (Im Finder zeigen). */
  readonly revealExport: (relPfad: string) => Promise<ActionResult>;
  /** Bekannte Tags der aktiven Firma (Autocomplete/Filter). */
  readonly listTags: () => Promise<readonly string[]>;
  /** Beleg-Informationen (Modelle, Pruefsummen, Konsent, Log-Pfad). */
  readonly belegInfo: () => Promise<BelegInfoResult>;

  // Stufe 1: Fach-Woerterbuch und regelbasierte Textaufbereitung.
  /** Vokabular (Begriffe, Ersetzungen) der aktiven Firma lesen. */
  readonly getVokabular: () => Promise<VokabularGetResult>;
  /** Vokabular der aktiven Firma speichern (zod-validiert, atomar). */
  readonly saveVokabular: (input: VokabularSaveInput) => Promise<ActionResult>;
  /** Globale Aufbereitungs-Schalter setzen (Fuellwoerter, Sprachkommandos). */
  readonly setAufbereitung: (config: AufbereitungConfig) => Promise<ActionResult>;

  // Paket B2: Sprache der Oberflaeche (global, unabhaengig von der
  // Diktatsprache der Firmen; persistiert in der globalen config.json).
  readonly setUiLanguage: (sprache: UiLanguage) => Promise<ActionResult>;

  // M8 (v1.1): Stapel-Export, Tag-Batch-Rename, verschluesselter Export.
  /** Mehrere Diktate exportieren (Unterordner `Exporte/<datum>-stapel/`). */
  readonly exportDictatesBatch: (input: BatchExportInput) => Promise<BatchExportResult>;
  /** Abonniert den Fortschritt eines laufenden Stapel-Exports. */
  readonly onExportProgress: (listener: (progress: ExportProgress) => void) => Unsubscribe;
  /** Tag firmenweit umbenennen (alle Diktate inkl. Papierkorb). */
  readonly renameTag: (input: TagRenameInput) => Promise<TagRenameResult>;
  /** Diktat verschluesselt exportieren (.vwenc, AES-256-GCM). */
  readonly exportDictateEncrypted: (input: EncryptedExportInput) => Promise<ExportResult>;
  /** Eine .vwenc-Datei entschluesseln (Dateiauswahl im Main-Prozess). */
  readonly decryptVwencFile: (passwort: string) => Promise<DecryptFileResult>;
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
   * Nur Dev/Test: fuehrt die komplette Ergebnis-Zustellung (Ersetzungen,
   * Aufbereitung, Clipboard-Sequenz, Accessibility-Check, Auto-Paste) fuer
   * einen gegebenen Text aus.
   */
  readonly devRunDictationResult: (text: string) => Promise<DeliveryResult>;
  /**
   * Nur Dev/Test: kompletter Diktat-Beweis aus PCM (Engine-Injektion mit
   * Woerterbuch-Prompt, VAD-Schleuse, Ersetzungen, Aufbereitung, Zustellung).
   */
  readonly devDictatePcm: (pcm: ArrayBuffer) => Promise<DevDictateResult>;
}

/**
 * Zustaende, die das Overlay-Fenster anzeigen kann. `done` und `error` zeigen
 * den Kopieren-Knopf (Resilienz-Primaerpfad: der Text geht nie verloren).
 */
export interface OverlayStatePayload {
  readonly kind: 'recording' | 'transcribing' | 'done' | 'no-speech' | 'error';
  /** Meldung aus dem Main-Prozess (bei done/error), sonst null. */
  readonly message: string | null;
  /**
   * Sprache der Oberflaeche (Paket B2): der Main-Prozess haengt sie an jeden
   * Zustand an, damit das Overlay seine eigenen Texte ("Ich höre zu ...",
   * Kopieren-Knopf) in der richtigen Sprache zeigt. Optional, damit aeltere
   * Payloads gueltig bleiben; ohne Angabe gilt Deutsch.
   */
  readonly uiSprache?: UiLanguage;
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
