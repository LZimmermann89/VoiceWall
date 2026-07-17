/**
 * Zeit-Helfer fuer das Datei-Datenmodell: ISO 8601 MIT Zeitzonen-Offset.
 *
 * `Date.toISOString()` liefert immer UTC (`Z`). Fuer Diktat-Metadaten ist die
 * LOKALE Zeit mit explizitem Offset gefordert, damit
 * "erstellt: 2026-07-02T14:32:10+02:00" fuer den Kunden lesbar bleibt und
 * Sortierung/Vergleich trotzdem eindeutig sind. Dieses Modul ist reine
 * TypeScript-Logik ohne Node- und ohne DOM-Abhaengigkeit.
 */

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Formatiert einen Zeitpunkt als ISO 8601 mit lokalem Zeitzonen-Offset. */
export function formatIsoWithOffset(date: Date): string {
  const offsetMinutesTotal = -date.getTimezoneOffset();
  const sign = offsetMinutesTotal >= 0 ? '+' : '-';
  const offsetAbs = Math.abs(offsetMinutesTotal);
  const offsetHours = pad2(Math.floor(offsetAbs / 60));
  const offsetMinutes = pad2(offsetAbs % 60);
  return (
    `${String(date.getFullYear())}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}` +
    `${sign}${offsetHours}:${offsetMinutes}`
  );
}

/** Datums-Stempel fuer Dateinamen: `YYYY-MM-DD` (lokale Zeit). */
export function formatDateStamp(date: Date): string {
  return `${String(date.getFullYear())}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Uhrzeit-Stempel fuer Dateinamen: `HHMMSS` (lokale Zeit). */
export function formatTimeStamp(date: Date): string {
  return `${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
}

/** Jahr-/Monats-Segmente fuer die `Diktate/YYYY/MM/`-Ablage (lokale Zeit). */
export function formatYearMonthSegments(date: Date): { year: string; month: string } {
  return { year: String(date.getFullYear()), month: pad2(date.getMonth() + 1) };
}
