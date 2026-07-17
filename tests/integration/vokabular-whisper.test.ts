/**
 * Integrationstest des Fach-Woerterbuchs (Stufe 1) gegen die echten Modelle
 * und das eingecheckte deutsche Test-WAV. Laeuft NUR lokal: fehlen die
 * Modelle (z. B. in der CI), wird der Block sauber uebersprungen.
 *
 * Belegt werden:
 * 1. Die bekannte Fehltranskription "Voice Wall" wird durch die
 *    Ersetzungsliste deterministisch zu "VoiceWall" korrigiert.
 * 2. Der Initial-Prompt (Komma-Liste aus Begriffen) verbessert die Erkennung
 *    direkt im Modell (empirische Grundlage dieser Entscheidung).
 * 3. Anti-Halluzinations-Garantie: Stille erzeugt auch MIT gesetztem
 *    Initial-Prompt keinen Text (der VAD-Gate-Pfad laeuft vor und unabhaengig
 *    vom Prompt).
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
import { applyErsetzungen, buildInitialPrompt } from '../../src/shared/vokabular';
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

describe.skipIf(!modelsAvailable)('Fach-Woerterbuch (lokal, Modelle vorhanden)', () => {
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

  it('Ersetzungsliste korrigiert die bekannte Fehltranskription "Voice Wall" zu "VoiceWall"', async () => {
    const pcm = loadWavPcm(wavPath);
    const outcome = await transcribeWithVadGate(whisper, vad, pcm, TUNING);
    expect(outcome.hadSpeech).toBe(true);
    // Ohne Prompt transkribiert das Modell den Produktnamen als "Voice Wall"
    // (die bekannte Fehltranskription, perfekter Testfall).
    expect(outcome.text).toContain('Voice Wall');

    const korrigiert = applyErsetzungen(outcome.text, [{ von: 'Voice Wall', zu: 'VoiceWall' }]);
    console.log(`[Integration Stufe 1] roh: "${outcome.text}" korrigiert: "${korrigiert}"`);
    expect(korrigiert).toContain('VoiceWall');
    expect(korrigiert).not.toContain('Voice Wall');
  });

  it('Initial-Prompt (Komma-Liste) verbessert die Erkennung direkt', async () => {
    const pcm = loadWavPcm(wavPath);
    const built = buildInitialPrompt(['VoiceWall', 'Müller GmbH']);
    expect(built.prompt).toBe('VoiceWall, Müller GmbH');
    const outcome = await transcribeWithVadGate(
      whisper,
      vad,
      pcm,
      TUNING,
      built.prompt === null ? undefined : { prompt: built.prompt },
    );
    console.log(`[Integration Stufe 1] mit Prompt: "${outcome.text}"`);
    expect(outcome.hadSpeech).toBe(true);
    expect(outcome.text).toContain('VoiceWall');
  });

  it('Stille erzeugt auch MIT gesetztem Prompt keinen Text (Anti-Halluzination)', async () => {
    const silence = makeSilencePcm(2);
    const built = buildInitialPrompt(['VoiceWall', 'Müller GmbH', 'Aktenzeichen 4711']);
    const outcome = await transcribeWithVadGate(
      whisper,
      vad,
      silence,
      TUNING,
      built.prompt === null ? undefined : { prompt: built.prompt },
    );
    expect(outcome.hadSpeech).toBe(false);
    expect(outcome.text).toBe('');
  });
});
