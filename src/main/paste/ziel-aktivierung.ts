/**
 * Holt eine benannte Anwendung nach vorne, damit das anschliessende Einfuegen
 * dort landet ("... an Word senden").
 *
 * Harte Sicherheitsregeln, dieselben wie beim Paste-Adapter:
 * - Ausnahmslos `execFile` mit Argument-Array, nie `exec`, nie Shell-Strings.
 * - Der Transkript-Text geht NIE in eine Kommandozeile. Uebergeben wird
 *   ausschliesslich ein Anwendungsbezeichner aus dem einkompilierten Katalog
 *   (shared/zielanwendung.ts), niemals etwas aus dem Diktat.
 * - Das PowerShell-Kommando ist ein statisches Literal. Der Programmname
 *   kommt ueber eine Umgebungsvariable hinein, nicht ueber Zeichenkonkatenation:
 *   so bleibt das Kommando unveraenderlich, egal was im Katalog steht.
 *
 * Bewusste Entscheidung gegen Apple Events auf macOS: `tell application ... to
 * activate` waere der naheliegende Weg, loest aber pro Ziel-Anwendung einen
 * eigenen Automatisierungs-Dialog des Betriebssystems aus. `open -a` erreicht
 * dasselbe ohne diese zusaetzliche Freigabe. VoiceWall bleibt damit bei genau
 * einer erklaerungsbeduerftigen Berechtigung (Bedienungshilfen) statt bei
 * einer pro Zielprogramm.
 *
 * Starten ist ein Schalter, kein Automatismus: Ohne ihn wird eine geschlossene
 * Anwendung gemeldet statt geoeffnet, denn ein Diktat, das ungefragt Programme
 * startet, waere eine Ueberraschung. Mit ihm wird gestartet und gewartet, bis
 * das Fenster wirklich steht.
 *
 * EHRLICHE GRENZE des Startens: Ein frisch geoeffnetes Textprogramm zeigt oft
 * nur seinen Startbildschirm, also gar kein Eingabefeld. Der Text hat dann
 * nichts, worin er landen koennte. Das Starten hilft dort, wo die Anwendung
 * ihre Sitzung wiederherstellt, und nicht ueberall.
 */
import { execFile } from 'node:child_process';
import { texte } from '../i18n';
import { err, ok, type Result } from '../../shared/result';
import { istVerfuegbarAuf, type Zielanwendung } from '../../shared/zielanwendung';

/** Zeitgrenzen: beide Schritte sind reine Fensteroperationen. */
const SUCHE_TIMEOUT_MS = 5000;
const AKTIVIERUNG_TIMEOUT_MS = 5000;

/**
 * Wartezeit zwischen Aktivierung und Einfuegen. Der Fensterwechsel des
 * Betriebssystems braucht einen Moment; ohne Pause geht der Tastendruck an
 * das alte Fenster.
 */
export const FENSTERWECHSEL_WARTEZEIT_MS = 400;

export interface ZielAktivierer {
  /** Stabile Kennung (Logs und Tests). */
  readonly id: string;
  /**
   * Holt die Anwendung nach vorne. Erwartbare Faelle (laeuft nicht, auf
   * dieser Plattform unbekannt) kommen als Katalog-Meldung zurueck, nie als
   * Ausnahme. `startenErlaubt` entscheidet, ob eine geschlossene Anwendung
   * geoeffnet werden darf.
   */
  readonly aktiviere: (
    ziel: Zielanwendung,
    startenErlaubt: boolean,
  ) => Promise<Result<void, string>>;
}

/**
 * Wie lange nach dem Starten auf das Fenster gewartet wird, und in welchem
 * Takt nachgesehen wird. Grosse Programme brauchen mehrere Sekunden; laenger
 * als eine halbe Minute zu warten hilft niemandem mehr.
 */
const START_WARTEN_MAX_MS = 30_000;
const START_WARTEN_TAKT_MS = 500;

/** Kurze Pause ohne Fremdabhaengigkeit. */
function warte(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Fuehrt ein Programm aus und meldet nur, ob es mit 0 endete. */
function laufErfolgreich(
  datei: string,
  argumente: readonly string[],
  timeoutMs: number,
  umgebung?: Readonly<Record<string, string>>,
): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      datei,
      [...argumente],
      {
        timeout: timeoutMs,
        windowsHide: true,
        ...(umgebung === undefined ? {} : { env: { ...process.env, ...umgebung } }),
      },
      (error) => {
        resolve(error === null);
      },
    );
  });
}

/**
 * macOS: erst pruefen, ob einer der Programmnamen laeuft (`pgrep -x`), dann
 * das Fenster nach vorne holen (`open -a`).
 */
function createMacosZielAktivierer(): ZielAktivierer {
  return {
    id: 'macos-open',
    aktiviere: async (ziel, startenErlaubt) => {
      const app = ziel.macosApp;
      if (app === null || ziel.macosProzess.length === 0) {
        return err(texte().ziel.nichtAufDieserPlattform(ziel.name));
      }
      const laeuft = async (): Promise<boolean> => {
        for (const prozess of ziel.macosProzess) {
          if (await laufErfolgreich('pgrep', ['-x', prozess], SUCHE_TIMEOUT_MS)) {
            return true;
          }
        }
        return false;
      };
      const liefBereits = await laeuft();
      if (!liefBereits && !startenErlaubt) {
        return err(texte().ziel.laeuftNicht(ziel.name));
      }
      // -a waehlt die Anwendung. Laeuft sie schon, holt das nur ihr Fenster
      // nach vorne; laeuft sie nicht, startet es sie.
      const aktiviert = await laufErfolgreich('open', ['-a', app], AKTIVIERUNG_TIMEOUT_MS);
      if (!aktiviert) {
        return err(texte().ziel.aktivierungFehlgeschlagen(ziel.name));
      }
      if (liefBereits) {
        return ok(undefined);
      }
      // Frisch gestartet: warten, bis das Programm wirklich da ist. Ohne das
      // ginge der Tastendruck ins Leere, weil das Fenster noch nicht steht.
      for (let gewartet = 0; gewartet < START_WARTEN_MAX_MS; gewartet += START_WARTEN_TAKT_MS) {
        await warte(START_WARTEN_TAKT_MS);
        if (await laeuft()) {
          return ok(undefined);
        }
      }
      return err(texte().ziel.startDauertZuLang(ziel.name));
    },
  };
}

/**
 * Statisches PowerShell-Kommando: sucht den Prozess, dessen Name in der
 * Umgebungsvariable steht, und holt sein Fenster nach vorne. Ohne Treffer
 * endet es mit Code 3 (laeuft nicht), bei misslungener Aktivierung mit 4.
 */
const WINDOWS_AKTIVIERUNG =
  '$namen = $env:VOICEWALL_ZIEL_PROZESS -split ";"; ' +
  '$p = $null; ' +
  'foreach ($n in $namen) { ' +
  'if (-not $p) { $p = Get-Process -Name $n -ErrorAction SilentlyContinue | ' +
  'Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1 } }; ' +
  'if (-not $p) { exit 3 }; ' +
  '$w = New-Object -ComObject WScript.Shell; ' +
  'if (-not $w.AppActivate($p.Id)) { exit 4 }';

/**
 * Statisches PowerShell-Kommando zum Starten: sucht den Programmnamen ueber
 * Start-Process und wartet danach, bis ein Fenster steht. Auch hier kommt der
 * Name ausschliesslich ueber die Umgebung herein.
 */
const WINDOWS_START =
  '$namen = $env:VOICEWALL_ZIEL_PROZESS -split ";"; ' +
  '$gestartet = $false; ' +
  'foreach ($n in $namen) { ' +
  'if (-not $gestartet) { try { Start-Process -FilePath $n -ErrorAction Stop; ' +
  '$gestartet = $true } catch { } } }; ' +
  'if (-not $gestartet) { exit 5 }';

/** Windows: Prozess mit Fenster suchen und per AppActivate nach vorne holen. */
function createWindowsZielAktivierer(): ZielAktivierer {
  return {
    id: 'windows-appactivate',
    aktiviere: async (ziel, startenErlaubt) => {
      if (ziel.windowsProzess.length === 0) {
        return err(texte().ziel.nichtAufDieserPlattform(ziel.name));
      }
      // Der Programmname geht ueber die Umgebung, nicht in das Kommando.
      const umgebung = { VOICEWALL_ZIEL_PROZESS: ziel.windowsProzess.join(';') };
      const powershell = (kommando: string, timeoutMs: number): Promise<boolean> =>
        laufErfolgreich(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', kommando],
          timeoutMs,
          umgebung,
        );

      if (await powershell(WINDOWS_AKTIVIERUNG, AKTIVIERUNG_TIMEOUT_MS)) {
        return ok(undefined);
      }
      // Zwischen "laeuft nicht" und "Aktivierung misslungen" wird bewusst
      // nicht unterschieden: fuer den Nutzer ist die naechste Handlung
      // dieselbe, naemlich das Fenster selbst zu oeffnen.
      if (!startenErlaubt) {
        return err(texte().ziel.laeuftNicht(ziel.name));
      }
      if (!(await powershell(WINDOWS_START, AKTIVIERUNG_TIMEOUT_MS))) {
        return err(texte().ziel.laeuftNicht(ziel.name));
      }
      // Gestartet: warten, bis ein Fenster steht und sich aktivieren laesst.
      for (let gewartet = 0; gewartet < START_WARTEN_MAX_MS; gewartet += START_WARTEN_TAKT_MS) {
        await warte(START_WARTEN_TAKT_MS);
        if (await powershell(WINDOWS_AKTIVIERUNG, AKTIVIERUNG_TIMEOUT_MS)) {
          return ok(undefined);
        }
      }
      return err(texte().ziel.startDauertZuLang(ziel.name));
    },
  };
}

/** Waehlt den Aktivierer fuer die Plattform (Dispatch wie beim Paste). */
export function createZielAktivierer(platform: NodeJS.Platform): Result<ZielAktivierer, string> {
  switch (platform) {
    case 'darwin':
      return ok(createMacosZielAktivierer());
    case 'win32':
      return ok(createWindowsZielAktivierer());
    default:
      return err(texte().paste.nichtUnterstuetzt);
  }
}

/** Prueft vor dem Aktivieren, ob das Ziel auf dieser Plattform Sinn ergibt. */
export function zielIstAnsteuerbar(ziel: Zielanwendung, platform: NodeJS.Platform): boolean {
  return istVerfuegbarAuf(ziel, platform);
}
