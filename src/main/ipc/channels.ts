/**
 * Zentrale IPC-Kanal-Namen. Reine Konstanten ohne Electron-Import, damit
 * Main und Preload dieselbe Quelle nutzen und kein Kanalname doppelt
 * gepflegt wird.
 */
export const IpcChannel = {
  Ping: 'app:ping',
} as const;

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];
