/**
 * Globale Konfiguration: Hotkey und Zwischenablage-Verhalten,
 * Firmenverwaltung, Auto-Speichern und Modellwahl.
 *
 * Das Format ist bewusst kompatibel erweiterbar:
 * `schemaVersion` steuert spaetere Migrationen, und alle Objekte
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
    'Ungültige Tastenkombination. Bitte mindestens eine Modifier-Taste (z. B. CommandOrControl, Alt, Shift) und genau eine Taste angeben, etwa "CommandOrControl+Shift+D".',
});

/**
 * Globale Konfigurationsdatei (userData/config.json).
 *
 * Die Firmenverwaltung ergaenzt `firmen` (absolute
 * Pfade der Firmenordner), `aktiveFirma` und `diktatAutoSpeichern`. Die neuen
 * Felder haben Defaults, damit bestehende Konfigdateien unveraendert
 * gueltig bleiben. WICHTIG: den Pfaden aus `firmen`/`aktiveFirma` wird nie
 * blind gefolgt; der Main-Prozess validiert sie beim Laden gegen die
 * erwarteten Elternverzeichnisse und den VoiceWall-Marker
 * (storage/companies.ts), ungueltige Eintraege werden ignoriert und geloggt.
 *
 * `modellPfade` ist eine rein informative, kompatible Erweiterung.
 * Die Wahrheitsquelle fuer Modelle bleibt der
 * TypeScript-Katalog plus SHA-256-Pruefung (model-store.ts);
 * Ladeentscheidungen haengen NIE an diesen Konfig-Pfaden.
 */
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
    /** Absolute Pfade aller bekannten Firmenordner (Main validiert beim Laden). */
    firmen: z.array(z.string().min(1).max(2048)).max(200).default([]),
    /** Absoluter Pfad der aktiven Firma oder null. */
    aktiveFirma: z.string().min(1).max(2048).nullable().default(null),
    /**
     * Diktate nach erfolgreicher Transkription automatisch in der aktiven
     * Firma speichern. Effektiv nur, sobald eine Firma existiert (Default AN).
     */
    diktatAutoSpeichern: z.boolean().default(true),
    /**
     * Whisper-Modellwahl (Wizard): Q5_0 ist der
     * Standard; fp16 ("Maximale Genauigkeit") ist nur fuer starke Hardware
     * gedacht und wird im Wizard entsprechend gegated. Die Wahl bestimmt,
     * welches Whisper-Modell Engine und Download verwenden; die
     * Integritaetsentscheidung haengt weiterhin ausschliesslich an den
     * SHA-256-Konstanten des Katalogs.
     */
    modell: z.enum(['q5_0', 'fp16']).default('q5_0'),
    /** Informative Modellpfad-Struktur (nie sicherheitsrelevant, siehe oben). */
    modellPfade: z.record(z.string(), z.string().max(2048)).default({}),
    /**
     * Regelbasierte Textaufbereitung (Stufe 1). Die Schalter
     * sind GLOBAL und nicht firmenbezogen: sie beschreiben,
     * wie der NUTZER spricht (Fuellwoerter, gesprochene Kommandos), nicht die
     * Firma; das firmenspezifische Fachwissen liegt in vokabular.json im
     * Firmenordner. Fuellwoerter-Filter Default AN (konservative Liste),
     * Sprachkommandos Default AUS (bewusst Opt-in).
     */
    aufbereitung: z
      .object({
        fuellwoerterEntfernen: z.boolean().default(true),
        // Neuer Schalter, Default AUS. Alte Konfigurationen ohne dieses Feld
        // erhalten damit den sicheren Standard (kein stiller Wortdopplungs-Kollaps).
        wortdopplungenEntfernen: z.boolean().default(false),
        sprachkommandos: z.boolean().default(false),
      })
      .passthrough()
      .default({
        fuellwoerterEntfernen: true,
        wortdopplungenEntfernen: false,
        sprachkommandos: false,
      }),
    /**
     * Sprache der Oberflaeche: 'de' ist der
     * Standard. Die UI-Sprache ist bewusst UNABHAENGIG von der Diktatsprache
     * der Firmen (die in der Firmen-Konfiguration liegt): ein deutscher
     * Nutzer kann englische Diktate fuehren und umgekehrt. Ein von Hand
     * eingetragener fremder Wert faellt kontrolliert auf 'de' zurueck
     * (catch), damit die App immer startfaehig bleibt.
     */
    uiSprache: z.enum(['de', 'en']).catch('de').default('de'),
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
    firmen: [],
    aktiveFirma: null,
    diktatAutoSpeichern: true,
    modell: 'q5_0',
    modellPfade: {},
    aufbereitung: {
      fuellwoerterEntfernen: true,
      wortdopplungenEntfernen: false,
      sprachkommandos: false,
    },
    uiSprache: 'de',
  };
}
