/**
 * WER-Messstand. Laeuft NICHT in der CI (eigene Config, eigener Include), weil
 * er die grossen Modelle laedt. Aufruf: npm run wer.
 *
 * Er transkribiert jedes Diktat des synthetischen Korpus (intern/wer-korpus,
 * gitignored) mit den echten Modellen ueber genau den Produktivpfad
 * (transcribeWithVadGate) und misst die Wortfehlerrate: roh, normiert und nach
 * der Textaufbereitung. So wird sichtbar, ob eine Aenderung die Erkennung oder
 * die Nachbearbeitung verbessert oder verschlechtert.
 *
 * Fehlt das Korpus (nicht generiert) oder die Modelle, wird sauber
 * uebersprungen, damit der Lauf nicht haengt.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  initWhisper,
  initWhisperVad,
  type WhisperContext,
  type WhisperVadContext,
} from '@fugood/whisper.node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { transcribeWithVadGate, type VadTuning } from '../../src/main/whisper/segmenter';
import { aufbereitenText, defaultAufbereitungOptions } from '../../src/shared/textaufbereitung';
import { buildInitialPrompt } from '../../src/shared/vokabular';
import {
  berechneWer,
  berechneWerInhaltlichMitDiff,
  berechneWerNormiert,
  berechneWerNormiertMitDiff,
  formatiereWerAbweichungen,
  normalisiereInhaltlich,
} from '../../src/shared/wer';
import {
  loadWavPcm,
  modelsAvailable,
  sileroModelPath,
  whisperModelPath,
} from '../integration/model-fixtures';

const KORPUS_DIR = join(import.meta.dirname, '..', '..', 'intern', 'wer-korpus');
const MANIFEST = join(KORPUS_DIR, 'manifest.json');
const korpusVorhanden = existsSync(MANIFEST);

const TUNING: VadTuning = {
  threshold: 0.5,
  minSpeechDurationMs: 250,
  minSilenceDurationMs: 500,
  maxSpeechDurationS: 25,
};

interface Diktat {
  readonly id: string;
  readonly kategorie: string;
  readonly voice: string;
  readonly referenz: string;
  readonly wav16: string;
  readonly wav48: string;
}

function ladeManifest(): Diktat[] {
  const roh = JSON.parse(readFileSync(MANIFEST, 'utf8')) as { diktate: Diktat[] };
  return roh.diktate;
}

const bereit = modelsAvailable && korpusVorhanden;

describe.skipIf(!bereit)('WER-Messung (lokal, Korpus und Modelle vorhanden)', () => {
  let whisper: WhisperContext;
  let vad: WhisperVadContext;
  let diktate: Diktat[];

  beforeAll(async () => {
    whisper = await initWhisper({
      filePath: whisperModelPath,
      useGpu: process.platform === 'darwin',
    });
    vad = await initWhisperVad({ filePath: sileroModelPath, useGpu: false, nThreads: 4 });
    diktate = ladeManifest();
  });

  afterAll(async () => {
    await whisper.release();
    await vad.release();
  });

  it('misst die WER je Diktat und Kategorie und berichtet', async () => {
    const optionen = defaultAufbereitungOptions();
    const proKategorie = new Map<
      string,
      {
        woerter: number;
        woerterInhalt: number;
        fehlerRoh: number;
        fehlerNorm: number;
        fehlerAufbereitet: number;
        fehlerInhalt: number;
      }
    >();
    const abweichungen = new Map<string, string[]>();
    const abweichungenInhalt = new Map<string, string[]>();
    let audioMsGesamt = 0;
    let rechenMsGesamt = 0;
    // Der Bericht wird gesammelt und am Ende sowohl ausgegeben als auch in eine
    // Datei geschrieben, damit er als Vergleichsbasis dauerhaft vorliegt.
    const zeilen: string[] = [];
    const schreibe = (text: string): void => {
      zeilen.push(text);
      console.log(text);
    };

    schreibe('=== WER-Bericht ===');
    schreibe(`Modell: ${whisperModelPath.split('/').pop() ?? ''}`);
    schreibe(
      'id'.padEnd(14) +
        'roh'.padStart(8) +
        'normiert'.padStart(10) +
        'aufbereitet'.padStart(13) +
        'inhaltlich'.padStart(13),
    );

    for (const d of diktate) {
      const pcm = loadWavPcm(join(KORPUS_DIR, d.wav16));
      const outcome = await transcribeWithVadGate(whisper, vad, pcm, TUNING);
      audioMsGesamt += outcome.audioMs;
      rechenMsGesamt += outcome.durationMs;

      const roh = berechneWer(d.referenz, outcome.text);
      const normDiff = berechneWerNormiertMitDiff(d.referenz, outcome.text);
      const norm = normDiff;
      const aufbereitet = berechneWerNormiert(
        d.referenz,
        aufbereitenText(outcome.text, optionen, 'de'),
      );
      // Die format-neutrale Sicht: Zahl- und Einheitenschreibung zaehlen nicht
      // als Fehler. Der Unterschied zur normierten WER ist genau der Anteil,
      // der nur Schreibkonvention ist und nichts ueber die Erkennung sagt.
      const inhalt = berechneWerInhaltlichMitDiff(d.referenz, outcome.text);
      // Die Abweichungen wortweise merken: eine WER-Zahl allein sagt nicht,
      // WORAN es liegt (Zahlenformat, Fachwort, Endung).
      abweichungen.set(d.id, formatiereWerAbweichungen(normDiff.operationen));
      abweichungenInhalt.set(d.id, formatiereWerAbweichungen(inhalt.operationen));

      const eintrag = proKategorie.get(d.kategorie) ?? {
        woerter: 0,
        woerterInhalt: 0,
        fehlerRoh: 0,
        fehlerNorm: 0,
        fehlerAufbereitet: 0,
        fehlerInhalt: 0,
      };
      eintrag.woerter += norm.woerter;
      eintrag.woerterInhalt += inhalt.woerter;
      eintrag.fehlerRoh += roh.ersetzungen + roh.loeschungen + roh.einfuegungen;
      eintrag.fehlerNorm += norm.ersetzungen + norm.loeschungen + norm.einfuegungen;
      eintrag.fehlerAufbereitet +=
        aufbereitet.ersetzungen + aufbereitet.loeschungen + aufbereitet.einfuegungen;
      eintrag.fehlerInhalt += inhalt.ersetzungen + inhalt.loeschungen + inhalt.einfuegungen;
      proKategorie.set(d.kategorie, eintrag);

      schreibe(
        d.id.padEnd(14) +
          roh.wer.toFixed(3).padStart(8) +
          norm.wer.toFixed(3).padStart(10) +
          aufbereitet.wer.toFixed(3).padStart(13) +
          inhalt.wer.toFixed(3).padStart(13),
      );
    }

    schreibe('');
    schreibe('--- je Kategorie (normierte WER) ---');
    let woerterGesamt = 0;
    let woerterInhaltGesamt = 0;
    let fehlerNormGesamt = 0;
    let fehlerAufbereitetGesamt = 0;
    let fehlerInhaltGesamt = 0;
    for (const [kategorie, e] of proKategorie) {
      woerterGesamt += e.woerter;
      woerterInhaltGesamt += e.woerterInhalt;
      fehlerNormGesamt += e.fehlerNorm;
      fehlerAufbereitetGesamt += e.fehlerAufbereitet;
      fehlerInhaltGesamt += e.fehlerInhalt;
      schreibe(
        `${kategorie.padEnd(16)} normiert ${(e.fehlerNorm / e.woerter).toFixed(3)}  ` +
          `aufbereitet ${(e.fehlerAufbereitet / e.woerter).toFixed(3)}  ` +
          `inhaltlich ${(e.fehlerInhalt / e.woerterInhalt).toFixed(3)}`,
      );
    }
    const gesamtNorm = fehlerNormGesamt / woerterGesamt;
    const gesamtAufbereitet = fehlerAufbereitetGesamt / woerterGesamt;
    const gesamtInhalt = fehlerInhaltGesamt / woerterInhaltGesamt;
    const rtf = rechenMsGesamt / audioMsGesamt;
    schreibe('');
    schreibe('--- gesamt ---');
    schreibe(`WER normiert:     ${gesamtNorm.toFixed(3)}`);
    schreibe(`WER aufbereitet:  ${gesamtAufbereitet.toFixed(3)}`);
    schreibe(`WER inhaltlich:   ${gesamtInhalt.toFixed(3)}  (ohne Zahl- und Einheitenschreibung)`);
    schreibe(
      `Laufzeit: ${(rechenMsGesamt / 1000).toFixed(1)} s fuer ${(audioMsGesamt / 1000).toFixed(1)} s Audio (RTF ${rtf.toFixed(3)})`,
    );
    schreibe('');
    schreibe('--- Abweichungen je Diktat (normiert, Referenz -> Transkript) ---');
    for (const [id, liste] of abweichungen) {
      schreibe(`${id}: ${liste.length === 0 ? 'keine' : liste.join(' | ')}`);
    }
    schreibe('');
    schreibe('--- davon echte Erkennungsfehler (inhaltliche Sicht) ---');
    for (const [id, liste] of abweichungenInhalt) {
      schreibe(`${id}: ${liste.length === 0 ? 'keine' : liste.join(' | ')}`);
    }
    writeFileSync(join(KORPUS_DIR, 'bericht.txt'), zeilen.join('\n') + '\n', 'utf8');

    // Der Messstand selbst muss funktionieren: es wurde etwas transkribiert.
    expect(woerterGesamt).toBeGreaterThan(0);
    // Die Aufbereitung darf die WER nicht deutlich verschlechtern. Genau das
    // wuerde ein Bug in der Nachbearbeitung anzeigen (siehe V6).
    expect(gesamtAufbereitet).toBeLessThanOrEqual(gesamtNorm + 0.02);
  });

  it('misst, was ein Fach-Prompt bringt und ob er ins Transkript blutet', async () => {
    // Fachbegriffe je Zielgruppe, wie sie eine Kanzlei oder Praxis in ihrem
    // Woerterbuch stehen haette. Sie gehen als Initial-Prompt an das Modell.
    // Gemessen wird gegen die inhaltliche Sicht, weil nur sie echte
    // Erkennungsfehler zeigt und nicht die Zahlenschreibung.
    const begriffeJeKategorie = new Map<string, string[]>([
      [
        'arztbrief',
        ['Sonographie', 'Gallenblase', 'Konkremente', 'Pantoprazol', 'Wiedervorstellung'],
      ],
      [
        'schriftsatz',
        ['Bürgerliches Gesetzbuch', 'Bundesgerichtshof', 'Fristablauf', 'Fälligkeit'],
      ],
      [
        'steuerberater',
        [
          'Umsatzsteuervoranmeldung',
          'Investitionsabzugsbetrag',
          'Betriebsausgabe',
          'Wirtschaftsjahr',
        ],
      ],
      [
        'handwerker',
        ['Verbundsicherheitsglas', 'Aluminiumprofile', 'Wandstärke', 'Dachrinne', 'Kupferrohr'],
      ],
    ]);

    const zeilen: string[] = [];
    const schreibe = (text: string): void => {
      zeilen.push(text);
      console.log(text);
    };
    schreibe('=== Fach-Prompt-Vergleich (inhaltliche WER) ===');
    schreibe('id'.padEnd(14) + 'ohne'.padStart(8) + 'mit'.padStart(8) + '  Bleeding');

    let woerterGesamt = 0;
    let fehlerOhne = 0;
    let fehlerMit = 0;
    const bleedingGesamt: string[] = [];

    for (const d of diktate) {
      const begriffe = begriffeJeKategorie.get(d.kategorie) ?? [];
      const { prompt } = buildInitialPrompt(begriffe);
      const pcm = loadWavPcm(join(KORPUS_DIR, d.wav16));
      const ohne = await transcribeWithVadGate(whisper, vad, pcm, TUNING);
      const mit = await transcribeWithVadGate(whisper, vad, pcm, TUNING, {
        language: 'de',
        ...(prompt === null ? {} : { prompt }),
      });

      const werOhne = berechneWerInhaltlichMitDiff(d.referenz, ohne.text);
      const werMit = berechneWerInhaltlichMitDiff(d.referenz, mit.text);
      woerterGesamt += werMit.woerter;
      fehlerOhne += werOhne.ersetzungen + werOhne.loeschungen + werOhne.einfuegungen;
      fehlerMit += werMit.ersetzungen + werMit.loeschungen + werMit.einfuegungen;

      // Prompt-Bleeding: ein Begriff steht im Transkript, obwohl er im Diktat
      // gar nicht gesprochen wurde. Das waere ein echter Produktfehler, denn
      // das Woerterbuch darf Inhalte nie erfinden.
      const imTranskript = normalisiereInhaltlich(mit.text);
      const inReferenz = normalisiereInhaltlich(d.referenz);
      const geblutet = begriffe.filter((begriff) => {
        const norm = normalisiereInhaltlich(begriff);
        return imTranskript.includes(norm) && !inReferenz.includes(norm);
      });
      bleedingGesamt.push(...geblutet.map((b) => `${d.id}: ${b}`));

      schreibe(
        d.id.padEnd(14) +
          werOhne.wer.toFixed(3).padStart(8) +
          werMit.wer.toFixed(3).padStart(8) +
          '  ' +
          (geblutet.length === 0 ? 'keins' : geblutet.join(', ')),
      );
      const abweichungenMit = formatiereWerAbweichungen(werMit.operationen);
      if (abweichungenMit.length > 0) {
        schreibe(`   mit Prompt: ${abweichungenMit.join(' | ')}`);
      }
    }

    schreibe('');
    schreibe(`inhaltliche WER ohne Prompt: ${(fehlerOhne / woerterGesamt).toFixed(3)}`);
    schreibe(`inhaltliche WER mit Prompt:  ${(fehlerMit / woerterGesamt).toFixed(3)}`);
    schreibe(
      `Prompt-Bleeding: ${bleedingGesamt.length === 0 ? 'keins' : bleedingGesamt.join(' | ')}`,
    );
    writeFileSync(join(KORPUS_DIR, 'bericht-prompt.txt'), zeilen.join('\n') + '\n', 'utf8');

    // Bewusst KEINE Assertion darauf, dass der Prompt die WER senkt. Die
    // Messung hat gezeigt, dass er das auf sauberem Audio nicht tut (Details im
    // Bericht); eine Assertion darauf waere eine Wunschvorstellung, kein Gate.
    // Der Messstand berichtet die Wirkung, entschieden wird sie draussen.
    expect(woerterGesamt).toBeGreaterThan(0);
    // Das hier ist dagegen eine echte Produktgarantie: Das Woerterbuch darf
    // niemals Inhalte in ein Diktat schreiben, die nicht gesprochen wurden.
    expect(bleedingGesamt).toEqual([]);
  });

  it('ist reproduzierbar (temperature 0 liefert zweimal dasselbe)', async () => {
    const erstes = ladeManifest()[0];
    if (erstes === undefined) {
      return;
    }
    const pcm = loadWavPcm(join(KORPUS_DIR, erstes.wav16));
    const a = await transcribeWithVadGate(whisper, vad, pcm, TUNING);
    const b = await transcribeWithVadGate(whisper, vad, pcm, TUNING);
    expect(a.text).toBe(b.text);
  });
});
