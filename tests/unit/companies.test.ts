/**
 * Unit-Tests der Mehr-Firmen-Verwaltung (M5, ABARBEITUNG 4.6):
 * - DoD-Pflichtnachweis: zwei Firmen sind PHYSISCH getrennt, Diktate der
 *   einen tauchen nie in der anderen auf.
 * - Firmenpfade aus der Konfig werden validiert (Containment gegen erlaubte
 *   Basisordner, VoiceWall-Marker); ungueltige Eintraege werden ignoriert.
 * - Auto-Speichern: Default AN, effektiv erst sobald eine Firma existiert.
 * - Diktat speichern/auflisten/suchen ueber den Manager.
 */
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CompanyManager, titleFromText } from '../../src/main/storage/companies';
import type { Logger } from '../../src/main/log/logger';
import { readGlobalConfig, writeGlobalConfig } from '../../src/main/config/config-store';
import { defaultGlobalConfig } from '../../src/shared/config';

const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

let root: string;
let userData: string;
let desktop: string;
let localBase: string;

function manager(): CompanyManager {
  return new CompanyManager({
    userDataPath: userData,
    logger: silentLogger,
    appVersion: 'VoiceWall 0.1.0-test',
    resolveDesktop: () => Promise.resolve(desktop),
    localBase,
  });
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'voicewall-firmen-'));
  userData = join(root, 'userdata');
  desktop = join(root, 'desktop');
  localBase = join(root, 'VoiceWall');
  await mkdir(userData, { recursive: true });
  await mkdir(desktop, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('CompanyManager', () => {
  it('DoD: zwei Firmen sind physisch getrennt (keine Querbezuege)', async () => {
    const firmenverwaltung = manager();
    const firmaA = await firmenverwaltung.createCompany('Mandant A GmbH', 'desktop');
    expect(firmaA.ok).toBe(true);
    const savedA = await firmenverwaltung.saveDictate({
      text: 'Vertrauliches Diktat fuer Mandant A.',
      dauerSekunden: 10,
      quelle: 'diktat',
      modell: 'whisper-large-v3-turbo-german-q5_0',
    });
    expect(savedA.ok).toBe(true);

    const firmaB = await firmenverwaltung.createCompany('Mandant B GmbH', 'desktop');
    expect(firmaB.ok).toBe(true);
    const savedB = await firmenverwaltung.saveDictate({
      text: 'Anderes Diktat fuer Mandant B.',
      dauerSekunden: 5,
      quelle: 'diktat',
      modell: 'whisper-large-v3-turbo-german-q5_0',
    });
    expect(savedB.ok).toBe(true);

    // Aktive Firma ist B: die Liste zeigt NUR B-Diktate.
    const listB = await firmenverwaltung.listDictates({});
    expect(listB.ok).toBe(true);
    if (listB.ok) {
      expect(listB.eintraege.length).toBe(1);
      expect(listB.eintraege[0]?.titel).toContain('Mandant B');
    }

    // Wechsel auf A: NUR A-Diktate, nie B.
    if (!firmaA.ok) {
      return;
    }
    expect((await firmenverwaltung.setActiveCompany(firmaA.pfad)).ok).toBe(true);
    const listA = await firmenverwaltung.listDictates({});
    expect(listA.ok).toBe(true);
    if (listA.ok) {
      expect(listA.eintraege.length).toBe(1);
      expect(listA.eintraege[0]?.titel).toContain('Mandant A');
      expect(listA.eintraege.some((entry) => entry.titel.includes('Mandant B'))).toBe(false);
    }

    // Physische Trennung auf Dateiebene: Ordner A enthaelt keine B-Datei.
    const collect = async (dir: string): Promise<string[]> => {
      const results: string[] = [];
      const walk = async (rel: string): Promise<void> => {
        for (const entry of await readdir(join(dir, rel), { withFileTypes: true })) {
          const relPath = `${rel}/${entry.name}`;
          if (entry.isDirectory()) {
            await walk(relPath);
          } else {
            results.push(relPath);
          }
        }
      };
      await walk('');
      return results;
    };
    if (!firmaB.ok) {
      return;
    }
    const filesA = await collect(firmaA.pfad);
    const filesB = await collect(firmaB.pfad);
    expect(filesA.some((file) => file.includes('mandant-b'))).toBe(false);
    expect(filesB.some((file) => file.includes('mandant-a'))).toBe(false);
  });

  it('ignoriert manipulierte Firmenpfade in der globalen Konfig', async () => {
    const firmenverwaltung = manager();
    const created = await firmenverwaltung.createCompany('Echte GmbH', 'desktop');
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    // Konfig manipulieren: Traversal, fremder Ort, Nicht-VoiceWall-Ordner.
    const fremd = join(root, 'fremd');
    await mkdir(fremd, { recursive: true });
    const config = await readGlobalConfig(userData, silentLogger);
    await writeGlobalConfig(userData, {
      ...config,
      firmen: [
        created.pfad,
        '/etc',
        join(desktop, '..', 'ausserhalb'),
        fremd,
        'relativ/kein-absoluter-pfad',
        join(desktop, 'geloescht-existiert-nicht'),
      ],
    });

    // Neuer Manager (frischer Konfig-Cache): nur der echte Eintrag bleibt.
    const list = await manager().listCompanies();
    expect(list.firmen.map((firma) => firma.pfad)).toEqual([created.pfad]);
    expect(list.firmen[0]?.anzeigename).toBe('Echte GmbH');
  });

  it('Auto-Speichern: Default AN, effektiv erst mit existierender Firma', async () => {
    const firmenverwaltung = manager();
    // Ohne Firma: Schalter steht auf AN, effektiv aber aus.
    expect(await firmenverwaltung.isAutoSaveEnabled()).toBe(false);
    expect((await readGlobalConfig(userData, silentLogger)).diktatAutoSpeichern).toBe(true);

    const created = await firmenverwaltung.createCompany('Auto GmbH', 'desktop');
    expect(created.ok).toBe(true);
    expect(await firmenverwaltung.isAutoSaveEnabled()).toBe(true);

    await firmenverwaltung.setAutoSave(false);
    expect(await firmenverwaltung.isAutoSaveEnabled()).toBe(false);
  });

  it('saveDictate ohne aktive Firma liefert ein Fehler-Result', async () => {
    const result = await manager().saveDictate({
      text: 'Text ohne Firma.',
      dauerSekunden: 1,
      quelle: 'diktat',
      modell: 'm',
    });
    expect(result.ok).toBe(false);
  });

  it('setActiveCompany verweigert Pfade ausserhalb der validierten Liste', async () => {
    const firmenverwaltung = manager();
    await firmenverwaltung.createCompany('Einzige GmbH', 'desktop');
    const result = await firmenverwaltung.setActiveCompany(join(root, 'fremd'));
    expect(result.ok).toBe(false);
  });

  it('previewName liefert den sanitisierten Ordnernamen', () => {
    const preview = manager().previewName('Müller & Söhne GmbH');
    expect(preview).toEqual({ ok: true, ordnername: 'Müller & Söhne GmbH' });
    expect(manager().previewName('NUL').ok).toBe(false);
  });

  it('Strategie lokal-mit-verknuepfung legt den Ordner unter ~/VoiceWall an', async () => {
    const firmenverwaltung = manager();
    const created = await firmenverwaltung.createCompany('Lokal GmbH', 'lokal-mit-verknuepfung');
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.pfad.startsWith(localBase)).toBe(true);
    if (process.platform !== 'win32') {
      // Verknuepfung liegt auf dem Desktop und zeigt auf den lokalen Ordner.
      expect(created.verknuepfungHinweis).toContain('Verknuepfung');
      const desktopEntries = await readdir(desktop);
      expect(desktopEntries).toContain('Lokal GmbH');
    }
    // Diktate landen im lokalen Ordner, nicht auf dem Desktop.
    const saved = await firmenverwaltung.saveDictate({
      text: 'Lokales Diktat.',
      dauerSekunden: 2,
      quelle: 'diktat',
      modell: 'm5',
    });
    expect(saved.ok).toBe(true);
  });

  it('openCompany validiert, migriert und heilt das Manifest', async () => {
    const firmenverwaltung = manager();
    const created = await firmenverwaltung.createCompany('Restore GmbH', 'desktop');
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    await firmenverwaltung.saveDictate({
      text: 'Wiederzufindendes Diktat.',
      dauerSekunden: 3,
      quelle: 'diktat',
      modell: 'm5',
    });
    // Manifest zerstoeren (simulierter Transport-Schaden).
    await writeFile(join(created.pfad, '.voicewall', 'manifest.json'), '{kaputt');

    // Frischer Manager mit leerer Konfig (simulierter neuer Rechner).
    await writeGlobalConfig(userData, defaultGlobalConfig());
    const neu = manager();
    expect((await neu.openCompany(created.pfad)).ok).toBe(true);
    const list = await neu.listDictates({});
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.eintraege.length).toBe(1);
      expect(list.eintraege[0]?.titel).toContain('Wiederzufindendes');
    }
  });

  it('titleFromText nimmt die ersten Worte (max. 60 Zeichen)', () => {
    expect(titleFromText('Sehr geehrter Herr Müller, vielen Dank.')).toBe(
      'Sehr geehrter Herr Müller, vielen Dank.',
    );
    expect(titleFromText('')).toBe('Diktat');
    expect(Array.from(titleFromText('Wort '.repeat(50))).length).toBeLessThanOrEqual(60);
  });
});
