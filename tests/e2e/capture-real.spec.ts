/**
 * Regressionstest fuer den ECHTEN Aufnahmepfad (gefunden im manuellen
 * Praxistest am 03.07.2026): getUserMedia im versteckten Capture-Fenster,
 * AudioWorklet als Blob-URL, PCM-Fluss bis zur Pegelanzeige.
 *
 * Hintergrund: Chromium prueft AudioWorklet-Module gegen script-src, nicht
 * gegen worker-src. Die Capture-CSP ohne `script-src blob:` liess addModule
 * mit "Unable to load a worklet's module." scheitern; alle bisherigen E2E
 * liefen ueber die PCM-Injektion und konnten das nicht sehen.
 *
 * Der Test nutzt Chromiums Fake-Mikrofon (--use-fake-device-for-media-stream
 * liefert ein Testsignal, --use-fake-ui-for-media-stream unterdrueckt den
 * Berechtigungsdialog). Damit laeuft der komplette reale Pfad ohne
 * physisches Mikrofon und ohne TCC-Dialog.
 *
 * WICHTIG zum Testsignal, gemessen am 10.08.2026: Es ist KEIN Dauerton,
 * sondern pulsiert. Zwischen den Toenen liegt der Pegel sekundenlang bei
 * null. Beide Beweise unten sind deshalb auf AUFZEICHNUNG gebaut (was ist
 * unterwegs passiert?) statt auf Abfrage des Momentanwerts (was ist gerade?).
 * Ein Test, der ein Tonfenster treffen muss, ist ein Wuerfelspiel.
 */
import { expect, test } from '@playwright/test';
import { modelsAvailable } from '../integration/model-fixtures';
import { launchApp } from './launch';

/** Schmale Sicht auf die Preload-Bruecke fuer window.evaluate. */
interface CaptureBridge {
  voicewall: {
    prepareModels: () => Promise<{ ok: boolean; message?: string }>;
    startDictation: () => Promise<{ ok: boolean; message?: string }>;
    stopDictation: () => Promise<{ ok: boolean; message?: string }>;
    onAudioLevel: (listener: (level: { rms: number }) => void) => () => void;
  };
}

/**
 * Sammelstellen im Renderer: die eingetroffenen Pegelwerte und jeder Zustand,
 * den die Anzeige unterwegs hatte.
 *
 * Warum mitschreiben statt einfach nachschauen: Chromiums Fake-Mikrofon
 * liefert KEINEN Dauerton, sondern ein pulsierendes Signal. Zwischen den
 * Toenen liegt der Pegel sekundenlang bei null, und die Anzeige zeigt den
 * aktuellen Wert. Wer den Zustand nur abfragt, muss zufaellig ein Tonfenster
 * treffen; genau daran hing die Flakiness. Aufgezeichnet ist die Frage
 * dagegen eindeutig beantwortbar: hat die Anzeige jemals ausgeschlagen?
 */
interface PegelSammler {
  __pegel?: number[];
  __anzeige?: string[];
}

/**
 * Schmale DOM-Sicht fuer den evaluate-Kontext: die E2E-Umgebung ist auf Node
 * typisiert und kennt weder document noch MutationObserver. Deklariert wird
 * genau das bisschen, das hier gebraucht wird, wie bei der Bridge oben auch.
 */
interface DomSicht {
  readonly document: {
    readonly querySelector: (auswahl: string) => { readonly className: string } | null;
  };
  readonly MutationObserver: new (rueckruf: () => void) => {
    readonly observe: (
      ziel: unknown,
      optionen: { attributes: boolean; attributeFilter: string[] },
    ) => void;
  };
}

/**
 * Zeitbudget bis zum ersten Pegel. Grosszuegig, weil davor die Engine startet
 * (Modell laden, auf macOS zusaetzlich Metal initialisieren) und der Test auf
 * einer ausgelasteten Maschine mitlaeuft: mit den urspruenglichen 15 Sekunden
 * war er im Einzellauf gruen (rund 16 s Gesamtlaufzeit) und im Suitenlauf rot.
 * Ein Test, der von der Maschinenlast abhaengt, misst nicht mehr das Produkt.
 */
const PEGEL_TIMEOUT_MS = 45_000;

test('Echter Aufnahmepfad: Worklet laedt, Fake-Mikrofon erzeugt Pegel (kein Mikrofon-Fehler)', async () => {
  test.skip(!modelsAvailable, 'Whisper-/VAD-Modelle liegen nicht im lokalen userData.');

  const { app, window } = await launchApp({
    withCompany: true,
    linkModels: true,
    withConsent: true,
    extraArgs: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  try {
    // Engine starten (Modelle sind verlinkt, kein Download).
    const prepared = await window.evaluate(async () =>
      (globalThis as unknown as CaptureBridge).voicewall.prepareModels(),
    );
    expect(prepared.ok).toBe(true);

    // Pegel-Ereignisse ab jetzt mitschreiben. Das ist der belastbare Beweis
    // fuer den PCM-Fluss: er haengt weder am Rendern der Anzeige noch am
    // Abklingen des Balkens, sondern nur daran, dass Audio ankommt.
    await window.evaluate(() => {
      const w = globalThis as unknown as CaptureBridge & PegelSammler;
      w.__pegel = [];
      w.voicewall.onAudioLevel((level) => {
        w.__pegel?.push(level.rms);
      });
      // Jede Klassenaenderung der Pegelanzeige festhalten, damit ein kurzer
      // Ausschlag zwischen zwei Abfragen nicht verloren geht.
      w.__anzeige = [];
      const dom = globalThis as unknown as DomSicht;
      const balken = dom.document.querySelector('[data-testid="level-fill"]');
      if (balken !== null) {
        w.__anzeige.push(balken.className);
        new dom.MutationObserver(() => {
          w.__anzeige?.push(balken.className);
        }).observe(balken, { attributes: true, attributeFilter: ['class'] });
      }
    });

    // Echte Aufnahme starten: oeffnet das Capture-Fenster, laedt das
    // AudioWorklet-Modul und streamt PCM des Fake-Mikrofons.
    const started = await window.evaluate(async () =>
      (globalThis as unknown as CaptureBridge).voicewall.startDictation(),
    );
    expect(started.ok).toBe(true);

    // Kern-Beweis 1: Es kommt ueberhaupt Audio an, und zwar hoerbares (der
    // Fake-Ton hat einen RMS deutlich ueber null, Stille laege bei ~0).
    await expect
      .poll(
        async () =>
          window.evaluate(() => {
            const pegel = (globalThis as unknown as PegelSammler).__pegel ?? [];
            return Math.max(0, ...pegel);
          }),
        {
          timeout: PEGEL_TIMEOUT_MS,
          message: 'Es kam kein Pegel an: das Worklet laeuft nicht oder es fliesst kein PCM.',
        },
      )
      .toBeGreaterThan(0.01);

    // Kern-Beweis 2: Der Pegel kommt auch in der Anzeige an (die Kette bis in
    // die Oberflaeche, nicht nur bis in den Main-Prozess). Geprueft wird der
    // aufgezeichnete Verlauf, nicht der Momentanwert (siehe PegelSammler).
    await expect
      .poll(
        async () =>
          window.evaluate(() =>
            ((globalThis as unknown as PegelSammler).__anzeige ?? []).some((klasse) =>
              /lvl-[1-9]/.test(klasse),
            ),
          ),
        {
          timeout: PEGEL_TIMEOUT_MS,
          message: 'Die Pegelanzeige hat nie ausgeschlagen, obwohl Pegel ankamen.',
        },
      )
      .toBe(true);

    // Kein Mikrofon-/Worklet-Fehler in der UI.
    const bodyText = await window.locator('body').innerText();
    expect(bodyText).not.toContain("worklet's module");
    expect(bodyText).not.toContain('Mikrofonzugriff ist fehlgeschlagen');

    const stopped = await window.evaluate(async () =>
      (globalThis as unknown as CaptureBridge).voicewall.stopDictation(),
    );
    expect(stopped.ok).toBe(true);
  } finally {
    await app.close();
  }
});
