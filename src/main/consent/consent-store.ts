/**
 * Speichert die informierte Einwilligung zur Mikrofonnutzung lokal, mit
 * Zeitstempel, als auditfesten Nachweis (kein Telemetrieversand). Die Datei
 * liegt unter userData und wird mit Datei-Rechten 0600 geschrieben (nur der
 * Nutzer darf lesen/schreiben).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

const consentRecordSchema = z.object({
  microphoneConsent: z.literal(true),
  /** ISO-8601-Zeitstempel der Zustimmung. */
  grantedAtIso: z.string().min(1),
  /** Version des angezeigten Einwilligungstexts (fuer spaetere Aenderungen). */
  consentTextVersion: z.number().int().positive(),
});

export type ConsentRecord = z.infer<typeof consentRecordSchema>;

/** Aktuelle Version des Einwilligungstexts (bei Textaenderung erhoehen). */
export const CONSENT_TEXT_VERSION = 1;

function consentPath(userDataPath: string): string {
  return join(userDataPath, 'microphone-consent.json');
}

/** Liest die gespeicherte Einwilligung, falls vorhanden und gueltig. */
export async function readConsent(userDataPath: string): Promise<ConsentRecord | null> {
  try {
    const raw = await readFile(consentPath(userDataPath), 'utf8');
    const parsed = consentRecordSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Speichert die Einwilligung mit aktuellem Zeitstempel (Datei-Modus 0600). */
export async function recordConsent(userDataPath: string): Promise<ConsentRecord> {
  const record: ConsentRecord = {
    microphoneConsent: true,
    grantedAtIso: new Date().toISOString(),
    consentTextVersion: CONSENT_TEXT_VERSION,
  };
  await writeFile(consentPath(userDataPath), JSON.stringify(record, null, 2), { mode: 0o600 });
  return record;
}

/** True, wenn eine gueltige Einwilligung fuer die aktuelle Textversion vorliegt. */
export function isConsentCurrent(record: ConsentRecord | null): boolean {
  return record !== null && record.consentTextVersion === CONSENT_TEXT_VERSION;
}
