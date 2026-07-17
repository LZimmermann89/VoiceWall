/**
 * E2E-Tests des Modelle-Reiters (Verwaltung):
 *
 * 1. Status-Anzeige ohne Modelle (CI-sicher, KEIN echter Download): alle
 *    vier Katalog-Modelle erscheinen mit Zweck, Größe, gekürzter SHA-256
 *    (voller Wert im title-Attribut) und Status "fehlt"; je fehlendem
 *    Modell gibt es einen Download-Knopf, Löschen-Knöpfe gibt es nicht.
 * 2. (Nur lokal mit Modellen) Löschen und Wiederherstellen mit verlinktem
 *    Modell: das nicht benötigte EN-Modell lässt sich nach Bestätigung
 *    löschen (Datei weg, Status kippt, Download-Knopf erscheint); das
 *    Modell der aktiven Firmensprache ist mit erklärender Meldung gesperrt.
 *    Ein zurückgelegtes Modell wird beim erneuten Öffnen wieder als
 *    "vorhanden und verifiziert" erkannt (voller SHA-256-Lauf).
 */
import { existsSync, linkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { MODEL_CATALOG } from '../../src/main/model/model-catalog';
import { modelsAvailableEn, multilingualModelPath } from '../integration/model-fixtures';
import { builtMainEntry, launchApp } from './launch';

interface ModelleBridge {
  voicewall: {
    deleteModel: (id: string) => Promise<{ ok: boolean; message?: string }>;
  };
}

/** Zielordner fuer den Beleg-Screenshot (Scratchpad via Env, sonst test-results). */
function screenshotDir(): string {
  const dir = process.env['VOICEWALL_E2E_SCREENSHOT_DIR'] ?? join(process.cwd(), 'test-results');
  mkdirSync(dir, { recursive: true });
  return dir;
}

test.beforeAll(() => {
  if (!existsSync(builtMainEntry)) {
    throw new Error(
      'Gebaute App fehlt (out/main/index.js). Bitte zuerst `npm run build` ausführen.',
    );
  }
});

test('Modelle-Reiter: Status-Anzeige und Download-Knopf-Zustand ohne Modelle', async () => {
  const { app, window } = await launchApp({ withCompany: true });
  try {
    await expect(window.locator('h1')).toContainText('VoiceWall');
    await window.getByTestId('nav-modelle').click();
    await expect(window.getByTestId('nav-modelle')).toHaveAttribute('aria-current', 'page');

    // Alle vier Katalog-Modelle sind gelistet.
    for (const id of ['whisper-q5', 'whisper-fp16', 'turbo-q5_0-multilingual', 'silero-vad']) {
      await expect(window.getByTestId(`model-card-${id}`)).toBeVisible();
      await expect(window.getByTestId(`model-status-${id}`)).toContainText('fehlt');
      // Fehlendes Modell: Download-Knopf vorhanden und aktiv, kein Loeschen.
      await expect(window.getByTestId(`model-download-${id}`)).toBeEnabled();
      await expect(window.getByTestId(`model-delete-${id}`)).toHaveCount(0);
    }

    // SHA-256: gekuerzte Anzeige, voller Katalogwert im title-Attribut.
    const q5Sha = window.getByTestId('model-card-whisper-q5').locator('.mono');
    await expect(q5Sha).toHaveAttribute('title', MODEL_CATALOG.whisperQ5.sha256);
    await expect(q5Sha).toContainText(MODEL_CATALOG.whisperQ5.sha256.slice(0, 16));
  } finally {
    await app.close();
  }
});

test('Modelle-Reiter: Löschen mit Bestätigung, Sperre für das aktive Modell, Wiederherstellen', async () => {
  test.skip(!modelsAvailableEn, 'Modelle (inkl. EN) nicht vorhanden, Test uebersprungen.');
  const { app, window, userDataDir } = await launchApp({ withCompany: true, linkModels: true });
  const enModelFile = join(userDataDir, 'models', MODEL_CATALOG.whisperTurboMultilingual.fileName);
  try {
    await expect(window.locator('h1')).toContainText('VoiceWall');
    await window.getByTestId('nav-modelle').click();

    // Aktive Firmensprache ist Deutsch: Q5_0 und VAD sind vorhanden, als
    // "aktiv benötigt" markiert und NICHT loeschbar (erklaerende Meldung).
    await expect(window.getByTestId('model-status-whisper-q5')).toContainText('vorhanden');
    await expect(window.getByTestId('model-delete-whisper-q5')).toHaveCount(0);
    await expect(window.getByTestId('model-locked-whisper-q5')).toBeVisible();
    await expect(window.getByTestId('model-locked-silero-vad')).toBeVisible();

    // Main-seitige Sperre (Defense in depth): direkter Loesch-Versuch des
    // aktiven Modells wird mit erklaerender Meldung abgelehnt.
    const abgelehnt = await window.evaluate(() =>
      (globalThis as unknown as ModelleBridge).voicewall.deleteModel('whisper-q5'),
    );
    expect(abgelehnt.ok).toBe(false);
    expect(abgelehnt.message ?? '').toContain('kann nicht gelöscht werden');

    // Beleg-Screenshot: der Reiter mit Status-Uebersicht.
    await window.screenshot({ path: join(screenshotDir(), 'modelle-tab.png'), fullPage: true });

    // Das EN-Modell wird nicht benoetigt (Firma diktiert Deutsch): Loeschen
    // mit Bestaetigungsdialog.
    expect(existsSync(enModelFile)).toBe(true);
    await expect(window.getByTestId('model-status-turbo-q5_0-multilingual')).toContainText(
      'vorhanden',
    );
    await window.getByTestId('model-delete-turbo-q5_0-multilingual').click();
    await expect(window.getByTestId('confirm-dialog')).toBeVisible();
    await window.getByTestId('confirm-yes').click();

    await expect(window.getByTestId('model-notice')).toContainText('gelöscht');
    await expect(window.getByTestId('model-status-turbo-q5_0-multilingual')).toContainText('fehlt');
    await expect(window.getByTestId('model-download-turbo-q5_0-multilingual')).toBeEnabled();
    expect(existsSync(enModelFile)).toBe(false);

    // Wiederherstellen ohne Netz: die Modelldatei wird zurueckgelegt
    // (Hardlink auf das lokale Original, wie ein erneuter Download) und beim
    // erneuten Oeffnen des Reiters voll gegen die SHA-256-Konstante
    // verifiziert (der Marker-Eintrag wurde beim Loeschen ausgetragen).
    linkSync(multilingualModelPath, enModelFile);
    await window.getByTestId('nav-diktat').click();
    await window.getByTestId('nav-modelle').click();
    await expect(window.getByTestId('model-status-turbo-q5_0-multilingual')).toContainText(
      'vorhanden',
      { timeout: 30_000 },
    );
    await expect(window.getByTestId('model-delete-turbo-q5_0-multilingual')).toBeVisible();
  } finally {
    await app.close();
  }
});
