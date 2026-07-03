/**
 * E2E-Test der Verwaltungs-UI (M7, ABARBEITUNG 4.8 DoD):
 *
 * Vollstaendig isoliert vom echten Rechner (VOICEWALL_TEST_USER_DATA,
 * VOICEWALL_TEST_BASE_DIR). Seed ueber die echten APIs (createManualNote via
 * IPC-Bruecke). Belegt werden:
 *  - Register zeigt die angelegten Eintraege; Schnellsuche filtert.
 *  - Detailansicht zeigt den Volltext; Bearbeiten aendert Titel und Tags,
 *    die Version steigt; der neue Tag filtert.
 *  - Export MD erzeugt eine Datei unter Exporte/ (Datei-Assert).
 *  - Soft-Delete verschiebt in den Papierkorb, Wiederherstellen holt zurueck.
 *  - Firmenwechsel laedt den getrennten Bestand (zwei Firmen).
 *  - XSS-Probe: ein Diktat mit HTML-artigem Body wird als Text angezeigt,
 *    es entsteht kein img-Element und kein Skript wird ausgefuehrt.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { builtMainEntry, createTestCompany, launchApp } from './launch';

test.beforeAll(() => {
  if (!existsSync(builtMainEntry)) {
    throw new Error(
      'Gebaute App fehlt (out/main/index.js). Bitte zuerst `npm run build` ausführen.',
    );
  }
});

interface NoteBridge {
  voicewall: {
    createManualNote: (input: {
      titel: string;
      body: string;
    }) => Promise<{ ok: boolean; message?: string }>;
    listCompanies: () => Promise<{ aktiveFirma: string | null }>;
  };
}

async function seedNote(window: Page, titel: string, body: string): Promise<void> {
  const result = await window.evaluate(
    (arg: { titel: string; body: string }) =>
      (globalThis as unknown as NoteBridge).voicewall.createManualNote(arg),
    { titel, body },
  );
  if (!result.ok) {
    throw new Error(`Notiz konnte nicht angelegt werden: ${result.message ?? ''}`);
  }
}

async function activeCompanyDir(window: Page): Promise<string> {
  const list = await window.evaluate(() =>
    (globalThis as unknown as NoteBridge).voicewall.listCompanies(),
  );
  return list.aktiveFirma ?? '';
}

test('M7: Register, Suche, Detail, Bearbeiten/Tag, Export, Soft-Delete/Wiederherstellen', async () => {
  const { app, window } = await launchApp({ withCompany: true });
  try {
    await expect(window.locator('h1')).toContainText('VoiceWall');

    // Seed ueber die echte API (manuelle Notizen).
    await seedNote(
      window,
      'Angebot Frühling',
      'Sehr geehrte Frau Schäfer, das Angebot ist beigefügt.',
    );
    await seedNote(window, 'Rechnung Sommer', 'Die Rechnung für Juli ist fällig.');
    await seedNote(window, 'Notiz Herbst', 'Interner Vermerk zur Nachbereitung im Oktober.');

    // Register oeffnen: drei Eintraege.
    await window.getByTestId('nav-register').click();
    await expect(window.getByTestId('register-row')).toHaveCount(3);

    // Schnellsuche filtert live.
    await window.getByTestId('register-search').fill('Rechnung');
    await expect(window.getByTestId('register-row')).toHaveCount(1);
    await expect(window.getByTestId('register-row')).toContainText('Rechnung Sommer');
    await window.getByTestId('register-search').fill('');
    await expect(window.getByTestId('register-row')).toHaveCount(3);

    // Detailansicht zeigt den Volltext.
    await window.getByTestId('register-row').filter({ hasText: 'Angebot Frühling' }).click();
    await expect(window.getByTestId('detail-panel')).toBeVisible();
    await expect(window.getByTestId('detail-body')).toContainText('das Angebot ist beigefügt');
    await expect(window.getByTestId('detail-version')).toHaveText('1');

    // Bearbeiten: Titel aendern und Tag hinzufuegen; Version steigt auf 2.
    await window.getByTestId('detail-edit').click();
    await window.getByTestId('edit-titel').fill('Angebot Frühling (geprüft)');
    await window.getByTestId('tag-input').fill('wichtig');
    await window.getByTestId('tag-input').press('Enter');
    await window.getByTestId('edit-save').click();
    await expect(window.getByTestId('detail-title')).toContainText('Angebot Frühling (geprüft)');
    await expect(window.getByTestId('detail-version')).toHaveText('2');

    // Export MD (mit Kopf) erzeugt eine Datei unter Exporte/.
    const companyDir = await activeCompanyDir(window);
    await window.getByTestId('export-md').click();
    await expect(window.getByTestId('export-notice')).toContainText('Exporte');
    await expect(window.getByTestId('reveal-export')).toBeVisible();
    const exportFiles = readdirSync(join(companyDir, 'Exporte')).filter((n) => n.endsWith('.md'));
    expect(exportFiles.length).toBe(1);

    // TXT-Export erzeugt eine zweite Datei.
    await window.getByTestId('export-txt').click();
    await expect(window.getByTestId('export-notice')).toContainText('.txt');
    const txtFiles = readdirSync(join(companyDir, 'Exporte')).filter((n) => n.endsWith('.txt'));
    expect(txtFiles.length).toBe(1);

    // Zurueck zum Register, nach dem neuen Tag filtern.
    await window.getByTestId('detail-back').click();
    await window.getByRole('button', { name: 'wichtig', exact: true }).click();
    await expect(window.getByTestId('register-row')).toHaveCount(1);
    await expect(window.getByTestId('register-row')).toContainText('Angebot Frühling (geprüft)');
    await window.getByRole('button', { name: 'Filter zurücksetzen' }).click();
    await expect(window.getByTestId('register-row')).toHaveCount(3);

    // Soft-Delete: in den Papierkorb.
    await window.getByTestId('register-row').filter({ hasText: 'Notiz Herbst' }).click();
    await window.getByTestId('detail-delete').click();
    await window.getByTestId('confirm-yes').click();
    await expect(window.getByTestId('register-row')).toHaveCount(2);

    // Papierkorb: ein Eintrag, wiederherstellen.
    await window.getByTestId('nav-papierkorb').click();
    await expect(window.getByTestId('trash-row')).toHaveCount(1);
    await expect(window.getByTestId('trash-row')).toContainText('Notiz Herbst');
    await window.getByTestId('trash-restore').click();
    await expect(window.getByTestId('trash-empty')).toBeVisible();

    // Register: wieder drei Eintraege.
    await window.getByTestId('nav-register').click();
    await expect(window.getByTestId('register-row')).toHaveCount(3);
  } finally {
    await app.close();
  }
});

test('M7: Firmenwechsel laedt den getrennten Bestand (zwei Firmen)', async () => {
  const { app, window } = await launchApp({ withCompany: true });
  try {
    // Firma A (Testfirma GmbH aus withCompany): eine Notiz.
    await seedNote(window, 'Nur in Firma A', 'Dieser Eintrag gehört zu Firma A.');

    // Firma B anlegen (wird aktiv) und eigene Notiz.
    const second = await createTestCompany(window, 'Zweite Firma AG');
    expect(second.ok).toBe(true);
    await window.reload();
    await seedNote(window, 'Nur in Firma B', 'Dieser Eintrag gehört zu Firma B.');

    // Firma B ist aktiv: Register zeigt nur den B-Eintrag.
    await window.getByTestId('nav-register').click();
    await expect(window.getByTestId('register-row')).toHaveCount(1);
    await expect(window.getByTestId('register-row')).toContainText('Nur in Firma B');

    // Auf Firma A umschalten: Register zeigt nur den A-Eintrag.
    await window.getByRole('button', { name: 'Testfirma GmbH' }).click();
    await window.getByTestId('nav-register').click();
    await expect(window.getByTestId('register-row')).toHaveCount(1);
    await expect(window.getByTestId('register-row')).toContainText('Nur in Firma A');
  } finally {
    await app.close();
  }
});

test('M7: XSS-Probe: HTML-artiger Body wird als Text angezeigt (kein img, kein Skript)', async () => {
  const { app, window } = await launchApp({ withCompany: true });
  try {
    await expect(window.locator('h1')).toContainText('VoiceWall');
    const payload = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script> Ende';
    await seedNote(window, 'XSS-Probe', payload);

    await window.getByTestId('nav-register').click();
    await window.getByTestId('register-row').filter({ hasText: 'XSS-Probe' }).click();
    await expect(window.getByTestId('detail-panel')).toBeVisible();

    // Der Body erscheint als Text (inkl. der spitzen Klammern).
    await expect(window.getByTestId('detail-body')).toContainText('<img src=x onerror=');
    await expect(window.getByTestId('detail-body')).toContainText('<script>');

    // Aus dem Body entsteht KEIN img-Element und KEIN script-Element im Detail-DOM.
    const imgCount = await window.getByTestId('detail-body').locator('img').count();
    expect(imgCount).toBe(0);
    const scriptCount = await window.getByTestId('detail-body').locator('script').count();
    expect(scriptCount).toBe(0);

    // Kein Skript wurde ausgefuehrt (weder onerror noch inline-script).
    const xss = await window.evaluate(() => (globalThis as { __xss?: number }).__xss);
    expect(xss).toBeUndefined();
  } finally {
    await app.close();
  }
});
