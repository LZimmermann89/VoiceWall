/**
 * Volltextsuche ueber die Markdown-Bodies (M8, ABARBEITUNG 4.4.5).
 *
 * Umsetzung als Streaming-Scan der Dateien: die Diktate werden SEQUENZIELL
 * eine nach der anderen gelesen und durchsucht; es liegt nie mehr als ein
 * Body gleichzeitig im RAM (jede Datei ist per Schema auf 2 MB begrenzt).
 * Kein externes Search-Binary, keine native DB, kein Index-Server.
 *
 * BEWUSST KEIN Volltext-Cache in `.voicewall/` (Entscheidung E28): die
 * Messung mit 1000 Fixture-Diktaten (tests/unit/fulltext.test.ts) liegt weit
 * unter der 500-ms-Schwelle aus ABARBEITUNG 4.4.5; ein Cache waere Komplexitaet
 * ohne Nutzen. Sollte der Bestand jemals deutlich groesser werden, ist der
 * Cache als ableitbares, jederzeit loeschbares Artefakt nachruestbar.
 *
 * Sicherheit (ReDoS-/Injektions-Regel 3.5): der Suchbegriff wird IMMER als
 * Literal behandelt (indexOf auf dem kleingeschriebenen Text), nie als Regex
 * und nie als Pfad. Die Dateipfade kommen aus dem validierten Manifest und
 * laufen zusaetzlich durch die Containment-Pruefung.
 */
import { readFile } from 'node:fs/promises';
import type { ManifestEntry } from '../../shared/company';
import { parseFrontMatter } from '../../shared/front-matter';
import { resolveInsideDir } from './containment';

/** Maximale Snippet-Laenge (Codepoints), passend zum zod-Schema (400). */
const SNIPPET_MAX_CHARS = 200;
/** Kontext vor/nach dem Treffer (Codepoints). */
const SNIPPET_CONTEXT_BEFORE = 40;

/**
 * Baut ein einzeiliges Kontext-Snippet um die Trefferposition herum
 * (codepoint-sicher, Whitespace kollabiert, mit Ellipsen an Schnittkanten).
 */
export function buildSnippet(body: string, matchIndex: number, needleLength: number): string {
  const before = Array.from(body.slice(0, matchIndex));
  const fromMatch = Array.from(body.slice(matchIndex));
  const start = Math.max(0, before.length - SNIPPET_CONTEXT_BEFORE);
  const end = Math.min(fromMatch.length, needleLength + SNIPPET_MAX_CHARS - SNIPPET_CONTEXT_BEFORE);
  const raw = [...before.slice(start), ...fromMatch.slice(0, end)].join('');
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  const prefix = start > 0 ? '… ' : '';
  const suffix = end < fromMatch.length ? ' …' : '';
  return `${prefix}${collapsed}${suffix}`;
}

/**
 * Durchsucht die Bodies der uebergebenen Manifest-Eintraege nach dem
 * Literal-Suchbegriff (case-insensitiv, de-DE). Liefert je Treffer-id ein
 * Kontext-Snippet. Nicht lesbare oder beschaedigte Dateien werden
 * uebersprungen (die Suche faellt nie wegen einer Einzeldatei aus).
 */
export async function searchTranscriptBodies(
  companyDir: string,
  entries: readonly ManifestEntry[],
  rawNeedle: string,
): Promise<Map<string, string>> {
  const treffer = new Map<string, string>();
  const needle = rawNeedle.normalize('NFC').toLocaleLowerCase('de-DE');
  if (needle.trim().length === 0) {
    return treffer;
  }
  for (const entry of entries) {
    // Containment auch hier: Manifest-Pfade sind fremder Input.
    const resolved = resolveInsideDir(companyDir, entry.pfad);
    if (!resolved.ok) {
      continue;
    }
    let content: string;
    try {
      content = await readFile(resolved.value, 'utf8');
    } catch {
      continue;
    }
    const parsed = parseFrontMatter(content);
    if (!parsed.ok) {
      continue;
    }
    const body = parsed.value.body.normalize('NFC');
    const lowered = body.toLocaleLowerCase('de-DE');
    const index = lowered.indexOf(needle);
    if (index === -1) {
      continue;
    }
    treffer.set(entry.id, buildSnippet(body, index, needle.length));
  }
  return treffer;
}
