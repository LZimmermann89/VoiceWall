/**
 * Audio-Aufnahme im versteckten Capture-Fenster (nur Web-Audio, keine
 * Node-/Electron-APIs). Liefert 16-bit-PCM-Chunks (16 kHz mono) per
 * Preload-Bruecke an den Main-Prozess.
 *
 * Ablauf:
 * 1. getUserMedia mono, DSP-Filter bewusst aus (bessere Whisper-Genauigkeit).
 * 2. AudioContext mit angeforderten 16 kHz; erzwingt das OS 48 kHz, wird im
 *    Hauptthread defensiv per linearer Interpolation resampled.
 * 3. Ein AudioWorklet (als Blob-URL geladen, file://-Falle umgangen) schiebt
 *    Float32-Chunks ca. alle 100 ms an den Hauptthread.
 * 4. Hauptthread: resamplen (falls noetig), Float32 -> Int16 (Clamping), per
 *    Bruecke an den Main-Prozess. Nichts wird auf Platte geschrieben.
 */
import { float32ToInt16, resampleLinear, TARGET_SAMPLE_RATE } from '../shared/pcm';

const capture = window.voicewallCapture;

/**
 * Worklet-Quelltext als String. Er akkumuliert Float32-Frames und postet ca.
 * alle 100 ms einen zusammenhaengenden Block an den Hauptthread. Laeuft im
 * AudioWorkletGlobalScope, wo `sampleRate` und `registerProcessor` global sind.
 */
const workletSource = `
class PcmCollector extends AudioWorkletProcessor {
  constructor() {
    super();
    // Ca. 100 ms pro Block (bei ctx-Abtastrate, nicht zwingend 16 kHz).
    this.blockSize = Math.max(1, Math.round(sampleRate * 0.1));
    this.buffer = new Float32Array(this.blockSize);
    this.offset = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }
    const channel = input[0];
    if (!channel) {
      return true;
    }
    for (let i = 0; i < channel.length; i += 1) {
      this.buffer[this.offset] = channel[i];
      this.offset += 1;
      if (this.offset >= this.blockSize) {
        // Kopie posten, damit der interne Puffer weiter genutzt werden kann.
        this.port.postMessage(this.buffer.slice(0, this.offset));
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('pcm-collector', PcmCollector);
`;

interface CaptureRuntime {
  stream: MediaStream;
  context: AudioContext;
  node: AudioWorkletNode;
  source: MediaStreamAudioSourceNode;
  blobUrl: string;
}

let runtime: CaptureRuntime | null = null;
let starting = false;

async function startCapture(): Promise<void> {
  if (runtime !== null || starting) {
    return;
  }
  starting = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    const context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    const contextRate = context.sampleRate;

    // AudioWorklet-Modul als Blob-URL laden (umgeht die file://-Falle).
    const blob = new Blob([workletSource], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    await context.audioWorklet.addModule(blobUrl);

    const source = context.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(context, 'pcm-collector');

    node.port.onmessage = (event: MessageEvent<Float32Array>): void => {
      const frame = event.data;
      // Defensiv resamplen, falls das OS nicht 16 kHz geliefert hat.
      const resampled =
        contextRate === TARGET_SAMPLE_RATE
          ? frame
          : resampleLinear(frame, contextRate, TARGET_SAMPLE_RATE);
      const int16 = float32ToInt16(resampled);
      // In einen frischen ArrayBuffer kopieren (definitiv ArrayBuffer, nicht
      // SharedArrayBuffer) und an den Main-Prozess uebergeben.
      const payload = new ArrayBuffer(int16.byteLength);
      new Int16Array(payload).set(int16);
      capture.sendPcm(payload);
    };

    source.connect(node);
    // Der Worklet muss laufen; eine Ausgabe an die Lautsprecher ist unnoetig
    // und wird bewusst nicht verbunden (kein node.connect(context.destination)).
    runtime = { stream, context, node, source, blobUrl };
    capture.reportStarted();
  } catch (error) {
    capture.reportError(
      `Der Mikrofonzugriff ist fehlgeschlagen (${
        error instanceof Error ? error.message : String(error)
      }). Bitte prüfen, ob ein Mikrofon angeschlossen ist und VoiceWall Zugriff hat.`,
    );
  } finally {
    starting = false;
  }
}

async function stopCapture(): Promise<void> {
  if (runtime === null) {
    return;
  }
  const active = runtime;
  runtime = null;
  active.source.disconnect();
  active.node.disconnect();
  active.node.port.onmessage = null;
  for (const track of active.stream.getTracks()) {
    track.stop();
  }
  URL.revokeObjectURL(active.blobUrl);
  await active.context.close();
}

capture.onStart(() => {
  void startCapture();
});
capture.onStop(() => {
  void stopCapture();
});
