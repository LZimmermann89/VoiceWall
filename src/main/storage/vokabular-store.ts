/**
 * Lese-/Schreibzugriff auf das Fach-Woerterbuch eines Firmenordners
 * (`.voicewall/vokabular.json`, Stufe 1, ABARBEITUNG 2.7).
 *
 * - Die Datei ist fremder Input (kann von Hand editiert sein) und wird an
 *   der Vertrauensgrenze zod-validiert.
 * - Geschrieben wird ausnahmslos atomar (writeFileAtomic: Temp plus Rename,
 *   Modus 0600), wie alle Dateien des Ordner-als-Datenbank-Modells.
 * - Eine fehlende Datei ist KEIN Fehler: es gilt das leere Vokabular
 *   (die Datei entsteht erst beim ersten Speichern).
 * - Ein kleiner mtime/groessen-basierter Cache vermeidet wiederholte
 *   Disk-Reads beim Diktieren und bleibt korrekt, wenn die Datei von aussen
 *   geaendert wird.
 */
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultVokabular, vokabularSchema, type Vokabular } from '../../shared/vokabular';
import { texte } from '../i18n';
import { err, ok, type Result } from '../../shared/result';
import { writeFileAtomic } from './atomic-write';
import { VOICEWALL_DIR } from './company-folder';

/** Dateiname des Fach-Woerterbuchs im .voicewall-Ordner. */
export const VOKABULAR_FILE = 'vokabular.json';

/** Absoluter Pfad der vokabular.json eines Firmenordners. */
export function vokabularFilePath(companyDir: string): string {
  return join(companyDir, VOICEWALL_DIR, VOKABULAR_FILE);
}

interface CacheEntry {
  readonly mtimeMs: number;
  readonly size: number;
  readonly value: Vokabular;
}

const cache = new Map<string, CacheEntry>();

/** Nur fuer Tests: Cache leeren. */
export function clearVokabularCache(): void {
  cache.clear();
}

/**
 * Liest das Vokabular eines Firmenordners. Fehlende Datei -> leeres
 * Vokabular (ok). Kaputte Datei (kein JSON, Schema verletzt) -> Fehler-Result
 * mit deutscher Meldung; der Aufrufer entscheidet (UI meldet, der Diktatfluss
 * faellt auf das leere Vokabular zurueck, damit das Diktat nie blockiert).
 */
export async function readVokabular(companyDir: string): Promise<Result<Vokabular, string>> {
  const filePath = vokabularFilePath(companyDir);
  let mtimeMs: number;
  let size: number;
  try {
    const info = await stat(filePath);
    mtimeMs = info.mtimeMs;
    size = info.size;
  } catch {
    // Datei existiert (noch) nicht: leeres Vokabular, kein Fehler.
    cache.delete(filePath);
    return ok(defaultVokabular());
  }
  const cached = cache.get(filePath);
  if (cached !== undefined && cached.mtimeMs === mtimeMs && cached.size === size) {
    return ok(cached.value);
  }
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch {
    return err(texte().woerterbuch.nichtLesbar);
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return err(texte().woerterbuch.keinJson);
  }
  const parsed = vokabularSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return err(
      texte().woerterbuch.schemaVerletzt(
        parsed.error.issues[0]?.message ?? texte().generisch.unbekannterFehler,
      ),
    );
  }
  cache.set(filePath, { mtimeMs, size, value: parsed.data });
  return ok(parsed.data);
}

/** Schreibt das Vokabular atomar (Temp plus Rename, 0600) und pflegt den Cache. */
export async function writeVokabular(
  companyDir: string,
  vokabular: Vokabular,
): Promise<Result<void, string>> {
  const filePath = vokabularFilePath(companyDir);
  try {
    await writeFileAtomic(filePath, `${JSON.stringify(vokabular, null, 2)}\n`);
    const info = await stat(filePath);
    cache.set(filePath, { mtimeMs: info.mtimeMs, size: info.size, value: vokabular });
    return ok(undefined);
  } catch (error) {
    cache.delete(filePath);
    return err(
      texte().woerterbuch.speichernFehler(error instanceof Error ? error.message : String(error)),
    );
  }
}
