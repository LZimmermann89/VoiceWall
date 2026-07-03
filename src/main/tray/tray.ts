/**
 * Tray-Icon mit sichtbarem Aufnahme-Zustand (Pflicht aus ABARBEITUNG 2.4):
 * - idle: Ring als macOS-Template-Image (passt sich Hell-/Dunkelmodus an).
 * - recording: roter Punkt (kein Template, Farbe = eindeutiger Indikator).
 *
 * Das Tray haelt die App zusammen mit der window-all-closed-Anpassung am
 * Leben, sodass der globale Hotkey auch ohne offenes Hauptfenster
 * funktioniert. Ueber das Menue sind Diktat-Toggle, Fenster-Oeffnen und
 * Beenden erreichbar.
 */
import { Menu, nativeImage, Tray } from 'electron';
import { createTrayIconPng, type TrayIconVariant } from './tray-icon';

export interface TrayHandlers {
  /** Diktat-Toggle (identisch zum Hotkey). */
  readonly onToggleDictation: () => void;
  /** Hauptfenster oeffnen/in den Vordergrund holen. */
  readonly onOpenWindow: () => void;
  /** App beenden. */
  readonly onQuit: () => void;
}

export interface TrayController {
  /** Aufnahme-Zustand sichtbar machen (Icon-Wechsel + Menue-Text). */
  readonly setRecording: (recording: boolean) => void;
  readonly destroy: () => void;
}

function buildIcon(variant: TrayIconVariant): Electron.NativeImage {
  const image = nativeImage.createEmpty();
  image.addRepresentation({ scaleFactor: 1, buffer: createTrayIconPng(16, variant) });
  image.addRepresentation({ scaleFactor: 2, buffer: createTrayIconPng(32, variant) });
  // Template nur im Ruhezustand: macOS rendert es monochrom passend zur
  // Menueleiste. Der rote Aufnahme-Punkt behaelt bewusst seine Farbe.
  image.setTemplateImage(variant === 'idle');
  return image;
}

export function createTrayController(handlers: TrayHandlers): TrayController {
  const idleIcon = buildIcon('idle');
  const recordingIcon = buildIcon('recording');
  const tray = new Tray(idleIcon);
  tray.setToolTip('VoiceWall');

  const applyMenu = (recording: boolean): void => {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: recording ? 'Diktat stoppen' : 'Diktat starten',
          click: handlers.onToggleDictation,
        },
        { label: 'VoiceWall oeffnen', click: handlers.onOpenWindow },
        { type: 'separator' },
        { label: 'VoiceWall beenden', click: handlers.onQuit },
      ]),
    );
  };
  applyMenu(false);

  return {
    setRecording: (recording) => {
      tray.setImage(recording ? recordingIcon : idleIcon);
      tray.setToolTip(recording ? 'VoiceWall: Aufnahme laeuft' : 'VoiceWall');
      applyMenu(recording);
    },
    destroy: () => {
      tray.destroy();
    },
  };
}
