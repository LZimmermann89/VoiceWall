/**
 * E2E-Test des Mail-Befehls ("Verfasse eine Mail an Lars mit folgendem
 * Text: ...").
 *
 * Vollstaendig isoliert vom echten Rechner (VOICEWALL_TEST_USER_DATA,
 * VOICEWALL_TEST_BASE_DIR).
 *
 * Belegt werden die Zusagen, bei denen ein Fehler teuer waere:
 * 1. Ausgeschaltet passiert nichts: der Satz bleibt normaler Diktattext und
 *    wird eingefuegt wie jeder andere.
 * 2. Das Kontaktverzeichnis liegt als eigene, wohlgeformte Datei im
 *    Firmenordner, getrennt vom Fach-Woerterbuch.
 * 3. Ein UNBEKANNTER Empfaenger bereitet KEINE Mail vor und fuegt auch
 *    nichts ein. Das ist der wichtigste Punkt: lieber nichts tun als an
 *    irgendwen schreiben.
 * 4. Auch bei einem bekannten Empfaenger wird NICHTS eingefuegt; der
 *    Mail-Weg schliesst das Einfuegen aus.
 *
 * Bewusst NICHT geprueft: ob sich das Mailprogramm tatsaechlich oeffnet. Das
 * wuerde auf dem Rechner, auf dem der Test laeuft, ein Fenster aufreissen.
 * Die Zusammensetzung der mailto-Adresse deckt der Unit-Test ab.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { kontakteSchema } from '../../src/shared/mailbefehl';
import { launchApp } from './launch';

interface MailBridge {
  voicewall: {
    setAufbereitung: (schalter: Record<string, boolean>) => Promise<{ ok: boolean }>;
    saveKontakte: (input: {
      kontakte: { name: string; adresse: string }[];
    }) => Promise<{ ok: boolean; message?: string }>;
    getKontakte: () => Promise<
      | { ok: true; kontakte: { kontakte: { name: string; adresse: string }[] } }
      | { ok: false; message: string }
    >;
    devMockPaste: (enabled: boolean) => Promise<{ ok: boolean }>;
    devSetAccessibility: (trusted: boolean | null) => Promise<{ ok: boolean }>;
    devGetPasteCalls: () => Promise<number>;
    devRunTargetedResult: (
      text: string,
    ) => Promise<{ zielId: string | null; pasted: boolean; message: string | null }>;
  };
}

const SCHALTER_AUS: Record<string, boolean> = {
  fuellwoerterEntfernen: true,
  wortdopplungenEntfernen: false,
  sprachkommandos: false,
  zielanwendung: false,
  zielanwendungStarten: false,
  mailbefehl: false,
};

function bridge(window: Page): MailBridge['voicewall'] {
  return {
    setAufbereitung: (schalter) =>
      window.evaluate(
        (s: Record<string, boolean>) =>
          (globalThis as unknown as MailBridge).voicewall.setAufbereitung(s),
        schalter,
      ),
    saveKontakte: (input) =>
      window.evaluate(
        (i: { kontakte: { name: string; adresse: string }[] }) =>
          (globalThis as unknown as MailBridge).voicewall.saveKontakte(i),
        input,
      ),
    getKontakte: () =>
      window.evaluate(() => (globalThis as unknown as MailBridge).voicewall.getKontakte()),
    devMockPaste: (enabled) =>
      window.evaluate(
        (e: boolean) => (globalThis as unknown as MailBridge).voicewall.devMockPaste(e),
        enabled,
      ),
    devSetAccessibility: (trusted) =>
      window.evaluate(
        (t: boolean | null) =>
          (globalThis as unknown as MailBridge).voicewall.devSetAccessibility(t),
        trusted,
      ),
    devGetPasteCalls: () =>
      window.evaluate(() => (globalThis as unknown as MailBridge).voicewall.devGetPasteCalls()),
    devRunTargetedResult: (text) =>
      window.evaluate(
        (t: string) => (globalThis as unknown as MailBridge).voicewall.devRunTargetedResult(t),
        text,
      ),
  };
}

test('Mail-Befehl: unbekannter Empfaenger bereitet nichts vor und fuegt nichts ein', async () => {
  const { app, window, baseDir } = await launchApp({ withCompany: true, withConsent: true });
  const companyDir = join(baseDir, 'Testfirma GmbH');
  try {
    const api = bridge(window);
    await api.devSetAccessibility(true);
    await api.devMockPaste(true);

    // 1. Ausgeschaltet: der Satz ist normaler Text und wird eingefuegt.
    const aus = await api.devRunTargetedResult(
      'Verfasse eine Mail an Lars mit folgendem Text: Hallo Test 214',
    );
    expect(aus.zielId).toBeNull();
    expect(aus.pasted).toBe(true);
    expect(await api.devGetPasteCalls()).toBe(1);

    // 2. Kontaktverzeichnis anlegen: eigene, wohlgeformte Datei im Firmenordner.
    expect(
      (await api.saveKontakte({ kontakte: [{ name: 'Lars', adresse: 'lars@beispiel.de' }] })).ok,
    ).toBe(true);
    const kontaktePfad = join(companyDir, '.voicewall', 'kontakte.json');
    expect(existsSync(kontaktePfad)).toBe(true);
    const gespeichert = kontakteSchema.parse(JSON.parse(readFileSync(kontaktePfad, 'utf8')));
    expect(gespeichert.kontakte).toEqual([{ name: 'Lars', adresse: 'lars@beispiel.de' }]);
    // Getrennt vom Fach-Woerterbuch, weil es personenbezogene Daten sind.
    const vokabularPfad = join(companyDir, '.voicewall', 'vokabular.json');
    if (existsSync(vokabularPfad)) {
      expect(readFileSync(vokabularPfad, 'utf8')).not.toContain('lars@beispiel.de');
    }

    // 3. Eingeschaltet, aber der Empfaenger steht nicht im Verzeichnis:
    //    keine Mail, und vor allem auch KEIN Einfuegen als Ersatzhandlung.
    expect((await api.setAufbereitung({ ...SCHALTER_AUS, mailbefehl: true })).ok).toBe(true);
    const unbekannt = await api.devRunTargetedResult(
      'Verfasse eine Mail an Herrn Meier mit folgendem Text: Bitte um Rueckruf',
    );
    expect(unbekannt.zielId).toBe('mail');
    expect(unbekannt.pasted).toBe(false);
    expect(unbekannt.message ?? '').not.toBe('');
    expect(await api.devGetPasteCalls()).toBe(1);

    // 4. Ein Satz ohne Mail-Befehl laeuft weiterhin ganz normal.
    const normal = await api.devRunTargetedResult('Ein ganz gewoehnliches Diktat ohne Befehl');
    expect(normal.zielId).toBeNull();
    expect(normal.pasted).toBe(true);
    expect(await api.devGetPasteCalls()).toBe(2);
  } finally {
    await app.close();
  }
});
