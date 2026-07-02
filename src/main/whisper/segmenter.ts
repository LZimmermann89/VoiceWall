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
 * VAD-Schleuse plus Transkription. Findet der VAD keine Sprache, wird nicht
 * transkribiert und hadSpeech=false zurueckgegeben (kein Halluzinationstext).
 */
export async function transcribeWithVadGate(
  whisper: WhisperContext,
  vad: WhisperVadContext,
  pcm: ArrayBuffer,
  tuning: VadTuning,
): Promise<SegmentOutcome> {
  const audioMs = (pcm.byteLength / 2 / TARGET_SAMPLE_RATE) * 1000;
  const speechSegments = await detectSpeech(vad, pcm, tuning);
  if (speechSegments.length === 0) {
    return { speechSegments, hadSpeech: false, text: '', durationMs: 0, audioMs };
  }
  const started = Date.now();
  const { promise } = whisper.transcribeData(pcm, { language: 'de', temperature: 0 });
  const result = await promise;
  const durationMs = Date.now() - started;
  // Nur den primitiven Text uebernehmen, nie das Napi-Ergebnisobjekt.
  return { speechSegments, hadSpeech: true, text: result.result.trim(), durationMs, audioMs };
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
