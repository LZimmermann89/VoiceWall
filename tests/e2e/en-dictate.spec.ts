/**
 * E2E-Tests der Diktatsprache Englisch:
 *
 * 1. (Nur lokal mit EN-Modell) Firma mit Sprache Englisch anlegen, englisches
 *    Test-WAV per PCM-Injektion durch den kompletten Diktat-Flow schicken:
 *    die Zwischenablage enthaelt plausiblen englischen Text und die
 *    automatisch gespeicherte .md-Datei traegt `sprache: en` und die
 *    Modellkennung des multilingualen Modells.
 * 2. Sprachwechsel ueber die UI (ohne Modelle lauffaehig): das Auswahlfeld
 *    in der Verwaltung stellt die aktive Firma auf Englisch um, die
 *    firmenbezogene Konfig traegt den Wert, die Statusanzeige folgt, und
 *    der Hinweis auf den ggf. noetigen Modell-Download erscheint.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type ElectronApplication } from '@playwright/test';
import { parseFrontMatter } from '../../src/shared/front-matter';
import { transcriptMetaSchema } from '../../src/shared/company';
import { modelsAvailableEn } from '../integration/model-fixtures';
import { builtMainEntry, createTestCompany, launchApp } from './launch';
import { getMainUiWindow } from './main-window';

const fixtureWav = join(import.meta.dirname, '..', 'fixtures', 'testdiktat-en.wav');

interface EnBridge {
  voicewall: {
    devMockPaste: (enabled: boolean) => Promise<{ ok: boolean }>;
    devSetAccessibility: (trusted: boolean | null) => Promise<{ ok: boolean }>;
    devDictatePcm: (pcm: ArrayBuffer) => Promise<{
      delivered: boolean;
      pasted: boolean;
      text: string | null;
      message: string | null;
    }>;
  };
}

function readClipboard(app: ElectronApplication): Promise<string> {
  return app.evaluate(({ clipboard }) => clipboard.readText());
}

/** Findet alle gespeicherten .md-Dateien unter Diktate/YYYY/MM. */
function findSavedDictates(companyDir: string): string[] {
  const diktateDir = join(companyDir, 'Diktate');
  if (!existsSync(diktateDir)) {
    return [];
  }
  const files: string[] = [];
  for (const year of readdirSync(diktateDir)) {
    for (const month of readdirSync(join(diktateDir, year))) {
      for (const file of readdirSync(join(diktateDir, year, month))) {
        if (file.endsWith('.md')) {
          files.push(join(diktateDir, year, month, file));
        }
      }
    }
  }
  return files;
}

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

test.beforeAll(() => {
  if (!existsSync(builtMainEntry)) {
    throw new Error(
      'Gebaute App fehlt (out/main/index.js). Bitte zuerst `npm run build` ausführen.',
    );
  }
});

test('EN-Firma liefert englischen Text ins Clipboard (PCM-Injektion, echtes Modell)', async () => {
  test.skip(!modelsAvailableEn, 'EN-Modell nicht vorhanden, EN-PCM-Beweis uebersprungen.');
  const { app, window, baseDir } = await launchApp({ linkModels: true, withConsent: true });
  try {
    // EN-Firma per Bruecke anlegen und die App neu laden (Verwaltung).
    const created = await createTestCompany(window, 'English Ltd', 'en');
    expect(created.ok).toBe(true);
    await window.reload();
    const uiWindow = await getMainUiWindow(app);
    await expect(uiWindow.getByTestId('company-list')).toContainText('English Ltd (EN)');
    await expect(uiWindow.getByTestId('dictation-language')).toContainText('Englisch (en)');

    await uiWindow.evaluate(() => (globalThis as unknown as EnBridge).voicewall.devMockPaste(true));
    await uiWindow.evaluate(() =>
      (globalThis as unknown as EnBridge).voicewall.devSetAccessibility(true),
    );

    // PCM injizieren: kompletter Pfad Engine (EN-Modell, language en) ->
    // Aufbereitung -> Zustellung (Clipboard, Paste-Mock, Auto-Speichern).
    const base64 = wavPcmBase64(fixtureWav);
    const result = await uiWindow.evaluate(async (b64: string) => {
      const binary = atob(b64);
      const payload = new ArrayBuffer(binary.length);
      const bytes = new Uint8Array(payload);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return (globalThis as unknown as EnBridge).voicewall.devDictatePcm(payload);
    }, base64);

    expect(result.message).toBeNull();
    expect(result.delivered).toBe(true);
    expect(result.pasted).toBe(true);
    const text = (result.text ?? '').toLowerCase();
    // Tolerant auf Schluesselwoerter statt exaktem Vergleich.
    expect(['hello', 'test'].filter((word) => text.includes(word)).length).toBeGreaterThan(1);

    // Zwischenablage enthaelt den englischen Text.
    const clipboard = (await readClipboard(app)).toLowerCase();
    expect(clipboard).toContain('hello');
    expect(clipboard).toContain('test');

    // Auto-Speichern: Front-Matter traegt sprache en und die EN-Modellkennung.
    const companyDir = join(baseDir, 'English Ltd');
    const files = findSavedDictates(companyDir);
    expect(files).toHaveLength(1);
    const parsed = parseFrontMatter(readFileSync(files[0] ?? '', 'utf8'));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const meta = transcriptMetaSchema.parse(parsed.value.meta);
      expect(meta.sprache).toBe('en');
      expect(meta.modell).toBe('whisper-large-v3-turbo-q5_0');
      expect(parsed.value.body.toLowerCase()).toContain('hello');
    }
  } finally {
    await app.close();
  }
});

test('Sprachwechsel der aktiven Firma ueber die UI (Auswahlfeld, Hinweis, Konfig)', async () => {
  const { app, window, baseDir } = await launchApp({ withCompany: true });
  try {
    const companyDir = join(baseDir, 'Testfirma GmbH');
    await expect(window.getByTestId('company-list')).toContainText('Testfirma GmbH');
    await expect(window.getByTestId('company-language-select')).toHaveValue('de');
    await expect(window.getByTestId('dictation-language')).toContainText('Deutsch (de)');

    // Auf Englisch umstellen: Hinweis auf den einmaligen Modell-Download.
    await window.getByTestId('company-language-select').selectOption('en');
    await expect(window.getByTestId('company-notice')).toContainText('574 MB');
    await expect(window.getByTestId('company-language-select')).toHaveValue('en');
    await expect(window.getByTestId('company-list')).toContainText('Testfirma GmbH (EN)');
    await expect(window.getByTestId('dictation-language')).toContainText('Englisch (en)');

    // Die firmenbezogene Konfig traegt den Wert (atomar geschrieben).
    const config = JSON.parse(
      readFileSync(join(companyDir, '.voicewall', 'config.json'), 'utf8'),
    ) as { sprache?: string };
    expect(config.sprache).toBe('en');

    // Und zurueck auf Deutsch.
    await window.getByTestId('company-language-select').selectOption('de');
    await expect(window.getByTestId('company-language-select')).toHaveValue('de');
    const zurueck = JSON.parse(
      readFileSync(join(companyDir, '.voicewall', 'config.json'), 'utf8'),
    ) as { sprache?: string };
    expect(zurueck.sprache).toBe('de');
  } finally {
    await app.close();
  }
});
