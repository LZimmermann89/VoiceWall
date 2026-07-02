/**
 * App-Bootstrap des Main-Prozesses: Single-Instance-Lock, Crash-Dump-Härtung,
 * Navigations-Sperren, Fenster-Lifecycle und IPC-Registrierung.
 * Es gibt keinen HTTP-Server und keinen offenen Netzwerk-Port: die gesamte
 * Kommunikation läuft über Electron-IPC.
 */
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';
import { registerIpcHandlers } from './ipc/handlers';

let mainWindow: BrowserWindow | null = null;

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
    if (mainWindow !== null) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  // Navigations-Härtung für alle WebContents: keine Navigation weg vom
  // gebauten Renderer, keine neuen Fenster (Popups, target=_blank).
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event) => {
      event.preventDefault();
    });
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });

  // Auch auf macOS beenden, wenn alle Fenster zu sind: In M0 gibt es ohne
  // Fenster keinen Grund weiterzulaufen (kein Tray, kein Hintergrund-Diktat).
  app.on('window-all-closed', () => {
    app.quit();
  });

  void app.whenReady().then(() => {
    registerIpcHandlers();
    mainWindow = createMainWindow();
  });
}
