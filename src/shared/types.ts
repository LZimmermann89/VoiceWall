/**
 * Domänen- und Brückentypen, die Main, Preload und Renderer gemeinsam nutzen.
 * Dieses Modul darf weder Node- noch DOM-APIs verwenden.
 */
import type { PingResponse } from './schema';

/**
 * Die schmale, getypte API, die der Preload über die contextBridge als
 * `window.voicewall` in den Renderer exponiert. In M0 existiert nur `ping`.
 */
export interface VoiceWallBridge {
  /** Erreichbarkeitstest der IPC-Brücke: liefert validiert `pong`. */
  readonly ping: () => Promise<PingResponse>;
}
