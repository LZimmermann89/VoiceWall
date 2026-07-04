/**
 * PDF-Export (M8, ABARBEITUNG 4.7, DoD-Pflichtpunkt: echte Umlaute).
 *
 * Umsetzung compilerfrei und 100 Prozent lokal ueber Electrons eingebautes
 * `webContents.printToPDF()` in einem versteckten BrowserWindow: die lokale
 * Druck-HTML-Vorlage (pdf-template.ts; CSP `default-src 'none'`, keine
 * externen Ressourcen, keine Skripte) rendert Titel, Metadaten und den Body
 * als reinen Text. Chromium bettet die verwendeten Systemschriften als
 * Subset in das PDF ein; damit sind Ä Ö Ü ä ö ü ß echte, korrekt kodierte
 * Glyphen (Beweis: tests/e2e/export-m8.spec.ts extrahiert den PDF-Text und
 * prueft die Umlaute; Entscheidung E26).
 *
 * Ablauf pro Datei: Vorlage in eine versteckte Tempdatei IM Exporte-Ordner
 * schreiben (`.voicewall-tmp-…html`, bleibt im Firmenordner, kein Klartext
 * ausserhalb), per loadFile laden, printToPDF, Tempdatei loeschen, PDF
 * atomar nach `Exporte/` schreiben (Containment und Kollisions-Suffix wie
 * beim Markdown-Export). Das versteckte Fenster ist sandboxed, ohne Preload,
 * ohne Node-Zugriff.
 */
import { randomBytes } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BrowserWindow } from 'electron';
import { texte } from '../i18n';
import { err, ok, type Result } from '../../shared/result';
import { TMP_PREFIX } from './atomic-write';
import { ensureExporteDir, exportBaseName, writeExportFile, type ExportSuccess } from './export';
import { buildPrintFooter, buildPrintHtml, formatPrintDateTime } from './pdf-template';
import { readTranscript } from './transcripts';

/**
 * Rendert PDF-Buffer aus Druck-HTML-Vorlagen. Ein Renderer haelt genau EIN
 * verstecktes, sandboxed BrowserWindow und rendert sequenziell; beim
 * Stapel-Export wird derselbe Renderer wiederverwendet (ein Fenster fuer n
 * Dateien statt n Fenster). Nach Gebrauch IMMER dispose() aufrufen.
 */
export class PdfRenderer {
  private window: BrowserWindow | null = null;

  private getWindow(): BrowserWindow {
    if (this.window === null || this.window.isDestroyed()) {
      this.window = new BrowserWindow({
        show: false,
        // A4-nahes Fensterformat (nur Hidden-Layout; das PDF-Format ist A4).
        width: 794,
        height: 1123,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          webSecurity: true,
        },
      });
    }
    return this.window;
  }

  /**
   * Rendert eine Vorlage zu einem PDF-Buffer. Die Vorlage wird als
   * versteckte Tempdatei in `tmpDir` (Exporte-Ordner) abgelegt und im
   * finally-Block geloescht.
   */
  async render(html: string, tmpDir: string): Promise<Result<Buffer, string>> {
    const tmpFile = join(tmpDir, `${TMP_PREFIX}${randomBytes(6).toString('hex')}.html`);
    try {
      await writeFile(tmpFile, html, { mode: 0o600 });
      const window = this.getWindow();
      await window.loadFile(tmpFile);
      const pdf = await window.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: false,
        landscape: false,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: buildPrintFooter(formatPrintDateTime(new Date().toISOString())),
        // Raender in Zoll: oben/unten 2,2 cm, links/rechts 2,4 cm (DIN-A4-
        // Brieflayout-nah, genug Platz fuer die Fusszeile).
        margins: { top: 0.87, bottom: 0.87, left: 0.94, right: 0.94 },
      });
      return ok(pdf);
    } catch (error) {
      return err(texte().export.pdfFehler(error instanceof Error ? error.message : String(error)));
    } finally {
      await rm(tmpFile, { force: true });
    }
  }

  /** Schliesst das versteckte Fenster (idempotent). */
  dispose(): void {
    if (this.window !== null && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
  }
}

/**
 * Exportiert ein Diktat als PDF nach `Exporte/` (atomar, Containment,
 * Kollisions-Suffix wie beim Markdown-Export). Optional wird ein bestehender
 * Renderer wiederverwendet (Stapel-Export).
 */
export async function exportTranscriptPdf(
  companyDir: string,
  sourceRelPfad: string,
  renderer?: PdfRenderer,
): Promise<Result<ExportSuccess, string>> {
  const source = await readTranscript(companyDir, sourceRelPfad);
  if (!source.ok) {
    return source;
  }
  const exporteDir = await ensureExporteDir(companyDir);
  if (!exporteDir.ok) {
    return exporteDir;
  }
  const ownRenderer = renderer === undefined;
  const activeRenderer = renderer ?? new PdfRenderer();
  try {
    const pdf = await activeRenderer.render(
      buildPrintHtml(source.value.meta, source.value.body),
      exporteDir.value,
    );
    if (!pdf.ok) {
      return pdf;
    }
    return await writeExportFile(companyDir, exportBaseName(sourceRelPfad), '.pdf', pdf.value);
  } finally {
    if (ownRenderer) {
      activeRenderer.dispose();
    }
  }
}
