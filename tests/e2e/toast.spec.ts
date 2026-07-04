/**
 * E2E-Tests des Toast-Systems (Sofortmeldungen, Entscheidung E44):
 *
 * 1. Fehlerpfad (DevSetAccessibility-Muster): ein Diktat mit verweigerter
 *    Bedienungshilfen-Freigabe erzeugt eine Fehlermeldung, die als Toast im
 *    sichtbaren Viewport erscheint, unabhängig von der Scroll-Position.
 * 2. Erfolgspfad: das Speichern des Wörterbuchs zeigt einen Erfolgs-Toast;
 *    der Toast ist manuell (per Tastatur) schließbar.
 */
import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { builtMainEntry, launchApp } from './launch';

interface ToastBridge {
  voicewall: {
    devMockPaste: (enabled: boolean) => Promise<{ ok: boolean }>;
    devSetAccessibility: (trusted: boolean | null) => Promise<{ ok: boolean }>;
    devRunDictationResult: (
      text: string,
    ) => Promise<{ delivered: boolean; pasted: boolean; message: string | null }>;
  };
}

/** Fenster-Globals im Renderer (die E2E-tsconfig hat bewusst kein DOM-lib). */
interface RendererGlobals {
  innerWidth: number;
  innerHeight: number;
  scrollTo: (x: number, y: number) => void;
  document: { body: { scrollHeight: number } };
}

/** Prueft, dass ein Element vollstaendig im sichtbaren Viewport liegt. */
async function expectInViewport(window: Page, testId: string): Promise<void> {
  const box = await window.getByTestId(testId).first().boundingBox();
  const viewport = await window.evaluate(() => {
    const globals = globalThis as unknown as RendererGlobals;
    return { width: globals.innerWidth, height: globals.innerHeight };
  });
  expect(box).not.toBeNull();
  if (box !== null) {
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  }
}

test.beforeAll(() => {
  if (!existsSync(builtMainEntry)) {
    throw new Error(
      'Gebaute App fehlt (out/main/index.js). Bitte zuerst `npm run build` ausführen.',
    );
  }
});

test('Fehler-Toast: erscheint im Viewport, unabhängig von der Scroll-Position', async () => {
  const { app, window } = await launchApp({ withCompany: true });
  try {
    await expect(window.locator('h1')).toContainText('VoiceWall');

    // Fehlerpfad vorbereiten: Bedienungshilfen-Freigabe verweigert -> das
    // Diktat landet nur in der Zwischenablage und meldet einen Fehler.
    await window.evaluate(() =>
      (globalThis as unknown as ToastBridge).voicewall.devSetAccessibility(false),
    );

    // Ans Seitenende scrollen: der Toast muss trotzdem sichtbar sein.
    await window.evaluate(() => {
      const globals = globalThis as unknown as {
        scrollTo: (x: number, y: number) => void;
        document: { body: { scrollHeight: number } };
      };
      globals.scrollTo(0, globals.document.body.scrollHeight);
    });

    const delivery = await window.evaluate(() =>
      (globalThis as unknown as ToastBridge).voicewall.devRunDictationResult('Hallo Welt.'),
    );
    expect(delivery.delivered).toBe(true);
    expect(delivery.pasted).toBe(false);

    // Der Fehler-Toast ist sofort sichtbar (aria-live assertive) und liegt
    // vollstaendig im Viewport (position: fixed).
    const toast = window.getByTestId('toast-error');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute('aria-live', 'assertive');
    await expectInViewport(window, 'toast-error');

    // Die bestehende Inline-Anzeige (error-box) bleibt als Detail-Ort.
    await expect(window.getByTestId('error-box')).toBeVisible();
  } finally {
    await app.close();
  }
});

test('Erfolgs-Toast: Wörterbuch speichern bestätigt sofort sichtbar, per Tastatur schließbar', async () => {
  const { app, window } = await launchApp({ withCompany: true });
  try {
    await expect(window.locator('h1')).toContainText('VoiceWall');

    // Eintrag anlegen: die "noch nicht gespeichert"-Warnung erscheint (E45).
    await window.getByTestId('vocab-begriff-input').fill('VoiceWall');
    await window.getByTestId('vocab-add-begriff').click();
    await expect(window.getByTestId('vocab-dirty')).toBeVisible();

    await window.getByTestId('vocab-save').click();

    // Erfolgs-Toast (aria-live polite) erscheint im Viewport.
    const toast = window.getByTestId('toast-success');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute('aria-live', 'polite');
    await expectInViewport(window, 'toast-success');

    // Nach dem Speichern ist der Stand sauber: Warnung verschwindet.
    await expect(window.getByTestId('vocab-dirty')).toHaveCount(0);

    // Manuell schliessbar, per Tastatur (Fokus + Enter).
    await window.getByTestId('toast-close').first().focus();
    await window.keyboard.press('Enter');
    await expect(window.getByTestId('toast-success')).toHaveCount(0);
  } finally {
    await app.close();
  }
});
