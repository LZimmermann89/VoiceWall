/**
 * Regressionstests des zentralen, serialisierten Konfig-Schreibpfads
 * (Paket B3, Entscheidung E42; Pflicht-Fix aus dem B2-Review).
 *
 * Das abgeloeste Lost-Update-Muster: mehrere Schreiber hielten je einen
 * eigenen in-memory-Stand und schrieben ihn KOMPLETT zurueck; ein Schreiber
 * mit veraltetem Stand ueberschrieb die Aenderungen der anderen (das Muster,
 * das in B2 bei setUiSprache real Firmen geloescht haette; vgl. den
 * M7-Lost-Update-Test in companies.test.ts). Der Writer serialisiert
 * stattdessen ALLE Updates (Promise-Kette) und liest vor jedem Schreiben
 * frisch: die Tests hier stellen das Wettlauf-Szenario deterministisch nach.
 */
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readGlobalConfig } from '../../src/main/config/config-store';
import { GlobalConfigWriter } from '../../src/main/config/config-writer';
import type { Logger } from '../../src/main/log/logger';

const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

let userData: string;

beforeEach(async () => {
  userData = await mkdtemp(join(tmpdir(), 'voicewall-config-writer-'));
  await mkdir(userData, { recursive: true });
});

afterEach(async () => {
  await rm(userData, { recursive: true, force: true });
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('GlobalConfigWriter (E42)', () => {
  it('Kein Lost-Update: ein langsamer Schreiber verliert die Aenderung eines schnellen nicht (B2-Review-Fix)', async () => {
    // Deterministische Nachstellung des Review-Befunds (setAufbereitung/
    // setClipboardRestore mit veraltetem in-memory-Stand): der ERSTE Read
    // haengt kuenstlich, waehrend das zweite Update bereits ansteht. Mit dem
    // alten Muster (beide lesen den Ausgangszustand, beide schreiben den
    // GESAMTEN Stand) haette der langsame Schreiber die Aenderung des
    // anderen ueberschrieben. Der Writer serialisiert: das zweite Update
    // liest erst NACH dem Schreiben des ersten.
    let readCalls = 0;
    const writer = new GlobalConfigWriter({
      userDataPath: userData,
      logger: silentLogger,
      readConfig: async () => {
        readCalls += 1;
        if (readCalls === 1) {
          await delay(150); // simulierter langsamer Disk-Read unter Last
        }
        return readGlobalConfig(userData, silentLogger);
      },
    });

    // Beide Updates starten "gleichzeitig" (ohne await dazwischen).
    const langsam = writer.update((current) => ({
      ...current,
      aufbereitung: { ...current.aufbereitung, sprachkommandos: true },
    }));
    let gesehenerZwischenstand: boolean | null = null;
    const schnell = writer.update((current) => {
      // Das zweite Update MUSS die Aenderung des ersten bereits sehen.
      gesehenerZwischenstand = current.aufbereitung.sprachkommandos;
      return { ...current, uiSprache: 'en' };
    });
    await Promise.all([langsam, schnell]);

    expect(gesehenerZwischenstand).toBe(true);
    const final = await readGlobalConfig(userData, silentLogger);
    // BEIDE Aenderungen sind persistiert: nichts wurde ueberschrieben.
    expect(final.aufbereitung.sprachkommandos).toBe(true);
    expect(final.uiSprache).toBe('en');
  });

  it('mehrere nebenlaeufige Delta-Updates verschiedener Besitzer summieren sich vollstaendig', async () => {
    // FlowController-artige Schreiber (Hotkey, Aufbereitung, UI-Sprache)
    // und CompanyManager-artige Schreiber (Firmenliste, aktive Firma) auf
    // DERSELBEN Writer-Instanz, alle parallel angestossen.
    const writer = new GlobalConfigWriter({ userDataPath: userData, logger: silentLogger });
    await Promise.all([
      writer.update((c) => ({ ...c, hotkey: { ...c.hotkey, accelerator: 'Alt+Shift+D' } })),
      writer.update((c) => ({
        ...c,
        aufbereitung: { ...c.aufbereitung, fuellwoerterEntfernen: false },
      })),
      writer.update((c) => ({ ...c, uiSprache: 'en' })),
      writer.update((c) => ({
        ...c,
        firmen: [...c.firmen, '/tmp/firma-a'],
        aktiveFirma: '/tmp/firma-a',
      })),
      writer.update((c) => ({ ...c, diktatAutoSpeichern: false })),
    ]);
    const final = await readGlobalConfig(userData, silentLogger);
    expect(final.hotkey.accelerator).toBe('Alt+Shift+D');
    expect(final.aufbereitung.fuellwoerterEntfernen).toBe(false);
    expect(final.uiSprache).toBe('en');
    expect(final.firmen).toEqual(['/tmp/firma-a']);
    expect(final.aktiveFirma).toBe('/tmp/firma-a');
    expect(final.diktatAutoSpeichern).toBe(false);
  });

  it('ein fehlgeschlagenes Update vergiftet die Kette nicht', async () => {
    const writer = new GlobalConfigWriter({ userDataPath: userData, logger: silentLogger });
    const kaputt = writer.update(() => {
      throw new Error('Mutator-Fehler (Testfall)');
    });
    await expect(kaputt).rejects.toThrow('Mutator-Fehler');
    // Das naechste Update laeuft normal weiter.
    await writer.update((c) => ({ ...c, uiSprache: 'en' }));
    const final = await readGlobalConfig(userData, silentLogger);
    expect(final.uiSprache).toBe('en');
  });
});
