/**
 * EN-Smoke-Tests der Main-Prozess-Meldungen:
 * repraesentative Fehlerpfade liefern nach setUiLanguage('en') englische
 * Katalog-Meldungen, mit Default 'de' unveraendert die deutschen. Zusaetzlich
 * der Beleg fuer den Footer-Versions-Fix (Buildzeit-Konstante statt
 * app.getVersion()).
 */
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_VERSION } from '../../src/main/app-version';
import { getUiLanguage, setUiLanguage, texte } from '../../src/main/i18n';
import { createPasteAdapter } from '../../src/main/paste/index';
import { sanitizeCompanyName } from '../../src/main/storage/sanitize';
import { CompanyManager } from '../../src/main/storage/companies';
import type { Logger } from '../../src/main/log/logger';

const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

afterEach(() => {
  // Sprachzustand nie in andere Tests dieser Datei leaken.
  setUiLanguage('de');
});

describe('Main-i18n', () => {
  it('Default ist Deutsch: Paste-Dispatch und Sanitize melden deutsch', () => {
    expect(getUiLanguage()).toBe('de');
    const adapter = createPasteAdapter('linux');
    expect(adapter.ok).toBe(false);
    if (!adapter.ok) {
      expect(adapter.error).toBe(
        'Automatisches Einfügen wird auf diesem Betriebssystem nicht unterstützt. Der Text liegt in der Zwischenablage, bitte mit Strg+V manuell einfügen.',
      );
    }
    const name = sanitizeCompanyName('///');
    expect(name.ok).toBe(false);
    if (!name.ok) {
      expect(name.error.message).toContain('Der Firmenname enthält keine');
    }
  });

  it('EN-Smoke: nach setUiLanguage("en") sind Main-Meldungen englisch', async () => {
    setUiLanguage('en');

    // 1. Paste-Dispatch (nicht unterstuetzte Plattform).
    const adapter = createPasteAdapter('linux');
    expect(adapter.ok).toBe(false);
    if (!adapter.ok) {
      expect(adapter.error).toBe(
        'Automatic insertion is not supported on this operating system. The text is in the clipboard, please insert it manually with Ctrl+V.',
      );
    }

    // 2. Sanitize-Fehler (Wizard-Pfad ueber den CompanyManager).
    const root = await mkdtemp(join(tmpdir(), 'voicewall-main-i18n-'));
    try {
      const manager = new CompanyManager({
        userDataPath: root,
        logger: silentLogger,
        appVersion: 'VoiceWall test',
        resolveDesktop: () => Promise.resolve(null),
        localBase: join(root, 'VoiceWall'),
      });
      const preview = manager.previewName('///');
      expect(preview.ok).toBe(false);
      if (!preview.ok) {
        expect(preview.message).toBe(
          'The company name contains no characters usable for a folder name. Please enter a name with letters or digits.',
        );
      }

      // 3. Result-Fehler eines Handlers-Pfads: kein aktiver Firmenordner.
      const saved = await manager.saveDictate({
        text: 'proof',
        dauerSekunden: 1,
        quelle: 'diktat',
        modell: 'whisper-large-v3-turbo-q5_0',
      });
      expect(saved.ok).toBe(false);
      if (!saved.ok) {
        expect(saved.message).toBe('No active company. Please create or activate a company first.');
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }

    // 4. Accessibility-Hinweis (Zustell-Fehlerpfad) englisch.
    expect(texte().freigaben.accessibilityFehlt).toContain(
      'Automatic insertion is not yet possible',
    );
    // 5. zod-Handler-Eingabefehler (IPC-Grenze) englisch.
    expect(texte().flow.eingabeTastenkombination).toBe('Invalid input for the key combination.');
  });

  it('Footer-Fix: APP_VERSION ist die package.json-Version, nicht die Electron-Version', () => {
    const pkg = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../package.json'), 'utf8'),
    ) as { version: string; devDependencies: Record<string, string> };
    expect(APP_VERSION).toBe(pkg.version);
    // Frueherer Fehler: der Pruefstempel zeigte im Dev-Modus die
    // Electron-Version (app.getVersion() im ungepackten Zustand).
    expect(APP_VERSION).not.toBe(pkg.devDependencies['electron']);
  });
});
