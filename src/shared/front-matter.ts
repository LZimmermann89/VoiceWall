/**
 * Minimaler, injektionssicherer YAML-Front-Matter-Serializer/-Parser fuer das
 * FLACHE Transkript-Schema.
 *
 * Entscheidung (bewusst und dokumentiert): KEIN
 * js-yaml/yaml-Paket. Das Schema ist strikt flach (string | number |
 * string[]), braucht also keinen vollstaendigen YAML-Parser. Ein YAML-Paket
 * braechte genau die Features mit, die hier ein Risiko waeren (Anker,
 * Alias-Bomben "Billion Laughs", Tags, Merge-Keys, verschachtelte
 * Strukturen), plus eine weitere Supply-Chain-Abhaengigkeit. Dieser eigene
 * Parser akzeptiert AUSSCHLIESSLICH die flache Teilmenge und lehnt alles
 * andere hart ab (Fehler-Result, nie stilles Raten).
 *
 * Injektionssicherheit beim Schreiben:
 * - Schluessel sind auf `[A-Za-z0-9_]+` beschraenkt (interne Konstanten,
 *   nie Nutzereingabe).
 * - Strings werden immer dann JSON-quotiert (JSON-Double-Quote-Strings sind
 *   gueltige YAML-1.2-Double-Quote-Skalare), wenn sie nicht dem engen
 *   Plain-Safe-Muster entsprechen. JSON.stringify escaped Quotes, Backslash,
 *   Newlines und alle Steuerzeichen: ein Titel wie `"\ntags: [boese]` kann
 *   strukturell keine zweite Zeile und keinen zweiten Schluessel erzeugen.
 * - Arrays werden als Flow-Sequenz `[...]` mit einzeln quotierten Elementen
 *   geschrieben.
 *
 * Beim Lesen (auch von Hand editierter Dateien) werden zusaetzlich
 * Plain-Skalare, einfach quotierte Strings ('...') und Kommentare toleriert.
 * Doppelte Schluessel sind ein Fehler (klassisches Injektionsmuster).
 *
 * Dieses Modul ist reine TypeScript-Logik ohne Node-/DOM-Abhaengigkeit.
 */
import { err, ok, type Result } from './result';

export type FrontMatterValue = string | number | readonly string[];
export type FlatFrontMatter = Readonly<Record<string, FrontMatterValue>>;

export interface ParsedFrontMatter {
  readonly meta: Readonly<Record<string, string | number | readonly string[]>>;
  readonly body: string;
}

const KEY_PATTERN = /^[A-Za-z0-9_]+$/;
const KEY_VALUE_LINE = /^([A-Za-z0-9_]+):\s*(.*)$/;
/**
 * Plain-Skalare, die ohne Quotes sicher sind: beginnen mit Buchstabe/Ziffer,
 * enthalten keine YAML-Sonderzeichen, keine Spaces, kein `#`. ISO-Zeitstempel
 * (`2026-07-02T14:32:10+02:00`) fallen bewusst darunter.
 */
const PLAIN_SAFE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:+-]*$/;
/** Werte, die YAML als bool/null deuten wuerde: immer quotieren. */
const AMBIGUOUS_PLAIN = new Set([
  'true',
  'false',
  'null',
  'yes',
  'no',
  'on',
  'off',
  '~',
  'True',
  'False',
  'Null',
  'Yes',
  'No',
  'On',
  'Off',
  'TRUE',
  'FALSE',
  'NULL',
  'YES',
  'NO',
  'ON',
  'OFF',
]);
const NUMBER_PATTERN = /^-?(0|[1-9]\d*)(\.\d+)?$/;
const JSON_STRING_PREFIX = /^"(?:[^"\\]|\\.)*"/;
const SINGLE_QUOTED_PREFIX = /^'((?:[^']|'')*)'/;

function isPlainSafe(value: string): boolean {
  return (
    PLAIN_SAFE_PATTERN.test(value) && !AMBIGUOUS_PLAIN.has(value) && !NUMBER_PATTERN.test(value)
  );
}

/** Serialisiert einen einzelnen String-Wert (plain nur wenn eindeutig sicher). */
function serializeString(value: string): string {
  return isPlainSafe(value) ? value : JSON.stringify(value);
}

function serializeValue(value: FrontMatterValue): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Front-Matter: nur endliche Zahlen sind erlaubt.');
    }
    return String(value);
  }
  if (typeof value === 'string') {
    return serializeString(value);
  }
  return `[${value.map((item) => serializeString(item)).join(', ')}]`;
}

/** Normalisiert einen Body: nur `\n`-Zeilenenden, genau ein Newline am Ende. */
export function normalizeBody(body: string): string {
  const unified = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return `${unified.replace(/\n+$/, '')}\n`;
}

/**
 * Serialisiert Metadaten und Body zu einer vollstaendigen Markdown-Datei mit
 * YAML-Front-Matter. Wirft bei internem Fehlgebrauch (ungueltiger Schluessel),
 * das ist ein Programmierfehler, kein erwartbarer Laufzeitzustand.
 */
export function serializeFrontMatter(meta: FlatFrontMatter, body: string): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(meta)) {
    if (!KEY_PATTERN.test(key)) {
      throw new Error(`Front-Matter: ungueltiger Schluessel "${key}".`);
    }
    lines.push(`${key}: ${serializeValue(value)}`);
  }
  lines.push('---', '');
  return lines.join('\n') + normalizeBody(body);
}

/** Entfernt einen ` # Kommentar`-Anhang von einem Plain-Wert. */
function stripComment(value: string): string {
  const index = value.search(/\s#/);
  return (index === -1 ? value : value.slice(0, index)).trim();
}

function parseSingleQuoted(raw: string): Result<{ value: string; rest: string }, string> {
  const match = SINGLE_QUOTED_PREFIX.exec(raw);
  if (match === null || match[1] === undefined) {
    return err('Ungültiger einfach quotierter String.');
  }
  return ok({ value: match[1].replaceAll("''", "'"), rest: raw.slice(match[0].length) });
}

function parseJsonQuoted(raw: string): Result<{ value: string; rest: string }, string> {
  const match = JSON_STRING_PREFIX.exec(raw);
  if (match === null) {
    return err('Ungültiger doppelt quotierter String.');
  }
  try {
    const parsed: unknown = JSON.parse(match[0]);
    if (typeof parsed !== 'string') {
      return err('Ungültiger doppelt quotierter String.');
    }
    return ok({ value: parsed, rest: raw.slice(match[0].length) });
  } catch {
    return err('Ungültiger doppelt quotierter String.');
  }
}

/** Prueft, dass nach einem Wert nur Whitespace oder ein Kommentar folgt. */
function isCleanRest(rest: string): boolean {
  const trimmed = rest.trim();
  return trimmed.length === 0 || trimmed.startsWith('#');
}

function parseScalar(raw: string): Result<string | number, string> {
  if (raw.startsWith('"')) {
    const parsed = parseJsonQuoted(raw);
    if (!parsed.ok) {
      return parsed;
    }
    if (!isCleanRest(parsed.value.rest)) {
      return err('Unerwarteter Inhalt nach quotiertem Wert.');
    }
    return ok(parsed.value.value);
  }
  if (raw.startsWith("'")) {
    const parsed = parseSingleQuoted(raw);
    if (!parsed.ok) {
      return parsed;
    }
    if (!isCleanRest(parsed.value.rest)) {
      return err('Unerwarteter Inhalt nach quotiertem Wert.');
    }
    return ok(parsed.value.value);
  }
  const plain = stripComment(raw);
  if (plain.includes('[') || plain.includes(']') || plain.includes('{') || plain.includes('}')) {
    return err('Verschachtelte Strukturen sind im Front-Matter nicht erlaubt.');
  }
  if (NUMBER_PATTERN.test(plain)) {
    return ok(Number(plain));
  }
  return ok(plain);
}

/** Parst eine Flow-Sequenz `[a, "b", 'c']` zu einem String-Array. */
function parseFlowArray(raw: string): Result<readonly string[], string> {
  const closing = raw.lastIndexOf(']');
  if (closing === -1 || !isCleanRest(raw.slice(closing + 1))) {
    return err('Ungültige Liste im Front-Matter (fehlende schließende Klammer).');
  }
  const inner = raw.slice(1, closing).trim();
  if (inner.length === 0) {
    return ok([]);
  }
  const items: string[] = [];
  let rest = inner;
  for (;;) {
    rest = rest.trimStart();
    let item: string;
    if (rest.startsWith('"')) {
      const parsed = parseJsonQuoted(rest);
      if (!parsed.ok) {
        return parsed;
      }
      item = parsed.value.value;
      rest = parsed.value.rest.trimStart();
    } else if (rest.startsWith("'")) {
      const parsed = parseSingleQuoted(rest);
      if (!parsed.ok) {
        return parsed;
      }
      item = parsed.value.value;
      rest = parsed.value.rest.trimStart();
    } else {
      const comma = rest.indexOf(',');
      const rawItem = (comma === -1 ? rest : rest.slice(0, comma)).trim();
      if (rawItem.includes('[') || rawItem.includes(']')) {
        return err('Verschachtelte Listen sind im Front-Matter nicht erlaubt.');
      }
      item = rawItem;
      rest = comma === -1 ? '' : rest.slice(comma);
    }
    items.push(item);
    if (rest.length === 0) {
      break;
    }
    if (!rest.startsWith(',')) {
      return err('Ungültige Liste im Front-Matter (Komma erwartet).');
    }
    rest = rest.slice(1);
    if (rest.trim().length === 0) {
      // Trailing Comma tolerieren.
      break;
    }
  }
  return ok(items);
}

/**
 * Parst eine Markdown-Datei mit YAML-Front-Matter (flaches Schema). Liefert
 * ein Fehler-Result bei fehlendem/kaputtem Front-Matter, doppelten
 * Schluesseln oder nicht-flachen Werten. Der Aufrufer entscheidet dann
 * (z. B. Datei beim Manifest-Rebuild ueberspringen und loggen).
 */
export function parseFrontMatter(content: string): Result<ParsedFrontMatter, string> {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return err('Kein YAML-Front-Matter am Dateianfang gefunden.');
  }
  const lines = normalized.split('\n');
  let endIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '---') {
      endIndex = index;
      break;
    }
  }
  if (endIndex === -1) {
    return err('Front-Matter ist nicht abgeschlossen (schließendes --- fehlt).');
  }

  const meta: Record<string, string | number | readonly string[]> = {};
  for (let index = 1; index < endIndex; index += 1) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }
    const match = KEY_VALUE_LINE.exec(line);
    const key = match?.[1];
    const rawValue = match?.[2];
    if (match === null || key === undefined || rawValue === undefined) {
      return err(`Ungültige Front-Matter-Zeile ${String(index + 1)}.`);
    }
    if (Object.hasOwn(meta, key)) {
      return err(`Doppelter Front-Matter-Schlüssel "${key}".`);
    }
    const value = rawValue.trim();
    if (value.length === 0) {
      return err(`Front-Matter-Schlüssel "${key}" hat keinen Wert.`);
    }
    if (value.startsWith('[')) {
      const parsed = parseFlowArray(value);
      if (!parsed.ok) {
        return err(`Schlüssel "${key}": ${parsed.error}`);
      }
      meta[key] = parsed.value;
    } else {
      const parsed = parseScalar(value);
      if (!parsed.ok) {
        return err(`Schlüssel "${key}": ${parsed.error}`);
      }
      meta[key] = parsed.value;
    }
  }

  const body = lines.slice(endIndex + 1).join('\n');
  // Genau eine fuehrende Leerzeile (vom Serializer) entfernen.
  const cleanedBody = body.startsWith('\n') ? body.slice(1) : body;
  return ok({ meta, body: cleanedBody });
}

/** Vorschau fuer das Manifest: erste ~160 Zeichen des Bodys, eine Zeile. */
export const PREVIEW_MAX_CHARS = 160;

export function buildPreview(body: string): string {
  const singleLine = body.replace(/\s+/g, ' ').trim();
  const codePoints = Array.from(singleLine);
  if (codePoints.length <= PREVIEW_MAX_CHARS) {
    return singleLine;
  }
  return `${codePoints.slice(0, PREVIEW_MAX_CHARS).join('').trimEnd()} ...`;
}

/** Wortzahl eines Bodys (Whitespace-getrennte Tokens). */
export function countWords(body: string): number {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}
