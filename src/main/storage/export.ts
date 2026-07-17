/**
 * Export eines Diktats als Markdown oder TXT.
 *
 * Ziel ist ausschliesslich der `Exporte/`-Ordner im Firmenordner. Wie jeder
 * Schreibpfad des Ordner-als-Datenbank-Modells:
 * - atomar (writeFileAtomic: Temp plus Rename),
 * - Containment ueberall: die Quelle wird als sicherer relativer Pfad unter
 *   `Diktate/` gelesen, der Zieldateiname durchlaeuft die
 *   Einzelsegment-Containment-Pruefung aus sanitize.ts, sodass der Export
 *   beweisbar genau EIN sicheres Segment im Exporte-Ordner ist.
 *
 * Der Renderer uebergibt nie einen absoluten Pfad; er nennt nur den sicheren
 * relativen Quellpfad. Diese Schicht loest alle Pfade selbst auf.
 *
 * Auch der PDF-Export (pdf-export.ts), der Stapel-Export
 * (batch-export.ts) und der verschluesselte Export (encrypted-export.ts) die
 * hier exportierten Bausteine (writeExportFile, exportBaseName).
 */
import { randomBytes } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import type { ExportFormat, TranscriptMeta } from '../../shared/company';
import { normalizeBody, serializeFrontMatter } from '../../shared/front-matter';
import { texte } from '../i18n';
import { err, ok, type Result } from '../../shared/result';
import { writeFileAtomic } from './atomic-write';
import { EXPORTE_DIR } from './company-folder';
import { resolveInsideDir } from './containment';
import { resolveContainedChildPath } from './sanitize';
import { readTranscript, transcriptMetaToFrontMatter } from './transcripts';

/**
 * Baut den Export-Inhalt (reine Funktion, ohne Dateisystem, damit die
 * Varianten unabhaengig testbar sind):
 * - `md` mit Front-Matter: vollstaendige Markdown-Datei (Front-Matter + Body).
 * - `md` ohne Front-Matter: `# Titel` plus Body (menschenlesbares Markdown).
 * - `txt`: nur der Body, reiner Text, maximale Kompatibilitaet.
 *
 * PDF laeuft nicht ueber diese Funktion (eigene Druckvorlage, pdf-export.ts).
 */
export function buildExportContent(
  meta: TranscriptMeta,
  body: string,
  format: Exclude<ExportFormat, 'pdf'>,
  mitFrontMatter: boolean,
): string {
  const normalizedBody = normalizeBody(body);
  if (format === 'txt') {
    return normalizedBody;
  }
  if (mitFrontMatter) {
    return serializeFrontMatter(transcriptMetaToFrontMatter(meta), body);
  }
  return `# ${meta.titel}\n\n${normalizedBody}`;
}

/** Dateiendung je Format und Variante. */
export function exportExtension(format: ExportFormat): string {
  if (format === 'pdf') {
    return '.pdf';
  }
  return format === 'txt' ? '.txt' : '.md';
}

/** Basisname des Exports aus dem Quelldateinamen (ohne `.md`). */
export function exportBaseName(sourceRelPfad: string): string {
  const name = basename(sourceRelPfad);
  return name.endsWith('.md') ? name.slice(0, -3) : name;
}

export interface ExportSuccess {
  /** Absoluter Pfad der Exportdatei (nur Anzeige/Reveal-Aufloesung im Main). */
  readonly absPfad: string;
  /** Sicherer relativer Pfad unter `Exporte/` (fuer den Reveal-Aufruf). */
  readonly relPfad: string;
}

/** Stellt den `Exporte/`-Ordner sicher und liefert den absoluten Pfad. */
export async function ensureExporteDir(companyDir: string): Promise<Result<string, string>> {
  const exporteDirResult = resolveInsideDir(companyDir, EXPORTE_DIR);
  if (!exporteDirResult.ok) {
    return exporteDirResult;
  }
  try {
    await mkdir(exporteDirResult.value, { recursive: true, mode: 0o700 });
  } catch (error) {
    return err(texte().export.ordnerFehler(error instanceof Error ? error.message : String(error)));
  }
  return ok(exporteDirResult.value);
}

/**
 * Schreibt eine Exportdatei `<baseName><ext>` atomar in den Exporte-Ordner.
 * Kollisionen loest ein kurzes Zufalls-Suffix auf (nie ueberschreiben). Der
 * Dateiname durchlaeuft die Einzelsegment-Containment-Pruefung.
 */
export async function writeExportFile(
  companyDir: string,
  baseName: string,
  ext: string,
  content: string | Uint8Array,
): Promise<Result<ExportSuccess, string>> {
  const exporteDir = await ensureExporteDir(companyDir);
  if (!exporteDir.ok) {
    return exporteDir;
  }
  const candidates = [`${baseName}${ext}`, `${baseName}_${randomBytes(3).toString('hex')}${ext}`];
  for (const fileName of candidates) {
    // Einzelsegment-Containment: der Name ist beweisbar genau EIN
    // sicheres Segment im Exporte-Ordner.
    const contained = resolveContainedChildPath(exporteDir.value, fileName);
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
        texte().export.schreibFehler(error instanceof Error ? error.message : String(error)),
      );
    }
    return ok({ absPfad: target, relPfad: `${EXPORTE_DIR}/${fileName}` });
  }
  return err(texte().export.kollision);
}

/**
 * Exportiert ein Diktat in den `Exporte/`-Ordner (Markdown/TXT). Kollisionen
 * loest ein kurzes Zufalls-Suffix auf (nie ueberschreiben). Liefert absoluten
 * und sicheren relativen Pfad. PDF macht pdf-export.ts.
 */
export async function exportTranscript(
  companyDir: string,
  sourceRelPfad: string,
  format: Exclude<ExportFormat, 'pdf'>,
  mitFrontMatter: boolean,
): Promise<Result<ExportSuccess, string>> {
  const source = await readTranscript(companyDir, sourceRelPfad);
  if (!source.ok) {
    return source;
  }
  const content = buildExportContent(source.value.meta, source.value.body, format, mitFrontMatter);
  const suffix = format === 'md' && !mitFrontMatter ? '-ohne-kopf' : '';
  return writeExportFile(
    companyDir,
    `${exportBaseName(sourceRelPfad)}${suffix}`,
    exportExtension(format),
    content,
  );
}
