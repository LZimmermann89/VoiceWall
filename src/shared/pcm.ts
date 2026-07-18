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
 * Entwirft einen linearphasigen Tiefpass (windowed sinc, Hamming-Fenster).
 *
 * `cutoffNorm` ist die Grenzfrequenz relativ zur Eingabe-Abtastrate (fc/fs),
 * also im Bereich (0, 0.5). Die Zahl der Koeffizienten ist ungerade, damit der
 * Filter eine ganzzahlige Gruppenlaufzeit hat und sich exakt kompensieren
 * laesst. Die Koeffizienten werden auf Summe 1 normiert (Durchlass bei
 * Gleichanteil = 1).
 */
function entwerfeTiefpass(anzahlKoeffizienten: number, cutoffNorm: number): Float32Array {
  const n = anzahlKoeffizienten % 2 === 0 ? anzahlKoeffizienten + 1 : anzahlKoeffizienten;
  const koeffizienten = new Float32Array(n);
  const mitte = (n - 1) / 2;
  let summe = 0;
  for (let i = 0; i < n; i += 1) {
    const x = i - mitte;
    // Ideale sinc-Impulsantwort eines Tiefpasses.
    const sinc = x === 0 ? 2 * cutoffNorm : Math.sin(2 * Math.PI * cutoffNorm * x) / (Math.PI * x);
    // Hamming-Fenster gegen Ueberschwinger.
    const fenster = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
    const wert = sinc * fenster;
    koeffizienten[i] = wert;
    summe += wert;
  }
  for (let i = 0; i < n; i += 1) {
    koeffizienten[i] = (koeffizienten[i] ?? 0) / summe;
  }
  return koeffizienten;
}

/**
 * Faltet das Signal mit dem Filter, Ausgabe gleich lang wie die Eingabe (die
 * Gruppenlaufzeit des linearphasigen Filters wird durch Zentrieren
 * kompensiert). Raender werden mit Null angenommen; fuer Sprache mit Stille am
 * Rand ist das unkritisch.
 */
function falte(input: Float32Array, koeffizienten: Float32Array): Float32Array {
  const n = koeffizienten.length;
  const mitte = (n - 1) / 2;
  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    let summe = 0;
    for (let k = 0; k < n; k += 1) {
      const j = i + k - mitte;
      if (j >= 0 && j < input.length) {
        summe += (input[j] ?? 0) * (koeffizienten[k] ?? 0);
      }
    }
    output[i] = summe;
  }
  return output;
}

/**
 * Anteil der Ziel-Nyquistfrequenz, bis zu dem der Tiefpass durchlaesst. 0,9
 * laesst einen kleinen Uebergangsbereich, damit bei 8 kHz Nyquist bis etwa
 * 7,2 kHz nichts gedaempft wird, aber alles darueber vor dem Downsampling
 * verschwindet.
 */
const ANTIALIAS_CUTOFF_ANTEIL = 0.9;

/** Zahl der FIR-Koeffizienten. Genug fuer eine brauchbare Sperrdaempfung bei Sprache. */
const ANTIALIAS_KOEFFIZIENTEN = 101;

/**
 * Resampelt Float32-Audio auf eine Zielrate.
 *
 * Beim Heruntertasten (Eingaberate groesser als Zielrate) wird ZUERST ein
 * Tiefpass angewandt und erst DANN linear interpoliert. Ohne diesen Tiefpass
 * faltet sich beim 48-kHz-nach-16-kHz-Fall alles oberhalb von 8 kHz als Aliasing
 * zurueck ins Sprachband, also genau in den Bereich, auf den die Erkennung
 * angewiesen ist. Das ist ein echter Signalfehler, kein theoretisches Detail.
 *
 * Defensiver Pfad fuer den Fall, dass das Betriebssystem trotz angeforderter
 * 16 kHz eine andere Rate (haeufig 48 kHz) erzwingt. Ist die Eingaberate bereits
 * gleich der Zielrate, wird die Eingabe unveraendert zurueckgegeben.
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
  // Vor dem Heruntertasten bandbegrenzen. Die Grenzfrequenz liegt knapp unter
  // der Ziel-Nyquistfrequenz und wird auf die Eingaberate normiert.
  let quelle = input;
  if (inputSampleRate > targetSampleRate) {
    const cutoffNorm = ((targetSampleRate / 2) * ANTIALIAS_CUTOFF_ANTEIL) / inputSampleRate;
    quelle = falte(input, entwerfeTiefpass(ANTIALIAS_KOEFFIZIENTEN, cutoffNorm));
  }
  const ratio = inputSampleRate / targetSampleRate;
  const outputLength = Math.max(1, Math.round(quelle.length / ratio));
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const sourcePosition = i * ratio;
    const indexLeft = Math.floor(sourcePosition);
    const indexRight = Math.min(indexLeft + 1, quelle.length - 1);
    const fraction = sourcePosition - indexLeft;
    const left = quelle[indexLeft] ?? 0;
    const right = quelle[indexRight] ?? 0;
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
