/**
 * Regelbasierte Textaufbereitung des Diktats (Stufe 1, ABARBEITUNG 2.7).
 *
 * HARTE GUARDRAIL (ABARBEITUNG 2.7, nicht verhandelbar): Jede Aufbereitung
 * laeuft ausschliesslich lokal und regelbasiert/deterministisch. Kein
 * Cloud-LLM, kein Claude/OpenAI/irgendein API-Call zur Laufzeit, fuer gar
 * nichts. Ein einziger externer Aufruf wuerde den architektonischen
 * DSGVO-Beweis (Netzwerk-Tab = 0 externe Requests) zerstoeren. Dieses Modul
 * ist reine String-Verarbeitung ohne Modell und ohne Netz.
 *
 * Pipeline (aufbereitenText):
 *   1. Interpunktions-Nachschaerfung (immer an, konservativ),
 *   2. Fuellwoerter-Filter (Schalter, Default AN),
 *   3. Sprachkommandos (Schalter, Default AUS, bewusst Opt-in),
 *   4. Interpunktions-Nachlauf (raeumt Leerraum/Grossschreibung auf, die
 *      Schritt 2/3 hinterlassen; alle Regeln sind idempotent).
 *
 * Bekannte, ehrlich dokumentierte Grenzen:
 * - Wortdopplungs-Filter: "das das" wird zu "das". Seltene legitime direkte
 *   Dopplungen ("..., dass das das Ergebnis ist", "die Frau, die die Blumen
 *   kaufte") werden dabei faelschlich zusammengezogen. Dopplungen mit Komma
 *   ("sehr, sehr gut") bleiben unangetastet. Der Filter ist abschaltbar.
 * - Sprachkommandos: "Punkt"/"Komma"/"Absatz" sind auch normale deutsche
 *   Woerter ("Der Punkt ist wichtig" wuerde zu "Der. ist wichtig"; seit dem
 *   Alias "Absatz" gilt dasselbe fuer Saetze wie "Der Absatz gefaellt mir").
 *   Deshalb ist der Schalter standardmaessig AUS und ausdruecklich Opt-in
 *   (Entscheidung E38).
 * - Whisper-Interpunktion um Kommandos (Praxistest-Befund, Entscheidung E43):
 *   Whisper setzt um gesprochene Kommandowoerter oft SELBST Satzzeichen
 *   ("Das ist ein Test, Punkt."). Das Matching schluckt deshalb Satzzeichen,
 *   die unmittelbar an der Kommandophrase kleben: bei Satzzeichen-Kommandos
 *   je EIN Zeichen davor und danach (", Punkt." -> "."), bei Umbruechen nur
 *   danach ("Neuer Absatz." -> "\n\n"; ein Punkt DAVOR ist das legitime Ende
 *   des vorigen Satzes und bleibt). Wandelt Whisper das gesprochene "Punkt"
 *   komplett selbst in ein Satzzeichen um, steht kein Kommandowort im Text;
 *   die Regel hat dann nichts zu tun und das Ergebnis ist trotzdem richtig.
 *
 * Sprachabhaengigkeit (Paket B1, Entscheidung E39): Fuellwortliste und
 * Kommandoliste sind sprachabhaengig (Deutsch/Englisch, je Firmensprache);
 * die Interpunktions-Regeln sind sprachneutral und gelten fuer beide.
 *
 * Dieses Modul bleibt plattformneutral (kein Node/Electron/DOM).
 */
import type { DictationLanguage } from './schema';

/** Schalter der Aufbereitung (globale Konfiguration, Entscheidung E35). */
export interface AufbereitungOptions {
  /** Fuellwoerter ("aeh", "aehm", ...) und direkte Wortdopplungen entfernen. */
  readonly fuellwoerterEntfernen: boolean;
  /** Gesprochene Kommandos ("Punkt", "neue Zeile", ...) umsetzen. */
  readonly sprachkommandos: boolean;
}

/** Standardwerte der Schalter (Fuellwoerter AN, Kommandos AUS). */
export function defaultAufbereitungOptions(): AufbereitungOptions {
  return { fuellwoerterEntfernen: true, sprachkommandos: false };
}

/**
 * Haeufige deutsche Abkuerzungen, nach denen ein Punkt KEIN Satzende ist
 * (bewusst kleine, konservative Liste; nur fuer die Grossschreibungs-Regel).
 */
const ABKUERZUNGEN = new Set([
  'bzw',
  'usw',
  'ggf',
  'inkl',
  'exkl',
  'evtl',
  'ca',
  'vgl',
  'bspw',
  'etc',
  'sog',
  'zzgl',
  'abs',
  'nr',
  'str',
]);

/**
 * Interpunktions-Nachschaerfung (Regel 1, immer an, bewusst konservativ):
 * - Leerraum um Zeilenumbrueche normalisieren, mehr als eine Leerzeile kappen,
 * - doppelte Leerzeichen zusammenziehen,
 * - Leerzeichen VOR Satzzeichen entfernen,
 * - fehlendes Leerzeichen NACH Satzzeichen ergaenzen; NICHT in Zahlen
 *   ("3,14", "1.000") und NICHT nach Ein-Buchstaben-Abkuerzungen ("z.B.",
 *   "u.a."): nach Punkt/!/? nur, wenn davor ein Wort mit mindestens zwei
 *   Buchstaben steht und danach ein Grossbuchstabe folgt,
 * - erster Buchstabe nach Satzende gross, nur wenn eindeutig Satzanfang
 *   (Satzzeichen nach einem Wort mit mindestens zwei Buchstaben, dann
 *   Leerzeichen, dann Kleinbuchstabe). "z. B. wird" und "3. juli" bleiben
 *   unveraendert (Abkuerzung bzw. Ordinalzahl, kein sicherer Satzanfang).
 */
export function schaerfeInterpunktion(text: string): string {
  let result = text;
  // Leerraum um Zeilenumbrueche: Umbrueche bleiben erhalten (Sprachkommandos).
  result = result.replace(/[ \t]*\n[ \t]*/g, '\n');
  result = result.replace(/\n{3,}/g, '\n\n');
  // Doppelte Leerzeichen/Tabs zusammenziehen.
  result = result.replace(/[ \t]{2,}/g, ' ');
  // Leerzeichen vor Satzzeichen entfernen ("Hallo ." -> "Hallo.").
  result = result.replace(/ +([.,!?;:])/g, '$1');
  // Fehlendes Leerzeichen nach Komma/Semikolon/Doppelpunkt, nicht in Zahlen.
  result = result.replace(/(?<![0-9])([,;:])(?=\p{L})/gu, '$1 ');
  // Fehlendes Leerzeichen nach Satzende: nur Wortende (>= 2 Buchstaben)
  // vor dem Zeichen und Grossbuchstabe danach ("Dr.Meier" -> "Dr. Meier";
  // "z.B." und "www.beispiel.de" bleiben unveraendert).
  result = result.replace(/(?<=\p{L}{2})([.!?])(?=\p{Lu})/gu, '$1 ');
  // Grossschreibung nach eindeutigem Satzende. Bekannte Abkuerzungen mit
  // mindestens zwei Buchstaben (bzw., usw., ggf., ...) sind KEIN sicherer
  // Satzanfang und bleiben unangetastet (konservativ). Der Fixpunkt-Lauf
  // behandelt direkt aufeinanderfolgende Kurzsaetze ("ja! natürlich."),
  // deren Treffer sich sonst ueberlappen wuerden.
  const grossschreibung = /(\p{L}{2,})([.!?]) (\p{Ll})/gu;
  for (let schutz = 0; schutz < 20; schutz += 1) {
    const naechste = result.replace(
      grossschreibung,
      (treffer, wort: string, zeichen: string, klein: string) =>
        ABKUERZUNGEN.has(wort.toLowerCase()) ? treffer : `${wort}${zeichen} ${klein.toUpperCase()}`,
    );
    if (naechste === result) {
      break;
    }
    result = naechste;
  }
  return result;
}

/** Die konservative deutsche Standardliste eigenstaendiger Fuellwoerter. */
export const FUELLWOERTER = ['ähm', 'öhm', 'äh', 'hm'] as const;

/**
 * Die englischen Pendants (Paket B1). "um" ist zugleich ein deutsches Wort;
 * die Liste gilt deshalb NUR fuer Firmen mit Diktatsprache Englisch.
 */
export const FUELLWOERTER_EN = ['erm', 'uh', 'um'] as const;

/** Fuellwortliste je Diktatsprache. */
export function fuellwoerterFor(sprache: DictationLanguage): readonly string[] {
  return sprache === 'en' ? FUELLWOERTER_EN : FUELLWOERTER;
}

/** Alternation fuer die Fuellwort-Regexe (Listen sind regex-sichere Woerter). */
function fuellwortAlternation(sprache: DictationLanguage): string {
  return fuellwoerterFor(sprache).join('|');
}

/**
 * Fuellwoerter-Filter (Regel 2, Schalter, Default AN):
 * - entfernt eigenstaendige Fuellwoerter der Diktatsprache (deutsch:
 *   "aeh"/"aehm"/"oehm"/"hm"; englisch: "uh"/"um"/"erm"; nur ganze Woerter,
 *   case-insensitiv, Unicode-Wortgrenzen) inklusive eines direkt folgenden
 *   Kommas und der Leerzeichen-Bereinigung,
 * - zieht direkte Wortdopplungen zusammen ("das das" -> "das"); Dopplungen
 *   mit Komma ("sehr, sehr") bleiben erhalten. Grenzen siehe Modulkommentar.
 */
export function entferneFuellwoerter(text: string, sprache: DictationLanguage = 'de'): string {
  const alternation = fuellwortAlternation(sprache);
  const beginntMitFuellwort = new RegExp(`^(${alternation})(?=[^\\p{L}]|$)`, 'iu').test(text);

  // Ganze Fuellwoerter inkl. eines direkt folgenden Kommas entfernen.
  let result = text.replace(
    new RegExp(`(?<=^|[^\\p{L}])(${alternation})(?=[^\\p{L}]|$),?`, 'giu'),
    '',
  );
  // Hinterlassene Zeichenreste bereinigen: ", ," / ",." / haengende Kommas.
  result = result.replace(/,\s*,/g, ',');
  result = result.replace(/,\s*([.!?;:])/g, '$1');
  result = result.replace(/[ \t]{2,}/g, ' ');
  result = result.replace(/ +([.,!?;:])/g, '$1');
  // Nur wenn der Text mit einem entfernten Fuellwort begann: verwaiste
  // Satzzeichen/Leerraum am Anfang stammen aus der Entfernung ("Ähm." -> "").
  if (beginntMitFuellwort) {
    result = result.replace(/^[ \t]*[.,!?;:]*[ \t]*/, '');
  }

  // Direkte Wortdopplungen (durch genau ein Leerzeichen getrennt) einmalig
  // zusammenziehen, iterativ fuer "das das das". Case-insensitiver Vergleich,
  // das erste Vorkommen bleibt erhalten.
  const dopplung = /(?<=^|[^\p{L}])(\p{L}+) \1(?=[^\p{L}]|$)/giu;
  for (let schutz = 0; schutz < 50; schutz += 1) {
    const naechste = result.replace(dopplung, '$1');
    if (naechste === result) {
      break;
    }
    result = naechste;
  }

  // Ein am Textanfang entferntes Fuellwort war eindeutig Satzanfang: den
  // nachrueckenden Buchstaben grossschreiben.
  if (beginntMitFuellwort) {
    result = result.replace(/^\p{Ll}/u, (klein) => klein.toUpperCase());
  }
  return result;
}

/** Ein Sprachkommando: gesprochene Phrase -> Zeichen. */
export interface Sprachkommando {
  readonly phrase: string;
  readonly ersatz: string;
  /** Satzzeichen-Kommandos kleben am vorherigen Wort ("Hallo Punkt" -> "Hallo."). */
  readonly art: 'satzzeichen' | 'umbruch';
}

/**
 * Deutsche Kommandoliste; laengere Phrasen zuerst, damit "neuer Absatz" nie
 * als Teiltreffer eines kuerzeren Kommandos ("Absatz") verarbeitet wird.
 * Die Aliasse "Absatz" (allein) und "Zeilenumbruch" stammen aus dem
 * Praxistest (Entscheidung E43): Nutzer sprechen sie haeufiger als die
 * formalen Phrasen "neuer Absatz"/"neue Zeile".
 */
export const SPRACHKOMMANDOS: readonly Sprachkommando[] = [
  { phrase: 'ausrufezeichen', ersatz: '!', art: 'satzzeichen' },
  { phrase: 'zeilenumbruch', ersatz: '\n', art: 'umbruch' },
  { phrase: 'neuer absatz', ersatz: '\n\n', art: 'umbruch' },
  { phrase: 'fragezeichen', ersatz: '?', art: 'satzzeichen' },
  { phrase: 'doppelpunkt', ersatz: ':', art: 'satzzeichen' },
  { phrase: 'neue zeile', ersatz: '\n', art: 'umbruch' },
  { phrase: 'absatz', ersatz: '\n\n', art: 'umbruch' },
  { phrase: 'punkt', ersatz: '.', art: 'satzzeichen' },
  { phrase: 'komma', ersatz: ',', art: 'satzzeichen' },
];

/**
 * Englische Kommandoliste (Paket B1, gleiche Opt-in-Logik wie E38: auch
 * "period" und "comma" sind normale englische Woerter). Laengere Phrasen
 * zuerst ("new paragraph" vor "new line" ist hier unkritisch, aber die
 * Regel bleibt konsistent).
 */
export const SPRACHKOMMANDOS_EN: readonly Sprachkommando[] = [
  { phrase: 'new paragraph', ersatz: '\n\n', art: 'umbruch' },
  { phrase: 'paragraph', ersatz: '\n\n', art: 'umbruch' },
  { phrase: 'new line', ersatz: '\n', art: 'umbruch' },
  { phrase: 'period', ersatz: '.', art: 'satzzeichen' },
  { phrase: 'comma', ersatz: ',', art: 'satzzeichen' },
];

/** Kommandoliste je Diktatsprache. */
export function sprachkommandosFor(sprache: DictationLanguage): readonly Sprachkommando[] {
  return sprache === 'en' ? SPRACHKOMMANDOS_EN : SPRACHKOMMANDOS;
}

function istWortzeichen(char: string): boolean {
  return /[\p{L}\p{N}_]/u.test(char);
}

/** Satzzeichen, die Whisper um gesprochene Kommandowoerter setzt. */
const WHISPER_SATZZEICHEN = /[.,!?;:]/;

/**
 * Ersetzt EIN Kommando (case-insensitiv, nur als isoliertes Wort/Phrase mit
 * Unicode-Wortgrenzen). Von Whisper um das Kommandowort gesetzte Satzzeichen
 * gehoeren zum Treffer (Interpunktions-Toleranz, Entscheidung E43):
 * - Satzzeichen-Kommandos schlucken Leerraum plus je EIN Satzzeichen
 *   unmittelbar davor und danach ("Hallo, Punkt." -> "Hallo."; nie "Hallo,."
 *   oder "Hallo..").
 * - Umbruch-Kommandos schlucken Leerraum davor sowie EIN Satzzeichen plus
 *   Leerraum danach ("Erste Zeile. Neuer Absatz. Zweite" ->
 *   "Erste Zeile.\n\nZweite"); ein Satzzeichen DAVOR bleibt stehen, es ist
 *   das legitime Ende des vorigen Satzes.
 */
function ersetzeKommando(text: string, kommando: Sprachkommando): string {
  const haystack = text.toLowerCase();
  const needle = kommando.phrase;
  let result = '';
  let cursor = 0;
  for (;;) {
    const found = haystack.indexOf(needle, cursor);
    if (found === -1) {
      result += text.slice(cursor);
      return result;
    }
    const before = found === 0 ? '' : text.charAt(found - 1);
    let after = found + needle.length;
    const grenzeVorne = before === '' || !istWortzeichen(before);
    const grenzeHinten = after >= text.length || !istWortzeichen(text.charAt(after));
    if (!grenzeVorne || !grenzeHinten) {
      result += text.slice(cursor, found + 1);
      cursor = found + 1;
      continue;
    }
    // Linke Seite: Leerzeichen vor dem Kommando abschneiden.
    let start = found;
    while (start > cursor && (text.charAt(start - 1) === ' ' || text.charAt(start - 1) === '\t')) {
      start -= 1;
    }
    // Satzzeichen-Kommandos ersetzen ein von Whisper direkt davor gesetztes
    // Satzzeichen (", Punkt" -> "."): ein Zeichen schlucken, dann erneut
    // Leerraum ("Test , Punkt").
    if (kommando.art === 'satzzeichen') {
      if (start > cursor && WHISPER_SATZZEICHEN.test(text.charAt(start - 1))) {
        start -= 1;
        while (
          start > cursor &&
          (text.charAt(start - 1) === ' ' || text.charAt(start - 1) === '\t')
        ) {
          start -= 1;
        }
      }
    }
    // Rechte Seite: ein direkt folgendes Whisper-Satzzeichen verbrauchen.
    if (after < text.length && WHISPER_SATZZEICHEN.test(text.charAt(after))) {
      after += 1;
    }
    if (kommando.art === 'umbruch') {
      while (after < text.length && (text.charAt(after) === ' ' || text.charAt(after) === '\t')) {
        after += 1;
      }
    }
    result += text.slice(cursor, start) + kommando.ersatz;
    cursor = after;
  }
}

/**
 * Sprachkommandos (Regel 3, Schalter, Default AUS, Entscheidung E38):
 * deutsch "neue Zeile", "Zeilenumbruch", "neuer Absatz", "Absatz", "Punkt",
 * "Komma", "Fragezeichen", "Ausrufezeichen", "Doppelpunkt"; englisch
 * "new line", "new paragraph", "paragraph", "period", "comma" (Paket B1,
 * Aliasse aus E43). Bewusst Opt-in: die Kommandowoerter sind auch normale
 * Woerter der jeweiligen Sprache; bei aktiviertem Schalter trifft die Regel
 * auch deren normale Verwendung (siehe Modulkommentar).
 */
export function ersetzeSprachkommandos(text: string, sprache: DictationLanguage = 'de'): string {
  let result = text;
  for (const kommando of sprachkommandosFor(sprache)) {
    result = ersetzeKommando(result, kommando);
  }
  return result;
}

/**
 * Die komplette Aufbereitungs-Pipeline (siehe Modulkommentar). Wirkt auf dem
 * finalen Segmenttext NACH der Ersetzungsliste (vokabular.ts) und VOR
 * Zustellung/Speicherung; die Wortzahl im Front-Matter zaehlt damit den
 * finalen Text. `sprache` waehlt Fuellwort- und Kommandoliste (Paket B1).
 */
export function aufbereitenText(
  text: string,
  options: AufbereitungOptions,
  sprache: DictationLanguage = 'de',
): string {
  let result = schaerfeInterpunktion(text);
  if (options.fuellwoerterEntfernen) {
    result = entferneFuellwoerter(result, sprache);
  }
  if (options.sprachkommandos) {
    result = ersetzeSprachkommandos(result, sprache);
  }
  // Nachlauf: raeumt Leerraum und Grossschreibung auf, die die Schritte 2/3
  // hinterlassen (idempotent, deterministisch).
  result = schaerfeInterpunktion(result);
  return result.trim();
}
