/**
 * Unit-Tests der Sync-Fallen-Erkennung mit injizierten
 * Pfaden: iCloud (inkl. Desktop-Redirect ueber realpath), OneDrive (Muster
 * plus Env-Praefix), Dropbox, Google Drive, lokale Alternativ-Strategie
 * (~/VoiceWall) und Desktop-Verknuepfung (Symlink, idempotent, nie
 * ueberschreiben).
 */
import { mkdir, mkdtemp, rm, realpath, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkSyncExposure,
  createDesktopLink,
  ensureLocalBaseDir,
  localStorageBaseDir,
  type SyncDetectionDeps,
} from '../../src/main/storage/sync-detection';

const isWindows = process.platform === 'win32';

function deps(overrides: Partial<SyncDetectionDeps>): SyncDetectionDeps {
  return {
    platform: 'darwin',
    homedir: () => '/Users/kunde',
    env: {},
    realpath: (path: string) => Promise.resolve(path),
    ...overrides,
  };
}

describe('checkSyncExposure (injizierte Pfade)', () => {
  it('erkennt iCloud Drive am Mobile-Documents-Pfad', async () => {
    const result = await checkSyncExposure(
      '/Users/kunde/Library/Mobile Documents/com~apple~CloudDocs/Desktop',
      deps({}),
    );
    expect(result.synchronisiert).toBe(true);
    expect(result.anbieter).toBe('icloud');
    expect(result.hinweis).toContain('iCloud');
    expect(result.hinweis).toContain('VoiceWall');
  });

  it('erkennt den iCloud-Desktop-Redirect ueber realpath (~/Desktop ist umgeleitet)', async () => {
    // Der Zielpfad sieht harmlos aus; erst realpath enttarnt die Umleitung.
    const result = await checkSyncExposure(
      '/Users/kunde/Desktop/Firma GmbH',
      deps({
        realpath: (path: string) =>
          Promise.resolve(
            path.replace(
              '/Users/kunde/Desktop',
              '/Users/kunde/Library/Mobile Documents/com~apple~CloudDocs/Desktop',
            ),
          ),
      }),
    );
    expect(result.synchronisiert).toBe(true);
    expect(result.anbieter).toBe('icloud');
  });

  it('erkennt iCloud auch, wenn nur der REALE Desktop umgeleitet ist (Zielpfad existiert noch nicht)', async () => {
    const result = await checkSyncExposure(
      '/Users/kunde/Desktop/Neue Firma',
      deps({
        realpath: (path: string) =>
          Promise.resolve(
            path === '/Users/kunde/Desktop'
              ? '/Users/kunde/Library/Mobile Documents/com~apple~CloudDocs/Desktop'
              : path, // Zielpfad selbst existiert nicht, realpath laesst ihn stehen.
          ),
      }),
    );
    expect(result.synchronisiert).toBe(true);
    expect(result.anbieter).toBe('icloud');
  });

  it('erkennt OneDrive an Pfadmustern (auch Business-Varianten)', async () => {
    const business = await checkSyncExposure(
      'C:\\Users\\kunde\\OneDrive - Firma GmbH\\Desktop',
      deps({ platform: 'win32', homedir: () => 'C:\\Users\\kunde' }),
    );
    expect(business.synchronisiert).toBe(true);
    expect(business.anbieter).toBe('onedrive');
  });

  it('erkennt OneDrive ueber die Umgebungsvariable als Praefix', async () => {
    const result = await checkSyncExposure(
      '/Users/kunde/Cloudordner/Desktop',
      deps({ env: { OneDrive: '/Users/kunde/Cloudordner' } }),
    );
    expect(result.synchronisiert).toBe(true);
    expect(result.anbieter).toBe('onedrive');
  });

  it('erkennt Dropbox und Google Drive an Pfadmustern', async () => {
    expect((await checkSyncExposure('/Users/kunde/Dropbox/Arbeit', deps({}))).anbieter).toBe(
      'dropbox',
    );
    expect((await checkSyncExposure('/Users/kunde/Google Drive/Ablage', deps({}))).anbieter).toBe(
      'google-drive',
    );
    expect(
      (
        await checkSyncExposure(
          'G:\\My Drive\\Firmen',
          deps({ platform: 'win32', homedir: () => 'C:\\Users\\kunde' }),
        )
      ).anbieter,
    ).toBe('google-drive');
  });

  it('meldet unsynchronisierte Pfade als sauber', async () => {
    const result = await checkSyncExposure('/Users/kunde/VoiceWall/Firma GmbH', deps({}));
    expect(result.synchronisiert).toBe(false);
    expect(result.anbieter).toBeNull();
    expect(result.hinweis).toBeNull();
  });
});

describe('lokale Alternativ-Strategie (~/VoiceWall)', () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'voicewall-sync-home-'));
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  it('localStorageBaseDir liegt direkt unter dem Home-Verzeichnis', () => {
    expect(localStorageBaseDir(deps({ homedir: () => '/Users/kunde' }))).toBe(
      join('/Users/kunde', 'VoiceWall'),
    );
  });

  it('ensureLocalBaseDir legt den Ordner idempotent mit 0700 an', async () => {
    const testDeps = deps({ homedir: () => home });
    const first = await ensureLocalBaseDir(testDeps);
    const second = await ensureLocalBaseDir(testDeps);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const info = await stat(first.value);
    expect(info.isDirectory()).toBe(true);
    if (!isWindows) {
      expect(info.mode & 0o777).toBe(0o700);
    }
  });

  it.skipIf(isWindows)(
    'createDesktopLink legt einen Symlink an, ist idempotent und ueberschreibt nie',
    async () => {
      const desktop = join(home, 'Desktop');
      const target = join(home, 'VoiceWall', 'Firma GmbH');
      await mkdir(desktop, { recursive: true });
      await mkdir(target, { recursive: true });

      // Anlage: der Symlink zeigt auf den echten Ordner.
      const created = await createDesktopLink({
        targetDir: target,
        desktopDir: desktop,
        linkName: 'Firma GmbH',
      });
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }
      expect(await realpath(created.value)).toBe(await realpath(target));

      // Idempotent: erneuter Aufruf ist ein Erfolg, kein Fehler.
      const again = await createDesktopLink({
        targetDir: target,
        desktopDir: desktop,
        linkName: 'Firma GmbH',
      });
      expect(again.ok).toBe(true);

      // Kollision mit fremdem Eintrag: Fehler-Result, nichts wird angefasst.
      await writeFile(join(desktop, 'fremd.txt'), 'inhalt');
      const collision = await createDesktopLink({
        targetDir: target,
        desktopDir: desktop,
        linkName: 'fremd.txt',
      });
      expect(collision.ok).toBe(false);
      expect(await stat(join(desktop, 'fremd.txt'))).toBeTruthy();
    },
  );
});
