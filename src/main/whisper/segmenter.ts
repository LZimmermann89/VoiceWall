/**
 * Kernlogik der Sprachsegmentierung und Transkription, entkoppelt vom
 * Prozessmodell. Sowohl der utilityProcess-Worker als auch der lokale
 * Integrationstest nutzen genau diese Funktionen; nur das Prozessdrumherum
 * (utilityProcess vs. direkter Node-Aufruf) unterscheidet sich.
 *
 * Die harte Anti-Halluzinations-Regel lebt hier: transkribiert wird nur, wenn
 * der Silero-VAD Sprache erkennt. Stille/Geraeusch liefert bewusst keinen Text.
 */
import type {
  VadOptions,
  VadSegment,
  WhisperContext,
  WhisperVadContext,
} from '@fugood/whisper.node';
import { TARGET_SAMPLE_RATE } from '../../shared/pcm';
import type { DictationLanguage } from '../../shared/schema';

/**
 * Kontext einer Transkription: Diktatsprache (fest uebergeben,
 * keine automatische Spracherkennung; Default 'de') und optionaler
 * Initial-Prompt aus dem Fach-Woerterbuch (Stufe 1).
 */
export interface TranscriptionContext {
  readonly language?: DictationLanguage;
  readonly prompt?: string;
}

export interface VadTuning {
  readonly threshold: number;
  readonly minSpeechDurationMs: number;
  readonly minSilenceDurationMs: number;
  readonly maxSpeechDurationS: number;
}

export interface SegmentOutcome {
  /** Erkannte VAD-Segmente (t0/t1 in Centisekunden). */
  readonly speechSegments: VadSegment[];
  /** True, wenn Sprache erkannt und transkribiert wurde. */
  readonly hadSpeech: boolean;
  /** Transkript (leer, wenn keine Sprache). */
  readonly text: string;
  /** Reine Transkriptionsdauer in ms. */
  readonly durationMs: number;
  /** Dauer des verarbeiteten Audios in ms. */
  readonly audioMs: number;
}

function toVadOptions(tuning: VadTuning): VadOptions {
  return {
    threshold: tuning.threshold,
    minSpeechDurationMs: tuning.minSpeechDurationMs,
    minSilenceDurationMs: tuning.minSilenceDurationMs,
    maxSpeechDurationS: tuning.maxSpeechDurationS,
  };
}

/** Fuehrt die reine VAD-Erkennung aus (ohne Transkription). */
export async function detectSpeech(
  vad: WhisperVadContext,
  pcm: ArrayBuffer,
  tuning: VadTuning,
): Promise<VadSegment[]> {
  return vad.detectSpeechData(pcm, toVadOptions(tuning));
}

/**
 * Transkribiert einen bereits als Sprache erkannten PCM-Bereich. Diese Funktion
 * ist die EINZIGE Stelle im Code, die transcribeData aufruft: sowohl die
 * VAD-Schleuse (transcribeWithVadGate) als auch der kontinuierliche Worker-Pfad
 * gehen hier durch. So gibt es nur eine Optionskonstruktion und keine zwei
 * Pfade, die auseinanderlaufen koennen.
 *
 * Der Puffer wird bewusst NICHT auf den Sprachbereich zugeschnitten. Ein
 * VAD-basierter Zuschnitt der Rand-Stille wurde gemessen (WER-Messstand,
 * npm run wer) und verwarf sich selbst: Er verschlechterte die WER (0.105 gegen
 * 0.085) und war nicht schneller. whisper.cpp verarbeitet die Stille selbst gut,
 * ein Zuschnitt riskiert nur Wortraender. Deshalb geht der volle Puffer an das
 * Modell.
 */
export async function transcribeSpeech(
  whisper: WhisperContext,
  pcm: ArrayBuffer,
  context?: TranscriptionContext,
): Promise<{ text: string; durationMs: number }> {
  const prompt = context?.prompt;
  const started = Date.now();
  const { promise } = whisper.transcribeData(pcm, {
    language: context?.language ?? 'de',
    temperature: 0,
    ...(prompt === undefined || prompt.length === 0 ? {} : { prompt }),
  });
  const result = await promise;
  const durationMs = Date.now() - started;
  // Nur den primitiven Text uebernehmen, nie das Napi-Ergebnisobjekt.
  return { text: result.result.trim(), durationMs };
}

/**
 * VAD-Schleuse plus Transkription. Findet der VAD keine Sprache, wird nicht
 * transkribiert und hadSpeech=false zurueckgegeben (kein Halluzinationstext).
 *
 * `context` traegt die Diktatsprache (fest, Default 'de') und den optionalen
 * Initial-Prompt aus dem Fach-Woerterbuch (Stufe 1). Beides wird NUR an
 * transcribeData gereicht, NIE an den VAD: die Anti-Halluzinations-Schleuse
 * entscheidet vor und unabhaengig davon, Stille erzeugt auch mit gesetztem
 * Prompt keinen Text.
 */
export async function transcribeWithVadGate(
  whisper: WhisperContext,
  vad: WhisperVadContext,
  pcm: ArrayBuffer,
  tuning: VadTuning,
  context?: TranscriptionContext,
): Promise<SegmentOutcome> {
  const audioMs = (pcm.byteLength / 2 / TARGET_SAMPLE_RATE) * 1000;
  const speechSegments = await detectSpeech(vad, pcm, tuning);
  if (speechSegments.length === 0) {
    return { speechSegments, hadSpeech: false, text: '', durationMs: 0, audioMs };
  }
  const { text, durationMs } = await transcribeSpeech(whisper, pcm, context);
  return { speechSegments, hadSpeech: true, text, durationMs, audioMs };
}

/**
 * Entscheidet im kontinuierlichen Modus, ob der akkumulierte Bereich ein
 * abgeschlossenes Sprachsegment enthaelt (Sprache gefolgt von genuegend
 * Stille) oder ob die Maximallaenge ein Schneiden erzwingt.
 */
export function isEndpointReached(
  totalDurationSec: number,
  speechSegments: readonly VadSegment[],
  tuning: VadTuning,
): { endpoint: boolean; enoughSpeech: boolean } {
  if (speechSegments.length === 0) {
    return { endpoint: false, enoughSpeech: false };
  }
  let lastEndSec = 0;
  let speechSec = 0;
  for (const segment of speechSegments) {
    lastEndSec = Math.max(lastEndSec, segment.t1 / 100);
    speechSec += (segment.t1 - segment.t0) / 100;
  }
  const trailingSilenceMs = (totalDurationSec - lastEndSec) * 1000;
  const forceByMaxLength = totalDurationSec >= tuning.maxSpeechDurationS;
  const endpoint = trailingSilenceMs >= tuning.minSilenceDurationMs || forceByMaxLength;
  const enoughSpeech = speechSec * 1000 >= tuning.minSpeechDurationMs;
  return { endpoint, enoughSpeech };
}
