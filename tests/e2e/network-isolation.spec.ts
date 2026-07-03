/**
 * Netzwerk-Isolations-Beweis (ABARBEITUNG 3.3, M4-DoD Punkt 5):
 *
 * Waehrend eines KOMPLETTEN Diktat-Flows (PCM-Injektion -> VAD -> Whisper ->
 * Transkript -> Clipboard-Zustellung mit gemocktem Paste) werden ALLE
 * webRequest-Ereignisse der Electron-Session aufgezeichnet. Behauptung und
 * Beweis: null Requests auf nicht-lokale Origins. Erlaubt sind ausschliesslich
 * lokale Schemata (file:, blob:, data:, devtools:, chrome:) und im Dev-Modus
 * die lokale Vite-URL.
 *
 * Zusaetzlich belegt dieser Test die Berechtigungs-Haertung (M4): jede
 * Nicht-media-Berechtigung (Notifications als Stellvertreter) wird vom
 * zentralen setPermissionRequestHandler abgelehnt.
 *
 * Der Transkriptions-Teil laeuft nur lokal (574-MB-Modell noetig); die
 * Zustellungs- und Permission-Teile laufen ueberall.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, _electron as electron, type ElectronApplication } from '@playwright/test';
import { modelsAvailable } from '../integration/model-fixtures';
import { getMainUiWindow } from './main-window';

const projectRoot = join(import.meta.dirname, '../..');
const builtMainEntry = join(projectRoot, 'out/main/index.js');
const fixtureWav = join(projectRoot, 'tests/fixtures/testdiktat-de.wav');

/** Nur diese Schemata/Praefixe gelten als lokal. */
const LOCAL_URL_PATTERN = /^(file:|blob:|data:|devtools:|chrome:|chrome-extension:|about:)/;

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

/** Startet die Ueberwachung ALLER webRequest-Ereignisse der defaultSession. */
async function startNetworkRecorder(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ session }) => {
    const urls: string[] = [];
    (globalThis as unknown as { __vwRequestUrls: string[] }).__vwRequestUrls = urls;
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      urls.push(details.url);
      callback({});
    });
  });
}

async function recordedUrls(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(
    () => (globalThis as unknown as { __vwRequestUrls?: string[] }).__vwRequestUrls ?? [],
  );
}

test.beforeAll(() => {
  if (!existsSync(builtMainEntry)) {
    throw new Error(
      'Gebaute App fehlt (out/main/index.js). Bitte zuerst `npm run build` ausführen.',
    );
  }
});

test('Null nicht-lokale Requests waehrend eines kompletten Diktat-Flows; Nicht-media-Berechtigungen werden abgelehnt', async () => {
  const app = await electron.launch({
    args: [builtMainEntry],
    cwd: projectRoot,
    env: { ...process.env, VOICEWALL_ENABLE_TEST_IPC: '1' },
  });
  try {
    await startNetworkRecorder(app);
    const window = await getMainUiWindow(app);
    await expect(window.locator('h1')).toHaveText('VoiceWall');

    // --- Berechtigungs-Haertung: Nicht-media wird zentral abgelehnt. -------
    const notificationPermission = await window.evaluate(async () => {
      const notification = (
        globalThis as unknown as {
          Notification: { requestPermission: () => Promise<string> };
        }
      ).Notification;
      try {
        return await notification.requestPermission();
      } catch {
        return 'exception';
      }
    });
    expect(notificationPermission).toBe('denied');

    // --- Kompletter Diktat-Flow -------------------------------------------
    if (modelsAvailable) {
      // Echte Transkription: PCM-Injektion durch VAD und Whisper.
      const base64 = wavPcmBase64(fixtureWav);
      const injection = await window.evaluate(async (b64: string) => {
        const binary = atob(b64);
        const payload = new ArrayBuffer(binary.length);
        const bytes = new Uint8Array(payload);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
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
      expect(injection.ok).toBe(true);
      await expect(window.getByTestId('transcript-list')).toContainText(/testdiktat/i, {
        timeout: 120_000,
      });
    }

    // Zustellungspfad (Clipboard-Sequenz + gemockter Paste): laeuft immer.
    const bridge = (text: string) =>
      window.evaluate(
        (t: string) =>
          (
            globalThis as unknown as {
              voicewall: {
                devRunDictationResult: (
                  value: string,
                ) => Promise<{ delivered: boolean; pasted: boolean; message: string | null }>;
              };
            }
          ).voicewall.devRunDictationResult(t),
        text,
      );
    await window.evaluate(() =>
      (
        globalThis as unknown as {
          voicewall: { devMockPaste: (enabled: boolean) => Promise<unknown> };
        }
      ).voicewall.devMockPaste(true),
    );
    await window.evaluate(() =>
      (
        globalThis as unknown as {
          voicewall: { devSetAccessibility: (trusted: boolean | null) => Promise<unknown> };
        }
      ).voicewall.devSetAccessibility(true),
    );
    const delivery = await bridge('Netzwerk-Isolations-Testdiktat.');
    expect(delivery.delivered).toBe(true);

    // --- Auswertung: null nicht-lokale Requests ---------------------------
    const urls = await recordedUrls(app);
    const externalUrls = urls.filter((url) => !LOCAL_URL_PATTERN.test(url));
    // Im Dev-/Testlauf ist die gebaute App aktiv (file://); sollte je eine
    // lokale Vite-URL gesetzt sein, ist auch sie lokal.
    const trulyExternal = externalUrls.filter(
      (url) => !url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1'),
    );
    expect(trulyExternal, `Nicht-lokale Requests gefunden: ${trulyExternal.join(', ')}`).toEqual(
      [],
    );
    // Der Recorder hat wirklich aufgezeichnet (mindestens die file://-Loads
    // der Fenster), sonst waere der Beweis leer.
    expect(urls.length).toBeGreaterThan(0);
  } finally {
    await app.close();
  }
});
