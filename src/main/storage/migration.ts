/**
 * Migrationsroutine des Firmenordner-Schemas (M5, Risiko R12, Kritik D6).
 *
 * `schemaVersion` ist keine Dekoration: dieses Framework fuehrt echte,
 * getestete Migrationen von Version zu Version aus. Ablauf pro Lauf:
 *
 *   1. Versionserkennung ueber `.voicewall/.schema-version` (Fallback:
 *      `manifest.json:schemaVersion`, Fallback: 1). Zielversion erreicht
 *      -> No-Op (idempotent).
 *   2. BACKUP-ERST: kompletter `.voicewall/`-Ordner UND alle Diktate werden
 *      nach `.voicewall/backups/vor-migration-v<von>-<timestamp>/` kopiert.
 *      Entscheidung (docs/ENTSCHEIDUNGEN.md E14): das Backup liegt INNERHALB
 *      des Firmenordners (reist bei Kopie/Umzug mit, keine Schreibrechte
 *      ausserhalb noetig), aber unterhalb von `.voicewall/` und damit
 *      strukturell ausserhalb des Diktate-Scans (rebuildManifest liest nur
 *      `Diktate/`). Backups selbst werden nie in Backups kopiert.
 *   3. Migration laeuft AUF EINER KOPIE (Staging-Ordner
 *      `.voicewall-migration-staging-<rand>/` im Firmenordner): die
 *      registrierten Schritte veraendern ausschliesslich die Staging-Kopie.
 *      Das Original bleibt bis zum Swap unangetastet.
 *   4. Validierung der Staging-Kopie (Schema-Version, Manifest parsebar,
 *      optional schrittspezifische validate()-Hooks).
 *   5. Swap per Rename (Original -> alt, Staging -> Original), danach
 *      Aufraeumen. Scheitert der Swap, wird aus den alt-Ordnern
 *      zurueckgerollt; das Backup aus Schritt 2 bleibt zusaetzlich erhalten.
 *
 * Scheitert IRGENDETWAS vor dem Swap, bleibt das Original byte-identisch
 * unveraendert (nur Staging/Backup werden entfernt) und der Fehler wird als
 * Result gemeldet. Aktuell existiert nur Schema v1; die Test-Migration
 * v1->v2 in tests/unit/migration.test.ts belegt das komplette Framework
 * (Erfolgsfall plus injizierter Fehler mit unversehrtem Original).
 */
import { randomBytes } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { COMPANY_SCHEMA_VERSION, manifestSchema } from '../../shared/company';
import { texte } from '../i18n';
import { err, ok, type Result } from '../../shared/result';
import type { Logger } from '../log/logger';
import { DIKTATE_DIR, MANIFEST_FILE, SCHEMA_VERSION_FILE, VOICEWALL_DIR } from './company-folder';

/** Unterordner fuer Migrations-Backups (innerhalb von .voicewall/). */
export const BACKUPS_DIR = 'backups';

/** Sicht der Staging-Kopie, auf der Migrationsschritte arbeiten. */
export interface MigrationContext {
  /** Staging-Kopie des `.voicewall/`-Ordners (ohne backups/). */
  readonly voicewallDir: string;
  /** Staging-Kopie des `Diktate/`-Ordners. */
  readonly diktateDir: string;
}

export interface MigrationStep {
  /** Ausgangsversion dieses Schritts. */
  readonly von: number;
  /** Zielversion dieses Schritts (von + 1). */
  readonly nach: number;
  /** Deutsche Kurzbeschreibung (Log/Fehlermeldung). */
  readonly beschreibung: string;
  /** Fuehrt die Migration auf der Staging-Kopie aus. */
  readonly migrate: (context: MigrationContext) => Promise<void>;
  /** Optionale schrittspezifische Validierung auf der Staging-Kopie. */
  readonly validate?: (context: MigrationContext) => Promise<void>;
}

/**
 * Registrierte Migrationsschritte der App. Aktuell leer, weil nur Schema v1
 * existiert; der erste echte Schritt wird hier registriert, sobald v2
 * definiert ist. Das Framework selbst ist produktiv und getestet.
 */
export const MIGRATION_STEPS: readonly MigrationStep[] = [];

export interface MigrationOutcome {
  readonly von: number;
  readonly nach: number;
  /** True, wenn tatsaechlich migriert wurde (false: schon auf Zielversion). */
  readonly durchgefuehrt: boolean;
  /** Absoluter Pfad des angelegten Backups (null bei No-Op). */
  readonly backupPfad: string | null;
}

export interface MigrationDeps {
  readonly logger?: Logger;
  readonly now?: () => Date;
}

/** Liest die Schema-Version des Firmenordners (Fallback-Kette, siehe oben). */
export async function readSchemaVersion(companyDir: string): Promise<number> {
  try {
    const raw = await readFile(join(companyDir, VOICEWALL_DIR, SCHEMA_VERSION_FILE), 'utf8');
    const parsed = Number.parseInt(raw.trim(), 10);
    if (Number.isInteger(parsed) && parsed >= 1) {
      return parsed;
    }
  } catch {
    // Datei fehlt: Fallback auf das Manifest.
  }
  try {
    const raw = await readFile(join(companyDir, VOICEWALL_DIR, MANIFEST_FILE), 'utf8');
    const parsed = manifestSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      return parsed.data.schemaVersion;
    }
  } catch {
    // Auch kein Manifest: aeltester bekannter Stand.
  }
  return 1;
}

/** Schreibt die `.schema-version`-Datei in einen .voicewall-Ordner. */
async function writeSchemaVersionFile(voicewallDir: string, version: number): Promise<void> {
  await writeFile(join(voicewallDir, SCHEMA_VERSION_FILE), `${String(version)}\n`, {
    mode: 0o600,
  });
}

/** Existenz-Check ohne Exception im Kontrollfluss. */
async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Zeitstempel fuer Ordnernamen: 2026-07-03T14-32-10 (dateisystemsicher). */
function timestampForDirName(now: Date): string {
  return now
    .toISOString()
    .replace(/\.\d+Z$/, '')
    .replace(/:/g, '-');
}

/**
 * Kopiert `.voicewall/` (ohne backups/) und `Diktate/` nach `targetDir`.
 * Der `.voicewall`-Inhalt wird EINTRAGSWEISE kopiert: das Backup liegt
 * selbst unter `.voicewall/backups/`, und `fs.cp` verweigert (zu Recht) das
 * Kopieren eines Ordners in sein eigenes Unterverzeichnis. Backups werden
 * dabei nie mitkopiert (keine Backup-im-Backup-Kaskade).
 */
async function copyCompanyData(companyDir: string, targetDir: string): Promise<void> {
  const voicewallSource = join(companyDir, VOICEWALL_DIR);
  const voicewallTarget = join(targetDir, 'voicewall');
  await mkdir(voicewallTarget, { recursive: true, mode: 0o700 });
  await mkdir(targetDir, { recursive: true, mode: 0o700 });
  for (const entry of await readdir(voicewallSource, { withFileTypes: true })) {
    if (entry.name === BACKUPS_DIR) {
      continue;
    }
    await cp(join(voicewallSource, entry.name), join(voicewallTarget, entry.name), {
      recursive: true,
    });
  }
  try {
    await cp(join(companyDir, DIKTATE_DIR), join(targetDir, 'diktate'), { recursive: true });
  } catch {
    // Kein Diktate-Ordner (leerer Bestand): leere Kopie anlegen.
    await mkdir(join(targetDir, 'diktate'), { recursive: true });
  }
}

/** Waehlt die lueckenlose Schrittkette von `von` nach `nach` aus. */
export function selectMigrationChain(
  steps: readonly MigrationStep[],
  von: number,
  nach: number,
): Result<readonly MigrationStep[], string> {
  const chain: MigrationStep[] = [];
  let current = von;
  while (current < nach) {
    const step = steps.find((candidate) => candidate.von === current);
    if (step === undefined) {
      return err(texte().migration.schrittFehlt(String(current), String(current + 1)));
    }
    if (step.nach !== current + 1) {
      return err(
        texte().migration.schrittUeberspringt(
          step.beschreibung,
          String(step.von),
          String(step.nach),
        ),
      );
    }
    chain.push(step);
    current = step.nach;
  }
  return ok(chain);
}

/**
 * Fuehrt die Migration eines Firmenordners auf `targetVersion` aus.
 * Idempotent: ist die Zielversion bereits erreicht, passiert nichts.
 */
export async function migrateCompanyFolder(
  companyDir: string,
  targetVersion: number = COMPANY_SCHEMA_VERSION,
  steps: readonly MigrationStep[] = MIGRATION_STEPS,
  deps: MigrationDeps = {},
): Promise<Result<MigrationOutcome, string>> {
  const logger = deps.logger;
  const now = (deps.now ?? (() => new Date()))();

  const currentVersion = await readSchemaVersion(companyDir);
  if (currentVersion === targetVersion) {
    return ok({ von: currentVersion, nach: targetVersion, durchgefuehrt: false, backupPfad: null });
  }
  if (currentVersion > targetVersion) {
    return err(texte().migration.neuereVersion(String(currentVersion), String(targetVersion)));
  }
  const chainResult = selectMigrationChain(steps, currentVersion, targetVersion);
  if (!chainResult.ok) {
    return chainResult;
  }

  // Schritt 2: Backup-erst (siehe Modulkommentar zur Ortswahl).
  const backupDir = join(
    companyDir,
    VOICEWALL_DIR,
    BACKUPS_DIR,
    `vor-migration-v${String(currentVersion)}-${timestampForDirName(now)}`,
  );
  const stagingDir = join(
    companyDir,
    `.voicewall-migration-staging-${randomBytes(6).toString('hex')}`,
  );
  try {
    await copyCompanyData(companyDir, backupDir);
    logger?.info('Migrations-Backup angelegt.', {
      from: String(currentVersion),
      to: String(targetVersion),
    });

    // Schritt 3: Migration auf der Staging-Kopie.
    await copyCompanyData(companyDir, stagingDir);
    const context: MigrationContext = {
      voicewallDir: join(stagingDir, 'voicewall'),
      diktateDir: join(stagingDir, 'diktate'),
    };
    for (const step of chainResult.value) {
      logger?.info(`Migrationsschritt laeuft: ${step.beschreibung}`, {
        from: String(step.von),
        to: String(step.nach),
      });
      await step.migrate(context);
      await writeSchemaVersionFile(context.voicewallDir, step.nach);
      await step.validate?.(context);
    }

    // Schritt 4: globale Validierung der Staging-Kopie.
    const stagedVersionRaw = await readFile(
      join(context.voicewallDir, SCHEMA_VERSION_FILE),
      'utf8',
    );
    if (Number.parseInt(stagedVersionRaw.trim(), 10) !== targetVersion) {
      throw new Error(
        'Validierung fehlgeschlagen: .schema-version entspricht nicht der Zielversion.',
      );
    }
    const stagedManifestRaw = await readFile(join(context.voicewallDir, MANIFEST_FILE), 'utf8');
    JSON.parse(stagedManifestRaw); // Muss parsebares JSON bleiben.
  } catch (error) {
    // VOR dem Swap gescheitert: Original ist unangetastet. Staging und
    // (ueberfluessiges) Backup entfernen, Fehler melden.
    await rm(stagingDir, { recursive: true, force: true });
    await rm(backupDir, { recursive: true, force: true });
    return err(
      texte().migration.abgebrochen(error instanceof Error ? error.message : String(error)),
    );
  }

  // Schritt 5: Swap per Rename, mit Rollback bei Teilerfolg.
  const altSuffix = randomBytes(4).toString('hex');
  const altVoicewall = join(companyDir, `.voicewall-alt-${altSuffix}`);
  const altDiktate = join(companyDir, `.diktate-alt-${altSuffix}`);
  const liveVoicewall = join(companyDir, VOICEWALL_DIR);
  const liveDiktate = join(companyDir, DIKTATE_DIR);
  try {
    await rename(liveVoicewall, altVoicewall);
    await rename(join(stagingDir, 'voicewall'), liveVoicewall);
    // Backups aus dem alten Stand in den neuen uebernehmen (inkl. des soeben
    // angelegten Backups dieses Laufs).
    try {
      await rename(join(altVoicewall, BACKUPS_DIR), join(liveVoicewall, BACKUPS_DIR));
    } catch {
      // Kein Backups-Ordner im alten Stand: nichts zu uebernehmen.
    }
    await rename(liveDiktate, altDiktate);
    await rename(join(stagingDir, 'diktate'), liveDiktate);
  } catch (swapError) {
    // Rollback: alten Stand wiederherstellen. Es wird NUR geloescht, wenn der
    // zugehoerige alt-Ordner nachweislich existiert (nie Originaldaten
    // entfernen); das Backup aus Schritt 2 bleibt zusaetzlich erhalten.
    logger?.error('Migrations-Swap fehlgeschlagen, Rollback laeuft.');
    try {
      if (await pathExists(altDiktate)) {
        await rm(liveDiktate, { recursive: true, force: true });
        await rename(altDiktate, liveDiktate);
      }
      if (await pathExists(altVoicewall)) {
        // Bereits uebernommene Backups in den alten Stand zurueckziehen.
        if (
          (await pathExists(join(liveVoicewall, BACKUPS_DIR))) &&
          !(await pathExists(join(altVoicewall, BACKUPS_DIR)))
        ) {
          await rename(join(liveVoicewall, BACKUPS_DIR), join(altVoicewall, BACKUPS_DIR)).catch(
            () => undefined,
          );
        }
        await rm(liveVoicewall, { recursive: true, force: true });
        await rename(altVoicewall, liveVoicewall);
      }
    } catch (rollbackError) {
      logger?.error(
        `Rollback unvollstaendig, bitte Backup pruefen: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
      );
    } finally {
      await rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
    }
    return err(
      texte().migration.swapFehlgeschlagen(
        basename(backupDir),
        swapError instanceof Error ? swapError.message : String(swapError),
      ),
    );
  }

  // Aufraeumen: alte Staende und leeres Staging entfernen.
  await rm(altVoicewall, { recursive: true, force: true }).catch(() => undefined);
  await rm(altDiktate, { recursive: true, force: true }).catch(() => undefined);
  await rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);

  logger?.info('Migration erfolgreich abgeschlossen.', {
    from: String(currentVersion),
    to: String(targetVersion),
  });
  return ok({
    von: currentVersion,
    nach: targetVersion,
    durchgefuehrt: true,
    backupPfad: join(liveVoicewall, BACKUPS_DIR, basename(backupDir)),
  });
}
