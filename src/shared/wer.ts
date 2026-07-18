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

/**
 * Berechnet die Wortfehlerrate zwischen Referenz und Hypothese ueber die
 * Levenshtein-Distanz auf Wortebene. Die Fehlerarten werden getrennt
 * ausgewiesen, was aussagekraeftiger ist als die Gesamtzahl allein.
 *
 * Speicherschonend: nur zwei Zeilen der Distanzmatrix werden gehalten. Der
 * Rueckweg (Backtrace) fuer die Fehlerarten laeuft ueber eine kompakte
 * Operationsmatrix.
 */
export function berechneWer(referenz: string, hypothese: string): WerErgebnis {
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

  // Rueckweg von (n, m) nach (0, 0), um die Fehlerarten zu zaehlen.
  let ersetzungen = 0;
  let loeschungen = 0;
  let einfuegungen = 0;
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const schritt = op[i]?.[j] ?? (i > 0 ? D : I);
    if (schritt === G) {
      i -= 1;
      j -= 1;
    } else if (schritt === S) {
      ersetzungen += 1;
      i -= 1;
      j -= 1;
    } else if (schritt === D) {
      loeschungen += 1;
      i -= 1;
    } else {
      einfuegungen += 1;
      j -= 1;
    }
  }

  return {
    wer: (ersetzungen + loeschungen + einfuegungen) / n,
    woerter: n,
    ersetzungen,
    loeschungen,
    einfuegungen,
  };
}

/**
 * Berechnet die WER nach der ueblichen Normierung (Kleinschreibung, ohne
 * Interpunktion). Das ist der Standardweg, um die reine Worterkennung zu messen,
 * unabhaengig von Gross- und Kleinschreibung.
 */
export function berechneWerNormiert(referenz: string, hypothese: string): WerErgebnis {
  return berechneWer(normalisiereText(referenz), normalisiereText(hypothese));
}
