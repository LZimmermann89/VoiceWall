/**
 * Firmenname-Sanitisierung und Pfad-Containment (ABARBEITUNG 3.4).
 *
 * Der Firmenname aus dem Wizard fliesst in einen Verzeichnispfad und ist damit
 * die gefaehrlichste Datenbewegung der App (Nutzereingabe -> Dateisystem).
 * Die Abwehr ist mehrstufig; die Verarbeitungsreihenfolge ist verbindlich:
 *
 *   1. Unicode-NFC-Normalisierung, Entfernen aller Steuerzeichen
 *      (U+0000-U+001F, U+007F), Zero-Width- (U+200B-U+200F) und
 *      BiDi-Override-Zeichen (U+202A-U+202E).
 *   2. Reduktion auf EIN Pfadsegment: `/`, `\`, `:` und `..`-Sequenzen werden
 *      entfernt (nicht ersetzt). Traversal ist damit strukturell unmoeglich.
 *   3. sanitize-filename-Aequivalent: reservierte Zeichen `<>:"/\|?*`,
 *      trailing Dots und Spaces entfernen. Bewusst selbst implementiert statt
 *      npm-Paket `sanitize-filename`: das Paket ist funktional identisch zu
 *      diesen wenigen Regex-Schritten, bringt aber eine transitive Dependency
 *      (truncate-utf8-bytes -> utf8-byte-length) ohne eigene Typen mit und
 *      wird kaum noch gepflegt (letztes Release 2020). Eine eigene, hier
 *      vollstaendig unit-getestete Funktion ist der kleinere Angriffs- und
 *      Wartungsvektor.
 *   4. Windows-reservierte Geraetenamen (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
 *      case-insensitiv abfangen, auch vor dem ersten Punkt (`NUL.txt` == `NUL`).
 *   5. Laengenbegrenzung: Segment auf 96 Zeichen (Codepoint-genau, keine
 *      zerrissenen Surrogatpaare); der Gesamtpfad wird in
 *      `buildCompanyDirPath` gegen das Windows-MAX_PATH-Limit (260) geprueft.
 *   6. Leerergebnis ist ein Fehler-Result (der Wizard fragt erneut, nie ein
 *      stilles Default).
 *   7. Containment NACH `path.resolve` (die entscheidende Schicht): der final
 *      aufgeloeste Pfad MUSS ein echtes Kind des Basisordners sein
 *      (path.relative-Muster, ABARBEITUNG Zeile 596-610).
 *
 * Zusaetzlich (Kritik B4): macOS-Dateisysteme (HFS+/APFS) liefern Namen teils
 * NFD-dekomponiert zurueck; Pfad-Vergleiche laufen deshalb NFC-normalisiert.
 * Case-insensitive Dateisysteme (macOS-Default, Windows) machen "Müller" und
 * "MÜLLER" zum selben Ordner; `findEquivalentDirEntry` erkennt solche
 * Kollisionen, damit der Aufrufer den bestehenden Ordner weiterverwendet
 * (idempotent, nie ueberschreiben, nie loeschen).
 *
 * Dieses Modul ist reine Logik ohne Dateisystemzugriff und wird von M5/M6
 * (Ordner-Anlage, Wizard) verwendet.
 */
import path from 'node:path';
import { err, ok, type Result } from '../../shared/result';

/** Maximale Laenge eines Ordnernamens-Segments (in Unicode-Codepoints). */
export const MAX_SEGMENT_LENGTH = 96;
/** Windows-MAX_PATH-Grenze fuer den Gesamtpfad. */
export const MAX_TOTAL_PATH_LENGTH = 260;

export type SanitizeErrorKind = 'leer' | 'reserviert' | 'containment' | 'pfad-zu-lang';

export interface SanitizeError {
  readonly kind: SanitizeErrorKind;
  /** Deutsche, wizard-taugliche Meldung mit naechstem Schritt. */
  readonly message: string;
}

/** Steuerzeichen, Zero-Width- und BiDi-Override-Zeichen (Schritt 1). */
// eslint-disable-next-line no-control-regex
const CONTROL_AND_INVISIBLE = /[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E]/g;
/** Verzeichnistrenner und Laufwerks-Doppelpunkt (Schritt 2). */
const PATH_SEPARATOR_CHARS = /[/\\:]/g;
/** Unter Windows in Dateinamen reservierte Zeichen (Schritt 3). */
const RESERVED_FILENAME_CHARS = /[<>:"/\\|?*]/g;
/** Trailing Dots und Spaces (Windows entfernt sie stillschweigend, wir explizit). */
const TRAILING_DOTS_AND_SPACES = /[. ]+$/;
/** Windows-reservierte Geraetenamen, case-insensitiv (Schritt 4). */
const WINDOWS_RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

const EMPTY_MESSAGE =
  'Der Firmenname enthaelt keine fuer einen Ordnernamen verwendbaren Zeichen. Bitte einen Namen mit Buchstaben oder Ziffern eingeben.';
const RESERVED_MESSAGE =
  'Dieser Name ist unter Windows ein reservierter Geraetename und kann nicht als Ordnername verwendet werden. Bitte einen anderen Namen waehlen.';

/**
 * Sanitisiert einen rohen Firmennamen zu genau einem sicheren Pfadsegment
 * (Schritte 1 bis 6). Liefert nie ein stilles Default: ein leeres oder
 * reserviertes Ergebnis ist ein Fehler-Result, damit der Wizard nachfragt.
 */
export function sanitizeCompanyName(raw: string): Result<string, SanitizeError> {
  // Schritt 1: NFC-Normalisierung, Steuer-/Zero-Width-/BiDi-Zeichen entfernen.
  let name = raw.normalize('NFC').replace(CONTROL_AND_INVISIBLE, '');

  // Schritt 2: Reduktion auf ein Pfadsegment. Trenner werden ENTFERNT, nicht
  // ersetzt; `..`-Sequenzen werden iterativ getilgt, damit auch verschachtelte
  // Formen wie `....//` restlos verschwinden (`....` -> `..` -> ``).
  name = name.replace(PATH_SEPARATOR_CHARS, '');
  while (name.includes('..')) {
    name = name.replaceAll('..', '');
  }

  // Schritt 3: sanitize-filename-Aequivalent (siehe Modulkommentar).
  name = name.replace(RESERVED_FILENAME_CHARS, '');
  name = name.replace(TRAILING_DOTS_AND_SPACES, '').trim();

  // Schritt 5: Laengenbegrenzung, Codepoint-genau (kein zerrissenes
  // Surrogatpaar). Nach dem Kuerzen erneut trailing Dots/Spaces entfernen.
  const codePoints = Array.from(name);
  if (codePoints.length > MAX_SEGMENT_LENGTH) {
    name = codePoints.slice(0, MAX_SEGMENT_LENGTH).join('').replace(TRAILING_DOTS_AND_SPACES, '');
  }

  // Schritt 6: Leerergebnis ist ein Fehler, keine stille Ersetzung.
  if (name.length === 0) {
    return err({ kind: 'leer', message: EMPTY_MESSAGE });
  }

  // Schritt 4: Windows-reservierte Namen, auch mit Endung (`NUL.txt` == `NUL`).
  // Bewusst NACH der Kuerzung geprueft, damit auch ein durch Kuerzung
  // entstandener Treffer nie durchrutscht.
  const beforeFirstDot = name.split('.', 1)[0] ?? '';
  if (WINDOWS_RESERVED_NAMES.test(beforeFirstDot.trim())) {
    return err({ kind: 'reserviert', message: RESERVED_MESSAGE });
  }

  return ok(name);
}

/**
 * Schritt 7, die entscheidende Schicht: Containment-Pruefung NACH
 * `path.resolve`. Der aufgeloeste Zielpfad MUSS ein direktes, echtes Kind des
 * Basisordners sein. Erst aufloesen, dann pruefen, nie umgekehrt.
 */
export function resolveContainedChildPath(
  baseDir: string,
  segment: string,
): Result<string, SanitizeError> {
  const basis = path.resolve(baseDir);
  const ziel = path.resolve(basis, segment);
  const rel = path.relative(basis, ziel);
  if (
    rel === '' ||
    rel.startsWith('..') ||
    path.isAbsolute(rel) ||
    rel.includes(path.sep) ||
    rel.includes('/')
  ) {
    return err({
      kind: 'containment',
      message:
        'Ungueltiger Ordnername: der Pfad liegt ausserhalb des Zielordners. Bitte einen anderen Namen waehlen.',
    });
  }
  return ok(ziel);
}

export interface CompanyDirPath {
  /** Sanitisiertes Segment (Ordnername). */
  readonly segment: string;
  /** Absoluter, containment-geprüfter Zielpfad. */
  readonly dirPath: string;
}

/**
 * Gesamtpipeline: Firmenname sanitisieren (1-6), gegen den Basisordner
 * aufloesen und Containment pruefen (7), Gesamtpfadlaenge gegen MAX_PATH.
 */
export function buildCompanyDirPath(
  baseDir: string,
  rawName: string,
): Result<CompanyDirPath, SanitizeError> {
  const segment = sanitizeCompanyName(rawName);
  if (!segment.ok) {
    return segment;
  }
  const contained = resolveContainedChildPath(baseDir, segment.value);
  if (!contained.ok) {
    return contained;
  }
  if (contained.value.length > MAX_TOTAL_PATH_LENGTH) {
    return err({
      kind: 'pfad-zu-lang',
      message: `Der vollstaendige Ordnerpfad wuerde ${String(contained.value.length)} Zeichen lang (Windows-Grenze: ${String(MAX_TOTAL_PATH_LENGTH)}). Bitte einen kuerzeren Firmennamen waehlen.`,
    });
  }
  return ok({ segment: segment.value, dirPath: contained.value });
}

/**
 * Vergleichsschluessel fuer Pfadsegmente: NFC-normalisiert und case-gefaltet.
 * Noetig, weil macOS-Dateisysteme Namen teils NFD zurueckliefern (Kritik B4)
 * und macOS/Windows case-insensitiv sind.
 */
export function comparableSegmentKey(name: string): string {
  return name.normalize('NFC').toLocaleLowerCase('de-DE');
}

/**
 * Findet in einer Verzeichnisliste einen Eintrag, der demselben Ordner wie
 * `segment` entspricht (NFD/NFC-Varianten, Gross-/Kleinschreibung). Liefert
 * den EXISTIERENDEN Namen zurueck, damit der Aufrufer den bestehenden Ordner
 * weiterverwendet (idempotente Kollision: nie ueberschreiben, nie loeschen).
 */
export function findEquivalentDirEntry(
  existingEntries: readonly string[],
  segment: string,
): string | null {
  const key = comparableSegmentKey(segment);
  for (const entry of existingEntries) {
    if (comparableSegmentKey(entry) === key) {
      return entry;
    }
  }
  return null;
}
