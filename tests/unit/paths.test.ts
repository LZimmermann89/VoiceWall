/**
 * Tests der Desktop-Ordner-Aufloesung: macOS-Homedir-Pfad,
 * Windows-Known-Folder ueber die Registry (inkl. REG_EXPAND_SZ-Expansion),
 * USERPROFILE-Fallback und Fehler-Result bei fehlendem Desktop.
 */
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  parseRegistryDesktopValue,
  resolveDesktopDir,
  type DesktopDirDeps,
} from '../../src/main/storage/paths';

let sandbox: string;

beforeAll(async () => {
  sandbox = await mkdtemp(join(tmpdir(), 'voicewall-paths-'));
});

afterAll(async () => {
  await rm(sandbox, { recursive: true, force: true });
});

function deps(overrides: Partial<DesktopDirDeps>): DesktopDirDeps {
  return {
    platform: 'darwin',
    homedir: () => sandbox,
    env: {},
    queryRegistry: () => Promise.reject(new Error('nicht konfiguriert')),
    isDirectory: () => Promise.resolve(false),
    ...overrides,
  };
}

const REG_OUTPUT = [
  '',
  'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders',
  '    Desktop    REG_EXPAND_SZ    %USERPROFILE%\\Desktop',
  '',
].join('\r\n');

describe('parseRegistryDesktopValue', () => {
  it('parst REG_EXPAND_SZ und expandiert %USERPROFILE%', () => {
    const value = parseRegistryDesktopValue(REG_OUTPUT, {
      USERPROFILE: 'C:\\Users\\lars',
    });
    expect(value).toBe('C:\\Users\\lars\\Desktop');
  });

  it('parst einen umgeleiteten OneDrive-Pfad (REG_SZ, kein Platzhalter)', () => {
    const output = '    Desktop    REG_SZ    D:\\OneDrive\\Desktop\r\n';
    expect(parseRegistryDesktopValue(output, {})).toBe('D:\\OneDrive\\Desktop');
  });

  it('liefert null bei unaufloesbarer Variablen (nie roher %...%-Pfad)', () => {
    expect(parseRegistryDesktopValue(REG_OUTPUT, {})).toBeNull();
  });

  it('liefert null bei leerer/unerwarteter Ausgabe', () => {
    expect(parseRegistryDesktopValue('', {})).toBeNull();
    expect(parseRegistryDesktopValue('ERROR: not found', {})).toBeNull();
  });
});

describe('resolveDesktopDir: macOS', () => {
  it('liefert ~/Desktop, wenn er existiert', async () => {
    const desktop = join(sandbox, 'Desktop');
    await mkdir(desktop, { recursive: true });
    const result = await resolveDesktopDir(
      deps({ isDirectory: (p) => Promise.resolve(p === desktop) }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(desktop);
    }
  });

  it('liefert ein Fehler-Result, wenn ~/Desktop fehlt (UI fragt nach)', async () => {
    const result = await resolveDesktopDir(deps({ homedir: () => join(sandbox, 'leer') }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Desktop');
    }
  });
});

describe('resolveDesktopDir: Windows', () => {
  it('nutzt den Registry-Known-Folder (inkl. Umleitung)', async () => {
    const oneDriveDesktop = 'D:\\OneDrive\\Desktop';
    const result = await resolveDesktopDir(
      deps({
        platform: 'win32',
        env: { USERPROFILE: 'C:\\Users\\lars' },
        queryRegistry: () => Promise.resolve('    Desktop    REG_SZ    D:\\OneDrive\\Desktop\r\n'),
        isDirectory: (p) => Promise.resolve(p === oneDriveDesktop),
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(oneDriveDesktop);
    }
  });

  it('faellt auf %USERPROFILE%\\Desktop zurueck, wenn reg query scheitert', async () => {
    const fallback = join('C:\\Users\\lars', 'Desktop');
    const result = await resolveDesktopDir(
      deps({
        platform: 'win32',
        env: { USERPROFILE: 'C:\\Users\\lars' },
        queryRegistry: () => Promise.reject(new Error('reg.exe fehlgeschlagen')),
        isDirectory: (p) => Promise.resolve(p === fallback),
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(fallback);
    }
  });

  it('liefert ein Fehler-Result, wenn weder Registry noch Fallback existieren', async () => {
    const result = await resolveDesktopDir(
      deps({
        platform: 'win32',
        env: { USERPROFILE: 'C:\\Users\\lars' },
        queryRegistry: () => Promise.resolve(REG_OUTPUT),
        isDirectory: () => Promise.resolve(false),
      }),
    );
    expect(result.ok).toBe(false);
  });
});
