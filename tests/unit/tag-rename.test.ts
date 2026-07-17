/**
 * Unit-Tests des Tag-Batch-Renames:
 * - Rename ueber 3 Diktate, davon EINES im Papierkorb (Papierkorb ist
 *   bewusst mitbetroffen),
 * - `version`/`geaendert` werden je Datei nachgefuehrt, Schreiben atomar,
 * - Manifest wird abschliessend atomar aus dem Dateizustand neu gebaut,
 * - tags.json: alter Tag raus, neuer Tag rein,
 * - Fehlerfall-Strategie: eine beschaedigte Datei wird gesammelt gemeldet,
 *   der Rest wird umbenannt, der Endzustand ist konsistent,
 * - identischer neuer Name wird abgewiesen; Case-Rename ist erlaubt.
 */
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCompanyFolder } from '../../src/main/storage/company-folder';
import {
  buildManifestEntry,
  readKnownTags,
  readManifest,
  removeManifestEntry,
  upsertManifestEntry,
  addKnownTags,
} from '../../src/main/storage/manifest';
import { renameTagEverywhere, replaceTag } from '../../src/main/storage/tag-rename';
import {
  createTranscript,
  listPapierkorb,
  readTranscript,
  softDeleteTranscript,
  type TranscriptInput,
} from '../../src/main/storage/transcripts';

let base: string;
let companyDir: string;
/** Relative Pfade der drei Diktate (das dritte wandert in den Papierkorb). */
let pfade: string[];

const NOW = new Date(2026, 6, 2, 14, 32, 10);

function input(titel: string, tags: readonly string[]): TranscriptInput {
  return {
    titel,
    body: `Inhalt von ${titel}.`,
    sprache: 'de',
    modell: 'test',
    dauerSekunden: 1,
    tags,
    quelle: 'manuell',
  };
}

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'voicewall-tagrename-'));
  const created = await createCompanyFolder(base, 'Testfirma GmbH', {
    erstelltMit: 'VoiceWall test',
  });
  if (!created.ok) {
    throw new Error('Firmenordner konnte nicht angelegt werden.');
  }
  companyDir = created.value.dirPath;
  pfade = [];
  const eintraege: [string, readonly string[]][] = [
    ['Angebot Frühling', ['kunde-müller', 'angebot']],
    ['Rechnung Sommer', ['Kunde-Müller']], // andere Schreibweise, gleicher Tag
    ['Notiz Herbst', ['kunde-müller', 'intern']],
  ];
  const ids: string[] = [];
  for (const [index, [titel, tags]] of eintraege.entries()) {
    const doc = await createTranscript(companyDir, input(titel, tags), {
      now: () => NOW,
      randomSuffix: () => `a${String(index)}0000`,
    });
    if (!doc.ok) {
      throw new Error('Diktat konnte nicht angelegt werden.');
    }
    pfade.push(doc.value.relPfad);
    ids.push(doc.value.meta.id);
    await upsertManifestEntry(
      companyDir,
      buildManifestEntry(doc.value.meta, doc.value.relPfad, `Inhalt von ${titel}.`),
    );
    await addKnownTags(companyDir, doc.value.meta.tags);
  }
  // Das dritte Diktat wandert in den Papierkorb (der Rename wirkt auch
  // dort). Wie in der Produktion (companies.softDeleteDictate) wird der
  // Manifest-Eintrag dabei entfernt.
  const moved = await softDeleteTranscript(companyDir, pfade[2] ?? '');
  if (!moved.ok) {
    throw new Error('Soft-Delete fehlgeschlagen.');
  }
  await removeManifestEntry(companyDir, ids[2] ?? '');
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe('replaceTag', () => {
  it('ersetzt case-insensitiv und dedupliziert', () => {
    expect(replaceTag(['Kunde-Müller', 'angebot'], 'kunde-müller', 'mandant-müller')).toEqual([
      'mandant-müller',
      'angebot',
    ]);
    // Neuer Name existiert schon: kein Duplikat.
    expect(replaceTag(['alt', 'neu'], 'alt', 'neu')).toEqual(['neu']);
  });
});

describe('renameTagEverywhere', () => {
  it('Rename ueber 3 Diktate, eines im Papierkorb: alle Dateien, Manifest und tags.json', async () => {
    const result = await renameTagEverywhere(
      companyDir,
      'kunde-müller',
      'mandant-müller',
      undefined,
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.geaendert).toBe(2);
    expect(result.value.papierkorbGeaendert).toBe(1);
    expect(result.value.fehler).toEqual([]);

    // Beide Register-Dateien tragen den neuen Tag, version wurde hochgezaehlt.
    for (const pfad of pfade.slice(0, 2)) {
      const doc = await readTranscript(companyDir, pfad);
      expect(doc.ok).toBe(true);
      if (doc.ok) {
        expect(doc.value.meta.tags).toContain('mandant-müller');
        expect(
          doc.value.meta.tags.some((tag) => tag.toLocaleLowerCase('de-DE') === 'kunde-müller'),
        ).toBe(false);
        expect(doc.value.meta.version).toBe(2);
      }
    }

    // Auch die Papierkorb-Datei traegt den neuen Tag.
    const papierkorb = await listPapierkorb(companyDir);
    expect(papierkorb.ok).toBe(true);
    if (papierkorb.ok) {
      expect(papierkorb.value.length).toBe(1);
      expect(papierkorb.value[0]?.meta.tags).toContain('mandant-müller');
    }

    // Manifest wurde atomar neu geschrieben und ist konsistent.
    const manifest = await readManifest(companyDir);
    expect(manifest.ok).toBe(true);
    if (manifest.ok) {
      expect(manifest.value.eintraege.length).toBe(2);
      expect(manifest.value.eintraege.every((entry) => entry.tags.includes('mandant-müller'))).toBe(
        true,
      );
    }

    // tags.json: alter Tag raus, neuer rein, unbeteiligte Tags bleiben.
    const known = await readKnownTags(companyDir);
    expect(known).toContain('mandant-müller');
    expect(known).toContain('angebot');
    expect(known).toContain('intern');
    expect(known.some((tag) => tag.toLocaleLowerCase('de-DE') === 'kunde-müller')).toBe(false);
  });

  it('Fehlerfall: beschaedigte Datei wird gesammelt, der Rest umbenannt, Zustand konsistent', async () => {
    // Datei 2 auf der Platte beschaedigen (kein Front-Matter mehr).
    await writeFile(join(companyDir, pfade[1] ?? ''), 'beschädigt, kein front matter');

    const result = await renameTagEverywhere(
      companyDir,
      'kunde-müller',
      'mandant-müller',
      undefined,
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // Eine Datei umbenannt, eine im Papierkorb, ein gesammelter Fehler.
    expect(result.value.geaendert).toBe(1);
    expect(result.value.papierkorbGeaendert).toBe(1);
    expect(result.value.fehler.length).toBe(1);
    expect(result.value.fehler[0]).toContain('Rechnung Sommer');

    // Die intakte Datei ist umbenannt.
    const doc = await readTranscript(companyDir, pfade[0] ?? '');
    expect(doc.ok && doc.value.meta.tags.includes('mandant-müller')).toBe(true);

    // Manifest ist konsistent: die beschaedigte Datei faellt beim Rebuild
    // heraus (Dateien sind die Wahrheitsquelle), nichts ist halb geschrieben.
    const manifest = await readManifest(companyDir);
    expect(manifest.ok).toBe(true);
    if (manifest.ok) {
      expect(manifest.value.eintraege.length).toBe(1);
      expect(manifest.value.eintraege[0]?.tags).toContain('mandant-müller');
    }

    // Keine Temp-Reste im Diktate-Baum (atomares Schreiben).
    const monthDir = join(companyDir, 'Diktate', '2026', '07');
    const files = await readdir(monthDir);
    expect(files.every((name) => !name.startsWith('.voicewall-tmp-'))).toBe(true);
  });

  it('identischer neuer Name wird abgewiesen; reine Case-Aenderung ist erlaubt', async () => {
    const gleich = await renameTagEverywhere(companyDir, 'intern', 'intern', undefined, NOW);
    expect(gleich.ok).toBe(false);

    const caseOnly = await renameTagEverywhere(companyDir, 'angebot', 'Angebot', undefined, NOW);
    expect(caseOnly.ok).toBe(true);
    if (caseOnly.ok) {
      expect(caseOnly.value.geaendert).toBe(1);
    }
    const doc = await readTranscript(companyDir, pfade[0] ?? '');
    expect(doc.ok && doc.value.meta.tags.includes('Angebot')).toBe(true);
  });

  it('unbekannter Tag: 0 Aenderungen, tags.json wird trotzdem nachgefuehrt', async () => {
    const result = await renameTagEverywhere(
      companyDir,
      'gibt-es-nicht',
      'auch-egal',
      undefined,
      NOW,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.geaendert + result.value.papierkorbGeaendert).toBe(0);
      expect(result.value.fehler).toEqual([]);
    }
  });

  it('verifiziert byte-genau: Datei enthaelt den neuen Tag im Front-Matter', async () => {
    await renameTagEverywhere(companyDir, 'kunde-müller', 'mandant-müller', undefined, NOW);
    const raw = await readFile(join(companyDir, pfade[0] ?? ''), 'utf8');
    expect(raw).toContain('mandant-müller');
    expect(raw).not.toContain('kunde-müller');
  });
});
