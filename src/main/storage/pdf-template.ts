/**
 * Druck-HTML-Vorlage des PDF-Exports (M8, ABARBEITUNG 4.7).
 *
 * Bewusst OHNE Electron-Import (reine Node/TS-Logik), damit die Vorlage in
 * Unit-Tests (vitest, Node-Umgebung) unabhaengig vom Rendering pruefbar ist:
 * Escaping, echte Umlaute, kein Skript, CSP-Zeile. Das eigentliche Rendering
 * (verstecktes BrowserWindow, printToPDF) macht pdf-export.ts.
 *
 * Sprache (Paket B3, E41): die PDF-Beschriftungen folgen der UI-Sprache
 * zum Exportzeitpunkt (Katalog via src/main/i18n.ts, ohne Electron-Import).
 *
 * Sicherheit (Stored-XSS-Regel ABARBEITUNG 3.5): Titel, Metadaten und Body
 * werden VOR dem Einsetzen in die Vorlage HTML-escaped. Der Body wird als
 * vorformatierter TEXT gerendert (white-space: pre-wrap), niemals als HTML
 * oder Markdown interpretiert. Die Vorlage enthaelt kein einziges Skript,
 * die CSP `default-src 'none'` verbietet jede externe Ressource.
 */
import type { TranscriptMeta } from '../../shared/company';
import { normalizeBody } from '../../shared/front-matter';
import { getUiLanguage, texte } from '../i18n';

/** HTML-Escaping fuer Textknoten und Attributwerte (Output-Encoding, 3.5). */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Datum/Uhrzeit (TT.MM.JJJJ, HH:MM) aus einem ISO-Zeitstempel; der Rahmen
 * ("... Uhr" auf Deutsch) kommt aus dem Katalog der UI-Sprache (B3/E41).
 */
export function formatPrintDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const pad = (n: number): string => String(n).padStart(2, '0');
  const datum = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear())}`;
  const zeit = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return texte().pdf.datumMitZeit(datum, zeit);
}

/**
 * Baut die vollstaendige Druck-HTML-Vorlage: schlichtes Pruefdokument-Layout
 * in der Markensprache (Serifen, feine Linien, Wortmarke), DIN A4 (Raender
 * setzt printToPDF). Alle Nutzerinhalte sind escaped; der Body ist reiner
 * vorformatierter Text.
 */
export function buildPrintHtml(meta: TranscriptMeta, body: string): string {
  // PDF-Sprache = UI-Sprache zum EXPORTZEITPUNKT (Entscheidung E41).
  const t = texte().pdf;
  const rows: readonly (readonly [string, string])[] = [
    [t.zeileErstellt, formatPrintDateTime(meta.erstellt)],
    [t.zeileGeaendert, formatPrintDateTime(meta.geaendert)],
    [t.zeileQuelle, t.quelle[meta.quelle]],
    [t.zeileModell, meta.modell],
    [t.zeileWortzahl, String(meta.wortzahl)],
    [t.zeileTags, meta.tags.length === 0 ? '—' : meta.tags.join(', ')],
  ];
  const metaRows = rows
    .map(
      ([label, value]) =>
        `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join('\n        ');
  return `<!doctype html>
<html lang="${getUiLanguage()}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>${escapeHtml(meta.titel)}</title>
<style>
  :root { color-scheme: light; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { font-size: 11pt; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    color: #1a1a1a;
    line-height: 1.55;
  }
  .kopf {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1.5pt solid #1a1a1a;
    padding-bottom: 6pt;
  }
  .wortmarke { font-size: 10pt; letter-spacing: 0.16em; text-transform: uppercase; }
  .dokumentart { font-size: 9pt; color: #555; letter-spacing: 0.08em; text-transform: uppercase; }
  h1 {
    font-size: 20pt;
    font-weight: 600;
    line-height: 1.25;
    margin: 18pt 0 12pt;
    overflow-wrap: anywhere;
  }
  table.metadaten {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5pt;
    margin-bottom: 16pt;
  }
  table.metadaten th, table.metadaten td {
    text-align: left;
    vertical-align: top;
    padding: 3pt 10pt 3pt 0;
    border-bottom: 0.5pt solid #c9c9c9;
    overflow-wrap: anywhere;
  }
  table.metadaten th { font-weight: 600; width: 22%; color: #444; }
  .volltext-titel {
    font-size: 9pt;
    color: #555;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-bottom: 0.5pt solid #c9c9c9;
    padding-bottom: 3pt;
    margin-bottom: 8pt;
  }
  .volltext {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 11pt;
  }
</style>
</head>
<body>
  <header class="kopf">
    <span class="wortmarke">VoiceWall.</span>
    <span class="dokumentart">${escapeHtml(t.dokumentart)}</span>
  </header>
  <h1>${escapeHtml(meta.titel)}</h1>
  <table class="metadaten">
    <tbody>
        ${metaRows}
    </tbody>
  </table>
  <p class="volltext-titel">${escapeHtml(t.volltext)}</p>
  <div class="volltext">${escapeHtml(normalizeBody(body))}</div>
</body>
</html>
`;
}

/** Fusszeile jeder PDF-Seite (Chromium-Template, nur Inline-Stile erlaubt). */
export function buildPrintFooter(erstelltAm: string): string {
  const t = texte().pdf;
  return `<div style="width:100%; font-family:Georgia, 'Times New Roman', serif; font-size:8pt; color:#666; text-align:center; padding:0 40px;">${escapeHtml(t.fussErstelltMit)} · ${escapeHtml(erstelltAm)} · ${escapeHtml(t.fussSeite)} <span class="pageNumber"></span> ${escapeHtml(t.fussVon)} <span class="totalPages"></span></div>`;
}
