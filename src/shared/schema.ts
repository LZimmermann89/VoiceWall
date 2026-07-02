/**
 * Zod-Schemas für Daten, die eine Vertrauensgrenze überqueren (IPC-Payloads,
 * später Konfig und Modell-Manifest). Externe, ungetypte Daten werden am Rand
 * geparst, danach existiert im Code nur noch der validierte Typ.
 */
import { z } from 'zod';

/** Antwort des Ping-Kanals: der einzige IPC-Kanal in M0. */
export const pingResponseSchema = z.literal('pong');

export type PingResponse = z.infer<typeof pingResponseSchema>;
