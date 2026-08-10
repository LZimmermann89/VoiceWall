/**
 * Mail-Befehl am Diktatanfang ("Verfasse eine Mail an Lars mit folgendem
 * Text: ...").
 *
 * Zweck: Statt Text irgendwohin einzufuegen, wird eine fertige Mail
 * vorbereitet. Empfaenger und Text gehen an das Standard-Mailprogramm, das
 * ein ausgefuelltes Verfassen-Fenster oeffnet. Der Mensch liest gegen und
 * drueckt Senden. VoiceWall verschickt NIE selbst.
 *
 * HARTE GUARDRAIL: endliche Wortlisten, festes Muster, kein Modell, kein
 * Netzaufruf.
 *
 * DIE WICHTIGSTE ENTSCHEIDUNG, und der Grund fuer das Kontaktverzeichnis:
 * Die Empfaengeradresse wird NIEMALS aus dem Diktat gelesen. Gesprochen wird
 * "L Punkt Zimmermann at fernau minus GmbH punkt de", und die Erkennung
 * schreibt das mal so, mal anders. Eine falsch verstandene Adresse ist kein
 * Schoenheitsfehler, sondern eine Mail an einen Fremden. Deshalb kommt die
 * Adresse ausschliesslich aus dem Verzeichnis der Firma, und aus dem Diktat
 * kommt nur der NAME, der dort nachgeschlagen wird. Ist der Name unbekannt,
 * passiert nichts, ausser einer Meldung.
 *
 * Dieses Modul bleibt plattformneutral (nur zod, kein Node/Electron/DOM).
 */
import { z } from 'zod';
import type { DictationLanguage } from './schema';

/** Aktuelle Schema-Version der kontakte.json. */
export const KONTAKTE_SCHEMA_VERSION = 1;

/** Obergrenze: das Verzeichnis ist eine Handauswahl, kein Adressbuch-Import. */
export const MAX_KONTAKTE = 200;

// eslint-disable-next-line no-control-regex -- Steuerzeichen sind das Pruefziel.
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

/**
 * E-Mail-Adresse, bewusst streng geprueft: genau ein @, kein Leerraum, ein
 * Punkt im Bereich dahinter. Die Adresse landet spaeter in einer mailto-URL;
 * was hier durchkommt, geht an das Betriebssystem.
 */
export const mailAdresseSchema = z
  .string()
  .min(3)
  .max(254)
  .refine((wert) => !CONTROL_CHARS.test(wert), {
    message: 'Eine E-Mail-Adresse darf keine Steuerzeichen enthalten.',
  })
  .refine((wert) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wert), {
    message: 'Bitte eine gültige E-Mail-Adresse angeben, etwa name@firma.de.',
  });

/** Der gesprochene Name eines Kontakts ("Lars", "Frau Weber"). */
export const kontaktNameSchema = z
  .string()
  .min(1)
  .max(80)
  .refine((wert) => !CONTROL_CHARS.test(wert), {
    message: 'Ein Kontaktname darf keine Steuerzeichen enthalten.',
  })
  .refine((wert) => wert.trim().length > 0, {
    message: 'Ein Kontaktname darf nicht nur aus Leerzeichen bestehen.',
  });

/** Ein Eintrag des Verzeichnisses. */
export const kontaktSchema = z.object({
  name: kontaktNameSchema,
  adresse: mailAdresseSchema,
});
export type Kontakt = z.infer<typeof kontaktSchema>;

/** Die kontakte.json eines Firmenordners. */
export const kontakteSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    kontakte: z
      .array(kontaktSchema)
      .max(MAX_KONTAKTE, `Höchstens ${String(MAX_KONTAKTE)} Kontakte sind erlaubt.`),
  })
  .passthrough();
export type Kontakte = z.infer<typeof kontakteSchema>;

/** Liefert ein leeres Verzeichnis (frisch erzeugt, nicht geteilt). */
export function defaultKontakte(): Kontakte {
  return { schemaVersion: KONTAKTE_SCHEMA_VERSION, kontakte: [] };
}

/** Eingabe des Speicherns (IPC-Sicht). */
export const kontakteSaveInputSchema = z.object({
  kontakte: z
    .array(kontaktSchema)
    .max(MAX_KONTAKTE, `Höchstens ${String(MAX_KONTAKTE)} Kontakte sind erlaubt.`),
});
export type KontakteSaveInput = z.infer<typeof kontakteSaveInputSchema>;

/** Ergebnis des Kontakt-Abrufs. */
export const kontakteGetResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), kontakte: kontakteSchema }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type KontakteGetResult = z.infer<typeof kontakteGetResultSchema>;

// ---------------------------------------------------------------------------
// Erkennung des gesprochenen Befehls
// ---------------------------------------------------------------------------

/**
 * Einleitungen des Befehls, je Diktatsprache. Alle verlangen ausdruecklich
 * das Wort "Mail" oder "E-Mail": ein blosses "schreibe an Lars" waere zu
 * nah an normalem Diktattext.
 */
const EINLEITUNGEN: Readonly<Record<DictationLanguage, readonly RegExp[]>> = {
  de: [
    /^\s*(?:verfasse|schreibe|erstelle)\s+(?:eine\s+|ein\s+)?(?:e-?\s?mail|mail)\s+an\s+/i,
    /^\s*(?:e-?\s?mail|mail)\s+an\s+/i,
  ],
  en: [
    /^\s*(?:write|compose|create)\s+(?:an?\s+)?(?:e-?\s?mail|mail)\s+to\s+/i,
    /^\s*(?:e-?\s?mail|mail)\s+to\s+/i,
  ],
};

/**
 * Trennt Empfaengernamen vom Nachrichtentext. Der Doppelpunkt ist die
 * verlaesslichste Grenze, weil die Spracherkennung ihn nach "folgendem Text"
 * ohnehin meist setzt; die Wortformen daneben fangen die Faelle ab, in denen
 * sie es nicht tut.
 */
const TRENNER: Readonly<Record<DictationLanguage, readonly RegExp[]>> = {
  de: [
    /\s+mit\s+(?:dem\s+|folgendem\s+)?(?:text|inhalt|wortlaut)\s*:?\s*/i,
    /\s+mit\s+folgendem\s*:?\s*/i,
    /\s*:\s*/,
  ],
  en: [/\s+with\s+(?:the\s+)?(?:following\s+)?(?:text|content)\s*:?\s*/i, /\s*:\s*/],
};

/** Optionaler Betreff, direkt vor dem Text. */
const BETREFF: Readonly<Record<DictationLanguage, readonly RegExp[]>> = {
  de: [/\s+mit\s+(?:dem\s+)?betreff\s+(.+)$/i, /\s+betreff\s+(.+)$/i],
  en: [/\s+with\s+(?:the\s+)?subject\s+(.+)$/i, /\s+subject\s+(.+)$/i],
};

/** Erkannter Mail-Befehl, noch ohne aufgeloeste Adresse. */
export interface Mailbefehl {
  /** Der gesprochene Empfaengername, wie er im Verzeichnis zu suchen ist. */
  readonly empfaenger: string;
  /** Betreff, falls einer genannt wurde. */
  readonly betreff: string | null;
  /** Der eigentliche Nachrichtentext. */
  readonly text: string;
}

/** Entfernt Satzzeichen und Leerraum an den Raendern. */
function saeubere(wert: string): string {
  return wert
    .replace(/^[\s,;:.]+/, '')
    .replace(/[\s,;:]+$/, '')
    .trim();
}

/**
 * Erkennt einen Mail-Befehl am Anfang des Diktats. Ohne Treffer: null.
 *
 * Bewusst streng: Die Einleitung muss den Text eroeffnen, das Wort "Mail"
 * enthalten und einen Empfaenger nennen, und es muss ein Nachrichtentext
 * folgen. Fehlt eines davon, ist es normaler Diktattext und bleibt es auch.
 */
export function erkenneMailbefehl(
  text: string,
  sprache: DictationLanguage = 'de',
): Mailbefehl | null {
  let rest: string | null = null;
  for (const einleitung of EINLEITUNGEN[sprache]) {
    const treffer = einleitung.exec(text);
    if (treffer !== null) {
      rest = text.slice(treffer[0].length);
      break;
    }
  }
  if (rest === null || rest.trim().length === 0) {
    return null;
  }

  // Empfaenger und Nachrichtentext an der fruehesten Trennstelle teilen.
  let empfaengerTeil: string | null = null;
  let textTeil: string | null = null;
  let bestePosition = Number.MAX_SAFE_INTEGER;
  for (const trenner of TRENNER[sprache]) {
    const treffer = trenner.exec(rest);
    if (treffer !== null && treffer.index < bestePosition) {
      bestePosition = treffer.index;
      empfaengerTeil = rest.slice(0, treffer.index);
      textTeil = rest.slice(treffer.index + treffer[0].length);
    }
  }
  if (empfaengerTeil === null || textTeil === null) {
    return null;
  }

  // Optionaler Betreff haengt am Empfaengerteil ("an Lars mit Betreff Angebot").
  let betreff: string | null = null;
  for (const muster of BETREFF[sprache]) {
    const treffer = muster.exec(empfaengerTeil);
    if (treffer !== null) {
      betreff = saeubere(treffer[1] ?? '');
      empfaengerTeil = empfaengerTeil.slice(0, treffer.index);
      break;
    }
  }

  const empfaenger = saeubere(empfaengerTeil);
  const nachricht = saeubere(textTeil);
  if (empfaenger.length === 0 || nachricht.length === 0) {
    return null;
  }
  return {
    empfaenger,
    betreff: betreff === null || betreff.length === 0 ? null : betreff,
    text: nachricht,
  };
}

/**
 * Schlaegt einen gesprochenen Namen im Verzeichnis nach. Verglichen wird
 * ohne Ruecksicht auf Gross-/Kleinschreibung und Leerraum; ein Kontaktname
 * darf auch nur der Vorname sein. Mehrdeutigkeit (zwei Treffer) gilt als
 * NICHT gefunden: lieber nachfragen als an die falsche Person schreiben.
 */
export function findeKontakt(name: string, kontakte: readonly Kontakt[]): Kontakt | null {
  const gesucht = name.toLowerCase().replace(/\s+/g, ' ').trim();
  const treffer = kontakte.filter(
    (kontakt) => kontakt.name.toLowerCase().replace(/\s+/g, ' ').trim() === gesucht,
  );
  return treffer.length === 1 ? (treffer[0] ?? null) : null;
}

/** Obergrenze der erzeugten mailto-Adresse (konservativ, siehe unten). */
export const MAILTO_MAX_LAENGE = 4000;

/**
 * Baut die mailto-Adresse fuer das Standard-Mailprogramm.
 *
 * Sicherheitsregeln, weil hier zum ersten Mal Diktattext an das
 * Betriebssystem geht:
 * - Das Schema ist fest einkompiliert, es kann nie ein anderes werden.
 * - Die Empfaengeradresse stammt aus dem Verzeichnis und ist zod-geprueft.
 * - Betreff und Text werden vollstaendig prozentkodiert, koennen also weder
 *   weitere Parameter noch ein anderes Ziel einschleusen.
 * - Die Gesamtlaenge ist begrenzt; laengere Texte werden gekuerzt, statt eine
 *   riesige Adresse an das Betriebssystem zu reichen. Der vollstaendige Text
 *   bleibt ueber Zwischenablage und Speicherung erhalten.
 */
export function baueMailtoUrl(adresse: string, betreff: string | null, text: string): string {
  // Das @ trennt zwei Teile, die einzeln kodiert werden: kodiert man die
  // ganze Adresse am Stueck, wird aus dem @ ein %40, das nicht jedes
  // Mailprogramm zurueckuebersetzt. Kodiert man gar nicht, koennte ein
  // Sonderzeichen in der Adresse einen weiteren Parameter oeffnen.
  const trenner = adresse.lastIndexOf('@');
  const lokal = encodeURIComponent(adresse.slice(0, trenner));
  const domain = encodeURIComponent(adresse.slice(trenner + 1));
  const parameter: string[] = [];
  if (betreff !== null && betreff.length > 0) {
    parameter.push(`subject=${encodeURIComponent(betreff)}`);
  }
  parameter.push(`body=${encodeURIComponent(text)}`);
  const url = `mailto:${lokal}@${domain}?${parameter.join('&')}`;
  return url.length <= MAILTO_MAX_LAENGE ? url : url.slice(0, MAILTO_MAX_LAENGE);
}
