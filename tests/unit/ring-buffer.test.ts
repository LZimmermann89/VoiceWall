/**
 * Unit-Tests des RAM-Ringpuffers: Obergrenze, Verwerfen aeltester Chunks,
 * Overflow-Meldung, aktives Nullen beim Verwerfen und bei clear().
 */
import { describe, expect, it, vi } from 'vitest';
import { PcmRingBuffer } from '../../src/main/audio/ring-buffer';

describe('PcmRingBuffer', () => {
  it('sammelt Chunks unterhalb der Obergrenze verlustfrei', () => {
    const buffer = new PcmRingBuffer({ maxSamples: 100 });
    buffer.append(new Int16Array([1, 2, 3]));
    buffer.append(new Int16Array([4, 5]));
    expect(buffer.length).toBe(5);
    expect(Array.from(buffer.toInt16Array())).toEqual([1, 2, 3, 4, 5]);
  });

  it('verwirft die aeltesten Chunks beim Ueberschreiten der Obergrenze', () => {
    const buffer = new PcmRingBuffer({ maxSamples: 4 });
    buffer.append(new Int16Array([1, 2, 3]));
    buffer.append(new Int16Array([4, 5, 6]));
    expect(buffer.length).toBeLessThanOrEqual(4);
    // Der aelteste Chunk [1,2,3] muss verworfen sein, das Ende bleibt erhalten.
    const contents = Array.from(buffer.toInt16Array());
    expect(contents).toEqual([4, 5, 6]);
  });

  it('meldet einen Overflow genau einmal', () => {
    const onOverflow = vi.fn();
    const buffer = new PcmRingBuffer({ maxSamples: 3, onOverflow });
    buffer.append(new Int16Array([1, 2, 3]));
    buffer.append(new Int16Array([4]));
    buffer.append(new Int16Array([5]));
    expect(onOverflow).toHaveBeenCalledTimes(1);
  });

  it('schneidet einen uebergrossen Einzelchunk auf die Obergrenze zu', () => {
    const buffer = new PcmRingBuffer({ maxSamples: 3 });
    buffer.append(new Int16Array([1, 2, 3, 4, 5]));
    expect(buffer.length).toBe(3);
    expect(Array.from(buffer.toInt16Array())).toEqual([3, 4, 5]);
  });

  it('nullt und leert den Puffer bei clear()', () => {
    const buffer = new PcmRingBuffer({ maxSamples: 100 });
    const chunk = new Int16Array([7, 8, 9]);
    buffer.append(chunk);
    buffer.clear();
    expect(buffer.length).toBe(0);
    expect(Array.from(buffer.toInt16Array())).toEqual([]);
    // Der urspruengliche Chunk muss aktiv genullt worden sein (Datenschutz).
    expect(Array.from(chunk)).toEqual([0, 0, 0]);
  });

  it('ignoriert leere Chunks', () => {
    const buffer = new PcmRingBuffer({ maxSamples: 10 });
    buffer.append(new Int16Array(0));
    expect(buffer.length).toBe(0);
  });

  it('wirft bei nicht-positiver Obergrenze', () => {
    expect(() => new PcmRingBuffer({ maxSamples: 0 })).toThrow();
  });
});
