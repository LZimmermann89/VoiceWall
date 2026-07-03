/**
 * App-Bootstrap des Main-Prozesses: Single-Instance-Lock, Crash-Dump-Härtung,
 * Navigations-Sperren, Fenster-Lifecycle und IPC-Registrierung.
 * Es gibt keinen HTTP-Server und keinen offenen Netzwerk-Port: die gesamte
 * Kommunikation läuft über Electron-IPC.
 */
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { app, BrowserWindow, globalShortcut, session } from 'electron';
import { DictationFlowController } from './dictation/flow-controller';
import { registerIpcHandlers } from './ipc/handlers';
import { createLogger, type Logger } from './log/logger';
import { DictationOrchestrator } from './stt/orchestrator';

// App-Namen fruehzeitig und deterministisch setzen. Ohne dies liefe die App
// im Dev-/Build-Modus unter dem Default "Electron", wodurch userData auf den
// falschen Ordner zeigt. Der Name bestimmt app.getPath('userData') und damit
// den Modell-, Log- und Konfig-Ordner (macOS: ~/Library/Application Support/voicewall).
app.setName('voicewall');

let mainWindow: BrowserWindow | null = null;
let orchestrator: DictationOrchestrator | null = null;
let flowController: DictationFlowController | null = null;

/**
 * Der Dev-/Test-PCM-Injektionskanal ist nur aktiv, wenn er explizit per
 * Umgebungsvariable freigeschaltet wird UND die App nicht paketiert ist. So
 * existiert der Testpfad im ausgelieferten Produkt garantiert nicht.
 */
function isTestIpcEnabled(): boolean {
  return process.env['VOICEWALL_ENABLE_TEST_IPC'] === '1' && !app.isPackaged;
}

/**
 * Crash-Reporting hart deaktivieren.
 *
 * Warum: Crash-Dumps sind Speicherabbilder. Sie könnten Diktat-Text,
 * Zwischenablage-Inhalte oder Firmendaten aus dem RAM enthalten und wären
 * damit ein Datenschutz-Leck an der Architektur vorbei. Der `crashReporter`
 * wird deshalb nirgends gestartet (kein Upload-Endpunkt, keine Telemetrie).
 * Zusätzlich wird das Crash-Dump-Verzeichnis auf einen kontrollierten Pfad
 * unter userData gelegt und bei jedem Start geleert, damit auch von Chromium
 * selbst geschriebene Reste nie dauerhaft liegen bleiben.
 */
function hardenCrashDumps(): void {
  const crashDumpDir = join(app.getPath('userData'), 'crash-dumps');
  rmSync(crashDumpDir, { recursive: true, force: true });
  mkdirSync(crashDumpDir, { recursive: true });
  app.setPath('crashDumps', crashDumpDir);
}

/**
 * True nur fuer die eigene, lokale Origin: die gebauten file://-Seiten bzw.
 * im Dev-Modus die von electron-vite ausgelieferte lokale Renderer-URL.
 */
function isOwnOrigin(url: string): boolean {
  if (url.startsWith('file://')) {
    return true;
  }
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  return devUrl !== undefined && !app.isPackaged && url.startsWith(devUrl);
}

/**
 * Berechtigungs-Haertung (ABARBEITUNG 3.1/3.13, sichere Defaults):
 * Chromium-Berechtigungsanfragen werden zentral beantwortet. Erlaubt wird
 * AUSSCHLIESSLICH 'media' (Mikrofon fuer das Capture-Fenster) und auch das
 * nur fuer die eigene lokale Origin und nur fuer Audio. Alles andere
 * (Geolocation, Notifications, Kamera, MIDI, Bluetooth, ...) wird immer
 * abgelehnt, ohne Nutzer-Prompt. Der E2E-Test network-isolation.spec.ts
 * belegt die Ablehnung.
 */
function hardenPermissions(logger: Logger): void {
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const requestingUrl = webContents.getURL();
      const mediaTypes = 'mediaTypes' in details ? details.mediaTypes : undefined;
      const onlyAudio = mediaTypes === undefined || mediaTypes.every((type) => type === 'audio');
      const allowed = permission === 'media' && onlyAudio && isOwnOrigin(requestingUrl);
      if (!allowed) {
        logger.info('Berechtigungsanfrage abgelehnt (sicherer Default).', {
          reason: permission,
        });
      }
      callback(allowed);
    },
  );
  // Synchrone Checks (z. B. navigator.permissions.query) identisch streng.
  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission, requestingOrigin) =>
      permission === 'media' && isOwnOrigin(requestingOrigin),
  );
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 960,
    height: 640,
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      // Sicherheits-Defaults: Renderer ist vollständig vom Node-Kontext
      // isoliert, jeglicher OS-Zugriff läuft über die getypte Preload-Brücke.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  // Im Dev-Modus liefert electron-vite die Renderer-URL, im Build wird die
  // gebaute Datei geladen. Beides ist lokal, nie eine externe Origin.
  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (rendererUrl !== undefined && !app.isPackaged) {
    void window.loadURL(rendererUrl);
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'));
  }

  window.on('closed', () => {
    mainWindow = null;
  });

  return window;
}

// Single-Instance-Lock: Eine zweite Instanz beendet sich sofort und die
// erste Instanz holt ihr Fenster in den Vordergrund. Das verhindert
// Doppelinstanzen und spätere Manifest-Korruption im Ordner-Speicher.
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  hardenCrashDumps();

  app.on('second-instance', () => {
    // Fenster wieder oeffnen bzw. nach vorn holen (auch wenn es seit M3 bei
    // laufender Tray-App geschlossen sein kann).
    openMainWindow();
  });

  // Navigations-Härtung für alle WebContents: keine Navigation weg vom
  // gebauten Renderer, keine neuen Fenster (Popups, target=_blank).
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event) => {
      event.preventDefault();
    });
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });

  // Seit M3 lebt die App nach dem Onboarding (Einwilligung erteilt) ohne
  // Fenster weiter: Tray und globaler Hotkey tragen das systemweite Diktat.
  // Vor dem Onboarding gibt es weder Hotkey-Nutzen noch Tray-Erwartung,
  // dann beendet das Schliessen des Fensters die App (M0-Verhalten).
  app.on('window-all-closed', () => {
    if (!(orchestrator?.isOnboarded() ?? false)) {
      app.quit();
    }
  });

  // macOS: Klick auf das Dock-Icon oeffnet das Fenster wieder.
  app.on('activate', () => {
    openMainWindow();
  });

  // Engine-Kind geordnet beenden, bevor die App schliesst.
  app.on('before-quit', () => {
    flowController?.shutdown();
    flowController = null;
    void orchestrator?.shutdown();
  });

  // Hotkey systemweit freigeben, sonst bliebe er nach dem Beenden haengen.
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });

  void app.whenReady().then(async () => {
    registerIpcHandlers();
    const logger = createLogger(app.getPath('userData'));
    hardenPermissions(logger);
    orchestrator = new DictationOrchestrator({
      userDataPath: app.getPath('userData'),
      logger,
      getMainWindow: () => mainWindow,
      enableTestIpc: isTestIpcEnabled(),
      // Metal-GPU nur auf macOS; Windows/Linux laufen CPU-only.
      useGpu: process.platform === 'darwin',
    });
    orchestrator.register();
    // Einwilligungs-Status frueh laden: window-all-closed braucht ihn synchron.
    await orchestrator.init();

    // Hauptfenster VOR dem FlowController erzeugen: es bleibt damit das
    // erste Fenster (Overlay kommt danach), was Tests und Werkzeuge, die auf
    // das erste Fenster warten, deterministisch haelt.
    mainWindow = createMainWindow();

    flowController = new DictationFlowController({
      userDataPath: app.getPath('userData'),
      logger,
      orchestrator,
      openMainWindow,
      quitApp: () => {
        app.quit();
      },
      enableTestIpc: isTestIpcEnabled(),
    });
    await flowController.init();
    // Frisch registrierte M3-Statusanteile (Hotkey, Accessibility) anzeigen.
    orchestrator.notifyStatusChanged();
  });
}

/** Oeffnet das Hauptfenster bzw. holt es in den Vordergrund (Tray/Dock). */
function openMainWindow(): void {
  if (mainWindow !== null && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  if (app.isReady()) {
    mainWindow = createMainWindow();
  }
}
