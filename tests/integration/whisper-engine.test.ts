/**
 * Integrationstest der Whisper-/VAD-Kernlogik gegen die echten Modelle und das
 * eingecheckte deutsche Test-WAV. Laeuft NUR lokal: fehlen die Modelle im
 * userData-Ordner (z. B. in der CI), wird der gesamte Block sauber
 * uebersprungen.
 *
 * Getestet wird die reale Transkription plus die Anti-Halluzinations-Schleuse:
 * Sprache liefert korrekten deutschen Text, Stille liefert bewusst keinen Text.
 * Das Prozessmodell (utilityProcess) wird hier bewusst umgangen (unter Vitest
 * gibt es keinen Electron-utilityProcess); die identische Kernlogik aus
 * segmenter.ts wird direkt gegen initWhisper/initWhisperVad geprueft.
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
  modelsAvailable,
  sileroModelPath,
  whisperModelPath,
} from './model-fixtures';

const TUNING: VadTuning = {
  threshold: 0.5,
  minSpeechDurationMs: 250,
  minSilenceDurationMs: 500,
  maxSpeechDurationS: 25,
};

const wavPath = join(import.meta.dirname, '..', 'fixtures', 'testdiktat-de.wav');

describe.skipIf(!modelsAvailable)('Whisper-Engine (lokal, Modelle vorhanden)', () => {
  let whisper: WhisperContext;
  let vad: WhisperVadContext;

  beforeAll(async () => {
    whisper = await initWhisper({
      filePath: whisperModelPath,
      useGpu: process.platform === 'darwin',
    });
    vad = await initWhisperVad({ filePath: sileroModelPath, useGpu: false, nThreads: 4 });
  });

  afterAll(async () => {
    await whisper.release();
    await vad.release();
  });

  it('transkribiert ein deutsches Test-WAV korrekt', async () => {
    const pcm = loadWavPcm(wavPath);
    const outcome = await transcribeWithVadGate(whisper, vad, pcm, TUNING);

    // Beleg fuer die Doku (Transkript + Latenz).
    console.log(
      `[Integration] Transkript: "${outcome.text}" (${String(outcome.durationMs)} ms fuer ${(
        outcome.audioMs / 1000
      ).toFixed(2)} s Audio)`,
    );

    expect(outcome.hadSpeech).toBe(true);
    const lower = outcome.text.toLowerCase();
    // Tolerant auf Schluesselwoerter statt exaktem Vergleich.
    const hits = ['test', 'diktat', 'guten', 'voice'].filter((word) => lower.includes(word));
    expect(hits.length).toBeGreaterThan(0);
  });

  it('erzeugt bei Stille keinen Text (Anti-Halluzination)', async () => {
    const silence = makeSilencePcm(2);
    const outcome = await transcribeWithVadGate(whisper, vad, silence, TUNING);
    expect(outcome.hadSpeech).toBe(false);
    expect(outcome.text).toBe('');
  });
});
