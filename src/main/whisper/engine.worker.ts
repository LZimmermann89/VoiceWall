/**
 * Whisper-Engine als Electron-utilityProcess-Entry.
 *
 * Verortung (aus M1-Spike verbindlich): Whisper und Silero-VAD laufen hier im
 * isolierten utilityProcess, nie im Main-Prozess und nie im Renderer. Ein
 * nativer Absturz reisst so nur dieses Kind mit, der Main-Prozess ueberlebt
 * und startet die Engine neu (siehe engine-manager.ts).
 *
 * Aufgaben:
 * - Modell und VAD einmalig laden, im RAM halten.
 * - Kontinuierlichen PCM-Strom akkumulieren und per Silero-VAD das Sprachende
 *   erkennen (Endpointing, siehe segmenter.ts). Abgeschlossene Segmente an
 *   transcribeData geben.
 * - Stille erzeugt keinen Text (Anti-Halluzination).
 * - Nach jedem verarbeiteten Segment das Roh-PCM aktiv nullen.
 *
 * Codier-Regel: von Napi-Rueckgaben werden nur primitive Felder (Text-String)
 * ueber die Prozessgrenze geschickt, nie das ganze Objekt.
 */
import {
  addNativeLogListener,
  initWhisper,
  initWhisperVad,
  toggleNativeLog,
  type WhisperContext,
  type WhisperVadContext,
} from '@fugood/whisper.node';
import { KATALOGE } from '../../shared/i18n';
import { TARGET_SAMPLE_RATE } from '../../shared/pcm';
import type { DictationLanguage, UiLanguage } from '../../shared/schema';
import { workerCommandSchema, type WorkerCommand, type WorkerEvent } from './protocol';
import {
  detectSpeech,
  isEndpointReached,
  transcribeWithVadGate,
  type VadTuning,
} from './segmenter';

// Electron stellt im utilityProcess `process.parentPort` bereit. Minimal und
// typsicher gekapselt, um kein `any` zu benoetigen.
interface ParentPortLike {
  on(event: 'message', listener: (messageEvent: { data: unknown }) => void): void;
  postMessage(message: WorkerEvent): void;
}
const parentPort = (process as unknown as { parentPort: ParentPortLike }).parentPort;

function send(event: WorkerEvent): void {
  parentPort.postMessage(event);
}

interface EngineState {
  whisper: WhisperContext;
  vad: WhisperVadContext;
  tuning: VadTuning;
}

let state: EngineState | null = null;

/**
 * Diktat-Kontext (Stufe 1 plus Paket B1), gesetzt per `set-context`:
 * Initial-Prompt aus dem Fach-Woerterbuch und feste Diktatsprache der
 * aktiven Firma. Beides beeinflusst NUR transcribeData; die VAD-Schleuse
 * (Anti-Halluzination) laeuft davor und unabhaengig davon. Das geladene
 * Modell passt der EngineManager zur Sprache an (Neustart bei Wechsel).
 */
let initialPrompt: string | null = null;
let dictationLanguage: DictationLanguage = 'de';

/**
 * Sprache der Oberflaeche (Paket B3): reist mit `init` und `set-context`
 * mit und waehlt die wenigen nutzersichtbaren Fehlertexte dieses Workers
 * aus dem geteilten Katalog. Default Deutsch.
 */
let uiLanguage: UiLanguage = 'de';

/** Akkumulierte PCM-Chunks des laufenden (noch offenen) Sprachbereichs. */
let pendingChunks: Int16Array[] = [];
let pendingSamples = 0;
/** Serialisiert die Verarbeitung, damit Segmente nicht ueberlappen. */
let processing: Promise<void> = Promise.resolve();

function pendingDurationSec(): number {
  return pendingSamples / TARGET_SAMPLE_RATE;
}

function collectPendingArrayBuffer(): ArrayBuffer {
  const combined = new Int16Array(pendingSamples);
  let offset = 0;
  for (const chunk of pendingChunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return combined.buffer;
}

/** Nullt die Pending-Chunks aktiv und setzt den Akkumulator zurueck. */
function clearPending(): void {
  for (const chunk of pendingChunks) {
    chunk.fill(0);
  }
  pendingChunks = [];
  pendingSamples = 0;
}

/** Verarbeitet ein vollstaendiges Segment (VAD-Schleuse + Transkription). */
async function processSegment(
  active: EngineState,
  pcm: ArrayBuffer,
  requestId?: string,
): Promise<void> {
  const outcome = await transcribeWithVadGate(active.whisper, active.vad, pcm, active.tuning, {
    language: dictationLanguage,
    ...(initialPrompt === null ? {} : { prompt: initialPrompt }),
  });
  if (!outcome.hadSpeech) {
    send(requestId === undefined ? { type: 'silence' } : { type: 'silence', requestId });
    return;
  }
  send({
    type: 'transcript',
    text: outcome.text,
    durationMs: outcome.durationMs,
    audioMs: outcome.audioMs,
    ...(requestId === undefined ? {} : { requestId }),
  });
}

/**
 * Endpointing im kontinuierlichen Modus: prueft per VAD, ob der akkumulierte
 * Bereich ein abgeschlossenes Sprachsegment enthaelt, und transkribiert ihn.
 */
async function tryEndpoint(active: EngineState): Promise<void> {
  if (pendingSamples === 0) {
    return;
  }
  const totalSec = pendingDurationSec();
  const minNeededSec =
    (active.tuning.minSpeechDurationMs + active.tuning.minSilenceDurationMs) / 1000;
  const forceByMaxLength = totalSec >= active.tuning.maxSpeechDurationS;
  if (totalSec < minNeededSec && !forceByMaxLength) {
    return;
  }

  const pcm = collectPendingArrayBuffer();
  const speechSegments = await detectSpeech(active.vad, pcm, active.tuning);
  if (speechSegments.length === 0) {
    // Nur Stille/Geraeusch. Bei Ueberlaenge verwerfen, kein Text.
    if (forceByMaxLength) {
      clearPending();
    }
    return;
  }

  const { endpoint, enoughSpeech } = isEndpointReached(totalSec, speechSegments, active.tuning);
  if ((!endpoint && !forceByMaxLength) || !enoughSpeech) {
    return;
  }

  const started = Date.now();
  const { promise } = active.whisper.transcribeData(pcm, {
    language: dictationLanguage,
    temperature: 0,
    ...(initialPrompt === null ? {} : { prompt: initialPrompt }),
  });
  const result = await promise;
  const durationMs = Date.now() - started;
  const text = result.result.trim();
  const audioMs = totalSec * 1000;
  clearPending();
  if (text.length > 0) {
    send({ type: 'transcript', text, durationMs, audioMs });
  } else {
    send({ type: 'silence' });
  }
}

function enqueue(task: () => Promise<void>): void {
  processing = processing.then(task).catch((error: unknown) => {
    send({
      type: 'transcribe-error',
      message: error instanceof Error ? error.message : String(error),
    });
  });
}

async function handleInit(command: Extract<WorkerCommand, { type: 'init' }>): Promise<void> {
  try {
    addNativeLogListener((level, text) => {
      send({ type: 'log', level, text });
    });
    await toggleNativeLog(true);

    const whisper = await initWhisper({
      filePath: command.whisperModelPath,
      useGpu: command.useGpu,
    });
    const vad = await initWhisperVad({
      filePath: command.sileroModelPath,
      useGpu: false,
      nThreads: 4,
    });
    state = {
      whisper,
      vad,
      tuning: {
        threshold: command.vadThreshold,
        minSpeechDurationMs: command.minSpeechDurationMs,
        minSilenceDurationMs: command.minSilenceDurationMs,
        maxSpeechDurationS: command.maxSpeechDurationS,
      },
    };
    send({ type: 'ready' });
  } catch (error) {
    send({ type: 'init-error', message: error instanceof Error ? error.message : String(error) });
  }
}

function handleCommand(command: WorkerCommand): void {
  switch (command.type) {
    case 'init':
      if (command.uiLanguage !== undefined) {
        uiLanguage = command.uiLanguage;
      }
      enqueue(() => handleInit(command));
      return;
    case 'audio-chunk': {
      if (state === null) {
        return;
      }
      const chunk = new Int16Array(command.pcm);
      pendingChunks.push(chunk);
      pendingSamples += chunk.length;
      const active = state;
      enqueue(() => tryEndpoint(active));
      return;
    }
    case 'flush': {
      const active = state;
      const requestId = command.requestId;
      if (active === null) {
        // Auch ohne Engine deterministisch antworten, damit ein wartender
        // Aufrufer (Hotkey-Stop) nie haengt.
        if (requestId !== undefined) {
          send({ type: 'flush-done', requestId });
        }
        return;
      }
      enqueue(async () => {
        if (pendingSamples > 0) {
          const pcm = collectPendingArrayBuffer();
          clearPending();
          await processSegment(active, pcm);
        }
        // Nach der Segmentverarbeitung melden: alle Transkript-/Silence-
        // Events des Flushs sind zu diesem Zeitpunkt bereits gesendet.
        if (requestId !== undefined) {
          send({ type: 'flush-done', requestId });
        }
      });
      return;
    }
    case 'reset':
      enqueue(() => {
        clearPending();
        return Promise.resolve();
      });
      return;
    case 'set-context':
      // In der Verarbeitungskette setzen, damit ein laufendes Segment noch
      // mit dem bisherigen Kontext abgeschlossen wird (deterministisch).
      // Die UI-Sprache wirkt sofort (betrifft nur Fehlertexte, B3).
      if (command.uiLanguage !== undefined) {
        uiLanguage = command.uiLanguage;
      }
      enqueue(() => {
        initialPrompt = command.prompt;
        dictationLanguage = command.language;
        return Promise.resolve();
      });
      return;
    case 'segment': {
      const active = state;
      if (active === null) {
        send({
          type: 'transcribe-error',
          message: KATALOGE[uiLanguage].main.engine.nichtBereit,
          requestId: command.requestId,
        });
        return;
      }
      enqueue(() => processSegment(active, command.pcm, command.requestId));
      return;
    }
    case 'shutdown':
      enqueue(async () => {
        if (state !== null) {
          await state.whisper.release();
          await state.vad.release();
          state = null;
        }
        clearPending();
        setTimeout(() => process.exit(0), 50);
      });
      return;
  }
}

parentPort.on('message', (messageEvent) => {
  const parsed = workerCommandSchema.safeParse(messageEvent.data);
  if (!parsed.success) {
    send({
      type: 'transcribe-error',
      message: KATALOGE[uiLanguage].main.engine.ungueltigeNachricht(parsed.error.message),
    });
    return;
  }
  handleCommand(parsed.data);
});
