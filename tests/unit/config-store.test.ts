/**
 * Unit-Tests des Konfig-Stores: Defaults bei fehlender/kaputter Datei,
 * Roundtrip, Erhalt unbekannter Felder (Kompatibilitaet) und Datei-Rechte.
 */
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readGlobalConfig, writeGlobalConfig } from '../../src/main/config/config-store';
import { DEFAULT_HOTKEY_ACCELERATOR, defaultGlobalConfig } from '../../src/shared/config';
import type { Logger } from '../../src/main/log/logger';

const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'voicewall-config-'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('config-store', () => {
  it('liefert Defaults, wenn keine Datei existiert', async () => {
    const config = await readGlobalConfig(dir, silentLogger);
    expect(config.hotkey.accelerator).toBe(DEFAULT_HOTKEY_ACCELERATOR);
    expect(config.clipboard.restorePrevious).toBe(true);
  });

  it('liefert Defaults bei kaputtem JSON und bei ungueltigem Inhalt', async () => {
    await writeFile(join(dir, 'config.json'), '{kaputt');
    expect((await readGlobalConfig(dir, silentLogger)).hotkey.accelerator).toBe(
      DEFAULT_HOTKEY_ACCELERATOR,
    );

    await writeFile(
      join(dir, 'config.json'),
      JSON.stringify({ schemaVersion: 1, hotkey: { accelerator: 'D' }, clipboard: {} }),
    );
    expect((await readGlobalConfig(dir, silentLogger)).hotkey.accelerator).toBe(
      DEFAULT_HOTKEY_ACCELERATOR,
    );
  });

  it('Roundtrip erhaelt Werte und unbekannte Felder (0600-Rechte)', async () => {
    const config = {
      ...defaultGlobalConfig(),
      hotkey: { accelerator: 'CommandOrControl+Alt+D', zukunft: 'bleibt' },
      erweiterung: { later: true },
    };
    await writeGlobalConfig(dir, config);

    const info = await stat(join(dir, 'config.json'));
    // Nur Owner darf lesen/schreiben (0600). POSIX-only: Windows kennt keine
    // POSIX-Modi (fs liefert dort 0666), der Schutz kommt vom nutzerprivaten
    // Profilordner.
    if (process.platform !== 'win32') {
      expect(info.mode & 0o777).toBe(0o600);
    }

    const loaded = await readGlobalConfig(dir, silentLogger);
    expect(loaded.hotkey.accelerator).toBe('CommandOrControl+Alt+D');
    expect(loaded).toMatchObject({
      hotkey: { zukunft: 'bleibt' },
      erweiterung: { later: true },
    });

    const rawOnDisk = JSON.parse(await readFile(join(dir, 'config.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(rawOnDisk['erweiterung']).toEqual({ later: true });
  });
});
