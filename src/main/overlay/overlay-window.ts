/**
 * Dezentes Overlay-Fenster ("Ich hoere zu"): sichtbarer Aufnahme-/Flow-Zustand
 * fuer das systemweite Diktat.
 *
 * KERNANFORDERUNG: Das Overlay darf der fokussierten Fremd-App NIEMALS den
 * Fokus stehlen, sonst geht das Paste-Ziel verloren. Deshalb:
 * - focusable: false (Fenster kann keinen Tastaturfokus annehmen),
 * - show ausschliesslich ueber showInactive() (nie aktivierend),
 * - alwaysOnTop auf 'screen-saver'-Level, sichtbar auf allen Spaces,
 * - frameless, transparent, skipTaskbar, nicht in Mission-Control-Zyklen.
 *
 * Der E2E-Test prueft isFocusable()/isAlwaysOnTop() gegen genau diese Flags.
 */
import { join } from 'node:path';
import { app, BrowserWindow, screen } from 'electron';

const OVERLAY_WIDTH = 320;
const OVERLAY_HEIGHT = 96;

export function createOverlayWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    // Fokus-Schutz: das Overlay kann nie fokussiert werden.
    focusable: false,
    alwaysOnTop: true,
    title: 'VoiceWall Overlay',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/overlay.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Ueber Vollbild-Apps und auf allen Arbeitsflaechen sichtbar, ohne die App
  // zu aktivieren (macOS: skipTransformProcessType laesst den Prozess-Typ in
  // Ruhe, kein Dock-Gehopse).
  window.setAlwaysOnTop(true, 'screen-saver');
  window.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true,
  });

  positionOverlay(window);

  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (rendererUrl !== undefined && !app.isPackaged) {
    void window.loadURL(`${rendererUrl}/overlay.html`);
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/overlay.html'));
  }

  return window;
}

/** Unten mittig auf dem Primaerbildschirm, knapp ueber dem Dock/der Taskbar. */
export function positionOverlay(window: BrowserWindow): void {
  const workArea = screen.getPrimaryDisplay().workArea;
  const x = Math.round(workArea.x + (workArea.width - OVERLAY_WIDTH) / 2);
  const y = Math.round(workArea.y + workArea.height - OVERLAY_HEIGHT - 24);
  window.setBounds({ x, y, width: OVERLAY_WIDTH, height: OVERLAY_HEIGHT });
}

/** Zeigt das Overlay, ohne der fokussierten App den Fokus zu nehmen. */
export function showOverlayInactive(window: BrowserWindow): void {
  positionOverlay(window);
  if (!window.isVisible()) {
    window.showInactive();
  }
}
