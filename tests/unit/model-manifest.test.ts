/**
 * Synchronitaets-Gate zwischen dem typgeprueften Modell-Katalog
 * (src/main/model/model-catalog.ts, Single Source of Truth) und dem
 * mitgelieferten Audit-Artefakt resources/model-manifest.json.
 * Driftet eine Seite, bricht dieser Test die CI.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ALL_MODEL_DESCRIPTORS, isValidSha256Hex } from '../../src/main/model/model-catalog';

const manifestPath = join(import.meta.dirname, '../../resources/model-manifest.json');

const manifestSchema = z.object({
  comment: z.string(),
  schemaVersion: z.literal(1),
  models: z.array(
    z.object({
      id: z.string(),
      fileName: z.string(),
      url: z.string().url(),
      byteSize: z.number().int().positive(),
      sha256: z.string(),
      label: z.string(),
      license: z.string(),
      source: z.string(),
    }),
  ),
});

describe('resources/model-manifest.json', () => {
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));

  it('enthaelt exakt die Modelle des Katalogs (id, Datei, URL, Groesse, SHA-256, Label)', () => {
    expect(manifest.models.length).toBe(ALL_MODEL_DESCRIPTORS.length);
    for (const descriptor of ALL_MODEL_DESCRIPTORS) {
      const entry = manifest.models.find((model) => model.id === descriptor.id);
      expect(entry, `Manifest-Eintrag fuer ${descriptor.id} fehlt`).toBeDefined();
      expect(entry?.fileName).toBe(descriptor.fileName);
      expect(entry?.url).toBe(descriptor.url);
      expect(entry?.byteSize).toBe(descriptor.byteSize);
      expect(entry?.sha256).toBe(descriptor.sha256);
      expect(entry?.label).toBe(descriptor.label);
    }
  });

  it('hat nur gueltige SHA-256-Werte und https-resolve/main-URLs', () => {
    for (const model of manifest.models) {
      expect(isValidSha256Hex(model.sha256)).toBe(true);
      expect(model.url.startsWith('https://huggingface.co/')).toBe(true);
      expect(model.url).toContain('/resolve/main/');
    }
  });

  it('belegt Lizenz und Quelle je Modell (Attribution, ABARBEITUNG 3.9)', () => {
    for (const model of manifest.models) {
      expect(model.license.length).toBeGreaterThan(2);
      expect(model.source.length).toBeGreaterThan(5);
    }
  });
});
