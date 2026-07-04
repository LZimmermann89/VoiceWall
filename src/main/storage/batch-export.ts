/**
 * Stapel-Export (M8, ABARBEITUNG 4.7): mehrere Diktate in einem Zug nach
 * `Exporte/` exportieren.
 *
 * - GENAU EINE Datei: normaler Einzel-Export (gleiche Pfade wie M7).
 * - MEHRERE Dateien: ein Unterordner `Exporte/<datum>-stapel/`, atomar wie
 *   die Firmenordner-Anlage: die Dateien entstehen zuerst in einem
 *   versteckten `.voicewall-tmp-…`-Ordner im Exporte-Ordner und werden dann
 *   per `rename` an die finale Stelle bewegt. Ein Abbruch hinterlaesst nie
 *   einen halbfertigen Stapel-Ordner.
 * - ZIP bewusst NICHT (Entscheidung E27): Node bringt kein ZIP mit und eine
 *   neue Laufzeit-Dependency nur fuer das Buendeln waere gegen die
 *   Null-Dependency-Regel. Ein Unterordner erfuellt denselben Zweck.
 * - Fehlerstrategie: weiterlaufen und Fehler je Datei sammeln (jeder
 *   Datei-Schritt ist fuer sich abgeschlossen); schlagen ALLE Dateien fehl,
 *   wird der Temp-Ordner entfernt und ein Fehler-Result geliefert.
 * - Fortschritt: optionaler Callback nach jeder Datei (IPC-Progress fuer
 *   die aria-live-Anzeige im Renderer).
 *
 * PDF-Rendering wird injiziert (deps.renderPdf), damit dieses Modul ohne
 * Electron testbar bleibt; companies.ts reicht den PdfRenderer herein.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ExportFormat, TranscriptMeta } from '../../shared/company';
import { texte } from '../i18n';
import { err, ok, type Result } from '../../shared/result';
import { formatDateStamp } from '../../shared/time';
import { TMP_PREFIX } from './atomic-write';
import {
  buildExportContent,
  ensureExporteDir,
  exportBaseName,
  exportExtension,
  exportTranscript,
  writeExportFile,
  type ExportSuccess,
} from './export';
import { EXPORTE_DIR } from './company-folder';
import { resolveContainedChildPath } from './sanitize';
import { readTranscript } from './transcripts';

export interface BatchExportDeps {
  /** PDF-Renderer (nur bei format `pdf` noetig; companies.ts injiziert ihn). */
  readonly renderPdf?: (
    meta: TranscriptMeta,
    body: string,
    tmpDir: string,
  ) => Promise<Result<Buffer, string>>;
  /** Fortschritts-Callback nach jeder verarbeiteten Datei. */
  readonly onProgress?: (fertig: number, gesamt: number) => void;
  /** Injektionspunkt fuer Tests (deterministische Zeit). */
  readonly now?: () => Date;
}

export interface BatchExportSuccess extends ExportSuccess {
  /** Anzahl erfolgreich exportierter Dateien. */
  readonly exportiert: number;
  /** Katalog-Meldungen je fehlgeschlagener Datei (Batch laeuft weiter). */
  readonly fehler: readonly string[];
}

/** Baut den Inhalt einer einzelnen Stapel-Datei (Text oder PDF-Buffer). */
async function buildEntryContent(
  companyDir: string,
  relPfad: string,
  format: ExportFormat,
  mitFrontMatter: boolean,
  tmpDir: string,
  deps: BatchExportDeps,
): Promise<Result<string | Buffer, string>> {
  const source = await readTranscript(companyDir, relPfad);
  if (!source.ok) {
    return source;
  }
  if (format === 'pdf') {
    if (deps.renderPdf === undefined) {
      return err(texte().export.pdfNichtVerfuegbar);
    }
    return deps.renderPdf(source.value.meta, source.value.body, tmpDir);
  }
  return ok(buildExportContent(source.value.meta, source.value.body, format, mitFrontMatter));
}

/**
 * Exportiert mehrere Diktate. Liefert den Pfad der erzeugten Datei (eine
 * Quelle) bzw. des erzeugten Stapel-Ordners (mehrere Quellen).
 */
export async function exportTranscriptsBatch(
  companyDir: string,
  pfade: readonly string[],
  format: ExportFormat,
  mitFrontMatter: boolean,
  deps: BatchExportDeps = {},
): Promise<Result<BatchExportSuccess, string>> {
  const gesamt = pfade.length;
  if (gesamt === 0) {
    return err(texte().export.keineAuswahl);
  }

  // Einzelfall: exakt der bestehende Einzel-Export (keine Ordner-Anlage).
  if (gesamt === 1) {
    const relPfad = pfade[0] ?? '';
    const single =
      format === 'pdf'
        ? await (async (): Promise<Result<ExportSuccess, string>> => {
            const exporteDir = await ensureExporteDir(companyDir);
            if (!exporteDir.ok) {
              return exporteDir;
            }
            const content = await buildEntryContent(
              companyDir,
              relPfad,
              format,
              mitFrontMatter,
              exporteDir.value,
              deps,
            );
            if (!content.ok) {
              return content;
            }
            return writeExportFile(companyDir, exportBaseName(relPfad), '.pdf', content.value);
          })()
        : await exportTranscript(companyDir, relPfad, format, mitFrontMatter);
    deps.onProgress?.(1, 1);
    if (!single.ok) {
      return single;
    }
    return ok({ ...single.value, exportiert: 1, fehler: [] });
  }

  const exporteDir = await ensureExporteDir(companyDir);
  if (!exporteDir.ok) {
    return exporteDir;
  }

  // Temp-Ordner im Exporte-Ordner (gleiches Dateisystem, rename ist atomar).
  const tmpDir = join(exporteDir.value, `${TMP_PREFIX}${randomBytes(6).toString('hex')}`);
  try {
    await mkdir(tmpDir, { recursive: true, mode: 0o700 });
  } catch (error) {
    return err(
      texte().export.stapelVorbereitungFehler(
        error instanceof Error ? error.message : String(error),
      ),
    );
  }

  const fehler: string[] = [];
  const usedNames = new Set<string>();
  let exportiert = 0;
  const ext = exportExtension(format);
  const suffix = format === 'md' && !mitFrontMatter ? '-ohne-kopf' : '';

  try {
    for (const [index, relPfad] of pfade.entries()) {
      const content = await buildEntryContent(
        companyDir,
        relPfad,
        format,
        mitFrontMatter,
        tmpDir,
        deps,
      );
      if (!content.ok) {
        fehler.push(`${relPfad}: ${content.error}`);
        deps.onProgress?.(index + 1, gesamt);
        continue;
      }
      // Namenskollision INNERHALB des Stapels: Zaehler-Suffix, nie ueberschreiben.
      let fileName = `${exportBaseName(relPfad)}${suffix}${ext}`;
      for (let counter = 2; usedNames.has(fileName); counter += 1) {
        fileName = `${exportBaseName(relPfad)}${suffix}-${String(counter)}${ext}`;
      }
      // Einzelsegment-Containment (M4) auch fuer jeden Stapel-Dateinamen.
      const target = resolveContainedChildPath(tmpDir, fileName);
      if (!target.ok) {
        fehler.push(`${relPfad}: ${target.error.message}`);
        deps.onProgress?.(index + 1, gesamt);
        continue;
      }
      try {
        await writeFile(target.value, content.value, { mode: 0o600 });
        usedNames.add(fileName);
        exportiert += 1;
      } catch (error) {
        fehler.push(`${relPfad}: ${error instanceof Error ? error.message : String(error)}`);
      }
      deps.onProgress?.(index + 1, gesamt);
    }

    if (exportiert === 0) {
      await rm(tmpDir, { recursive: true, force: true });
      return err(texte().export.stapelAlleFehlgeschlagen(fehler[0] ?? texte().generisch.unbekannt));
    }

    // Finalen Stapel-Ordnernamen bestimmen (Kollision: Zaehler-Suffix).
    const now = (deps.now ?? (() => new Date()))();
    const baseName = `${formatDateStamp(now)}-stapel`;
    for (let counter = 0; counter < 100; counter += 1) {
      const dirName = counter === 0 ? baseName : `${baseName}-${String(counter + 1)}`;
      const finalDir = resolveContainedChildPath(exporteDir.value, dirName);
      if (!finalDir.ok) {
        await rm(tmpDir, { recursive: true, force: true });
        return err(finalDir.error.message);
      }
      try {
        await stat(finalDir.value);
        continue; // Ordner existiert: naechster Kandidat.
      } catch {
        // Ziel frei.
      }
      try {
        await rename(tmpDir, finalDir.value);
      } catch {
        // Race mit einem parallelen Export: naechsten Kandidaten versuchen.
        continue;
      }
      return ok({
        absPfad: finalDir.value,
        relPfad: `${EXPORTE_DIR}/${dirName}`,
        exportiert,
        fehler,
      });
    }
    await rm(tmpDir, { recursive: true, force: true });
    return err(texte().export.stapelOrdnerKollision);
  } catch (error) {
    await rm(tmpDir, { recursive: true, force: true });
    return err(texte().export.stapelFehler(error instanceof Error ? error.message : String(error)));
  }
}
