/**
 * Unit-Tests der PCM-Konvertierung: Clamping-Randfaelle, Resampling, RMS.
 */
import { describe, expect, it } from 'vitest';
import {
  float32ToInt16,
  pcmDurationSeconds,
  resampleLinear,
  rmsFromInt16,
  TARGET_SAMPLE_RATE,
} from '../../src/shared/pcm';

describe('float32ToInt16', () => {
  it('skaliert 1.0 auf den maximalen positiven Int16', () => {
    const out = float32ToInt16(new Float32Array([1]));
    expect(out[0]).toBe(32767);
  });

  it('skaliert -1.0 auf den minimalen Int16', () => {
    const out = float32ToInt16(new Float32Array([-1]));
    expect(out[0]).toBe(-32768);
  });

  it('klemmt Werte oberhalb 1.0 (kein Wrap-around)', () => {
    const out = float32ToInt16(new Float32Array([1.5, 2, 100]));
    expect(out[0]).toBe(32767);
    expect(out[1]).toBe(32767);
    expect(out[2]).toBe(32767);
  });

  it('klemmt Werte unterhalb -1.0', () => {
    const out = float32ToInt16(new Float32Array([-1.5, -3]));
    expect(out[0]).toBe(-32768);
    expect(out[1]).toBe(-32768);
  });

  it('bildet 0 auf 0 ab', () => {
    const out = float32ToInt16(new Float32Array([0]));
    expect(out[0]).toBe(0);
  });

  it('rundet nahe der Mitte korrekt', () => {
    // 0.5 * 32767 = 16383.5 -> gerundet 16384
    const out = float32ToInt16(new Float32Array([0.5]));
    expect(out[0]).toBe(16384);
  });

  it('liefert einen Puffer gleicher Laenge', () => {
    const out = float32ToInt16(new Float32Array(1600));
    expect(out.length).toBe(1600);
  });
});

describe('resampleLinear', () => {
  it('gibt die Eingabe unveraendert zurueck, wenn die Rate schon passt', () => {
    const input = new Float32Array([0.1, 0.2, 0.3]);
    expect(resampleLinear(input, TARGET_SAMPLE_RATE, TARGET_SAMPLE_RATE)).toBe(input);
  });

  it('halbiert die Laenge beim Downsampling von 32k auf 16k', () => {
    const input = new Float32Array(100).map((_, i) => i / 100);
    const out = resampleLinear(input, 32_000, 16_000);
    expect(out.length).toBe(50);
  });

  it('resampelt 48k auf 16k auf ein Drittel der Laenge', () => {
    const input = new Float32Array(48_000);
    const out = resampleLinear(input, 48_000, 16_000);
    expect(out.length).toBe(16_000);
  });

  it('interpoliert linear zwischen zwei Punkten', () => {
    // Upsampling 2 -> 4 Samples: Mittelwerte sollten dazwischen liegen.
    const out = resampleLinear(new Float32Array([0, 1]), 1, 2);
    expect(out.length).toBe(4);
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[1]).toBeGreaterThan(0);
    expect(out[1]).toBeLessThan(1);
  });

  it('gibt bei leerer Eingabe eine leere Ausgabe zurueck', () => {
    expect(resampleLinear(new Float32Array(0), 48_000, 16_000).length).toBe(0);
  });

  it('wirft bei nicht-positiven Raten', () => {
    expect(() => resampleLinear(new Float32Array([1]), 0, 16_000)).toThrow();
  });
});

describe('rmsFromInt16', () => {
  it('liefert 0 fuer Stille', () => {
    expect(rmsFromInt16(new Int16Array(1000))).toBe(0);
  });

  it('liefert 0 fuer einen leeren Puffer', () => {
    expect(rmsFromInt16(new Int16Array(0))).toBe(0);
  });

  it('liefert einen positiven Wert fuer ein Signal', () => {
    const samples = new Int16Array([16000, -16000, 16000, -16000]);
    expect(rmsFromInt16(samples)).toBeGreaterThan(0.4);
  });
});

describe('pcmDurationSeconds', () => {
  it('rechnet Bytes in Sekunden um (16-bit mono, 16 kHz)', () => {
    // 16000 Samples * 2 Bytes = 32000 Bytes = 1 s
    expect(pcmDurationSeconds(32_000)).toBeCloseTo(1, 5);
  });
});
