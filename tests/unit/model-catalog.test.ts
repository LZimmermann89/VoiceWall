/**
 * Unit-Tests des Modellkatalogs: Format der SHA-256-Konstanten, plausible
 * Groessen und stabile resolve/main-URLs (nie eine CDN-URL hardcoden).
 */
import { describe, expect, it } from 'vitest';
import {
  ALL_MODEL_DESCRIPTORS,
  isValidSha256Hex,
  MODEL_CATALOG,
  MODEL_DESCRIPTORS,
  transcriptModelNameFor,
  whisperDescriptorForLanguage,
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

  it('haelt die exakten Checksummen der geprueften Modelldateien', () => {
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
    for (const descriptor of ALL_MODEL_DESCRIPTORS) {
      expect(descriptor.url).toMatch(/^https:\/\/huggingface\.co\/.+\/resolve\/main\//);
      // Nie eine signierte CDN-URL (cdn-lfs) hardcoden.
      expect(descriptor.url).not.toContain('cdn-lfs');
    }
  });

  it('hat je Modell genau eine Mirror-URL im Release modelle-v1', () => {
    for (const descriptor of ALL_MODEL_DESCRIPTORS) {
      expect(descriptor.mirrorUrls).toHaveLength(1);
      // Asset-Name ist exakt der Katalog-fileName; jede Quelle wird gegen
      // dieselbe SHA-256-Konstante verifiziert.
      expect(descriptor.mirrorUrls[0]).toBe(
        `https://github.com/LZimmermann89/VoiceWall/releases/download/modelle-v1/${descriptor.fileName}`,
      );
    }
  });

  it('haelt die verifizierte Checksumme des multilingualen EN-Modells', () => {
    // Selbst berechneter SHA-256 UND identischer Hugging-Face-LFS-OID
    // (04.07.2026, ggerganov/whisper.cpp, ggml-large-v3-turbo-q5_0.bin).
    expect(MODEL_CATALOG.whisperTurboMultilingual.sha256).toBe(
      '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2',
    );
    expect(MODEL_CATALOG.whisperTurboMultilingual.byteSize).toBe(574_041_195);
    expect(MODEL_CATALOG.whisperTurboMultilingual.id).toBe('turbo-q5_0-multilingual');
  });

  it('EN-Modell ist KEIN Pflichtmodell des Standardbetriebs (kein Auto-Download)', () => {
    expect(MODEL_DESCRIPTORS.map((descriptor) => descriptor.id)).not.toContain(
      'turbo-q5_0-multilingual',
    );
    expect(ALL_MODEL_DESCRIPTORS.map((descriptor) => descriptor.id)).toContain(
      'turbo-q5_0-multilingual',
    );
  });
});

describe('Modellwahl je Diktatsprache', () => {
  it('Deutsch nutzt das DE-Finetune gemaess Modellwahl', () => {
    expect(whisperDescriptorForLanguage('de', 'q5_0').id).toBe('whisper-q5');
    expect(whisperDescriptorForLanguage('de', 'fp16').id).toBe('whisper-fp16');
  });

  it('Englisch nutzt immer das multilinguale Originalmodell', () => {
    expect(whisperDescriptorForLanguage('en', 'q5_0').id).toBe('turbo-q5_0-multilingual');
    expect(whisperDescriptorForLanguage('en', 'fp16').id).toBe('turbo-q5_0-multilingual');
  });

  it('Modellkennung der Diktat-Metadaten folgt Sprache und Modellwahl', () => {
    expect(transcriptModelNameFor('de', 'q5_0')).toBe('whisper-large-v3-turbo-german-q5_0');
    expect(transcriptModelNameFor('de', 'fp16')).toBe('whisper-large-v3-turbo-german-fp16');
    expect(transcriptModelNameFor('en', 'q5_0')).toBe('whisper-large-v3-turbo-q5_0');
    expect(transcriptModelNameFor('en', 'fp16')).toBe('whisper-large-v3-turbo-q5_0');
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
