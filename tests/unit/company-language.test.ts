/**
 * Unit-Tests der Diktatsprache pro Firma:
 * - Schema-Kompatibilitaet: bestehende Konfigs ohne `sprache` bleiben
 *   gueltig (Default 'de'); 'de'/'en' sind die einzigen Werte, ein von Hand
 *   eingetragener fremder Wert faellt kontrolliert auf 'de' zurueck.
 * - CompanyManager: Anlage mit Sprache, Sichtbarkeit in der Firmenliste,
 *   aktive Sprache, nachtraeglicher Wechsel (setCompanyLanguage) atomar in
 *   der firmenbezogenen Konfig, Aenderungs-Callback fuer den Orchestrator.
 */
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { companyConfigSchema } from '../../src/shared/company';
import { CompanyManager } from '../../src/main/storage/companies';
import type { Logger } from '../../src/main/log/logger';

const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

describe('companyConfigSchema.sprache (Enum, Alt-Konfig-Kompatibilitaet)', () => {
  const basis = {
    schemaVersion: 1,
    firma: {
      anzeigename: 'Müller & Söhne GmbH',
      ordnername: 'Müller & Söhne GmbH',
      ansprechpartner: '',
      email: '',
      standort: '',
      hinweis: '',
    },
    modell: 'q5_0',
    erstelltMit: 'VoiceWall 1.0.0-test',
    erstellt: '2026-07-04T10:00:00+02:00',
  };

  it('Alt-Konfig ohne sprache-Feld bleibt gueltig (Default de)', () => {
    const parsed = companyConfigSchema.parse(basis);
    expect(parsed.sprache).toBe('de');
  });

  it('akzeptiert de und en', () => {
    expect(companyConfigSchema.parse({ ...basis, sprache: 'de' }).sprache).toBe('de');
    expect(companyConfigSchema.parse({ ...basis, sprache: 'en' }).sprache).toBe('en');
  });

  it('faellt bei unbekanntem Wert kontrolliert auf de zurueck (catch)', () => {
    expect(companyConfigSchema.parse({ ...basis, sprache: 'fr' }).sprache).toBe('de');
    expect(companyConfigSchema.parse({ ...basis, sprache: 42 }).sprache).toBe('de');
  });
});

describe('CompanyManager: Diktatsprache pro Firma', () => {
  let root: string;
  let userData: string;
  let desktop: string;
  let localBase: string;
  let changedCalls: number;

  function manager(): CompanyManager {
    return new CompanyManager({
      userDataPath: userData,
      logger: silentLogger,
      appVersion: 'VoiceWall 1.0.0-test',
      resolveDesktop: () => Promise.resolve(desktop),
      localBase,
      onCompanyChanged: () => {
        changedCalls += 1;
      },
    });
  }

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'voicewall-sprache-'));
    userData = join(root, 'userdata');
    desktop = join(root, 'desktop');
    localBase = join(root, 'VoiceWall');
    changedCalls = 0;
    await mkdir(userData, { recursive: true });
    await mkdir(desktop, { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('Anlage mit Sprache en: Konfig, Firmenliste und aktive Sprache stimmen', async () => {
    const firmenverwaltung = manager();
    const created = await firmenverwaltung.createCompany(
      'English Ltd',
      'desktop',
      undefined,
      undefined,
      undefined,
      'en',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const raw = JSON.parse(
      await readFile(join(created.pfad, '.voicewall', 'config.json'), 'utf8'),
    ) as { sprache?: string };
    expect(raw.sprache).toBe('en');

    const list = await firmenverwaltung.listCompanies();
    expect(list.firmen[0]?.sprache).toBe('en');
    expect(await firmenverwaltung.activeSprache()).toBe('en');
    const kontext = await firmenverwaltung.activeDictationContext();
    expect(kontext.language).toBe('en');
  });

  it('Default ohne Sprach-Angabe bleibt de; ohne aktive Firma ebenfalls de', async () => {
    const firmenverwaltung = manager();
    expect(await firmenverwaltung.activeSprache()).toBe('de');
    const created = await firmenverwaltung.createCompany('Mandant A GmbH', 'desktop');
    expect(created.ok).toBe(true);
    expect(await firmenverwaltung.activeSprache()).toBe('de');
  });

  it('setCompanyLanguage wechselt die Sprache der aktiven Firma atomar', async () => {
    const firmenverwaltung = manager();
    const created = await firmenverwaltung.createCompany('Mandant A GmbH', 'desktop');
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    changedCalls = 0;

    const gewechselt = await firmenverwaltung.setCompanyLanguage('en');
    expect(gewechselt).toEqual({ ok: true });
    expect(changedCalls).toBeGreaterThan(0);
    expect(await firmenverwaltung.activeSprache()).toBe('en');

    // Die firmenbezogene Konfig traegt den Wert; alle uebrigen Felder bleiben.
    const raw = JSON.parse(
      await readFile(join(created.pfad, '.voicewall', 'config.json'), 'utf8'),
    ) as { sprache?: string; firma?: { anzeigename?: string } };
    expect(raw.sprache).toBe('en');
    expect(raw.firma?.anzeigename).toBe('Mandant A GmbH');

    // Und zurueck.
    expect(await firmenverwaltung.setCompanyLanguage('de')).toEqual({ ok: true });
    expect(await firmenverwaltung.activeSprache()).toBe('de');
  });

  it('setCompanyLanguage ohne aktive Firma liefert eine deutsche Fehlermeldung', async () => {
    const firmenverwaltung = manager();
    const result = await firmenverwaltung.setCompanyLanguage('en');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Keine aktive Firma');
    }
  });
});
