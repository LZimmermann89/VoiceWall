/**
 * Zod-Schemas und Typen des Ordner-als-Datenbank-Modells:
 * Transkript-Metadaten (Front-Matter), Manifest, firmenbezogene
 * Konfiguration, tags.json sowie die IPC-Sichten der Firmenverwaltung.
 *
 * Alle Daten aus Dateien sind fremder Input (koennen von Hand editiert oder
 * manipuliert worden sein) und werden an der Vertrauensgrenze mit diesen
 * Schemas geparst. Pfade aus dem Manifest sind zusaetzlich auf sichere
 * relative Pfade beschraenkt; die endgueltige Containment-Pruefung nach
 * `path.resolve` macht der Main-Prozess (storage/containment.ts).
 *
 * Dieses Modul bleibt plattformneutral (nur zod, kein Node/Electron/DOM).
 */
import { z } from 'zod';
import { dictationLanguageSchema } from './schema';

/** Aktuelle Schema-Version des Firmenordners (.voicewall/.schema-version). */
export const COMPANY_SCHEMA_VERSION = 1;

/** ISO 8601 mit Zeitzone (Z oder +HH:MM). */
export const isoDateTimeSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
    'Zeitstempel muss ISO 8601 mit Zeitzone sein (z. B. 2026-07-02T14:32:10+02:00).',
  );

/** Quelle eines Eintrags: Diktat, Import oder manuelle Notiz. */
export const transcriptQuelleSchema = z.enum(['diktat', 'import', 'manuell']);
export type TranscriptQuelle = z.infer<typeof transcriptQuelleSchema>;

/** Ein einzelner Tag (kurz, keine Steuerzeichen). */
export const tagSchema = z
  .string()
  .min(1)
  .max(80)
  // eslint-disable-next-line no-control-regex
  .regex(/^[^\u0000-\u001F\u007F]+$/, 'Tags dürfen keine Steuerzeichen enthalten.');

/**
 * Sicherer relativer Pfad innerhalb des Firmenordners: keine absoluten
 * Pfade, keine Laufwerksbuchstaben, keine Backslashes, kein `..`-Segment.
 * Dies ist die schnelle strukturelle Pruefung; das Containment nach
 * `path.resolve` folgt zusaetzlich im Main-Prozess.
 */
export function isSafeRelativePath(value: string): boolean {
  if (value.length === 0 || value.length > 1024) {
    return false;
  }
  if (value.startsWith('/') || value.includes('\\') || value.includes(':')) {
    return false;
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(value)) {
    return false;
  }
  const segments = value.split('/');
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

export const safeRelativePathSchema = z
  .string()
  .refine(isSafeRelativePath, 'Ungültiger oder unsicherer relativer Pfad.');

/** Front-Matter-Metadaten eines Diktats (flaches Schema). */
export const transcriptMetaSchema = z.object({
  id: z.string().min(1).max(120),
  titel: z.string().min(1).max(500),
  erstellt: isoDateTimeSchema,
  geaendert: isoDateTimeSchema,
  sprache: z.string().min(2).max(16),
  modell: z.string().min(1).max(200),
  dauer_sekunden: z.number().min(0).max(1_000_000),
  wortzahl: z.number().int().min(0),
  tags: z.array(tagSchema).max(100),
  quelle: transcriptQuelleSchema,
  ziel_app: z.string().min(1).max(200).optional(),
  /**
   * Beleg der Textaufbereitung: tatsaechlich angewandte Ersetzungen
   * im Format '<von> -> <zu> (Nx)'. Nur vorhanden, wenn mindestens eine
   * Regel gegriffen hat; Bestandsdiktate ohne Feld bleiben gueltig.
   */
  ersetzungen: z.array(z.string().min(1).max(200)).max(200).optional(),
  version: z.number().int().min(1),
});
export type TranscriptMeta = z.infer<typeof transcriptMetaSchema>;

/** Ein Manifest-Eintrag (plus `quelle` fuer die Filter). */
export const manifestEntrySchema = z.object({
  id: z.string().min(1).max(120),
  pfad: safeRelativePathSchema,
  titel: z.string().min(1).max(500),
  erstellt: isoDateTimeSchema,
  geaendert: isoDateTimeSchema,
  tags: z.array(tagSchema).max(100),
  wortzahl: z.number().int().min(0),
  vorschau: z.string().max(400),
  quelle: transcriptQuelleSchema,
});
export type ManifestEntry = z.infer<typeof manifestEntrySchema>;

/** Das Manifest (.voicewall/manifest.json): schneller Lese-Index. */
export const manifestSchema = z.object({
  schemaVersion: z.number().int().positive(),
  generiert: isoDateTimeSchema,
  eintraege: z.array(manifestEntrySchema),
});
export type Manifest = z.infer<typeof manifestSchema>;

/** tags.json: bekannte Tags fuer Autocomplete/Filter. */
export const tagsFileSchema = z.object({
  schemaVersion: z.number().int().positive(),
  tags: z.array(tagSchema).max(2000),
});
export type TagsFile = z.infer<typeof tagsFileSchema>;

/** Firmenbezogene Konfiguration (.voicewall/config.json). */
export const companyConfigSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    firma: z
      .object({
        /** Anzeigename: unveraendert, mit echten Umlauten. */
        anzeigename: z.string().min(1).max(200),
        /** Sanitisierter Ordnername (ein Pfadsegment). */
        ordnername: z.string().min(1).max(200),
        ansprechpartner: z.string().max(200).default(''),
        email: z.string().max(200).default(''),
        standort: z.string().max(200).default(''),
        hinweis: z.string().max(2000).default(''),
      })
      .passthrough(),
    /**
     * Diktatsprache der Firma: 'de' (Standard,
     * DE-Finetune-Modell) oder 'en' (multilinguales Originalmodell).
     * Bestehende Konfigs ohne Feld bleiben gueltig (Default 'de'); ein von
     * Hand eingetragener unbekannter Wert faellt kontrolliert auf 'de'
     * zurueck (catch), statt die ganze Firmen-Konfig unlesbar zu machen.
     */
    sprache: dictationLanguageSchema.default('de').catch('de'),
    modell: z.string().min(1).max(100).default('q5_0'),
    erstelltMit: z.string().max(100),
    erstellt: isoDateTimeSchema,
  })
  .passthrough();
export type CompanyConfig = z.infer<typeof companyConfigSchema>;

// ---------------------------------------------------------------------------
// IPC-Sichten der Firmenverwaltung (Preload-Bruecke)
// ---------------------------------------------------------------------------

/** Eine Firma in der Firmenliste. */
export const companyInfoSchema = z.object({
  /** Absoluter Pfad des Firmenordners. */
  pfad: z.string(),
  /** Anzeigename (aus der firmenbezogenen Konfig). */
  anzeigename: z.string(),
  /** Ordnername (sanitisiertes Pfadsegment). */
  ordnername: z.string(),
  /** Diktatsprache der Firma (aus der firmenbezogenen Konfig). */
  sprache: dictationLanguageSchema,
  /** True, wenn dies die aktive Firma ist. */
  aktiv: z.boolean(),
});
export type CompanyInfo = z.infer<typeof companyInfoSchema>;

/** Antwort der Firmenliste. */
export const companyListViewSchema = z.object({
  firmen: z.array(companyInfoSchema),
  aktiveFirma: z.string().nullable(),
  /** Diktate automatisch in der aktiven Firma speichern (effektiver Wert). */
  autoSpeichern: z.boolean(),
});
export type CompanyListView = z.infer<typeof companyListViewSchema>;

/** Vorschau des sanitisierten Ordnernamens (Wizard-Schritt "bestaetigen"). */
export const companyNamePreviewSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), ordnername: z.string() }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type CompanyNamePreview = z.infer<typeof companyNamePreviewSchema>;

/** Ergebnis einer Sync-Pruefung. */
export const syncCheckViewSchema = z.object({
  synchronisiert: z.boolean(),
  anbieter: z.string().nullable(),
  hinweis: z.string().nullable(),
});
export type SyncCheckView = z.infer<typeof syncCheckViewSchema>;

/** Speicherstrategie fuer neue Firmenordner (Sync-Falle). */
export const companyStorageStrategySchema = z.enum(['desktop', 'lokal-mit-verknuepfung']);
export type CompanyStorageStrategy = z.infer<typeof companyStorageStrategySchema>;

/**
 * E-Mail-Pruefung, RFC-lax: genau ein @, kein
 * Leerraum, mindestens ein Punkt in der Domain. Bewusst tolerant, die
 * Adresse dient nur der lokalen Anzeige (kein Versand, kein Netzwerk).
 */
export const EMAIL_LAX_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Optionale Firmendaten des Wizard-Schritts 2. Alle
 * Felder werden im Main-Prozess zusaetzlich NFC-normalisiert und von
 * Steuerzeichen befreit, bevor sie in die firmenbezogene Konfig wandern.
 */
export const companyDetailsSchema = z.object({
  ansprechpartner: z.string().max(120).default(''),
  email: z
    .string()
    .max(200)
    .default('')
    .refine((value) => value.length === 0 || EMAIL_LAX_PATTERN.test(value), {
      message: 'Bitte eine gültige E-Mail-Adresse eingeben (z. B. name@firma.de).',
    }),
  standort: z.string().max(120).default(''),
  hinweis: z.string().max(2000).default(''),
});
export type CompanyDetails = z.infer<typeof companyDetailsSchema>;

/** Ergebnis der Firmen-Anlage. */
export const createCompanyResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    pfad: z.string(),
    ordnername: z.string(),
    /** True: bestehender VoiceWall-Ordner wurde uebernommen (idempotent). */
    uebernommen: z.boolean(),
    /** Deutsche Sync-Warnung, sonst null. */
    syncWarnung: z.string().nullable(),
    /** Hinweis zur angelegten Desktop-Verknuepfung, sonst null. */
    verknuepfungHinweis: z.string().nullable(),
  }),
  z.object({
    ok: z.literal(false),
    message: z.string(),
    /** Alternativer Ordnername bei Kollision mit fremdem Ordner, sonst null. */
    vorschlag: z.string().nullable(),
  }),
]);
export type CreateCompanyResult = z.infer<typeof createCompanyResultSchema>;

/** Suchfilter der Schnellsuche (Manifest-basiert). */
export const dictateSearchFilterSchema = z.object({
  /** Substring ueber Titel, Tags und Vorschau (case-insensitiv). */
  text: z.string().max(200).optional(),
  /** Eintrag muss ALLE genannten Tags tragen. */
  tags: z.array(tagSchema).max(20).optional(),
  /** Zeitraum: erstellt >= von. */
  von: isoDateTimeSchema.optional(),
  /** Zeitraum: erstellt <= bis. */
  bis: isoDateTimeSchema.optional(),
  quelle: transcriptQuelleSchema.optional(),
  /**
   * Zusaetzlich die Markdown-Bodies durchsuchen (Streaming-Scan im
   * Main-Prozess). Der Suchbegriff wird IMMER als Literal behandelt, nie
   * als Regex oder Pfad (ReDoS-/Injektions-Schutz).
   */
  volltext: z.boolean().optional(),
});
export type DictateSearchFilter = z.infer<typeof dictateSearchFilterSchema>;

/** Ein Volltext-Treffer: Eintrag-id plus Kontext-Snippet aus dem Body. */
export const volltextTrefferSchema = z.object({
  id: z.string().min(1).max(120),
  snippet: z.string().max(400),
});
export type VolltextTreffer = z.infer<typeof volltextTrefferSchema>;

/** Ergebnis der Diktat-Liste/-Suche (Snippets nur bei Volltextsuche). */
export const dictateListResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    eintraege: z.array(manifestEntrySchema),
    volltextTreffer: z.array(volltextTrefferSchema).optional(),
  }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type DictateListResult = z.infer<typeof dictateListResultSchema>;

/** Ergebnis des Diktat-Speicherns. */
export const saveDictateResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), pfad: safeRelativePathSchema, id: z.string() }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type SaveDictateResult = z.infer<typeof saveDictateResultSchema>;

// ---------------------------------------------------------------------------
// Verwaltungs-UI: Detailansicht, Bearbeiten, Tags,
// manuelle Notiz, Export, Papierkorb, Beleg-Ansicht.
// ---------------------------------------------------------------------------

/**
 * Vollstaendige Detailansicht eines Diktats: Metadaten plus Body. Der Body
 * wird im Renderer ausschliesslich als Textknoten gerendert (nie als HTML,
 * Stored-XSS-Schutz); kein Markdown-Rendering in v1.
 */
export const dictateDetailSchema = z.object({
  meta: transcriptMetaSchema,
  body: z.string(),
  pfad: safeRelativePathSchema,
});
export type DictateDetail = z.infer<typeof dictateDetailSchema>;

/** Ergebnis des Detail-Abrufs (get). */
export const dictateDetailResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), detail: dictateDetailSchema }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type DictateDetailResult = z.infer<typeof dictateDetailResultSchema>;

/**
 * Aenderungen beim Bearbeiten: Titel, Body und Tags. Alle optional; ein
 * fehlendes Feld bleibt unveraendert. Der Pfad kommt NIE roh vom Renderer,
 * nur die id/der sichere relative Pfad; die Aufloesung macht der Main-Prozess.
 */
export const dictateUpdateInputSchema = z.object({
  pfad: safeRelativePathSchema,
  titel: z.string().min(1).max(500).optional(),
  body: z.string().max(2_000_000).optional(),
  tags: z.array(tagSchema).max(100).optional(),
});
export type DictateUpdateInput = z.infer<typeof dictateUpdateInputSchema>;

/** Ergebnis einer Diktat-Mutation (Bearbeiten): aktualisierter Eintrag. */
export const dictateMutationResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), eintrag: manifestEntrySchema, version: z.number().int() }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type DictateMutationResult = z.infer<typeof dictateMutationResultSchema>;

/** Eingabe einer manuellen Notiz (Quelle `manuell`, ohne Diktat). */
export const manualNoteInputSchema = z.object({
  titel: z.string().min(1).max(500),
  body: z.string().max(2_000_000),
});
export type ManualNoteInput = z.infer<typeof manualNoteInputSchema>;

/** Ein einzelner Papierkorb-Eintrag (gleiche Sicht wie ein Manifest-Eintrag). */
export const trashEntrySchema = manifestEntrySchema;
export type TrashEntry = z.infer<typeof trashEntrySchema>;

/** Ergebnis der Papierkorb-Liste. */
export const trashListResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), eintraege: z.array(trashEntrySchema) }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type TrashListResult = z.infer<typeof trashListResultSchema>;

/** Exportformat pro Eintrag: Markdown, reiner Text oder PDF. */
export const exportFormatSchema = z.enum(['md', 'txt', 'pdf']);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

/** Eingabe eines Exports: Quelle (sicherer relativer Pfad), Format, Optionen. */
export const exportInputSchema = z.object({
  pfad: safeRelativePathSchema,
  format: exportFormatSchema,
  /** Nur fuer Markdown relevant: mit oder ohne YAML-Front-Matter. */
  mitFrontMatter: z.boolean().default(true),
});
export type ExportInput = z.infer<typeof exportInputSchema>;

/**
 * Ergebnis eines Exports. `anzeigePfad` ist der absolute Pfad NUR zur Anzeige;
 * `relPfad` ist der sichere relative Pfad unter `Exporte/`, den der
 * "Im Finder zeigen"-Aufruf erneut im Main-Prozess aufloest und prueft
 * (Pfade kommen nie roh vom Renderer).
 */
export const exportResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    anzeigePfad: z.string(),
    relPfad: safeRelativePathSchema,
  }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type ExportResult = z.infer<typeof exportResultSchema>;

/** Ein einzelnes Modell im Beleg (Version, Pruefsumme, Pfad, Vorhandensein). */
export const belegModellSchema = z.object({
  id: z.string(),
  label: z.string(),
  sha256: z.string(),
  pfad: z.string(),
  vorhanden: z.boolean(),
  aktiv: z.boolean(),
});
export type BelegModell = z.infer<typeof belegModellSchema>;

/**
 * Beleg-Ansicht ("Status/Beleg"): die UI-Seite von "Beleg
 * statt Behauptung". Belegt den lokalen Charakter mit pruefbaren Fakten.
 */
export const belegInfoSchema = z.object({
  appVersion: z.string(),
  plattform: z.string(),
  modelle: z.array(belegModellSchema),
  /** Zeitstempel der Mikrofon-Einwilligung (ISO) oder null. */
  konsentZeitstempel: z.string().nullable(),
  /** Absoluter Pfad des Betriebslogs (nur Anzeige). */
  logPfad: z.string(),
  /** Absoluter Pfad des Modellordners (nur Anzeige). */
  modellOrdner: z.string(),
});
export type BelegInfo = z.infer<typeof belegInfoSchema>;

/** Ergebnis des Beleg-Abrufs. */
export const belegInfoResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), beleg: belegInfoSchema }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type BelegInfoResult = z.infer<typeof belegInfoResultSchema>;

// ---------------------------------------------------------------------------
// Stapel-Export, Tag-Batch-Rename, verschluesselter Export (.vwenc).
// ---------------------------------------------------------------------------

/**
 * Eingabe eines Stapel-Exports: mehrere sichere relative Quellpfade, ein
 * Format. Bei mehr als einer Datei entsteht ein Unterordner
 * `Exporte/<datum>-stapel/` (atomar: Temp-Ordner plus Rename).
 */
export const batchExportInputSchema = z.object({
  pfade: z.array(safeRelativePathSchema).min(1).max(500),
  format: exportFormatSchema,
  /** Nur fuer Markdown relevant: mit oder ohne YAML-Front-Matter. */
  mitFrontMatter: z.boolean().default(true),
});
export type BatchExportInput = z.infer<typeof batchExportInputSchema>;

/**
 * Ergebnis eines Stapel-Exports. `fehler` sammelt deutsche Meldungen der
 * einzelnen fehlgeschlagenen Eintraege (Strategie: weiterlaufen und Fehler
 * sammeln; jeder Datei-Schritt ist fuer sich atomar).
 */
export const batchExportResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    anzeigePfad: z.string(),
    relPfad: safeRelativePathSchema,
    exportiert: z.number().int().min(0),
    fehler: z.array(z.string()),
  }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type BatchExportResult = z.infer<typeof batchExportResultSchema>;

/** Fortschritt eines Stapel-Exports (Main -> Renderer, aria-live). */
export const exportProgressSchema = z.object({
  fertig: z.number().int().min(0),
  gesamt: z.number().int().min(0),
});
export type ExportProgress = z.infer<typeof exportProgressSchema>;

/** Eingabe des Tag-Batch-Renames (wirkt firmenweit, inkl. Papierkorb). */
export const tagRenameInputSchema = z.object({
  alt: tagSchema,
  neu: tagSchema,
});
export type TagRenameInput = z.infer<typeof tagRenameInputSchema>;

/**
 * Ergebnis des Tag-Batch-Renames. `fehler` sammelt deutsche Meldungen
 * einzelner nicht aktualisierbarer Dateien (der Batch laeuft weiter, das
 * Manifest wird abschliessend aus dem tatsaechlichen Dateizustand atomar
 * neu geschrieben und bleibt damit immer konsistent).
 */
export const tagRenameResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    geaendert: z.number().int().min(0),
    papierkorbGeaendert: z.number().int().min(0),
    fehler: z.array(z.string()),
  }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type TagRenameResult = z.infer<typeof tagRenameResultSchema>;

/** Mindestlaenge des Passworts fuer den verschluesselten Export. */
export const VWENC_MIN_PASSWORD_LENGTH = 12;

/** Eingabe des verschluesselten Einzel-Exports (.vwenc, AES-256-GCM). */
export const encryptedExportInputSchema = z.object({
  pfad: safeRelativePathSchema,
  passwort: z.string().min(VWENC_MIN_PASSWORD_LENGTH).max(1024),
});
export type EncryptedExportInput = z.infer<typeof encryptedExportInputSchema>;

/** Eingabe des Entschluesselns (Dateiauswahl macht der Main-Prozess). */
export const decryptFileInputSchema = z.object({
  passwort: z.string().min(1).max(1024),
});
export type DecryptFileInput = z.infer<typeof decryptFileInputSchema>;

/** Ergebnis des Entschluesselns einer .vwenc-Datei. */
export const decryptFileResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), zielPfad: z.string() }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type DecryptFileResult = z.infer<typeof decryptFileResultSchema>;
