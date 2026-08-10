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

/** Spaltenueberschriften, die als Name bzw. Adresse durchgehen. */
const NAME_SPALTEN = ['name', 'kontakt', 'empfänger', 'empfaenger', 'contact', 'recipient'];
const ADRESSE_SPALTEN = ['adresse', 'e-mail', 'email', 'e-mail-adresse', 'mail', 'address'];

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
  const zeilen = ohneBom
    .split(/\r?\n/)
    .map((zeile) => zeile.trim())
    .filter((zeile) => zeile.length > 0);
  if (zeilen.length === 0) {
    return { kontakte: [], verworfen: [] };
  }
  const trenner = erkenneTrenner(zeilen[0] ?? '');

  // Kopfzeile auswerten, falls vorhanden.
  let nameIndex = 0;
  let adresseIndex = 1;
  let start = 0;
  const kopf = zerlegeZeile(zeilen[0] ?? '', trenner).map((feld) => feld.toLowerCase());
  const kopfName = kopf.findIndex((feld) => NAME_SPALTEN.includes(feld));
  const kopfAdresse = kopf.findIndex((feld) => ADRESSE_SPALTEN.includes(feld));
  if (kopfName !== -1 && kopfAdresse !== -1) {
    nameIndex = kopfName;
    adresseIndex = kopfAdresse;
    start = 1;
  }

  const kontakte: Kontakt[] = [];
  const verworfen: string[] = [];
  for (let i = start; i < zeilen.length; i += 1) {
    if (kontakte.length >= MAX_KONTAKTE) {
      verworfen.push(`Zeile ${String(i + 1)}: Obergrenze von ${String(MAX_KONTAKTE)} erreicht.`);
      break;
    }
    const felder = zerlegeZeile(zeilen[i] ?? '', trenner);
    const name = felder[nameIndex] ?? '';
    const adresse = felder[adresseIndex] ?? '';
    const geprueft = kontaktSchema.safeParse({ name, adresse });
    if (!geprueft.success) {
      verworfen.push(
        `Zeile ${String(i + 1)}: ${geprueft.error.issues[0]?.message ?? 'ungültiger Eintrag'}`,
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
