/**
 * Wortfehlerrate (Word Error Rate, WER) und die dafuer noetige Textnormierung.
 *
 * Reines, portables Modul ohne Node- oder DOM-Abhaengigkeit (ESLint-Modulgrenze
 * src/shared). Es dient der Qualitaetsmessung der Spracherkennung: Wie stark
 * weicht ein Transkript von einem von Hand erstellten Referenztext ab? Die WER
 * ist das Standardmass dafuer und die Grundlage jeder belastbaren Aussage
 * darueber, ob eine Aenderung die Erkennung verbessert oder verschlechtert.
 *
 * WER = (Ersetzungen + Loeschungen + Einfuegungen) / Woerter im Referenztext.
 * Der Wert 0 bedeutet fehlerfrei, 1 bedeutet jedes Wort falsch. Werte ueber 1
 * sind moeglich, wenn mehr eingefuegt als im Referenztext steht.
 */

import { leseZahlwort, vereinheitliche } from './zahlwoerter';

/**
 * Normiert einen Text fuer den Vergleich: Kleinschreibung, Satzzeichen entfernt,
 * Mehrfach-Leerraum zusammengefasst. So zaehlt "Guten Morgen!" wie "guten
 * morgen". Ob normiert verglichen wird, entscheidet der Aufrufer: die rohe WER
 * (ohne Normierung) misst auch Gross- und Kleinschreibung und Interpunktion mit.
 */
export function normalisiereText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[.,;:!?()"'–—\-…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Abkuerzungen, die im Diktat gesprochen, aber vom Transkript geschrieben
 * werden ("zwanzig Milligramm" gegen "20 mg"). Fuer die inhaltliche Messung
 * wird immer die ausgeschriebene Form eingesetzt, damit beide Schreibweisen
 * zusammenfallen. Bewusst knapp gehalten: nur was im Diktat wirklich vorkommt.
 */
const EINHEITEN: ReadonlyMap<string, string> = new Map([
  ['mg', 'milligramm'],
  ['g', 'gramm'],
  ['kg', 'kilogramm'],
  ['ml', 'milliliter'],
  ['l', 'liter'],
  ['mm', 'millimeter'],
  ['cm', 'zentimeter'],
  ['m', 'meter'],
  ['km', 'kilometer'],
  ['qm', 'quadratmeter'],
  ['m²', 'quadratmeter'],
  ['m2', 'quadratmeter'],
  ['m³', 'kubikmeter'],
  ['m3', 'kubikmeter'],
  ['cbm', 'kubikmeter'],
  ['%', 'prozent'],
  ['€', 'euro'],
  ['eur', 'euro'],
  ['§', 'paragraf'],
  ['paragraph', 'paragraf'],
  ['°', 'grad'],
  ['nr', 'nummer'],
  ['abs', 'absatz'],
  ['ca', 'circa'],
  ['zzgl', 'zuzueglich'],
  ['inkl', 'inklusive'],
]);

/** Die ausgeschriebenen Einheiten als Grundform (Ziel der Aufloesung oben). */
const EINHEIT_GRUNDFORMEN: ReadonlySet<string> = new Set(EINHEITEN.values());

/**
 * Nimmt einer ausgeschriebenen Einheit die Beugung ("Millimetern" ->
 * "millimeter"). Noetig, weil die Einheit gesprochen im Satz gebeugt wird, das
 * Kuerzel im Transkript aber nicht ("drei mm" gegen "drei Millimetern").
 * Wirkt nur auf bekannte Einheiten, damit kein normales Wort verstuemmelt wird.
 */
function entbeugeEinheit(wort: string): string {
  if (!wort.endsWith('n')) {
    return wort;
  }
  const grundform = wort.slice(0, -1);
  return EINHEIT_GRUNDFORMEN.has(grundform) ? grundform : wort;
}

/**
 * Format-neutrale Normierung fuer die inhaltliche Messung. Sie stellt beide
 * Vergleichsseiten auf dieselbe Schreibkonvention, damit ein reiner
 * Formatunterschied nicht als Erkennungsfehler zaehlt:
 *
 * - Zahlwoerter werden zu Ziffern ("zweitausendvierundzwanzig" -> "2024"),
 * - Tausenderpunkte fallen weg ("58.000" -> "58000"),
 * - das Dezimalkomma wird gesprochen ("23,5" -> "23 komma 5"),
 * - Einheiten und Zeichen werden ausgeschrieben ("mg" -> "milligramm",
 *   "§" -> "paragraf"),
 * - Umlaute und Eszett fallen mit ihren Ersatzschreibungen zusammen
 *   ("gemaess" gegen "gemaess").
 *
 * WICHTIG, damit die Zahl nicht ueberinterpretiert wird: Diese Sicht ist
 * bewusst grosszuegig und kann echte Unterschiede verdecken (etwa "Masse"
 * gegen "Masze"). Sie ersetzt die normierte WER deshalb NICHT, sondern steht
 * neben ihr. Die normierte WER bleibt das strenge Mass, die inhaltliche zeigt,
 * wie viel davon ueberhaupt ein Erkennungsfehler ist.
 */
export function normalisiereInhaltlich(text: string): string {
  let s = vereinheitliche(text);
  // Zeichen freistellen, damit sie eigene Woerter werden ("20%" -> "20 %").
  s = s.replace(/([%€§°])/g, ' $1 ');
  // Tausenderpunkt und Tausenderleerzeichen entfernen, bevor die Interpunktion
  // faellt (sonst zerfaellt "58.000" in zwei Woerter).
  s = s.replace(/(?<!\d)(\d{1,3})((?:[. ]\d{3})+)(?!\d)/g, (_treffer, kopf: string, rest: string) =>
    [kopf, rest.replace(/[. ]/g, '')].join(''),
  );
  // Dezimalkomma so schreiben, wie es gesprochen wird.
  s = s.replace(/(\d),(\d)/g, '$1 komma $2');
  s = normalisiereText(s);
  return inWoerter(s)
    .map((wort) => {
      const einheit = EINHEITEN.get(wort);
      if (einheit !== undefined) {
        return einheit;
      }
      const zahl = leseZahlwort(wort);
      return zahl === null ? entbeugeEinheit(wort) : String(zahl);
    })
    .join(' ');
}

/** Zerlegt einen Text in Woerter. Leerer Text ergibt eine leere Liste. */
export function inWoerter(text: string): string[] {
  const beschnitten = text.trim();
  return beschnitten === '' ? [] : beschnitten.split(/\s+/);
}

/** Ergebnis einer WER-Berechnung mit aufgeschluesselten Fehlerarten. */
export interface WerErgebnis {
  /** Die Wortfehlerrate, (S + D + I) / N. */
  readonly wer: number;
  /** Anzahl Woerter im Referenztext (N). */
  readonly woerter: number;
  /** Ersetzungen (Substitutions). */
  readonly ersetzungen: number;
  /** Loeschungen (Deletions): im Referenztext, aber nicht im Transkript. */
  readonly loeschungen: number;
  /** Einfuegungen (Insertions): im Transkript, aber nicht im Referenztext. */
  readonly einfuegungen: number;
}

/** Eine einzelne Ausrichtungsoperation zwischen Referenz und Hypothese. */
export interface WerOperation {
  readonly art: 'gleich' | 'ersetzung' | 'loeschung' | 'einfuegung';
  /** Das Referenzwort (fehlt bei einer Einfuegung). */
  readonly referenz?: string;
  /** Das Wort der Hypothese (fehlt bei einer Loeschung). */
  readonly hypothese?: string;
}

/** WER-Ergebnis samt der Ausrichtung, die zu ihm gefuehrt hat. */
export interface WerDiffErgebnis extends WerErgebnis {
  /** Die Operationen in Textreihenfolge (auch die uebereinstimmenden). */
  readonly operationen: readonly WerOperation[];
}

/**
 * Berechnet die Wortfehlerrate zwischen Referenz und Hypothese ueber die
 * Levenshtein-Distanz auf Wortebene und liefert zusaetzlich die Ausrichtung.
 * Die Fehlerarten werden getrennt ausgewiesen, was aussagekraeftiger ist als
 * die Gesamtzahl allein; die Operationsliste macht sichtbar, WELCHE Woerter
 * abweichen. Ohne sie ist eine WER-Zahl nur ein Thermometer ohne Diagnose.
 *
 * Speicherschonend: nur zwei Zeilen der Distanzmatrix werden gehalten. Der
 * Rueckweg (Backtrace) laeuft ueber eine kompakte Operationsmatrix.
 *
 * Hinweis zur Mehrdeutigkeit: bei gleichen Kosten ist die Ausrichtung nicht
 * eindeutig (eine Ersetzung kostet so viel wie Loeschung plus Einfuegung an
 * anderer Stelle). Die Gesamtzahl der Fehler ist es immer.
 */
export function berechneWerMitDiff(referenz: string, hypothese: string): WerDiffErgebnis {
  const ref = inWoerter(referenz);
  const hyp = inWoerter(hypothese);
  const n = ref.length;
  const m = hyp.length;

  if (n === 0) {
    // Ohne Referenzwoerter ist jede Hypothese reine Einfuegung. Eine WER ist
    // dann nicht sinnvoll definiert; als Konvention: 0 bei leerer Hypothese,
    // sonst 1 (alles ueberfluessig).
    return {
      wer: m === 0 ? 0 : 1,
      woerter: 0,
      ersetzungen: 0,
      loeschungen: 0,
      einfuegungen: m,
      operationen: hyp.map((wort) => ({ art: 'einfuegung', hypothese: wort })),
    };
  }

  // Operationsmatrix fuer den Rueckweg: 'g' gleich, 's' Ersetzung, 'd'
  // Loeschung, 'i' Einfuegung.
  const op: Uint8Array[] = [];
  const G = 0;
  const S = 1;
  const D = 2;
  const I = 3;

  let vorherige = new Array<number>(m + 1);
  for (let j = 0; j <= m; j += 1) {
    vorherige[j] = j;
  }
  const ersteZeile = new Uint8Array(m + 1);
  for (let j = 1; j <= m; j += 1) {
    ersteZeile[j] = I;
  }
  op.push(ersteZeile);

  for (let i = 1; i <= n; i += 1) {
    const aktuelle = new Array<number>(m + 1);
    const opZeile = new Uint8Array(m + 1);
    aktuelle[0] = i;
    opZeile[0] = D;
    for (let j = 1; j <= m; j += 1) {
      const gleich = ref[i - 1] === hyp[j - 1];
      // Alle Indizes liegen im gueltigen Bereich (0..m bzw. 0..n). Das ?? 0
      // erfuellt nur die strikte Index-Pruefung und ist nie wirksam.
      const diagonal = vorherige[j - 1] ?? 0;
      const oben = vorherige[j] ?? 0;
      const links = aktuelle[j - 1] ?? 0;
      const kostenErsetzung = diagonal + (gleich ? 0 : 1);
      const kostenLoeschung = oben + 1;
      const kostenEinfuegung = links + 1;
      let best = kostenErsetzung;
      let beste = gleich ? G : S;
      if (kostenLoeschung < best) {
        best = kostenLoeschung;
        beste = D;
      }
      if (kostenEinfuegung < best) {
        best = kostenEinfuegung;
        beste = I;
      }
      aktuelle[j] = best;
      opZeile[j] = beste;
    }
    vorherige = aktuelle;
    op.push(opZeile);
  }

  // Rueckweg von (n, m) nach (0, 0), um die Fehlerarten zu zaehlen und die
  // Ausrichtung aufzuzeichnen. Gesammelt wird rueckwaerts, am Ende gedreht.
  let ersetzungen = 0;
  let loeschungen = 0;
  let einfuegungen = 0;
  const rueckwaerts: WerOperation[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const schritt = op[i]?.[j] ?? (i > 0 ? D : I);
    if (schritt === G) {
      rueckwaerts.push({ art: 'gleich', referenz: ref[i - 1] ?? '', hypothese: hyp[j - 1] ?? '' });
      i -= 1;
      j -= 1;
    } else if (schritt === S) {
      rueckwaerts.push({
        art: 'ersetzung',
        referenz: ref[i - 1] ?? '',
        hypothese: hyp[j - 1] ?? '',
      });
      ersetzungen += 1;
      i -= 1;
      j -= 1;
    } else if (schritt === D) {
      rueckwaerts.push({ art: 'loeschung', referenz: ref[i - 1] ?? '' });
      loeschungen += 1;
      i -= 1;
    } else {
      rueckwaerts.push({ art: 'einfuegung', hypothese: hyp[j - 1] ?? '' });
      einfuegungen += 1;
      j -= 1;
    }
  }
  rueckwaerts.reverse();

  return {
    wer: (ersetzungen + loeschungen + einfuegungen) / n,
    woerter: n,
    ersetzungen,
    loeschungen,
    einfuegungen,
    operationen: rueckwaerts,
  };
}

/**
 * Wie berechneWerMitDiff, nur ohne die Ausrichtung (die uebliche Messung).
 */
export function berechneWer(referenz: string, hypothese: string): WerErgebnis {
  return berechneWerMitDiff(referenz, hypothese);
}

/**
 * Berechnet die WER nach der ueblichen Normierung (Kleinschreibung, ohne
 * Interpunktion). Das ist der Standardweg, um die reine Worterkennung zu messen,
 * unabhaengig von Gross- und Kleinschreibung.
 */
export function berechneWerNormiert(referenz: string, hypothese: string): WerErgebnis {
  return berechneWer(normalisiereText(referenz), normalisiereText(hypothese));
}

/** Wie berechneWerNormiert, liefert zusaetzlich die Ausrichtung. */
export function berechneWerNormiertMitDiff(referenz: string, hypothese: string): WerDiffErgebnis {
  return berechneWerMitDiff(normalisiereText(referenz), normalisiereText(hypothese));
}

/**
 * Berechnet die WER auf der format-neutralen Sicht (siehe
 * normalisiereInhaltlich): Zahl- und Einheitenschreibung zaehlen nicht als
 * Fehler. Das ist die Zahl, die sagt, wie viel WIRKLICH falsch verstanden
 * wurde. Sie ist immer kleiner oder gleich der normierten WER.
 */
export function berechneWerInhaltlichMitDiff(referenz: string, hypothese: string): WerDiffErgebnis {
  return berechneWerMitDiff(normalisiereInhaltlich(referenz), normalisiereInhaltlich(hypothese));
}

/**
 * Formatiert die Abweichungen einer Ausrichtung als kurze, lesbare Liste
 * ("mg -> milligramm", "[fehlt] zwanzig", "[zuviel] eine"). Uebereinstimmende
 * Woerter werden weggelassen, sonst ertrinkt der Befund im Rauschen.
 */
export function formatiereWerAbweichungen(operationen: readonly WerOperation[]): string[] {
  const zeilen: string[] = [];
  for (const op of operationen) {
    if (op.art === 'gleich') {
      continue;
    }
    if (op.art === 'ersetzung') {
      zeilen.push(`${op.referenz ?? ''} -> ${op.hypothese ?? ''}`);
    } else if (op.art === 'loeschung') {
      zeilen.push(`[fehlt] ${op.referenz ?? ''}`);
    } else {
      zeilen.push(`[zuviel] ${op.hypothese ?? ''}`);
    }
  }
  return zeilen;
}
