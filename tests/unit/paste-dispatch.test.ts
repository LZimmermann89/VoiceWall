/**
 * Unit-Tests des Paste-Adapter-Dispatch: Plattformwahl (macOS/Windows) und
 * die dokumentierte Nicht-Unterstuetzung von Linux mit deutscher Meldung.
 * Der echte osascript-/PowerShell-Aufruf laeuft hier bewusst NICHT.
 */
import { describe, expect, it } from 'vitest';
import { createPasteAdapter } from '../../src/main/paste/index';

describe('createPasteAdapter', () => {
  it('waehlt auf macOS den osascript-Adapter', () => {
    const result = createPasteAdapter('darwin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('macos-osascript');
    }
  });

  it('waehlt auf Windows den SendKeys-Adapter', () => {
    const result = createPasteAdapter('win32');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('windows-sendkeys');
    }
  });

  it('lehnt Linux mit deutscher Meldung samt naechstem Schritt ab', () => {
    const result = createPasteAdapter('linux');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('nicht unterstützt');
      expect(result.error).toContain('Zwischenablage');
    }
  });
});
