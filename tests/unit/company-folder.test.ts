/**
 * Unit-Tests der Firmenordner-Anlage:
 * Struktur, POSIX-Rechte 0700, Idempotenz (Uebernahme), fremde Ordner
 * (Fehler-Result mit Vorschlag, nie hineinschreiben), Atomaritaet (kein
 * Temp-Rest), Anzeigename vs. Ordnername.
 */
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createCompanyFolder,
  isVoiceWallFolder,
  suggestAlternativeName,
} from '../../src/main/storage/company-folder';
import { companyConfigSchema, manifestSchema } from '../../src/shared/company';

const isWindows = process.platform === 'win32';

let base: string;

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'voicewall-firma-'));
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

const OPTIONS = { erstelltMit: 'VoiceWall 0.1.0-test' } as const;

describe('createCompanyFolder', () => {
  it('legt die komplette Struktur nach 4.4.1 an', async () => {
    const result = await createCompanyFolder(base, 'Müller & Söhne GmbH', OPTIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.uebernommen).toBe(false);
    expect(result.value.ordnername).toBe('Müller & Söhne GmbH');
    const dir = result.value.dirPath;
    for (const sub of ['.voicewall', 'Diktate', 'Exporte', 'Papierkorb']) {
      expect((await stat(join(dir, sub))).isDirectory()).toBe(true);
    }
    for (const file of ['manifest.json', 'config.json', 'tags.json', '.schema-version']) {
      expect((await stat(join(dir, '.voicewall', file))).isFile()).toBe(true);
    }
    // Initialdateien sind schema-gueltig.
    const manifest = manifestSchema.safeParse(
      JSON.parse(await readFile(join(dir, '.voicewall', 'manifest.json'), 'utf8')),
    );
    expect(manifest.success).toBe(true);
    expect(manifest.success && manifest.data.eintraege).toEqual([]);
    expect((await readFile(join(dir, '.voicewall', '.schema-version'), 'utf8')).trim()).toBe('1');
  });

  it('trennt Anzeigename (unveraendert) und Ordnername (sanitisiert)', async () => {
    const result = await createCompanyFolder(base, '  Müller/Söhne: "Werk*2"  ', OPTIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const config = companyConfigSchema.parse(
      JSON.parse(await readFile(join(result.value.dirPath, '.voicewall', 'config.json'), 'utf8')),
    );
    // Anzeigename bleibt der rohe Name; der Ordnername ist sanitisiert.
    expect(config.firma.anzeigename).toBe('  Müller/Söhne: "Werk*2"  ');
    expect(config.firma.ordnername).toBe(result.value.ordnername);
    expect(result.value.ordnername).not.toContain('/');
    expect(result.value.ordnername).not.toContain(':');
    expect(result.value.ordnername).not.toContain('"');
  });

  it.skipIf(isWindows)('setzt POSIX-Rechte 0700 auf Firmenordner und .voicewall', async () => {
    const result = await createCompanyFolder(base, 'Rechte AG', OPTIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect((await stat(result.value.dirPath)).mode & 0o777).toBe(0o700);
    expect((await stat(join(result.value.dirPath, '.voicewall'))).mode & 0o777).toBe(0o700);
  });

  it('ist idempotent: bestehende VoiceWall-Struktur wird uebernommen', async () => {
    const first = await createCompanyFolder(base, 'Beispiel AG', OPTIONS);
    expect(first.ok).toBe(true);
    // Marker-Datei anfassen, um Datenerhalt zu belegen.
    if (!first.ok) {
      return;
    }
    const manifestPath = join(first.value.dirPath, '.voicewall', 'manifest.json');
    const originalManifest = await readFile(manifestPath, 'utf8');

    const second = await createCompanyFolder(base, 'Beispiel AG', OPTIONS);
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.value.uebernommen).toBe(true);
    expect(second.value.dirPath).toBe(first.value.dirPath);
    // Nichts wurde ueberschrieben.
    expect(await readFile(manifestPath, 'utf8')).toBe(originalManifest);
  });

  it('uebernimmt auch NFD-/case-Varianten desselben Ordners', async () => {
    const first = await createCompanyFolder(base, 'Müller GmbH', OPTIONS);
    expect(first.ok).toBe(true);
    const second = await createCompanyFolder(base, 'MÜLLER GMBH'.normalize('NFD'), OPTIONS);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.uebernommen).toBe(true);
      expect(second.value.dirPath).toBe(first.value.dirPath);
    }
  });

  it('schreibt NIE in fremde Ordner: Fehler-Result mit Namensvorschlag', async () => {
    await mkdir(join(base, 'Fremd GmbH'));
    await writeFile(join(base, 'Fremd GmbH', 'wichtig.txt'), 'fremder Inhalt');

    const result = await createCompanyFolder(base, 'Fremd GmbH', OPTIONS);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('fremder-ordner');
    expect(result.error.vorschlag).toBe('Fremd GmbH (VoiceWall)');
    // Der fremde Ordner ist unangetastet (nichts hineingeschrieben).
    expect(await readdir(join(base, 'Fremd GmbH'))).toEqual(['wichtig.txt']);
    expect(await readFile(join(base, 'Fremd GmbH', 'wichtig.txt'), 'utf8')).toBe('fremder Inhalt');
  });

  it('entschaerft Traversal-Namen und weist Reserviert-/Leernamen ab (Sanitisierung)', async () => {
    // "../../etc" wird zu einem harmlosen Segment INNERHALB der Basis
    // reduziert; nie ein Pfad ausserhalb.
    const traversal = await createCompanyFolder(base, '../../etc', OPTIONS);
    expect(traversal.ok).toBe(true);
    if (traversal.ok) {
      expect(traversal.value.ordnername).toBe('etc');
      expect(traversal.value.dirPath).toBe(join(base, 'etc'));
    }
    expect((await createCompanyFolder(base, 'NUL', OPTIONS)).ok).toBe(false);
    expect((await createCompanyFolder(base, '///', OPTIONS)).ok).toBe(false);
  });

  it('laesst keine Temp-Ordner zurueck (Atomaritaet)', async () => {
    await createCompanyFolder(base, 'Atomar GmbH', OPTIONS);
    await createCompanyFolder(base, 'NUL', OPTIONS); // Fehlerfall
    const entries = await readdir(base);
    expect(entries.filter((entry) => entry.startsWith('.voicewall-tmp-'))).toEqual([]);
  });

  it('isVoiceWallFolder erkennt nur echte VoiceWall-Ordner', async () => {
    const created = await createCompanyFolder(base, 'Marker AG', OPTIONS);
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(await isVoiceWallFolder(created.value.dirPath)).toBe(true);
    }
    await mkdir(join(base, 'leer'));
    expect(await isVoiceWallFolder(join(base, 'leer'))).toBe(false);
  });

  it('suggestAlternativeName liefert einen freien Namen', () => {
    expect(suggestAlternativeName(['Firma'], 'Firma')).toBe('Firma (VoiceWall)');
    expect(suggestAlternativeName(['Firma', 'Firma (VoiceWall)'], 'Firma')).toBe('Firma-2');
  });
});
