/**
 * i18n des Main-Prozesses (Paket B3, Entscheidung E41): EIN zentraler,
 * schlanker Sprachzustand statt verstreuter Konfig-Reads pro Meldung.
 *
 * - `setUiLanguage()` wird genau zweimal aufgerufen: beim App-Start aus der
 *   globalen Konfiguration (index.ts) und beim Sprachwechsel über den
 *   IPC-Handler `config:set-ui-language` (flow-controller.ts).
 * - `texte()` liefert den `main`-Bereich des aktiven Katalogs; alle
 *   nutzersichtbaren Main-Strings (Result-Fehlermeldungen, Tray, Overlay-
 *   Zustellmeldungen, PDF-Vorlage, Modell-Anzeigenamen) kommen von hier.
 * - Fehlermeldungen entstehen weiterhin am Ort des Fehlers (Result<string>
 *   bleibt), nur der Text kommt aus dem Katalog.
 * - LOGS bleiben bewusst DEUTSCH (interne Betriebssprache, nicht
 *   nutzersichtbar; E41).
 *
 * Bewusst OHNE Electron-Import (nur shared/-Module): damit bleiben alle
 * Module, die dieses hier importieren (sanitize, downloader, transcripts,
 * pdf-template, ...), in vitest ohne Electron testbar; der Default ist 'de'.
 */
import { KATALOGE, type Uebersetzung } from '../shared/i18n';
import type { UiLanguage } from '../shared/schema';

let aktiveSprache: UiLanguage = 'de';

/** Setzt die UI-Sprache des Main-Prozesses (Start + Sprachwechsel-Handler). */
export function setUiLanguage(sprache: UiLanguage): void {
  aktiveSprache = sprache;
}

/** Aktive UI-Sprache (z. B. für PDF-Vorlage und Engine-Worker-Kontext). */
export function getUiLanguage(): UiLanguage {
  return aktiveSprache;
}

/** Aktiver Main-Text-Katalog (nutzersichtbare Main-Prozess-Texte). */
export function texte(): Uebersetzung['main'] {
  return KATALOGE[aktiveSprache].main;
}
