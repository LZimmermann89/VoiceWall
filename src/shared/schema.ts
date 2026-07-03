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
});
export type ModelStatusView = z.infer<typeof modelStatusSchema>;

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

/** Gesamtzustand der App, Grundlage der Status-UI. */
export const appStatusSchema = z.object({
  consentGranted: z.boolean(),
  microphoneState: microphoneStateSchema,
  models: z.array(modelStatusSchema),
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
