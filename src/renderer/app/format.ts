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

const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

/**
 * Formatiert einen ISO-Zeitstempel deutsch, z. B. "2. Juli 2026, 14:32".
 * Rein zeichenbasiert (kein Intl-Locale-Zwang), damit die Anzeige auf allen
 * Rechnern identisch bleibt. Bei ungueltigem Wert wird der Rohwert gezeigt.
 */
export function formatGermanDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const tag = date.getDate();
  const monat = MONATE[date.getMonth()] ?? '';
  const jahr = date.getFullYear();
  const stunde = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${String(tag)}. ${monat} ${String(jahr)}, ${stunde}:${minute}`;
}

/** Nur das Datum (ohne Uhrzeit), z. B. "2. Juli 2026". */
export function formatGermanDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return `${String(date.getDate())}. ${MONATE[date.getMonth()] ?? ''} ${String(date.getFullYear())}`;
}

/** Deutsche Bezeichnung der Diktat-Quelle. */
export const QUELLE_LABELS: Record<string, string> = {
  diktat: 'Diktat',
  import: 'Import',
  manuell: 'Notiz',
};

/** Deutsche Anzeige des Diktat-Flow-Zustands. */
export const FLOW_STATE_LABELS: Record<string, string> = {
  idle: 'bereit',
  recording: 'Aufnahme läuft',
  transcribing: 'transkribiert',
  delivering: 'fügt Text ein',
};
