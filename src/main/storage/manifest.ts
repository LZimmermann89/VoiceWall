/**
 * Manifest des Firmenordners (M5, ABARBEITUNG 4.4.4/4.4.5).
 *
 * `.voicewall/manifest.json` ist der schnelle Lese-Index der Verwaltungs-UI.
 * Wahrheitsquelle bleiben IMMER die Markdown-Dateien: `rebuildManifest()`
 * stellt den Index durch einen vollstaendigen Scan der Front-Matter wieder
 * her (Selbstheilung bei kaputtem/fehlendem Manifest).
 *
 * - Schreiben ist ausnahmslos atomar (writeFileAtomic: Temp plus Rename).
 * - Create/Update/Delete aktualisieren das Manifest inkrementell
 *   (upsert/remove), nie per Komplett-Scan.
 * - Pfad-Vergleiche laufen NFC-normalisiert (Kritik B4).
 * - Beim LESEN wird das Manifest zod-validiert; Eintraege mit unsicheren
 *   Pfaden (`../`, absolute Pfade) lassen den Parse scheitern, worauf der
 *   Aufrufer den Rebuild faehrt. Zusaetzlich prueft jeder Dateizugriff das
 *   Containment nach path.resolve (transcripts.ts/containment.ts).
 * - Schnellsuche: In-Memory-Filter ueber Titel/Tags/Vorschau/Zeitraum/Quelle
 *   (fuer tausende Eintraege ausreichend; Volltextsuche ist v1.1/M8).
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  COMPANY_SCHEMA_VERSION,
  manifestSchema,
  tagsFileSchema,
  transcriptMetaSchema,
  type DictateSearchFilter,
  type Manifest,
  type ManifestEntry,
  type TranscriptMeta,
} from '../../shared/company';
import { buildPreview, parseFrontMatter } from '../../shared/front-matter';
import { texte } from '../i18n';
import { err, ok, type Result } from '../../shared/result';
import { formatIsoWithOffset } from '../../shared/time';
import type { Logger } from '../log/logger';
import { writeFileAtomic } from './atomic-write';
import { resolveInsideDir } from './containment';
import { DIKTATE_DIR, MANIFEST_FILE, TAGS_FILE, VOICEWALL_DIR } from './company-folder';

/** Absoluter Pfad der Manifest-Datei eines Firmenordners. */
export function manifestFilePath(companyDir: string): string {
  return join(companyDir, VOICEWALL_DIR, MANIFEST_FILE);
}

/** Absoluter Pfad der tags.json eines Firmenordners. */
export function tagsFilePath(companyDir: string): string {
  return join(companyDir, VOICEWALL_DIR, TAGS_FILE);
}

/**
 * Liest und validiert das Manifest. Ein Fehler-Result bedeutet: Datei fehlt,
 * ist kein JSON oder verletzt das Schema (inkl. unsicherer Pfade). Der
 * Aufrufer entscheidet ueber den Rebuild.
 */
export async function readManifest(companyDir: string): Promise<Result<Manifest, string>> {
  let raw: string;
  try {
    raw = await readFile(manifestFilePath(companyDir), 'utf8');
  } catch {
    return err(texte().manifest.fehlt);
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return err(texte().manifest.keinJson);
  }
  const parsed = manifestSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return err(
      texte().manifest.schemaVerletzt(
        parsed.error.issues[0]?.message ?? texte().generisch.unbekannt,
      ),
    );
  }
  return ok(parsed.data);
}

/** Schreibt das Manifest atomar (Temp plus Rename, 0600). */
export async function writeManifest(companyDir: string, manifest: Manifest): Promise<void> {
  await writeFileAtomic(manifestFilePath(companyDir), `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Deterministische Ordnung: neueste zuerst, bei Gleichstand nach id. */
function sortEntries(entries: readonly ManifestEntry[]): ManifestEntry[] {
  return [...entries].sort((a, b) => {
    if (a.erstellt !== b.erstellt) {
      return a.erstellt < b.erstellt ? 1 : -1;
    }
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
}

/** Baut aus Metadaten, relativem Pfad und Body einen Manifest-Eintrag. */
export function buildManifestEntry(
  meta: TranscriptMeta,
  relPfad: string,
  body: string,
): ManifestEntry {
  return {
    id: meta.id,
    pfad: relPfad.normalize('NFC'),
    titel: meta.titel,
    erstellt: meta.erstellt,
    geaendert: meta.geaendert,
    tags: [...meta.tags],
    wortzahl: meta.wortzahl,
    vorschau: buildPreview(body),
    quelle: meta.quelle,
  };
}

/**
 * Inkrementelles Upsert eines Eintrags (nach id). Existiert noch kein
 * lesbares Manifest, beginnt ein leeres (der naechste Rebuild heilt
 * Bestandsluecken; fuer den Normalbetrieb ist das korrekt inkrementell).
 */
export async function upsertManifestEntry(
  companyDir: string,
  entry: ManifestEntry,
  now: Date = new Date(),
): Promise<void> {
  const existing = await readManifest(companyDir);
  const base: Manifest = existing.ok
    ? existing.value
    : { schemaVersion: COMPANY_SCHEMA_VERSION, generiert: formatIsoWithOffset(now), eintraege: [] };
  const others = base.eintraege.filter((candidate) => candidate.id !== entry.id);
  const updated: Manifest = {
    ...base,
    generiert: formatIsoWithOffset(now),
    eintraege: sortEntries([...others, entry]),
  };
  await writeManifest(companyDir, updated);
}

/** Entfernt einen Eintrag (nach id) inkrementell. Fehlt er, ist das ok. */
export async function removeManifestEntry(
  companyDir: string,
  id: string,
  now: Date = new Date(),
): Promise<void> {
  const existing = await readManifest(companyDir);
  if (!existing.ok) {
    return;
  }
  const updated: Manifest = {
    ...existing.value,
    generiert: formatIsoWithOffset(now),
    eintraege: existing.value.eintraege.filter((candidate) => candidate.id !== id),
  };
  await writeManifest(companyDir, updated);
}

/** Rekursive Suche aller .md-Dateien unter Diktate/ (relative Pfade, NFC). */
async function collectMarkdownFiles(companyDir: string): Promise<string[]> {
  const results: string[] = [];
  const walk = async (relDir: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(join(companyDir, relDir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const relPath = `${relDir}/${entry.name}`.normalize('NFC');
      if (entry.isDirectory()) {
        await walk(relPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(relPath);
      }
    }
  };
  await walk(DIKTATE_DIR);
  return results.sort();
}

/**
 * Selbstheilung (ABARBEITUNG 4.4.4): baut das Manifest durch einen
 * vollstaendigen Scan aller `.md`-Front-Matter unter `Diktate/` neu auf und
 * schreibt es atomar. Nicht parsebare Dateien werden uebersprungen und
 * geloggt (nie geloescht), damit ein einzelnes kaputtes Diktat den Index
 * nicht verhindert.
 */
export async function rebuildManifest(
  companyDir: string,
  logger?: Logger,
  now: Date = new Date(),
): Promise<Result<Manifest, string>> {
  const entries: ManifestEntry[] = [];
  const files = await collectMarkdownFiles(companyDir);
  for (const relPath of files) {
    // Containment auch hier: der Pfad stammt aus readdir, die Pruefung ist
    // der einheitliche, billige Invarianten-Check aller Lesezugriffe.
    const resolved = resolveInsideDir(companyDir, relPath);
    if (!resolved.ok) {
      logger?.warn('Manifest-Rebuild: Datei ausserhalb des Firmenordners uebersprungen.');
      continue;
    }
    let content: string;
    try {
      content = await readFile(resolved.value, 'utf8');
    } catch {
      logger?.warn('Manifest-Rebuild: Datei nicht lesbar, uebersprungen.', {
        fileName: relPath.split('/').pop() ?? '',
      });
      continue;
    }
    const parsed = parseFrontMatter(content);
    if (!parsed.ok) {
      logger?.warn('Manifest-Rebuild: Front-Matter nicht parsebar, Datei uebersprungen.', {
        fileName: relPath.split('/').pop() ?? '',
        reason: parsed.error,
      });
      continue;
    }
    const meta = transcriptMetaSchema.safeParse(parsed.value.meta);
    if (!meta.success) {
      logger?.warn('Manifest-Rebuild: Metadaten verletzen das Schema, Datei uebersprungen.', {
        fileName: relPath.split('/').pop() ?? '',
      });
      continue;
    }
    entries.push(buildManifestEntry(meta.data, relPath, parsed.value.body));
  }
  const manifest: Manifest = {
    schemaVersion: COMPANY_SCHEMA_VERSION,
    generiert: formatIsoWithOffset(now),
    eintraege: sortEntries(entries),
  };
  try {
    await writeManifest(companyDir, manifest);
  } catch (error) {
    return err(
      texte().manifest.schreibFehler(error instanceof Error ? error.message : String(error)),
    );
  }
  return ok(manifest);
}

/**
 * Liest das Manifest; scheitert das (fehlt/kaputt/manipuliert), laeuft die
 * Selbstheilung per Rebuild. Der haeufige Pfad bleibt der schnelle Index.
 */
export async function readManifestWithHealing(
  companyDir: string,
  logger?: Logger,
): Promise<Result<Manifest, string>> {
  const direct = await readManifest(companyDir);
  if (direct.ok) {
    return direct;
  }
  logger?.warn('Manifest fehlt oder ist beschaedigt, Selbstheilung per Rebuild.', {
    reason: direct.error,
  });
  return rebuildManifest(companyDir, logger);
}

// ---------------------------------------------------------------------------
// Schnellsuche (In-Memory, ABARBEITUNG 4.4.5)
// ---------------------------------------------------------------------------

function matchesText(entry: ManifestEntry, needle: string): boolean {
  const lowered = needle.normalize('NFC').toLocaleLowerCase('de-DE');
  const haystack = [entry.titel, entry.vorschau, ...entry.tags]
    .join(' ')
    .normalize('NFC')
    .toLocaleLowerCase('de-DE');
  return haystack.includes(lowered);
}

/**
 * Filtert Manifest-Eintraege in-memory. Alle Filter sind UND-verknuepft;
 * `tags` verlangt jeden genannten Tag. Zeitraumvergleich ueber die
 * ISO-Strings (lexikografisch korrekt bei identischem Offset; fuer die
 * Robustheit wird ueber Date-Parsing verglichen).
 */
export function searchManifest(
  entries: readonly ManifestEntry[],
  filter: DictateSearchFilter,
): ManifestEntry[] {
  const von = filter.von === undefined ? null : Date.parse(filter.von);
  const bis = filter.bis === undefined ? null : Date.parse(filter.bis);
  return entries.filter((entry) => {
    if (filter.text !== undefined && filter.text.trim().length > 0) {
      if (!matchesText(entry, filter.text.trim())) {
        return false;
      }
    }
    if (filter.tags !== undefined && filter.tags.length > 0) {
      const entryTags = new Set(entry.tags.map((tag) => tag.toLocaleLowerCase('de-DE')));
      if (!filter.tags.every((tag) => entryTags.has(tag.toLocaleLowerCase('de-DE')))) {
        return false;
      }
    }
    const erstellt = Date.parse(entry.erstellt);
    if (von !== null && !Number.isNaN(von) && erstellt < von) {
      return false;
    }
    if (bis !== null && !Number.isNaN(bis) && erstellt > bis) {
      return false;
    }
    if (filter.quelle !== undefined && entry.quelle !== filter.quelle) {
      return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// tags.json (bekannte Tags fuer Autocomplete/Filter)
// ---------------------------------------------------------------------------

/** Liest die bekannten Tags (leere Liste bei fehlender/kaputter Datei). */
export async function readKnownTags(companyDir: string): Promise<readonly string[]> {
  try {
    const raw = await readFile(tagsFilePath(companyDir), 'utf8');
    const parsed = tagsFileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.tags : [];
  } catch {
    return [];
  }
}

/** Ergaenzt neue Tags (dedupliziert, sortiert), schreibt atomar. */
export async function addKnownTags(companyDir: string, tags: readonly string[]): Promise<void> {
  if (tags.length === 0) {
    return;
  }
  const existing = await readKnownTags(companyDir);
  const merged = new Map<string, string>();
  for (const tag of [...existing, ...tags]) {
    const key = tag.normalize('NFC').toLocaleLowerCase('de-DE');
    if (!merged.has(key)) {
      merged.set(key, tag.normalize('NFC'));
    }
  }
  const sorted = [...merged.values()].sort((a, b) => a.localeCompare(b, 'de-DE'));
  if (sorted.length === existing.length) {
    return; // Nichts Neues: kein Schreibvorgang.
  }
  await writeFileAtomic(
    tagsFilePath(companyDir),
    `${JSON.stringify({ schemaVersion: COMPANY_SCHEMA_VERSION, tags: sorted }, null, 2)}\n`,
  );
}
