/**
 * E2E-Test der Zielanwendung am Satzende ("... an Word senden").
 *
 * Vollstaendig isoliert vom echten Rechner (VOICEWALL_TEST_USER_DATA,
 * VOICEWALL_TEST_BASE_DIR).
 *
 * Belegt werden die drei Zusagen:
 * 1. Ausgeschaltet passiert gar nichts: die Wendung bleibt Teil des Textes.
 *    Wer den Schalter nicht umlegt, merkt von der Funktion nichts.
 * 2. Eingeschaltet wird die Wendung erkannt und abgetrennt.
 * 3. Ist das Ziel nicht erreichbar, wird NICHTS eingefuegt. Das ist der
 *    eigentliche Punkt: Der Nutzer wollte den Text ausdruecklich woanders
 *    haben, ihn ersatzweise in das gerade offene Fenster zu tippen waere das
 *    Gegenteil davon. Der Text bleibt ueber die Zwischenablage gesichert.
 *
 * Als Ziel dient bewusst eine Anwendung, die es auf der laufenden Plattform
 * GAR NICHT gibt (auf macOS der Windows-Editor, auf Windows Safari). Damit ist
 * der Fehlerpfad deterministisch, und der Test startet niemals ein fremdes
 * Programm auf dem Rechner, auf dem er laeuft.
 */
import { expect, test, type Page } from '@playwright/test';
import { launchApp } from './launch';

interface ZielBridge {
  voicewall: {
    setAufbereitung: (schalter: {
      fuellwoerterEntfernen: boolean;
      wortdopplungenEntfernen: boolean;
      sprachkommandos: boolean;
      zielanwendung: boolean;
    }) => Promise<{ ok: boolean; message?: string }>;
    devMockPaste: (enabled: boolean) => Promise<{ ok: boolean }>;
    devSetAccessibility: (trusted: boolean | null) => Promise<{ ok: boolean }>;
    devGetPasteCalls: () => Promise<number>;
    devRunTargetedResult: (
      text: string,
    ) => Promise<{ zielId: string | null; pasted: boolean; message: string | null }>;
  };
}

const SCHALTER_AUS = {
  fuellwoerterEntfernen: true,
  wortdopplungenEntfernen: false,
  sprachkommandos: false,
  zielanwendung: false,
};

function bridge(window: Page): ZielBridge['voicewall'] {
  return {
    setAufbereitung: (schalter) =>
      window.evaluate(
        (s: typeof SCHALTER_AUS) =>
          (globalThis as unknown as ZielBridge).voicewall.setAufbereitung(s),
        schalter,
      ),
    devMockPaste: (enabled) =>
      window.evaluate(
        (e: boolean) => (globalThis as unknown as ZielBridge).voicewall.devMockPaste(e),
        enabled,
      ),
    devSetAccessibility: (trusted) =>
      window.evaluate(
        (t: boolean | null) =>
          (globalThis as unknown as ZielBridge).voicewall.devSetAccessibility(t),
        trusted,
      ),
    devGetPasteCalls: () =>
      window.evaluate(() => (globalThis as unknown as ZielBridge).voicewall.devGetPasteCalls()),
    devRunTargetedResult: (text) =>
      window.evaluate(
        (t: string) => (globalThis as unknown as ZielBridge).voicewall.devRunTargetedResult(t),
        text,
      ),
  };
}

/** Ein Ziel, das es auf dieser Plattform garantiert NICHT gibt. */
const unerreichbaresZiel =
  process.platform === 'win32'
    ? { gesprochen: 'Safari', id: 'safari' }
    : { gesprochen: 'Editor', id: 'editor' };

test('Zielanwendung: erkennt die Wendung und fuegt bei unerreichbarem Ziel nichts ein', async () => {
  const { app, window } = await launchApp({ withCompany: true, withConsent: true });
  try {
    const api = bridge(window);
    // Einfuegen waere ab hier moeglich: Freigabe gesetzt, Paste gemockt.
    await api.devSetAccessibility(true);
    await api.devMockPaste(true);

    // 1. Ausgeschaltet (Auslieferungszustand): die Wendung bleibt stehen und
    //    der Text wird ganz normal eingefuegt.
    const aus = await api.devRunTargetedResult('Das Angebot ist geprüft an Word senden');
    expect(aus.zielId).toBeNull();
    expect(aus.pasted).toBe(true);
    expect(await api.devGetPasteCalls()).toBe(1);

    // 2. Einschalten und ein Ziel nennen, das es hier nicht gibt.
    expect((await api.setAufbereitung({ ...SCHALTER_AUS, zielanwendung: true })).ok).toBe(true);
    const an = await api.devRunTargetedResult(
      `Die Unterlagen sind vollständig an ${unerreichbaresZiel.gesprochen} senden`,
    );
    // Die Wendung wurde erkannt ...
    expect(an.zielId).toBe(unerreichbaresZiel.id);
    // ... und genau deshalb wurde NICHTS eingefuegt.
    expect(an.pasted).toBe(false);
    expect(an.message ?? '').not.toBe('');
    // Der Zaehler steht unveraendert bei 1: kein zweites Einfuegen.
    expect(await api.devGetPasteCalls()).toBe(1);

    // 3. Eingeschaltet, aber ohne Wendung: alles laeuft wie gewohnt.
    const ohneBefehl = await api.devRunTargetedResult('Ein ganz normales Diktat ohne Zielangabe');
    expect(ohneBefehl.zielId).toBeNull();
    expect(ohneBefehl.pasted).toBe(true);
    expect(await api.devGetPasteCalls()).toBe(2);
  } finally {
    await app.close();
  }
});
