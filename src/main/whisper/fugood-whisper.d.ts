/**
 * Eigene, praezise Typdeklaration fuer @fugood/whisper.node@1.0.22.
 *
 * Grund (aus dem M1-Spike belegt): Das npm-Paket verweist im `types`-Feld auf
 * `lib/index.d.ts`, diese Datei fehlt aber im publizierten Tarball. Ohne eine
 * eigene Deklaration waere jeder Zugriff `any` und wuerde die harte
 * no-explicit-any-/no-unsafe-Regel verletzen. Deklariert sind ausschliesslich
 * die tatsaechlich genutzten APIs, verifiziert an `lib/binding.ts` des
 * installierten Pakets.
 *
 * Wichtige, im Spike bestaetigte Fakten:
 * - Optionen sind camelCase (`language`, `temperature`, `beamSize`, ...).
 * - Es gibt KEIN `no_timestamps`.
 * - `transcribeData` erwartet 16-bit-signed-PCM als ArrayBuffer, 16 kHz mono.
 * - VAD-Optionen: `threshold`, `minSpeechDurationMs`, `minSilenceDurationMs`,
 *   `maxSpeechDurationS`, `speechPadMs`.
 * - `getModelInfo()` liefert ein Napi-Objekt: NIEMALS serialisieren/clonen
 *   (SIGTRAP-Falle), daher hier bewusst nicht deklariert/genutzt.
 */
declare module '@fugood/whisper.node' {
  export interface NativeContextOptions {
    /** Absoluter Pfad zur GGML-Modelldatei. */
    filePath: string;
    /** GPU nutzen (macOS Metal). Auf Windows/Linux im Default CPU. */
    useGpu?: boolean;
    useFlashAttn?: boolean;
    /** Obergrenze der akzeptierten Modellgroesse in Bytes (Sanity-Check). */
    maxModelBytes?: number;
  }

  export interface NativeVadContextOptions {
    filePath: string;
    useGpu?: boolean;
    nThreads?: number;
    maxModelBytes?: number;
  }

  export interface TranscribeOptions {
    /** Fest 'de' vorgeben, nie Auto-Detect. */
    language?: string;
    translate?: boolean;
    maxThreads?: number;
    maxLen?: number;
    tokenTimestamps?: boolean;
    /** 0 fuer Diktat: weniger Halluzination, deterministischer. */
    temperature?: number;
    temperatureInc?: number;
    beamSize?: number;
    bestOf?: number;
    prompt?: string;
    onProgress?: (progress: number) => void;
  }

  export interface TranscribeResult {
    language?: string;
    /** Der zusammengesetzte Transkript-Text. */
    result: string;
    segments: Array<{ text: string; t0: number; t1: number }>;
    isAborted: boolean;
  }

  export interface VadOptions {
    /** Wahrscheinlichkeitsschwelle fuer Sprache (Default 0.5). */
    threshold?: number;
    /** Mindestdauer eines gueltigen Sprachsegments in ms (Default 250). */
    minSpeechDurationMs?: number;
    /** Stille-Dauer, ab der Sprache als beendet gilt, in ms (Default 100). */
    minSilenceDurationMs?: number;
    /** Maximale Segmentdauer, bevor zwangsweise geteilt wird, in Sekunden. */
    maxSpeechDurationS?: number;
    /** Polster vor/nach Sprachsegmenten in ms (Default 30). */
    speechPadMs?: number;
    samplesOverlap?: number;
  }

  /** Sprachsegment: t0/t1 in Centisekunden (1 cs = 10 ms). */
  export interface VadSegment {
    t0: number;
    t1: number;
  }

  export interface WhisperContext {
    transcribeData(
      audioData: ArrayBuffer,
      options?: TranscribeOptions,
    ): { stop: () => Promise<void>; promise: Promise<TranscribeResult> };
    release(): Promise<void>;
  }

  export interface WhisperVadContext {
    detectSpeechData(audioData: ArrayBuffer, options?: VadOptions): Promise<VadSegment[]>;
    release(): Promise<void>;
  }

  export function initWhisper(options: NativeContextOptions): Promise<WhisperContext>;
  export function initWhisperVad(options: NativeVadContextOptions): Promise<WhisperVadContext>;

  /** Native Logs (whisper.cpp/ggml) ein-/ausschalten. */
  export function toggleNativeLog(enable: boolean): Promise<void>;
  /** Listener fuer native Logzeilen registrieren. */
  export function addNativeLogListener(listener: (level: string, text: string) => void): {
    remove: () => void;
  };
}
