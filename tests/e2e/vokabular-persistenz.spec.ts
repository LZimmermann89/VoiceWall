/**
 * E2E-Beweise zum Praxistest-Befund "Wörterbuch speichert/wirkt nicht"
 * (Entscheidung E45):
 *
 * 1. Persistenz über den echten Fluss: Einträge über die UI anlegen und
 *    speichern -> vokabular.json der aktiven Firma enthält sie ->
 *    Ansicht wechseln und zurück -> Einträge weiterhin in der UI ->
 *    App komplett neu starten (gleiches userData) -> Einträge weiterhin da.
 * 2. Prompt-Anwendungs-Beweis (nur lokal mit Modellen): nach dem Speichern
 *    erhält das nächste Diktat den Initial-Prompt mit den Begriffen; der
 *    zuletzt an den Whisper-Worker gesendete Kontext wird über den
 *    Test-IPC-Kanal dev:get-last-context ausgelesen.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { modelsAvailable } from '../integration/model-fixtures';
import { builtMainEntry, launchApp } from './launch';

const fixtureWav = join(import.meta.dirname, '..', 'fixtures', 'testdiktat-de.wav');

interface PersistenzBridge {
  voicewall: {
    saveVokabular: (input: {
      begriffe: string[];
      ersetzungen: { von: string; zu: string }[];
    }) => Promise<{ ok: boolean; message?: string }>;
    devMockPaste: (enabled: boolean) => Promise<{ ok: boolean }>;
    devSetAccessibility: (trusted: boolean | null) => Promise<{ ok: boolean }>;
    devDictatePcm: (pcm: ArrayBuffer) => Promise<{
      delivered: boolean;
      pasted: boolean;
      text: string | null;
      message: string | null;
    }>;
    devGetLastContext: () => Promise<{ language: string; prompt: string | null } | null>;
  };
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

test('Wörterbuch-Persistenz: UI-Speichern überlebt Ansichtswechsel und App-Neustart', async () => {
  const first = await launchApp({ withCompany: true });
  const { testRoot, baseDir } = first;
  const vokabularPath = join(baseDir, 'Testfirma GmbH', '.voicewall', 'vokabular.json');
  try {
    const window = first.window;
    await expect(window.locator('h1')).toContainText('VoiceWall');

    // Begriff und Ersetzungsregel ueber die ECHTE UI anlegen und speichern.
    await window.getByTestId('vocab-begriff-input').fill('Blauwal-Akte');
    await window.getByTestId('vocab-add-begriff').click();
    await window.getByTestId('vocab-von-input').fill('blaut');
    await window.getByTestId('vocab-zu-input').fill('Plaud');
    await window.getByTestId('vocab-add-ersetzung').click();
    // Vor dem Speichern: sichtbare "noch nicht gespeichert"-Warnung (E45).
    await expect(window.getByTestId('vocab-dirty')).toBeVisible();
    await window.getByTestId('vocab-save').click();
    await expect(window.getByTestId('vocab-notice')).toContainText('gespeichert');
    await expect(window.getByTestId('vocab-dirty')).toHaveCount(0);

    // Beweis 1: die Datei der aktiven Firma enthaelt die Eintraege.
    expect(existsSync(vokabularPath)).toBe(true);
    const gespeichert = JSON.parse(readFileSync(vokabularPath, 'utf8')) as {
      begriffe: string[];
      ersetzungen: { von: string; zu: string }[];
    };
    expect(gespeichert.begriffe).toEqual(['Blauwal-Akte']);
    expect(gespeichert.ersetzungen).toEqual([{ von: 'blaut', zu: 'Plaud' }]);

    // Beweis 2: Ansicht wechseln und zurueck -> die UI laedt den Bestand neu.
    await window.getByTestId('nav-register').click();
    await expect(window.getByTestId('nav-register')).toHaveAttribute('aria-current', 'page');
    await window.getByTestId('nav-diktat').click();
    await expect(window.getByTestId('vocab-begriffe')).toContainText('Blauwal-Akte');
    await expect(window.getByTestId('vocab-ersetzungen')).toContainText('blaut');
  } finally {
    await first.app.close();
  }

  // Beweis 3: kompletter App-Neustart mit demselben userData/Firmenordner.
  const second = await launchApp({ reuseTestRoot: testRoot });
  try {
    const window = second.window;
    await expect(window.locator('h1')).toContainText('VoiceWall');
    await expect(window.getByTestId('vocab-begriffe')).toContainText('Blauwal-Akte');
    await expect(window.getByTestId('vocab-ersetzungen')).toContainText('blaut');
    expect(existsSync(vokabularPath)).toBe(true);
  } finally {
    await second.app.close();
  }
});

test('Prompt-Beweis: gespeicherte Begriffe erreichen den Whisper-Worker als Initial-Prompt', async () => {
  test.skip(!modelsAvailable, 'Modelle nicht vorhanden, Prompt-Beweis uebersprungen.');
  const { app, window } = await launchApp({ withCompany: true, linkModels: true });
  try {
    await expect(window.locator('h1')).toContainText('VoiceWall');

    // Begriffe speichern (ueber die IPC-Bruecke, der UI-Weg ist oben belegt).
    const saved = await window.evaluate(() =>
      (globalThis as unknown as PersistenzBridge).voicewall.saveVokabular({
        begriffe: ['VoiceWall', 'Blauwal-Akte'],
        ersetzungen: [],
      }),
    );
    expect(saved.ok).toBe(true);

    await window.evaluate(() =>
      (globalThis as unknown as PersistenzBridge).voicewall.devMockPaste(true),
    );
    await window.evaluate(() =>
      (globalThis as unknown as PersistenzBridge).voicewall.devSetAccessibility(true),
    );

    // Naechstes Diktat (PCM-Injektion durch die echte Engine).
    const base64 = wavPcmBase64(fixtureWav);
    const result = await window.evaluate(async (b64: string) => {
      const binary = atob(b64);
      const payload = new ArrayBuffer(binary.length);
      const bytes = new Uint8Array(payload);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return (globalThis as unknown as PersistenzBridge).voicewall.devDictatePcm(payload);
    }, base64);
    expect(result.delivered).toBe(true);

    // Der zuletzt an den Worker gesendete Kontext traegt Sprache und Prompt
    // mit den gespeicherten Begriffen (deterministischer Beweis, E45).
    const context = await window.evaluate(() =>
      (globalThis as unknown as PersistenzBridge).voicewall.devGetLastContext(),
    );
    expect(context).not.toBeNull();
    expect(context?.language).toBe('de');
    expect(context?.prompt).toContain('VoiceWall');
    expect(context?.prompt).toContain('Blauwal-Akte');
  } finally {
    await app.close();
  }
});
