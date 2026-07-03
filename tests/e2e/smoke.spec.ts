/**
 * E2E-Smoke-Tests gegen die gebaute App (vorher `npm run build` ausführen):
 * 1. Die App startet (mit Testfirma), zeigt genau eine H1 mit "VoiceWall"
 *    und die Status-UI der Hauptansicht (belegt zugleich, dass die
 *    IPC-Brücke über getStatus funktioniert).
 * 2. Single-Instance-Lock: Eine zweite Instanz (dasselbe Test-userData)
 *    beendet sich sofort von selbst, während die erste weiterläuft.
 * 3. (Nur lokal, Modelle vorhanden) Dev-PCM-Injektion: ein injiziertes
 *    Test-WAV erscheint als korrekter deutscher Text in der UI. Echtes
 *    Mikrofon wird NICHT verwendet.
 *
 * Seit M6 laufen alle Läufe vollständig isoliert in Testverzeichnissen
 * (launch.ts); die echte Konfiguration des Rechners wird nie berührt.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import electronPath from 'electron';
import { modelsAvailable } from '../integration/model-fixtures';
import { builtMainEntry, launchApp } from './launch';

const projectRoot = join(import.meta.dirname, '../..');
const fixtureWav = join(projectRoot, 'tests/fixtures/testdiktat-de.wav');

test.beforeAll(() => {
  if (!existsSync(builtMainEntry)) {
    throw new Error(
      'Gebaute App fehlt (out/main/index.js). Bitte zuerst `npm run build` ausführen.',
    );
  }
});

test('App startet mit genau einer sichtbaren H1 und sichtbarer Status-UI', async () => {
  const { app, window } = await launchApp({ withCompany: true });
  try {
    const headings = window.locator('h1');
    await expect(headings).toHaveCount(1);
    await expect(headings.first()).toBeVisible();
    await expect(headings.first()).toContainText('VoiceWall');

    // Status-UI sichtbar (Ansicht "Diktat" ist die Startansicht der
    // Verwaltung): das Rendern der Statusliste belegt zugleich, dass
    // getStatus ueber die IPC-Bruecke aufgeloest wurde. Die Ansichts-
    // Ueberschrift ist eine H2, die Abschnitts-Ueberschriften sind H3 (M7).
    await expect(window.getByRole('heading', { name: 'Diktat', level: 2 })).toBeVisible();
    await expect(window.getByRole('heading', { name: 'Status', level: 3 })).toBeVisible();
    await expect(window.getByText('Einwilligung:')).toBeVisible();
    await expect(window.getByRole('button', { name: 'Testaufnahme starten' })).toBeVisible();
  } finally {
    await app.close();
  }
});

test('Single-Instance-Lock: zweite Instanz beendet sich sofort', async () => {
  const { app, window, userDataDir, baseDir } = await launchApp({ withCompany: true });
  try {
    await expect(window.locator('h1')).toContainText('VoiceWall');

    // Zweite Instanz mit demselben Test-userData starten (der Lock gilt pro
    // userData-Pfad). Sie muss sich wegen requestSingleInstanceLock() ohne
    // Fenster selbst beenden.
    const secondInstanceExitCode = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(electronPath as unknown as string, [builtMainEntry], {
        cwd: projectRoot,
        stdio: 'ignore',
        env: {
          ...process.env,
          VOICEWALL_TEST_USER_DATA: userDataDir,
          VOICEWALL_TEST_BASE_DIR: baseDir,
        },
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
  const { app, window } = await launchApp({ withCompany: true, linkModels: true });
  try {
    await expect(window.locator('h1')).toContainText('VoiceWall');

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
