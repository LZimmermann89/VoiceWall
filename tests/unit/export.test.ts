/**
 * Unit-Tests des Diktat-Exports (M7, ABARBEITUNG 4.7/4.8):
 * - buildExportContent: Markdown mit/ohne Front-Matter, TXT (nur Body).
 * - exportTranscript: schreibt nach Exporte/, atomar (keine Temp-Reste),
 *   Containment (Quelle ausserhalb Diktate/ wird abgewiesen), Kollision
 *   erzeugt eine zweite, suffixierte Datei statt zu ueberschreiben.
 */
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCompanyFolder } from '../../src/main/storage/company-folder';
import { buildExportContent, exportTranscript } from '../../src/main/storage/export';
import { createTranscript, type TranscriptInput } from '../../src/main/storage/transcripts';
import { transcriptMetaSchema, type TranscriptMeta } from '../../src/shared/company';
import { parseFrontMatter } from '../../src/shared/front-matter';

let base: string;
let companyDir: string;

const CLOCK = {
  now: () => new Date(2026, 6, 2, 14, 32, 10),
  randomSuffix: () => 'a1b2c3',
} as const;

const INPUT: TranscriptInput = {
  titel: 'Angebot Müller',
  body: 'Sehr geehrter Herr Müller,\nvielen Dank für Ihre Anfrage.',
  sprache: 'de',
  modell: 'whisper-large-v3-turbo-german-q5_0',
  dauerSekunden: 47,
  tags: ['angebot', 'müller'],
  quelle: 'diktat',
};

const META: TranscriptMeta = transcriptMetaSchema.parse({
  id: '2026-07-02_143210_a1b2c3',
  titel: 'Angebot Müller',
  erstellt: '2026-07-02T14:32:10+02:00',
  geaendert: '2026-07-02T14:32:10+02:00',
  sprache: 'de',
  modell: 'whisper-large-v3-turbo-german-q5_0',
  dauer_sekunden: 47,
  wortzahl: 8,
  tags: ['angebot', 'müller'],
  quelle: 'diktat',
  version: 1,
});

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'voicewall-export-'));
  const created = await createCompanyFolder(base, 'Testfirma GmbH', {
    erstelltMit: 'VoiceWall test',
  });
  if (!created.ok) {
    throw new Error('Firmenordner konnte nicht angelegt werden.');
  }
  companyDir = created.value.dirPath;
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe('buildExportContent', () => {
  it('Markdown mit Front-Matter: vollstaendige Datei (parsebar, echte Umlaute im Body)', () => {
    const content = buildExportContent(META, INPUT.body, 'md', true);
    expect(content.startsWith('---\n')).toBe(true);
    const parsed = parseFrontMatter(content);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.meta['titel']).toBe('Angebot Müller');
      expect(parsed.value.body).toContain('Müller');
    }
  });

  it('Markdown ohne Front-Matter: Titel-Ueberschrift plus Body, kein Front-Matter', () => {
    const content = buildExportContent(META, INPUT.body, 'md', false);
    expect(content.startsWith('# Angebot Müller')).toBe(true);
    expect(content).not.toContain('---');
    expect(content).toContain('vielen Dank für Ihre Anfrage.');
  });

  it('TXT: nur der Body (kein Front-Matter, keine Ueberschrift)', () => {
    const content = buildExportContent(META, INPUT.body, 'txt', true);
    expect(content).not.toContain('---');
    expect(content).not.toContain('# Angebot');
    expect(content).toContain('Sehr geehrter Herr Müller,');
    expect(content.endsWith('\n')).toBe(true);
  });
});

describe('exportTranscript', () => {
  it('schreibt Markdown nach Exporte/ und laesst keine Temp-Reste zurueck', async () => {
    const created = await createTranscript(companyDir, INPUT, CLOCK);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const result = await exportTranscript(companyDir, created.value.relPfad, 'md', true);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.relPfad.startsWith('Exporte/')).toBe(true);
    expect(result.value.relPfad.endsWith('.md')).toBe(true);

    const files = await readdir(join(companyDir, 'Exporte'));
    expect(files.length).toBe(1);
    // Keine Temp-Reste (atomar).
    expect(files.every((name) => !name.startsWith('.voicewall-tmp-'))).toBe(true);

    const content = await readFile(join(companyDir, 'Exporte', files[0] ?? ''), 'utf8');
    const parsed = parseFrontMatter(content);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.body).toContain('vielen Dank für Ihre Anfrage.');
    }
  });

  it('TXT-Export schreibt nur den Body als .txt', async () => {
    const created = await createTranscript(companyDir, INPUT, CLOCK);
    if (!created.ok) {
      throw new Error('Setup fehlgeschlagen.');
    }
    const result = await exportTranscript(companyDir, created.value.relPfad, 'txt', false);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.relPfad.endsWith('.txt')).toBe(true);
    const content = await readFile(result.value.absPfad, 'utf8');
    expect(content).not.toContain('---');
    expect(content).toContain('Sehr geehrter Herr Müller,');
  });

  it('Kollision: ein zweiter Export erzeugt eine zweite, suffixierte Datei (nie ueberschreiben)', async () => {
    const created = await createTranscript(companyDir, INPUT, CLOCK);
    if (!created.ok) {
      throw new Error('Setup fehlgeschlagen.');
    }
    const first = await exportTranscript(companyDir, created.value.relPfad, 'md', true);
    const second = await exportTranscript(companyDir, created.value.relPfad, 'md', true);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.relPfad).not.toBe(second.value.relPfad);
    }
    const files = await readdir(join(companyDir, 'Exporte'));
    expect(files.length).toBe(2);
  });

  it('Containment: eine Quelle ausserhalb von Diktate/ wird abgewiesen', async () => {
    const result = await exportTranscript(companyDir, '../../etc/passwd', 'txt', false);
    expect(result.ok).toBe(false);
  });

  it('Containment: ein Quellpfad ausserhalb von Diktate/ (Papierkorb) wird abgewiesen', async () => {
    // readTranscript erzwingt den erwarteten Wurzelordner Diktate/.
    const result = await exportTranscript(companyDir, 'Papierkorb/x.md', 'txt', false);
    expect(result.ok).toBe(false);
  });
});
