/**
 * E2E-Test der Firmenverwaltung und des Diktat-Speichers (M5, DoD Punkt 5):
 *
 * Vollstaendig isoliert vom echten Rechner: userData und der Firmen-Basis-
 * ordner zeigen auf temporaere Testverzeichnisse (VOICEWALL_TEST_USER_DATA,
 * VOICEWALL_TEST_BASE_DIR; beide nur in ungepackten Dev-Builds wirksam).
 *
 * Belegt werden:
 * 1. Firma anlegen ueber die Test-UI-Bruecke (Vorschau + Anlage), Struktur
 *    entsteht im Test-Basisordner.
 * 2. Diktat-Flow mit aktivierter Firma (Auto-Speichern Default AN):
 *    devRunDictationResult speichert eine .md-Datei unter Diktate/YYYY/MM.
 * 3. Die Datei ist wohlgeformt: Front-Matter parsebar und schema-gueltig
 *    (id, titel, erstellt mit Zeitzone, quelle diktat, version 1).
 * 4. Liste/Schnellsuche findet das Diktat (und eine zweite Firma sieht es
 *    NICHT: physische Trennung ueber die IPC-Flaeche).
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

interface CompanyBridge {
  voicewall: {
    listCompanies: () => Promise<{
      firmen: { pfad: string; anzeigename: string; aktiv: boolean }[];
      aktiveFirma: string | null;
      autoSpeichern: boolean;
    }>;
    previewCompanyName: (
      name: string,
    ) => Promise<{ ok: true; ordnername: string } | { ok: false; message: string }>;
    createCompany: (
      name: string,
      strategie: 'desktop' | 'lokal-mit-verknuepfung',
    ) => Promise<{ ok: boolean; pfad?: string; ordnername?: string; message?: string }>;
    setActiveCompany: (pfad: string) => Promise<{ ok: boolean; message?: string }>;
    listDictates: (filter: {
      text?: string;
    }) => Promise<
      | { ok: true; eintraege: { id: string; pfad: string; titel: string; vorschau: string }[] }
      | { ok: false; message: string }
    >;
    devMockPaste: (enabled: boolean) => Promise<{ ok: boolean }>;
    devSetAccessibility: (trusted: boolean | null) => Promise<{ ok: boolean }>;
    devRunDictationResult: (
      text: string,
    ) => Promise<{ delivered: boolean; pasted: boolean; message: string | null }>;
  };
}

function bridge(window: Page): CompanyBridge['voicewall'] {
  return {
    listCompanies: () =>
      window.evaluate(() => (globalThis as unknown as CompanyBridge).voicewall.listCompanies()),
    previewCompanyName: (name) =>
      window.evaluate(
        (n: string) => (globalThis as unknown as CompanyBridge).voicewall.previewCompanyName(n),
        name,
      ),
    createCompany: (name, strategie) =>
      window.evaluate(
        (args: { name: string; strategie: 'desktop' | 'lokal-mit-verknuepfung' }) =>
          (globalThis as unknown as CompanyBridge).voicewall.createCompany(
            args.name,
            args.strategie,
          ),
        { name, strategie },
      ),
    setActiveCompany: (pfad) =>
      window.evaluate(
        (p: string) => (globalThis as unknown as CompanyBridge).voicewall.setActiveCompany(p),
        pfad,
      ),
    listDictates: (filter) =>
      window.evaluate(
        (f: { text?: string }) =>
          (globalThis as unknown as CompanyBridge).voicewall.listDictates(f),
        filter,
      ),
    devMockPaste: (enabled) =>
      window.evaluate(
        (e: boolean) => (globalThis as unknown as CompanyBridge).voicewall.devMockPaste(e),
        enabled,
      ),
    devSetAccessibility: (trusted) =>
      window.evaluate(
        (t: boolean | null) =>
          (globalThis as unknown as CompanyBridge).voicewall.devSetAccessibility(t),
        trusted,
      ),
    devRunDictationResult: (text) =>
      window.evaluate(
        (t: string) => (globalThis as unknown as CompanyBridge).voicewall.devRunDictationResult(t),
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

test('M5: Firma anlegen, Diktat-Flow speichert wohlgeformte .md, Suche findet sie, Firmen sind getrennt', async () => {
  const testRoot = mkdtempSync(join(tmpdir(), 'voicewall-e2e-m5-'));
  // Basisordner (der "Desktop" des Tests) VOR dem Start anlegen.
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
    await expect(window.locator('h1')).toContainText('VoiceWall');
    const api = bridge(window);

    // 1. Vorschau (Wizard-Schritt) und Anlage der Firma.
    const preview = await api.previewCompanyName('Müller & Söhne GmbH');
    expect(preview).toEqual({ ok: true, ordnername: 'Müller & Söhne GmbH' });

    const created = await api.createCompany('Müller & Söhne GmbH', 'desktop');
    expect(created.ok).toBe(true);
    const companyDir = created.pfad ?? '';
    expect(companyDir.length).toBeGreaterThan(0);
    expect(existsSync(join(companyDir, '.voicewall', 'manifest.json'))).toBe(true);

    // Auto-Speichern ist Default AN, sobald eine Firma existiert.
    const list = await api.listCompanies();
    expect(list.autoSpeichern).toBe(true);
    expect(list.aktiveFirma).toBe(companyDir);

    // 2. Diktat-Flow (Zustellung mit Paste-Mock): Auto-Speichern greift.
    expect((await api.devMockPaste(true)).ok).toBe(true);
    expect((await api.devSetAccessibility(true)).ok).toBe(true);
    const transcript = 'Sehr geehrter Herr Müller, das Angebot ist geprüft und freigegeben.';
    const delivery = await api.devRunDictationResult(transcript);
    expect(delivery.delivered).toBe(true);
    expect(delivery.pasted).toBe(true);

    // 3. Die .md-Datei existiert unter Diktate/YYYY/MM und ist wohlgeformt.
    const year = String(new Date().getFullYear());
    const yearDir = join(companyDir, 'Diktate', year);
    expect(existsSync(yearDir)).toBe(true);
    const monthDirs = readdirSync(yearDir);
    expect(monthDirs.length).toBe(1);
    const monthDir = join(yearDir, monthDirs[0] ?? '');
    const mdFiles = readdirSync(monthDir).filter((file) => file.endsWith('.md'));
    expect(mdFiles.length).toBe(1);
    expect(mdFiles[0]).toMatch(/^\d{4}-\d{2}-\d{2}_\d{6}_[a-z0-9-]+\.md$/);

    const raw = readFileSync(join(monthDir, mdFiles[0] ?? ''), 'utf8');
    const parsed = parseFrontMatter(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const meta = transcriptMetaSchema.parse(parsed.value.meta);
      expect(meta.quelle).toBe('diktat');
      expect(meta.version).toBe(1);
      expect(meta.sprache).toBe('de');
      expect(meta.erstellt).toMatch(/(Z|[+-]\d{2}:\d{2})$/);
      expect(parsed.value.body).toContain('Angebot ist geprüft');
    }

    // 4. Schnellsuche findet das Diktat ueber die IPC-Flaeche.
    const found = await api.listDictates({ text: 'freigegeben' });
    expect(found.ok).toBe(true);
    if (found.ok) {
      expect(found.eintraege.length).toBe(1);
      expect(found.eintraege[0]?.vorschau).toContain('Sehr geehrter Herr Müller');
    }
    const missed = await api.listDictates({ text: 'gibt-es-nicht-xyz' });
    expect(missed.ok && missed.eintraege.length).toBe(0);

    // Physische Trennung: zweite Firma sieht das Diktat der ersten NICHT.
    const second = await api.createCompany('Beispiel AG', 'desktop');
    expect(second.ok).toBe(true);
    const secondList = await api.listDictates({});
    expect(secondList.ok && secondList.eintraege.length).toBe(0);

    // Zurueckwechseln: das Diktat der ersten Firma ist wieder da.
    expect((await api.setActiveCompany(companyDir)).ok).toBe(true);
    const firstAgain = await api.listDictates({});
    expect(firstAgain.ok && firstAgain.eintraege.length).toBe(1);

    // Die Test-UI zeigt die Firmenliste (minimale M5-UI).
    await window.reload();
    await expect(window.getByTestId('company-list')).toContainText('Müller & Söhne GmbH');
  } finally {
    await app.close();
  }
});
