/**
 * Unit-Tests der Hotkey-/Konfig-Validierung: gueltige und ungueltige
 * Accelerator-Strings, Default-Konfiguration und die Erweiterbarkeits-
 * Garantie (unbekannte Felder ueberleben das Parsen, Kompatibilitaet).
 */
import { describe, expect, it } from 'vitest';
import {
  CONFIG_SCHEMA_VERSION,
  DEFAULT_HOTKEY_ACCELERATOR,
  defaultGlobalConfig,
  globalConfigSchema,
  hotkeyAcceleratorSchema,
  isValidHotkeyAccelerator,
} from '../../src/shared/config';

describe('isValidHotkeyAccelerator', () => {
  it.each([
    'CommandOrControl+Shift+D',
    'CmdOrCtrl+Alt+V',
    'Control+Shift+F12',
    'Alt+Space',
    'Super+D',
    'Shift+Alt+7',
    'CommandOrControl+Plus',
  ])('akzeptiert %s', (accelerator) => {
    expect(isValidHotkeyAccelerator(accelerator)).toBe(true);
  });

  it.each([
    // Keine Modifier: wuerde normales Tippen kapern.
    'D',
    'F5',
    // Kein Key.
    'CommandOrControl+Shift',
    // Zwei Keys.
    'Control+A+B',
    // Leere Teile / kaputte Syntax.
    '',
    '+',
    'Ctrl++D',
    'Ctrl+',
    // Unbekannte Bezeichner.
    'Hyper+D',
    'Ctrl+Foo',
    // F25 existiert nicht.
    'Ctrl+F25',
    // Umlaute sind keine gueltigen Electron-Keycodes.
    'Ctrl+ä',
  ])('lehnt %s ab', (accelerator) => {
    expect(isValidHotkeyAccelerator(accelerator)).toBe(false);
  });

  it('liefert im zod-Schema eine deutsche Fehlermeldung', () => {
    const result = hotkeyAcceleratorSchema.safeParse('Banane');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Tastenkombination');
    }
  });
});

describe('globalConfigSchema', () => {
  it('validiert die Default-Konfiguration', () => {
    const parsed = globalConfigSchema.safeParse(defaultGlobalConfig());
    expect(parsed.success).toBe(true);
  });

  it('hat sinnvolle Defaults (Hotkey, Wiederherstellung an)', () => {
    const config = defaultGlobalConfig();
    expect(config.schemaVersion).toBe(CONFIG_SCHEMA_VERSION);
    expect(config.hotkey.accelerator).toBe(DEFAULT_HOTKEY_ACCELERATOR);
    expect(config.clipboard.restorePrevious).toBe(true);
    expect(config.clipboard.restoreDelayMs).toBeGreaterThanOrEqual(200);
  });

  it('laesst unbekannte Felder passieren (kompatibel erweiterbar)', () => {
    const future = {
      ...defaultGlobalConfig(),
      futureSection: { anything: true },
      hotkey: { accelerator: 'Alt+D', pushToTalk: false },
    };
    const parsed = globalConfigSchema.safeParse(future);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toMatchObject({
        futureSection: { anything: true },
        hotkey: { pushToTalk: false },
      });
    }
  });

  it('lehnt ungueltigen Hotkey und ungueltige Verzoegerung ab', () => {
    const broken = {
      ...defaultGlobalConfig(),
      hotkey: { accelerator: 'D' },
    };
    expect(globalConfigSchema.safeParse(broken).success).toBe(false);

    const tooLong = {
      ...defaultGlobalConfig(),
      clipboard: { restorePrevious: true, restoreDelayMs: 999_999 },
    };
    expect(globalConfigSchema.safeParse(tooLong).success).toBe(false);
  });
});

describe('globalConfigSchema: UI-Sprache', () => {
  it('hat den Default de', () => {
    expect(defaultGlobalConfig().uiSprache).toBe('de');
  });

  it('ergaenzt fehlendes uiSprache mit de (Alt-Konfig bleibt gueltig)', () => {
    const alt = { ...defaultGlobalConfig() } as Record<string, unknown>;
    delete alt['uiSprache'];
    const parsed = globalConfigSchema.safeParse(alt);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.uiSprache).toBe('de');
    }
  });

  it('faellt bei fremden Werten kontrolliert auf de zurueck (catch)', () => {
    const kaputt = { ...defaultGlobalConfig(), uiSprache: 'fr' };
    const parsed = globalConfigSchema.safeParse(kaputt);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.uiSprache).toBe('de');
    }
  });

  it('uebernimmt en unveraendert', () => {
    const parsed = globalConfigSchema.safeParse({ ...defaultGlobalConfig(), uiSprache: 'en' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.uiSprache).toBe('en');
    }
  });
});

describe('globalConfigSchema: Aufbereitung (Stufe 1)', () => {
  it('hat die Default-Schalter Fuellwoerter AN, Sprachkommandos AUS', () => {
    const config = defaultGlobalConfig();
    expect(config.aufbereitung).toEqual({
      fuellwoerterEntfernen: true,
      sprachkommandos: false,
    });
  });

  it('ergaenzt fehlende Aufbereitung mit Defaults (Alt-Konfig bleibt gueltig)', () => {
    const alt = { ...defaultGlobalConfig() } as Record<string, unknown>;
    delete alt['aufbereitung'];
    const parsed = globalConfigSchema.safeParse(alt);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.aufbereitung).toEqual({
        fuellwoerterEntfernen: true,
        sprachkommandos: false,
      });
    }
  });

  it('uebernimmt gesetzte Schalter unveraendert', () => {
    const parsed = globalConfigSchema.safeParse({
      ...defaultGlobalConfig(),
      aufbereitung: { fuellwoerterEntfernen: false, sprachkommandos: true },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.aufbereitung.fuellwoerterEntfernen).toBe(false);
      expect(parsed.data.aufbereitung.sprachkommandos).toBe(true);
    }
  });
});
