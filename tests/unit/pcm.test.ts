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

  /**
   * Kernpruefung des Anti-Aliasing: Ein Ton oberhalb der Ziel-Nyquistfrequenz
   * muss beim Heruntertasten stark gedaempft werden, ein Ton klar darunter darf
   * es nicht. Ohne den Tiefpass wuerde der hohe Ton als Aliasing ins Sprachband
   * zurueckfalten, statt zu verschwinden.
   */
  function effektivwert(signal: Float32Array): number {
    let summe = 0;
    for (let i = 0; i < signal.length; i += 1) {
      const wert = signal[i] ?? 0;
      summe += wert * wert;
    }
    return signal.length === 0 ? 0 : Math.sqrt(summe / signal.length);
  }

  function sinus(frequenz: number, rate: number, sekunden: number): Float32Array {
    const n = Math.round(rate * sekunden);
    const s = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      s[i] = Math.sin((2 * Math.PI * frequenz * i) / rate);
    }
    return s;
  }

  it('daempft beim Downsampling einen Ton oberhalb der Ziel-Nyquistfrequenz stark', () => {
    // 12 kHz liegt oberhalb von 8 kHz (Nyquist bei 16 kHz Ziel). Nach dem
    // Heruntertasten von 48 kHz muss davon fast nichts uebrig sein.
    const hoch = sinus(12_000, 48_000, 0.25);
    const aus = resampleLinear(hoch, 48_000, 16_000);
    expect(effektivwert(aus)).toBeLessThan(0.1);
  });

  it('laesst beim Downsampling einen Ton klar unterhalb der Grenze passieren', () => {
    // 1 kHz ist mitten im Sprachband und muss erhalten bleiben.
    const tief = sinus(1_000, 48_000, 0.25);
    const aus = resampleLinear(tief, 48_000, 16_000);
    // Der Effektivwert eines Sinus ist etwa 0,707; deutlich mehr als die
    // Daempfungsschwelle des hohen Tons.
    expect(effektivwert(aus)).toBeGreaterThan(0.5);
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
