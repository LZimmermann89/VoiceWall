/**
 * Zod-Schemas und Typen des Ordner-als-Datenbank-Modells (M5, ABARBEITUNG 4.4
 * und 4.5): Transkript-Metadaten (Front-Matter), Manifest, firmenbezogene
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

/** Aktuelle Schema-Version des Firmenordners (.voicewall/.schema-version). */
export const COMPANY_SCHEMA_VERSION = 1;

/** ISO 8601 mit Zeitzone (Z oder +HH:MM), wie in ABARBEITUNG 4.4.2. */
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

/** Front-Matter-Metadaten eines Diktats (ABARBEITUNG 4.4.2, flaches Schema). */
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
  version: z.number().int().min(1),
});
export type TranscriptMeta = z.infer<typeof transcriptMetaSchema>;

/** Ein Manifest-Eintrag (ABARBEITUNG 4.4.4, plus `quelle` fuer die Filter). */
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

/** Firmenbezogene Konfiguration (.voicewall/config.json, ABARBEITUNG 4.5). */
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
    sprache: z.string().min(2).max(16).default('de'),
    modell: z.string().min(1).max(100).default('q5_0'),
    erstelltMit: z.string().max(100),
    erstellt: isoDateTimeSchema,
  })
  .passthrough();
export type CompanyConfig = z.infer<typeof companyConfigSchema>;

// ---------------------------------------------------------------------------
// IPC-Sichten der Firmenverwaltung (Preload-Bruecke, M5-Test-UI)
// ---------------------------------------------------------------------------

/** Eine Firma in der Firmenliste. */
export const companyInfoSchema = z.object({
  /** Absoluter Pfad des Firmenordners. */
  pfad: z.string(),
  /** Anzeigename (aus der firmenbezogenen Konfig). */
  anzeigename: z.string(),
  /** Ordnername (sanitisiertes Pfadsegment). */
  ordnername: z.string(),
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

/** Ergebnis einer Sync-Pruefung (Risiko R8). */
export const syncCheckViewSchema = z.object({
  synchronisiert: z.boolean(),
  anbieter: z.string().nullable(),
  hinweis: z.string().nullable(),
});
export type SyncCheckView = z.infer<typeof syncCheckViewSchema>;

/** Speicherstrategie fuer neue Firmenordner (Sync-Falle, Risiko R8). */
export const companyStorageStrategySchema = z.enum(['desktop', 'lokal-mit-verknuepfung']);
export type CompanyStorageStrategy = z.infer<typeof companyStorageStrategySchema>;

/**
 * E-Mail-Pruefung, RFC-lax (ABARBEITUNG 4.2.1): genau ein @, kein
 * Leerraum, mindestens ein Punkt in der Domain. Bewusst tolerant, die
 * Adresse dient nur der lokalen Anzeige (kein Versand, kein Netzwerk).
 */
export const EMAIL_LAX_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Optionale Firmendaten des Wizard-Schritts 2 (ABARBEITUNG 4.2.1). Alle
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
    /** Deutsche Sync-Warnung (Risiko R8), sonst null. */
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

/** Suchfilter der Schnellsuche (Manifest-basiert, ABARBEITUNG 4.4.5). */
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
});
export type DictateSearchFilter = z.infer<typeof dictateSearchFilterSchema>;

/** Ergebnis der Diktat-Liste/-Suche. */
export const dictateListResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), eintraege: z.array(manifestEntrySchema) }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type DictateListResult = z.infer<typeof dictateListResultSchema>;

/** Ergebnis des Diktat-Speicherns. */
export const saveDictateResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), pfad: safeRelativePathSchema, id: z.string() }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type SaveDictateResult = z.infer<typeof saveDictateResultSchema>;
