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

import type { DictationLanguage } from '../../shared/schema';
import { texte } from '../i18n';

/** Stabile Modell-Kennungen (Katalog, Manifest, Statusanzeigen). */
export type ModelId = 'whisper-q5' | 'whisper-fp16' | 'turbo-q5_0-multilingual' | 'silero-vad';

export interface ModelDescriptor {
  /** Interner Schluessel. */
  readonly id: ModelId;
  /** Dateiname im Modellordner (userData/models). */
  readonly fileName: string;
  /** Stabile Download-URL (resolve/main), niemals die CDN-URL. */
  readonly url: string;
  /** Erwartete Groesse in Bytes (schneller Vorab-Sanity-Check). */
  readonly byteSize: number;
  /** Erwarteter SHA-256 in Kleinbuchstaben-Hex. */
  readonly sha256: string;
  /**
   * Deutsche Klartext-Bezeichnung fuer Logs und das Audit-Artefakt
   * resources/model-manifest.json. Die UI zeigt seit Paket B3 den
   * sprachabhaengigen Anzeigenamen aus dem Katalog (modelLabelFor).
   */
  readonly label: string;
}

/** Sprachabhaengiger Anzeigename eines Modells (UI/Fehlermeldungen, B3). */
export function modelLabelFor(id: ModelId): string {
  return texte().modelle.labels[id];
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
  /**
   * Optionales fp16-Modell "Maximale Genauigkeit" (ABARBEITUNG 2.2/4.2.3).
   * Nur fuer starke Hardware (>= 16 GB RAM und >= 6 Kerne, Wizard-Gating).
   * SHA-256-Herkunft (2026-07-03): Hugging-Face-LFS-OID aus
   * `api/models/cstr/whisper-large-v3-turbo-german-ggml/tree/main` (der OID
   * IST der SHA-256, gegen den HF die Datei selbst verifiziert). Der
   * unabhaengige Selbst-Hash-Quercheck (R14, wie beim Q5_0 im M1-Spike)
   * steht fuer diese 1,6-GB-Datei noch aus; schlimmster Fall bei falscher
   * Konstante ist ein abgelehnter Download, nie eine falsch akzeptierte Datei.
   */
  whisperFp16: {
    id: 'whisper-fp16',
    fileName: 'ggml-model.bin',
    url: 'https://huggingface.co/cstr/whisper-large-v3-turbo-german-ggml/resolve/main/ggml-model.bin',
    byteSize: 1_624_555_275,
    sha256: '6eb2e025198a6cbac7bdb1e86e278f5de002e583aae7bdfcf5183ef8da16decd',
    label: 'Deutsches Whisper-Modell (large-v3-turbo, fp16, maximale Genauigkeit)',
  },
  /**
   * Originales multilinguales large-v3-turbo (Q5_0) fuer die Diktatsprache
   * Englisch (Paket B1, ABARBEITUNG 2.6). KEIN Auto-Download: geladen wird
   * erst, wenn eine Firma Englisch waehlt (Entscheidung E39).
   * SHA-256-Herkunft (04.07.2026, R14-Verfahren wie im M1-Spike): Datei von
   * der resolve/main-URL geladen, selbst mit `shasum -a 256` gehasht UND
   * identisch mit dem Hugging-Face-LFS-OID aus
   * `api/models/ggerganov/whisper.cpp/paths-info/main`.
   */
  whisperTurboMultilingual: {
    id: 'turbo-q5_0-multilingual',
    fileName: 'ggml-large-v3-turbo-q5_0.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin',
    byteSize: 574_041_195,
    sha256: '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2',
    label: 'Englisch / mehrsprachig (large-v3-turbo, Q5_0)',
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

/** Alle bekannten Modelle (fuer Manifest-Sync und Statusanzeigen). */
export const ALL_MODEL_DESCRIPTORS: readonly ModelDescriptor[] = [
  MODEL_CATALOG.whisperQ5,
  MODEL_CATALOG.whisperFp16,
  MODEL_CATALOG.whisperTurboMultilingual,
  MODEL_CATALOG.sileroVad,
];

/**
 * Pflichtmodelle des Standardbetriebs (Q5_0 plus VAD). Das fp16-Modell ist
 * eine optionale Wahl im Wizard und wird nur bei Auswahl geladen.
 */
export const MODEL_DESCRIPTORS: readonly ModelDescriptor[] = [
  MODEL_CATALOG.whisperQ5,
  MODEL_CATALOG.sileroVad,
];

/** Whisper-Modellwahl des Nutzers (globale Konfig, Wizard Schritt Modell). */
export type WhisperModelChoice = 'q5_0' | 'fp16';

/** Liefert den Whisper-Descriptor zur Modellwahl. */
export function whisperDescriptorFor(choice: WhisperModelChoice): ModelDescriptor {
  return choice === 'fp16' ? MODEL_CATALOG.whisperFp16 : MODEL_CATALOG.whisperQ5;
}

/**
 * Modellwahl-Logik je Diktatsprache (Entscheidung E39): Deutsch nutzt das
 * DE-optimierte Finetune (q5_0/fp16 gemaess Modellwahl), Englisch immer das
 * originale multilinguale large-v3-turbo (Q5_0).
 */
export function whisperDescriptorForLanguage(
  language: DictationLanguage,
  choice: WhisperModelChoice,
): ModelDescriptor {
  return language === 'en' ? MODEL_CATALOG.whisperTurboMultilingual : whisperDescriptorFor(choice);
}

/**
 * Modellkennung fuer Diktat-Metadaten (Front-Matter-Feld `modell`,
 * ABARBEITUNG 4.4.2): benennt Herkunftsmodell und Quantisierung
 * (Beleg-Gedanke: welches Modell hat den Text erzeugt).
 */
export const TRANSCRIPT_MODEL_NAME = 'whisper-large-v3-turbo-german-q5_0';

/** Modellkennung fuer Diktat-Metadaten je Modellwahl. */
export function transcriptModelName(choice: WhisperModelChoice): string {
  return choice === 'fp16'
    ? 'whisper-large-v3-turbo-german-fp16'
    : 'whisper-large-v3-turbo-german-q5_0';
}

/** Modellkennung fuer Diktat-Metadaten je Diktatsprache und Modellwahl. */
export function transcriptModelNameFor(
  language: DictationLanguage,
  choice: WhisperModelChoice,
): string {
  return language === 'en' ? 'whisper-large-v3-turbo-q5_0' : transcriptModelName(choice);
}

/** Ein SHA-256-Hex ist genau 64 Zeichen aus [0-9a-f]. */
export function isValidSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}
