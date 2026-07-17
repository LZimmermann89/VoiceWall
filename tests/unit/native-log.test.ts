/**
 * Beweis-Tests der nativen Log-Schleuse: native
 * whisper.cpp-Zeilen mit potenziellem Transkriptinhalt werden NIE
 * persistiert; nur Allowlist-Zeilen (Modell-Load/Timing/ggml) erreichen die
 * Logdatei. Der Rest bleibt in einem begrenzten RAM-Puffer.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createLogger, logFilePath } from '../../src/main/log/logger';
import {
  NativeLogRingBuffer,
  isSafeNativeLogLine,
  routeNativeOutput,
} from '../../src/main/whisper/native-log';

let dirs: string[] = [];

async function freshUserData(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'voicewall-nativelog-'));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of dirs) {
    await rm(dir, { recursive: true, force: true });
  }
  dirs = [];
});

const SAFE_LINES = [
  'whisper_init_from_file_with_params_no_state: loading model from ...',
  'whisper_model_load: n_vocab = 51866',
  'whisper_backend_init_gpu: using Metal backend',
  'ggml_metal_init: allocating',
  'system_info: n_threads = 4 / 10',
  'whisper_print_timings:     load time =   233.32 ms',
  'vad_init: loading VAD model',
];

const UNSAFE_LINES = [
  '[00:00:00.000 --> 00:00:02.560]   Das ist ein streng geheimes Diktat.',
  'Der Patient Meier hat Diagnose X und braucht Behandlung Y.',
  'segment text: Vertragsentwurf fuer Kunde Schulze',
  '  --> freie Ausgabe mit Inhalt',
  '',
  '   ',
];

describe('isSafeNativeLogLine (Allowlist)', () => {
  it.each(SAFE_LINES)('erlaubt bekannte technische Zeile: %s', (line) => {
    expect(isSafeNativeLogLine(line)).toBe(true);
  });

  it.each(UNSAFE_LINES)('blockiert potenziell inhaltstragende Zeile: %s', (line) => {
    expect(isSafeNativeLogLine(line)).toBe(false);
  });

  it('blockiert Segment-Syntax selbst mit whisper_-Praefix (Negativsperre)', () => {
    expect(isSafeNativeLogLine('whisper_full: [00:00:01.000 --> 00:00:02.000] geheim')).toBe(false);
  });
});

describe('routeNativeOutput: Persistenz-Beweis', () => {
  it('persistiert unsichere native Zeilen NIE, sichere schon', async () => {
    const userData = await freshUserData();
    const logger = createLogger(userData);
    const buffer = new NativeLogRingBuffer();

    const secret = 'STRENG-GEHEIMES-DIKTAT-SEGMENT';
    const raw = [
      'whisper_model_load: n_vocab = 51866',
      `[00:00:00.000 --> 00:00:02.560]   ${secret}`,
      `freier text mit ${secret}`,
    ].join('\n');

    routeNativeOutput(logger, buffer, 'stdout', raw);

    const content = await readFile(logFilePath(userData), 'utf8');
    // Die sichere Zeile ist (redigiert ueber die line-Metadaten) im Log:
    expect(content).toContain('whisper_model_load');
    // Der geheime Inhalt ist NIRGENDS in der Datei:
    expect(content).not.toContain(secret);
    // Die unsicheren Zeilen liegen nur im RAM-Puffer:
    expect(buffer.size).toBe(2);
    expect(buffer.snapshot().every((line) => line.includes(secret))).toBe(true);
  });

  it('RAM-Puffer ist begrenzt (aelteste Zeilen fallen heraus)', () => {
    const buffer = new NativeLogRingBuffer(3);
    for (let index = 0; index < 10; index += 1) {
      buffer.push(`zeile-${String(index)}`);
    }
    expect(buffer.size).toBe(3);
    expect(buffer.dropped).toBe(7);
    expect(buffer.snapshot()).toEqual(['zeile-7', 'zeile-8', 'zeile-9']);
  });
});
