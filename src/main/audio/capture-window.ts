/**
 * Erzeugt das versteckte Audio-Capture-Fenster (show:false). Es laedt eine
 * eigene capture.html und dient ausschliesslich der Audio-Aufnahme ueber
 * Web-Audio (getUserMedia + AudioWorklet). Es hat keine sichtbare UI.
 *
 * Warum ein eigenes Fenster: getUserMedia/AudioWorklet sind nur im Renderer
 * verfuegbar; das native Whisper-Addon darf nicht in den Renderer. Das
 * Capture-Fenster liefert rohes PCM per IPC an den Main-Prozess.
 */
import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';

export function createCaptureWindow(): BrowserWindow {
  const window = new BrowserWindow({
    show: false,
    // Kein sichtbares Fenster, aber ein echter Renderer-Kontext fuer Web-Audio.
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/capture.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (rendererUrl !== undefined && !app.isPackaged) {
    void window.loadURL(`${rendererUrl}/capture.html`);
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/capture.html'));
  }

  return window;
}
