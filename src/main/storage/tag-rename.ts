/**
 * Tag-Batch-Rename: ein Tag firmenweit umbenennen.
 *
 * Wirkungsbereich: ALLE Diktate unter `Diktate/` UND der Papierkorb (ein
 * wiederhergestelltes Diktat soll nicht den alten, gerade abgeschafften Tag
 * zurueckbringen). Der Vergleich ist wie ueberall im Tag-System
 * case-insensitiv (de-DE) und NFC-normalisiert.
 *
 * Fehlerstrategie (begruendet): WEITERLAUFEN UND FEHLER SAMMELN statt
 * Abbruch. Jede Datei wird fuer sich atomar geschrieben (Temp plus Rename);
 * ein Abbruch mitten im Batch hinterlaesst also exakt denselben teilweise
 * umbenannten Zustand wie das Weiterlaufen, nur mit WENIGER erledigten
 * Dateien. Ein Rollback bereits geschriebener Dateien waere ein zweiter
 * Batch mit denselben Fehlerrisiken. Konsistenz garantiert der Abschluss:
 * das Manifest wird per rebuildManifest() atomar aus dem TATSAECHLICHEN
 * Dateizustand neu geschrieben (die Dateien sind die Wahrheitsquelle)
 * und tags.json wird nachgefuehrt. Gesammelte Fehler
 * werden dem Nutzer als deutsche Meldungen gemeldet.
 */
import {
  COMPANY_SCHEMA_VERSION,
  transcriptMetaSchema,
  type TranscriptMeta,
} from '../../shared/company';
import { serializeFrontMatter } from '../../shared/front-matter';
import { texte } from '../i18n';
import { err, ok, type Result } from '../../shared/result';
import { formatIsoWithOffset } from '../../shared/time';
import { writeFileAtomic } from './atomic-write';
import { DIKTATE_DIR, PAPIERKORB_DIR } from './company-folder';
import { resolveInsideDir } from './containment';
import type { Logger } from '../log/logger';
import { readKnownTags, readManifestWithHealing, rebuildManifest, tagsFilePath } from './manifest';
import { listPapierkorb, readTranscript, transcriptMetaToFrontMatter } from './transcripts';

export interface TagRenameSummary {
  /** Anzahl aktualisierter Diktate unter Diktate/. */
  readonly geaendert: number;
  /** Anzahl aktualisierter Diktate im Papierkorb. */
  readonly papierkorbGeaendert: number;
  /** Deutsche Meldungen je nicht aktualisierbarer Datei. */
  readonly fehler: readonly string[];
}

/** Kanonischer Vergleichsschluessel eines Tags (NFC, case-insensitiv de-DE). */
function tagKey(tag: string): string {
  return tag.normalize('NFC').toLocaleLowerCase('de-DE');
}

/** True, wenn die Tag-Liste den alten Tag traegt. */
function hasTag(tags: readonly string[], altKey: string): boolean {
  return tags.some((tag) => tagKey(tag) === altKey);
}

/** Ersetzt den alten Tag durch den neuen (dedupliziert, Reihenfolge stabil). */
export function replaceTag(tags: readonly string[], alt: string, neu: string): readonly string[] {
  const altKey = tagKey(alt);
  const neuNfc = neu.normalize('NFC');
  const result: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const mapped = tagKey(tag) === altKey ? neuNfc : tag.normalize('NFC');
    const key = tagKey(mapped);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(mapped);
    }
  }
  return result;
}

/**
 * Aktualisiert die Tags EINER Datei (Diktate/ oder Papierkorb/): liest,
 * ersetzt, zaehlt `version` hoch, fuehrt `geaendert` nach und schreibt
 * atomar.
 */
async function renameTagInFile(
  companyDir: string,
  relPfad: string,
  expectedRoot: string,
  alt: string,
  neu: string,
  now: Date,
): Promise<Result<void, string>> {
  const doc = await readTranscript(companyDir, relPfad, expectedRoot);
  if (!doc.ok) {
    return doc;
  }
  const meta: TranscriptMeta = {
    ...doc.value.meta,
    tags: [...replaceTag(doc.value.meta.tags, alt, neu)],
    geaendert: formatIsoWithOffset(now),
    version: doc.value.meta.version + 1,
  };
  const checked = transcriptMetaSchema.safeParse(meta);
  if (!checked.success) {
    return err(
      texte().tagRename.metadatenUngueltig(
        checked.error.issues[0]?.message ?? texte().generisch.unbekannt,
      ),
    );
  }
  const resolved = resolveInsideDir(companyDir, relPfad);
  if (!resolved.ok) {
    return resolved;
  }
  try {
    await writeFileAtomic(
      resolved.value,
      serializeFrontMatter(transcriptMetaToFrontMatter(checked.data), doc.value.body),
    );
  } catch (error) {
    return err(
      texte().tagRename.schreibFehler(error instanceof Error ? error.message : String(error)),
    );
  }
  return ok(undefined);
}

/** Fuehrt tags.json nach: alter Tag raus, neuer Tag rein (atomar). */
async function updateKnownTags(companyDir: string, alt: string, neu: string): Promise<void> {
  const altKey = tagKey(alt);
  const neuNfc = neu.normalize('NFC');
  const existing = await readKnownTags(companyDir);
  const merged = new Map<string, string>();
  for (const tag of existing) {
    const key = tagKey(tag);
    if (key === altKey) {
      continue;
    }
    if (!merged.has(key)) {
      merged.set(key, tag.normalize('NFC'));
    }
  }
  merged.set(tagKey(neuNfc), neuNfc);
  const sorted = [...merged.values()].sort((a, b) => a.localeCompare(b, 'de-DE'));
  await writeFileAtomic(
    tagsFilePath(companyDir),
    `${JSON.stringify({ schemaVersion: COMPANY_SCHEMA_VERSION, tags: sorted }, null, 2)}\n`,
  );
}

/**
 * Benennt einen Tag ueber alle betroffenen Diktate um (inkl. Papierkorb).
 * Siehe Modulkommentar fuer die Fehlerstrategie. Abschliessend wird das
 * Manifest atomar aus dem Dateizustand neu aufgebaut und tags.json
 * nachgefuehrt.
 */
export async function renameTagEverywhere(
  companyDir: string,
  alt: string,
  neu: string,
  logger?: Logger,
  now: Date = new Date(),
): Promise<Result<TagRenameSummary, string>> {
  const altNfc = alt.normalize('NFC');
  const neuNfc = neu.normalize('NFC');
  if (altNfc === neuNfc) {
    return err(texte().tagRename.identisch);
  }
  const altKey = tagKey(altNfc);

  // Betroffene Diktate im Register (Manifest als Index; die Dateien selbst
  // werden vor dem Schreiben erneut gelesen und validiert).
  const manifest = await readManifestWithHealing(companyDir, logger);
  if (!manifest.ok) {
    return err(manifest.error);
  }
  const fehler: string[] = [];
  let geaendert = 0;
  for (const entry of manifest.value.eintraege) {
    if (!hasTag(entry.tags, altKey)) {
      continue;
    }
    const result = await renameTagInFile(companyDir, entry.pfad, DIKTATE_DIR, altNfc, neuNfc, now);
    if (result.ok) {
      geaendert += 1;
    } else {
      fehler.push(`${entry.titel}: ${result.error}`);
    }
  }

  // Papierkorb mit umbenennen: Wiederherstellen bringt sonst den
  // alten Tag zurueck.
  let papierkorbGeaendert = 0;
  const papierkorb = await listPapierkorb(companyDir);
  if (papierkorb.ok) {
    for (const doc of papierkorb.value) {
      if (!hasTag(doc.meta.tags, altKey)) {
        continue;
      }
      const result = await renameTagInFile(
        companyDir,
        doc.relPfad,
        PAPIERKORB_DIR,
        altNfc,
        neuNfc,
        now,
      );
      if (result.ok) {
        papierkorbGeaendert += 1;
      } else {
        fehler.push(`${doc.meta.titel} (Papierkorb): ${result.error}`);
      }
    }
  }

  // Abschluss: Manifest atomar aus dem TATSAECHLICHEN Dateizustand neu
  // schreiben (immer konsistent, auch nach Teil-Fehlern) und tags.json
  // nachfuehren. Der alte Tag verbleibt in tags.json nur, wenn kein einziger
  // Eintrag umbenannt werden konnte.
  const rebuilt = await rebuildManifest(companyDir, logger, now);
  if (!rebuilt.ok) {
    return err(rebuilt.error);
  }
  if (geaendert + papierkorbGeaendert > 0 || fehler.length === 0) {
    try {
      await updateKnownTags(companyDir, altNfc, neuNfc);
    } catch (error) {
      fehler.push(
        `tags.json konnte nicht aktualisiert werden: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  logger?.info('Tag-Batch-Rename ausgefuehrt.', {
    geaendert,
    papierkorbGeaendert,
    fehler: fehler.length,
  });
  return ok({ geaendert, papierkorbGeaendert, fehler });
}
