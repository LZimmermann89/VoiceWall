/**
 * Beweis-Test: Waehrend einer echten Transkription (RAM-only, ArrayBuffer)
 * entsteht keine Audiodatei auf der Platte. Ueberwacht werden das
 * System-Temp-Verzeichnis und ein simuliertes Firmen-/Arbeitsverzeichnis.
 *
 * Ehrliche Restdimension: Dieser Test belegt, dass VoiceWall selbst kein
 * Rohaudio als Datei schreibt. Er kann prinzipbedingt NICHT ausschliessen,
 * dass das Betriebssystem Teile des Prozessspeichers in die Swap-Datei
 * auslagert oder ein Kernel-Crash-Dump RAM-Inhalt enthaelt. Diese Restdimension
 * ist dokumentiert und wird nicht als geloest behauptet.
 *
 * Laeuft NUR lokal (Modelle vorhanden), sonst uebersprungen.
 */
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { watch, type FSWatcher } from 'node:fs';
import {
  initWhisper,
  initWhisperVad,
  type WhisperContext,
  type WhisperVadContext,
} from '@fugood/whisper.node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { transcribeWithVadGate, type VadTuning } from '../../src/main/whisper/segmenter';
import { loadWavPcm, modelsAvailable, sileroModelPath, whisperModelPath } from './model-fixtures';

const AUDIO_EXTENSIONS = /\.(wav|mp3|webm|pcm|aiff?|m4a|ogg|flac|caf)$/i;
const TUNING: VadTuning = {
  threshold: 0.5,
  minSpeechDurationMs: 250,
  minSilenceDurationMs: 500,
  maxSpeechDurationS: 25,
};
const wavPath = join(import.meta.dirname, '..', 'fixtures', 'testdiktat-de.wav');

describe.skipIf(!modelsAvailable)('Kein Audio auf Platte (lokal)', () => {
  let whisper: WhisperContext;
  let vad: WhisperVadContext;
  let workDir: string;
  const observedAudioFiles: string[] = [];
  const watchers: FSWatcher[] = [];

  beforeAll(async () => {
    whisper = await initWhisper({
      filePath: whisperModelPath,
      useGpu: process.platform === 'darwin',
    });
    vad = await initWhisperVad({ filePath: sileroModelPath, useGpu: false, nThreads: 4 });
    workDir = await mkdtemp(join(tmpdir(), 'voicewall-firmenordner-'));

    const record =
      (directory: string) =>
      (_eventType: string, fileName: string | null): void => {
        if (fileName !== null && AUDIO_EXTENSIONS.test(fileName)) {
          observedAudioFiles.push(join(directory, fileName));
        }
      };
    for (const directory of [workDir, tmpdir()]) {
      try {
        watchers.push(watch(directory, record(directory)));
      } catch {
        // fs.watch ist auf manchen Plattformen fuer Systemordner eingeschraenkt.
      }
    }
  });

  afterAll(async () => {
    for (const watcher of watchers) {
      watcher.close();
    }
    await whisper.release();
    await vad.release();
    await rm(workDir, { recursive: true, force: true });
  });

  it('schreibt waehrend der Transkription keine Audiodatei', async () => {
    const before = new Set(await readdir(workDir));

    const pcm = loadWavPcm(wavPath);
    const outcome = await transcribeWithVadGate(whisper, vad, pcm, TUNING);
    expect(outcome.hadSpeech).toBe(true);

    // Kurze Nachlaufzeit, damit fs.watch-Events zugestellt werden.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const after = await readdir(workDir);
    const newFiles = after.filter((name) => !before.has(name));
    const newAudioFiles = newFiles.filter((name) => AUDIO_EXTENSIONS.test(name));

    expect(newAudioFiles).toEqual([]);
    expect(observedAudioFiles).toEqual([]);
  });
});
