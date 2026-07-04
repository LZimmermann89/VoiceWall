/**
 * Preload des Overlay-Fensters. Exponiert eine minimale Bruecke: Anzeige-
 * Zustaende empfangen und den Kopieren-Knopf melden. Kein Zugriff auf
 * Node/Dateisystem.
 *
 * Wichtig (Sandbox): Sandboxed Preload-Skripte koennen keine geteilten
 * Build-Chunks nachladen. Damit dieser Preload keinen gemeinsamen Chunk mit
 * dem Haupt-Preload bildet, werden die Kanalnamen hier bewusst als lokale
 * Literale gehalten. Sie MUESSEN mit src/main/ipc/channels.ts uebereinstimmen;
 * tests/unit/overlay-channels.test.ts sichert das ab.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { OverlayStatePayload, VoiceWallOverlayBridge } from '../shared/types';

/** Kanalnamen, gespiegelt aus channels.ts (siehe Kommentar oben). */
const OVERLAY_CHANNELS = {
  state: 'overlay:state',
  copyLast: 'overlay:copy-last',
} as const;

const VALID_KINDS = new Set(['recording', 'transcribing', 'done', 'no-speech', 'error']);
const VALID_UI_LANGUAGES = new Set(['de', 'en']);

/** Minimale strukturelle Validierung des eingehenden Zustands. */
function parseState(raw: unknown): OverlayStatePayload | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const candidate = raw as { kind?: unknown; message?: unknown; uiSprache?: unknown };
  if (typeof candidate.kind !== 'string' || !VALID_KINDS.has(candidate.kind)) {
    return null;
  }
  const message = typeof candidate.message === 'string' ? candidate.message : null;
  // Sprache der Oberflaeche (Paket B2): unbekannte Werte fallen auf 'de'.
  const uiSprache: 'de' | 'en' =
    typeof candidate.uiSprache === 'string' && VALID_UI_LANGUAGES.has(candidate.uiSprache)
      ? (candidate.uiSprache as 'de' | 'en')
      : 'de';
  return { kind: candidate.kind as OverlayStatePayload['kind'], message, uiSprache };
}

const bridge: VoiceWallOverlayBridge = {
  onState: (listener) => {
    const handler = (_event: IpcRendererEvent, payload: unknown): void => {
      const state = parseState(payload);
      if (state !== null) {
        listener(state);
      }
    };
    ipcRenderer.on(OVERLAY_CHANNELS.state, handler);
    return () => {
      ipcRenderer.removeListener(OVERLAY_CHANNELS.state, handler);
    };
  },
  copyLastTranscript: () => {
    ipcRenderer.send(OVERLAY_CHANNELS.copyLast);
  },
};

contextBridge.exposeInMainWorld('voicewallOverlay', bridge);
