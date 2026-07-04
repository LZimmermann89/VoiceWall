/**
 * Kleine, reine Anzeige-Helfer des Renderers (keine Node-/Electron-APIs).
 * Seit Paket B2 lokalisiert: Datum, Zahlen und Modifier-Namen folgen der
 * UI-Sprache (Intl.DateTimeFormat mit de-DE bzw. en-GB); die Quelle- und
 * Flow-Zustands-Beschriftungen liegen in den Katalogen (shared/i18n).
 */
import type { UiLanguage } from '../../shared/schema';

/** Formatiert Bytes als MB-/GB-Angabe (Dezimaltrennzeichen je Sprache). */
export function formatBytes(bytes: number, sprache: UiLanguage = 'de'): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    const gb = (mb / 1024).toFixed(2);
    return `${sprache === 'de' ? gb.replace('.', ',') : gb} GB`;
  }
  return `${mb.toFixed(0)} MB`;
}

/**
 * Zeigt einen Electron-Accelerator menschenlesbar an (plattformgerecht):
 * CommandOrControl wird auf macOS zu Cmd, sonst zu Strg (DE) bzw. Ctrl (EN).
 */
export function formatAccelerator(
  accelerator: string,
  platform: string,
  sprache: UiLanguage = 'de',
): string {
  const isMac = platform === 'darwin';
  const controlName = sprache === 'de' ? 'Strg' : 'Ctrl';
  return accelerator
    .split('+')
    .map((part) => {
      if (part === 'CommandOrControl' || part === 'CmdOrCtrl') {
        return isMac ? 'Cmd' : controlName;
      }
      if (part === 'Command' || part === 'Cmd') {
        return 'Cmd';
      }
      if (part === 'Control' || part === 'Ctrl') {
        return isMac ? 'Ctrl' : controlName;
      }
      if (part === 'Option') {
        return 'Alt';
      }
      return part;
    })
    .join('+');
}

/** Intl-Locale je UI-Sprache (en-GB: 24-Stunden-Uhr, "2 July 2026"). */
function localeFor(sprache: UiLanguage): string {
  return sprache === 'de' ? 'de-DE' : 'en-GB';
}

/**
 * Formatiert einen ISO-Zeitstempel lokalisiert, z. B. "2. Juli 2026, 14:32"
 * (de-DE) bzw. "2 July 2026, 14:32" (en-GB). Datum und Uhrzeit werden
 * getrennt formatiert und mit ", " verbunden, damit die deutsche Anzeige
 * exakt dem bisherigen Format entspricht. Bei ungueltigem Wert wird der
 * Rohwert gezeigt.
 */
export function formatDateTime(iso: string, sprache: UiLanguage = 'de'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const zeit = new Intl.DateTimeFormat(localeFor(sprache), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${formatDate(iso, sprache)}, ${zeit}`;
}

/** Nur das Datum (ohne Uhrzeit), z. B. "2. Juli 2026" bzw. "2 July 2026". */
export function formatDate(iso: string, sprache: UiLanguage = 'de'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(localeFor(sprache), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}
