/**
 * Tray-Icon mit sichtbarem Aufnahme-Zustand:
 * - idle: Ring als macOS-Template-Image (passt sich Hell-/Dunkelmodus an).
 * - recording: roter Punkt (kein Template, Farbe = eindeutiger Indikator).
 *
 * Das Tray haelt die App zusammen mit der window-all-closed-Anpassung am
 * Leben, sodass der globale Hotkey auch ohne offenes Hauptfenster
 * funktioniert. Ueber das Menue sind Diktat-Toggle, Fenster-Oeffnen und
 * Beenden erreichbar.
 */
import { Menu, nativeImage, Tray } from 'electron';
import { texte } from '../i18n';
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
  /** Menue/Tooltip mit der aktuellen UI-Sprache neu aufbauen. */
  readonly refreshLanguage: () => void;
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
  // Der Tooltip im Ruhezustand ist der Produktname (Eigenname, sprachneutral).
  tray.setToolTip('VoiceWall');
  let isRecording = false;

  const applyState = (): void => {
    const t = texte().tray;
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: isRecording ? t.diktatStoppen : t.diktatStarten,
          click: handlers.onToggleDictation,
        },
        { label: t.fensterOeffnen, click: handlers.onOpenWindow },
        { type: 'separator' },
        { label: t.beenden, click: handlers.onQuit },
      ]),
    );
    tray.setImage(isRecording ? recordingIcon : idleIcon);
    tray.setToolTip(isRecording ? t.tooltipAufnahme : 'VoiceWall');
  };
  applyState();

  return {
    setRecording: (recording) => {
      isRecording = recording;
      applyState();
    },
    refreshLanguage: () => {
      applyState();
    },
    destroy: () => {
      tray.destroy();
    },
  };
}
