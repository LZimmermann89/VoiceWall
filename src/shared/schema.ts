/**
 * Zod-Schemas für Daten, die eine Vertrauensgrenze überqueren (IPC-Payloads,
 * später Konfig und Modell-Manifest). Externe, ungetypte Daten werden am Rand
 * geparst, danach existiert im Code nur noch der validierte Typ. Dieses Modul
 * bleibt plattformneutral (keine Node-/DOM-Abhaengigkeit).
 */
import { z } from 'zod';

/** Antwort des Ping-Kanals: Erreichbarkeitstest der IPC-Bruecke. */
export const pingResponseSchema = z.literal('pong');
export type PingResponse = z.infer<typeof pingResponseSchema>;

/** OS-Mikrofonstatus, so wie er dem Renderer gemeldet wird. */
export const microphoneStateSchema = z.enum([
  'granted',
  'denied',
  'restricted',
  'unknown',
  'not-checked',
]);
export type MicrophoneState = z.infer<typeof microphoneStateSchema>;

/** Praesenzstatus eines einzelnen Modells. */
export const modelStatusSchema = z.object({
  id: z.string(),
  label: z.string(),
  present: z.boolean(),
  /** Erwartete Dateigroesse in Bytes (fuer die Download-Anzeige im Wizard). */
  byteSize: z.number().int().nonnegative(),
});
export type ModelStatusView = z.infer<typeof modelStatusSchema>;

/** Whisper-Modellwahl (Wizard Schritt Modell; Q5_0 ist der Standard). */
export const modelChoiceSchema = z.enum(['q5_0', 'fp16']);
export type ModelChoiceView = z.infer<typeof modelChoiceSchema>;

/** Zustand des systemweiten Diktat-Flows (siehe shared/dictation-flow.ts). */
export const dictationFlowStateSchema = z.enum(['idle', 'recording', 'transcribing', 'delivering']);
export type DictationFlowStateView = z.infer<typeof dictationFlowStateSchema>;

/** macOS-Bedienungshilfen-Status (Windows/Linux: not-applicable). */
export const accessibilityStateSchema = z.enum(['granted', 'missing', 'not-applicable']);
export type AccessibilityState = z.infer<typeof accessibilityStateSchema>;

/** Registrierungszustand des globalen Hotkeys. */
export const hotkeyStatusSchema = z.object({
  accelerator: z.string(),
  registered: z.boolean(),
});
export type HotkeyStatus = z.infer<typeof hotkeyStatusSchema>;

/**
 * Globale Schalter der regelbasierten Textaufbereitung (Stufe 1,
 * ABARBEITUNG 2.7; Konfig-Ort-Entscheidung E35).
 */
export const aufbereitungConfigSchema = z.object({
  /** Fuellwoerter ("äh", "ähm", ...) und direkte Wortdopplungen entfernen. */
  fuellwoerterEntfernen: z.boolean(),
  /** Gesprochene Kommandos ("Punkt", "neue Zeile", ...) umsetzen (Opt-in). */
  sprachkommandos: z.boolean(),
});
export type AufbereitungConfig = z.infer<typeof aufbereitungConfigSchema>;

/** Gesamtzustand der App, Grundlage der Status-UI. */
export const appStatusSchema = z.object({
  consentGranted: z.boolean(),
  microphoneState: microphoneStateSchema,
  models: z.array(modelStatusSchema),
  /** Aktive Whisper-Modellwahl (globale Konfig). */
  modelChoice: modelChoiceSchema,
  modelsReady: z.boolean(),
  engineReady: z.boolean(),
  dictationActive: z.boolean(),
  lastError: z.string().nullable(),
  /** Systemweites Diktat (M3). */
  flowState: dictationFlowStateSchema,
  hotkey: hotkeyStatusSchema,
  accessibility: accessibilityStateSchema,
  /** Letztes Transkript (RAM-only, fuer den Kopieren-Knopf). */
  lastTranscript: z.string().nullable(),
  /** Zwischenablage nach dem Einfuegen wiederherstellen (Konfig-Schalter). */
  clipboardRestoreEnabled: z.boolean(),
  /** Schalter der Textaufbereitung (Stufe 1). */
  aufbereitung: aufbereitungConfigSchema,
});
export type AppStatus = z.infer<typeof appStatusSchema>;

/**
 * Ergebnis einer Text-Zustellung (Clipboard-Sequenz + Auto-Paste). `message`
 * traegt bei nicht erfolgtem Paste die deutsche Erklaerung samt naechstem
 * Schritt; der Text selbst ist dann trotzdem in der Zwischenablage.
 */
export const deliveryResultSchema = z.object({
  /** Text wurde in die Zwischenablage geschrieben. */
  delivered: z.boolean(),
  /** Auto-Paste wurde erfolgreich ausgeloest. */
  pasted: z.boolean(),
  /** Deutsche Meldung (Hinweis oder Fehler), sonst null. */
  message: z.string().nullable(),
});
export type DeliveryResult = z.infer<typeof deliveryResultSchema>;

/**
 * Ergebnis des Dev-/Test-Kanals "Diktat aus PCM" (nur Dev/Test): kompletter
 * Pfad Injektion -> Ersetzungen -> Aufbereitung -> Zustellung. `text` ist der
 * final zugestellte Text (null bei Stille).
 */
export const devDictateResultSchema = z.object({
  delivered: z.boolean(),
  pasted: z.boolean(),
  text: z.string().nullable(),
  message: z.string().nullable(),
});
export type DevDictateResult = z.infer<typeof devDictateResultSchema>;

/** Ein neues Transkript-Segment. */
export const transcriptPayloadSchema = z.object({
  text: z.string(),
  durationMs: z.number(),
  audioMs: z.number(),
});
export type TranscriptPayload = z.infer<typeof transcriptPayloadSchema>;

/** Download-Fortschritt eines Modells. */
export const modelProgressSchema = z.object({
  id: z.string(),
  label: z.string(),
  receivedBytes: z.number(),
  totalBytes: z.number().nullable(),
  percent: z.number().nullable(),
});
export type ModelProgress = z.infer<typeof modelProgressSchema>;

/** Aktueller Audiopegel (RMS, 0..1) fuer die Pegelanzeige. */
export const audioLevelSchema = z.object({ rms: z.number() });
export type AudioLevel = z.infer<typeof audioLevelSchema>;

/** Eine deutsche Fehlermeldung fuer die UI. */
export const errorPayloadSchema = z.object({ message: z.string() });
export type ErrorPayload = z.infer<typeof errorPayloadSchema>;

/** Generisches Ergebnis einer Aktion (Erfolg oder deutsche Fehlermeldung). */
export const actionResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type ActionResult = z.infer<typeof actionResultSchema>;

/**
 * System- und App-Informationen fuer den Wizard (M6): Hardware-Erkennung fuer
 * die Modellempfehlung (ABARBEITUNG 2.2) und die Beleg-Zeile im Footer.
 * `fp16Erlaubt` gilt bei mindestens 16 GB RAM und mindestens 6 Kernen.
 */
export const systemInfoSchema = z.object({
  platform: z.string(),
  arch: z.string(),
  cpuKerne: z.number().int().positive(),
  ramGb: z.number().positive(),
  fp16Erlaubt: z.boolean(),
  appVersion: z.string(),
  /** Kurzform des SHA-256 des Standard-Whisper-Modells (Pruefstempel). */
  modellPruefsumme: z.string(),
});
export type SystemInfo = z.infer<typeof systemInfoSchema>;
