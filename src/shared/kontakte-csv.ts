/**
 * Kontaktverzeichnis als CSV lesen und schreiben.
 *
 * Warum CSV und nicht Excel: Eine echte .xlsx-Datei zu lesen hiesse, einen
 * ZIP- und XML-Verarbeiter in ein Produkt zu holen, das mit schlanker
 * Lieferkette wirbt. Die verbreitete Bibliothek dafuer liegt auf npm seit
 * Jahren unveraendert mit bekannten Luecken (unter anderem Prototype
 * Pollution beim Lesen praeparierter Dateien); die reparierten Fassungen gibt
 * es nur am Paketmanager vorbei. Fuer eine Liste aus Name und Adresse ist das
 * ein schlechtes Geschaeft. Excel schreibt und liest CSV von Haus aus, und
 * das Parsen sind ein paar Dutzend Zeilen ohne jede Abhaengigkeit.
 *
 * Zwei Fallen, die dieses Modul ausdruecklich abfaengt, weil sie in der
 * Praxis jeden zweiten Import zerlegen:
 * 1. Deutsches Excel trennt mit SEMIKOLON, nicht mit Komma. Erkannt wird
 *    anhand der Kopfzeile, nicht geraten.
 * 2. Excel schreibt je nach Version UTF-8 mit BOM oder Windows-1252. Das
 *    Dekodieren passiert im Aufrufer (er hat die Bytes), die BOM-Entfernung
 *    hier.
 *
 * Dieses Modul bleibt plattformneutral (kein Node/Electron/DOM).
 */
import { kontaktSchema, MAX_KONTAKTE, type Kontakt } from './mailbefehl';

/**
 * Erkennt eine Spaltenueberschrift, egal wie sie geschrieben ist.
 *
 * Bewusst KEINE feste Wortliste: "Mailadresse", "E-Mail-Adresse", "E Mail",
 * "eMail_Adresse" sind alle dasselbe, und eine Liste ist nie vollstaendig.
 * Verglichen wird deshalb auf einer entschlackten Form (klein, ohne
 * Trennzeichen) mit Teilwoertern.
 */
function normalisiereUeberschrift(feld: string): string {
  return feld
    .toLowerCase()
    .normalize('NFC')
    .replace(/[\s._-]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

/** Ist diese Ueberschrift eine Adress-Spalte? */
function istAdressUeberschrift(feld: string): boolean {
  const wert = normalisiereUeberschrift(feld);
  return wert.includes('mail') || wert === 'adresse' || wert.includes('address');
}

/** Ist diese Ueberschrift eine Namens-Spalte? */
function istNamensUeberschrift(feld: string): boolean {
  const wert = normalisiereUeberschrift(feld);
  return (
    wert.includes('name') ||
    wert.includes('kontakt') ||
    wert.includes('empfaenger') ||
    wert.includes('ansprechpartner') ||
    wert.includes('contact') ||
    wert.includes('recipient')
  );
}

/**
 * Ist diese Ueberschrift eine Firmen-Spalte? Sie wird nur gebraucht, um sie
 * NICHT mit dem Namen zu verwechseln: eine Tabelle mit Firma, Name und
 * Mailadresse ist der Normalfall, und "Firma" steht darin oft zuerst.
 */
function istFirmenUeberschrift(feld: string): boolean {
  const wert = normalisiereUeberschrift(feld);
  return (
    wert.includes('firma') ||
    wert.includes('unternehmen') ||
    wert.includes('company') ||
    wert.includes('organisation') ||
    wert.includes('organization')
  );
}

/** Sieht dieser Wert nach einer E-Mail-Adresse aus? */
function siehtNachAdresseAus(wert: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wert.trim());
}

/**
 * Bestimmt die Spalte mit den Adressen anhand des INHALTS: welche Spalte
 * enthaelt in den Datenzeilen am haeufigsten etwas mit At-Zeichen und Punkt?
 *
 * Das ist die verlaesslichste Erkennung ueberhaupt, weil sie ohne
 * Ueberschriften auskommt und in jeder Sprache funktioniert. Sie greift,
 * wenn die Kopfzeile nichts hergibt oder gar keine da ist.
 */
function findeAdressSpalteImInhalt(zeilen: readonly string[][]): number {
  let besteSpalte = -1;
  let besteTreffer = 0;
  const spalten = Math.max(0, ...zeilen.map((felder) => felder.length));
  for (let spalte = 0; spalte < spalten; spalte += 1) {
    const treffer = zeilen.filter((felder) => siehtNachAdresseAus(felder[spalte] ?? '')).length;
    if (treffer > besteTreffer) {
      besteTreffer = treffer;
      besteSpalte = spalte;
    }
  }
  return besteSpalte;
}

/** Ergebnis eines Imports: was uebernommen wurde und was nicht. */
export interface CsvImportErgebnis {
  /** Die gueltigen Eintraege in Dateireihenfolge. */
  readonly kontakte: readonly Kontakt[];
  /**
   * Zeilen, die verworfen wurden, mit Zeilennummer und Grund. Bewusst
   * ausgewiesen statt still zu schlucken: wer 200 Zeilen importiert, muss
   * erfahren, dass drei davon fehlen.
   */
  readonly verworfen: readonly string[];
}

/** Zerlegt eine CSV-Zeile unter Beachtung von Anfuehrungszeichen. */
function zerlegeZeile(zeile: string, trenner: string): string[] {
  const felder: string[] = [];
  let aktuell = '';
  let inAnfuehrung = false;
  for (let i = 0; i < zeile.length; i += 1) {
    const zeichen = zeile.charAt(i);
    if (inAnfuehrung) {
      if (zeichen === '"') {
        // Zwei Anfuehrungszeichen hintereinander sind ein echtes Zeichen.
        if (zeile.charAt(i + 1) === '"') {
          aktuell += '"';
          i += 1;
        } else {
          inAnfuehrung = false;
        }
      } else {
        aktuell += zeichen;
      }
      continue;
    }
    if (zeichen === '"') {
      inAnfuehrung = true;
    } else if (zeichen === trenner) {
      felder.push(aktuell);
      aktuell = '';
    } else {
      aktuell += zeichen;
    }
  }
  felder.push(aktuell);
  return felder.map((feld) => feld.trim());
}

/** Waehlt das Trennzeichen anhand der ersten Zeile (Semikolon vor Komma). */
function erkenneTrenner(kopfzeile: string): string {
  const semikolons = (kopfzeile.match(/;/g) ?? []).length;
  const kommas = (kopfzeile.match(/,/g) ?? []).length;
  if (semikolons === 0 && kommas === 0) {
    // Nur eine Spalte: das Trennzeichen ist dann egal.
    return ';';
  }
  return semikolons >= kommas ? ';' : ',';
}

/**
 * Liest ein Kontaktverzeichnis aus CSV-Text.
 *
 * Eine Kopfzeile ist erlaubt, aber nicht noetig: Wird in der ersten Zeile
 * eine bekannte Spaltenueberschrift erkannt, bestimmt sie die Reihenfolge,
 * sonst gilt "Name, Adresse". Ungueltige Zeilen werden ausgewiesen, nicht
 * still uebergangen; eine kaputte Zeile darf den Rest des Imports nicht
 * verhindern.
 */
export function parseKontakteCsv(inhalt: string): CsvImportErgebnis {
  const ohneBom = inhalt.replace(/^\uFEFF/, '');
  const rohzeilen = ohneBom
    .split(/\r?\n/)
    .map((zeile) => zeile.trim())
    .filter((zeile) => zeile.length > 0);
  if (rohzeilen.length === 0) {
    return { kontakte: [], verworfen: [] };
  }
  const trenner = erkenneTrenner(rohzeilen[0] ?? '');
  const zerlegt = rohzeilen.map((zeile) => zerlegeZeile(zeile, trenner));

  // 1. Kopfzeile auswerten, falls eine da ist. Erkannt wird sie daran, dass
  //    sie selbst keine Adresse enthaelt und mindestens eine bekannte
  //    Ueberschrift traegt.
  const kopf = zerlegt[0] ?? [];
  const kopfHatAdresse = kopf.some((feld) => siehtNachAdresseAus(feld));
  const kopfErkannt =
    !kopfHatAdresse &&
    kopf.some(
      (feld) =>
        istAdressUeberschrift(feld) || istNamensUeberschrift(feld) || istFirmenUeberschrift(feld),
    );
  const start = kopfErkannt ? 1 : 0;
  const daten = zerlegt.slice(start);

  let adresseIndex = kopfErkannt ? kopf.findIndex((feld) => istAdressUeberschrift(feld)) : -1;
  let nameIndex = kopfErkannt ? kopf.findIndex((feld) => istNamensUeberschrift(feld)) : -1;

  // 2. Was die Ueberschrift nicht hergibt, entscheidet der Inhalt: die
  //    Adressspalte ist die, in der Adressen stehen. Das funktioniert auch
  //    ganz ohne Kopfzeile und in jeder Sprache.
  if (adresseIndex === -1) {
    adresseIndex = findeAdressSpalteImInhalt(daten);
  }
  if (nameIndex === -1) {
    // Ohne Namensspalte in der Kopfzeile: eine Firmenspalte nehmen, wenn es
    // sie gibt (Firmenkontakte ohne Ansprechpartner sind ueblich), sonst die
    // erste Spalte, die nicht die Adressspalte ist.
    const firmaIndex = kopfErkannt ? kopf.findIndex((feld) => istFirmenUeberschrift(feld)) : -1;
    if (firmaIndex !== -1 && firmaIndex !== adresseIndex) {
      nameIndex = firmaIndex;
    } else {
      const spalten = Math.max(0, ...daten.map((felder) => felder.length));
      nameIndex = 0;
      for (let spalte = 0; spalte < spalten; spalte += 1) {
        if (spalte !== adresseIndex) {
          nameIndex = spalte;
          break;
        }
      }
    }
  }
  if (adresseIndex === -1) {
    // Nirgends etwas, das nach einer Adresse aussieht: die zweite Spalte ist
    // die uebliche Stelle, dann meldet die Pruefung unten sauber je Zeile.
    adresseIndex = nameIndex === 0 ? 1 : 0;
  }

  const kontakte: Kontakt[] = [];
  const verworfen: string[] = [];
  for (let i = 0; i < daten.length; i += 1) {
    // Zeilennummer aus Sicht des Nutzers: inklusive Kopfzeile, ab 1.
    const zeilennummer = i + start + 1;
    if (kontakte.length >= MAX_KONTAKTE) {
      verworfen.push(
        `Zeile ${String(zeilennummer)}: Obergrenze von ${String(MAX_KONTAKTE)} erreicht.`,
      );
      break;
    }
    const felder = daten[i] ?? [];
    const geprueft = kontaktSchema.safeParse({
      name: felder[nameIndex] ?? '',
      adresse: felder[adresseIndex] ?? '',
    });
    if (!geprueft.success) {
      verworfen.push(
        `Zeile ${String(zeilennummer)}: ${geprueft.error.issues[0]?.message ?? 'ungültiger Eintrag'}`,
      );
      continue;
    }
    kontakte.push(geprueft.data);
  }
  return { kontakte, verworfen };
}

/** Maskiert ein Feld fuer die Ausgabe (Anfuehrungszeichen nur wenn noetig). */
function maskiere(wert: string): string {
  return /[";\n\r]/.test(wert) ? `"${wert.replace(/"/g, '""')}"` : wert;
}

/**
 * Schreibt das Verzeichnis als CSV.
 *
 * Bewusst mit Semikolon und BOM: So oeffnet deutsches Excel die Datei per
 * Doppelklick mit richtigen Spalten UND richtigen Umlauten. Ohne BOM zeigt
 * Excel aus Umlauten Kraut, ohne Semikolon steht alles in einer Spalte.
 */
export function baueKontakteCsv(kontakte: readonly Kontakt[]): string {
  const zeilen = ['Name;Adresse'];
  for (const kontakt of kontakte) {
    zeilen.push(`${maskiere(kontakt.name)};${maskiere(kontakt.adresse)}`);
  }
  // \uFEFF ist das BOM: ohne es zeigt Excel aus Umlauten Kraut.
  return `\uFEFF${zeilen.join('\r\n')}\r\n`;
}
