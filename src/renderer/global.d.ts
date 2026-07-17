/**
 * Typisierung der Preload-Brücken am `window`-Objekt der Renderer.
 */
import type {
  VoiceWallBridge,
  VoiceWallCaptureBridge,
  VoiceWallOverlayBridge,
} from '../shared/types';

declare global {
  interface Window {
    /** Bruecke des Hauptfensters (Test-/Verwaltungs-UI). */
    readonly voicewall: VoiceWallBridge;
    /** Bruecke des versteckten Audio-Capture-Fensters. */
    readonly voicewallCapture: VoiceWallCaptureBridge;
    /** Bruecke des Diktat-Overlays. */
    readonly voicewallOverlay: VoiceWallOverlayBridge;
  }
}

export {};
