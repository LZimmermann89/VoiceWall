/**
 * Gehaerteter, rein lokaler Logger (ABARBEITUNG 3.6). Niemals Telemetrie,
 * kein Netzwerkversand: die Logs verlassen den Rechner nie.
 *
 * Haertung in M4:
 * - Strukturierte JSON-Lines statt Freitext: jede Zeile ist ein Objekt mit
 *   ts/level/event und optionalen, REDIGIERTEN Metadaten. Der Logger nimmt
 *   Ereignistext plus Metadaten-Objekt entgegen, niemals Nutzerinhalte.
 * - Zentrale Redaction als Default: Metadaten passieren eine Allowlist
 *   explizit freigegebener Feldnamen. Sensible Felder (Transkript, Audio,
 *   Zwischenablage, Firmenname-Freitext, ...) werden IMMER redigiert, auch
 *   auf debug-Level und auch, wenn jemand sie versehentlich in die Allowlist
 *   eintragen wuerde (doppeltes Gate, unit-getestet).
 * - Groessenbasierte Rotation: maximal 5 Dateien a 1 MB (betrieb.log,
 *   betrieb.log.1 ... betrieb.log.4), aeltere werden geloescht. Kein
 *   unbegrenztes Wachstum.
 * - Restriktive Rechte: Log-Ordner 0700, Log-Dateien 0600 (auf POSIX;
 *   Windows-ACLs sind per userData-Profilordner ohnehin nutzerprivat).
 * - Zwei Log-Streams laut Konzept: 'betrieb' (dieser, ab M4) und 'setup'
 *   (Installations-/Setup-Log, dockt in M6 ueber denselben createLogger an).
 *
 * Native whisper.cpp-Ausgaben werden hier NICHT ungefiltert angenommen;
 * dafuer existiert die Allowlist-Schleuse in whisper/native-log.ts.
 */
import { appendFileSync, chmodSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Erlaubte Metadaten-Werte: nur Primitive, nie Objekte/Buffer. */
export type LogMetaValue = string | number | boolean | null;
export type LogMeta = Readonly<Record<string, LogMetaValue>>;

export interface Logger {
  debug(event: string, meta?: LogMeta): void;
  info(event: string, meta?: LogMeta): void;
  warn(event: string, meta?: LogMeta): void;
  error(event: string, meta?: LogMeta): void;
}

export type LogStream = 'betrieb' | 'setup';

export interface LoggerOptions {
  /** Log-Stream (Dateiname). Default: Betriebslog. */
  readonly stream?: LogStream;
  /** Maximale Groesse einer Logdatei in Bytes (Default 1 MB). */
  readonly maxFileBytes?: number;
  /** Maximale Anzahl Dateien inkl. aktiver Datei (Default 5). */
  readonly maxFiles?: number;
}

export const DEFAULT_MAX_LOG_FILE_BYTES = 1_000_000;
export const DEFAULT_MAX_LOG_FILES = 5;

/**
 * Allowlist der Metadaten-Felder, die eine Logzeile erreichen duerfen.
 * Alles andere wird redigiert. Neue Felder werden hier BEWUSST freigegeben
 * (Review-Pflicht), nie implizit.
 */
const ALLOWED_META_KEYS: ReadonlySet<string> = new Set([
  'chars',
  'durationMs',
  'audioMs',
  'count',
  'code',
  'attempt',
  'maxAttempts',
  'percent',
  'receivedBytes',
  'totalBytes',
  'level',
  'outcome',
  'reason',
  'accelerator',
  'state',
  'from',
  'to',
  'stream',
  'platform',
  'version',
  'modelId',
  'fileName',
  'suppressedLines',
  'source',
  'line',
]);

/**
 * Feldnamen, die NIEMALS eine Logzeile erreichen, unabhaengig von der
 * Allowlist (zweites Gate). Vergleich case-insensitiv als Substring bzw.
 * Exakttreffer. Deckt die sensiblen Klassen aus ABARBEITUNG 3.6 ab:
 * Transkripttext, Rohaudio, Zwischenablage, Firmen-Freitext, Suchbegriffe.
 */
const FORBIDDEN_META_SUBSTRINGS: readonly string[] = [
  'transcript',
  'transkript',
  'clipboard',
  'zwischenablage',
  'firmenname',
  'companyname',
  'freitext',
  'suchbegriff',
  'search',
];
const FORBIDDEN_META_KEYS: ReadonlySet<string> = new Set([
  'text',
  'audio',
  'pcm',
  'content',
  'inhalt',
  'firma',
  'company',
  'query',
]);

const REDACTED = '[redigiert]';
const MAX_STRING_VALUE_LENGTH = 300;
const MAX_EVENT_LENGTH = 600;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

function isForbiddenKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (FORBIDDEN_META_KEYS.has(lower)) {
    return true;
  }
  return FORBIDDEN_META_SUBSTRINGS.some((fragment) => lower.includes(fragment));
}

function sanitizeString(value: string, maxLength: number): string {
  const cleaned = value.replace(CONTROL_CHARS, ' ');
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned;
}

/**
 * Zentrale Redaction: laesst nur explizit freigegebene, nicht-verbotene
 * Felder mit primitiven Werten durch; alles andere wird durch einen
 * Redaction-Marker ersetzt (das Feld bleibt sichtbar, der Wert nie).
 */
export function redactMeta(meta: LogMeta): Record<string, LogMetaValue> {
  const result: Record<string, LogMetaValue> = {};
  // Werte bewusst als unknown behandeln: zur Laufzeit koennen (an der
  // Typpruefung vorbei) auch Objekte ankommen; die werden redigiert.
  const entries: readonly [string, unknown][] = Object.entries(meta);
  for (const [key, value] of entries) {
    const safeKey = sanitizeString(key, 64);
    if (isForbiddenKey(key) || !ALLOWED_META_KEYS.has(key)) {
      result[safeKey] = REDACTED;
      continue;
    }
    if (typeof value === 'string') {
      result[safeKey] = sanitizeString(value, MAX_STRING_VALUE_LENGTH);
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      result[safeKey] = value;
    } else {
      result[safeKey] = REDACTED;
    }
  }
  return result;
}

/** Pfad des Log-Ordners unter userData. */
export function logDirectoryPath(userDataPath: string): string {
  return join(userDataPath, 'logs');
}

/** Pfad der aktiven Logdatei eines Streams. */
export function logFilePath(userDataPath: string, stream: LogStream = 'betrieb'): string {
  return join(logDirectoryPath(userDataPath), `${stream}.log`);
}

/**
 * Erstellt einen dateibasierten Logger mit Rotation, Rechten und Redaction.
 * `debug` wird nur in die Datei geschrieben, ab `info` zusaetzlich auf die
 * Konsole. Ein fehlgeschlagener Log-Schreibvorgang stoppt die App nie.
 */
export function createLogger(userDataPath: string, options: LoggerOptions = {}): Logger {
  const stream = options.stream ?? 'betrieb';
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_LOG_FILE_BYTES;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_LOG_FILES;
  const logDir = logDirectoryPath(userDataPath);
  const logFile = logFilePath(userDataPath, stream);

  try {
    mkdirSync(logDir, { recursive: true, mode: 0o700 });
    // `mode` greift nur beim Anlegen; bestehende Ordner explizit haerten.
    chmodSync(logDir, 0o700);
  } catch {
    // Kein Log-Ordner: Konsole funktioniert weiter, Datei-Writes scheitern leise.
  }

  const rotateIfNeeded = (nextLineBytes: number): void => {
    let currentSize: number;
    try {
      currentSize = statSync(logFile).size;
    } catch {
      return; // Datei existiert noch nicht: nichts zu rotieren.
    }
    if (currentSize + nextLineBytes <= maxFileBytes) {
      return;
    }
    // Aelteste Datei loeschen, Kette verschieben: .3 -> .4, ..., base -> .1
    try {
      rmSync(`${logFile}.${String(maxFiles - 1)}`, { force: true });
      for (let index = maxFiles - 2; index >= 1; index -= 1) {
        try {
          renameSync(`${logFile}.${String(index)}`, `${logFile}.${String(index + 1)}`);
        } catch {
          // Luecke in der Kette ist unkritisch.
        }
      }
      renameSync(logFile, `${logFile}.1`);
    } catch {
      // Rotation darf das Logging nie stoppen.
    }
  };

  const write = (level: LogLevel, event: string, meta?: LogMeta): void => {
    const entry: Record<string, LogMetaValue> = {
      ts: new Date().toISOString(),
      level,
      event: sanitizeString(event, MAX_EVENT_LENGTH),
      ...(meta === undefined ? {} : redactMeta(meta)),
    };
    const line = `${JSON.stringify(entry)}\n`;
    try {
      rotateIfNeeded(Buffer.byteLength(line));
      appendFileSync(logFile, line, { mode: 0o600 });
      // `mode` greift nur beim Anlegen; bestehende Dateien explizit haerten.
      chmodSync(logFile, 0o600);
    } catch {
      // Ein fehlgeschlagener Log-Schreibvorgang darf die App nie stoppen.
    }
    if (level !== 'debug') {
      const target =
        level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      target(`[VoiceWall] ${entry['event'] as string}`);
    }
  };

  return {
    debug: (event, meta) => {
      write('debug', event, meta);
    },
    info: (event, meta) => {
      write('info', event, meta);
    },
    warn: (event, meta) => {
      write('warn', event, meta);
    },
    error: (event, meta) => {
      write('error', event, meta);
    },
  };
}
