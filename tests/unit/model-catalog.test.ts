/**
 * Unit-Tests des Modellkatalogs: Format der SHA-256-Konstanten, plausible
 * Groessen und stabile resolve/main-URLs (nie eine CDN-URL hardcoden).
 */
import { describe, expect, it } from 'vitest';
import {
  isValidSha256Hex,
  MODEL_CATALOG,
  MODEL_DESCRIPTORS,
} from '../../src/main/model/model-catalog';

describe('Modellkatalog', () => {
  it('kennt genau die beiden benoetigten Modelle', () => {
    expect(MODEL_DESCRIPTORS).toHaveLength(2);
    const ids = MODEL_DESCRIPTORS.map((descriptor) => descriptor.id).sort();
    expect(ids).toEqual(['silero-vad', 'whisper-q5']);
  });

  it('hat gueltige SHA-256-Konstanten (64 Hex-Zeichen)', () => {
    for (const descriptor of MODEL_DESCRIPTORS) {
      expect(isValidSha256Hex(descriptor.sha256)).toBe(true);
    }
  });

  it('haelt die exakten Checksummen aus dem M1-Spike', () => {
    expect(MODEL_CATALOG.whisperQ5.sha256).toBe(
      '15e92e3db0993c52fffa781513eec9253475331c1be808f8fb409285c9d9d030',
    );
    expect(MODEL_CATALOG.sileroVad.sha256).toBe(
      '29940d98d42b91fbd05ce489f3ecf7c72f0a42f027e4875919a28fb4c04ea2cf',
    );
  });

  it('hat positive, plausible Groessen', () => {
    expect(MODEL_CATALOG.whisperQ5.byteSize).toBe(574_041_195);
    expect(MODEL_CATALOG.sileroVad.byteSize).toBe(885_098);
  });

  it('nutzt ausschliesslich stabile resolve/main-URLs auf huggingface.co', () => {
    for (const descriptor of MODEL_DESCRIPTORS) {
      expect(descriptor.url).toMatch(/^https:\/\/huggingface\.co\/.+\/resolve\/main\//);
      // Nie eine signierte CDN-URL (cdn-lfs) hardcoden.
      expect(descriptor.url).not.toContain('cdn-lfs');
    }
  });
});

describe('isValidSha256Hex', () => {
  it('akzeptiert genau 64 Kleinbuchstaben-Hex', () => {
    expect(isValidSha256Hex('a'.repeat(64))).toBe(true);
  });
  it('lehnt Grossbuchstaben, falsche Laenge und Nicht-Hex ab', () => {
    expect(isValidSha256Hex('A'.repeat(64))).toBe(false);
    expect(isValidSha256Hex('a'.repeat(63))).toBe(false);
    expect(isValidSha256Hex('z'.repeat(64))).toBe(false);
  });
});
