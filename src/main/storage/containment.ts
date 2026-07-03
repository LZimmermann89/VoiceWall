/**
 * Containment-Pruefung fuer MEHRSEGMENTIGE relative Pfade (M5).
 *
 * sanitize.ts (M4) prueft genau EIN Pfadsegment (Firmenordner-Name). Das
 * Manifest referenziert Diktate aber ueber relative Pfade mit mehreren
 * Segmenten (`Diktate/2026/07/....md`). Ein manipuliertes Manifest oder eine
 * manipulierte Konfig darf damit NIE ausserhalb des Firmenordners lesen oder
 * schreiben (ABARBEITUNG 4.4.4/4.5). Deshalb gilt auch hier: erst
 * `path.resolve`, DANN der Praefix-Check ueber `path.relative` (nie eine
 * String-Pruefung vor der Aufloesung).
 */
import path from 'node:path';
import { err, ok, type Result } from '../../shared/result';
import { isSafeRelativePath } from '../../shared/company';

const CONTAINMENT_MESSAGE =
  'Ungueltiger Pfad: der Eintrag zeigt ausserhalb des Firmenordners und wird abgewiesen.';

/**
 * Loest einen relativen Pfad gegen einen Basisordner auf und verifiziert,
 * dass das Ergebnis INNERHALB des Basisordners liegt. Die strukturelle
 * Vorpruefung (`isSafeRelativePath`) lehnt absolute Pfade, `..`, Backslashes
 * und Laufwerks-Doppelpunkte ab; die Aufloesung plus `path.relative` ist die
 * entscheidende zweite Schicht (Defense in Depth).
 */
export function resolveInsideDir(baseDir: string, relativePath: string): Result<string, string> {
  // NFC-normalisiert vergleichen/aufloesen (macOS liefert teils NFD, B4).
  const normalizedRel = relativePath.normalize('NFC');
  if (!isSafeRelativePath(normalizedRel)) {
    return err(CONTAINMENT_MESSAGE);
  }
  const basis = path.resolve(baseDir);
  const ziel = path.resolve(basis, normalizedRel);
  const rel = path.relative(basis, ziel);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    return err(CONTAINMENT_MESSAGE);
  }
  return ok(ziel);
}

/**
 * Prueft, ob `childDir` ein DIREKTES Kind von `parentDir` ist (fuer die
 * Validierung der Firmenpfade aus der globalen Konfig beim Laden).
 * Vergleich NFC-normalisiert.
 */
export function isDirectChildOf(parentDir: string, childDir: string): boolean {
  const basis = path.resolve(parentDir.normalize('NFC'));
  const ziel = path.resolve(childDir.normalize('NFC'));
  const rel = path.relative(basis, ziel);
  return (
    rel !== '' &&
    !rel.startsWith('..') &&
    !path.isAbsolute(rel) &&
    !rel.includes(path.sep) &&
    !rel.includes('/')
  );
}
