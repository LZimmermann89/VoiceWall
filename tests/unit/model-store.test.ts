/**
 * Unit-Tests der Modell-Verwaltung: Idempotenz (vorhandene, verifizierte Datei
 * wird nicht erneut geladen), Integritaets-Marker (kein Re-Hashing bei
 * unveraenderter Datei) und Neuladen bei beschaedigter Datei. Alle Downloads
 * laufen gegen einen lokalen Fixture-Server.
 */
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ModelDescriptor } from '../../src/main/model/model-catalog';
import { ensureModel, getModelsDirectory, removeModelFile } from '../../src/main/model/model-store';

const CONTENT = Buffer.from('Fixture-Modell-Inhalt-fuer-model-store-Test', 'utf8');
const SHA = createHash('sha256').update(CONTENT).digest('hex');

let server: Server;
let baseUrl: string;
let requestCount = 0;
let userDataDir: string;

function descriptor(): ModelDescriptor {
  return {
    id: 'silero-vad',
    fileName: 'fixture-model.bin',
    url: `${baseUrl}/model`,
    byteSize: CONTENT.length,
    sha256: SHA,
    label: 'Fixture-Modell',
  };
}

beforeAll(async () => {
  server = createServer((_request, response) => {
    requestCount += 1;
    response.setHeader('content-length', String(CONTENT.length));
    response.end(CONTENT);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Fixture-Server hat keine Adresse.');
  }
  baseUrl = `http://127.0.0.1:${String(address.port)}`;
  userDataDir = await mkdtemp(join(tmpdir(), 'voicewall-store-'));
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
  await rm(userDataDir, { recursive: true, force: true });
});

describe('ensureModel', () => {
  it('laedt beim ersten Mal und verifiziert die Datei', async () => {
    requestCount = 0;
    const result = await ensureModel(userDataDir, descriptor(), { allowDownload: true });
    expect(result.ok).toBe(true);
    expect(requestCount).toBe(1);
    if (result.ok) {
      expect(existsSync(result.value)).toBe(true);
    }
  });

  it('ist idempotent: vorhandene, verifizierte Datei wird nicht erneut geladen', async () => {
    requestCount = 0;
    // Zweiter Aufruf: Datei und Marker existieren bereits -> kein Netzwerk.
    const result = await ensureModel(userDataDir, descriptor(), { allowDownload: true });
    expect(result.ok).toBe(true);
    expect(requestCount).toBe(0);
  });

  it('meldet ein fehlendes Modell ohne Download klar', async () => {
    const freshUserData = await mkdtemp(join(tmpdir(), 'voicewall-store-missing-'));
    const result = await ensureModel(freshUserData, descriptor(), { allowDownload: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('missing');
      expect(result.error.message).toContain('Einrichtungs-Assistenten');
    }
    await rm(freshUserData, { recursive: true, force: true });
  });

  it('erkennt eine beschaedigte Datei und laedt sie neu', async () => {
    const filePath = join(getModelsDirectory(userDataDir), 'fixture-model.bin');
    // Datei beschaedigen (anderer Inhalt, andere Groesse/mtime).
    await writeFile(filePath, Buffer.from('kaputt'));
    requestCount = 0;
    const result = await ensureModel(userDataDir, descriptor(), { allowDownload: true });
    expect(result.ok).toBe(true);
    // Neu geladen (ein Request), Inhalt wieder korrekt.
    expect(requestCount).toBe(1);
    const restored = await readFile(filePath);
    expect(restored.equals(CONTENT)).toBe(true);
  });

  it('meldet eine beschaedigte Datei ohne Download-Erlaubnis als corrupt', async () => {
    const filePath = join(getModelsDirectory(userDataDir), 'fixture-model.bin');
    await writeFile(filePath, Buffer.from('erneut kaputt'));
    const result = await ensureModel(userDataDir, descriptor(), { allowDownload: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('corrupt');
    }
    // Fuer Folgetests wieder in Ordnung bringen.
    await ensureModel(userDataDir, descriptor(), { allowDownload: true });
  });
});

describe('removeModelFile (Modelle-Reiter, E46)', () => {
  it('loescht Datei und Marker-Eintrag; erneuter ensureModel laedt und verifiziert voll', async () => {
    const filePath = join(getModelsDirectory(userDataDir), 'fixture-model.bin');
    const markerPath = join(getModelsDirectory(userDataDir), '.model-integrity.json');
    expect(existsSync(filePath)).toBe(true);

    const removed = await removeModelFile(userDataDir, descriptor());
    expect(removed.ok).toBe(true);
    expect(existsSync(filePath)).toBe(false);
    // Der Marker traegt den Eintrag nicht mehr (spaeterer Download wird
    // wieder voll verifiziert, keine Stale-Optimierung).
    const marker = JSON.parse(await readFile(markerPath, 'utf8')) as Record<string, unknown>;
    expect(marker['fixture-model.bin']).toBeUndefined();

    // Wiederherstellen: ensureModel laedt erneut (ein Request) und legt den
    // Marker-Eintrag frisch an.
    requestCount = 0;
    const restored = await ensureModel(userDataDir, descriptor(), { allowDownload: true });
    expect(restored.ok).toBe(true);
    expect(requestCount).toBe(1);
  });

  it('ist idempotent: das Loeschen einer fehlenden Datei ist kein Fehler', async () => {
    const fresh = await mkdtemp(join(tmpdir(), 'voicewall-store-remove-'));
    const removed = await removeModelFile(fresh, descriptor());
    expect(removed.ok).toBe(true);
    await rm(fresh, { recursive: true, force: true });
  });
});
