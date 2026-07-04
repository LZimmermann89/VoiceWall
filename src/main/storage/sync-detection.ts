/**
 * Sync-Fallen-Erkennung (M5, Risiko R8, Prioritaet 3 der Empfehlungen).
 *
 * Das Kernversprechen "100 Prozent lokal" bricht still, wenn der gewaehlte
 * Speicherort von einem Cloud-Sync-Dienst erfasst wird:
 * - macOS iCloud Drive mit "Schreibtisch & Dokumente": der Desktop liegt
 *   dann PHYSISCH unter `~/Library/Mobile Documents/com~apple~CloudDocs/Desktop`
 *   (deshalb wird der Zielpfad vor der Mustererkennung per realpath
 *   aufgeloest, um Symlink-/Redirect-Faelle zu erfassen).
 * - Windows OneDrive Known-Folder-Move: der echte Desktop-Pfad (aus der
 *   Registry, siehe paths.ts/M4) enthaelt dann ein `OneDrive`-Segment;
 *   zusaetzlich werden die OneDrive-Umgebungsvariablen als Praefix geprueft.
 * - Dropbox und Google Drive: Pfadmuster.
 *
 * Verhalten laut Dokument: ERKENNEN und WARNEN, plus beide Strategien als
 * API anbieten (die Entscheidung trifft spaeter der Wizard-Nutzer):
 *   a) Desktop trotz Sync verwenden (bewusste Entscheidung), oder
 *   b) Diktate in einen bewusst NICHT synchronisierten lokalen Pfad legen
 *      (`~/VoiceWall/` direkt unter dem Home-Verzeichnis; `~/Documents`
 *      scheidet aus, weil macOS Dokumente ebenfalls in iCloud legen kann)
 *      und auf dem Desktop nur eine Verknuepfung anlegen (macOS/Linux:
 *      Symlink; Windows: Directory-Junction, privilegienfrei, siehe
 *      docs/ENTSCHEIDUNGEN.md E15 - kein PowerShell-.lnk, kein Shell-Aufruf).
 */
import { mkdir, realpath as fsRealpath, lstat, readlink, symlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, posix, resolve, win32 } from 'node:path';
import { texte } from '../i18n';
import { err, ok, type Result } from '../../shared/result';

export type SyncProvider = 'icloud' | 'onedrive' | 'dropbox' | 'google-drive';

export interface SyncCheckResult {
  readonly synchronisiert: boolean;
  readonly anbieter: SyncProvider | null;
  /** Deutsche Warnung mit naechstem Schritt, sonst null. */
  readonly hinweis: string | null;
}

/** Injektionspunkte fuer Unit-Tests (Pfade, Plattform, Env). */
export interface SyncDetectionDeps {
  readonly platform: NodeJS.Platform;
  readonly homedir: () => string;
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Loest Symlinks/Redirects auf (Fehler -> Eingabepfad unveraendert). */
  readonly realpath: (path: string) => Promise<string>;
}

export function defaultSyncDeps(): SyncDetectionDeps {
  return {
    platform: process.platform,
    homedir,
    env: process.env,
    realpath: async (path: string) => {
      try {
        return await fsRealpath(path);
      } catch {
        return path;
      }
    },
  };
}

const PROVIDER_LABELS: Record<SyncProvider, string> = {
  icloud: 'iCloud Drive',
  onedrive: 'OneDrive',
  dropbox: 'Dropbox',
  'google-drive': 'Google Drive',
};

/** Normalisiert fuer die Mustererkennung: NFC, Kleinbuchstaben, `/`-Trenner. */
function comparablePath(path: string): string {
  return path.normalize('NFC').toLocaleLowerCase('en-US').replace(/\\/g, '/');
}

/** Prueft, ob ein Pfad ein bestimmtes Segment (case-insensitiv) enthaelt. */
function hasSegmentContaining(path: string, fragment: string): boolean {
  return comparablePath(path)
    .split('/')
    .some((segment) => segment.includes(fragment));
}

function detectProviderByPattern(realPath: string): SyncProvider | null {
  const comparable = comparablePath(realPath);
  if (
    comparable.includes('library/mobile documents') ||
    comparable.includes('com~apple~clouddocs')
  ) {
    return 'icloud';
  }
  if (hasSegmentContaining(realPath, 'onedrive')) {
    return 'onedrive';
  }
  if (hasSegmentContaining(realPath, 'dropbox')) {
    return 'dropbox';
  }
  if (
    comparable.includes('google drive') ||
    comparable.includes('googledrive') ||
    comparable.includes('/my drive') ||
    comparable.includes('/meine ablage')
  ) {
    return 'google-drive';
  }
  return null;
}

/** Baut die deutsche Warnung fuer einen erkannten Sync-Anbieter. */
function buildHinweis(provider: SyncProvider): string {
  return texte().firmen.syncWarnung(PROVIDER_LABELS[provider]);
}

/**
 * Prueft, ob ein Zielpfad von Cloud-Sync betroffen ist. Der Pfad wird zuerst
 * per realpath aufgeloest (erkennt den iCloud-Desktop-Redirect auch dann,
 * wenn `~/Desktop` nur ein Verweis ist), danach laufen Muster- und
 * Env-Praefix-Pruefungen.
 */
export async function checkSyncExposure(
  targetPath: string,
  deps: SyncDetectionDeps = defaultSyncDeps(),
): Promise<SyncCheckResult> {
  // Pfadmodul anhand der INJIZIERTEN Plattform waehlen, nicht anhand des
  // Hosts: sonst wuerde der Windows-CI-Runner injizierte POSIX-Pfade mit
  // Laufwerksbuchstaben aufloesen (und umgekehrt) und die Praefix-Vergleiche
  // liefen ins Leere.
  const p = deps.platform === 'win32' ? win32 : posix;
  const realPath = await deps.realpath(p.resolve(targetPath));

  let provider = detectProviderByPattern(realPath);

  // Windows: OneDrive-Umgebungsvariablen als Praefix-Beleg (Known Folder
  // Move kann Ordnernamen lokalisieren, das Muster allein reicht nicht).
  if (provider === null) {
    const oneDriveRoots = ['OneDrive', 'OneDriveCommercial', 'OneDriveConsumer']
      .map((name) => deps.env[name])
      .filter((value): value is string => value !== undefined && value.length > 0);
    const comparableTarget = comparablePath(realPath);
    if (
      oneDriveRoots.some((root) => {
        const comparableRoot = comparablePath(p.resolve(root));
        return (
          comparableTarget === comparableRoot || comparableTarget.startsWith(`${comparableRoot}/`)
        );
      })
    ) {
      provider = 'onedrive';
    }
  }

  // macOS: iCloud-Desktop-Sync erkennen, auch wenn der Zielpfad selbst noch
  // nicht existiert: liegt der REALE Desktop unter Mobile Documents, ist
  // jeder Desktop-Zielpfad betroffen.
  if (provider === null && deps.platform === 'darwin') {
    const desktop = p.join(deps.homedir(), 'Desktop');
    const comparableTarget = comparablePath(realPath);
    const comparableDesktop = comparablePath(p.resolve(desktop));
    if (
      comparableTarget === comparableDesktop ||
      comparableTarget.startsWith(`${comparableDesktop}/`)
    ) {
      const realDesktop = await deps.realpath(desktop);
      provider = detectProviderByPattern(realDesktop);
    }
  }

  if (provider === null) {
    return { synchronisiert: false, anbieter: null, hinweis: null };
  }
  return { synchronisiert: true, anbieter: provider, hinweis: buildHinweis(provider) };
}

/**
 * Der bewusst NICHT synchronisierte lokale Basisordner: `~/VoiceWall/`.
 * Direkt unter dem Home-Verzeichnis, weil weder iCloud noch OneDrive das
 * Home-Wurzelverzeichnis selbst synchronisieren (im Gegensatz zu Desktop,
 * Documents und Bildern).
 */
export function localStorageBaseDir(deps: SyncDetectionDeps = defaultSyncDeps()): string {
  return join(deps.homedir(), 'VoiceWall');
}

/** Legt den lokalen Basisordner an (idempotent, POSIX 0700). */
export async function ensureLocalBaseDir(
  deps: SyncDetectionDeps = defaultSyncDeps(),
): Promise<Result<string, string>> {
  const base = localStorageBaseDir(deps);
  try {
    await mkdir(base, { recursive: true, mode: 0o700 });
    return ok(base);
  } catch (error) {
    return err(
      texte().firmen.lokalerOrdnerFehler(error instanceof Error ? error.message : String(error)),
    );
  }
}

export interface DesktopLinkOptions {
  /** Absoluter Pfad des echten Firmenordners (Ziel der Verknuepfung). */
  readonly targetDir: string;
  /** Desktop-Ordner, auf dem die Verknuepfung liegen soll. */
  readonly desktopDir: string;
  /** Name der Verknuepfung (typisch: der Ordnername der Firma). */
  readonly linkName: string;
}

/**
 * Legt auf dem Desktop eine Verknuepfung auf den echten (lokalen)
 * Firmenordner an. macOS/Linux: Symlink; Windows: Directory-Junction
 * (privilegienfrei, kein Developer-Mode noetig; Entscheidung E15).
 * Idempotent: zeigt eine bestehende Verknuepfung bereits auf das Ziel, ist
 * das ein Erfolg. Es wird NIE etwas ueberschrieben oder geloescht.
 */
export async function createDesktopLink(
  options: DesktopLinkOptions,
  platform: NodeJS.Platform = process.platform,
): Promise<Result<string, string>> {
  const linkPath = join(options.desktopDir, options.linkName);
  const target = resolve(options.targetDir);

  try {
    const existing = await lstat(linkPath);
    if (existing.isSymbolicLink()) {
      try {
        const currentTarget = resolve(join(options.desktopDir), await readlink(linkPath));
        if (currentTarget.normalize('NFC') === target.normalize('NFC')) {
          return ok(linkPath); // Idempotent: Verknuepfung existiert korrekt.
        }
      } catch {
        // readlink fehlgeschlagen: unten als Kollision behandeln.
      }
    }
    return err(texte().firmen.verknuepfungKollision(options.linkName));
  } catch {
    // lstat fehlgeschlagen: Pfad ist frei, Verknuepfung anlegen.
  }

  try {
    await symlink(target, linkPath, platform === 'win32' ? 'junction' : 'dir');
    return ok(linkPath);
  } catch (error) {
    return err(
      texte().firmen.verknuepfungFehler(error instanceof Error ? error.message : String(error)),
    );
  }
}
