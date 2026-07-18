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
import { berechneWer, berechneWerNormiert } from '../../src/shared/wer';
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
      { woerter: number; fehlerRoh: number; fehlerNorm: number; fehlerAufbereitet: number }
    >();
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
      'id'.padEnd(14) + 'roh'.padStart(8) + 'normiert'.padStart(10) + 'aufbereitet'.padStart(13),
    );

    for (const d of diktate) {
      const pcm = loadWavPcm(join(KORPUS_DIR, d.wav16));
      const outcome = await transcribeWithVadGate(whisper, vad, pcm, TUNING);
      audioMsGesamt += outcome.audioMs;
      rechenMsGesamt += outcome.durationMs;

      const roh = berechneWer(d.referenz, outcome.text);
      const norm = berechneWerNormiert(d.referenz, outcome.text);
      const aufbereitet = berechneWerNormiert(
        d.referenz,
        aufbereitenText(outcome.text, optionen, 'de'),
      );

      const eintrag = proKategorie.get(d.kategorie) ?? {
        woerter: 0,
        fehlerRoh: 0,
        fehlerNorm: 0,
        fehlerAufbereitet: 0,
      };
      eintrag.woerter += norm.woerter;
      eintrag.fehlerRoh += roh.ersetzungen + roh.loeschungen + roh.einfuegungen;
      eintrag.fehlerNorm += norm.ersetzungen + norm.loeschungen + norm.einfuegungen;
      eintrag.fehlerAufbereitet +=
        aufbereitet.ersetzungen + aufbereitet.loeschungen + aufbereitet.einfuegungen;
      proKategorie.set(d.kategorie, eintrag);

      schreibe(
        d.id.padEnd(14) +
          roh.wer.toFixed(3).padStart(8) +
          norm.wer.toFixed(3).padStart(10) +
          aufbereitet.wer.toFixed(3).padStart(13),
      );
    }

    schreibe('');
    schreibe('--- je Kategorie (normierte WER) ---');
    let woerterGesamt = 0;
    let fehlerNormGesamt = 0;
    let fehlerAufbereitetGesamt = 0;
    for (const [kategorie, e] of proKategorie) {
      woerterGesamt += e.woerter;
      fehlerNormGesamt += e.fehlerNorm;
      fehlerAufbereitetGesamt += e.fehlerAufbereitet;
      schreibe(
        `${kategorie.padEnd(16)} normiert ${(e.fehlerNorm / e.woerter).toFixed(3)}  ` +
          `aufbereitet ${(e.fehlerAufbereitet / e.woerter).toFixed(3)}`,
      );
    }
    const gesamtNorm = fehlerNormGesamt / woerterGesamt;
    const gesamtAufbereitet = fehlerAufbereitetGesamt / woerterGesamt;
    const rtf = rechenMsGesamt / audioMsGesamt;
    schreibe('');
    schreibe('--- gesamt ---');
    schreibe(`WER normiert:     ${gesamtNorm.toFixed(3)}`);
    schreibe(`WER aufbereitet:  ${gesamtAufbereitet.toFixed(3)}`);
    schreibe(
      `Laufzeit: ${(rechenMsGesamt / 1000).toFixed(1)} s fuer ${(audioMsGesamt / 1000).toFixed(1)} s Audio (RTF ${rtf.toFixed(3)})`,
    );
    writeFileSync(join(KORPUS_DIR, 'bericht.txt'), zeilen.join('\n') + '\n', 'utf8');

    // Der Messstand selbst muss funktionieren: es wurde etwas transkribiert.
    expect(woerterGesamt).toBeGreaterThan(0);
    // Die Aufbereitung darf die WER nicht deutlich verschlechtern. Genau das
    // wuerde ein Bug in der Nachbearbeitung anzeigen (siehe V6).
    expect(gesamtAufbereitet).toBeLessThanOrEqual(gesamtNorm + 0.02);
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
