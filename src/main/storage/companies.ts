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
import { mkdir, readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { ipcMain } from 'electron';
import { z } from 'zod';
import {
  companyConfigSchema,
  companyStorageStrategySchema,
  dictateSearchFilterSchema,
  type CompanyInfo,
  type CompanyListView,
  type CompanyNamePreview,
  type CompanyStorageStrategy,
  type CreateCompanyResult,
  type DictateListResult,
  type DictateSearchFilter,
  type SaveDictateResult,
  type SyncCheckView,
  type TranscriptQuelle,
} from '../../shared/company';
import type { GlobalConfig } from '../../shared/config';
import { readGlobalConfig, writeGlobalConfig } from '../config/config-store';
import { IpcChannel } from '../ipc/channels';
import type { Logger } from '../log/logger';
import { migrateCompanyFolder } from './migration';
import {
  CONFIG_FILE,
  VOICEWALL_DIR,
  createCompanyFolder,
  isVoiceWallFolder,
} from './company-folder';
import { isDirectChildOf } from './containment';
import {
  addKnownTags,
  buildManifestEntry,
  readManifestWithHealing,
  searchManifest,
  upsertManifestEntry,
} from './manifest';
import { sanitizeCompanyName } from './sanitize';
import {
  checkSyncExposure,
  createDesktopLink,
  localStorageBaseDir,
  type SyncCheckResult,
} from './sync-detection';
import { createTranscript, readTranscript } from './transcripts';

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

/** Leitet einen Titel aus den ersten Worten des Textes ab (max. 60 Zeichen). */
export function titleFromText(text: string): string {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return 'Diktat';
  }
  let title = '';
  for (const word of words) {
    const candidate = title.length === 0 ? word : `${title} ${word}`;
    if (Array.from(candidate).length > 60) {
      break;
    }
    title = candidate;
  }
  return title.length === 0 ? 'Diktat' : title;
}

export class CompanyManager {
  private config: GlobalConfig | null = null;

  constructor(private readonly deps: CompanyManagerDeps) {}

  /** Laedt die globale Konfiguration (einmalig, weitere Zugriffe gecacht). */
  private async loadConfig(): Promise<GlobalConfig> {
    this.config ??= await readGlobalConfig(this.deps.userDataPath, this.deps.logger);
    return this.config;
  }

  private async persistConfig(next: GlobalConfig): Promise<void> {
    this.config = next;
    await writeGlobalConfig(this.deps.userDataPath, next);
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

  /** Liest den Anzeigenamen aus der firmenbezogenen Konfig (Fallback: Ordnername). */
  private async readCompanyDisplayName(pfad: string, ordnername: string): Promise<string> {
    try {
      const raw = await readFile(join(pfad, VOICEWALL_DIR, CONFIG_FILE), 'utf8');
      const parsed = companyConfigSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        return parsed.data.firma.anzeigename;
      }
    } catch {
      // Konfig fehlt/kaputt: Ordnername als Anzeige.
    }
    return ordnername;
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
      firmen.push({
        pfad,
        ordnername,
        anzeigename: await this.readCompanyDisplayName(pfad, ordnername),
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
    const config = await this.loadConfig();
    await this.persistConfig({ ...config, diktatAutoSpeichern: enabled });
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
  ): Promise<CreateCompanyResult> {
    let baseDir: string;
    let syncWarnung: string | null = null;
    let verknuepfungHinweis: string | null = null;
    const desktop = await this.deps.resolveDesktop();

    if (strategie === 'desktop') {
      if (desktop === null) {
        return {
          ok: false,
          message:
            'Der Desktop-Ordner wurde nicht gefunden. Bitte die Strategie "lokal-mit-verknuepfung" verwenden.',
          vorschlag: null,
        };
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
          message: `Der lokale VoiceWall-Ordner konnte nicht angelegt werden: ${error instanceof Error ? error.message : String(error)}`,
          vorschlag: null,
        };
      }
      baseDir = this.localBase();
    }

    const created = await createCompanyFolder(baseDir, rawName, {
      erstelltMit: this.deps.appVersion,
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
        ? `Auf dem Desktop liegt eine Verknuepfung "${created.value.ordnername}"; die Diktate selbst bleiben im lokalen Ordner ${created.value.dirPath}.`
        : `Hinweis: ${link.error}`;
    }

    // Globale Konfig ergaenzen (dedupliziert) und Firma aktivieren.
    const config = await this.loadConfig();
    const pfad = created.value.dirPath.normalize('NFC');
    const firmen = config.firmen.map((entry) => entry.normalize('NFC')).includes(pfad)
      ? config.firmen
      : [...config.firmen, pfad];
    await this.persistConfig({ ...config, firmen, aktiveFirma: pfad });

    this.deps.logger.info('Firma angelegt bzw. uebernommen und aktiviert.', {
      outcome: created.value.uebernommen ? 'uebernommen' : 'neu',
    });
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
      return {
        ok: false,
        message:
          'Diese Firma ist nicht in der Liste der gueltigen Firmenordner. Bitte die Firma zuerst anlegen oder oeffnen.',
      };
    }
    const config = await this.loadConfig();
    await this.persistConfig({ ...config, aktiveFirma: normalized });
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
      return {
        ok: false,
        message:
          'Dieser Ordner ist kein gueltiger VoiceWall-Firmenordner an einem erlaubten Ort (Desktop oder ~/VoiceWall).',
      };
    }
    const migration = await migrateCompanyFolder(normalized);
    if (!migration.ok) {
      return { ok: false, message: migration.error };
    }
    const manifest = await readManifestWithHealing(normalized, this.deps.logger);
    if (!manifest.ok) {
      return { ok: false, message: manifest.error };
    }
    const config = await this.loadConfig();
    const firmen = config.firmen.map((entry) => entry.normalize('NFC')).includes(normalized)
      ? config.firmen
      : [...config.firmen, normalized];
    await this.persistConfig({ ...config, firmen, aktiveFirma: normalized });
    return { ok: true };
  }

  /** Speichert einen Text als Diktat in der aktiven Firma. */
  async saveDictate(input: SaveDictateInput): Promise<SaveDictateResult> {
    const companyDir = await this.activeCompanyDir();
    if (companyDir === null) {
      return {
        ok: false,
        message: 'Keine aktive Firma. Bitte zuerst eine Firma anlegen oder aktivieren.',
      };
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

  /** Liste/Schnellsuche der Diktate der aktiven Firma (Manifest-basiert). */
  async listDictates(filter: DictateSearchFilter): Promise<DictateListResult> {
    const companyDir = await this.activeCompanyDir();
    if (companyDir === null) {
      return {
        ok: false,
        message: 'Keine aktive Firma. Bitte zuerst eine Firma anlegen oder aktivieren.',
      };
    }
    const manifest = await readManifestWithHealing(companyDir, this.deps.logger);
    if (!manifest.ok) {
      return { ok: false, message: manifest.error };
    }
    return { ok: true, eintraege: searchManifest(manifest.value.eintraege, filter) };
  }

  /** Liest ein Diktat der aktiven Firma (Containment-gesichert). */
  async readDictate(
    relPfad: string,
  ): Promise<{ ok: true; body: string } | { ok: false; message: string }> {
    const companyDir = await this.activeCompanyDir();
    if (companyDir === null) {
      return { ok: false, message: 'Keine aktive Firma.' };
    }
    const result = await readTranscript(companyDir, relPfad);
    return result.ok ? { ok: true, body: result.value.body } : { ok: false, message: result.error };
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
        return { ok: false, message: 'Ungueltige Eingabe fuer den Firmennamen.' };
      }
      return this.previewName(parsed.data);
    });

    ipcMain.handle(IpcChannel.CompanyCreate, (_event, raw: unknown) => {
      const parsed = z
        .object({
          name: z.string().min(1).max(300),
          strategie: companyStorageStrategySchema,
        })
        .safeParse(raw);
      if (!parsed.success) {
        return Promise.resolve<CreateCompanyResult>({
          ok: false,
          message: 'Ungueltige Eingabe fuer die Firmen-Anlage.',
          vorschlag: null,
        });
      }
      return guard<CreateCompanyResult>(
        {
          ok: false,
          message: 'Unerwarteter interner Fehler. Details stehen im lokalen Log unter userData.',
          vorschlag: null,
        },
        () => this.createCompany(parsed.data.name, parsed.data.strategie),
      );
    });

    ipcMain.handle(IpcChannel.CompanySetActive, (_event, raw: unknown) => {
      const parsed = z.string().min(1).max(2048).safeParse(raw);
      if (!parsed.success) {
        return Promise.resolve({ ok: false as const, message: 'Ungueltiger Firmenpfad.' });
      }
      return guard<{ ok: true } | { ok: false; message: string }>(
        {
          ok: false,
          message: 'Unerwarteter interner Fehler. Details stehen im lokalen Log unter userData.',
        },
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
          message: 'Ungueltiger Suchfilter.',
        });
      }
      return guard<DictateListResult>(
        {
          ok: false,
          message: 'Unerwarteter interner Fehler. Details stehen im lokalen Log unter userData.',
        },
        () => this.listDictates(parsed.data),
      );
    });

    ipcMain.handle(IpcChannel.SetDictateAutoSave, (_event, raw: unknown) => {
      const parsed = z.boolean().safeParse(raw);
      if (!parsed.success) {
        return Promise.resolve({
          ok: false as const,
          message: 'Ungueltige Eingabe fuer den Auto-Speichern-Schalter.',
        });
      }
      return guard<{ ok: true } | { ok: false; message: string }>(
        {
          ok: false,
          message: 'Unerwarteter interner Fehler. Details stehen im lokalen Log unter userData.',
        },
        async () => {
          await this.setAutoSave(parsed.data);
          return { ok: true as const };
        },
      );
    });
  }
}
