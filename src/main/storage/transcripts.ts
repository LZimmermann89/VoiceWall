/**
 * Transkript-Speicher: jedes Diktat ist eine
 * Markdown-Datei mit YAML-Front-Matter unter `Diktate/YYYY/MM/`.
 *
 * Garantien:
 * - Dateiname `YYYY-MM-DD_HHMMSS_<slug>.md`; Slug aus dem Titel (Umlaute zu
 *   Basis NUR im Dateinamen, max. 40 Zeichen), bei Kollision im selben
 *   Sekunden-Zeitstempel wird das id-Suffix angehaengt. Der erzeugte Name
 *   laeuft zusaetzlich durch die Einzelsegment-Containment-Pruefung aus
 *   sanitize.ts.
 * - Schreiben ist ausnahmslos atomar (writeFileAtomic: Temp plus Rename).
 * - JEDER Zugriff (auch Lesen!) prueft das Containment nach path.resolve:
 *   eine manipulierte Manifest-/Konfig-Angabe kann nie ausserhalb des
 *   Firmenordners lesen oder schreiben (containment.ts).
 * - CRUD: create, read, update (geaendert + version hochzaehlen), softDelete
 *   (Verschieben nach Papierkorb/), restore, hardDelete (nur aus dem
 *   Papierkorb). Manifest-Pflege macht die aufrufende Schicht
 *   (companies.ts) ueber manifest.ts, damit Datei- und Index-Logik getrennt
 *   testbar bleiben.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import {
  transcriptMetaSchema,
  type TranscriptMeta,
  type TranscriptQuelle,
} from '../../shared/company';
import {
  countWords,
  normalizeBody,
  parseFrontMatter,
  serializeFrontMatter,
  type FlatFrontMatter,
} from '../../shared/front-matter';
import { texte } from '../i18n';
import { err, ok, type Result } from '../../shared/result';
import {
  formatDateStamp,
  formatIsoWithOffset,
  formatTimeStamp,
  formatYearMonthSegments,
} from '../../shared/time';
import { writeFileAtomic } from './atomic-write';
import { resolveInsideDir } from './containment';
import { DIKTATE_DIR, PAPIERKORB_DIR } from './company-folder';
import { resolveContainedChildPath } from './sanitize';

export const SLUG_MAX_LENGTH = 40;
export const FALLBACK_SLUG = 'diktat';

export interface TranscriptInput {
  readonly titel: string;
  readonly body: string;
  readonly sprache: string;
  readonly modell: string;
  readonly dauerSekunden: number;
  readonly tags: readonly string[];
  readonly quelle: TranscriptQuelle;
  readonly zielApp?: string;
  /** Beleg der Textaufbereitung: angewandte Ersetzungen, formatiert. */
  readonly ersetzungen?: readonly string[];
}

export interface TranscriptRecord {
  readonly meta: TranscriptMeta;
  /** Relativer Pfad innerhalb des Firmenordners (NFC, `/`-getrennt). */
  readonly relPfad: string;
}

export interface TranscriptDocument extends TranscriptRecord {
  readonly body: string;
}

export interface TranscriptClockDeps {
  /** Injektionspunkt fuer Tests (deterministische Zeit). */
  readonly now?: () => Date;
  /** Injektionspunkt fuer Tests (deterministisches id-Suffix). */
  readonly randomSuffix?: () => string;
}

/**
 * Slug aus dem Titel (nur fuer den Dateinamen; die Anzeige nutzt `titel`):
 * echte Umlaute und ss-Ligatur BLEIBEN im Dateinamen erhalten
 * (Inhaber-Entscheidung vom 03.07.2026: die Dateinamen sollen deutsch
 * lesbar sein; der Firmenordner traegt ohnehin schon Umlaute, und alle
 * Pfad-Vergleiche laufen NFC-normalisiert). Uebrige Diakritika
 * werden zur Basis reduziert (é zu e), alles ausserhalb [a-zäöüß0-9] wird
 * zu `-`, zusammengefasst und auf 40 Zeichen begrenzt.
 */
export function slugFromTitle(titel: string): string {
  // Umlaute/ß vor der NFD-Diakritika-Entfernung schuetzen: Zeichenweise
  // pruefen statt Steuerzeichen-Platzhalter (lint-freundlich und explizit).
  const lowered = titel.normalize('NFC').toLowerCase();
  const KEEP = new Set(['ä', 'ö', 'ü', 'ß']);
  const restauriert = Array.from(lowered)
    .map((zeichen) => {
      if (KEEP.has(zeichen)) {
        return zeichen;
      }
      // Diakritika einzelner Fremdzeichen zur Basis reduzieren (é zu e).
      return zeichen.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    })
    .join('');
  const base = restauriert
    .replace(/[^a-zäöüß0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  const cut = base.slice(0, SLUG_MAX_LENGTH).replace(/-+$/, '');
  return cut.length === 0 ? FALLBACK_SLUG : cut;
}

/** Relativer Pfad mit `/` (plattformneutral, NFC) aus einem absoluten Pfad. */
function toRelPfad(companyDir: string, absolutePath: string): string {
  return relative(companyDir, absolutePath).split(sep).join('/').normalize('NFC');
}

/**
 * Wandelt die flachen Metadaten fuer den Front-Matter-Serializer um.
 * Exportiert, damit Export und Tag-Batch-Rename exakt dieselbe
 * Feldreihenfolge schreiben wie der Transkript-Speicher.
 */
export function transcriptMetaToFrontMatter(meta: TranscriptMeta): FlatFrontMatter {
  const entries: Record<string, string | number | readonly string[]> = {
    id: meta.id,
    titel: meta.titel,
    erstellt: meta.erstellt,
    geaendert: meta.geaendert,
    sprache: meta.sprache,
    modell: meta.modell,
    dauer_sekunden: meta.dauer_sekunden,
    wortzahl: meta.wortzahl,
    tags: meta.tags,
    quelle: meta.quelle,
  };
  if (meta.ziel_app !== undefined) {
    entries['ziel_app'] = meta.ziel_app;
  }
  if (meta.ersetzungen !== undefined) {
    entries['ersetzungen'] = meta.ersetzungen;
  }
  entries['version'] = meta.version;
  return entries;
}

/** Prueft, dass ein relativer Pfad unterhalb des erwarteten Wurzelordners liegt. */
function resolveInExpectedRoot(
  companyDir: string,
  relPfad: string,
  expectedRoot: string,
): Result<string, string> {
  const resolved = resolveInsideDir(companyDir, relPfad);
  if (!resolved.ok) {
    return resolved;
  }
  const normalized = relPfad.normalize('NFC');
  if (normalized !== expectedRoot && !normalized.startsWith(`${expectedRoot}/`)) {
    return err(texte().diktate.pfadAusserhalbWurzel(expectedRoot));
  }
  return resolved;
}

/** Erzeugt das kurze Zufalls-Suffix der stabilen id (6 Hex-Zeichen). */
function defaultRandomSuffix(): string {
  return randomBytes(3).toString('hex');
}

/**
 * Legt ein neues Diktat an: Front-Matter serialisieren, Zielordner
 * `Diktate/YYYY/MM/` sicherstellen, atomar schreiben. Kollisionen im selben
 * Sekunden-Zeitstempel loest das id-Suffix im Dateinamen.
 */
export async function createTranscript(
  companyDir: string,
  input: TranscriptInput,
  deps: TranscriptClockDeps = {},
): Promise<Result<TranscriptRecord, string>> {
  const now = (deps.now ?? (() => new Date()))();
  const suffix = (deps.randomSuffix ?? defaultRandomSuffix)();
  const dateStamp = formatDateStamp(now);
  const timeStamp = formatTimeStamp(now);
  const id = `${dateStamp}_${timeStamp}_${suffix}`;
  const iso = formatIsoWithOffset(now);

  const meta: TranscriptMeta = {
    id,
    titel: input.titel.normalize('NFC'),
    erstellt: iso,
    geaendert: iso,
    sprache: input.sprache,
    modell: input.modell,
    dauer_sekunden: input.dauerSekunden,
    wortzahl: countWords(input.body),
    tags: input.tags.map((tag) => tag.normalize('NFC')),
    quelle: input.quelle,
    ...(input.zielApp === undefined ? {} : { ziel_app: input.zielApp }),
    ...(input.ersetzungen === undefined || input.ersetzungen.length === 0
      ? {}
      : { ersetzungen: [...input.ersetzungen] }),
    version: 1,
  };
  const checked = transcriptMetaSchema.safeParse(meta);
  if (!checked.success) {
    return err(
      texte().diktate.metadatenUngueltig(
        checked.error.issues[0]?.message ?? texte().generisch.unbekannt,
      ),
    );
  }

  const { year, month } = formatYearMonthSegments(now);
  const monthDirResult = resolveInsideDir(companyDir, `${DIKTATE_DIR}/${year}/${month}`);
  if (!monthDirResult.ok) {
    return monthDirResult;
  }
  const monthDir = monthDirResult.value;
  try {
    await mkdir(monthDir, { recursive: true });
  } catch (error) {
    return err(
      texte().diktate.ordnerAnlageFehler(error instanceof Error ? error.message : String(error)),
    );
  }

  const slug = slugFromTitle(input.titel);
  // Kollisionsstrategie 4.4.3: erst der reine Slug-Name, sonst id-Suffix.
  const candidates = [
    `${dateStamp}_${timeStamp}_${slug}.md`,
    `${dateStamp}_${timeStamp}_${slug}_${suffix}.md`,
  ];
  for (const fileName of candidates) {
    // Der erzeugte Name durchlaeuft die Einzelsegment-Pruefung: er ist
    // damit beweisbar genau EIN sicheres Pfadsegment im Monatsordner.
    const contained = resolveContainedChildPath(monthDir, fileName);
    if (!contained.ok) {
      return err(contained.error.message);
    }
    const filePath = contained.value;
    try {
      await stat(filePath);
      continue; // Datei existiert: naechster Kandidat (id-Suffix).
    } catch {
      // Datei existiert nicht: anlegen.
    }
    try {
      await writeFileAtomic(
        filePath,
        serializeFrontMatter(transcriptMetaToFrontMatter(checked.data), input.body),
      );
    } catch (error) {
      return err(
        texte().diktate.schreibFehler(error instanceof Error ? error.message : String(error)),
      );
    }
    return ok({ meta: checked.data, relPfad: toRelPfad(companyDir, filePath) });
  }
  return err(texte().diktate.anlageKollision);
}

/**
 * Listet alle Diktate im Papierkorb (flache `.md`-Dateien direkt unter
 * `Papierkorb/`). Nicht lesbare/kaputte Dateien werden uebersprungen (nie
 * geloescht), damit ein einzelnes beschaedigtes Diktat die Liste nicht
 * verhindert. Neueste (nach `erstellt`) zuerst.
 */
export async function listPapierkorb(
  companyDir: string,
): Promise<Result<TranscriptDocument[], string>> {
  const dirResult = resolveInsideDir(companyDir, PAPIERKORB_DIR);
  if (!dirResult.ok) {
    return dirResult;
  }
  let names: string[];
  try {
    names = await readdir(dirResult.value);
  } catch {
    // Kein Papierkorb-Ordner (noch nie etwas geloescht): leere Liste.
    return ok([]);
  }
  const docs: TranscriptDocument[] = [];
  for (const name of names) {
    if (!name.endsWith('.md') || name.startsWith('.')) {
      continue;
    }
    const doc = await readTranscript(companyDir, `${PAPIERKORB_DIR}/${name}`, PAPIERKORB_DIR);
    if (doc.ok) {
      docs.push(doc.value);
    }
  }
  return ok(
    docs.sort((a, b) =>
      a.meta.erstellt < b.meta.erstellt ? 1 : a.meta.erstellt > b.meta.erstellt ? -1 : 0,
    ),
  );
}

/** Liest ein Diktat (Containment-gesichert, Schema-validiert). */
export async function readTranscript(
  companyDir: string,
  relPfad: string,
  expectedRoot: string = DIKTATE_DIR,
): Promise<Result<TranscriptDocument, string>> {
  const resolved = resolveInExpectedRoot(companyDir, relPfad, expectedRoot);
  if (!resolved.ok) {
    return resolved;
  }
  let content: string;
  try {
    content = await readFile(resolved.value, 'utf8');
  } catch {
    return err(texte().diktate.nichtGefunden);
  }
  const parsed = parseFrontMatter(content);
  if (!parsed.ok) {
    return err(texte().diktate.beschaedigt(parsed.error));
  }
  const meta = transcriptMetaSchema.safeParse(parsed.value.meta);
  if (!meta.success) {
    return err(
      texte().diktate.schemaVerletzt(meta.error.issues[0]?.message ?? texte().generisch.unbekannt),
    );
  }
  return ok({
    meta: meta.data,
    body: parsed.value.body,
    relPfad: relPfad.normalize('NFC'),
  });
}

export interface TranscriptChanges {
  readonly titel?: string;
  readonly body?: string;
  readonly tags?: readonly string[];
  readonly zielApp?: string;
}

/**
 * Aktualisiert ein Diktat: `geaendert` neu, `version` hochzaehlen, atomar
 * schreiben. Der Dateiname bleibt stabil (die id ist der Primaerschluessel;
 * ein Titel-Rename aendert bewusst nicht den Pfad).
 */
export async function updateTranscript(
  companyDir: string,
  relPfad: string,
  changes: TranscriptChanges,
  deps: TranscriptClockDeps = {},
): Promise<Result<TranscriptDocument, string>> {
  const current = await readTranscript(companyDir, relPfad);
  if (!current.ok) {
    return current;
  }
  const now = (deps.now ?? (() => new Date()))();
  const body = changes.body === undefined ? current.value.body : normalizeBody(changes.body);
  const zielApp = changes.zielApp ?? current.value.meta.ziel_app;
  const meta: TranscriptMeta = {
    ...current.value.meta,
    titel: (changes.titel ?? current.value.meta.titel).normalize('NFC'),
    tags: (changes.tags ?? current.value.meta.tags).map((tag) => tag.normalize('NFC')),
    ...(zielApp === undefined ? {} : { ziel_app: zielApp }),
    geaendert: formatIsoWithOffset(now),
    wortzahl: countWords(body),
    version: current.value.meta.version + 1,
  };
  const checked = transcriptMetaSchema.safeParse(meta);
  if (!checked.success) {
    return err(
      texte().diktate.metadatenUngueltig(
        checked.error.issues[0]?.message ?? texte().generisch.unbekannt,
      ),
    );
  }
  const resolved = resolveInExpectedRoot(companyDir, relPfad, DIKTATE_DIR);
  if (!resolved.ok) {
    return resolved;
  }
  try {
    await writeFileAtomic(
      resolved.value,
      serializeFrontMatter(transcriptMetaToFrontMatter(checked.data), body),
    );
  } catch (error) {
    return err(
      texte().diktate.schreibFehler(error instanceof Error ? error.message : String(error)),
    );
  }
  return ok({ meta: checked.data, body, relPfad: relPfad.normalize('NFC') });
}

/**
 * Soft-Delete: verschiebt die Datei nach `Papierkorb/`.
 * Nichts wird vernichtet; der Eintrag ist per restore umkehrbar.
 */
export async function softDeleteTranscript(
  companyDir: string,
  relPfad: string,
): Promise<Result<{ papierkorbRelPfad: string }, string>> {
  const source = await readTranscript(companyDir, relPfad);
  if (!source.ok) {
    return source;
  }
  const sourceResolved = resolveInExpectedRoot(companyDir, relPfad, DIKTATE_DIR);
  if (!sourceResolved.ok) {
    return sourceResolved;
  }
  const fileName = basename(sourceResolved.value);
  // Kollision im Papierkorb: id-Suffix haengt bereits im Dateinamen bzw.
  // wird ueber einen Zufallszusatz aufgeloest, nie ueberschreiben.
  let targetName = fileName;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const targetResult = resolveContainedChildPath(join(companyDir, PAPIERKORB_DIR), targetName);
    if (!targetResult.ok) {
      return err(targetResult.error.message);
    }
    const target = targetResult.value;
    try {
      await stat(target);
      targetName = `${fileName.replace(/\.md$/, '')}_${randomBytes(3).toString('hex')}.md`;
      continue;
    } catch {
      // Ziel frei.
    }
    try {
      await mkdir(join(companyDir, PAPIERKORB_DIR), { recursive: true });
      await rename(sourceResolved.value, target);
    } catch (error) {
      return err(
        texte().diktate.papierkorbFehler(error instanceof Error ? error.message : String(error)),
      );
    }
    return ok({ papierkorbRelPfad: toRelPfad(companyDir, target) });
  }
  return err(texte().diktate.papierkorbKollision);
}

/**
 * Stellt ein Diktat aus dem Papierkorb wieder her (Zielordner ergibt sich
 * aus dem `erstellt`-Zeitstempel der Metadaten).
 */
export async function restoreTranscript(
  companyDir: string,
  papierkorbRelPfad: string,
): Promise<Result<TranscriptRecord, string>> {
  const source = await readTranscript(companyDir, papierkorbRelPfad, PAPIERKORB_DIR);
  if (!source.ok) {
    return source;
  }
  const sourceResolved = resolveInExpectedRoot(companyDir, papierkorbRelPfad, PAPIERKORB_DIR);
  if (!sourceResolved.ok) {
    return sourceResolved;
  }
  const erstellt = new Date(source.value.meta.erstellt);
  const { year, month } = formatYearMonthSegments(erstellt);
  const targetDirResult = resolveInsideDir(companyDir, `${DIKTATE_DIR}/${year}/${month}`);
  if (!targetDirResult.ok) {
    return targetDirResult;
  }
  const targetResult = resolveContainedChildPath(
    targetDirResult.value,
    basename(sourceResolved.value),
  );
  if (!targetResult.ok) {
    return err(targetResult.error.message);
  }
  try {
    await stat(targetResult.value);
    return err(texte().diktate.wiederherstellenZielBelegt);
  } catch {
    // Ziel frei: gut.
  }
  try {
    await mkdir(targetDirResult.value, { recursive: true });
    await rename(sourceResolved.value, targetResult.value);
  } catch (error) {
    return err(
      texte().diktate.wiederherstellenFehler(
        error instanceof Error ? error.message : String(error),
      ),
    );
  }
  return ok({ meta: source.value.meta, relPfad: toRelPfad(companyDir, targetResult.value) });
}

/**
 * Endgueltiges Loeschen: AUSSCHLIESSLICH aus dem Papierkorb, mit
 * Containment-Pruefung. Ein Pfad ausserhalb `Papierkorb/` wird abgewiesen.
 */
export async function hardDeleteTranscript(
  companyDir: string,
  papierkorbRelPfad: string,
): Promise<Result<void, string>> {
  const resolved = resolveInExpectedRoot(companyDir, papierkorbRelPfad, PAPIERKORB_DIR);
  if (!resolved.ok) {
    return resolved;
  }
  if (dirname(resolved.value) !== resolve(companyDir, PAPIERKORB_DIR)) {
    return err(texte().diktate.endgueltigNurPapierkorb);
  }
  try {
    await rm(resolved.value);
  } catch (error) {
    return err(
      texte().diktate.endgueltigFehler(error instanceof Error ? error.message : String(error)),
    );
  }
  return ok(undefined);
}
