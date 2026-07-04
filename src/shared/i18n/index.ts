/**
 * Übersetzungs-Infrastruktur (Paket B2, Entscheidung E40): typisierte
 * Kataloge ohne externe Abhängigkeit. `de.ts` ist die Quelle der Wahrheit;
 * der abgeleitete Typ `Uebersetzung = typeof de` erzwingt beim Kompilieren
 * die Vollständigkeit von `en.ts` (fehlender Schlüssel = Typfehler).
 *
 * Die UI-Sprache (Typ `UiLanguage`, shared/schema.ts) ist global und
 * bewusst unabhängig von der Diktatsprache der Firmen.
 *
 * Plattformneutral (kein Node/DOM).
 */
import type { UiLanguage } from '../schema';
import { de } from './de';
import { en } from './en';

/** Struktur eines vollständigen Text-Katalogs (abgeleitet aus de.ts). */
export type Uebersetzung = typeof de;

/** Alle Kataloge, adressiert über die UI-Sprache. */
export const KATALOGE: Record<UiLanguage, Uebersetzung> = { de, en };

export { de, en };
