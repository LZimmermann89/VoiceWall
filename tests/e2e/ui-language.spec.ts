/**
 * E2E-Tests der UI-Sprache (Paket B2):
 *
 * 1. Der Wizard startet mit dem Schritt "Sprache / Language" (Schritt 0);
 *    die Wahl English stellt die Oberflaeche LIVE um (Pruefschritte-Register,
 *    Schrittnamen, Weiter-Knopf englisch) und zurueck auf Deutsch.
 * 2. Der Sprachumschalter in der Verwaltung wechselt live (Reiter, H2)
 *    und persistiert: ein zweiter Start mit demselben userData startet
 *    englisch (config.json traegt uiSprache: 'en').
 *
 * Vollstaendig isoliert (VOICEWALL_TEST_USER_DATA/_BASE_DIR); Default
 * bleibt Deutsch, alle uebrigen E2E-Tests laufen unveraendert deutsch.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, _electron as electron } from '@playwright/test';
import { builtMainEntry, launchApp } from './launch';
import { getMainUiWindow } from './main-window';

const projectRoot = join(import.meta.dirname, '../..');

test.beforeAll(() => {
  if (!existsSync(builtMainEntry)) {
    throw new Error(
      'Gebaute App fehlt (out/main/index.js). Bitte zuerst `npm run build` ausführen.',
    );
  }
});

test('B2: Wizard startet mit Sprache/Language-Schritt, Wahl English stellt live um', async () => {
  const { app, window } = await launchApp({ withConsent: true });
  try {
    // Schritt 0 erscheint VOR allem anderen, zweisprachig beschriftet.
    await expect(window.getByTestId('wizard-page')).toBeVisible();
    await expect(window.getByTestId('wizard-page')).toHaveAttribute('data-step', 'sprachwahl');
    await expect(window.locator('h2')).toContainText('Sprache / Language');
    await expect(window.getByTestId('wizard-ui-language-de')).toBeChecked();

    // Default Deutsch: Rail und Navigation sind deutsch.
    await expect(window.getByTestId('wizard-rail-title')).toHaveText('Prüfschritte');
    await expect(window.getByTestId('wizard-next')).toHaveText('Weiter');

    // Wahl English: die Oberflaeche wechselt sofort, ohne Reload.
    await window.getByTestId('wizard-ui-language-en').check();
    await expect(window.getByTestId('wizard-rail-title')).toHaveText('Audit steps');
    await expect(window.getByTestId('wizard-next')).toHaveText('Next');
    await expect(window.locator('.wizard-steps')).toContainText('Welcome');
    await expect(window.locator('.wizard-steps')).toContainText('Company details');
    await expect(window.locator('.context-label')).toHaveText('Setup record');

    // Naechster Schritt (Willkommen) erscheint englisch, H2 englisch.
    await window.getByTestId('wizard-next').click();
    await expect(window.getByTestId('wizard-page')).toHaveAttribute('data-step', 'willkommen');
    await expect(window.locator('h2')).toContainText('Welcome to VoiceWall');

    // Zurueck zu Schritt 0 und Wahl Deutsch: alles sofort wieder deutsch.
    await window.getByTestId('wizard-back').click();
    await window.getByTestId('wizard-ui-language-de').check();
    await expect(window.getByTestId('wizard-rail-title')).toHaveText('Prüfschritte');
    await expect(window.getByTestId('wizard-next')).toHaveText('Weiter');
  } finally {
    await app.close();
  }
});

test('B2: Sprachumschalter in der Verwaltung wechselt live und persistiert', async () => {
  const { app, window, userDataDir, baseDir } = await launchApp({ withCompany: true });
  try {
    // Verwaltung startet deutsch (Default).
    await expect(window.getByTestId('nav-register')).toHaveText('Register');
    await expect(window.getByTestId('nav-papierkorb')).toHaveText('Papierkorb');

    // Live-Umschaltung auf English: Reiter und Ansichts-H2 wechseln sofort.
    await window.getByTestId('ui-language-select').selectOption('en');
    await expect(window.getByTestId('nav-register')).toHaveText('Records');
    await expect(window.getByTestId('nav-papierkorb')).toHaveText('Trash');
    await expect(window.getByTestId('nav-beleg')).toHaveText('Evidence');
    await expect(window.locator('.view-title')).toHaveText('Dictation');
    await expect(window.locator('.context-label')).toHaveText('Management');

    // Beleg-Ansicht: Rechtstexte bleiben deutsch, mit englischer Einordnung.
    await window.getByTestId('nav-beleg').click();
    await expect(window.getByTestId('beleg-impressum-sprachhinweis')).toContainText(
      'provided in German',
    );
    await expect(window.getByTestId('beleg-impressum')).toContainText(
      'FERNAU Präzisionstechnik GmbH',
    );

    // Persistenz: config.json traegt uiSprache 'en'.
    await expect
      .poll(() => {
        const config = JSON.parse(readFileSync(join(userDataDir, 'config.json'), 'utf8')) as {
          uiSprache?: string;
        };
        return config.uiSprache;
      })
      .toBe('en');

    // Zweiter Start mit demselben userData: die Verwaltung startet englisch.
    await app.close();
    const second = await electron.launch({
      args: [builtMainEntry],
      cwd: projectRoot,
      env: {
        ...process.env,
        VOICEWALL_ENABLE_TEST_IPC: '1',
        VOICEWALL_TEST_USER_DATA: userDataDir,
        VOICEWALL_TEST_BASE_DIR: baseDir,
      },
    });
    try {
      const secondWindow = await getMainUiWindow(second);
      await expect(secondWindow.getByTestId('nav-register')).toHaveText('Records', {
        timeout: 15_000,
      });
      await expect(secondWindow.locator('.view-title')).toHaveText('Dictation');
      // Zurueckschalten auf Deutsch funktioniert auch nach dem Neustart.
      await secondWindow.getByTestId('ui-language-select').selectOption('de');
      await expect(secondWindow.getByTestId('nav-register')).toHaveText('Register');
    } finally {
      await second.close();
    }
  } finally {
    if (app.windows().length > 0) {
      await app.close().catch(() => undefined);
    }
  }
});
