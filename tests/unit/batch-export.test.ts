/**
 * Unit-Tests des Stapel-Exports (M8, ABARBEITUNG 4.7, Entscheidung E27):
 * - mehrere Quellen landen in einem Unterordner `Exporte/<datum>-stapel/`
 *   (atomar: keine Temp-Reste),
 * - genau EINE Quelle laeuft ueber den normalen Einzel-Export,
 * - Fehlerstrategie: weiterlaufen und Fehler sammeln; nur wenn ALLE Quellen
 *   scheitern, gibt es ein Fehler-Result und keinen Stapel-Ordner,
 * - Fortschritts-Callback wird je Datei aufgerufen,
 * - Kollision des Stapel-Ordnernamens erzeugt einen Zaehler-Suffix,
 * - Containment: unsichere Quellpfade werden je Datei abgewiesen.
 *
 * PDF im Stapel testet die E2E-Suite (braucht Electron); hier wird der
 * injizierte renderPdf-Hook mit einem Fake belegt.
 */
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportTranscriptsBatch } from '../../src/main/storage/batch-export';
import { createCompanyFolder } from '../../src/main/storage/company-folder';
import { createTranscript, type TranscriptInput } from '../../src/main/storage/transcripts';
import { ok } from '../../src/shared/result';

let base: string;
let companyDir: string;
let pfade: string[];

const NOW = new Date(2026, 6, 2, 14, 32, 10);

function input(titel: string, body: string): TranscriptInput {
  return {
    titel,
    body,
    sprache: 'de',
    modell: 'test',
    dauerSekunden: 1,
    tags: [],
    quelle: 'manuell',
  };
}

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'voicewall-batch-'));
  const created = await createCompanyFolder(base, 'Testfirma GmbH', {
    erstelltMit: 'VoiceWall test',
  });
  if (!created.ok) {
    throw new Error('Firmenordner konnte nicht angelegt werden.');
  }
  companyDir = created.value.dirPath;
  pfade = [];
  const titel = ['Angebot Frühling', 'Rechnung Sommer', 'Notiz Herbst'];
  for (const [index, name] of titel.entries()) {
    const created2 = await createTranscript(companyDir, input(name, `Inhalt von ${name}.`), {
      now: () => NOW,
      randomSuffix: () => `f${String(index)}0000`,
    });
    if (!created2.ok) {
      throw new Error('Diktat konnte nicht angelegt werden.');
    }
    pfade.push(created2.value.relPfad);
  }
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe('exportTranscriptsBatch', () => {
  it('mehrere Quellen: Unterordner <datum>-stapel/ mit je einer Datei, keine Temp-Reste', async () => {
    const fortschritt: [number, number][] = [];
    const result = await exportTranscriptsBatch(companyDir, pfade.slice(0, 2), 'md', true, {
      now: () => NOW,
      onProgress: (fertig, gesamt) => fortschritt.push([fertig, gesamt]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.relPfad).toBe('Exporte/2026-07-02-stapel');
    expect(result.value.exportiert).toBe(2);
    expect(result.value.fehler).toEqual([]);
    expect(fortschritt).toEqual([
      [1, 2],
      [2, 2],
    ]);

    const exporteEntries = await readdir(join(companyDir, 'Exporte'));
    expect(exporteEntries).toEqual(['2026-07-02-stapel']);
    expect(exporteEntries.every((name) => !name.startsWith('.voicewall-tmp-'))).toBe(true);

    const stapel = await readdir(result.value.absPfad);
    expect(stapel.filter((name) => name.endsWith('.md')).length).toBe(2);
    const inhalt = await readFile(join(result.value.absPfad, stapel[0] ?? ''), 'utf8');
    expect(inhalt.startsWith('---\n')).toBe(true);
  });

  it('genau EINE Quelle: normaler Einzel-Export direkt in Exporte/', async () => {
    const result = await exportTranscriptsBatch(companyDir, [pfade[0] ?? ''], 'txt', false, {
      now: () => NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.relPfad.endsWith('.txt')).toBe(true);
    expect(result.value.exportiert).toBe(1);
    const files = await readdir(join(companyDir, 'Exporte'));
    expect(files.length).toBe(1);
    expect(files[0]?.endsWith('.txt')).toBe(true);
  });

  it('Fehlerstrategie: eine kaputte Quelle wird gesammelt, der Rest exportiert', async () => {
    const mitKaputt = [pfade[0] ?? '', 'Diktate/2026/07/existiert-nicht.md', pfade[2] ?? ''];
    const result = await exportTranscriptsBatch(companyDir, mitKaputt, 'md', false, {
      now: () => NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.exportiert).toBe(2);
    expect(result.value.fehler.length).toBe(1);
    expect(result.value.fehler[0]).toContain('existiert-nicht.md');
    const stapel = await readdir(result.value.absPfad);
    expect(stapel.length).toBe(2);
  });

  it('scheitern ALLE Quellen, gibt es ein Fehler-Result und keinen Stapel-Ordner', async () => {
    const result = await exportTranscriptsBatch(
      companyDir,
      ['Diktate/a.md', 'Diktate/b.md'],
      'md',
      true,
      { now: () => NOW },
    );
    expect(result.ok).toBe(false);
    const exporteEntries = await readdir(join(companyDir, 'Exporte'));
    expect(exporteEntries).toEqual([]);
  });

  it('Containment: ein unsicherer Quellpfad wird je Datei abgewiesen (Batch laeuft weiter)', async () => {
    const result = await exportTranscriptsBatch(
      companyDir,
      [pfade[0] ?? '', '../../etc/passwd'],
      'txt',
      false,
      { now: () => NOW },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.exportiert).toBe(1);
      expect(result.value.fehler.length).toBe(1);
    }
  });

  it('Kollision des Stapel-Ordnernamens: zweiter Export bekommt Zaehler-Suffix', async () => {
    const first = await exportTranscriptsBatch(companyDir, pfade.slice(0, 2), 'md', true, {
      now: () => NOW,
    });
    const second = await exportTranscriptsBatch(companyDir, pfade.slice(0, 2), 'md', true, {
      now: () => NOW,
    });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.relPfad).toBe('Exporte/2026-07-02-stapel');
      expect(second.value.relPfad).toBe('Exporte/2026-07-02-stapel-2');
    }
  });

  it('PDF im Stapel nutzt den injizierten Renderer (Fake liefert Bytes)', async () => {
    const result = await exportTranscriptsBatch(companyDir, pfade.slice(0, 2), 'pdf', true, {
      now: () => NOW,
      renderPdf: (meta) => Promise.resolve(ok(Buffer.from(`PDF:${meta.titel}`, 'utf8'))),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const stapel = await readdir(result.value.absPfad);
    expect(stapel.filter((name) => name.endsWith('.pdf')).length).toBe(2);
  });

  it('PDF ohne injizierten Renderer scheitert kontrolliert (deutsche Meldung)', async () => {
    const result = await exportTranscriptsBatch(companyDir, pfade.slice(0, 2), 'pdf', true, {
      now: () => NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('PDF-Export ist in dieser Umgebung nicht verfügbar');
    }
  });
});
