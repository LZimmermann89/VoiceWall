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

  // Capture-Fenster <-> Main.
  CaptureStart: 'capture:start',
  CaptureStop: 'capture:stop',
  CapturePcm: 'capture:pcm',
  CaptureError: 'capture:error',
  CaptureStarted: 'capture:started',

  // Nur in Dev/Test aktiv (siehe orchestrator/test-ipc): PCM-Injektion.
  DevInjectPcm: 'dev:inject-pcm',
} as const;

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];
