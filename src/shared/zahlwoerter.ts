/**
 * Deutsche Zahlwoerter als Ziffern lesen ("zweitausendvierundzwanzig" -> 2024).
 *
 * Wofuer das gebraucht wird: Beim Diktat sagt der Sprecher "zwanzig
 * Milligramm", das Transkript schreibt "20 mg". Beides ist richtig, nur die
 * Schreibkonvention unterscheidet sich. Fuer die Qualitaetsmessung (wer.ts)
 * zaehlt so ein Formatunterschied sonst als Erkennungsfehler und verdeckt die
 * echten Fehler. Dieses Modul stellt beide Seiten auf dieselbe Form.
 *
 * Bewusst KEIN Modell und keine Fremdgrammatik: eine endliche Wortliste plus
 * die Bauregeln des deutschen Zahlworts. Alles deterministisch, auditierbar und
 * ohne Netz, wie jede andere Textverarbeitung in VoiceWall auch.
 *
 * Grenze, ehrlich benannt: Der Parser liest ein Wort nur dann als Zahl, wenn es
 * VOLLSTAENDIG aufgeht. "Achtung" wird nicht zu 8, weil "ung" uebrig bliebe.
 * Echte Doppeldeutigkeiten des Deutschen bleiben aber bestehen: das Verb
 * "achten" und der Artikel "ein" sind als Wort nicht von der Zahl zu
 * unterscheiden. Fuer den Messzweck ist das unschaedlich, weil die Umformung
 * beide Vergleichsseiten gleich trifft.
 *
 * Dieses Modul bleibt plattformneutral (kein Node/Electron/DOM).
 */

/** Einerzahlwoerter samt der Formen, die als eigenstaendiges Wort vorkommen. */
const EINER: ReadonlyMap<string, number> = new Map([
  ['null', 0],
  ['ein', 1],
  ['eins', 1],
  ['eine', 1],
  ['zwei', 2],
  ['drei', 3],
  ['vier', 4],
  ['fuenf', 5],
  ['sechs', 6],
  ['sieben', 7],
  ['acht', 8],
  ['neun', 9],
]);

/** Zahlwoerter von zehn bis neunzehn (unregelmaessig, deshalb als Liste). */
const TEENS: ReadonlyMap<string, number> = new Map([
  ['zehn', 10],
  ['elf', 11],
  ['zwoelf', 12],
  ['dreizehn', 13],
  ['vierzehn', 14],
  ['fuenfzehn', 15],
  ['sechzehn', 16],
  ['siebzehn', 17],
  ['achtzehn', 18],
  ['neunzehn', 19],
]);

/** Die vollen Zehner. "dreissig" steht hier in ss-Form (siehe vereinheitliche). */
const ZEHNER: ReadonlyMap<string, number> = new Map([
  ['zwanzig', 20],
  ['dreissig', 30],
  ['vierzig', 40],
  ['fuenfzig', 50],
  ['sechzig', 60],
  ['siebzig', 70],
  ['achtzig', 80],
  ['neunzig', 90],
]);

/**
 * Ordnungszahlen mit unregelmaessigem Stamm ("erste", "dritte", "siebte").
 * Die regelmaessigen ("zwoelfte", "zwanzigste") entstehen aus Stamm plus
 * Endung und laufen ueber die Endungsliste.
 */
const ORDINAL_SONDERFAELLE: ReadonlyMap<string, number> = new Map([
  ['erst', 1],
  ['dritt', 3],
  ['siebt', 7],
]);

/**
 * Endungen der Ordnungszahl in allen Beugungen ("der zwoelfte", "des
 * zwoelften", "am einunddreissigsten"). Laengere zuerst, damit "sten" nicht als
 * "ten" gelesen wird.
 */
const ORDINAL_ENDUNGEN: readonly string[] = [
  'sten',
  'stem',
  'ster',
  'stes',
  'ste',
  'ten',
  'tem',
  'ter',
  'tes',
  'te',
  'en',
  'em',
  'er',
  'es',
  'e',
];

/**
 * Vereinheitlicht die Schreibweise fuer den Vergleich: Kleinschreibung, ss
 * statt ss-Ligatur (Schweizer Schreibweise faellt damit zusammen) und Umlaute
 * als Digraph. So passt "gemaess" auf "gemaess" und "zwoelf" auf "zwoelf",
 * unabhaengig davon, welche Variante das Transkript liefert.
 */
export function vereinheitliche(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue');
}

/** Liest "einundzwanzig", "zwanzig", "zwoelf", "drei" (alles unter 100). */
function unter100(wort: string): number | null {
  const zehner = ZEHNER.get(wort);
  if (zehner !== undefined) {
    return zehner;
  }
  const teen = TEENS.get(wort);
  if (teen !== undefined) {
    return teen;
  }
  const einer = EINER.get(wort);
  if (einer !== undefined) {
    return einer;
  }
  // Zusammensetzung "<einer>und<zehner>". Der Trenner kommt genau einmal vor;
  // ein zweites "und" gibt es in keinem Zahlwort unter 100.
  const teile = wort.split('und');
  if (teile.length !== 2) {
    return null;
  }
  const [vorne, hinten] = teile;
  const a = vorne === undefined ? undefined : EINER.get(vorne);
  const b = hinten === undefined ? undefined : ZEHNER.get(hinten);
  if (a === undefined || b === undefined || a === 0) {
    return null;
  }
  return a + b;
}

/** Liest alles unter 1000, also zusaetzlich die Hunderter. */
function unter1000(wort: string): number | null {
  const stelle = wort.indexOf('hundert');
  if (stelle === -1) {
    return unter100(wort);
  }
  const vorne = wort.slice(0, stelle);
  const hinten = wort.slice(stelle + 'hundert'.length);
  // "hundert" ohne Zahl davor bedeutet 1 ("hundertzwanzig").
  const faktor = vorne === '' ? 1 : unter100(vorne);
  if (faktor === null || faktor === 0) {
    return null;
  }
  const rest = hinten === '' ? 0 : unter100(hinten);
  if (rest === null) {
    return null;
  }
  return faktor * 100 + rest;
}

/** Liest alles unter einer Million, also zusaetzlich die Tausender. */
function unter1000000(wort: string): number | null {
  const stelle = wort.indexOf('tausend');
  if (stelle === -1) {
    return unter1000(wort);
  }
  const vorne = wort.slice(0, stelle);
  const hinten = wort.slice(stelle + 'tausend'.length);
  const faktor = vorne === '' ? 1 : unter1000(vorne);
  if (faktor === null || faktor === 0) {
    return null;
  }
  const rest = hinten === '' ? 0 : unter1000(hinten);
  if (rest === null) {
    return null;
  }
  return faktor * 1000 + rest;
}

/**
 * Liest ein deutsches Kardinalzahlwort als Zahl oder gibt null zurueck, wenn
 * das Wort keines ist. Das Wort muss vollstaendig aufgehen.
 */
export function leseKardinalzahl(wort: string): number | null {
  const w = vereinheitliche(wort);
  if (w === '') {
    return null;
  }
  const stelle = w.indexOf('million');
  if (stelle === -1) {
    return unter1000000(w);
  }
  const laenge = w.startsWith('millionen', stelle) ? 'millionen'.length : 'million'.length;
  const vorne = w.slice(0, stelle);
  const hinten = w.slice(stelle + laenge);
  const faktor = vorne === '' ? 1 : unter1000(vorne);
  if (faktor === null || faktor === 0) {
    return null;
  }
  const rest = hinten === '' ? 0 : unter1000000(hinten);
  if (rest === null) {
    return null;
  }
  return faktor * 1000000 + rest;
}

/**
 * Liest ein deutsches Ordinalzahlwort ("zwoelften", "einunddreissigsten",
 * "dritte") als Zahl oder gibt null zurueck. Die Endung wird abgetrennt, der
 * Rest muss ein gueltiges Kardinalzahlwort oder ein bekannter Sonderstamm sein.
 */
export function leseOrdinalzahl(wort: string): number | null {
  const w = vereinheitliche(wort);
  for (const endung of ORDINAL_ENDUNGEN) {
    if (!w.endsWith(endung) || w.length === endung.length) {
      continue;
    }
    const stamm = w.slice(0, w.length - endung.length);
    const sonderfall = ORDINAL_SONDERFAELLE.get(stamm);
    if (sonderfall !== undefined) {
      return sonderfall;
    }
    const zahl = leseKardinalzahl(stamm);
    if (zahl !== null) {
      return zahl;
    }
  }
  return null;
}

/**
 * Liest ein Wort als Zahl, egal ob Grund- oder Ordnungszahl. Zuerst die
 * Grundzahl, denn "acht" ist 8 und nicht die Ordnungszahl von irgendetwas.
 */
export function leseZahlwort(wort: string): number | null {
  return leseKardinalzahl(wort) ?? leseOrdinalzahl(wort);
}
