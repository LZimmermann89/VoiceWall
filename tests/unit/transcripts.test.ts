/**
 * Unit-Tests des Transkript-Speichers:
 * CRUD-Lebenszyklus, Dateinamens-Konvention mit Slug und Kollisions-Suffix,
 * Containment-Abwehr (auch beim LESEN), Atomaritaet (keine Temp-Reste) und
 * ISO-8601-Zeitstempel mit Zeitzone.
 */
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCompanyFolder } from '../../src/main/storage/company-folder';
import {
  createTranscript,
  hardDeleteTranscript,
  readTranscript,
  restoreTranscript,
  slugFromTitle,
  softDeleteTranscript,
  updateTranscript,
  type TranscriptInput,
} from '../../src/main/storage/transcripts';
import { parseFrontMatter } from '../../src/shared/front-matter';

let base: string;
let companyDir: string;

const FIXED_NOW = new Date(2026, 6, 2, 14, 32, 10); // 2026-07-02 14:32:10 lokal
const CLOCK = { now: () => FIXED_NOW, randomSuffix: () => 'a1b2c3' } as const;

const INPUT: TranscriptInput = {
  titel: 'Angebot Müller',
  body: 'Sehr geehrter Herr Müller, vielen Dank für Ihre Anfrage.',
  sprache: 'de',
  modell: 'whisper-large-v3-turbo-german-q5_0',
  dauerSekunden: 47,
  tags: ['angebot', 'müller'],
  quelle: 'diktat',
};

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'voicewall-transkripte-'));
  const created = await createCompanyFolder(base, 'Testfirma', {
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

describe('slugFromTitle', () => {
  it('bildet Umlaute auf Basisbuchstaben ab und begrenzt auf 40 Zeichen', () => {
    expect(slugFromTitle('Angebot Müller')).toBe('angebot-müller');
    expect(slugFromTitle('Größe & Öl für Ärzte')).toBe('größe-öl-für-ärzte');
    expect(slugFromTitle('Café à la carte')).toBe('cafe-a-la-carte');
    expect(slugFromTitle('X'.repeat(100)).length).toBeLessThanOrEqual(40);
    expect(slugFromTitle('🎙️🎙️')).toBe('diktat'); // Fallback statt leer
    expect(slugFromTitle('../../etc')).toBe('etc');
  });
});

describe('createTranscript', () => {
  it('schreibt nach Diktate/YYYY/MM mit Namenskonvention und gueltigem Front-Matter', async () => {
    const result = await createTranscript(companyDir, INPUT, CLOCK);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.relPfad).toBe('Diktate/2026/07/2026-07-02_143210_angebot-müller.md');
    expect(result.value.meta.id).toBe('2026-07-02_143210_a1b2c3');
    expect(result.value.meta.wortzahl).toBe(9);
    // ISO 8601 MIT Zeitzonen-Offset.
    expect(result.value.meta.erstellt).toMatch(/^2026-07-02T14:32:10[+-]\d{2}:\d{2}$/);

    const raw = await readFile(join(companyDir, result.value.relPfad), 'utf8');
    const parsed = parseFrontMatter(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.meta['titel']).toBe('Angebot Müller');
      expect(parsed.value.meta['version']).toBe(1);
    }
  });

  it('loest Kollisionen im selben Sekunden-Zeitstempel per id-Suffix', async () => {
    const first = await createTranscript(companyDir, INPUT, CLOCK);
    const second = await createTranscript(companyDir, INPUT, {
      now: CLOCK.now,
      randomSuffix: () => 'd4e5f6',
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }
    expect(second.value.relPfad).toBe('Diktate/2026/07/2026-07-02_143210_angebot-müller_d4e5f6.md');
  });

  it('hinterlaesst keine Tempdateien (Atomaritaet)', async () => {
    await createTranscript(companyDir, INPUT, CLOCK);
    const monthDir = join(companyDir, 'Diktate', '2026', '07');
    const entries = await readdir(monthDir);
    expect(entries.filter((entry) => entry.includes('.voicewall-tmp-'))).toEqual([]);
  });

  it('schreibt angewandte Ersetzungen in den Front-Matter-Beleg', async () => {
    const belegEintraege = ['Voice Wall -> VoiceWall (2x)', 'Meier -> Meyer (1x)'];
    const result = await createTranscript(
      companyDir,
      { ...INPUT, ersetzungen: belegEintraege },
      CLOCK,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.meta.ersetzungen).toEqual(belegEintraege);
    // Round-Trip: die Datei traegt den Beleg und liest ihn schema-validiert.
    const wieder = await readTranscript(companyDir, result.value.relPfad);
    expect(wieder.ok).toBe(true);
    if (wieder.ok) {
      expect(wieder.value.meta.ersetzungen).toEqual(belegEintraege);
    }
  });

  it('ohne angewandte Ersetzungen fehlt das Beleg-Feld (Bestandsformat)', async () => {
    const result = await createTranscript(companyDir, { ...INPUT, ersetzungen: [] }, CLOCK);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.meta.ersetzungen).toBeUndefined();
    const raw = await readFile(join(companyDir, result.value.relPfad), 'utf8');
    expect(raw).not.toContain('ersetzungen:');
  });
});

describe('read/update', () => {
  it('liest und aktualisiert (geaendert + version hochzaehlen)', async () => {
    const created = await createTranscript(companyDir, INPUT, CLOCK);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const later = new Date(2026, 6, 2, 15, 0, 0);
    const updated = await updateTranscript(
      companyDir,
      created.value.relPfad,
      { titel: 'Angebot Müller (final)', body: 'Neuer Text.', tags: ['angebot', 'final'] },
      { now: () => later },
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.value.meta.version).toBe(2);
    expect(updated.value.meta.geaendert).toMatch(/^2026-07-02T15:00:00/);
    expect(updated.value.meta.erstellt).toBe(created.value.meta.erstellt);
    expect(updated.value.meta.wortzahl).toBe(2);

    const readBack = await readTranscript(companyDir, created.value.relPfad);
    expect(readBack.ok).toBe(true);
    if (readBack.ok) {
      expect(readBack.value.meta.titel).toBe('Angebot Müller (final)');
      expect(readBack.value.body.trim()).toBe('Neuer Text.');
    }
  });

  it('updateTranscript erhaelt den Ersetzungs-Beleg', async () => {
    const belegEintraege = ['Voice Wall -> VoiceWall (1x)'];
    const created = await createTranscript(
      companyDir,
      { ...INPUT, ersetzungen: belegEintraege },
      CLOCK,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const updated = await updateTranscript(
      companyDir,
      created.value.relPfad,
      { titel: 'Neuer Titel' },
      { now: () => new Date(2026, 6, 2, 15, 0, 0) },
    );
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      // Der Beleg beschreibt die urspruengliche Aufbereitung und bleibt
      // beim Bearbeiten unveraendert erhalten.
      expect(updated.value.meta.ersetzungen).toEqual(belegEintraege);
    }
  });

  it('CONTAINMENT-BEWEIS: manipulierte Pfade werden beim Lesen abgewiesen', async () => {
    // Traversal, absolute Pfade, Backslash, falsche Wurzel: alles abgewiesen.
    for (const evil of [
      '../ausserhalb.md',
      'Diktate/../../geheim.md',
      '/etc/passwd',
      'Diktate\\2026\\07\\x.md',
      'Papierkorb/../.voicewall/config.json',
      '.voicewall/config.json',
      'Diktate/2026/07/../../../../../etc/hosts',
    ]) {
      const result = await readTranscript(companyDir, evil);
      expect(result.ok, `Pfad haette abgewiesen werden muessen: ${evil}`).toBe(false);
    }
  });
});

describe('softDelete/restore/hardDelete', () => {
  it('verschiebt in den Papierkorb, stellt wieder her und loescht endgueltig nur dort', async () => {
    const created = await createTranscript(companyDir, INPUT, CLOCK);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    // Soft-Delete: Datei liegt im Papierkorb, Original ist weg.
    const deleted = await softDeleteTranscript(companyDir, created.value.relPfad);
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) {
      return;
    }
    expect(deleted.value.papierkorbRelPfad.startsWith('Papierkorb/')).toBe(true);
    await expect(stat(join(companyDir, created.value.relPfad))).rejects.toThrow();
    expect((await stat(join(companyDir, deleted.value.papierkorbRelPfad))).isFile()).toBe(true);

    // Restore: zurueck unter Diktate/YYYY/MM (aus `erstellt` abgeleitet).
    const restored = await restoreTranscript(companyDir, deleted.value.papierkorbRelPfad);
    expect(restored.ok).toBe(true);
    if (!restored.ok) {
      return;
    }
    expect(restored.value.relPfad).toBe(created.value.relPfad);
    expect((await stat(join(companyDir, restored.value.relPfad))).isFile()).toBe(true);

    // hardDelete verweigert Pfade ausserhalb des Papierkorbs.
    const refused = await hardDeleteTranscript(companyDir, restored.value.relPfad);
    expect(refused.ok).toBe(false);

    // Endgueltig loeschen: nur aus dem Papierkorb.
    const deletedAgain = await softDeleteTranscript(companyDir, restored.value.relPfad);
    expect(deletedAgain.ok).toBe(true);
    if (!deletedAgain.ok) {
      return;
    }
    const hardDeleted = await hardDeleteTranscript(
      companyDir,
      deletedAgain.value.papierkorbRelPfad,
    );
    expect(hardDeleted.ok).toBe(true);
    await expect(stat(join(companyDir, deletedAgain.value.papierkorbRelPfad))).rejects.toThrow();
  });
});
