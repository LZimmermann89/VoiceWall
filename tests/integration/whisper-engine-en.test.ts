/**
 * Integrationstest der Diktatsprache Englisch gegen das echte
 * mehrsprachige Originalmodell (large-v3-turbo, Q5_0) und das eingecheckte
 * englische Test-WAV (erzeugt mit macOS `say -v Samantha`). Laeuft NUR
 * lokal: fehlt das EN-Modell (z. B. in der CI), wird der Block sauber
 * uebersprungen.
 *
 * Belegt werden:
 * 1. Ein englisches Test-WAV wird mit `language: 'en'` korrekt transkribiert
 *    (tolerant auf Schluesselwoerter statt exaktem Vergleich).
 * 2. Anti-Halluzinations-Garantie gilt unveraendert: Stille erzeugt auch mit
 *    dem mehrsprachigen Modell keinen Text.
 */
import { join } from 'node:path';
import {
  initWhisper,
  initWhisperVad,
  type WhisperContext,
  type WhisperVadContext,
} from '@fugood/whisper.node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { transcribeWithVadGate, type VadTuning } from '../../src/main/whisper/segmenter';
import {
  loadWavPcm,
  makeSilencePcm,
  modelsAvailableEn,
  multilingualModelPath,
  sileroModelPath,
} from './model-fixtures';

const TUNING: VadTuning = {
  threshold: 0.5,
  minSpeechDurationMs: 250,
  minSilenceDurationMs: 500,
  maxSpeechDurationS: 25,
};

const wavPath = join(import.meta.dirname, '..', 'fixtures', 'testdiktat-en.wav');

describe.skipIf(!modelsAvailableEn)('Whisper-Engine Englisch (lokal, EN-Modell vorhanden)', () => {
  let whisper: WhisperContext;
  let vad: WhisperVadContext;

  beforeAll(async () => {
    whisper = await initWhisper({
      filePath: multilingualModelPath,
      useGpu: process.platform === 'darwin',
    });
    vad = await initWhisperVad({ filePath: sileroModelPath, useGpu: false, nThreads: 4 });
  });

  afterAll(async () => {
    await whisper.release();
    await vad.release();
  });

  it('transkribiert ein englisches Test-WAV korrekt (language en)', async () => {
    const pcm = loadWavPcm(wavPath);
    const outcome = await transcribeWithVadGate(whisper, vad, pcm, TUNING, { language: 'en' });

    // Beleg fuer die Doku (Transkript + Latenz).
    console.log(
      `[Integration EN] Transkript: "${outcome.text}" (${String(outcome.durationMs)} ms fuer ${(
        outcome.audioMs / 1000
      ).toFixed(2)} s Audio)`,
    );

    expect(outcome.hadSpeech).toBe(true);
    const lower = outcome.text.toLowerCase();
    // Tolerant auf Schluesselwoerter statt exaktem Vergleich.
    const hits = ['hello', 'test', 'recording', 'voice'].filter((word) => lower.includes(word));
    expect(hits.length).toBeGreaterThan(1);
  });

  it('erzeugt bei Stille keinen Text (Anti-Halluzination, EN-Modell)', async () => {
    const silence = makeSilencePcm(2);
    const outcome = await transcribeWithVadGate(whisper, vad, silence, TUNING, { language: 'en' });
    expect(outcome.hadSpeech).toBe(false);
    expect(outcome.text).toBe('');
  });
});
