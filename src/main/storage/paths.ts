/**
 * Aufloesung des Desktop-Basisordners (fuer den Firmenordner).
 *
 * macOS/Linux: `os.homedir()/Desktop` mit Existenz-Pruefung.
 *
 * Windows: Der Desktop kann umgeleitet sein (OneDrive "Known Folder Move",
 * Gruppenrichtlinien, manuelle Verschiebung). `%USERPROFILE%\Desktop` waere
 * dann falsch. Deshalb wird der Known-Folder-Pfad aus der Registry gelesen:
 *
 *   reg query "HKCU\...\Explorer\User Shell Folders" /v Desktop
 *
 * Entscheidung (dokumentiert): `reg.exe` per `execFile` mit Argument-Array
 * statt eines PowerShell-Einzeilers ([Environment]::GetFolderPath('Desktop')).
 * Gruende: reg.exe ist auf jedem unterstuetzten Windows vorhanden, startet in
 * Millisekunden (PowerShell braucht 1-2 s Kaltstart), beruehrt keine
 * ExecutionPolicy und der Aufruf ist ein statisches Argument-Array ohne jede
 * Interpolation (Command-Injection strukturell ausgeschlossen).
 * `%USERPROFILE%\Desktop` dient nur als Fallback, wenn der Registry-Weg
 * scheitert.
 *
 * Existiert am Ende kein Desktop-Ordner, liefert die Funktion ein
 * Fehler-Result: die UI (Wizard) fragt dann nach einem Zielordner, statt
 * still einen falschen Pfad zu verwenden.
 */
import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { texte } from '../i18n';
import { err, ok, type Result } from '../../shared/result';

const execFileAsync = promisify(execFile);

/** Injektionspunkte fuer Unit-Tests (Plattform, Home, Env, reg-Aufruf). */
export interface DesktopDirDeps {
  readonly platform: NodeJS.Platform;
  readonly homedir: () => string;
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Fuehrt `reg query` aus und liefert stdout (nur win32). */
  readonly queryRegistry: () => Promise<string>;
  /** Prueft, ob ein Pfad ein existierendes Verzeichnis ist. */
  readonly isDirectory: (path: string) => Promise<boolean>;
}

const REGISTRY_KEY =
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders';

function defaultDeps(): DesktopDirDeps {
  return {
    platform: process.platform,
    homedir,
    env: process.env,
    queryRegistry: async () => {
      // Statisches Argument-Array, keine Shell, keine Interpolation.
      const { stdout } = await execFileAsync('reg.exe', ['query', REGISTRY_KEY, '/v', 'Desktop']);
      return stdout;
    },
    isDirectory: async (path: string) => {
      try {
        return (await stat(path)).isDirectory();
      } catch {
        return false;
      }
    },
  };
}

/**
 * Extrahiert den Desktop-Pfad aus der `reg query`-Ausgabe und expandiert
 * `%VARIABLE%`-Platzhalter (der Wert ist REG_EXPAND_SZ, typischerweise
 * `%USERPROFILE%\Desktop`). Unbekannte Variablen lassen die Expansion
 * scheitern (null), damit nie ein Pfad mit rohem `%...%` entsteht.
 */
export function parseRegistryDesktopValue(
  stdout: string,
  env: Readonly<Record<string, string | undefined>>,
): string | null {
  const match = /^\s*Desktop\s+REG(?:_EXPAND)?_SZ\s+(.+?)\s*$/im.exec(stdout);
  const rawValue = match?.[1];
  if (rawValue === undefined || rawValue.length === 0) {
    return null;
  }
  // Erst pruefen, ob JEDE %VARIABLE% aufloesbar ist (nie ein Pfad mit rohem
  // oder leer expandiertem Platzhalter), dann expandieren.
  for (const placeholder of rawValue.matchAll(/%([^%]+)%/g)) {
    const name = placeholder[1] ?? '';
    if (env[name] === undefined && env[name.toUpperCase()] === undefined) {
      return null;
    }
  }
  return rawValue.replace(
    /%([^%]+)%/g,
    (_whole, name: string) => env[name] ?? env[name.toUpperCase()] ?? '',
  );
}

const desktopMissingMessage = (): string => texte().firmen.desktopFehlt;

/**
 * Liefert den absoluten Pfad des Desktop-Ordners oder ein Fehler-Result,
 * damit die UI nachfragen kann (nie ein stiller, falscher Default).
 */
export async function resolveDesktopDir(
  deps: DesktopDirDeps = defaultDeps(),
): Promise<Result<string, string>> {
  if (deps.platform === 'win32') {
    // Primaer: Known-Folder-Pfad aus der Registry (beruecksichtigt
    // OneDrive-/GPO-Umleitungen des Desktops).
    try {
      const stdout = await deps.queryRegistry();
      const fromRegistry = parseRegistryDesktopValue(stdout, deps.env);
      if (fromRegistry !== null && (await deps.isDirectory(fromRegistry))) {
        return ok(fromRegistry);
      }
    } catch {
      // reg.exe fehlgeschlagen: unten der USERPROFILE-Fallback.
    }
    // Fallback: %USERPROFILE%\Desktop, nur wenn er wirklich existiert.
    const userProfile = deps.env['USERPROFILE'];
    if (userProfile !== undefined) {
      const fallback = join(userProfile, 'Desktop');
      if (await deps.isDirectory(fallback)) {
        return ok(fallback);
      }
    }
    return err(desktopMissingMessage());
  }

  // macOS (und Linux-Dev-Umgebungen): ~/Desktop mit Existenz-Pruefung.
  const desktop = join(deps.homedir(), 'Desktop');
  if (await deps.isDirectory(desktop)) {
    return ok(desktop);
  }
  return err(desktopMissingMessage());
}
