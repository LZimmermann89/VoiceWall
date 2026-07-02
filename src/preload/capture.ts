/**
 * Preload des versteckten Audio-Capture-Fensters. Exponiert eine minimale,
 * getypte Brücke: rohes PCM und Fehler an den Main-Prozess senden, Start-/
 * Stop-Kommandos empfangen. Kein Zugriff auf Node/Dateisystem.
 *
 * Wichtig (Sandbox): Sandboxed Preload-Skripte koennen keine geteilten
 * Build-Chunks nachladen. Damit dieser Preload keinen gemeinsamen Chunk mit
 * dem Haupt-Preload bildet, werden die wenigen benoetigten Kanalnamen hier
 * bewusst als lokale Literale gehalten. Sie MUESSEN mit den entsprechenden
 * Werten in src/main/ipc/channels.ts uebereinstimmen (Wire-Protokoll). Der Test
 * tests/unit/capture-channels.test.ts sichert diese Uebereinstimmung ab.
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { Unsubscribe, VoiceWallCaptureBridge } from '../shared/types';

/** Kanalnamen, gespiegelt aus channels.ts (siehe Kommentar oben). */
const CAPTURE_CHANNELS = {
  start: 'capture:start',
  stop: 'capture:stop',
  pcm: 'capture:pcm',
  error: 'capture:error',
  started: 'capture:started',
} as const;

function subscribe(channel: string, listener: () => void): Unsubscribe {
  const handler = (): void => {
    listener();
  };
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const bridge: VoiceWallCaptureBridge = {
  sendPcm: (pcm) => {
    // ArrayBuffer per strukturiertem Klonen an den Main-Prozess senden. Die
    // Chunks sind klein (ca. 100 ms), eine Kopie ist unkritisch; die
    // transfer-Liste von ipcRenderer akzeptiert nur MessagePorts, keine
    // ArrayBuffer, deshalb bewusst send() statt postMessage().
    ipcRenderer.send(CAPTURE_CHANNELS.pcm, pcm);
  },
  reportError: (message) => {
    ipcRenderer.send(CAPTURE_CHANNELS.error, message);
  },
  reportStarted: () => {
    ipcRenderer.send(CAPTURE_CHANNELS.started);
  },
  onStart: (listener) => subscribe(CAPTURE_CHANNELS.start, listener),
  onStop: (listener) => subscribe(CAPTURE_CHANNELS.stop, listener),
};

contextBridge.exposeInMainWorld('voicewallCapture', bridge);
