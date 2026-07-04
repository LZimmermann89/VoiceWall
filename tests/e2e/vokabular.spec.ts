/**
 * E2E-Tests des Fach-Woerterbuchs und der Textaufbereitung (Stufe 1):
 *
 * 1. Woerterbuch-Editor: Ersetzungsregel ueber die UI anlegen und speichern;
 *    vokabular.json entsteht atomar im Firmenordner; Aufbereitungs-Schalter
 *    aendern und in der globalen Konfig persistieren.
 * 2. Diktat-Zustellung: mit gesetzter Ersetzungsregel und aktivem
 *    Fuellwoerter-Filter enthaelt die Zwischenablage den korrigierten Text
 *    und die automatisch gespeicherte .md-Datei ebenso (Wortzahl zaehlt den
 *    finalen Text).
 * 3. (Nur lokal mit Modellen) Kompletter Diktat-Flow per PCM-Injektion:
 *    Engine-Transkript -> Ersetzung "Voice Wall" -> "VoiceWall" ->
 *    Zwischenablage und gespeicherte .md enthalten den korrigierten Text.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type ElectronApplication } from '@playwright/test';
import { parseFrontMatter } from '../../src/shared/front-matter';
import { transcriptMetaSchema } from '../../src/shared/company';
import { modelsAvailable } from '../integration/model-fixtures';
import { builtMainEntry, launchApp } from './launch';

const fixtureWav = join(import.meta.dirname, '..', 'fixtures', 'testdiktat-de.wav');

interface VokabularBridge {
  voicewall: {
    getVokabular: () => Promise<
      | { ok: true; vokabular: { begriffe: string[]; ersetzungen: { von: string; zu: string }[] } }
      | { ok: false; message: string }
    >;
    saveVokabular: (input: {
      begriffe: string[];
      ersetzungen: { von: string; zu: string }[];
    }) => Promise<{ ok: boolean; message?: string }>;
    devMockPaste: (enabled: boolean) => Promise<{ ok: boolean }>;
    devSetAccessibility: (trusted: boolean | null) => Promise<{ ok: boolean }>;
    devRunDictationResult: (
      text: string,
    ) => Promise<{ delivered: boolean; pasted: boolean; message: string | null }>;
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

/** Findet die einzige gespeicherte .md-Datei unter Diktate/YYYY/MM. */
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

test('Stufe 1: Wörterbuch-Editor, Schalter-Persistenz und korrigierte Zustellung', async () => {
  const { app, window, userDataDir, baseDir } = await launchApp({ withCompany: true });
  const companyDir = join(baseDir, 'Testfirma GmbH');
  try {
    await expect(window.locator('h1')).toContainText('VoiceWall');

    // 1. Ersetzungsregel ueber die UI anlegen und speichern.
    await window.getByTestId('vocab-von-input').fill('Voice Wall');
    await window.getByTestId('vocab-zu-input').fill('VoiceWall');
    await window.getByTestId('vocab-add-ersetzung').click();
    await window.getByTestId('vocab-begriff-input').fill('VoiceWall');
    await window.getByTestId('vocab-add-begriff').click();
    await window.getByTestId('vocab-save').click();
    await expect(window.getByTestId('vocab-notice')).toContainText('gespeichert');

    // Die Datei liegt auditierbar im Firmenordner (atomar geschrieben).
    const vokabularPath = join(companyDir, '.voicewall', 'vokabular.json');
    expect(existsSync(vokabularPath)).toBe(true);
    const gespeichert = JSON.parse(readFileSync(vokabularPath, 'utf8')) as {
      schemaVersion: number;
      begriffe: string[];
      ersetzungen: { von: string; zu: string }[];
    };
    expect(gespeichert.schemaVersion).toBe(1);
    expect(gespeichert.begriffe).toEqual(['VoiceWall']);
    expect(gespeichert.ersetzungen).toEqual([{ von: 'Voice Wall', zu: 'VoiceWall' }]);

    // Roundtrip ueber die IPC-Bruecke.
    const geladen = await window.evaluate(() =>
      (globalThis as unknown as VokabularBridge).voicewall.getVokabular(),
    );
    expect(geladen).toMatchObject({ ok: true });

    // 2. Aufbereitungs-Schalter: Defaults (Fuellwoerter AN, Kommandos AUS),
    // Aenderung persistiert in der globalen Konfig.
    await expect(window.getByTestId('switch-fuellwoerter')).toBeChecked();
    await expect(window.getByTestId('switch-sprachkommandos')).not.toBeChecked();
    // click statt check: die Checkbox ist React-kontrolliert und aendert
    // ihren Zustand erst nach dem IPC-Roundtrip (Status-Broadcast).
    await window.getByTestId('switch-sprachkommandos').click();
    await expect(window.getByTestId('switch-sprachkommandos')).toBeChecked();
    await expect
      .poll(() => {
        const config = JSON.parse(readFileSync(join(userDataDir, 'config.json'), 'utf8')) as {
          aufbereitung?: { fuellwoerterEntfernen: boolean; sprachkommandos: boolean };
        };
        return config.aufbereitung;
      })
      .toEqual({ fuellwoerterEntfernen: true, sprachkommandos: true });
    // Zuruecksetzen (der Zustellungs-Test unten laeuft mit Kommandos AUS).
    await window.getByTestId('switch-sprachkommandos').click();
    await expect(window.getByTestId('switch-sprachkommandos')).not.toBeChecked();

    // 3. Zustellung: Ersetzungsliste + Fuellwoerter-Filter wirken vor
    // Zwischenablage und Speicherung.
    await window.evaluate(() =>
      (globalThis as unknown as VokabularBridge).voicewall.devMockPaste(true),
    );
    await window.evaluate(() =>
      (globalThis as unknown as VokabularBridge).voicewall.devSetAccessibility(true),
    );

    const delivery = await window.evaluate(
      (text: string) =>
        (globalThis as unknown as VokabularBridge).voicewall.devRunDictationResult(text),
      'Das ist äh ein Test mit Voice Wall.',
    );
    expect(delivery.delivered).toBe(true);
    expect(delivery.pasted).toBe(true);

    // Zwischenablage: Fuellwort entfernt, Ersetzung angewendet.
    expect(await readClipboard(app)).toBe('Das ist ein Test mit VoiceWall.');

    // Gespeicherte .md: enthaelt den korrigierten Text; die Wortzahl im
    // Front-Matter zaehlt den finalen Text (6 Woerter).
    const saved = findSavedDictates(companyDir);
    expect(saved).toHaveLength(1);
    const raw = readFileSync(saved[0] ?? '', 'utf8');
    const parsed = parseFrontMatter(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const meta = transcriptMetaSchema.parse(parsed.value.meta);
      expect(parsed.value.body).toContain('VoiceWall');
      expect(parsed.value.body).not.toContain('Voice Wall');
      expect(parsed.value.body).not.toContain('äh');
      expect(meta.wortzahl).toBe(6);
    }
  } finally {
    await app.close();
  }
});

test('Stufe 1: Diktat-Flow per PCM-Injektion mit Ersetzungsregel (echtes Modell)', async () => {
  test.skip(!modelsAvailable, 'Modelle nicht vorhanden, PCM-Beweis uebersprungen.');
  const { app, window, baseDir } = await launchApp({ withCompany: true, linkModels: true });
  const companyDir = join(baseDir, 'Testfirma GmbH');
  try {
    await expect(window.locator('h1')).toContainText('VoiceWall');

    // Ersetzungsregel setzen (bewusst OHNE Begriffe: die Korrektur unten ist
    // damit eindeutig der Ersetzungsliste zuzuordnen, nicht dem Prompt).
    const saved = await window.evaluate(() =>
      (globalThis as unknown as VokabularBridge).voicewall.saveVokabular({
        begriffe: [],
        ersetzungen: [{ von: 'Voice Wall', zu: 'VoiceWall' }],
      }),
    );
    expect(saved.ok).toBe(true);

    await window.evaluate(() =>
      (globalThis as unknown as VokabularBridge).voicewall.devMockPaste(true),
    );
    await window.evaluate(() =>
      (globalThis as unknown as VokabularBridge).voicewall.devSetAccessibility(true),
    );

    // PCM injizieren: kompletter Pfad Engine -> Ersetzung -> Aufbereitung ->
    // Zustellung (Clipboard, Paste-Mock, Auto-Speichern).
    const base64 = wavPcmBase64(fixtureWav);
    const result = await window.evaluate(async (b64: string) => {
      const binary = atob(b64);
      const payload = new ArrayBuffer(binary.length);
      const bytes = new Uint8Array(payload);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return (globalThis as unknown as VokabularBridge).voicewall.devDictatePcm(payload);
    }, base64);

    expect(result.message).toBeNull();
    expect(result.delivered).toBe(true);
    expect(result.pasted).toBe(true);
    expect(result.text).toContain('VoiceWall');
    expect(result.text).not.toContain('Voice Wall');

    // Zwischenablage enthaelt den korrigierten Text.
    expect(await readClipboard(app)).toContain('VoiceWall');

    // Auto-Speichern: die .md-Datei enthaelt den korrigierten Text.
    const files = findSavedDictates(companyDir);
    expect(files).toHaveLength(1);
    const raw = readFileSync(files[0] ?? '', 'utf8');
    expect(raw).toContain('VoiceWall');
    expect(raw).not.toContain('Voice Wall');
  } finally {
    await app.close();
  }
});
