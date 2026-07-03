/**
 * Unit-Tests des Manifests (M5, ABARBEITUNG 4.4.4/4.4.5):
 * - Selbstheilung: Manifest loeschen -> rebuildManifest stellt einen
 *   identischen Stand her (DoD-Pflichtnachweis).
 * - Inkrementelles Upsert/Remove, atomares Schreiben.
 * - CONTAINMENT-BEWEIS: manipuliertes Manifest mit `../`-Pfad wird beim
 *   Lesen abgewiesen (Schema-Ablehnung) und per Rebuild geheilt.
 * - Schnellsuche: Titel/Tags/Vorschau/Zeitraum/Quelle.
 * - tags.json-Pflege.
 */
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCompanyFolder } from '../../src/main/storage/company-folder';
import {
  addKnownTags,
  buildManifestEntry,
  manifestFilePath,
  readKnownTags,
  readManifest,
  readManifestWithHealing,
  rebuildManifest,
  removeManifestEntry,
  searchManifest,
  upsertManifestEntry,
} from '../../src/main/storage/manifest';
import { createTranscript } from '../../src/main/storage/transcripts';
import type { ManifestEntry } from '../../src/shared/company';

let base: string;
let companyDir: string;

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'voicewall-manifest-'));
  const created = await createCompanyFolder(base, 'Manifestfirma', {
    erstelltMit: 'VoiceWall 0.1.0-test',
  });
  if (!created.ok) {
    throw new Error('Firmenordner-Anlage im Test fehlgeschlagen.');
  }
  companyDir = created.value.dirPath;
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

/** Legt ein Diktat an und traegt es (wie companies.ts) ins Manifest ein. */
async function createIndexed(
  titel: string,
  body: string,
  tags: readonly string[],
  quelle: 'diktat' | 'import' | 'manuell',
  minute: number,
): Promise<ManifestEntry> {
  const created = await createTranscript(
    companyDir,
    {
      titel,
      body,
      sprache: 'de',
      modell: 'whisper-large-v3-turbo-german-q5_0',
      dauerSekunden: 10,
      tags,
      quelle,
    },
    {
      now: () => new Date(2026, 6, 2, 14, minute, 0),
      randomSuffix: () => minute.toString(16).padStart(6, '0'),
    },
  );
  if (!created.ok) {
    throw new Error(created.error);
  }
  const entry = buildManifestEntry(created.value.meta, created.value.relPfad, body);
  await upsertManifestEntry(companyDir, entry);
  await addKnownTags(companyDir, created.value.meta.tags);
  return entry;
}

describe('Manifest: inkrementell und selbstheilend', () => {
  it('DoD: Manifest loeschen -> rebuildManifest stellt identischen Stand her', async () => {
    await createIndexed(
      'Angebot Müller',
      'Sehr geehrter Herr Müller ...',
      ['angebot'],
      'diktat',
      1,
    );
    await createIndexed(
      'Protokoll Audit',
      'Das Audit ergab keine Maengel.',
      ['audit'],
      'manuell',
      2,
    );
    await createIndexed('Import Altbestand', 'Alte Notiz.', [], 'import', 3);

    const before = await readManifest(companyDir);
    expect(before.ok).toBe(true);
    if (!before.ok) {
      return;
    }

    // Manifest zerstoeren und neu aufbauen.
    await rm(manifestFilePath(companyDir));
    expect((await readManifest(companyDir)).ok).toBe(false);

    const rebuilt = await rebuildManifest(companyDir);
    expect(rebuilt.ok).toBe(true);
    if (!rebuilt.ok) {
      return;
    }
    // Identischer Stand (bis auf den Generierungs-Zeitstempel).
    expect(rebuilt.value.eintraege).toEqual(before.value.eintraege);
    expect(rebuilt.value.schemaVersion).toBe(before.value.schemaVersion);
  });

  it('upsert aktualisiert bestehende Eintraege, remove entfernt sie', async () => {
    const entry = await createIndexed('Original', 'Text eins.', [], 'diktat', 1);
    await upsertManifestEntry(companyDir, { ...entry, titel: 'Geaendert' });
    const afterUpdate = await readManifest(companyDir);
    expect(afterUpdate.ok && afterUpdate.value.eintraege.length).toBe(1);
    if (afterUpdate.ok) {
      expect(afterUpdate.value.eintraege[0]?.titel).toBe('Geaendert');
    }
    await removeManifestEntry(companyDir, entry.id);
    const afterRemove = await readManifest(companyDir);
    expect(afterRemove.ok && afterRemove.value.eintraege).toEqual([]);
  });

  it('CONTAINMENT-BEWEIS: ../-Pfad im Manifest wird abgewiesen und geheilt', async () => {
    const entry = await createIndexed('Echt', 'Echter Inhalt.', [], 'diktat', 1);
    // Manipuliertes Manifest: Traversal-Pfad und absoluter Pfad.
    const manipulated = {
      schemaVersion: 1,
      generiert: '2026-07-02T15:00:00+02:00',
      eintraege: [
        { ...entry, pfad: '../../ausserhalb/geheim.md' },
        { ...entry, id: 'zweiter', pfad: '/etc/passwd' },
      ],
    };
    await writeFile(manifestFilePath(companyDir), JSON.stringify(manipulated));

    // Lesen weist das manipulierte Manifest ab (Schema-Gate) ...
    const direct = await readManifest(companyDir);
    expect(direct.ok).toBe(false);

    // ... und die Selbstheilung liefert nur echte, contained Eintraege.
    const healed = await readManifestWithHealing(companyDir);
    expect(healed.ok).toBe(true);
    if (healed.ok) {
      expect(healed.value.eintraege.map((candidate) => candidate.pfad)).toEqual([entry.pfad]);
    }
  });

  it('Rebuild ueberspringt kaputte .md-Dateien statt zu scheitern', async () => {
    await createIndexed('Gueltig', 'Inhalt.', [], 'diktat', 1);
    await writeFile(join(companyDir, 'Diktate', '2026', '07', 'kaputt.md'), 'kein front-matter');
    const rebuilt = await rebuildManifest(companyDir);
    expect(rebuilt.ok).toBe(true);
    if (rebuilt.ok) {
      expect(rebuilt.value.eintraege.length).toBe(1);
    }
    // Die kaputte Datei wurde NICHT geloescht.
    const files = await readdir(join(companyDir, 'Diktate', '2026', '07'));
    expect(files).toContain('kaputt.md');
  });

  it('schreibt atomar (keine Temp-Reste im .voicewall-Ordner)', async () => {
    await createIndexed('A', 'Text.', [], 'diktat', 1);
    const entries = await readdir(join(companyDir, '.voicewall'));
    expect(entries.filter((entry) => entry.startsWith('.voicewall-tmp-'))).toEqual([]);
  });
});

describe('Schnellsuche (Manifest, in-memory)', () => {
  it('filtert nach Text, Tags, Zeitraum und Quelle (UND-verknuepft)', async () => {
    const erste = await createIndexed(
      'Angebot Müller',
      'Angebotstext fuer Müller.',
      ['angebot', 'müller'],
      'diktat',
      1,
    );
    const mittlere = await createIndexed(
      'Protokoll Audit',
      'Auditprotokoll ohne Maengel.',
      ['audit'],
      'manuell',
      20,
    );
    const letzte = await createIndexed(
      'Notiz Import',
      'Importierter Altbestand.',
      ['audit', 'alt'],
      'import',
      40,
    );

    const manifest = await readManifest(companyDir);
    expect(manifest.ok).toBe(true);
    if (!manifest.ok) {
      return;
    }
    const eintraege = manifest.value.eintraege;

    // Text (case-insensitiv, auch Umlaute) ueber Titel/Vorschau/Tags.
    expect(searchManifest(eintraege, { text: 'MÜLLER' }).length).toBe(1);
    expect(searchManifest(eintraege, { text: 'protokoll' }).length).toBe(1);
    // Tags: Eintrag muss ALLE Tags tragen.
    expect(searchManifest(eintraege, { tags: ['audit'] }).length).toBe(2);
    expect(searchManifest(eintraege, { tags: ['audit', 'alt'] }).length).toBe(1);
    // Quelle.
    expect(searchManifest(eintraege, { quelle: 'manuell' }).length).toBe(1);
    // Zeitraum: von/bis aus den echten Zeitstempeln (zeitzonenneutral).
    expect(searchManifest(eintraege, { von: mittlere.erstellt }).length).toBe(2);
    expect(
      searchManifest(eintraege, { von: mittlere.erstellt, bis: mittlere.erstellt }).length,
    ).toBe(1);
    expect(searchManifest(eintraege, { von: erste.erstellt, bis: letzte.erstellt }).length).toBe(3);
    // Kombination ohne Treffer.
    expect(searchManifest(eintraege, { text: 'Müller', quelle: 'import' }).length).toBe(0);
    // Leerer Filter: alles.
    expect(searchManifest(eintraege, {}).length).toBe(3);
  });

  it('bleibt bei tausenden Eintraegen schnell (in-memory)', () => {
    const eintraege: ManifestEntry[] = [];
    for (let index = 0; index < 5000; index += 1) {
      eintraege.push({
        id: `id-${String(index)}`,
        pfad: `Diktate/2026/07/eintrag-${String(index)}.md`,
        titel: `Eintrag ${String(index)}`,
        erstellt: '2026-07-02T14:00:00+02:00',
        geaendert: '2026-07-02T14:00:00+02:00',
        tags: index % 2 === 0 ? ['gerade'] : ['ungerade'],
        wortzahl: 10,
        vorschau: `Inhalt Nummer ${String(index)}`,
        quelle: 'diktat',
      });
    }
    const started = performance.now();
    const treffer = searchManifest(eintraege, { text: 'nummer 4999', tags: ['ungerade'] });
    const elapsed = performance.now() - started;
    expect(treffer.length).toBe(1);
    expect(elapsed).toBeLessThan(500);
  });
});

describe('tags.json', () => {
  it('ergaenzt bekannte Tags dedupliziert und sortiert', async () => {
    await addKnownTags(companyDir, ['vertrieb', 'Angebot']);
    await addKnownTags(companyDir, ['angebot', 'audit']);
    const tags = await readKnownTags(companyDir);
    expect(tags).toContain('Angebot');
    expect(tags).toContain('audit');
    expect(tags).toContain('vertrieb');
    // 'angebot' ist ein Case-Duplikat von 'Angebot' und wird nicht doppelt gefuehrt.
    expect(tags.filter((tag) => tag.toLowerCase() === 'angebot').length).toBe(1);
  });

  it('liefert eine leere Liste bei kaputter tags.json', async () => {
    await writeFile(join(companyDir, '.voicewall', 'tags.json'), '{kaputt');
    expect(await readKnownTags(companyDir)).toEqual([]);
  });
});
