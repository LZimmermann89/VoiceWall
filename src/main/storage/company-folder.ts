/**
 * Anlage des Firmenordners.
 *
 * Struktur:
 *   <Basis>/<Firmenname>/
 *     .voicewall/           manifest.json, config.json, tags.json, .schema-version
 *     Diktate/              (Jahr/Monat-Unterordner entstehen beim Speichern)
 *     Exporte/
 *     Papierkorb/
 *
 * Garantien:
 * - Sanitisierung und Containment kommen ausnahmslos aus sanitize.ts
 *   (fertig getestet): Anzeigename bleibt unveraendert in der Konfig, der
 *   Ordnername ist das sanitisierte Segment.
 * - Atomar: die komplette Struktur entsteht zuerst in einem versteckten
 *   `.voicewall-tmp-<rand>`-Ordner und wird dann per `rename` an die finale
 *   Stelle bewegt. Ein Abbruch hinterlaesst nie einen halbfertigen
 *   Firmenordner.
 * - Idempotent: existiert bereits eine gueltige VoiceWall-Struktur
 *   (Marker `.voicewall/manifest.json`), wird sie uebernommen, nie
 *   ueberschrieben. Ein fremder Ordner wird NIE beschrieben; stattdessen gibt
 *   es ein Fehler-Result mit Namensvorschlag. Es wird nie geloescht.
 * - Restriktive Rechte: POSIX 0700 auf Firmenordner und `.voicewall/`.
 */
import { randomBytes } from 'node:crypto';
import { chmod, mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  COMPANY_SCHEMA_VERSION,
  type CompanyConfig,
  type Manifest,
  type TagsFile,
} from '../../shared/company';
import type { DictationLanguage } from '../../shared/schema';
import { texte } from '../i18n';
import { err, ok, type Result } from '../../shared/result';
import { formatIsoWithOffset } from '../../shared/time';
import { buildCompanyDirPath, findEquivalentDirEntry } from './sanitize';

/** Namen der Verwaltungsdateien und Unterordner. */
export const VOICEWALL_DIR = '.voicewall';
export const MANIFEST_FILE = 'manifest.json';
export const CONFIG_FILE = 'config.json';
export const TAGS_FILE = 'tags.json';
export const SCHEMA_VERSION_FILE = '.schema-version';
export const DIKTATE_DIR = 'Diktate';
export const EXPORTE_DIR = 'Exporte';
export const PAPIERKORB_DIR = 'Papierkorb';

export interface CreateCompanyFolderOptions {
  /** App-Version fuer `erstelltMit` (z. B. "VoiceWall 0.1.0"). */
  readonly erstelltMit: string;
  /** Diktatsprache der Firma (Default 'de'). */
  readonly sprache?: DictationLanguage;
  readonly modell?: string;
  /**
   * Optionaler, vom Nutzer im Wizard editierter Ordnername. Er durchlaeuft
   * exakt dieselbe Sanitisierungs- und Containment-Pipeline wie der
   * Anzeigename (buildCompanyDirPath); der Anzeigename bleibt unveraendert.
   */
  readonly ordnername?: string;
  /** Optionale Firmendaten aus dem Wizard (bereits bereinigt/validiert). */
  readonly details?: {
    readonly ansprechpartner: string;
    readonly email: string;
    readonly standort: string;
    readonly hinweis: string;
  };
  /** Injektionspunkt fuer Tests (deterministische Zeit). */
  readonly now?: () => Date;
}

export interface CreateCompanyFolderSuccess {
  /** Absoluter Pfad des Firmenordners. */
  readonly dirPath: string;
  /** Sanitisierter Ordnername (ein Segment). */
  readonly ordnername: string;
  /** True: bestehende VoiceWall-Struktur wurde uebernommen. */
  readonly uebernommen: boolean;
}

export interface CompanyFolderError {
  readonly kind: 'sanitize' | 'fremder-ordner' | 'io';
  readonly message: string;
  /** Alternativer Ordnername (nur bei fremder-ordner). */
  readonly vorschlag?: string;
}

/** Prueft den VoiceWall-Marker: `.voicewall/manifest.json` existiert. */
export async function isVoiceWallFolder(dirPath: string): Promise<boolean> {
  try {
    return (await stat(join(dirPath, VOICEWALL_DIR, MANIFEST_FILE))).isFile();
  } catch {
    return false;
  }
}

/** POSIX-Rechte 0700 setzen (unter Windows wirkungslos, dort ACL-privat). */
async function hardenDirMode(dirPath: string): Promise<void> {
  if (process.platform !== 'win32') {
    await chmod(dirPath, 0o700);
  }
}

function initialManifest(now: Date): Manifest {
  return {
    schemaVersion: COMPANY_SCHEMA_VERSION,
    generiert: formatIsoWithOffset(now),
    eintraege: [],
  };
}

function initialTags(): TagsFile {
  return { schemaVersion: COMPANY_SCHEMA_VERSION, tags: [] };
}

function initialConfig(
  anzeigename: string,
  ordnername: string,
  options: CreateCompanyFolderOptions,
  now: Date,
): CompanyConfig {
  return {
    schemaVersion: COMPANY_SCHEMA_VERSION,
    firma: {
      anzeigename,
      ordnername,
      ansprechpartner: options.details?.ansprechpartner ?? '',
      email: options.details?.email ?? '',
      standort: options.details?.standort ?? '',
      hinweis: options.details?.hinweis ?? '',
    },
    sprache: options.sprache ?? 'de',
    modell: options.modell ?? 'q5_0',
    erstelltMit: options.erstelltMit,
    erstellt: formatIsoWithOffset(now),
  };
}

/**
 * Baut die komplette Struktur in `rootDir` auf (fuer den Temp-Ordner bei der
 * Anlage). Dateien entstehen hier direkt (die Atomaritaet liefert der
 * abschliessende Verzeichnis-Rename), Konfigdateien mit Modus 0600.
 */
async function buildStructure(
  rootDir: string,
  anzeigename: string,
  ordnername: string,
  options: CreateCompanyFolderOptions,
): Promise<void> {
  const now = (options.now ?? (() => new Date()))();
  const voicewallDir = join(rootDir, VOICEWALL_DIR);
  await mkdir(voicewallDir, { recursive: true, mode: 0o700 });
  await mkdir(join(rootDir, DIKTATE_DIR), { recursive: true });
  await mkdir(join(rootDir, EXPORTE_DIR), { recursive: true });
  await mkdir(join(rootDir, PAPIERKORB_DIR), { recursive: true });
  const writeJson = (file: string, value: unknown): Promise<void> =>
    writeFile(join(voicewallDir, file), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await writeJson(MANIFEST_FILE, initialManifest(now));
  await writeJson(CONFIG_FILE, initialConfig(anzeigename, ordnername, options, now));
  await writeJson(TAGS_FILE, initialTags());
  await writeFile(join(voicewallDir, SCHEMA_VERSION_FILE), `${String(COMPANY_SCHEMA_VERSION)}\n`, {
    mode: 0o600,
  });
  await hardenDirMode(voicewallDir);
  await hardenDirMode(rootDir);
}

/**
 * Uebernahme eines bestehenden VoiceWall-Ordners (idempotent): fehlende
 * Unterordner werden ergaenzt, vorhandene Dateien NIE ueberschrieben,
 * Rechte werden gehaertet.
 */
async function adoptExistingFolder(dirPath: string): Promise<void> {
  await mkdir(join(dirPath, DIKTATE_DIR), { recursive: true });
  await mkdir(join(dirPath, EXPORTE_DIR), { recursive: true });
  await mkdir(join(dirPath, PAPIERKORB_DIR), { recursive: true });
  await hardenDirMode(join(dirPath, VOICEWALL_DIR));
  await hardenDirMode(dirPath);
}

/** Findet einen freien alternativen Ordnernamen fuer die Kollisionsmeldung. */
export function suggestAlternativeName(
  existingEntries: readonly string[],
  segment: string,
): string {
  const primary = `${segment} (VoiceWall)`;
  if (findEquivalentDirEntry(existingEntries, primary) === null) {
    return primary;
  }
  for (let counter = 2; counter < 100; counter += 1) {
    const candidate = `${segment}-${String(counter)}`;
    if (findEquivalentDirEntry(existingEntries, candidate) === null) {
      return candidate;
    }
  }
  return `${segment}-${Date.now().toString(36)}`;
}

/**
 * Legt den Firmenordner unter `baseDir` an (oder uebernimmt einen
 * bestehenden VoiceWall-Ordner). Siehe Modulkommentar fuer die Garantien.
 */
export async function createCompanyFolder(
  baseDir: string,
  anzeigename: string,
  options: CreateCompanyFolderOptions,
): Promise<Result<CreateCompanyFolderSuccess, CompanyFolderError>> {
  // Schritt 1: Sanitisierung + Containment (Pipeline aus sanitize.ts).
  // Basis ist der ggf. im Wizard editierte Ordnername, sonst der Anzeigename.
  const built = buildCompanyDirPath(baseDir, options.ordnername ?? anzeigename);
  if (!built.ok) {
    return err({ kind: 'sanitize', message: built.error.message });
  }
  const { segment, dirPath } = built.value;

  // Schritt 2: Kollisionspruefung (NFC/NFD- und case-insensitiv).
  let entries: string[];
  try {
    entries = await readdir(baseDir);
  } catch (error) {
    return err({
      kind: 'io',
      message: texte().firmen.zielordnerNichtLesbar(
        error instanceof Error ? error.message : String(error),
      ),
    });
  }
  const existingName = findEquivalentDirEntry(entries, segment);
  if (existingName !== null) {
    const existingPath = join(baseDir, existingName);
    if (await isVoiceWallFolder(existingPath)) {
      // Bestehenden Datenraum uebernehmen: nie ueberschreiben, nie loeschen.
      await adoptExistingFolder(existingPath);
      return ok({ dirPath: existingPath, ordnername: existingName, uebernommen: true });
    }
    // Fremder Ordner: NICHT hineinschreiben, Vorschlag fuer die Rueckfrage.
    return err({
      kind: 'fremder-ordner',
      message: texte().firmen.ordnerFremd(existingName),
      vorschlag: suggestAlternativeName(entries, segment),
    });
  }

  // Schritt 3: atomare Anlage (Temp-Ordner, dann Rename).
  const tmpDir = join(baseDir, `.voicewall-tmp-${randomBytes(6).toString('hex')}`);
  try {
    await mkdir(tmpDir, { recursive: true, mode: 0o700 });
    await buildStructure(tmpDir, anzeigename, segment, options);
    await rename(tmpDir, dirPath);
  } catch (error) {
    // Aufraeumen ohne Datenverlust: nur der eigene Temp-Ordner wird entfernt.
    await rm(tmpDir, { recursive: true, force: true });
    // Race: ist der Zielordner inzwischen (durch eine parallele Anlage)
    // entstanden und ein gueltiger VoiceWall-Ordner, wird er uebernommen.
    if (await isVoiceWallFolder(dirPath)) {
      await adoptExistingFolder(dirPath);
      return ok({ dirPath, ordnername: segment, uebernommen: true });
    }
    return err({
      kind: 'io',
      message: texte().firmen.ordnerAnlageFehler(
        error instanceof Error ? error.message : String(error),
      ),
    });
  }
  return ok({ dirPath, ordnername: segment, uebernommen: false });
}
