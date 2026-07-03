/**
 * Export eines Diktats als Markdown oder TXT (M7, ABARBEITUNG 4.7/4.8).
 *
 * Ziel ist ausschliesslich der `Exporte/`-Ordner im Firmenordner. Wie jeder
 * Schreibpfad des Ordner-als-Datenbank-Modells:
 * - atomar (writeFileAtomic: Temp plus Rename),
 * - Containment ueberall: die Quelle wird als sicherer relativer Pfad unter
 *   `Diktate/` gelesen, der Zieldateiname durchlaeuft die
 *   Einzelsegment-Containment-Pruefung aus sanitize.ts (M4), sodass der Export
 *   beweisbar genau EIN sicheres Segment im Exporte-Ordner ist.
 *
 * Der Renderer uebergibt nie einen absoluten Pfad; er nennt nur den sicheren
 * relativen Quellpfad. Diese Schicht loest alle Pfade selbst auf.
 *
 * PDF-Export ist bewusst v1.1 (M8) und hier NICHT enthalten.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import type { ExportFormat, TranscriptMeta } from '../../shared/company';
import {
  normalizeBody,
  serializeFrontMatter,
  type FlatFrontMatter,
} from '../../shared/front-matter';
import { err, ok, type Result } from '../../shared/result';
import { writeFileAtomic } from './atomic-write';
import { EXPORTE_DIR } from './company-folder';
import { resolveInsideDir } from './containment';
import { resolveContainedChildPath } from './sanitize';
import { readTranscript } from './transcripts';

/** Wandelt die flachen Metadaten fuer den Front-Matter-Serializer um. */
function metaToFrontMatter(meta: TranscriptMeta): FlatFrontMatter {
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
  entries['version'] = meta.version;
  return entries;
}

/**
 * Baut den Export-Inhalt (reine Funktion, ohne Dateisystem, damit die
 * Varianten unabhaengig testbar sind):
 * - `md` mit Front-Matter: vollstaendige Markdown-Datei (Front-Matter + Body).
 * - `md` ohne Front-Matter: `# Titel` plus Body (menschenlesbares Markdown).
 * - `txt`: nur der Body, reiner Text, maximale Kompatibilitaet.
 */
export function buildExportContent(
  meta: TranscriptMeta,
  body: string,
  format: ExportFormat,
  mitFrontMatter: boolean,
): string {
  const normalizedBody = normalizeBody(body);
  if (format === 'txt') {
    return normalizedBody;
  }
  if (mitFrontMatter) {
    return serializeFrontMatter(metaToFrontMatter(meta), body);
  }
  return `# ${meta.titel}\n\n${normalizedBody}`;
}

/** Dateiendung je Format und Variante. */
function exportExtension(format: ExportFormat): string {
  return format === 'txt' ? '.txt' : '.md';
}

/** Basisname des Exports aus dem Quelldateinamen (ohne `.md`). */
function exportBaseName(sourceRelPfad: string): string {
  const name = basename(sourceRelPfad);
  return name.endsWith('.md') ? name.slice(0, -3) : name;
}

export interface ExportSuccess {
  /** Absoluter Pfad der Exportdatei (nur Anzeige/Reveal-Aufloesung im Main). */
  readonly absPfad: string;
  /** Sicherer relativer Pfad unter `Exporte/` (fuer den Reveal-Aufruf). */
  readonly relPfad: string;
}

/**
 * Exportiert ein Diktat in den `Exporte/`-Ordner. Kollisionen loest ein
 * kurzes Zufalls-Suffix auf (nie ueberschreiben). Liefert absoluten und
 * sicheren relativen Pfad.
 */
export async function exportTranscript(
  companyDir: string,
  sourceRelPfad: string,
  format: ExportFormat,
  mitFrontMatter: boolean,
): Promise<Result<ExportSuccess, string>> {
  const source = await readTranscript(companyDir, sourceRelPfad);
  if (!source.ok) {
    return source;
  }
  const content = buildExportContent(source.value.meta, source.value.body, format, mitFrontMatter);

  const exporteDirResult = resolveInsideDir(companyDir, EXPORTE_DIR);
  if (!exporteDirResult.ok) {
    return exporteDirResult;
  }
  try {
    await mkdir(exporteDirResult.value, { recursive: true, mode: 0o700 });
  } catch (error) {
    return err(
      `Der Exporte-Ordner konnte nicht angelegt werden: ${error instanceof Error ? error.message : String(error)}. Bitte die Schreibrechte im Firmenordner prüfen.`,
    );
  }

  const base = exportBaseName(sourceRelPfad);
  const suffix = mitFrontMatter ? '' : '-ohne-kopf';
  const ext = exportExtension(format);
  const candidates = [
    `${base}${suffix}${ext}`,
    `${base}${suffix}_${randomBytes(3).toString('hex')}${ext}`,
  ];
  for (const fileName of candidates) {
    // Einzelsegment-Containment (M4): der Name ist beweisbar genau EIN
    // sicheres Segment im Exporte-Ordner.
    const contained = resolveContainedChildPath(exporteDirResult.value, fileName);
    if (!contained.ok) {
      return err(contained.error.message);
    }
    const target = contained.value;
    try {
      await stat(target);
      continue; // Datei existiert: naechster Kandidat (Zufalls-Suffix).
    } catch {
      // Ziel frei.
    }
    try {
      await writeFileAtomic(target, content);
    } catch (error) {
      return err(
        `Der Export konnte nicht geschrieben werden: ${error instanceof Error ? error.message : String(error)}. Bitte die Schreibrechte im Firmenordner prüfen.`,
      );
    }
    return ok({ absPfad: target, relPfad: `${EXPORTE_DIR}/${fileName}` });
  }
  return err(
    'Der Export konnte nicht angelegt werden (Dateinamens-Kollision). Bitte erneut versuchen.',
  );
}
