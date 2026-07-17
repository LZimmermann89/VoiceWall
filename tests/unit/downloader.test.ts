/**
 * Unit-Tests des Modell-Downloaders gegen einen lokalen Fixture-HTTP-Server
 * auf 127.0.0.1 (NIE gegen echtes Hugging Face). Geprueft werden: Erfolg mit
 * Checksummen-/Groessen-Verifikation, SHA-Mismatch bricht ab und loescht,
 * Groessen-Mismatch, atomares .part-Verhalten und Idempotenz-Vorbereitung.
 */
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { downloadModel, hashFileSha256 } from '../../src/main/model/downloader';

// Kleine, deterministische Fixture-Datei (keine 574 MB).
const FIXTURE_CONTENT = Buffer.from('VoiceWall-Fixture-Modelldaten-0123456789', 'utf8');
const FIXTURE_SHA = createHash('sha256').update(FIXTURE_CONTENT).digest('hex');

let server: Server;
let baseUrl: string;
let workDir: string;

beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.url === '/ok') {
      response.setHeader('content-length', String(FIXTURE_CONTENT.length));
      response.end(FIXTURE_CONTENT);
      return;
    }
    if (request.url === '/corrupt') {
      const tampered = Buffer.from(FIXTURE_CONTENT);
      tampered[0] = (tampered[0] ?? 0) ^ 0xff;
      response.setHeader('content-length', String(tampered.length));
      response.end(tampered);
      return;
    }
    response.statusCode = 404;
    response.end('not found');
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Fixture-Server hat keine Adresse.');
  }
  baseUrl = `http://127.0.0.1:${String(address.port)}`;
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
});

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'voicewall-dl-'));
});

afterEach(async () => {
  // Zieldateien zwischen den Tests aufraeumen.
  await rm(join(workDir, 'model.bin'), { force: true });
  await rm(join(workDir, 'model.bin.part'), { force: true });
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe('downloadModel', () => {
  it('laedt erfolgreich, verifiziert Checksumme und Groesse, benennt atomar um', async () => {
    const dest = join(workDir, 'model.bin');
    let lastPercent = 0;
    const result = await downloadModel({
      url: `${baseUrl}/ok`,
      destinationPath: dest,
      expectedSha256: FIXTURE_SHA,
      expectedByteSize: FIXTURE_CONTENT.length,
      onProgress: (progress) => {
        if (progress.percent !== null) {
          lastPercent = progress.percent;
        }
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sha256).toBe(FIXTURE_SHA);
      expect(result.value.byteSize).toBe(FIXTURE_CONTENT.length);
    }
    expect(lastPercent).toBe(100);
    expect(existsSync(dest)).toBe(true);
    // Keine .part-Datei bleibt zurueck.
    expect(existsSync(`${dest}.part`)).toBe(false);
    const written = await readFile(dest);
    expect(written.equals(FIXTURE_CONTENT)).toBe(true);
  });

  it('bricht bei SHA-Mismatch ab und loescht die .part-Datei', async () => {
    const dest = join(workDir, 'model.bin');
    const result = await downloadModel({
      url: `${baseUrl}/corrupt`,
      destinationPath: dest,
      expectedSha256: FIXTURE_SHA,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('checksum-mismatch');
      expect(result.error.message).toContain('Prüfsumme');
    }
    // Weder Zieldatei noch .part duerfen existieren.
    expect(existsSync(dest)).toBe(false);
    expect(existsSync(`${dest}.part`)).toBe(false);
  });

  it('bricht bei Groessen-Mismatch ab', async () => {
    const dest = join(workDir, 'model.bin');
    const result = await downloadModel({
      url: `${baseUrl}/ok`,
      destinationPath: dest,
      expectedSha256: FIXTURE_SHA,
      expectedByteSize: FIXTURE_CONTENT.length + 10,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('size-mismatch');
    }
    expect(existsSync(dest)).toBe(false);
  });

  it('meldet einen HTTP-Fehlerstatus als Fehler', async () => {
    const dest = join(workDir, 'model.bin');
    const result = await downloadModel({
      url: `${baseUrl}/missing`,
      destinationPath: dest,
      expectedSha256: FIXTURE_SHA,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('http-status');
    }
  });

  it('entfernt eine vorhandene .part-Datei vor dem Neustart des Downloads', async () => {
    const dest = join(workDir, 'model.bin');
    await writeFile(`${dest}.part`, Buffer.from('alter, unvollstaendiger Rest'));
    const result = await downloadModel({
      url: `${baseUrl}/ok`,
      destinationPath: dest,
      expectedSha256: FIXTURE_SHA,
    });
    expect(result.ok).toBe(true);
    expect(existsSync(`${dest}.part`)).toBe(false);
  });
});

describe('hashFileSha256', () => {
  it('berechnet denselben Hash wie createHash ueber den Inhalt', async () => {
    const dest = join(workDir, 'model.bin');
    await writeFile(dest, FIXTURE_CONTENT);
    expect(await hashFileSha256(dest)).toBe(FIXTURE_SHA);
  });
});
