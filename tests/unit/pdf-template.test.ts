/**
 * Unit-Tests der PDF-Druckvorlage (M8, ABARBEITUNG 4.7, Entscheidung E26):
 * - echte Umlaute stehen unveraendert (UTF-8) in Titel und Body der Vorlage,
 * - Nutzerinhalte sind HTML-escaped (Stored-XSS-Regel 3.5): aus einem
 *   HTML-artigen Body entsteht kein einziges echtes Element,
 * - kein Skript, keine externe Ressource, CSP `default-src 'none'`,
 * - Fusszeile traegt das Markenversprechen.
 *
 * Der End-to-End-Beweis der Umlaute IM PDF (Text-Extraktion nach
 * printToPDF) liegt in tests/e2e/export-m8.spec.ts.
 */
import { describe, expect, it } from 'vitest';
import { transcriptMetaSchema, type TranscriptMeta } from '../../src/shared/company';
import { buildPrintFooter, buildPrintHtml, escapeHtml } from '../../src/main/storage/pdf-template';

const META: TranscriptMeta = transcriptMetaSchema.parse({
  id: '2026-07-02_143210_a1b2c3',
  titel: 'Prüfprotokoll Ä Ö Ü ä ö ü ß',
  erstellt: '2026-07-02T14:32:10+02:00',
  geaendert: '2026-07-02T14:35:02+02:00',
  sprache: 'de',
  modell: 'whisper-large-v3-turbo-german-q5_0',
  dauer_sekunden: 47,
  wortzahl: 12,
  tags: ['prüfung', 'außergewöhnlich'],
  quelle: 'diktat',
  version: 1,
});

describe('escapeHtml', () => {
  it('escaped alle HTML-Metazeichen', () => {
    expect(escapeHtml(`<img src=x onerror="a">&'`)).toBe(
      '&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;',
    );
  });

  it('laesst Umlaute unveraendert (echte Glyphen, kein Entity-Ersatz)', () => {
    expect(escapeHtml('Ä Ö Ü ä ö ü ß')).toBe('Ä Ö Ü ä ö ü ß');
  });
});

describe('buildPrintHtml', () => {
  it('enthaelt Titel und Body mit echten Umlauten', () => {
    const html = buildPrintHtml(META, 'Grüße aus Düsseldorf: Ä Ö Ü ä ö ü ß.');
    expect(html).toContain('Prüfprotokoll Ä Ö Ü ä ö ü ß');
    expect(html).toContain('Grüße aus Düsseldorf: Ä Ö Ü ä ö ü ß.');
    expect(html).toContain('<meta charset="utf-8">');
  });

  it('rendert den Body als Text: HTML-artiger Inhalt wird escaped', () => {
    const html = buildPrintHtml(META, '<img src=x onerror="x()"><script>boese()</script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img src=x onerror=&quot;x()&quot;&gt;');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escaped auch Titel und Tags (Metadaten-Tabelle)', () => {
    const meta = { ...META, titel: '<b>fett</b>', tags: ['<i>kursiv</i>'] };
    const html = buildPrintHtml(meta, 'Body.');
    expect(html).not.toContain('<b>fett</b>');
    expect(html).toContain('&lt;b&gt;fett&lt;/b&gt;');
    expect(html).toContain('&lt;i&gt;kursiv&lt;/i&gt;');
  });

  it('ist CSP-konform lokal: default-src none, kein Skript, keine externe Ressource', () => {
    const html = buildPrintHtml(META, 'Body.');
    expect(html).toContain("default-src 'none'");
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/@import|url\(/);
  });

  it('zeigt die Metadaten (Modell, Wortzahl, Quelle als deutsches Label)', () => {
    const html = buildPrintHtml(META, 'Body.');
    expect(html).toContain('whisper-large-v3-turbo-german-q5_0');
    expect(html).toContain('<td>12</td>');
    expect(html).toContain('<td>Diktat</td>');
    expect(html).toContain('prüfung, außergewöhnlich');
  });
});

describe('buildPrintFooter', () => {
  it('traegt das Markenversprechen und die Seitenzaehlung', () => {
    const footer = buildPrintFooter('02.07.2026, 14:32 Uhr');
    expect(footer).toContain('Erstellt mit VoiceWall, 100 % lokal');
    expect(footer).toContain('02.07.2026, 14:32 Uhr');
    expect(footer).toContain('class="pageNumber"');
    expect(footer).toContain('class="totalPages"');
  });
});
