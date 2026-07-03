/** Kleine, reine Anzeige-Helfer des Renderers (keine Node-/Electron-APIs). */

/** Formatiert Bytes als deutsche MB-/GB-Angabe. */
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2).replace('.', ',')} GB`;
  }
  return `${mb.toFixed(0)} MB`;
}

/**
 * Zeigt einen Electron-Accelerator menschenlesbar an (plattformgerecht):
 * CommandOrControl wird auf macOS zu Cmd, sonst zu Strg.
 */
export function formatAccelerator(accelerator: string, platform: string): string {
  const isMac = platform === 'darwin';
  return accelerator
    .split('+')
    .map((part) => {
      if (part === 'CommandOrControl' || part === 'CmdOrCtrl') {
        return isMac ? 'Cmd' : 'Strg';
      }
      if (part === 'Command' || part === 'Cmd') {
        return 'Cmd';
      }
      if (part === 'Control' || part === 'Ctrl') {
        return isMac ? 'Ctrl' : 'Strg';
      }
      if (part === 'Option') {
        return 'Alt';
      }
      return part;
    })
    .join('+');
}

/** Deutsche Anzeige des Diktat-Flow-Zustands. */
export const FLOW_STATE_LABELS: Record<string, string> = {
  idle: 'bereit',
  recording: 'Aufnahme läuft',
  transcribing: 'transkribiert',
  delivering: 'fügt Text ein',
};
