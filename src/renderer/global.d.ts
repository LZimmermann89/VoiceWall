/**
 * Typisierung der Preload-Brücke am `window`-Objekt des Renderers.
 */
import type { VoiceWallBridge } from '../shared/types';

declare global {
  interface Window {
    readonly voicewall: VoiceWallBridge;
  }
}

export {};
