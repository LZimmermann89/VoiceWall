/**
 * E2E-Smoke-Test gegen die gebaute App (vorher `npm run build` ausführen):
 * 1. Die App startet, das Fenster zeigt genau eine H1 mit "VoiceWall" und
 *    die IPC-Brücke meldet sich über den Ping-Kanal.
 * 2. Single-Instance-Lock: Eine zweite Instanz beendet sich sofort von
 *    selbst, während die erste weiterläuft.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, _electron as electron } from '@playwright/test';
import electronPath from 'electron';

const projectRoot = join(import.meta.dirname, '../..');
const builtMainEntry = join(projectRoot, 'out/main/index.js');

test.beforeAll(() => {
  if (!existsSync(builtMainEntry)) {
    throw new Error(
      'Gebaute App fehlt (out/main/index.js). Bitte zuerst `npm run build` ausführen.',
    );
  }
});

test('App startet mit genau einer sichtbaren H1 und verbundener IPC-Brücke', async () => {
  const app = await electron.launch({ args: [builtMainEntry], cwd: projectRoot });
  try {
    const window = await app.firstWindow();

    const headings = window.locator('h1');
    await expect(headings).toHaveCount(1);
    await expect(headings.first()).toBeVisible();
    await expect(headings.first()).toHaveText('VoiceWall');

    await expect(window.getByTestId('bridge-status')).toHaveText('IPC-Brücke verbunden.');
  } finally {
    await app.close();
  }
});

test('Single-Instance-Lock: zweite Instanz beendet sich sofort', async () => {
  const app = await electron.launch({ args: [builtMainEntry], cwd: projectRoot });
  try {
    await app.firstWindow();

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

    // Die erste Instanz läuft weiter und hat unverändert genau ein Fenster.
    expect(app.windows()).toHaveLength(1);
  } finally {
    await app.close();
  }
});
