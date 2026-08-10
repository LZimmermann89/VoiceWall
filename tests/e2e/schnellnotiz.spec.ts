/**
 * E2E-Test der Schnellnotiz: Diktat, das NUR gespeichert und nirgends
 * eingefuegt wird.
 *
 * Vollstaendig isoliert vom echten Rechner (VOICEWALL_TEST_USER_DATA,
 * VOICEWALL_TEST_BASE_DIR).
 *
 * Belegt werden die drei Zusagen des Modus:
 * 1. Die Notiz landet als wohlgeformte .md-Datei im Firmenordner, genau wie
 *    ein normales Diktat (gleiche Struktur, gleiches Front-Matter).
 * 2. Es wird NICHTS eingefuegt: der Paste-Zaehler bleibt bei null, obwohl das
 *    Einfuegen technisch moeglich waere (Bedienungshilfen freigegeben,
 *    Paste gemockt). Das ist der eigentliche Unterschied zum Diktat und
 *    deshalb der wichtigste Teil dieses Tests.
 * 3. Ohne eingerichtete Firma geht der Text nicht verloren: die Zustellung
 *    meldet den Grund, statt still zu verschlucken.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  expect,
  test,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { transcriptMetaSchema } from '../../src/shared/company';
import { parseFrontMatter } from '../../src/shared/front-matter';
import { getMainUiWindow } from './main-window';

const projectRoot = join(import.meta.dirname, '../..');
const builtMainEntry = join(projectRoot, 'out/main/index.js');

interface NoteBridge {
  voicewall: {
    createCompany: (
      name: string,
      strategie: 'desktop' | 'lokal-mit-verknuepfung',
    ) => Promise<{ ok: boolean; pfad?: string; message?: string }>;
    listDictates: (filter: {
      text?: string;
    }) => Promise<
      | { ok: true; eintraege: { titel: string; vorschau: string }[] }
      | { ok: false; message: string }
    >;
    devMockPaste: (enabled: boolean) => Promise<{ ok: boolean }>;
    devSetAccessibility: (trusted: boolean | null) => Promise<{ ok: boolean }>;
    devGetPasteCalls: () => Promise<number>;
    devRunNoteResult: (text: string) => Promise<{ ok: boolean; message?: string }>;
  };
}

function bridge(window: Page): NoteBridge['voicewall'] {
  return {
    createCompany: (name, strategie) =>
      window.evaluate(
        (args: { name: string; strategie: 'desktop' | 'lokal-mit-verknuepfung' }) =>
          (globalThis as unknown as NoteBridge).voicewall.createCompany(args.name, args.strategie),
        { name, strategie },
      ),
    listDictates: (filter) =>
      window.evaluate(
        (f: { text?: string }) => (globalThis as unknown as NoteBridge).voicewall.listDictates(f),
        filter,
      ),
    devMockPaste: (enabled) =>
      window.evaluate(
        (e: boolean) => (globalThis as unknown as NoteBridge).voicewall.devMockPaste(e),
        enabled,
      ),
    devSetAccessibility: (trusted) =>
      window.evaluate(
        (t: boolean | null) =>
          (globalThis as unknown as NoteBridge).voicewall.devSetAccessibility(t),
        trusted,
      ),
    devGetPasteCalls: () =>
      window.evaluate(() => (globalThis as unknown as NoteBridge).voicewall.devGetPasteCalls()),
    devRunNoteResult: (text) =>
      window.evaluate(
        (t: string) => (globalThis as unknown as NoteBridge).voicewall.devRunNoteResult(t),
        text,
      ),
  };
}

test.beforeAll(() => {
  if (!existsSync(builtMainEntry)) {
    throw new Error(
      'Gebaute App fehlt (out/main/index.js). Bitte zuerst `npm run build` ausführen.',
    );
  }
});

test('Schnellnotiz speichert die Notiz und fuegt garantiert nichts ein', async () => {
  const testRoot = mkdtempSync(join(tmpdir(), 'voicewall-e2e-notiz-'));
  mkdirSync(join(testRoot, 'desktop'), { recursive: true });
  const app: ElectronApplication = await electron.launch({
    args: [builtMainEntry],
    cwd: projectRoot,
    env: {
      ...process.env,
      VOICEWALL_ENABLE_TEST_IPC: '1',
      VOICEWALL_TEST_USER_DATA: join(testRoot, 'userdata'),
      VOICEWALL_TEST_BASE_DIR: join(testRoot, 'desktop'),
    },
  });
  try {
    const window = await getMainUiWindow(app);
    const api = bridge(window);

    // Einfuegen waere ab hier technisch moeglich: Freigabe gesetzt, Paste
    // gemockt. Genau deshalb ist der Zaehler unten aussagekraeftig.
    await api.devSetAccessibility(true);
    await api.devMockPaste(true);

    // 1. Ohne Firma darf nichts still verschwinden: die Zustellung meldet den
    //    Grund (der Text landet im Produktivpfad zusaetzlich in der
    //    Zwischenablage, siehe deliverAsNote).
    const ohneFirma = await api.devRunNoteResult('Notiz ohne eingerichtete Firma');
    expect(ohneFirma.ok).toBe(false);
    expect(ohneFirma.message ?? '').not.toBe('');

    // 2. Mit Firma wird die Notiz gespeichert.
    const created = await api.createCompany('Notiz Testfirma', 'desktop');
    expect(created.ok).toBe(true);
    const companyDir = created.pfad ?? '';
    expect(companyDir).not.toBe('');

    const gespeichert = await api.devRunNoteResult(
      'Rueckruf bei Frau Weber wegen der Terrassenueberdachung.',
    );
    expect(gespeichert.ok).toBe(true);

    // 3. Die Datei liegt an derselben Stelle und ist wohlgeformt wie bei einem
    //    normalen Diktat: Diktate/JAHR/MONAT/<datum>_<zeit>_<titel>.md
    const diktateDir = join(companyDir, 'Diktate');
    const yearDirs = readdirSync(diktateDir).filter((entry) => /^\d{4}$/.test(entry));
    expect(yearDirs.length).toBe(1);
    const monthDir = join(
      diktateDir,
      yearDirs[0] ?? '',
      readdirSync(join(diktateDir, yearDirs[0] ?? ''))[0] ?? '',
    );
    const mdFiles = readdirSync(monthDir).filter((file) => file.endsWith('.md'));
    expect(mdFiles.length).toBe(1);

    const raw = readFileSync(join(monthDir, mdFiles[0] ?? ''), 'utf8');
    const parsed = parseFrontMatter(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const meta = transcriptMetaSchema.parse(parsed.value.meta);
      expect(meta.quelle).toBe('diktat');
      expect(meta.version).toBe(1);
      expect(parsed.value.body).toContain('Frau Weber');
    }

    // 4. Der Kern des Modus: NICHTS wurde eingefuegt.
    expect(await api.devGetPasteCalls()).toBe(0);

    // 5. Die Notiz ist ueber die normale Suche auffindbar, sie ist ein
    //    vollwertiger Eintrag im Bestand.
    const found = await api.listDictates({ text: 'Terrassenueberdachung' });
    expect(found.ok).toBe(true);
    if (found.ok) {
      expect(found.eintraege.length).toBe(1);
    }
  } finally {
    await app.close();
  }
});
