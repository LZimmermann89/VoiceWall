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

  // Nur in Dev/Test aktiv (siehe orchestrator/flow-controller): PCM-Injektion
  // und Diktat-Flow-Steuerung ohne echtes Mikrofon/echten OS-Paste.
  DevInjectPcm: 'dev:inject-pcm',
  DevMockPaste: 'dev:mock-paste',
  DevGetPasteCalls: 'dev:get-paste-calls',
  DevSetAccessibility: 'dev:set-accessibility',
  DevRunDictationResult: 'dev:run-dictation-result',
} as const;

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];
