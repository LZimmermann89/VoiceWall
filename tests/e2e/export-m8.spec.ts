/**
 * E2E-Tests der M8-Funktionen (ABARBEITUNG 4.7, Entscheidungen E26 bis E30):
 *
 * 1. PDF-Export (DoD-Pflichtpunkt): ein Diktat mit "Ä Ö Ü ä ö ü ß" in Titel
 *    UND Body wird als PDF exportiert; der PDF-TEXT wird extrahiert
 *    (pdf-parse, Test-only-devDependency) und die Umlaute werden darin
 *    nachgewiesen. Ein Grep auf den Roh-Inhalt reicht nicht, weil Chromium
 *    Text als komprimierte Font-Subset-Glyphen schreibt (E26).
 * 2. Stapel-Export: 2 von 3 Eintraegen per Checkbox auswaehlen, exportieren,
 *    Datei-Asserts im atomar erzeugten Unterordner `Exporte/<datum>-stapel/`.
 * 3. Volltextsuche: ein Begriff, der NUR im Body steht (hinter der
 *    160-Zeichen-Vorschau), wird mit dem Umschalter gefunden (mit Snippet),
 *    ohne Umschalter nicht.
 * 4. Verschluesselter Export: Passwort-Dialog (min. 12 Zeichen, Wiederholung),
 *    .vwenc-Datei entsteht unter Exporte/ und enthaelt keinen Klartext.
 *
 * Vollstaendig isoliert vom echten Rechner (VOICEWALL_TEST_USER_DATA,
 * VOICEWALL_TEST_BASE_DIR); Seed ueber die echte IPC-Bruecke.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { builtMainEntry, launchApp } from './launch';

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

test('M8 DoD: PDF-Export bettet echte Umlaute korrekt ein (Text-Extraktion)', async () => {
  const { app, window } = await launchApp({ withCompany: true });
  try {
    await expect(window.locator('h1')).toContainText('VoiceWall');
    // Umlaute in Titel UND Body; im Body als kompaktes Token, damit die
    // Extraktion nicht an Leerzeichen-Rekonstruktion haengt.
    await seedNote(
      window,
      'Prüfprotokoll ÄÖÜäöüß',
      'Umlaut-Probe: ÄÖÜäöüß. Grüße an Herrn Müller-Lüdenscheidt, außergewöhnlich!',
    );

    await window.getByTestId('nav-register').click();
    await window.getByTestId('register-row').filter({ hasText: 'Prüfprotokoll' }).click();
    await expect(window.getByTestId('detail-panel')).toBeVisible();

    const companyDir = await activeCompanyDir(window);
    await window.getByTestId('export-pdf').click();
    await expect(window.getByTestId('export-notice')).toContainText('.pdf', { timeout: 30_000 });

    const pdfFiles = readdirSync(join(companyDir, 'Exporte')).filter((n) => n.endsWith('.pdf'));
    expect(pdfFiles.length).toBe(1);
    const pdfPath = join(companyDir, 'Exporte', pdfFiles[0] ?? '');
    expect(statSync(pdfPath).size).toBeGreaterThan(1000);

    // DoD-Beweis: Umlaute stehen als echter Text IM PDF (Titel und Body).
    const pdf = await pdfParse(readFileSync(pdfPath));
    expect(pdf.numpages).toBeGreaterThanOrEqual(1);
    expect(pdf.text).toContain('Prüfprotokoll');
    expect(pdf.text).toContain('ÄÖÜäöüß');
    expect(pdf.text).toContain('Müller-Lüdenscheidt');
    expect(pdf.text).toContain('außergewöhnlich');

    // Keine Temp-Reste der Druckvorlage im Exporte-Ordner.
    const reste = readdirSync(join(companyDir, 'Exporte')).filter((n) =>
      n.startsWith('.voicewall-tmp-'),
    );
    expect(reste).toEqual([]);
  } finally {
    await app.close();
  }
});

test('M8: Stapel-Export: 2 von 3 Eintraegen ausgewaehlt landen im Stapel-Ordner', async () => {
  const { app, window } = await launchApp({ withCompany: true });
  try {
    await seedNote(window, 'Angebot Frühling', 'Das Angebot ist beigefügt.');
    await seedNote(window, 'Rechnung Sommer', 'Die Rechnung für Juli ist fällig.');
    await seedNote(window, 'Notiz Herbst', 'Interner Vermerk zur Nachbereitung.');

    await window.getByTestId('nav-register').click();
    await expect(window.getByTestId('register-row')).toHaveCount(3);

    // 2 von 3 auswaehlen (Checkboxen).
    const checkboxes = window.getByTestId('register-select');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await expect(window.getByTestId('batch-count')).toHaveText('2 ausgewählt');

    // Markdown (mit Kopf) exportieren.
    await window.getByTestId('batch-format').selectOption('md');
    await window.getByTestId('batch-export-selected').click();
    await expect(window.getByTestId('batch-notice')).toContainText('2 Einträge exportiert', {
      timeout: 30_000,
    });
    await expect(window.getByTestId('batch-notice')).toContainText('-stapel');
    await expect(window.getByTestId('batch-reveal')).toBeVisible();

    // Datei-Asserts: genau ein Stapel-Ordner mit genau 2 Markdown-Dateien.
    const companyDir = await activeCompanyDir(window);
    const exporte = readdirSync(join(companyDir, 'Exporte'));
    const stapelDirs = exporte.filter((n) => n.includes('-stapel'));
    expect(stapelDirs.length).toBe(1);
    const stapelFiles = readdirSync(join(companyDir, 'Exporte', stapelDirs[0] ?? ''));
    expect(stapelFiles.filter((n) => n.endsWith('.md')).length).toBe(2);
    expect(stapelFiles.every((n) => !n.startsWith('.voicewall-tmp-'))).toBe(true);
  } finally {
    await app.close();
  }
});

test('M8: Volltextsuche findet einen Begriff, der NUR im Body steht', async () => {
  const { app, window } = await launchApp({ withCompany: true });
  try {
    // Der Suchbegriff steht weit hinter der 160-Zeichen-Manifest-Vorschau:
    // die Schnellsuche kann ihn nicht finden, nur der Body-Scan.
    const fueller =
      'Dieser Bericht dokumentiert den Arbeitsstand des Projekts und beschreibt die nächsten Schritte im Detail. '.repeat(
        4,
      );
    await seedNote(window, 'Bericht Januar', `${fueller}Zauberwort: Xylofonwartung.`);
    await seedNote(window, 'Bericht Februar', 'Kurzer Vermerk ohne das gesuchte Wort.');

    await window.getByTestId('nav-register').click();
    await expect(window.getByTestId('register-row')).toHaveCount(2);

    // Ohne Volltext: kein Treffer (Begriff steht nicht in Titel/Vorschau).
    await window.getByTestId('register-search').fill('Xylofonwartung');
    await expect(window.getByTestId('register-empty')).toBeVisible();

    // Mit Volltext: genau ein Treffer inklusive Kontext-Snippet.
    await window.getByTestId('register-volltext').check();
    await expect(window.getByTestId('register-row')).toHaveCount(1);
    await expect(window.getByTestId('register-row')).toContainText('Bericht Januar');
    await expect(window.getByTestId('register-snippet')).toContainText('Xylofonwartung');

    // Umschalter aus: Treffer verschwindet wieder.
    await window.getByTestId('register-volltext').uncheck();
    await expect(window.getByTestId('register-empty')).toBeVisible();
  } finally {
    await app.close();
  }
});

test('M8: Verschluesselter Export erzeugt eine .vwenc-Datei ohne Klartext', async () => {
  const { app, window } = await launchApp({ withCompany: true });
  try {
    await seedNote(window, 'Vertraulicher Befund', 'Streng vertraulicher Inhalt KLARTEXTMARKER.');

    await window.getByTestId('nav-register').click();
    await window.getByTestId('register-row').filter({ hasText: 'Vertraulicher Befund' }).click();
    await window.getByTestId('export-encrypted').click();

    // Passwort-Dialog: Warnung sichtbar, Mindestlaenge wird erzwungen.
    await expect(window.getByTestId('password-dialog')).toBeVisible();
    await expect(window.getByTestId('password-warnung')).toContainText('unwiederbringlich');
    await window.getByTestId('password-input').fill('zu-kurz');
    await window.getByTestId('password-submit').click();
    await expect(window.getByTestId('password-error')).toContainText('mindestens 12 Zeichen');

    // Wiederholung muss uebereinstimmen.
    await window.getByTestId('password-input').fill('korrektes-passwort-123');
    await window.getByTestId('password-repeat').fill('korrektes-passwort-456');
    await window.getByTestId('password-submit').click();
    await expect(window.getByTestId('password-error')).toContainText('stimmen nicht überein');

    // Korrekt: Export laeuft, .vwenc entsteht.
    await window.getByTestId('password-repeat').fill('korrektes-passwort-123');
    await window.getByTestId('password-submit').click();
    await expect(window.getByTestId('export-notice')).toContainText('.vwenc', { timeout: 30_000 });

    const companyDir = await activeCompanyDir(window);
    const vwenc = readdirSync(join(companyDir, 'Exporte')).filter((n) => n.endsWith('.vwenc'));
    expect(vwenc.length).toBe(1);
    const raw = readFileSync(join(companyDir, 'Exporte', vwenc[0] ?? ''));
    expect(raw.subarray(0, 6).toString('ascii')).toBe('VWENC1');
    // Kein Klartext im Container.
    expect(raw.includes(Buffer.from('KLARTEXTMARKER', 'utf8'))).toBe(false);
  } finally {
    await app.close();
  }
});
