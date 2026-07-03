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
  'Automatisches Einfügen ist noch nicht möglich: VoiceWall hat keine Bedienungshilfen-Freigabe. Der Text liegt in der Zwischenablage, bitte mit Cmd+V manuell einfügen. So erteilen Sie die Freigabe: 1. Knopf "Systemeinstellungen öffnen" drücken (oder Systemeinstellungen, Datenschutz und Sicherheit, Bedienungshilfen). 2. VoiceWall in der Liste aktivieren (ggf. über das Plus-Symbol hinzufügen). 3. Diktat erneut ausführen.';

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
      `Die Systemeinstellungen konnten nicht geöffnet werden (${error instanceof Error ? error.message : String(error)}). Bitte manuell öffnen: Systemeinstellungen, Datenschutz und Sicherheit, Bedienungshilfen.`,
    );
  }
}
