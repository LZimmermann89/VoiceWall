/**
 * macOS-Bedienungshilfen-Recht (Accessibility/TCC) fuer das simulierte Cmd+V.
 *
 * Der Check laeuft VOR jedem Auto-Paste mit `isTrustedAccessibilityClient(false)`
 * (false = nie den System-Prompt ausloesen; die Freigabe erteilt der Nutzer
 * bewusst ueber die Systemeinstellungen). Ohne Freigabe wird gar kein
 * osascript-Versuch gestartet, stattdessen fuehrt die UI per Deep-Link in den
 * richtigen Einstellungsbereich.
 *
 * Warum VoiceWall dieses Recht braucht und was es damit NICHT tut:
 * docs/ACCESSIBILITY.md. TCC-/cdhash-Kontext (Grant bricht bei Rebuild):
 * docs/M1-SPIKE-ERGEBNIS.md, Abschnitt F4.
 */
import { shell, systemPreferences } from 'electron';
import { err, ok, type Result } from '../../shared/result';
import type { AccessibilityState } from '../../shared/schema';

/**
 * Statischer Deep-Link in Systemeinstellungen, Datenschutz und Sicherheit,
 * Bedienungshilfen. Bewusst ein Literal: hier wird nie dynamischer Input
 * eingesetzt (openExternal mit Nutzerdaten waere ein Injektionsrisiko).
 */
const ACCESSIBILITY_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility';

/** Deutsche Anleitung, wenn die Freigabe fehlt (Schritt fuer Schritt). */
export const ACCESSIBILITY_MISSING_MESSAGE =
  'Automatisches Einfuegen ist noch nicht moeglich: VoiceWall hat keine Bedienungshilfen-Freigabe. Der Text liegt in der Zwischenablage, bitte mit Cmd+V manuell einfuegen. So erteilen Sie die Freigabe: 1. Knopf "Systemeinstellungen oeffnen" druecken (oder Systemeinstellungen, Datenschutz und Sicherheit, Bedienungshilfen). 2. VoiceWall in der Liste aktivieren (ggf. ueber das Plus-Symbol hinzufuegen). 3. Diktat erneut ausfuehren.';

/** Aktueller Bedienungshilfen-Status (Windows/Linux: not-applicable). */
export function getAccessibilityState(): AccessibilityState {
  if (process.platform !== 'darwin') {
    return 'not-applicable';
  }
  // false: nur pruefen, nie den System-Prompt ausloesen.
  return systemPreferences.isTrustedAccessibilityClient(false) ? 'granted' : 'missing';
}

/** Oeffnet den Bedienungshilfen-Bereich der macOS-Systemeinstellungen. */
export async function openAccessibilitySettings(): Promise<Result<void, string>> {
  if (process.platform !== 'darwin') {
    return err('Dieser Einstellungs-Link existiert nur auf macOS.');
  }
  try {
    await shell.openExternal(ACCESSIBILITY_SETTINGS_URL);
    return ok(undefined);
  } catch (error) {
    return err(
      `Die Systemeinstellungen konnten nicht geoeffnet werden (${error instanceof Error ? error.message : String(error)}). Bitte manuell oeffnen: Systemeinstellungen, Datenschutz und Sicherheit, Bedienungshilfen.`,
    );
  }
}
