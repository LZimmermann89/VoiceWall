/**
 * E2E-Smoke-Tests gegen die gebaute App (vorher `npm run build` ausführen):
 * 1. Die App startet, zeigt genau eine H1 mit "VoiceWall" und die Status-UI
 *    (belegt zugleich, dass die IPC-Brücke ueber getStatus funktioniert).
 * 2. Single-Instance-Lock: Eine zweite Instanz beendet sich sofort von
 *    selbst, während die erste weiterläuft.
 * 3. (Nur lokal, Modelle vorhanden) Dev-PCM-Injektion: ein injiziertes
 *    Test-WAV erscheint als korrekter deutscher Text in der UI. Echtes
 *    Mikrofon wird NICHT verwendet.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, _electron as electron } from '@playwright/test';
import electronPath from 'electron';
import { modelsAvailable } from '../integration/model-fixtures';
import { getMainUiWindow } from './main-window';

const projectRoot = join(import.meta.dirname, '../..');
const builtMainEntry = join(projectRoot, 'out/main/index.js');
const fixtureWav = join(projectRoot, 'tests/fixtures/testdiktat-de.wav');

test.beforeAll(() => {
  if (!existsSync(builtMainEntry)) {
    throw new Error(
      'Gebaute App fehlt (out/main/index.js). Bitte zuerst `npm run build` ausführen.',
    );
  }
});

test('App startet mit genau einer sichtbaren H1 und sichtbarer Status-UI', async () => {
  const app = await electron.launch({ args: [builtMainEntry], cwd: projectRoot });
  try {
    const window = await getMainUiWindow(app);

    const headings = window.locator('h1');
    await expect(headings).toHaveCount(1);
    await expect(headings.first()).toBeVisible();
    await expect(headings.first()).toHaveText('VoiceWall');

    // Status-UI sichtbar: das Rendern der Statusliste belegt zugleich, dass
    // getStatus ueber die IPC-Bruecke aufgeloest wurde.
    await expect(window.getByRole('heading', { name: 'Status', level: 2 })).toBeVisible();
    await expect(window.getByText('Einwilligung:')).toBeVisible();
    await expect(window.getByRole('button', { name: 'Testaufnahme starten' })).toBeVisible();
  } finally {
    await app.close();
  }
});

test('Single-Instance-Lock: zweite Instanz beendet sich sofort', async () => {
  const app = await electron.launch({ args: [builtMainEntry], cwd: projectRoot });
  try {
    await getMainUiWindow(app);

    // Zweite Instanz direkt über das Electron-Binary starten. Sie muss sich
    // wegen requestSingleInstanceLock() ohne Fenster selbst beenden.
    const secondInstanceExitCode = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(electronPath as unknown as string, [builtMainEntry], {
        cwd: projectRoot,
        stdio: 'ignore',
      });
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Zweite Instanz hat sich nicht innerhalb von 15 s beendet.'));
      }, 15_000);
      child.once('exit', (code) => {
        clearTimeout(timeout);
        resolve(code);
      });
      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    expect(secondInstanceExitCode).toBe(0);

    // Die erste Instanz läuft weiter und hat ihr Hauptfenster unverändert
    // (seit M3 existiert zusätzlich das Diktat-Overlay als zweites Fenster).
    expect(app.windows().filter((page) => page.url().includes('index.html'))).toHaveLength(1);
  } finally {
    await app.close();
  }
});

/**
 * Extrahiert die 16-bit-PCM-Bytes eines 16 kHz mono WAV als base64 (für die
 * Übergabe an page.evaluate; ArrayBuffer selbst ist nicht serialisierbar).
 */
function wavPcmBase64(wavPath: string): string {
  const buffer = readFileSync(wavPath);
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === 'data') {
      return buffer.subarray(offset + 8, offset + 8 + chunkSize).toString('base64');
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  throw new Error('Kein data-Chunk im Test-WAV.');
}

test('Dev-PCM-Injektion liefert korrekten deutschen Text in der UI (kein echtes Mikrofon)', async () => {
  // Nur lokal mit vorhandenen Modellen; CI hat kein 574-MB-Modell.
  test.skip(!modelsAvailable, 'Modelle nicht vorhanden, Injektions-Beweis uebersprungen.');
  const app = await electron.launch({
    args: [builtMainEntry],
    cwd: projectRoot,
    // Test-IPC-Kanal (PCM-Injektion) nur fuer diesen Lauf aktivieren.
    env: { ...process.env, VOICEWALL_ENABLE_TEST_IPC: '1' },
  });
  try {
    const window = await getMainUiWindow(app);
    await expect(window.locator('h1')).toHaveText('VoiceWall');

    const base64 = wavPcmBase64(fixtureWav);
    // PCM injizieren: base64 -> Uint8Array -> frischer ArrayBuffer im Renderer.
    const result = await window.evaluate(async (b64: string) => {
      const binary = atob(b64);
      const payload = new ArrayBuffer(binary.length);
      const bytes = new Uint8Array(payload);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const bridge = (
        globalThis as unknown as {
          voicewall: {
            devInjectPcm: (pcm: ArrayBuffer) => Promise<{ ok: boolean; message?: string }>;
          };
        }
      ).voicewall;
      return bridge.devInjectPcm(payload);
    }, base64);

    expect(result.ok).toBe(true);

    // Das Transkript muss in der Liste erscheinen und das Schluesselwort enthalten.
    const transcriptList = window.getByTestId('transcript-list');
    await expect(transcriptList).toBeVisible({ timeout: 60_000 });
    await expect(transcriptList).toContainText(/testdiktat/i, { timeout: 60_000 });
  } finally {
    await app.close();
  }
});
