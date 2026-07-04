/**
 * Zentrale IPC-Kanal-Namen. Reine Konstanten ohne Electron-Import, damit
 * Main, Preload und beide Renderer dieselbe Quelle nutzen und kein Kanalname
 * doppelt gepflegt wird.
 */
export const IpcChannel = {
  // Renderer (Hauptfenster) -> Main, per invoke.
  Ping: 'app:ping',
  GetStatus: 'app:get-status',
  GrantConsent: 'app:grant-consent',
  PrepareModels: 'model:prepare',
  StartDictation: 'dictation:start',
  StopDictation: 'dictation:stop',

  // Main -> Renderer (Hauptfenster), per send.
  StatusChanged: 'app:status-changed',
  ModelProgress: 'model:progress',
  TranscriptNew: 'dictation:transcript',
  AudioLevel: 'dictation:level',
  DictationError: 'dictation:error',

  // Systemweites Diktat (M3): Konfiguration und Resilienz.
  SetHotkey: 'config:set-hotkey',
  SetClipboardRestore: 'config:set-clipboard-restore',
  CopyLastTranscript: 'dictation:copy-last',
  OpenAccessibilitySettings: 'system:open-accessibility',
  // Loest den offiziellen macOS-Freigabe-Dialog aus (traegt die App mit
  // AKTUELLER Signatur in die Bedienungshilfen-Liste ein).
  RequestAccessibility: 'system:request-accessibility',

  // Rechtstexte (M9): Impressums-Quelle im Browser oeffnen. Der Handler
  // uebergibt AUSSCHLIESSLICH die statische URL aus shared/impressum.ts;
  // dokumentierte openExternal-Ausnahme, siehe ENTSCHEIDUNGEN E31.
  OpenImpressumSource: 'system:open-impressum-quelle',

  // First-Run-Wizard (M6): Systeminfo, Hotkey-Livetest, Modellwahl.
  SystemInfo: 'system:info',
  WizardTestHotkey: 'wizard:test-hotkey',
  SetModelChoice: 'config:set-model-choice',

  // Capture-Fenster <-> Main.
  CaptureStart: 'capture:start',
  CaptureStop: 'capture:stop',
  CapturePcm: 'capture:pcm',
  CaptureError: 'capture:error',
  CaptureStarted: 'capture:started',

  // Overlay-Fenster <-> Main. Der Overlay-Preload haelt diese Namen als
  // lokale Literale (Sandbox-Chunk-Vermeidung, siehe preload/overlay.ts);
  // tests/unit/overlay-channels.test.ts sichert die Uebereinstimmung ab.
  OverlayState: 'overlay:state',
  OverlayCopyLast: 'overlay:copy-last',

  // Firmenverwaltung und Diktat-Speicher (M5, Ordner-als-Datenbank).
  CompanyList: 'company:list',
  CompanyPreviewName: 'company:preview-name',
  CompanyCreate: 'company:create',
  CompanySetActive: 'company:set-active',
  /** Diktatsprache der aktiven Firma wechseln (Paket B1). */
  CompanySetLanguage: 'company:set-language',
  CompanyCheckSync: 'company:check-sync',
  DictateSaveLast: 'dictate:save-last',
  DictateList: 'dictate:list',
  SetDictateAutoSave: 'config:set-dictate-auto-save',

  // Verwaltungs-UI (M7, ABARBEITUNG 4.8): Detail, Bearbeiten, Tags, Notiz,
  // Export, Papierkorb, Beleg. Jeder Handler validiert per zod; Pfade werden
  // NIE roh uebergeben (nur sichere relative Pfade, Aufloesung im Main).
  DictateGet: 'dictate:get',
  DictateUpdate: 'dictate:update',
  DictateCreateManual: 'dictate:create-manual',
  DictateSoftDelete: 'dictate:soft-delete',
  DictateRestore: 'dictate:restore',
  DictateHardDelete: 'dictate:hard-delete',
  DictateExport: 'dictate:export',
  DictateRevealExport: 'dictate:reveal-export',
  DictateTrashList: 'dictate:trash-list',
  DictateTagsList: 'dictate:tags-list',
  BelegInfo: 'beleg:info',

  // M8 (v1.1): Stapel-Export (mit Fortschritts-Events), Tag-Batch-Rename,
  // verschluesselter Export (.vwenc) und Entschluesseln in der App.
  DictateExportBatch: 'dictate:export-batch',
  /** Main -> Renderer: Fortschritt eines laufenden Stapel-Exports. */
  DictateExportProgress: 'dictate:export-progress',
  DictateRenameTag: 'dictate:rename-tag',
  DictateExportEncrypted: 'dictate:export-encrypted',
  DictateDecryptVwenc: 'dictate:decrypt-vwenc',

  // Fach-Woerterbuch und Textaufbereitung (Stufe 1, ABARBEITUNG 2.7):
  // vokabular.json der aktiven Firma lesen/speichern (zod, atomar) und die
  // globalen Aufbereitungs-Schalter setzen.
  VocabGet: 'vocab:get',
  VocabSave: 'vocab:save',
  SetAufbereitung: 'config:set-aufbereitung',

  // App kontrolliert neu starten (macOS: frisch erteilte TCC-Freigaben
  // werden einem laufenden Prozess oft erst nach Neustart gemeldet).
  SystemRelaunch: 'system:relaunch',

  // Nur in Dev/Test aktiv (siehe orchestrator/flow-controller): PCM-Injektion
  // und Diktat-Flow-Steuerung ohne echtes Mikrofon/echten OS-Paste.
  DevInjectPcm: 'dev:inject-pcm',
  DevMockPaste: 'dev:mock-paste',
  DevGetPasteCalls: 'dev:get-paste-calls',
  DevSetAccessibility: 'dev:set-accessibility',
  DevRunDictationResult: 'dev:run-dictation-result',
  /**
   * Nur Dev/Test: kompletter Diktat-Beweis aus PCM: Injektion durch die
   * VAD-/Whisper-Engine (mit aktivem Woerterbuch-Prompt), dann Ersetzungen,
   * Aufbereitung und echte Zustellung (Clipboard/Paste/Auto-Speichern).
   */
  DevDictatePcm: 'dev:dictate-pcm',
} as const;

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];
