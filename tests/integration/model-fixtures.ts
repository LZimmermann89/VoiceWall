/**
 * Hilfen fuer die lokalen Integrationstests: findet die Modelldateien im
 * userData-Ordner (wie ihn Electron pro Plattform anlegt) und liest das
 * eingecheckte Test-WAV als RAM-only-ArrayBuffer. Fehlen die Modelle (z. B. in
 * der CI), signalisiert `modelsAvailable` false und die Tests werden sauber
 * uebersprungen.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const APP_NAME = 'voicewall';

/** Bildet Electrons app.getPath('userData') fuer die Testumgebung nach. */
function userDataDir(): string {
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', APP_NAME);
  }
  if (process.platform === 'win32') {
    return join(process.env['APPDATA'] ?? join(homedir(), 'AppData', 'Roaming'), APP_NAME);
  }
  return join(process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config'), APP_NAME);
}

export const modelsDir = join(userDataDir(), 'models');
export const whisperModelPath = join(modelsDir, 'ggml-model-q5_0.bin');
export const multilingualModelPath = join(modelsDir, 'ggml-large-v3-turbo-q5_0.bin');
export const sileroModelPath = join(modelsDir, 'ggml-silero-v5.1.2.bin');
/** Optionales fp16-Modell (Modelle-Reiter-E2E verlinkt es, wenn vorhanden). */
export const fp16ModelPath = join(modelsDir, 'ggml-model.bin');

export const modelsAvailable = existsSync(whisperModelPath) && existsSync(sileroModelPath);
/** EN-Tests brauchen zusaetzlich das mehrsprachige Originalmodell (B1). */
export const modelsAvailableEn = existsSync(multilingualModelPath) && existsSync(sileroModelPath);

/**
 * Liest die 16-bit-PCM-Daten (data-Chunk) eines 16 kHz mono WAV als frischen
 * ArrayBuffer. RAM-only, keine Zwischendatei.
 */
export function loadWavPcm(wavPath: string): ArrayBuffer {
  const buffer = readFileSync(wavPath);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`Keine RIFF/WAVE-Datei: ${wavPath}`);
  }
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === 'data') {
      const pcm = buffer.subarray(offset + 8, offset + 8 + chunkSize);
      const arrayBuffer = new ArrayBuffer(pcm.length);
      new Uint8Array(arrayBuffer).set(pcm);
      return arrayBuffer;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  throw new Error(`Kein data-Chunk in ${wavPath}`);
}

/** Erzeugt reine Stille als 16-bit-PCM-ArrayBuffer der angegebenen Dauer. */
export function makeSilencePcm(seconds: number, sampleRate = 16_000): ArrayBuffer {
  return new ArrayBuffer(Math.round(seconds * sampleRate) * 2);
}
