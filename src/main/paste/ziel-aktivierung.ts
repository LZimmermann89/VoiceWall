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
 * Bewusste Entscheidung gegen automatisches Starten: Laeuft die Anwendung
 * nicht, wird sie NICHT gestartet, sondern gemeldet. Ein Diktat, das
 * ungefragt Programme oeffnet, waere eine Ueberraschung; und der Nutzer
 * wollte in ein OFFENES Fenster schreiben.
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
   * Ausnahme.
   */
  readonly aktiviere: (ziel: Zielanwendung) => Promise<Result<void, string>>;
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
    aktiviere: async (ziel) => {
      const app = ziel.macosApp;
      if (app === null || ziel.macosProzess.length === 0) {
        return err(texte().ziel.nichtAufDieserPlattform(ziel.name));
      }
      let laeuft = false;
      for (const prozess of ziel.macosProzess) {
        if (await laufErfolgreich('pgrep', ['-x', prozess], SUCHE_TIMEOUT_MS)) {
          laeuft = true;
          break;
        }
      }
      if (!laeuft) {
        return err(texte().ziel.laeuftNicht(ziel.name));
      }
      // -a waehlt die Anwendung, ohne ein Dokument zu oeffnen.
      const aktiviert = await laufErfolgreich('open', ['-a', app], AKTIVIERUNG_TIMEOUT_MS);
      return aktiviert ? ok(undefined) : err(texte().ziel.aktivierungFehlgeschlagen(ziel.name));
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

/** Windows: Prozess mit Fenster suchen und per AppActivate nach vorne holen. */
function createWindowsZielAktivierer(): ZielAktivierer {
  return {
    id: 'windows-appactivate',
    aktiviere: async (ziel) => {
      if (ziel.windowsProzess.length === 0) {
        return err(texte().ziel.nichtAufDieserPlattform(ziel.name));
      }
      const erfolg = await laufErfolgreich(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          WINDOWS_AKTIVIERUNG,
        ],
        AKTIVIERUNG_TIMEOUT_MS,
        // Der Programmname geht ueber die Umgebung, nicht in das Kommando.
        { VOICEWALL_ZIEL_PROZESS: ziel.windowsProzess.join(';') },
      );
      // Zwischen "laeuft nicht" und "Aktivierung misslungen" wird bewusst
      // nicht unterschieden: fuer den Nutzer ist die naechste Handlung
      // dieselbe, naemlich das Fenster selbst zu oeffnen.
      return erfolg ? ok(undefined) : err(texte().ziel.laeuftNicht(ziel.name));
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
