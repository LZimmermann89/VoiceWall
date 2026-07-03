/**
 * Schleuse fuer native whisper.cpp-/ggml-Logausgaben (M4-Pflicht-Befund).
 *
 * Problem: Der Whisper-utilityProcess leitet native stdout-/stderr-Zeilen und
 * Log-Callbacks an den Main-Prozess weiter. whisper.cpp kann in Randfaellen
 * (Timestamps-/Segment-Ausgabe, Debug-Modi, kuenftige Versionen) Segment-
 * oder Token-TEXT in Logzeilen schreiben. Die Messlatte aus ABARBEITUNG 3.6
 * ist hart: auch debug protokolliert NIEMALS Transkriptinhalte. Ein
 * ungefiltertes `logger.debug(nativeZeile)` verletzt das.
 *
 * Entscheidung (dokumentiert):
 * - PERSISTIERT wird eine native Zeile nur, wenn sie einer Allowlist bekannt
 *   unkritischer Muster entspricht (Modell-Load-, Backend-, Timing- und
 *   ggml-Diagnosezeilen; sie beginnen stets mit festen technischen Praefixen
 *   und enthalten nie Transkripttext). Zusaetzliche Negativsperre: Zeilen mit
 *   Segment-Timestamp-Syntax (`-->`) oder eckigen Zeitklammern werden nie
 *   persistiert, selbst wenn ein Praefix passt.
 * - Alle uebrigen Zeilen bleiben ausschliesslich in einem begrenzten
 *   RAM-Ringpuffer (Fehlerdiagnose vor Ort, z. B. per Debugger). Sie werden
 *   nie auf Platte geschrieben; bei einem Engine-Absturz wird nur ihre
 *   ANZAHL geloggt, nie ihr Inhalt.
 *
 * Beides zusammen ist unit-getestet (tests/unit/native-log.test.ts): eine
 * praeparierte Zeile mit Diktattext erreicht die Logdatei nachweislich nicht.
 */
import type { Logger } from '../log/logger';

/**
 * Bekannt unkritische Praefixe nativer whisper.cpp-/ggml-Zeilen. Bewusst eng:
 * Modell-Load, Backend-/Geraete-Info, KV-Cache, Timings, VAD-Initialisierung.
 * Freie Textzeilen (Segmente, Tokens) beginnen nie mit diesen Praefixen.
 */
const SAFE_LINE_PREFIXES: readonly string[] = [
  'whisper_',
  'ggml_',
  'ggml-',
  'system_info',
  'vad_',
  'silero_',
  'load time',
  'main:',
  'GGML_',
  'Metal ',
];

/** Segment-/Timestamp-Syntax: solche Zeilen tragen potenziell Transkripttext. */
const SEGMENT_MARKERS = /-->|\[\d{2}:\d{2}/;

/**
 * True nur fuer Zeilen, die nach der Allowlist sicher persistierbar sind.
 * Im Zweifel false (Zeile bleibt RAM-only).
 */
export function isSafeNativeLogLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (SEGMENT_MARKERS.test(trimmed)) {
    return false;
  }
  return SAFE_LINE_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

/**
 * Begrenzter RAM-Ringpuffer fuer nicht persistierbare native Zeilen. Haelt
 * die letzten `capacity` Zeilen fuer die Vor-Ort-Fehlerdiagnose im Speicher;
 * der Inhalt verlaesst den RAM nie (kein Schreiben, kein Netz).
 */
export class NativeLogRingBuffer {
  private readonly lines: string[] = [];
  private droppedCount = 0;

  constructor(private readonly capacity: number = 200) {}

  push(line: string): void {
    this.lines.push(line);
    if (this.lines.length > this.capacity) {
      this.lines.shift();
      this.droppedCount += 1;
    }
  }

  /** Anzahl aktuell gehaltener Zeilen (fuer Diagnose-Metadaten). */
  get size(): number {
    return this.lines.length;
  }

  /** Anzahl wegen Kapazitaet verworfener Zeilen. */
  get dropped(): number {
    return this.droppedCount;
  }

  /**
   * RAM-Schnappschuss fuer die interaktive Fehlersuche (Debugger/DevTools).
   * NIEMALS in Logdateien oder Dateien schreiben.
   */
  snapshot(): readonly string[] {
    return [...this.lines];
  }

  clear(): void {
    this.lines.length = 0;
    this.droppedCount = 0;
  }
}

/**
 * Verteilt einen rohen nativen Output-Block zeilenweise: Allowlist-Treffer
 * gehen redigiert-sicher ins Debug-Log, alles andere nur in den RAM-Puffer.
 */
export function routeNativeOutput(
  logger: Logger,
  buffer: NativeLogRingBuffer,
  source: string,
  raw: string,
): void {
  for (const line of raw.split('\n')) {
    const trimmed = line.trimEnd();
    if (trimmed.trim().length === 0) {
      continue;
    }
    if (isSafeNativeLogLine(trimmed)) {
      logger.debug('whisper-native', { source, line: trimmed });
    } else {
      buffer.push(trimmed);
    }
  }
}
