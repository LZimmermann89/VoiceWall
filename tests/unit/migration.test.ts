/**
 * Unit-Tests der Migrationsroutine (M5, Risiko R12, Kritik D6).
 *
 * Belegt wird mit einer ECHTEN Test-Migration v1 -> v2 (Feld-Umbenennung in
 * der Firmen-Konfig plus Manifest-Versionsbump), dass das Framework:
 * 1. backup-erst arbeitet (Backup unter .voicewall/backups/, vollstaendig),
 * 2. atomar auf einer Kopie migriert und erst nach Validierung swappt,
 * 3. bei injiziertem Fehler NICHTS am Original veraendert (Byte-Vergleich),
 * 4. idempotent ist (zweiter Lauf erkennt die Zielversion),
 * 5. Versionsluecken hart ablehnt.
 */
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCompanyFolder } from '../../src/main/storage/company-folder';
import {
  migrateCompanyFolder,
  readSchemaVersion,
  selectMigrationChain,
  type MigrationStep,
} from '../../src/main/storage/migration';
import { createTranscript } from '../../src/main/storage/transcripts';

let base: string;
let companyDir: string;

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'voicewall-migration-'));
  const created = await createCompanyFolder(base, 'Migrationsfirma', {
    erstelltMit: 'VoiceWall 0.1.0-test',
  });
  if (!created.ok) {
    throw new Error('Firmenordner-Anlage im Test fehlgeschlagen.');
  }
  companyDir = created.value.dirPath;
  const transcript = await createTranscript(companyDir, {
    titel: 'Bestandsdiktat',
    body: 'Dieser Text darf bei der Migration nie verloren gehen.',
    sprache: 'de',
    modell: 'whisper-large-v3-turbo-german-q5_0',
    dauerSekunden: 12,
    tags: ['bestand'],
    quelle: 'diktat',
  });
  if (!transcript.ok) {
    throw new Error(transcript.error);
  }
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

/**
 * ECHTE Test-Migration v1 -> v2: benennt in der firmenbezogenen Konfig das
 * Feld `modell` in `standardModell` um und hebt die Manifest-Schemaversion.
 * (Die v2-Definition ist Testcode; das Framework ist produktiv.)
 */
const STEP_V1_V2: MigrationStep = {
  von: 1,
  nach: 2,
  beschreibung: 'Konfig-Feld modell -> standardModell, Manifest-Version 2',
  migrate: async (context) => {
    const configPath = join(context.voicewallDir, 'config.json');
    const config = JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>;
    config['standardModell'] = config['modell'];
    delete config['modell'];
    config['schemaVersion'] = 2;
    await writeFile(configPath, JSON.stringify(config, null, 2));

    const manifestPath = join(context.voicewallDir, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    manifest['schemaVersion'] = 2;
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  },
  validate: async (context) => {
    const config = JSON.parse(
      await readFile(join(context.voicewallDir, 'config.json'), 'utf8'),
    ) as Record<string, unknown>;
    if (config['standardModell'] === undefined || config['modell'] !== undefined) {
      throw new Error('Validierung: Feld-Umbenennung unvollstaendig.');
    }
  },
};

/** Injizierter Fehler NACH einer Teilmutation der Staging-Kopie. */
const FAILING_STEP: MigrationStep = {
  von: 1,
  nach: 2,
  beschreibung: 'absichtlich scheiternder Schritt (Testfixture)',
  migrate: async (context) => {
    // Teilmutation, dann Absturz: das Original darf davon nie etwas sehen.
    await writeFile(join(context.voicewallDir, 'config.json'), '{ "halb": "geschrieben"');
    await writeFile(join(context.diktateDir, 'zerstoert.md'), 'kaputt');
    throw new Error('Injizierter Migrationsfehler.');
  },
};

/** Snapshot aller Dateien eines Ordners (relative Pfade -> Inhalt). */
async function snapshotDir(dir: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const walk = async (rel: string): Promise<void> => {
    for (const entry of await readdir(join(dir, rel), { withFileTypes: true })) {
      const relPath = rel.length === 0 ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(relPath);
      } else {
        files.set(relPath, await readFile(join(dir, relPath), 'utf8'));
      }
    }
  };
  await walk('');
  return files;
}

describe('migrateCompanyFolder', () => {
  it('migriert v1 -> v2 backup-erst und atomar (Erfolgsfall)', async () => {
    expect(await readSchemaVersion(companyDir)).toBe(1);

    const result = await migrateCompanyFolder(companyDir, 2, [STEP_V1_V2]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value).toMatchObject({ von: 1, nach: 2, durchgefuehrt: true });
    expect(await readSchemaVersion(companyDir)).toBe(2);

    // Migration hat gewirkt: Feld umbenannt, Manifest-Version gehoben.
    const config = JSON.parse(
      await readFile(join(companyDir, '.voicewall', 'config.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(config['standardModell']).toBe('q5_0');
    expect(config['modell']).toBeUndefined();

    // Diktate sind unversehrt mitgewandert.
    const diktate = await snapshotDir(join(companyDir, 'Diktate'));
    expect([...diktate.values()].join('')).toContain('nie verloren gehen');

    // BACKUP-ERST: das Backup existiert, enthaelt den ALTEN Stand.
    expect(result.value.backupPfad).not.toBeNull();
    const backupPfad = result.value.backupPfad ?? '';
    const backupConfig = JSON.parse(
      await readFile(join(backupPfad, 'voicewall', 'config.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(backupConfig['modell']).toBe('q5_0'); // alter Feldname
    const backupDiktate = await snapshotDir(join(backupPfad, 'diktate'));
    expect([...backupDiktate.values()].join('')).toContain('nie verloren gehen');

    // Kein Staging-Rest im Firmenordner.
    const entries = await readdir(companyDir);
    expect(entries.filter((entry) => entry.includes('migration-staging'))).toEqual([]);
    expect(entries.filter((entry) => entry.includes('-alt-'))).toEqual([]);
  });

  it('laesst das Original bei injiziertem Fehler byte-identisch unveraendert', async () => {
    const before = await snapshotDir(companyDir);

    const result = await migrateCompanyFolder(companyDir, 2, [FAILING_STEP]);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain('unverändert');

    const after = await snapshotDir(companyDir);
    expect(after).toEqual(before);
    expect(await readSchemaVersion(companyDir)).toBe(1);
  });

  it('ist idempotent: Zielversion erreicht -> No-Op ohne Backup', async () => {
    const first = await migrateCompanyFolder(companyDir, 2, [STEP_V1_V2]);
    expect(first.ok).toBe(true);
    const second = await migrateCompanyFolder(companyDir, 2, [STEP_V1_V2]);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.durchgefuehrt).toBe(false);
      expect(second.value.backupPfad).toBeNull();
    }
  });

  it('lehnt neuere Ordner-Versionen ab (kein Downgrade)', async () => {
    await writeFile(join(companyDir, '.voicewall', '.schema-version'), '99\n');
    const result = await migrateCompanyFolder(companyDir, 2, [STEP_V1_V2]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('99');
    }
  });

  it('lehnt Versionsluecken in der Schrittkette ab', () => {
    const gap = selectMigrationChain([STEP_V1_V2], 1, 3);
    expect(gap.ok).toBe(false);
    const complete = selectMigrationChain([STEP_V1_V2, { ...STEP_V1_V2, von: 2, nach: 3 }], 1, 3);
    expect(complete.ok).toBe(true);
    if (complete.ok) {
      expect(complete.value.length).toBe(2);
    }
  });
});
