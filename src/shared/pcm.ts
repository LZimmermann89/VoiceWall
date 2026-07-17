/**
 * Reine, portable PCM-Hilfsfunktionen fuer die Audio-Kette. Dieses Modul
 * enthaelt bewusst keine Node- oder DOM-Abhaengigkeit (ESLint-Modulgrenze
 * src/shared): es rechnet nur auf TypedArrays und ist damit im Renderer, im
 * Main-Prozess und im utilityProcess identisch nutzbar und einzeln testbar.
 *
 * Zielformat der gesamten Kette: 16-bit signed PCM, mono, 16 kHz. Genau das
 * erwartet @fugood/whisper.node (transcribeData) und der Silero-VAD.
 */

/** Abtastrate, die Whisper und der Silero-VAD voraussetzen. */
export const TARGET_SAMPLE_RATE = 16_000;

/**
 * Wandelt Float32-Audio (Wertebereich [-1, 1]) in 16-bit signed PCM.
 *
 * Randfaelle bewusst behandelt:
 * - Werte ausserhalb [-1, 1] werden geklemmt (Clamping), bevor skaliert wird.
 *   Ohne Clamping wuerde ein Wert > 1 beim Skalieren ueberlaufen und als
 *   negative Zahl (Wrap-around) landen, was als lautes Knacken hoerbar waere.
 * - Positiv wird mit 32767 skaliert (max. Int16), negativ mit 32768, damit der
 *   volle symmetrische Wertebereich [-32768, 32767] genutzt wird und leise
 *   Signale nicht unnoetig gedaempft werden.
 * - Math.round statt Trunkierung, damit der Quantisierungsfehler zentriert ist.
 */
export function float32ToInt16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = input[i] ?? 0;
    const clamped = sample > 1 ? 1 : sample < -1 ? -1 : sample;
    output[i] = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
  }
  return output;
}

/**
 * Resampelt Float32-Audio per linearer Interpolation auf eine Zielrate.
 *
 * Defensiver Pfad fuer den Fall, dass das Betriebssystem trotz angeforderter
 * 16 kHz eine andere Rate (haeufig 48 kHz) erzwingt. Lineare Interpolation
 * reicht fuer Sprache und bleibt compilerfrei (keine DSP-Bibliothek). Ist die
 * Eingaberate bereits gleich der Zielrate, wird die Eingabe unveraendert
 * zurueckgegeben (kein unnoetiges Kopieren).
 */
export function resampleLinear(
  input: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number = TARGET_SAMPLE_RATE,
): Float32Array {
  if (inputSampleRate === targetSampleRate) {
    return input;
  }
  if (inputSampleRate <= 0 || targetSampleRate <= 0) {
    throw new Error('Abtastraten muessen positiv sein.');
  }
  if (input.length === 0) {
    return new Float32Array(0);
  }
  const ratio = inputSampleRate / targetSampleRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const sourcePosition = i * ratio;
    const indexLeft = Math.floor(sourcePosition);
    const indexRight = Math.min(indexLeft + 1, input.length - 1);
    const fraction = sourcePosition - indexLeft;
    const left = input[indexLeft] ?? 0;
    const right = input[indexRight] ?? 0;
    output[i] = left + (right - left) * fraction;
  }
  return output;
}

/**
 * Berechnet den Effektivwert (Root Mean Square) eines 16-bit-PCM-Blocks,
 * normiert auf [0, 1]. Grundlage der Pegelanzeige in der Test-UI.
 */
export function rmsFromInt16(samples: Int16Array): number {
  if (samples.length === 0) {
    return 0;
  }
  let sumOfSquares = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const normalized = (samples[i] ?? 0) / 32768;
    sumOfSquares += normalized * normalized;
  }
  return Math.sqrt(sumOfSquares / samples.length);
}

/** Dauer eines 16-bit-mono-PCM-Puffers in Sekunden bei gegebener Abtastrate. */
export function pcmDurationSeconds(
  byteLength: number,
  sampleRate: number = TARGET_SAMPLE_RATE,
): number {
  return byteLength / 2 / sampleRate;
}
