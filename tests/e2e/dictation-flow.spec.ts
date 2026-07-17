/**
 * E2E-Tests des systemweiten Diktat-Flows.
 *
 * Ein globaler Hotkey laesst sich in Playwright nicht simulieren; der Flow
 * wird deshalb ueber die Dev-/Test-IPC-Kanaele getriggert (nur mit
 * VOICEWALL_ENABLE_TEST_IPC=1 aktiv, nie im Produkt). Der Paste-Adapter wird
 * per Dependency Injection gemockt: in der CI laeuft NIE ein echter
 * osascript-/PowerShell-Aufruf.
 *
 * Belegt werden:
 * 1. Hotkey ist registriert (globalShortcut.isRegistered).
 * 2. Diktat-Zustellung: Transkript landet in der Zwischenablage, der
 *    (gemockte) Paste-Adapter wird genau einmal aufgerufen, danach wird der
 *    vorherige Zwischenablage-Inhalt wiederhergestellt.
 * 3. Accessibility-Hinweis-Pfad: ohne Bedienungshilfen-Freigabe kein
 *    Paste-Versuch, deutsche Meldung, Text bleibt in der Zwischenablage.
 * 4. Overlay stiehlt keinen Fokus: focusable=false, alwaysOnTop=true.
 */
import { existsSync } from 'node:fs';
import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { builtMainEntry, launchApp } from './launch';

interface DevBridge {
  voicewall: {
    devMockPaste: (enabled: boolean) => Promise<{ ok: boolean; message?: string }>;
    devGetPasteCalls: () => Promise<number>;
    devSetAccessibility: (trusted: boolean | null) => Promise<{ ok: boolean; message?: string }>;
    devRunDictationResult: (
      text: string,
    ) => Promise<{ delivered: boolean; pasted: boolean; message: string | null }>;
  };
}

function bridgeOf(window: Page): {
  runResult: (
    text: string,
  ) => Promise<{ delivered: boolean; pasted: boolean; message: string | null }>;
  mockPaste: (enabled: boolean) => Promise<{ ok: boolean; message?: string }>;
  setAccessibility: (trusted: boolean | null) => Promise<{ ok: boolean; message?: string }>;
  pasteCalls: () => Promise<number>;
} {
  return {
    runResult: (text) =>
      window.evaluate(
        (t: string) => (globalThis as unknown as DevBridge).voicewall.devRunDictationResult(t),
        text,
      ),
    mockPaste: (enabled) =>
      window.evaluate(
        (e: boolean) => (globalThis as unknown as DevBridge).voicewall.devMockPaste(e),
        enabled,
      ),
    setAccessibility: (trusted) =>
      window.evaluate(
        (t: boolean | null) =>
          (globalThis as unknown as DevBridge).voicewall.devSetAccessibility(t),
        trusted,
      ),
    pasteCalls: () =>
      window.evaluate(() => (globalThis as unknown as DevBridge).voicewall.devGetPasteCalls()),
  };
}

function readClipboard(app: ElectronApplication): Promise<string> {
  return app.evaluate(({ clipboard }) => clipboard.readText());
}

function writeClipboard(app: ElectronApplication, text: string): Promise<void> {
  return app.evaluate(({ clipboard }, t) => {
    clipboard.writeText(t);
  }, text);
}

test.beforeAll(() => {
  if (!existsSync(builtMainEntry)) {
    throw new Error(
      'Gebaute App fehlt (out/main/index.js). Bitte zuerst `npm run build` ausführen.',
    );
  }
});

test('Diktat-Flow: Hotkey registriert, Clipboard-Zustellung, Paste-Mock, Wiederherstellung, Accessibility-Pfad, Overlay-Fokus', async () => {
  const { app, window } = await launchApp({ withCompany: true });
  try {
    await expect(window.locator('h1')).toContainText('VoiceWall');
    const bridge = bridgeOf(window);

    // 1. Der globale Hotkey (Default) ist systemweit registriert.
    const hotkeyRegistered = await app.evaluate(({ globalShortcut }) =>
      globalShortcut.isRegistered('CommandOrControl+Shift+D'),
    );
    expect(hotkeyRegistered).toBe(true);
    await expect(window.getByTestId('hotkey-current')).toHaveText('CommandOrControl+Shift+D');

    // 4. Overlay-Fenster existiert und kann keinen Fokus stehlen.
    const overlayFlags = await app.evaluate(({ BrowserWindow }) => {
      const overlay = BrowserWindow.getAllWindows().find(
        (candidate) => candidate.getTitle() === 'VoiceWall Overlay',
      );
      if (overlay === undefined) {
        return null;
      }
      return {
        focusable: overlay.isFocusable(),
        alwaysOnTop: overlay.isAlwaysOnTop(),
        visible: overlay.isVisible(),
      };
    });
    expect(overlayFlags).not.toBeNull();
    expect(overlayFlags?.focusable).toBe(false);
    expect(overlayFlags?.alwaysOnTop).toBe(true);

    // 2. Zustellung mit gemocktem Paste-Adapter und Accessibility-Override.
    await writeClipboard(app, 'VORHERIGER-INHALT');
    expect((await bridge.mockPaste(true)).ok).toBe(true);
    expect((await bridge.setAccessibility(true)).ok).toBe(true);

    const transcript = 'Der Vertrag wurde am dritten Juli geprueft.';
    const result = await bridge.runResult(transcript);
    expect(result.delivered).toBe(true);
    expect(result.pasted).toBe(true);
    expect(result.message).toBeNull();

    // Unmittelbar nach dem Paste haelt die Zwischenablage das Transkript.
    expect(await readClipboard(app)).toBe(transcript);
    // Der gemockte Paste-Adapter wurde genau einmal aufgerufen.
    expect(await bridge.pasteCalls()).toBe(1);

    // Nach der Verzoegerung (Default 1 s) wird der alte Inhalt
    // wiederhergestellt: das Transkript verlaesst die Zwischenablage.
    await expect.poll(() => readClipboard(app), { timeout: 10_000 }).toBe('VORHERIGER-INHALT');

    // Die UI zeigt das letzte Transkript samt Kopieren-Knopf (Resilienz).
    await expect(window.getByTestId('last-transcript')).toContainText(transcript);
    await expect(window.getByTestId('copy-last-transcript')).toBeVisible();

    // 3. Accessibility-Hinweis-Pfad: Mock aus, Freigabe fehlt (Override
    // false; auf dieser Maschine ist das zugleich der echte Dev-Zustand).
    expect((await bridge.mockPaste(false)).ok).toBe(true);
    expect((await bridge.setAccessibility(false)).ok).toBe(true);
    await writeClipboard(app, 'VORHER-ZWEI');

    const blocked = await bridge.runResult('Zweiter Diktattext ohne Freigabe.');
    expect(blocked.delivered).toBe(true);
    expect(blocked.pasted).toBe(false);
    expect(blocked.message).toContain('Bedienungshilfen');
    expect(blocked.message).toContain('Zwischenablage');

    // Kein Paste-Versuch: Zaehler unveraendert, Text bleibt liegen (kein
    // Restore), damit er manuell eingefuegt werden kann.
    expect(await bridge.pasteCalls()).toBe(1);
    expect(await readClipboard(app)).toBe('Zweiter Diktattext ohne Freigabe.');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(await readClipboard(app)).toBe('Zweiter Diktattext ohne Freigabe.');

    // Die UI zeigt den Accessibility-Hinweis mit Deep-Link-Knopf.
    await expect(window.getByTestId('accessibility-hint')).toBeVisible();
    await expect(window.getByRole('button', { name: 'Systemeinstellungen öffnen' })).toBeVisible();

    // Kopieren-Knopf: letztes Transkript landet erneut in der Zwischenablage.
    await window.getByTestId('copy-last-transcript').click();
    await expect
      .poll(() => readClipboard(app), { timeout: 5000 })
      .toBe('Zweiter Diktattext ohne Freigabe.');
  } finally {
    await app.close();
  }
});
