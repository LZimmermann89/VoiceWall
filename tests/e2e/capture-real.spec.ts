/**
 * Regressionstest fuer den ECHTEN Aufnahmepfad (gefunden im manuellen
 * Praxistest am 03.07.2026): getUserMedia im versteckten Capture-Fenster,
 * AudioWorklet als Blob-URL, PCM-Fluss bis zur Pegelanzeige.
 *
 * Hintergrund: Chromium prueft AudioWorklet-Module gegen script-src, nicht
 * gegen worker-src. Die Capture-CSP ohne `script-src blob:` liess addModule
 * mit "Unable to load a worklet's module." scheitern; alle bisherigen E2E
 * liefen ueber die PCM-Injektion und konnten das nicht sehen (siehe
 * docs/ENTSCHEIDUNGEN.md E34).
 *
 * Der Test nutzt Chromiums Fake-Mikrofon (--use-fake-device-for-media-stream
 * liefert einen Dauerton, --use-fake-ui-for-media-stream unterdrueckt den
 * Berechtigungsdialog). Damit laeuft der komplette reale Pfad ohne
 * physisches Mikrofon und ohne TCC-Dialog.
 */
import { expect, test } from '@playwright/test';
import { modelsAvailable } from '../integration/model-fixtures';
import { launchApp } from './launch';

/** Schmale Sicht auf die Preload-Bruecke fuer window.evaluate. */
interface CaptureBridge {
  voicewall: {
    prepareModels: () => Promise<{ ok: boolean; message?: string }>;
    startDictation: () => Promise<{ ok: boolean; message?: string }>;
    stopDictation: () => Promise<{ ok: boolean; message?: string }>;
  };
}

test('Echter Aufnahmepfad: Worklet laedt, Fake-Mikrofon erzeugt Pegel (kein Mikrofon-Fehler)', async () => {
  test.skip(!modelsAvailable, 'Whisper-/VAD-Modelle liegen nicht im lokalen userData.');

  const { app, window } = await launchApp({
    withCompany: true,
    linkModels: true,
    withConsent: true,
    extraArgs: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  try {
    // Engine starten (Modelle sind verlinkt, kein Download).
    const prepared = await window.evaluate(async () =>
      (globalThis as unknown as CaptureBridge).voicewall.prepareModels(),
    );
    expect(prepared.ok).toBe(true);

    // Echte Aufnahme starten: oeffnet das Capture-Fenster, laedt das
    // AudioWorklet-Modul und streamt PCM des Fake-Mikrofons.
    const started = await window.evaluate(async () =>
      (globalThis as unknown as CaptureBridge).voicewall.startDictation(),
    );
    expect(started.ok).toBe(true);

    // Der Kern-Beweis: Pegel kommt an (Worklet laeuft, PCM fliesst). Der
    // Fake-Ton hat einen RMS deutlich ueber 0, die Anzeige verlaesst lvl-0.
    const levelFill = window.getByTestId('level-fill');
    await expect
      .poll(
        async () => {
          const cls = (await levelFill.getAttribute('class')) ?? '';
          return /lvl-[1-9]/.test(cls);
        },
        { timeout: 15_000, message: 'Pegelanzeige hat lvl-0 nie verlassen (kein PCM-Fluss).' },
      )
      .toBe(true);

    // Kein Mikrofon-/Worklet-Fehler in der UI.
    const bodyText = await window.locator('body').innerText();
    expect(bodyText).not.toContain("worklet's module");
    expect(bodyText).not.toContain('Mikrofonzugriff ist fehlgeschlagen');

    const stopped = await window.evaluate(async () =>
      (globalThis as unknown as CaptureBridge).voicewall.stopDictation(),
    );
    expect(stopped.ok).toBe(true);
  } finally {
    await app.close();
  }
});
