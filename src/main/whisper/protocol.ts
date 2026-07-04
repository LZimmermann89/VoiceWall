/**
 * Getypte Nachrichten zwischen Main-Prozess und Whisper-utilityProcess.
 *
 * Regeln aus dem M1-Spike:
 * - PCM wandert ausschliesslich als ArrayBuffer (transferable), nie als Napi-
 *   Objekt. Napi-Rueckgaben werden im Worker in primitive Felder kopiert,
 *   bevor sie hier ueber die Prozessgrenze gehen (SIGTRAP-Falle vermieden).
 * - Beide Seiten validieren eingehende Steuernachrichten mit zod. Der rohe
 *   PCM-ArrayBuffer wird per instanceof geprueft, sein Inhalt nicht.
 */
import { z } from 'zod';

const arrayBufferSchema = z.instanceof(ArrayBuffer);

/** Nachrichten Main -> Worker. */
export const workerCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    whisperModelPath: z.string().min(1),
    sileroModelPath: z.string().min(1),
    useGpu: z.boolean(),
    /** VAD-/Endpointing-Parameter, gegen Halluzination getunt. */
    minSpeechDurationMs: z.number().int().positive(),
    minSilenceDurationMs: z.number().int().positive(),
    maxSpeechDurationS: z.number().positive(),
    vadThreshold: z.number().min(0).max(1),
    /**
     * Sprache der Oberflaeche (Paket B3): der Worker waehlt damit seine
     * wenigen nutzersichtbaren Fehlertexte aus dem geteilten Katalog.
     * Optional mit Default 'de' (kompatibles Wire-Protokoll).
     */
    uiLanguage: z.enum(['de', 'en']).optional(),
  }),
  /** Kontinuierlicher Aufnahmemodus: PCM-Chunk anhaengen. */
  z.object({ type: z.literal('audio-chunk'), pcm: arrayBufferSchema }),
  /**
   * Laufendes, akkumuliertes Segment jetzt verarbeiten (z. B. bei Stop).
   * Mit requestId antwortet der Worker nach Abschluss zusaetzlich mit
   * `flush-done` (auch wenn nichts zu verarbeiten war), damit der Aufrufer
   * deterministisch auf das letzte Segment warten kann (Hotkey-Stop, M3).
   */
  z.object({ type: z.literal('flush'), requestId: z.string().optional() }),
  /** Akkumuliertes Segment ohne Transkription verwerfen. */
  z.object({ type: z.literal('reset') }),
  /**
   * Diktat-Kontext fuer alle folgenden Transkriptionen setzen (Stufe 1 plus
   * Paket B1): `language` ist die feste Diktatsprache der aktiven Firma
   * (das passende Modell laedt der EngineManager; ein Modellwechsel ist ein
   * Engine-Neustart), `prompt` der Initial-Prompt des Fach-Woerterbuchs
   * (kommaseparierte Begriffsliste, im Main-Prozess bereits hart gekappt;
   * null loescht den Prompt). WICHTIG: Der VAD-Gate-Pfad (hadSpeech) bleibt
   * davon unberuehrt; bei Stille wird gar nicht erst transkribiert, ein
   * gesetzter Prompt kann also keine Halluzination bei Stille ausloesen
   * (Integrationstest vokabular-whisper.test.ts).
   */
  z.object({
    type: z.literal('set-context'),
    language: z.enum(['de', 'en']),
    prompt: z.string().max(2000).nullable(),
    /** Sprache der Oberflaeche (Paket B3), reist mit jedem Kontext mit. */
    uiLanguage: z.enum(['de', 'en']).optional(),
  }),
  /**
   * Einmal-Transkription eines vollstaendigen PCM-Segments. Genutzt vom
   * Dev-/Test-Injektionskanal: geht durch dieselbe VAD-Schleuse wie echtes
   * Audio (Stille erzeugt keinen Text), umgeht aber das Endpointing.
   */
  z.object({ type: z.literal('segment'), pcm: arrayBufferSchema, requestId: z.string() }),
  z.object({ type: z.literal('shutdown') }),
]);

export type WorkerCommand = z.infer<typeof workerCommandSchema>;

/** Nachrichten Worker -> Main. */
export const workerEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('init-error'), message: z.string() }),
  z.object({
    type: z.literal('transcript'),
    text: z.string(),
    /** Reine Transkriptionsdauer in ms (Latenzbeleg). */
    durationMs: z.number(),
    /** Dauer des verarbeiteten Audios in ms. */
    audioMs: z.number(),
    requestId: z.string().optional(),
  }),
  /** VAD hat keine Sprache gefunden: bewusst kein Text (Anti-Halluzination). */
  z.object({ type: z.literal('silence'), requestId: z.string().optional() }),
  /** Antwort auf `flush` mit requestId: letztes Segment ist verarbeitet. */
  z.object({ type: z.literal('flush-done'), requestId: z.string() }),
  z.object({
    type: z.literal('transcribe-error'),
    message: z.string(),
    requestId: z.string().optional(),
  }),
  /** Weitergeleitete native Logzeile (whisper.cpp/ggml). */
  z.object({ type: z.literal('log'), level: z.string(), text: z.string() }),
]);

export type WorkerEvent = z.infer<typeof workerEventSchema>;
