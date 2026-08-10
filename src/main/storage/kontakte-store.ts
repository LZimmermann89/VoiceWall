/**
 * Lese-/Schreibzugriff auf das Kontaktverzeichnis eines Firmenordners
 * (`.voicewall/kontakte.json`).
 *
 * Aufgebaut wie der Fach-Woerterbuch-Speicher: zod-Validierung an der
 * Vertrauensgrenze, atomares Schreiben (Temp plus Rename, Modus 0600), eine
 * fehlende Datei ist kein Fehler, und ein mtime-basierter Cache haelt das
 * Diktieren schnell, ohne bei Aenderungen von aussen falsch zu liegen.
 *
 * BEWUSST EINE EIGENE DATEI, nicht ein weiteres Feld im Woerterbuch:
 * Kontakte sind personenbezogene Daten, Fachbegriffe sind es nicht. Getrennte
 * Dateien lassen sich getrennt loeschen, sichern und im
 * Verarbeitungsverzeichnis beschreiben. Diese Trennung kostet ein paar Zeilen
 * und ist es wert.
 */
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultKontakte, kontakteSchema, type Kontakte } from '../../shared/mailbefehl';
import { texte } from '../i18n';
import { err, ok, type Result } from '../../shared/result';
import { writeFileAtomic } from './atomic-write';
import { VOICEWALL_DIR } from './company-folder';

/** Dateiname des Kontaktverzeichnisses im .voicewall-Ordner. */
export const KONTAKTE_FILE = 'kontakte.json';

/** Absoluter Pfad der kontakte.json eines Firmenordners. */
export function kontakteFilePath(companyDir: string): string {
  return join(companyDir, VOICEWALL_DIR, KONTAKTE_FILE);
}

interface CacheEntry {
  readonly mtimeMs: number;
  readonly size: number;
  readonly value: Kontakte;
}

const cache = new Map<string, CacheEntry>();

/** Nur fuer Tests: Cache leeren. */
export function clearKontakteCache(): void {
  cache.clear();
}

/**
 * Liest das Kontaktverzeichnis. Fehlende Datei -> leeres Verzeichnis (ok).
 * Kaputte Datei -> Fehler-Result; der Diktatfluss faellt dann auf das leere
 * Verzeichnis zurueck, damit ein Tippfehler in der Datei nie ein Diktat
 * blockiert. Ohne Kontakte findet der Mail-Befehl schlicht niemanden.
 */
export async function readKontakte(companyDir: string): Promise<Result<Kontakte, string>> {
  const filePath = kontakteFilePath(companyDir);
  let mtimeMs: number;
  let size: number;
  try {
    const info = await stat(filePath);
    mtimeMs = info.mtimeMs;
    size = info.size;
  } catch {
    cache.delete(filePath);
    return ok(defaultKontakte());
  }
  const cached = cache.get(filePath);
  if (cached !== undefined && cached.mtimeMs === mtimeMs && cached.size === size) {
    return ok(cached.value);
  }
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch {
    return err(texte().kontakte.nichtLesbar);
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return err(texte().kontakte.keinJson);
  }
  const parsed = kontakteSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return err(
      texte().kontakte.schemaVerletzt(
        parsed.error.issues[0]?.message ?? texte().generisch.unbekannterFehler,
      ),
    );
  }
  cache.set(filePath, { mtimeMs, size, value: parsed.data });
  return ok(parsed.data);
}

/** Schreibt das Verzeichnis atomar (Temp plus Rename, 0600) und pflegt den Cache. */
export async function writeKontakte(
  companyDir: string,
  kontakte: Kontakte,
): Promise<Result<void, string>> {
  const filePath = kontakteFilePath(companyDir);
  try {
    await writeFileAtomic(filePath, `${JSON.stringify(kontakte, null, 2)}\n`);
    const info = await stat(filePath);
    cache.set(filePath, { mtimeMs: info.mtimeMs, size: info.size, value: kontakte });
    return ok(undefined);
  } catch (error) {
    cache.delete(filePath);
    return err(
      texte().kontakte.speichernFehler(error instanceof Error ? error.message : String(error)),
    );
  }
}
