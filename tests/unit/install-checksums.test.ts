/**
 * Drift-Gate zwischen install/lib/checksums.json (dem Pruefsummen-Anker der
 * Setup-Skripte) und resources/model-manifest.json (dem Audit-Artefakt der
 * Modelle, das selbst gegen den typgeprueften Katalog getestet wird).
 *
 * Hintergrund: checksums.json listete nur drei der vier
 * Katalog-Modelle; ein gevendortes viertes Modell haette das Setup-Skript
 * stillschweigend ignoriert ("nicht in checksums.json gelistet"). Dieser
 * Test erzwingt die exakte, beidseitige Synchronitaet der Modell-Hashes,
 * damit das nie wieder driftet.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const checksumsPath = join(import.meta.dirname, '../../install/lib/checksums.json');
const manifestPath = join(import.meta.dirname, '../../resources/model-manifest.json');

const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

const checksumsSchema = z.object({
  kommentar: z.string(),
  schemaVersion: z.literal(1),
  modelle: z.record(z.string(), sha256Hex),
  nodeRuntime: z.record(z.string(), sha256Hex),
});

const manifestSchema = z.object({
  models: z.array(z.object({ fileName: z.string(), sha256: sha256Hex })),
});

describe('install/lib/checksums.json', () => {
  const checksums = checksumsSchema.parse(JSON.parse(readFileSync(checksumsPath, 'utf8')));
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));

  it('listet JEDES Modell aus resources/model-manifest.json mit identischem SHA-256', () => {
    for (const model of manifest.models) {
      const anker = checksums.modelle[model.fileName];
      expect(
        anker,
        `${model.fileName} fehlt in install/lib/checksums.json; das Setup-Skript wuerde ein gevendortes Modell stillschweigend ignorieren`,
      ).toBeDefined();
      expect(anker, `SHA-256-Drift fuer ${model.fileName}`).toBe(model.sha256);
    }
  });

  it('enthaelt keine verwaisten Modell-Eintraege ohne Manifest-Gegenstueck', () => {
    const manifestDateien = new Set(manifest.models.map((model) => model.fileName));
    for (const dateiName of Object.keys(checksums.modelle)) {
      expect(
        manifestDateien.has(dateiName),
        `${dateiName} steht in checksums.json, aber nicht im Modell-Manifest`,
      ).toBe(true);
    }
  });
});
