/**
 * E2E-Tests des First-Run-Wizards.
 *
 * Vollstaendig isoliert: userData und Firmen-Basisordner sind temporaere
 * Testverzeichnisse; die Modelle werden per Hardlink in das Test-userData
 * gelegt (Status "vorhanden", kein Download). Die Einwilligung ist
 * vorab dokumentiert, damit grantConsent beim "Einrichten" nicht den
 * blockierenden macOS-Mikrofon-Systemdialog ausloest.
 *
 * Belegt werden:
 * 1. Kompletter Wizard-Durchlauf: Sprachwahl (Schritt 0),
 *    Consent-Gate, Firmendaten mit Umlauten
 *    und Live-Ordnernamen-Vorschau, E-Mail-Validierung, Speicherort mit
 *    Sync-Ergebnis, Sprache, Modell (vorhanden), Hotkey-Livetest,
 *    Bedienungshilfen (macOS), Zusammenfassung, Einrichten. Danach:
 *    Ordnerstruktur und Konfiguration existieren, App zeigt die
 *    Hauptansicht.
 * 2. Idempotenz: Ein zweiter Start mit demselben userData zeigt den Wizard
 *    NICHT mehr, sondern direkt die Verwaltung.
 * 3. Accessibility-Schnellcheck: Tab-Reihenfolge erreicht alle Controls des
 *    Firmendaten-Schritts; der Weiter-Knopf ist ohne Einwilligung gesperrt.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, _electron as electron } from '@playwright/test';
import { modelsAvailable } from '../integration/model-fixtures';
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

test('Wizard: kompletter Durchlauf legt Firma an, zweiter Start zeigt die Verwaltung', async () => {
  test.skip(!modelsAvailable, 'Modelle nicht vorhanden; kompletter Wizard-Durchlauf braucht sie.');
  const { app, window, userDataDir, baseDir } = await launchApp({
    linkModels: true,
    withConsent: true,
  });
  try {
    // First-Run: der Wizard erscheint (keine Firma vorhanden).
    await expect(window.getByTestId('wizard-page')).toBeVisible();
    await expect(window.locator('h1')).toHaveCount(1);

    // Schritt 0: Sprache / Language, Deutsch ist vorgewaehlt.
    await expect(window.getByTestId('wizard-page')).toHaveAttribute('data-step', 'sprachwahl');
    await expect(window.getByTestId('wizard-ui-language-de')).toBeChecked();
    await window.getByTestId('wizard-next').click();

    // Schritt 1 (Willkommen): ohne Einwilligung ist Weiter gesperrt.
    await expect(window.getByTestId('wizard-page')).toHaveAttribute('data-step', 'willkommen');
    const next = window.getByTestId('wizard-next');
    await expect(next).toBeDisabled();
    await expect(window.getByTestId('wizard-ai-act')).toContainText('Transparenzhinweis');
    await window.getByTestId('wizard-consent').check();
    await expect(next).toBeEnabled();
    await next.click();

    // Schritt 2: Firmendaten mit Umlauten, Live-Vorschau des Ordnernamens.
    await expect(window.getByTestId('wizard-page')).toHaveAttribute('data-step', 'firma');
    await window.getByTestId('wizard-company-name').fill('Müller & Söhne GmbH');
    await expect(window.getByTestId('wizard-folder-preview')).toContainText(
      'Ordner: Müller & Söhne GmbH',
    );
    // E-Mail-Validierung (RFC-lax): ungueltig blockiert, gueltig nicht.
    await window.getByTestId('wizard-email').fill('keine-adresse');
    await expect(window.getByTestId('wizard-next')).toBeDisabled();
    await expect(window.locator('#wz-email-error')).toBeVisible();
    await window.getByTestId('wizard-email').fill('info@mueller-soehne.de');
    await window.getByTestId('wizard-contact').fill('Frau Schmidt');
    await expect(window.getByTestId('wizard-next')).toBeEnabled();

    // Zurueck-Navigation erhaelt Eingaben.
    await window.getByTestId('wizard-back').click();
    await expect(window.getByTestId('wizard-page')).toHaveAttribute('data-step', 'willkommen');
    await expect(window.getByTestId('wizard-consent')).toBeChecked();
    await window.getByTestId('wizard-next').click();
    await expect(window.getByTestId('wizard-company-name')).toHaveValue('Müller & Söhne GmbH');
    await window.getByTestId('wizard-next').click();

    // Schritt 3: Speicherort. Test-Basisordner ist nicht synchronisiert.
    await expect(window.getByTestId('wizard-page')).toHaveAttribute('data-step', 'speicherort');
    await expect(window.getByTestId('wizard-sync-ok')).toBeVisible();
    await window.getByTestId('wizard-strategy-desktop').check();
    await window.getByTestId('wizard-next').click();

    // Schritt 4: Sprache (Deutsch fest).
    await expect(window.getByTestId('wizard-page')).toHaveAttribute('data-step', 'sprache');
    await expect(window.getByText('Deutsch (de)')).toBeVisible();
    await window.getByTestId('wizard-next').click();

    // Schritt 5: Modell. Modelle liegen im Test-userData: Status vorhanden.
    await expect(window.getByTestId('wizard-page')).toHaveAttribute('data-step', 'modell');
    await expect(window.getByTestId('wizard-model-ready')).toBeVisible({ timeout: 30_000 });
    await window.getByTestId('wizard-next').click();

    // Schritt 6: Hotkey-Livetest des Defaults meldet Erfolg.
    await expect(window.getByTestId('wizard-page')).toHaveAttribute('data-step', 'hotkey');
    await expect(window.getByTestId('wizard-hotkey-result')).toContainText('frei', {
      timeout: 10_000,
    });
    await window.getByTestId('wizard-next').click();

    // Schritt 7 (nur macOS): Bedienungshilfen-Status sichtbar, nicht blockierend.
    if (process.platform === 'darwin') {
      await expect(window.getByTestId('wizard-page')).toHaveAttribute(
        'data-step',
        'bedienungshilfen',
      );
      await expect(window.getByTestId('wizard-accessibility-status')).toBeVisible();
      await window.getByTestId('wizard-accessibility-refresh').click();
      await window.getByTestId('wizard-next').click();
    }

    // Schritt 8: Zusammenfassung und Einrichten (atomare Anlage).
    await expect(window.getByTestId('wizard-page')).toHaveAttribute('data-step', 'zusammenfassung');
    await expect(window.getByTestId('wizard-summary')).toContainText('Müller & Söhne GmbH');
    // Vor der Bestaetigung existiert der Firmenordner NICHT.
    expect(existsSync(join(baseDir, 'Müller & Söhne GmbH'))).toBe(false);
    await window.getByTestId('wizard-apply').click();

    // Erfolgsseite mit Kurzanleitung und Netzwerk-Selbsttest.
    await expect(window.getByTestId('wizard-success')).toBeVisible({ timeout: 30_000 });
    await expect(window.getByTestId('wizard-success')).toContainText('So diktieren Sie');
    await expect(window.getByTestId('wizard-success')).toContainText('Netzwerk-Selbsttest');

    // Ordnerstruktur und Konfiguration sind entstanden.
    const companyDir = join(baseDir, 'Müller & Söhne GmbH');
    expect(existsSync(join(companyDir, '.voicewall', 'manifest.json'))).toBe(true);
    expect(existsSync(join(companyDir, 'Diktate'))).toBe(true);
    const companyConfig = JSON.parse(
      readFileSync(join(companyDir, '.voicewall', 'config.json'), 'utf8'),
    ) as { firma: { anzeigename: string; ansprechpartner: string; email: string } };
    expect(companyConfig.firma.anzeigename).toBe('Müller & Söhne GmbH');
    expect(companyConfig.firma.ansprechpartner).toBe('Frau Schmidt');
    expect(companyConfig.firma.email).toBe('info@mueller-soehne.de');
    const globalConfig = JSON.parse(readFileSync(join(userDataDir, 'config.json'), 'utf8')) as {
      firmen: string[];
      aktiveFirma: string | null;
      modell: string;
    };
    expect(globalConfig.firmen.length).toBe(1);
    expect(globalConfig.aktiveFirma).toContain('Müller & Söhne GmbH');
    expect(globalConfig.modell).toBe('q5_0');

    // Weiter zur Hauptansicht: Firma sichtbar.
    await window.getByTestId('wizard-to-main').click();
    await expect(window.getByTestId('company-list')).toContainText('Müller & Söhne GmbH');

    // Idempotenz: zweiter Start mit demselben userData zeigt KEINEN Wizard.
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
      await expect(secondWindow.getByTestId('company-list')).toContainText('Müller & Söhne GmbH', {
        timeout: 15_000,
      });
      await expect(secondWindow.getByTestId('wizard-page')).toHaveCount(0);
    } finally {
      await second.close();
    }
  } finally {
    if (app.windows().length > 0) {
      await app.close().catch(() => undefined);
    }
  }
});

test('Wizard-A11y: Tab-Reihenfolge erreicht alle Controls des Firmendaten-Schritts', async () => {
  const { app, window } = await launchApp({ withConsent: true });
  try {
    await expect(window.getByTestId('wizard-page')).toBeVisible();
    // Schritt 0 (Sprache / Language) passieren, dann Einwilligung.
    await expect(window.getByTestId('wizard-page')).toHaveAttribute('data-step', 'sprachwahl');
    await window.getByTestId('wizard-next').click();
    await window.getByTestId('wizard-consent').check();
    await window.getByTestId('wizard-next').click();
    await expect(window.getByTestId('wizard-page')).toHaveAttribute('data-step', 'firma');

    // Tastatur-Durchlauf: vom (fokussierten) Schritt-Heading aus erreicht
    // Tab nacheinander alle Eingabefelder und die Navigation.
    const expectedStops = [
      'wz-name',
      'wz-ordnername',
      'wz-ansprechpartner',
      'wz-email',
      'wz-standort',
      'wz-hinweis',
    ];
    const reached: string[] = [];
    for (let presses = 0; presses < 12 && reached.length < expectedStops.length; presses += 1) {
      await window.keyboard.press('Tab');
      const activeId = await window.evaluate(
        () =>
          (globalThis as unknown as { document: { activeElement: { id: string } | null } }).document
            .activeElement?.id ?? '',
      );
      if (expectedStops.includes(activeId) && !reached.includes(activeId)) {
        reached.push(activeId);
      }
    }
    expect(reached).toEqual(expectedStops);

    // Fokus ist programmatisch nachvollziehbar (der sichtbare 2px-Ring ist
    // per :focus-visible in styles.css definiert und dort dokumentiert).
    await expect(window.locator('#wz-hinweis')).toBeFocused();
  } finally {
    await app.close();
  }
});

test('Wizard erscheint beim First-Run, Verwaltung nach Firmen-Anlage (ohne Modelle)', async () => {
  const { app, window } = await launchApp({ withCompany: true });
  try {
    // withCompany hat die Firma per Bruecke angelegt und neu geladen:
    // die Verwaltung ist sichtbar, kein Wizard.
    await expect(window.getByTestId('company-list')).toContainText('Testfirma GmbH');
    await expect(window.getByTestId('wizard-page')).toHaveCount(0);

    // "Neue Firma einrichten" oeffnet den Wizard im Nachruestmodus
    // (nur Firmen-Schritte) und laesst sich abbrechen.
    await window.getByTestId('add-company').click();
    await expect(window.getByTestId('wizard-page')).toHaveAttribute('data-step', 'firma');
    await window.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(window.getByTestId('company-list')).toBeVisible();
  } finally {
    await app.close();
  }
});
