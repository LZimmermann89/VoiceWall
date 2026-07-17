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
 * docs/ACCESSIBILITY.md. TCC-/cdhash-Kontext: der Grant bricht bei einem
 * Rebuild, weil er an die Code-Signatur des Builds gebunden ist.
 */
import { shell, systemPreferences } from 'electron';
import { texte } from '../i18n';
import { err, ok, type Result } from '../../shared/result';
import type { AccessibilityState } from '../../shared/schema';

/**
 * Statischer Deep-Link in Systemeinstellungen, Datenschutz und Sicherheit,
 * Bedienungshilfen. Bewusst ein Literal: hier wird nie dynamischer Input
 * eingesetzt (openExternal mit Nutzerdaten waere ein Injektionsrisiko).
 */
const ACCESSIBILITY_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility';

/** Anleitung in der UI-Sprache, wenn die Freigabe fehlt (aus dem Meldungs-Katalog). */
export function accessibilityMissingMessage(): string {
  return texte().freigaben.accessibilityFehlt;
}

/** Aktueller Bedienungshilfen-Status (Windows/Linux: not-applicable). */
export function getAccessibilityState(): AccessibilityState {
  if (process.platform !== 'darwin') {
    return 'not-applicable';
  }
  // false: nur pruefen, nie den System-Prompt ausloesen.
  return systemPreferences.isTrustedAccessibilityClient(false) ? 'granted' : 'missing';
}

/**
 * Fordert die Bedienungshilfen-Freigabe ueber den OFFIZIELLEN macOS-Dialog an
 * (isTrustedAccessibilityClient(true)). Vorteil gegenueber dem manuellen Weg:
 * macOS traegt die App dabei selbst mit ihrer AKTUELLEN Code-Signatur in die
 * Liste ein. Das entschaerft die Stale-Entry-Falle nach Rebuilds: ein alter
 * Listeneintrag zeigt den Schalter "an", ist aber an den cdhash des alten
 * Builds gebunden und gilt fuer die neue App nicht (im Praxistest am
 * 03.07.2026 real aufgetreten).
 */
export function requestAccessibilityGrant(): AccessibilityState {
  if (process.platform !== 'darwin') {
    return 'not-applicable';
  }
  // true: macOS zeigt den System-Dialog und legt den Listeneintrag fuer die
  // laufende (aktuelle) App an. Rueckgabe ist der Stand JETZT; nach dem
  // Erteilen in den Systemeinstellungen ist oft ein App-Neustart noetig.
  return systemPreferences.isTrustedAccessibilityClient(true) ? 'granted' : 'missing';
}

/** Oeffnet den Bedienungshilfen-Bereich der macOS-Systemeinstellungen. */
export async function openAccessibilitySettings(): Promise<Result<void, string>> {
  if (process.platform !== 'darwin') {
    return err(texte().freigaben.nurMacos);
  }
  try {
    await shell.openExternal(ACCESSIBILITY_SETTINGS_URL);
    return ok(undefined);
  } catch (error) {
    return err(
      texte().freigaben.einstellungenFehler(error instanceof Error ? error.message : String(error)),
    );
  }
}
