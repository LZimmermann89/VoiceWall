/**
 * Mehr-Firmen-Verwaltung (M5, ABARBEITUNG 4.6).
 *
 * Der CompanyManager verwaltet die Liste der Firmenordner (globale Konfig),
 * die aktive Firma, die Anlage neuer Firmen (inkl. Sync-Fallen-Pruefung und
 * beider Speicherstrategien) und die Diktat-Operationen der aktiven Firma
 * (speichern, auflisten, suchen).
 *
 * Sicherheitsgrundsaetze:
 * - Firmenpfade aus der globalen Konfig sind fremder Input. Beim Laden wird
 *   jeder Eintrag validiert: absoluter Pfad, DIREKTES Kind eines erlaubten
 *   Basisordners (Desktop, ~/VoiceWall, ggf. Test-Basis) und gueltiger
 *   VoiceWall-Marker. Ungueltige Eintraege werden ignoriert und geloggt,
 *   nie blind verfolgt (ABARBEITUNG 4.5).
 * - Physische Trennung: jede Operation arbeitet ausschliesslich im Ordner
 *   der aktiven Firma; es gibt keine Querbezuege zwischen Firmen.
 * - Alle IPC-Handler: zod-Eingabevalidierung, Result-Antworten, keine
 *   Stacktraces ueber die Prozessgrenze.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { dialog, ipcMain, shell } from 'electron';
import { z } from 'zod';
import {
  batchExportInputSchema,
  companyConfigSchema,
  companyDetailsSchema,
  companyStorageStrategySchema,
  decryptFileInputSchema,
  dictateSearchFilterSchema,
  dictateUpdateInputSchema,
  encryptedExportInputSchema,
  exportInputSchema,
  manualNoteInputSchema,
  safeRelativePathSchema,
  tagRenameInputSchema,
  type BatchExportInput,
  type BatchExportResult,
  type BelegInfoResult,
  type CompanyConfig,
  type CompanyDetails,
  type CompanyInfo,
  type CompanyListView,
  type CompanyNamePreview,
  type CompanyStorageStrategy,
  type CreateCompanyResult,
  type DecryptFileResult,
  type DictateDetailResult,
  type DictateListResult,
  type DictateMutationResult,
  type DictateSearchFilter,
  type DictateUpdateInput,
  type EncryptedExportInput,
  type ExportInput,
  type ExportProgress,
  type ExportResult,
  type ManualNoteInput,
  type SaveDictateResult,
  type SyncCheckView,
  type TagRenameInput,
  type TagRenameResult,
  type TranscriptQuelle,
  type TrashListResult,
} from '../../shared/company';
import {
  dictationLanguageSchema,
  type ActionResult,
  type DictationLanguage,
} from '../../shared/schema';
import { collectBelegInfo } from '../beleg/beleg-info';
import type { DictationContext } from '../whisper/engine-manager';
import type { GlobalConfig } from '../../shared/config';
import { readGlobalConfig } from '../config/config-store';
import { GlobalConfigWriter, type GlobalConfigMutator } from '../config/config-writer';
import { texte } from '../i18n';
import { IpcChannel } from '../ipc/channels';
import type { Logger } from '../log/logger';
import { migrateCompanyFolder } from './migration';
import {
  CONFIG_FILE,
  EXPORTE_DIR,
  VOICEWALL_DIR,
  createCompanyFolder,
  isVoiceWallFolder,
} from './company-folder';
import { isDirectChildOf } from './containment';
import {
  addKnownTags,
  buildManifestEntry,
  readKnownTags,
  readManifestWithHealing,
  removeManifestEntry,
  searchManifest,
  upsertManifestEntry,
} from './manifest';
import { exportTranscriptsBatch, type BatchExportDeps } from './batch-export';
import { decryptFromVwenc, encryptToVwenc, VWENC_EXTENSION } from './encrypted-export';
import { buildExportContent, exportBaseName, exportTranscript, writeExportFile } from './export';
import { searchTranscriptBodies } from './fulltext';
import { exportTranscriptPdf, PdfRenderer } from './pdf-export';
import { buildPrintHtml } from './pdf-template';
import { renameTagEverywhere } from './tag-rename';
import { writeFileAtomic } from './atomic-write';
import { sanitizeCompanyName } from './sanitize';
import {
  buildInitialPrompt,
  defaultVokabular,
  vokabularSaveInputSchema,
  VOKABULAR_SCHEMA_VERSION,
  type Ersetzung,
  type Vokabular,
  type VokabularGetResult,
} from '../../shared/vokabular';
import { readVokabular, writeVokabular } from './vokabular-store';
import {
  checkSyncExposure,
  createDesktopLink,
  localStorageBaseDir,
  type SyncCheckResult,
} from './sync-detection';
import {
  createTranscript,
  hardDeleteTranscript,
  listPapierkorb,
  readTranscript,
  restoreTranscript,
  softDeleteTranscript,
  updateTranscript,
} from './transcripts';
import { resolveInsideDir } from './containment';

export interface CompanyManagerDeps {
  readonly userDataPath: string;
  readonly logger: Logger;
  /** Desktop-Ordner (null, wenn nicht ermittelbar; der Wizard fragt dann). */
  readonly resolveDesktop: () => Promise<string | null>;
  /** Lokaler, bewusst nicht synchronisierter Basisordner (~/VoiceWall). */
  readonly localBase?: string;
  /** Zusaetzlich erlaubte Basisordner (nur Dev/Test, nie im Produkt). */
  readonly extraAllowedBases?: readonly string[];
  /** App-Kennung fuer `erstelltMit` in neuen Firmen-Konfigs. */
  readonly appVersion: string;
  readonly now?: () => Date;
  /**
   * Injektionspunkt fuer Tests (deterministische Nachstellung des
   * Lade-Timings der globalen Konfiguration). Default: readGlobalConfig.
   */
  readonly readConfig?: () => Promise<GlobalConfig>;
  /**
   * Wird nach Firmenwechsel, Firmen-Anlage und Sprachwechsel aufgerufen
   * (Paket B1): der Orchestrator aktualisiert damit Status/Modellbedarf.
   */
  readonly onCompanyChanged?: () => void;
  /**
   * Zentraler, serialisierter Konfig-Schreibpfad (E42). Im App-Bootstrap
   * wird DIESELBE Instanz wie beim FlowController injiziert; ohne Injektion
   * (Unit-Tests) entsteht eine eigene Instanz mit demselben Verhalten.
   */
  readonly configWriter?: GlobalConfigWriter;
}

export interface SaveDictateInput {
  readonly text: string;
  readonly titel?: string;
  readonly dauerSekunden: number;
  readonly quelle: TranscriptQuelle;
  readonly modell: string;
  readonly sprache?: string;
  readonly zielApp?: string;
}

/**
 * Bereinigt ein Wizard-Textfeld: Unicode-NFC-Normalisierung und Entfernen
 * aller Steuerzeichen (konsistent zur clean()-Baseline, ABARBEITUNG 4.2.1).
 */
export function cleanWizardText(value: string): string {
  // eslint-disable-next-line no-control-regex -- Steuerzeichen sind hier genau das Ziel.
  const controlChars = /[\u0000-\u001F\u007F]/g;
  return value.normalize('NFC').replace(controlChars, '').trim();
}

/** Leitet einen Titel aus den ersten Worten des Textes ab (max. 60 Zeichen). */
export function titleFromText(text: string): string {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return texte().diktate.titelFallback;
  }
  let title = '';
  for (const word of words) {
    const candidate = title.length === 0 ? word : `${title} ${word}`;
    if (Array.from(candidate).length > 60) {
      break;
    }
    title = candidate;
  }
  return title.length === 0 ? texte().diktate.titelFallback : title;
}

export class CompanyManager {
  private config: GlobalConfig | null = null;
  /** Laufender Erst-Ladevorgang der Konfig (genau EIN Disk-Read, geteilt). */
  private configLoading: Promise<GlobalConfig> | null = null;
  /** Serialisierter Schreibpfad (E42): injiziert oder eigene Instanz. */
  private readonly writer: GlobalConfigWriter;

  constructor(private readonly deps: CompanyManagerDeps) {
    this.writer =
      deps.configWriter ??
      new GlobalConfigWriter({
        userDataPath: deps.userDataPath,
        logger: deps.logger,
        ...(deps.readConfig === undefined ? {} : { readConfig: deps.readConfig }),
      });
  }

  /**
   * Laedt die globale Konfiguration (einmalig, weitere Zugriffe gecacht).
   *
   * WICHTIG (Lost-Update-Abwehr): Frueher stand hier
   * `this.config ??= await readGlobalConfig(...)`. Das prueft `this.config`
   * VOR dem await und weist NACH dem await bedingungslos zu. Ein
   * `persistConfig()` (z. B. `createCompany` setzt die aktive Firma), das
   * innerhalb dieses Fensters abschliesst, wurde vom verspaetet
   * aufloesenden, veralteten Ladeergebnis wieder ueberschrieben; die soeben
   * angelegte Firma war dann "weg" ("Keine aktive Firma"). Sichtbar nur
   * unter Last (mehrere parallele IPC-Aufrufe beim App-Start), daher flaky.
   *
   * Deshalb jetzt: (1) der Erst-Read wird als Promise memoisiert, es gibt
   * nie zwei konkurrierende Reads; (2) nach dem await wird das Ladeergebnis
   * nur SYNCHRON per `??=` uebernommen, d. h. ein zwischenzeitlich per
   * persistConfig gesetzter (neuerer) Zustand gewinnt immer. Regressions-
   * Beweis: tests/unit/companies.test.ts ("Kein Lost-Update ...").
   */
  private async loadConfig(): Promise<GlobalConfig> {
    if (this.config !== null) {
      return this.config;
    }
    this.configLoading ??= (
      this.deps.readConfig ?? (() => readGlobalConfig(this.deps.userDataPath, this.deps.logger))
    )();
    const geladen = await this.configLoading;
    // Synchroner Check ohne await dazwischen: kein Lost-Update mehr moeglich.
    this.config ??= geladen;
    return this.config;
  }

  /**
   * Persistiert eine DELTA-Aenderung ueber den zentralen, serialisierten
   * Writer (E42): frisch lesen, Mutator anwenden, atomar schreiben. Der
   * geschriebene Stand wird als neuer in-memory-Cache uebernommen; ein
   * veralteter Zwischenstand kann fremde Aenderungen (z. B. UI-Sprache,
   * Aufbereitungs-Schalter) damit nie mehr ueberschreiben.
   */
  private async persistConfig(mutate: GlobalConfigMutator): Promise<void> {
    this.config = await this.writer.update(mutate);
  }

  private localBase(): string {
    return this.deps.localBase ?? localStorageBaseDir();
  }

  /** Erlaubte Elternverzeichnisse fuer Firmenordner. */
  private async allowedBases(): Promise<readonly string[]> {
    const bases: string[] = [];
    const desktop = await this.deps.resolveDesktop();
    if (desktop !== null) {
      bases.push(desktop);
    }
    bases.push(this.localBase());
    bases.push(...(this.deps.extraAllowedBases ?? []));
    return bases;
  }

  /**
   * Validiert einen Firmenpfad aus der Konfig: absolut, direktes Kind eines
   * erlaubten Basisordners, gueltiger VoiceWall-Marker. Nie blind folgen.
   */
  private async isValidCompanyPath(pfad: string, bases: readonly string[]): Promise<boolean> {
    if (!isAbsolute(pfad)) {
      return false;
    }
    if (!bases.some((base) => isDirectChildOf(base, pfad))) {
      return false;
    }
    return isVoiceWallFolder(pfad);
  }

  /**
   * Liest Anzeigename und Diktatsprache aus der firmenbezogenen Konfig
   * (Fallback: Ordnername und Deutsch, wenn die Konfig fehlt/kaputt ist).
   */
  private async readCompanyMeta(
    pfad: string,
    ordnername: string,
  ): Promise<{ anzeigename: string; sprache: DictationLanguage }> {
    try {
      const raw = await readFile(join(pfad, VOICEWALL_DIR, CONFIG_FILE), 'utf8');
      const parsed = companyConfigSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        return { anzeigename: parsed.data.firma.anzeigename, sprache: parsed.data.sprache };
      }
    } catch {
      // Konfig fehlt/kaputt: Ordnername als Anzeige, Deutsch als Sprache.
    }
    return { anzeigename: ordnername, sprache: 'de' };
  }

  /** Liste aller validierten Firmen plus aktive Firma und Auto-Speichern. */
  async listCompanies(): Promise<CompanyListView> {
    const config = await this.loadConfig();
    const bases = await this.allowedBases();
    const seen = new Set<string>();
    const firmen: CompanyInfo[] = [];
    for (const rawPfad of config.firmen) {
      const pfad = rawPfad.normalize('NFC');
      if (seen.has(pfad)) {
        continue;
      }
      seen.add(pfad);
      if (!(await this.isValidCompanyPath(pfad, bases))) {
        this.deps.logger.warn(
          'Firmeneintrag in der Konfiguration ist ungueltig oder liegt ausserhalb der erlaubten Ordner; Eintrag wird ignoriert.',
        );
        continue;
      }
      const ordnername = pfad.split(/[\\/]/).pop() ?? pfad;
      const meta = await this.readCompanyMeta(pfad, ordnername);
      firmen.push({
        pfad,
        ordnername,
        anzeigename: meta.anzeigename,
        sprache: meta.sprache,
        aktiv: config.aktiveFirma !== null && config.aktiveFirma.normalize('NFC') === pfad,
      });
    }
    const aktive = firmen.find((firma) => firma.aktiv) ?? null;
    return {
      firmen,
      aktiveFirma: aktive?.pfad ?? null,
      autoSpeichern: config.diktatAutoSpeichern && aktive !== null,
    };
  }

  /** Pfad der aktiven, VALIDIERTEN Firma oder null. */
  async activeCompanyDir(): Promise<string | null> {
    const list = await this.listCompanies();
    return list.aktiveFirma;
  }

  /** Effektiver Auto-Speichern-Zustand (Schalter UND Firma vorhanden). */
  async isAutoSaveEnabled(): Promise<boolean> {
    return (await this.listCompanies()).autoSpeichern;
  }

  async setAutoSave(enabled: boolean): Promise<void> {
    await this.loadConfig();
    await this.persistConfig((current) => ({ ...current, diktatAutoSpeichern: enabled }));
  }

  /** Vorschau des sanitisierten Ordnernamens (Wizard: Name -> bestaetigen). */
  previewName(rawName: string): CompanyNamePreview {
    const result = sanitizeCompanyName(rawName);
    return result.ok
      ? { ok: true, ordnername: result.value }
      : { ok: false, message: result.error.message };
  }

  /** Sync-Pruefung des Desktop-Zielordners (fuer Warnung im Wizard/UI). */
  async checkDesktopSync(): Promise<SyncCheckView> {
    const desktop = await this.deps.resolveDesktop();
    if (desktop === null) {
      return { synchronisiert: false, anbieter: null, hinweis: null };
    }
    const result: SyncCheckResult = await checkSyncExposure(desktop);
    return {
      synchronisiert: result.synchronisiert,
      anbieter: result.anbieter,
      hinweis: result.hinweis,
    };
  }

  /**
   * Legt eine neue Firma an. Strategie `desktop`: Firmenordner direkt auf
   * dem Desktop (bei erkanntem Sync mit Warnung im Ergebnis). Strategie
   * `lokal-mit-verknuepfung`: Firmenordner unter ~/VoiceWall plus
   * Desktop-Verknuepfung (rettet das "100 Prozent lokal"-Versprechen, R8).
   */
  async createCompany(
    rawName: string,
    strategie: CompanyStorageStrategy,
    details?: CompanyDetails,
    modell?: 'q5_0' | 'fp16',
    ordnername?: string,
    sprache?: DictationLanguage,
  ): Promise<CreateCompanyResult> {
    let baseDir: string;
    let syncWarnung: string | null = null;
    let verknuepfungHinweis: string | null = null;
    const desktop = await this.deps.resolveDesktop();

    if (strategie === 'desktop') {
      if (desktop === null) {
        return { ok: false, message: texte().firmen.desktopFehltStrategie, vorschlag: null };
      }
      baseDir = desktop;
      const sync = await checkSyncExposure(desktop);
      syncWarnung = sync.hinweis;
    } else {
      // Lokalen Basisordner sicherstellen (idempotent, POSIX 0700).
      try {
        await mkdir(this.localBase(), { recursive: true, mode: 0o700 });
      } catch (error) {
        return {
          ok: false,
          message: texte().firmen.lokalerOrdnerFehler(
            error instanceof Error ? error.message : String(error),
          ),
          vorschlag: null,
        };
      }
      baseDir = this.localBase();
    }

    const created = await createCompanyFolder(baseDir, rawName, {
      erstelltMit: this.deps.appVersion,
      ...(ordnername === undefined || ordnername.trim().length === 0 ? {} : { ordnername }),
      ...(modell === undefined ? {} : { modell }),
      ...(sprache === undefined ? {} : { sprache }),
      ...(details === undefined
        ? {}
        : {
            details: {
              ansprechpartner: cleanWizardText(details.ansprechpartner),
              email: cleanWizardText(details.email),
              standort: cleanWizardText(details.standort),
              hinweis: cleanWizardText(details.hinweis),
            },
          }),
      ...(this.deps.now === undefined ? {} : { now: this.deps.now }),
    });
    if (!created.ok) {
      return {
        ok: false,
        message: created.error.message,
        vorschlag: created.error.vorschlag ?? null,
      };
    }

    if (strategie === 'lokal-mit-verknuepfung' && desktop !== null) {
      const link = await createDesktopLink({
        targetDir: created.value.dirPath,
        desktopDir: desktop,
        linkName: created.value.ordnername,
      });
      verknuepfungHinweis = link.ok
        ? texte().firmen.verknuepfungAngelegt(created.value.ordnername, created.value.dirPath)
        : texte().firmen.verknuepfungHinweis(link.error);
    }

    // Globale Konfig ergaenzen (dedupliziert) und Firma aktivieren.
    await this.loadConfig();
    const pfad = created.value.dirPath.normalize('NFC');
    await this.persistConfig((current) => ({
      ...current,
      firmen: current.firmen.map((entry) => entry.normalize('NFC')).includes(pfad)
        ? current.firmen
        : [...current.firmen, pfad],
      aktiveFirma: pfad,
    }));

    this.deps.logger.info('Firma angelegt bzw. uebernommen und aktiviert.', {
      outcome: created.value.uebernommen ? 'uebernommen' : 'neu',
    });
    this.deps.onCompanyChanged?.();
    return {
      ok: true,
      pfad,
      ordnername: created.value.ordnername,
      uebernommen: created.value.uebernommen,
      syncWarnung,
      verknuepfungHinweis,
    };
  }

  /** Aktive Firma wechseln (nur auf validierte Eintraege). */
  async setActiveCompany(pfad: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const list = await this.listCompanies();
    const normalized = pfad.normalize('NFC');
    if (!list.firmen.some((firma) => firma.pfad === normalized)) {
      return { ok: false, message: texte().firmen.nichtInListe };
    }
    await this.loadConfig();
    await this.persistConfig((current) => ({ ...current, aktiveFirma: normalized }));
    // Firmenwechsel kann die Diktatsprache wechseln: Status aktualisieren.
    this.deps.onCompanyChanged?.();
    return { ok: true };
  }

  /**
   * Diktatsprache der aktiven Firma (Paket B1): bestimmt Modell und
   * `language`-Parameter der Transkription. Lese-Fehler fallen bewusst auf
   * Deutsch zurueck, ein Diktat scheitert nie an einer kaputten Konfig.
   */
  async activeSprache(): Promise<DictationLanguage> {
    const list = await this.listCompanies();
    return list.firmen.find((firma) => firma.aktiv)?.sprache ?? 'de';
  }

  /**
   * Diktat-Kontext fuer den Orchestrator (Paket B1): Sprache der aktiven
   * Firma plus Initial-Prompt des Fach-Woerterbuchs (Stufe 1).
   */
  async activeDictationContext(): Promise<DictationContext> {
    return { language: await this.activeSprache(), prompt: await this.activePrompt() };
  }

  /**
   * Diktatsprache der AKTIVEN Firma nachtraeglich wechseln (Verwaltung):
   * schreibt das Feld `sprache` atomar in die firmenbezogene Konfig. Das
   * passende Modell laedt/startet der Orchestrator beim naechsten Diktat
   * (bzw. ueber den Modell-Download-Knopf), nie hier.
   */
  async setCompanyLanguage(sprache: DictationLanguage): Promise<ActionResult> {
    const active = await this.requireActiveDir();
    if (!active.ok) {
      return active;
    }
    const configPath = join(active.dir, VOICEWALL_DIR, CONFIG_FILE);
    let parsed: ReturnType<typeof companyConfigSchema.safeParse>;
    try {
      parsed = companyConfigSchema.safeParse(JSON.parse(await readFile(configPath, 'utf8')));
    } catch {
      return { ok: false, message: texte().firmen.konfigNichtLesbar };
    }
    if (!parsed.success) {
      return { ok: false, message: texte().firmen.konfigUngueltig };
    }
    const next: CompanyConfig = { ...parsed.data, sprache };
    try {
      await writeFileAtomic(configPath, `${JSON.stringify(next, null, 2)}\n`);
    } catch (error) {
      return {
        ok: false,
        message: texte().firmen.konfigSchreibFehler(
          error instanceof Error ? error.message : String(error),
        ),
      };
    }
    this.deps.logger.info('Diktatsprache der aktiven Firma geändert.', { sprache });
    this.deps.onCompanyChanged?.();
    return { ok: true };
  }

  /**
   * Bestehenden Firmenordner oeffnen (z. B. nach Restore/Umzug): Pfad wird
   * gegen die erlaubten Basisordner und den Marker validiert, das Schema
   * per Migrationsroutine auf die aktuelle Version gebracht und das
   * Manifest bei Bedarf per Rebuild geheilt.
   */
  async openCompany(pfad: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const bases = await this.allowedBases();
    const normalized = pfad.normalize('NFC');
    if (!(await this.isValidCompanyPath(normalized, bases))) {
      return { ok: false, message: texte().firmen.keinGueltigerOrdner };
    }
    const migration = await migrateCompanyFolder(normalized);
    if (!migration.ok) {
      return { ok: false, message: migration.error };
    }
    const manifest = await readManifestWithHealing(normalized, this.deps.logger);
    if (!manifest.ok) {
      return { ok: false, message: manifest.error };
    }
    await this.loadConfig();
    await this.persistConfig((current) => ({
      ...current,
      firmen: current.firmen.map((entry) => entry.normalize('NFC')).includes(normalized)
        ? current.firmen
        : [...current.firmen, normalized],
      aktiveFirma: normalized,
    }));
    this.deps.onCompanyChanged?.();
    return { ok: true };
  }

  /** Speichert einen Text als Diktat in der aktiven Firma. */
  async saveDictate(input: SaveDictateInput): Promise<SaveDictateResult> {
    const companyDir = await this.activeCompanyDir();
    if (companyDir === null) {
      return { ok: false, message: texte().firmen.keineAktiveFirma };
    }
    const titel = input.titel ?? titleFromText(input.text);
    const created = await createTranscript(companyDir, {
      titel,
      body: input.text,
      sprache: input.sprache ?? 'de',
      modell: input.modell,
      dauerSekunden: input.dauerSekunden,
      tags: [],
      quelle: input.quelle,
      ...(input.zielApp === undefined ? {} : { zielApp: input.zielApp }),
    });
    if (!created.ok) {
      return { ok: false, message: created.error };
    }
    // Manifest inkrementell nachfuehren (Body erneut lesen vermeiden: die
    // Vorschau entsteht aus dem Eingabetext).
    await upsertManifestEntry(
      companyDir,
      buildManifestEntry(created.value.meta, created.value.relPfad, input.text),
    );
    await addKnownTags(companyDir, created.value.meta.tags);
    this.deps.logger.info('Diktat gespeichert.', {
      chars: input.text.length,
      source: input.quelle,
    });
    return { ok: true, pfad: created.value.relPfad, id: created.value.meta.id };
  }

  /**
   * Liste/Schnellsuche der Diktate der aktiven Firma (Manifest-basiert).
   * Mit `volltext: true` (M8, ABARBEITUNG 4.4.5) werden zusaetzlich die
   * Markdown-Bodies durchsucht (Streaming-Scan, Suchbegriff strikt als
   * Literal): ein Eintrag trifft, wenn Manifest ODER Body den Begriff
   * enthaelt; Body-Treffer liefern ein Kontext-Snippet.
   */
  async listDictates(filter: DictateSearchFilter): Promise<DictateListResult> {
    const companyDir = await this.activeCompanyDir();
    if (companyDir === null) {
      return { ok: false, message: texte().firmen.keineAktiveFirma };
    }
    const manifest = await readManifestWithHealing(companyDir, this.deps.logger);
    if (!manifest.ok) {
      return { ok: false, message: manifest.error };
    }
    const text = filter.text?.trim() ?? '';
    if (filter.volltext === true && text.length > 0) {
      // Alle uebrigen Filter (Zeitraum, Tags, Quelle) zuerst anwenden, dann
      // Schnellsuche-Treffer und Body-Treffer vereinigen.
      const ohneText = { ...filter };
      delete ohneText.text;
      delete ohneText.volltext;
      const basis = searchManifest(manifest.value.eintraege, ohneText);
      const schnellTreffer = new Set(searchManifest(basis, { text }).map((entry) => entry.id));
      const bodyTreffer = await searchTranscriptBodies(companyDir, basis, text);
      return {
        ok: true,
        eintraege: basis.filter(
          (entry) => schnellTreffer.has(entry.id) || bodyTreffer.has(entry.id),
        ),
        volltextTreffer: [...bodyTreffer.entries()].map(([id, snippet]) => ({ id, snippet })),
      };
    }
    return { ok: true, eintraege: searchManifest(manifest.value.eintraege, filter) };
  }

  /** Liest ein Diktat der aktiven Firma (Containment-gesichert). */
  async readDictate(
    relPfad: string,
  ): Promise<{ ok: true; body: string } | { ok: false; message: string }> {
    const companyDir = await this.activeCompanyDir();
    if (companyDir === null) {
      return { ok: false, message: texte().firmen.keineAktiveFirmaKurz };
    }
    const result = await readTranscript(companyDir, relPfad);
    return result.ok ? { ok: true, body: result.value.body } : { ok: false, message: result.error };
  }

  // ------------------------------------------------------------------
  // Verwaltungs-UI (M7): Detail, Bearbeiten, Notiz, Tags, Export,
  // Papierkorb, Beleg. Alle Operationen arbeiten AUSSCHLIESSLICH im
  // Ordner der aktiven Firma; Pfade sind stets sichere relative Pfade,
  // die der Main-Prozess selbst aufloest und auf Containment prueft.
  // ------------------------------------------------------------------

  private async requireActiveDir(): Promise<
    { ok: true; dir: string } | { ok: false; message: string }
  > {
    const companyDir = await this.activeCompanyDir();
    if (companyDir === null) {
      return { ok: false, message: texte().firmen.keineAktiveFirma };
    }
    return { ok: true, dir: companyDir };
  }

  /** Vollstaendige Detailansicht eines Diktats (Metadaten plus Body). */
  async getDictate(relPfad: string): Promise<DictateDetailResult> {
    const active = await this.requireActiveDir();
    if (!active.ok) {
      return active;
    }
    const doc = await readTranscript(active.dir, relPfad);
    if (!doc.ok) {
      return { ok: false, message: doc.error };
    }
    return {
      ok: true,
      detail: { meta: doc.value.meta, body: doc.value.body, pfad: doc.value.relPfad },
    };
  }

  /**
   * Bearbeitet ein Diktat: Titel, Body und/oder Tags. Die update-API fuehrt
   * `geaendert`/`version` atomar nach; das Manifest wird inkrementell
   * aktualisiert und neue Tags landen in tags.json.
   */
  async updateDictate(input: DictateUpdateInput): Promise<DictateMutationResult> {
    const active = await this.requireActiveDir();
    if (!active.ok) {
      return active;
    }
    const changes: {
      titel?: string;
      body?: string;
      tags?: readonly string[];
    } = {};
    if (input.titel !== undefined) {
      changes.titel = input.titel;
    }
    if (input.body !== undefined) {
      changes.body = input.body;
    }
    if (input.tags !== undefined) {
      changes.tags = input.tags;
    }
    const updated = await updateTranscript(active.dir, input.pfad, changes);
    if (!updated.ok) {
      return { ok: false, message: updated.error };
    }
    const entry = buildManifestEntry(updated.value.meta, updated.value.relPfad, updated.value.body);
    await upsertManifestEntry(active.dir, entry);
    if (updated.value.meta.tags.length > 0) {
      await addKnownTags(active.dir, updated.value.meta.tags);
    }
    this.deps.logger.info('Diktat bearbeitet.', { version: updated.value.meta.version });
    return { ok: true, eintrag: entry, version: updated.value.meta.version };
  }

  /** Legt eine manuelle Notiz an (Quelle `manuell`, ohne Diktat). */
  async createManualNote(input: ManualNoteInput): Promise<SaveDictateResult> {
    const active = await this.requireActiveDir();
    if (!active.ok) {
      return active;
    }
    const created = await createTranscript(active.dir, {
      titel: input.titel,
      body: input.body,
      sprache: await this.activeSprache(),
      // Kein Erkennungsmodell: manuelle Eingabe. Der Wert dokumentiert die Herkunft.
      modell: 'manuell',
      dauerSekunden: 0,
      tags: [],
      quelle: 'manuell',
    });
    if (!created.ok) {
      return { ok: false, message: created.error };
    }
    await upsertManifestEntry(
      active.dir,
      buildManifestEntry(created.value.meta, created.value.relPfad, input.body),
    );
    this.deps.logger.info('Manuelle Notiz angelegt.');
    return { ok: true, pfad: created.value.relPfad, id: created.value.meta.id };
  }

  /** Soft-Delete: verschiebt ein Diktat in den Papierkorb, blendet es im Index aus. */
  async softDeleteDictate(relPfad: string): Promise<ActionResult> {
    const active = await this.requireActiveDir();
    if (!active.ok) {
      return active;
    }
    const doc = await readTranscript(active.dir, relPfad);
    if (!doc.ok) {
      return { ok: false, message: doc.error };
    }
    const moved = await softDeleteTranscript(active.dir, relPfad);
    if (!moved.ok) {
      return { ok: false, message: moved.error };
    }
    await removeManifestEntry(active.dir, doc.value.meta.id);
    this.deps.logger.info('Diktat in den Papierkorb verschoben.');
    return { ok: true };
  }

  /** Papierkorb-Liste der aktiven Firma. */
  async listTrash(): Promise<TrashListResult> {
    const active = await this.requireActiveDir();
    if (!active.ok) {
      return active;
    }
    const docs = await listPapierkorb(active.dir);
    if (!docs.ok) {
      return { ok: false, message: docs.error };
    }
    return {
      ok: true,
      eintraege: docs.value.map((doc) => buildManifestEntry(doc.meta, doc.relPfad, doc.body)),
    };
  }

  /** Stellt ein Diktat aus dem Papierkorb wieder her und aktualisiert den Index. */
  async restoreDictate(papierkorbRelPfad: string): Promise<ActionResult> {
    const active = await this.requireActiveDir();
    if (!active.ok) {
      return active;
    }
    const restored = await restoreTranscript(active.dir, papierkorbRelPfad);
    if (!restored.ok) {
      return { ok: false, message: restored.error };
    }
    const doc = await readTranscript(active.dir, restored.value.relPfad);
    if (doc.ok) {
      await upsertManifestEntry(
        active.dir,
        buildManifestEntry(doc.value.meta, doc.value.relPfad, doc.value.body),
      );
    }
    this.deps.logger.info('Diktat aus dem Papierkorb wiederhergestellt.');
    return { ok: true };
  }

  /** Endgueltiges Loeschen aus dem Papierkorb (unwiderruflich). */
  async hardDeleteDictate(papierkorbRelPfad: string): Promise<ActionResult> {
    const active = await this.requireActiveDir();
    if (!active.ok) {
      return active;
    }
    const removed = await hardDeleteTranscript(active.dir, papierkorbRelPfad);
    if (!removed.ok) {
      return { ok: false, message: removed.error };
    }
    this.deps.logger.info('Diktat endgültig gelöscht.');
    return { ok: true };
  }

  /** Exportiert ein Diktat als Markdown/TXT/PDF nach `Exporte/`. */
  async exportDictate(input: ExportInput): Promise<ExportResult> {
    const active = await this.requireActiveDir();
    if (!active.ok) {
      return active;
    }
    const result =
      input.format === 'pdf'
        ? await exportTranscriptPdf(active.dir, input.pfad)
        : await exportTranscript(active.dir, input.pfad, input.format, input.mitFrontMatter);
    if (!result.ok) {
      return { ok: false, message: result.error };
    }
    this.deps.logger.info('Diktat exportiert.', { format: input.format });
    return { ok: true, anzeigePfad: result.value.absPfad, relPfad: result.value.relPfad };
  }

  /**
   * Stapel-Export (M8): mehrere Diktate als Markdown/TXT/PDF. Bei mehr als
   * einer Datei entsteht ein Unterordner `Exporte/<datum>-stapel/` (atomar);
   * ein einzelner PDF-Renderer wird fuer alle Dateien wiederverwendet.
   */
  async exportDictatesBatch(
    input: BatchExportInput,
    onProgress?: (fertig: number, gesamt: number) => void,
  ): Promise<BatchExportResult> {
    const active = await this.requireActiveDir();
    if (!active.ok) {
      return active;
    }
    // Halter-Objekt statt let-Variable: die Zuweisung passiert in einer
    // Closure, was die TS-Kontrollflussanalyse sonst als "bleibt null" liest.
    const pdf: { renderer: PdfRenderer | null } = { renderer: null };
    const renderPdf: NonNullable<BatchExportDeps['renderPdf']> = async (meta, body, tmpDir) => {
      pdf.renderer ??= new PdfRenderer();
      return pdf.renderer.render(buildPrintHtml(meta, body), tmpDir);
    };
    const deps: BatchExportDeps = {
      ...(onProgress === undefined ? {} : { onProgress }),
      ...(input.format === 'pdf' ? { renderPdf } : {}),
    };
    try {
      const result = await exportTranscriptsBatch(
        active.dir,
        input.pfade,
        input.format,
        input.mitFrontMatter,
        deps,
      );
      if (!result.ok) {
        return { ok: false, message: result.error };
      }
      this.deps.logger.info('Stapel-Export ausgefuehrt.', {
        format: input.format,
        exportiert: result.value.exportiert,
        fehler: result.value.fehler.length,
      });
      return {
        ok: true,
        anzeigePfad: result.value.absPfad,
        relPfad: result.value.relPfad,
        exportiert: result.value.exportiert,
        fehler: [...result.value.fehler],
      };
    } finally {
      pdf.renderer?.dispose();
    }
  }

  /** Tag-Batch-Rename (M8): wirkt firmenweit inklusive Papierkorb. */
  async renameTag(input: TagRenameInput): Promise<TagRenameResult> {
    const active = await this.requireActiveDir();
    if (!active.ok) {
      return active;
    }
    const result = await renameTagEverywhere(active.dir, input.alt, input.neu, this.deps.logger);
    if (!result.ok) {
      return { ok: false, message: result.error };
    }
    return {
      ok: true,
      geaendert: result.value.geaendert,
      papierkorbGeaendert: result.value.papierkorbGeaendert,
      fehler: [...result.value.fehler],
    };
  }

  /**
   * Verschluesselter Einzel-Export (M8, R16): Markdown mit Front-Matter,
   * AES-256-GCM als .vwenc nach `Exporte/`. Das Passwort wird weder
   * gespeichert noch geloggt.
   */
  async exportDictateEncrypted(input: EncryptedExportInput): Promise<ExportResult> {
    const active = await this.requireActiveDir();
    if (!active.ok) {
      return active;
    }
    const source = await readTranscript(active.dir, input.pfad);
    if (!source.ok) {
      return { ok: false, message: source.error };
    }
    const content = buildExportContent(source.value.meta, source.value.body, 'md', true);
    const container = encryptToVwenc(Buffer.from(content, 'utf8'), input.passwort);
    const written = await writeExportFile(
      active.dir,
      `${exportBaseName(input.pfad)}.md`,
      VWENC_EXTENSION,
      container,
    );
    if (!written.ok) {
      return { ok: false, message: written.error };
    }
    this.deps.logger.info('Diktat verschluesselt exportiert (.vwenc).');
    return { ok: true, anzeigePfad: written.value.absPfad, relPfad: written.value.relPfad };
  }

  /**
   * Entschluesselt eine .vwenc-Datei (M8): die Datei waehlt der Nutzer im
   * nativen Datei-Dialog des Main-Prozesses (nie ein roher Renderer-Pfad).
   * Das Ergebnis wird atomar NEBEN die Quelldatei geschrieben, nie
   * ueberschrieben.
   */
  async decryptVwencFile(passwort: string): Promise<DecryptFileResult> {
    const chosen = await dialog.showOpenDialog({
      title: texte().vwenc.dialogTitel,
      buttonLabel: texte().vwenc.dialogKnopf,
      filters: [{ name: texte().vwenc.dialogFilter, extensions: ['vwenc'] }],
      properties: ['openFile'],
    });
    const sourcePath = chosen.filePaths[0];
    if (chosen.canceled || sourcePath === undefined) {
      return { ok: false, message: texte().vwenc.keineDatei };
    }
    try {
      const info = await stat(sourcePath);
      if (info.size > 64 * 1024 * 1024) {
        return { ok: false, message: texte().vwenc.zuGross };
      }
    } catch {
      return { ok: false, message: texte().vwenc.nichtLesbar };
    }
    let container: Buffer;
    try {
      container = await readFile(sourcePath);
    } catch {
      return { ok: false, message: texte().vwenc.nichtLesbar };
    }
    const plain = decryptFromVwenc(container, passwort);
    if (!plain.ok) {
      return { ok: false, message: plain.error };
    }
    // Zielname: `.vwenc` abschneiden; Kollisionen loest ein Zufalls-Suffix.
    const dir = dirname(sourcePath);
    const name = basename(sourcePath);
    const stem = name.endsWith(VWENC_EXTENSION)
      ? name.slice(0, -VWENC_EXTENSION.length)
      : `${name}.entschluesselt`;
    const candidates = [stem, `${stem}_${randomBytes(3).toString('hex')}`];
    for (const candidate of candidates) {
      const target = join(dir, candidate);
      try {
        await stat(target);
        continue; // Ziel existiert: naechster Kandidat, nie ueberschreiben.
      } catch {
        // Ziel frei.
      }
      try {
        await writeFileAtomic(target, plain.value);
      } catch (error) {
        return {
          ok: false,
          message: texte().vwenc.schreibFehler(
            error instanceof Error ? error.message : String(error),
          ),
        };
      }
      this.deps.logger.info('.vwenc-Datei entschluesselt.');
      return { ok: true, zielPfad: target };
    }
    return { ok: false, message: texte().vwenc.namenskollision };
  }

  /**
   * Zeigt eine Exportdatei im Datei-Manager (Finder/Explorer). Der relative
   * Pfad wird im Main-Prozess erneut gegen `Exporte/` aufgeloest und auf
   * Containment geprueft (ein statischer, gepruefter Pfad; nie roh vom
   * Renderer verwendet).
   */
  async revealExport(relPfad: string): Promise<ActionResult> {
    const active = await this.requireActiveDir();
    if (!active.ok) {
      return active;
    }
    const normalized = relPfad.normalize('NFC');
    if (normalized !== EXPORTE_DIR && !normalized.startsWith(`${EXPORTE_DIR}/`)) {
      return { ok: false, message: texte().export.exportpfadUngueltig };
    }
    const resolved = resolveInsideDir(active.dir, normalized);
    if (!resolved.ok) {
      return { ok: false, message: resolved.error };
    }
    shell.showItemInFolder(resolved.value);
    return { ok: true };
  }

  /** Bekannte Tags der aktiven Firma (Autocomplete/Filter). */
  async listTags(): Promise<readonly string[]> {
    const companyDir = await this.activeCompanyDir();
    if (companyDir === null) {
      return [];
    }
    return readKnownTags(companyDir);
  }

  // ------------------------------------------------------------------
  // Fach-Woerterbuch (Stufe 1, ABARBEITUNG 2.7): vokabular.json der
  // aktiven Firma. Lesen/Schreiben laeuft ausschliesslich ueber die
  // .voicewall-Pfadlogik (vokabular-store.ts), nie ueber rohe Pfade.
  // ------------------------------------------------------------------

  /** Vokabular der aktiven Firma (fuer den Editor in der Diktat-Ansicht). */
  async getVokabular(): Promise<VokabularGetResult> {
    const active = await this.requireActiveDir();
    if (!active.ok) {
      return active;
    }
    const result = await readVokabular(active.dir);
    if (!result.ok) {
      return { ok: false, message: result.error };
    }
    return { ok: true, vokabular: result.value };
  }

  /** Speichert das Vokabular der aktiven Firma (zod-validiert, atomar). */
  async saveVokabular(input: {
    begriffe: readonly string[];
    ersetzungen: readonly Ersetzung[];
  }): Promise<ActionResult> {
    const active = await this.requireActiveDir();
    if (!active.ok) {
      return active;
    }
    const vokabular: Vokabular = {
      schemaVersion: VOKABULAR_SCHEMA_VERSION,
      begriffe: [...input.begriffe],
      ersetzungen: input.ersetzungen.map((regel) => ({ von: regel.von, zu: regel.zu })),
    };
    const written = await writeVokabular(active.dir, vokabular);
    if (!written.ok) {
      return { ok: false, message: written.error };
    }
    this.deps.logger.info('Fach-Wörterbuch gespeichert.', {
      begriffe: vokabular.begriffe.length,
      ersetzungen: vokabular.ersetzungen.length,
    });
    return { ok: true };
  }

  /**
   * Vokabular der aktiven Firma fuer den Diktatfluss: Fehler (kaputte Datei)
   * werden geloggt und auf das leere Vokabular abgebildet, damit ein Diktat
   * nie an einer defekten vokabular.json scheitert.
   */
  private async activeVokabularLenient(): Promise<Vokabular> {
    const companyDir = await this.activeCompanyDir();
    if (companyDir === null) {
      return defaultVokabular();
    }
    const result = await readVokabular(companyDir);
    if (!result.ok) {
      this.deps.logger.warn(`Fach-Wörterbuch nicht nutzbar, Diktat läuft ohne: ${result.error}`);
      return defaultVokabular();
    }
    return result.value;
  }

  /**
   * Initial-Prompt fuer Whisper aus den Begriffen der aktiven Firma
   * (Stufe 1, Teil A2). Eine Kappung wird geloggt (NUR Anzahlen, nie
   * Inhalte); ohne Begriffe oder ohne aktive Firma: null.
   */
  async activePrompt(): Promise<string | null> {
    const vokabular = await this.activeVokabularLenient();
    const built = buildInitialPrompt(vokabular.begriffe);
    if (built.gekappt) {
      this.deps.logger.warn('Initial-Prompt gekappt (Whisper-Prompt-Limit).', {
        begriffeGesamt: vokabular.begriffe.length,
        begriffeVerwendet: built.verwendeteBegriffe,
      });
    }
    return built.prompt;
  }

  /** Ersetzungsliste der aktiven Firma (Stufe 1, Teil A3). */
  async activeErsetzungen(): Promise<readonly Ersetzung[]> {
    return (await this.activeVokabularLenient()).ersetzungen;
  }

  /** Beleg-Informationen (Modelle, Pruefsummen, Konsent, Log-Pfad). */
  async belegInfo(): Promise<BelegInfoResult> {
    const config = await this.loadConfig();
    const beleg = await collectBelegInfo({
      userDataPath: this.deps.userDataPath,
      appVersion: this.deps.appVersion,
      platform: process.platform,
      modelChoice: config.modell,
      dictationLanguage: await this.activeSprache(),
    });
    return { ok: true, beleg };
  }

  /**
   * Registriert die IPC-Handler der Firmenverwaltung. Jeder Handler
   * validiert seine Eingabe mit zod und antwortet mit typisierten Results;
   * unerwartete Fehler werden lokal geloggt und generisch gemeldet.
   */
  register(): void {
    const guard = async <T>(fallback: T, action: () => Promise<T>): Promise<T> => {
      try {
        return await action();
      } catch (error) {
        this.deps.logger.error(
          `Unerwarteter Fehler in einem Firmen-IPC-Handler: ${error instanceof Error ? error.message : String(error)}`,
        );
        return fallback;
      }
    };

    ipcMain.handle(IpcChannel.CompanyList, () =>
      guard<CompanyListView>({ firmen: [], aktiveFirma: null, autoSpeichern: false }, () =>
        this.listCompanies(),
      ),
    );

    ipcMain.handle(IpcChannel.CompanyPreviewName, (_event, raw: unknown): CompanyNamePreview => {
      const parsed = z.string().min(1).max(300).safeParse(raw);
      if (!parsed.success) {
        return { ok: false, message: texte().firmen.eingabeFirmenname };
      }
      return this.previewName(parsed.data);
    });

    ipcMain.handle(IpcChannel.CompanyCreate, (_event, raw: unknown) => {
      const parsed = z
        .object({
          name: z.string().min(1).max(300),
          strategie: companyStorageStrategySchema,
          details: companyDetailsSchema.optional(),
          modell: z.enum(['q5_0', 'fp16']).optional(),
          ordnername: z.string().max(300).optional(),
          sprache: dictationLanguageSchema.optional(),
        })
        .safeParse(raw);
      if (!parsed.success) {
        return Promise.resolve<CreateCompanyResult>({
          ok: false,
          message: texte().firmen.eingabeFirmenAnlage,
          vorschlag: null,
        });
      }
      return guard<CreateCompanyResult>(
        { ok: false, message: texte().generisch.internerFehler, vorschlag: null },
        () =>
          this.createCompany(
            parsed.data.name,
            parsed.data.strategie,
            parsed.data.details,
            parsed.data.modell,
            parsed.data.ordnername,
            parsed.data.sprache,
          ),
      );
    });

    // Paket B1: Diktatsprache der aktiven Firma nachtraeglich wechseln.
    ipcMain.handle(IpcChannel.CompanySetLanguage, (_event, raw: unknown) => {
      const parsed = dictationLanguageSchema.safeParse(raw);
      if (!parsed.success) {
        return Promise.resolve<ActionResult>({
          ok: false,
          message: texte().stt.ungueltigeDiktatsprache,
        });
      }
      return guard<ActionResult>({ ok: false, message: texte().generisch.internerFehler }, () =>
        this.setCompanyLanguage(parsed.data),
      );
    });

    ipcMain.handle(IpcChannel.CompanySetActive, (_event, raw: unknown) => {
      const parsed = z.string().min(1).max(2048).safeParse(raw);
      if (!parsed.success) {
        return Promise.resolve({
          ok: false as const,
          message: texte().firmen.ungueltigerFirmenpfad,
        });
      }
      return guard<{ ok: true } | { ok: false; message: string }>(
        { ok: false, message: texte().generisch.internerFehler },
        () => this.setActiveCompany(parsed.data),
      );
    });

    ipcMain.handle(IpcChannel.CompanyCheckSync, () =>
      guard<SyncCheckView>({ synchronisiert: false, anbieter: null, hinweis: null }, () =>
        this.checkDesktopSync(),
      ),
    );

    ipcMain.handle(IpcChannel.DictateList, (_event, raw: unknown) => {
      const parsed = dictateSearchFilterSchema.safeParse(raw ?? {});
      if (!parsed.success) {
        return Promise.resolve<DictateListResult>({
          ok: false,
          message: texte().diktate.suchfilterUngueltig,
        });
      }
      return guard<DictateListResult>(
        { ok: false, message: texte().generisch.internerFehler },
        () => this.listDictates(parsed.data),
      );
    });

    ipcMain.handle(IpcChannel.SetDictateAutoSave, (_event, raw: unknown) => {
      const parsed = z.boolean().safeParse(raw);
      if (!parsed.success) {
        return Promise.resolve({
          ok: false as const,
          message: texte().firmen.eingabeAutoSpeichern,
        });
      }
      return guard<{ ok: true } | { ok: false; message: string }>(
        { ok: false, message: texte().generisch.internerFehler },
        async () => {
          await this.setAutoSave(parsed.data);
          return { ok: true as const };
        },
      );
    });

    // Katalog-Meldungen an der IPC-Grenze: bewusst FUNKTIONEN (nicht beim
    // Registrieren eingefroren), damit ein Sprachwechsel sofort wirkt.
    const internalError = (): string => texte().generisch.internerFehler;
    const relPathHandler = <T>(
      channel: string,
      badInput: () => T,
      internal: () => T,
      action: (relPfad: string) => Promise<T>,
    ): void => {
      ipcMain.handle(channel, (_event, raw: unknown) => {
        const parsed = safeRelativePathSchema.safeParse(raw);
        if (!parsed.success) {
          return Promise.resolve(badInput());
        }
        return guard<T>(internal(), () => action(parsed.data));
      });
    };

    const actionBadInput = (): ActionResult => ({
      ok: false,
      message: texte().diktate.eingabeUngueltig,
    });
    const actionInternal = (): ActionResult => ({ ok: false, message: internalError() });

    ipcMain.handle(IpcChannel.DictateGet, (_event, raw: unknown) => {
      const parsed = safeRelativePathSchema.safeParse(raw);
      if (!parsed.success) {
        return Promise.resolve<DictateDetailResult>({
          ok: false,
          message: texte().diktate.pfadUngueltig,
        });
      }
      return guard<DictateDetailResult>({ ok: false, message: internalError() }, () =>
        this.getDictate(parsed.data),
      );
    });

    ipcMain.handle(IpcChannel.DictateUpdate, (_event, raw: unknown) => {
      const parsed = dictateUpdateInputSchema.safeParse(raw);
      if (!parsed.success) {
        return Promise.resolve<DictateMutationResult>({
          ok: false,
          message: texte().diktate.eingabeBearbeitung,
        });
      }
      return guard<DictateMutationResult>({ ok: false, message: internalError() }, () =>
        this.updateDictate(parsed.data),
      );
    });

    ipcMain.handle(IpcChannel.DictateCreateManual, (_event, raw: unknown) => {
      const parsed = manualNoteInputSchema.safeParse(raw);
      if (!parsed.success) {
        return Promise.resolve<SaveDictateResult>({
          ok: false,
          message: texte().diktate.eingabeNotiz,
        });
      }
      return guard<SaveDictateResult>({ ok: false, message: internalError() }, () =>
        this.createManualNote(parsed.data),
      );
    });

    relPathHandler<ActionResult>(
      IpcChannel.DictateSoftDelete,
      actionBadInput,
      actionInternal,
      (relPfad) => this.softDeleteDictate(relPfad),
    );
    relPathHandler<ActionResult>(
      IpcChannel.DictateRestore,
      actionBadInput,
      actionInternal,
      (relPfad) => this.restoreDictate(relPfad),
    );
    relPathHandler<ActionResult>(
      IpcChannel.DictateHardDelete,
      actionBadInput,
      actionInternal,
      (relPfad) => this.hardDeleteDictate(relPfad),
    );
    relPathHandler<ActionResult>(
      IpcChannel.DictateRevealExport,
      actionBadInput,
      actionInternal,
      (relPfad) => this.revealExport(relPfad),
    );

    ipcMain.handle(IpcChannel.DictateExport, (_event, raw: unknown) => {
      const parsed = exportInputSchema.safeParse(raw);
      if (!parsed.success) {
        return Promise.resolve<ExportResult>({
          ok: false,
          message: texte().export.eingabe,
        });
      }
      return guard<ExportResult>({ ok: false, message: internalError() }, () =>
        this.exportDictate(parsed.data),
      );
    });

    ipcMain.handle(IpcChannel.DictateExportBatch, (event, raw: unknown) => {
      const parsed = batchExportInputSchema.safeParse(raw);
      if (!parsed.success) {
        return Promise.resolve<BatchExportResult>({
          ok: false,
          message: texte().export.eingabeStapel,
        });
      }
      return guard<BatchExportResult>({ ok: false, message: internalError() }, () =>
        this.exportDictatesBatch(parsed.data, (fertig, gesamt) => {
          // Fortschritt an den auslösenden Renderer (aria-live-Anzeige).
          if (!event.sender.isDestroyed()) {
            const progress: ExportProgress = { fertig, gesamt };
            event.sender.send(IpcChannel.DictateExportProgress, progress);
          }
        }),
      );
    });

    ipcMain.handle(IpcChannel.DictateRenameTag, (_event, raw: unknown) => {
      const parsed = tagRenameInputSchema.safeParse(raw);
      if (!parsed.success) {
        return Promise.resolve<TagRenameResult>({
          ok: false,
          message: texte().tagRename.eingabe,
        });
      }
      return guard<TagRenameResult>({ ok: false, message: internalError() }, () =>
        this.renameTag(parsed.data),
      );
    });

    ipcMain.handle(IpcChannel.DictateExportEncrypted, (_event, raw: unknown) => {
      const parsed = encryptedExportInputSchema.safeParse(raw);
      if (!parsed.success) {
        return Promise.resolve<ExportResult>({
          ok: false,
          message: texte().vwenc.eingabeVerschluesselt,
        });
      }
      return guard<ExportResult>({ ok: false, message: internalError() }, () =>
        this.exportDictateEncrypted(parsed.data),
      );
    });

    ipcMain.handle(IpcChannel.DictateDecryptVwenc, (_event, raw: unknown) => {
      const parsed = decryptFileInputSchema.safeParse(raw);
      if (!parsed.success) {
        return Promise.resolve<DecryptFileResult>({
          ok: false,
          message: texte().vwenc.eingabeEntschluesseln,
        });
      }
      return guard<DecryptFileResult>({ ok: false, message: internalError() }, () =>
        this.decryptVwencFile(parsed.data.passwort),
      );
    });

    ipcMain.handle(IpcChannel.DictateTrashList, () =>
      guard<TrashListResult>({ ok: false, message: internalError() }, () => this.listTrash()),
    );

    ipcMain.handle(IpcChannel.DictateTagsList, () =>
      guard<readonly string[]>([], () => this.listTags()),
    );

    ipcMain.handle(IpcChannel.BelegInfo, () =>
      guard<BelegInfoResult>({ ok: false, message: internalError() }, () => this.belegInfo()),
    );

    // Fach-Woerterbuch (Stufe 1): vokabular.json der aktiven Firma.
    ipcMain.handle(IpcChannel.VocabGet, () =>
      guard<VokabularGetResult>({ ok: false, message: internalError() }, () => this.getVokabular()),
    );

    ipcMain.handle(IpcChannel.VocabSave, (_event, raw: unknown) => {
      const parsed = vokabularSaveInputSchema.safeParse(raw);
      if (!parsed.success) {
        return Promise.resolve<ActionResult>({
          ok: false,
          message: texte().woerterbuch.eingabe,
        });
      }
      return guard<ActionResult>({ ok: false, message: internalError() }, () =>
        this.saveVokabular(parsed.data),
      );
    });
  }
}
