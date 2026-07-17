/**
 * Unit-Tests des vokabular.json-Speichers: fehlende Datei liefert das leere
 * Vokabular, Roundtrip ueber atomares Schreiben, kaputte Dateien liefern
 * deutsche Fehler-Results, restriktive Dateirechte (POSIX), Cache-Verhalten
 * bei externer Aenderung.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultVokabular, type Vokabular } from '../../src/shared/vokabular';
import {
  clearVokabularCache,
  readVokabular,
  vokabularFilePath,
  writeVokabular,
} from '../../src/main/storage/vokabular-store';

let companyDir: string;

beforeEach(async () => {
  companyDir = mkdtempSync(join(tmpdir(), 'voicewall-vokabular-'));
  await mkdir(join(companyDir, '.voicewall'), { recursive: true });
  clearVokabularCache();
});

afterEach(() => {
  rmSync(companyDir, { recursive: true, force: true });
});

const beispiel: Vokabular = {
  schemaVersion: 1,
  begriffe: ['VoiceWall', 'Müller & Söhne GmbH'],
  ersetzungen: [{ von: 'Voice Wall', zu: 'VoiceWall' }],
};

describe('vokabular-store', () => {
  it('liefert das leere Vokabular, wenn die Datei fehlt (kein Fehler)', async () => {
    const result = await readVokabular(companyDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(defaultVokabular());
    }
  });

  it('schreibt atomar und liest identisch zurueck (Roundtrip, Umlaute)', async () => {
    const written = await writeVokabular(companyDir, beispiel);
    expect(written.ok).toBe(true);
    const result = await readVokabular(companyDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.begriffe).toEqual(['VoiceWall', 'Müller & Söhne GmbH']);
      expect(result.value.ersetzungen).toEqual([{ von: 'Voice Wall', zu: 'VoiceWall' }]);
    }
    // Kein Temp-Rest: das atomare Schreiben hinterlaesst nur die Zieldatei.
    const entries = await readdir(join(companyDir, '.voicewall'));
    expect(entries).toEqual(['vokabular.json']);
    // Datei ist menschenlesbar formatiertes JSON (auditierbar).
    const raw = await readFile(vokabularFilePath(companyDir), 'utf8');
    expect(raw).toContain('"Müller & Söhne GmbH"');
  });

  it.skipIf(process.platform === 'win32')('setzt restriktive Dateirechte (0600)', async () => {
    await writeVokabular(companyDir, beispiel);
    const info = await stat(vokabularFilePath(companyDir));
    expect(info.mode & 0o777).toBe(0o600);
  });

  it('meldet kaputtes JSON als deutschen Fehler', async () => {
    await writeFile(vokabularFilePath(companyDir), '{kein json', 'utf8');
    const result = await readVokabular(companyDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('kein gültiges JSON');
    }
  });

  it('meldet Schema-Verletzungen als deutschen Fehler', async () => {
    await writeFile(
      vokabularFilePath(companyDir),
      JSON.stringify({ schemaVersion: 1, begriffe: ['x'.repeat(81)], ersetzungen: [] }),
      'utf8',
    );
    const result = await readVokabular(companyDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('vokabular.json');
    }
  });

  it('erkennt externe Aenderungen (mtime/groessen-basierter Cache)', async () => {
    await writeVokabular(companyDir, beispiel);
    const erste = await readVokabular(companyDir);
    expect(erste.ok && erste.value.begriffe.length).toBe(2);

    // Datei von aussen ersetzen (anderer Inhalt, andere mtime).
    const extern: Vokabular = { schemaVersion: 1, begriffe: ['Extern'], ersetzungen: [] };
    await writeFile(vokabularFilePath(companyDir), JSON.stringify(extern), 'utf8');
    const zukunft = new Date(Date.now() + 5000);
    await utimes(vokabularFilePath(companyDir), zukunft, zukunft);

    const zweite = await readVokabular(companyDir);
    expect(zweite.ok).toBe(true);
    if (zweite.ok) {
      expect(zweite.value.begriffe).toEqual(['Extern']);
    }
  });
});
