/**
 * Katalog der lokal benoetigten Modelldateien mit fest hinterlegten
 * SHA-256-Konstanten, Groessen und stabilen resolve/main-Download-URLs.
 *
 * Die Checksummen stammen aus dem M1-Spike (selbst mit `shasum -a 256`
 * berechnet und gegen den Hugging-Face-LFS-OID quergecheckt, Risiko R14).
 * Sie sind der auditfeste Integritaetsanker: nach jedem Download und beim
 * Start wird gegen exakt diese Werte geprueft, unabhaengig von HF-Metadaten.
 *
 * Bewusst nie die HF-CDN-URL hardcoden: die ist signiert und laeuft ab. Immer
 * die stabile `resolve/main`-URL, Redirects folgt der Downloader selbst.
 */

export interface ModelDescriptor {
  /** Interner Schluessel. */
  readonly id: 'whisper-q5' | 'silero-vad';
  /** Dateiname im Modellordner (userData/models). */
  readonly fileName: string;
  /** Stabile Download-URL (resolve/main), niemals die CDN-URL. */
  readonly url: string;
  /** Erwartete Groesse in Bytes (schneller Vorab-Sanity-Check). */
  readonly byteSize: number;
  /** Erwarteter SHA-256 in Kleinbuchstaben-Hex. */
  readonly sha256: string;
  /** Klartext-Bezeichnung fuer UI und Fehlermeldungen. */
  readonly label: string;
}

export const MODEL_CATALOG = {
  whisperQ5: {
    id: 'whisper-q5',
    fileName: 'ggml-model-q5_0.bin',
    url: 'https://huggingface.co/cstr/whisper-large-v3-turbo-german-ggml/resolve/main/ggml-model-q5_0.bin',
    byteSize: 574_041_195,
    sha256: '15e92e3db0993c52fffa781513eec9253475331c1be808f8fb409285c9d9d030',
    label: 'Deutsches Whisper-Modell (large-v3-turbo, Q5_0)',
  },
  sileroVad: {
    id: 'silero-vad',
    fileName: 'ggml-silero-v5.1.2.bin',
    url: 'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin',
    byteSize: 885_098,
    sha256: '29940d98d42b91fbd05ce489f3ecf7c72f0a42f027e4875919a28fb4c04ea2cf',
    label: 'Silero-VAD-Modell (v5.1.2)',
  },
} as const satisfies Record<string, ModelDescriptor>;

export const MODEL_DESCRIPTORS: readonly ModelDescriptor[] = [
  MODEL_CATALOG.whisperQ5,
  MODEL_CATALOG.sileroVad,
];

/** Ein SHA-256-Hex ist genau 64 Zeichen aus [0-9a-f]. */
export function isValidSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}
