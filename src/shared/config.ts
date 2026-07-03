/**
 * Globale Konfiguration (M3-Umfang): Hotkey und Zwischenablage-Verhalten.
 *
 * Das Format ist bewusst kompatibel erweiterbar (die volle Konfig-Architektur
 * folgt in M5): `schemaVersion` steuert spaetere Migrationen, und alle Objekte
 * parsen mit `passthrough`, sodass unbekannte (neuere) Felder beim
 * Lesen-Aendern-Schreiben erhalten bleiben statt verloren zu gehen.
 *
 * Dieses Modul bleibt plattformneutral (nur zod, kein Node/Electron/DOM).
 */
import { z } from 'zod';

/** Aktuelle Schema-Version der globalen Konfigurationsdatei. */
export const CONFIG_SCHEMA_VERSION = 1;

/** Standard-Hotkey fuer das systemweite Diktat (Toggle). */
export const DEFAULT_HOTKEY_ACCELERATOR = 'CommandOrControl+Shift+D';

/** Standard-Verzoegerung, nach der die Zwischenablage wiederhergestellt wird. */
export const DEFAULT_CLIPBOARD_RESTORE_DELAY_MS = 1000;

/**
 * Modifier-Namen, die Electron in Accelerator-Strings akzeptiert
 * (https://www.electronjs.org/docs/latest/api/accelerator).
 */
const ACCELERATOR_MODIFIERS = new Set([
  'Command',
  'Cmd',
  'Control',
  'Ctrl',
  'CommandOrControl',
  'CmdOrCtrl',
  'Alt',
  'Option',
  'AltGr',
  'Shift',
  'Super',
  'Meta',
]);

/** Benannte Nicht-Modifier-Tasten (bewusst konservative Teilmenge). */
const ACCELERATOR_NAMED_KEYS = new Set([
  'Plus',
  'Space',
  'Tab',
  'Backspace',
  'Delete',
  'Insert',
  'Return',
  'Enter',
  'Up',
  'Down',
  'Left',
  'Right',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Escape',
  'Esc',
  'Capslock',
  'Numlock',
]);

function isAcceleratorKey(part: string): boolean {
  if (/^[A-Za-z0-9]$/.test(part)) {
    return true;
  }
  if (/^F([1-9]|1\d|2[0-4])$/.test(part)) {
    return true;
  }
  return ACCELERATOR_NAMED_KEYS.has(part);
}

/**
 * Prueft einen Electron-Accelerator-String strukturell: mindestens ein
 * Modifier plus genau eine Taste. Ein globaler Hotkey ohne Modifier wuerde
 * normales Tippen kapern und wird deshalb abgelehnt.
 */
export function isValidHotkeyAccelerator(value: string): boolean {
  const parts = value.split('+');
  if (parts.some((part) => part.length === 0)) {
    return false;
  }
  const modifiers = parts.filter((part) => ACCELERATOR_MODIFIERS.has(part));
  const keys = parts.filter((part) => !ACCELERATOR_MODIFIERS.has(part));
  return modifiers.length >= 1 && keys.length === 1 && isAcceleratorKey(keys[0] ?? '');
}

/** Zod-Schema fuer einen gueltigen Hotkey-Accelerator (deutsche Meldung). */
export const hotkeyAcceleratorSchema = z.string().min(1).refine(isValidHotkeyAccelerator, {
  message:
    'Ungueltige Tastenkombination. Bitte mindestens eine Modifier-Taste (z. B. CommandOrControl, Alt, Shift) und genau eine Taste angeben, etwa "CommandOrControl+Shift+D".',
});

/** Globale Konfigurationsdatei (userData/config.json). */
export const globalConfigSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    hotkey: z
      .object({
        /** Electron-Accelerator des Diktat-Toggles. */
        accelerator: hotkeyAcceleratorSchema,
      })
      .passthrough(),
    clipboard: z
      .object({
        /** Bisherigen Zwischenablage-Inhalt nach dem Einfuegen wiederherstellen. */
        restorePrevious: z.boolean(),
        /** Verzoegerung bis zur Wiederherstellung in Millisekunden. */
        restoreDelayMs: z.number().int().min(200).max(10_000),
      })
      .passthrough(),
  })
  .passthrough();

export type GlobalConfig = z.infer<typeof globalConfigSchema>;

/** Liefert die Default-Konfiguration (frisch erzeugt, nicht geteilt). */
export function defaultGlobalConfig(): GlobalConfig {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    hotkey: { accelerator: DEFAULT_HOTKEY_ACCELERATOR },
    clipboard: {
      restorePrevious: true,
      restoreDelayMs: DEFAULT_CLIPBOARD_RESTORE_DELAY_MS,
    },
  };
}
