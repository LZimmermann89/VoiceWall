/**
 * RAM-Ringpuffer fuer eingehende 16-bit-PCM-Chunks mit fester Obergrenze.
 *
 * Zweck (zwei Dinge zugleich):
 * 1. DoS-Schutz: Ein haengender oder bösartiger Capture-Pfad koennte den
 *    Main-Prozess sonst mit unbegrenztem PCM fluten, bis der Speicher voll ist.
 *    Der Puffer verwirft daher beim Ueberschreiten der Obergrenze die aeltesten
 *    Chunks (First-in-first-out) und meldet dies genau einmal per Warn-Callback.
 * 2. Datenschutz: `clear()` nullt die gehaltenen Chunks aktiv (fill(0)) und gibt
 *    die Referenzen frei, damit nach einer Transkription kein Rohaudio im RAM
 *    liegen bleibt (mit der bekannten Restdimension Swap/Crash-Dump).
 *
 * Reine Datenstruktur, testbar ohne Electron. Node-Buffer wird bewusst nicht
 * benutzt (Int16Array reicht und bleibt portabel).
 */

export interface RingBufferOptions {
  /** Obergrenze in Samples (16-bit). 10 min bei 16 kHz = 9.600.000 Samples. */
  readonly maxSamples: number;
  /** Wird einmalig ausgeloest, wenn erstmals aelteste Daten verworfen werden. */
  readonly onOverflow?: (droppedSamples: number) => void;
}

/** 10 Minuten Audio bei 16 kHz mono als Standard-Obergrenze. */
export const DEFAULT_MAX_SAMPLES = 16_000 * 60 * 10;

export class PcmRingBuffer {
  private chunks: Int16Array[] = [];
  private totalSamples = 0;
  private overflowReported = false;
  private readonly maxSamples: number;
  private readonly onOverflow: ((droppedSamples: number) => void) | undefined;

  constructor(options: RingBufferOptions) {
    if (options.maxSamples <= 0) {
      throw new Error('maxSamples muss positiv sein.');
    }
    this.maxSamples = options.maxSamples;
    this.onOverflow = options.onOverflow;
  }

  /** Anzahl aktuell gehaltener Samples. */
  get length(): number {
    return this.totalSamples;
  }

  /**
   * Haengt einen PCM-Chunk an. Ueberschreitet der Gesamtbestand die Obergrenze,
   * werden die aeltesten Chunks verworfen (und dabei genullt), bis er wieder
   * passt. Ein einzelner Chunk groesser als die Obergrenze wird auf die
   * neuesten maxSamples zugeschnitten.
   */
  append(chunk: Int16Array): void {
    if (chunk.length === 0) {
      return;
    }
    let toStore = chunk;
    if (toStore.length > this.maxSamples) {
      toStore = toStore.subarray(toStore.length - this.maxSamples);
      this.reportOverflow(chunk.length - toStore.length);
    }
    this.chunks.push(toStore);
    this.totalSamples += toStore.length;
    this.evictOldest();
  }

  private evictOldest(): void {
    let droppedThisCall = 0;
    while (this.totalSamples > this.maxSamples && this.chunks.length > 0) {
      const oldest = this.chunks.shift();
      if (oldest === undefined) {
        break;
      }
      droppedThisCall += oldest.length;
      this.totalSamples -= oldest.length;
      oldest.fill(0);
    }
    if (droppedThisCall > 0) {
      this.reportOverflow(droppedThisCall);
    }
  }

  private reportOverflow(droppedSamples: number): void {
    if (!this.overflowReported && this.onOverflow) {
      this.overflowReported = true;
      this.onOverflow(droppedSamples);
    }
  }

  /**
   * Kopiert den gesamten Inhalt in einen zusammenhaengenden Int16Array. Der
   * Rueckgabewert ist eine frische Kopie, der interne Zustand bleibt unberuehrt.
   */
  toInt16Array(): Int16Array {
    const combined = new Int16Array(this.totalSamples);
    let offset = 0;
    for (const chunk of this.chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return combined;
  }

  /**
   * Nullt alle gehaltenen Chunks aktiv und setzt den Puffer zurueck. Nach einer
   * Transkription aufzurufen, damit kein Rohaudio im RAM verbleibt.
   */
  clear(): void {
    for (const chunk of this.chunks) {
      chunk.fill(0);
    }
    this.chunks = [];
    this.totalSamples = 0;
  }
}
