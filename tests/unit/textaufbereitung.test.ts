/**
 * Unit-Tests der regelbasierten Textaufbereitung (Stufe 1, ABARBEITUNG 2.7):
 * Interpunktions-Randfaelle (Zahlen, Abkuerzungen, Umlaute), Fuellwoerter an
 * Satzanfang/-ende/mit Komma, Wortdopplungen inklusive dokumentierter
 * Grenzen, Sprachkommandos an/aus. Alles reine String-Verarbeitung, kein
 * Modell, kein Netz.
 */
import { describe, expect, it } from 'vitest';
import {
  aufbereitenText,
  defaultAufbereitungOptions,
  entferneFuellwoerter,
  ersetzeSprachkommandos,
  schaerfeInterpunktion,
} from '../../src/shared/textaufbereitung';

const AN = { fuellwoerterEntfernen: true, sprachkommandos: false } as const;
const ALLES_AN = { fuellwoerterEntfernen: true, sprachkommandos: true } as const;
const ALLES_AUS = { fuellwoerterEntfernen: false, sprachkommandos: false } as const;

describe('schaerfeInterpunktion', () => {
  it('zieht doppelte Leerzeichen zusammen', () => {
    expect(schaerfeInterpunktion('Das  ist   ein Test.')).toBe('Das ist ein Test.');
  });

  it('entfernt Leerzeichen vor Satzzeichen', () => {
    expect(schaerfeInterpunktion('Hallo , wie geht es ?')).toBe('Hallo, wie geht es?');
  });

  it('ergaenzt fehlendes Leerzeichen nach Komma', () => {
    expect(schaerfeInterpunktion('Hallo,wie geht es dir?')).toBe('Hallo, wie geht es dir?');
  });

  it('laesst Dezimalzahlen wie 3,14 unangetastet', () => {
    expect(schaerfeInterpunktion('Der Wert ist 3,14 Prozent.')).toBe('Der Wert ist 3,14 Prozent.');
  });

  it('laesst Tausenderpunkte wie 1.000 unangetastet', () => {
    expect(schaerfeInterpunktion('Das kostet 1.000 Euro.')).toBe('Das kostet 1.000 Euro.');
  });

  it('laesst die Abkuerzung "z. B." unangetastet', () => {
    expect(schaerfeInterpunktion('Das ist z. B. wichtig.')).toBe('Das ist z. B. wichtig.');
  });

  it('laesst "z.B." ohne Leerzeichen unangetastet (Ein-Buchstaben-Abkuerzung)', () => {
    expect(schaerfeInterpunktion('Das ist z.B. wichtig.')).toBe('Das ist z.B. wichtig.');
  });

  it('ergaenzt Leerzeichen nach Satzende vor Grossbuchstaben ("Dr.Meier")', () => {
    expect(schaerfeInterpunktion('Sehr geehrter Dr.Meier')).toBe('Sehr geehrter Dr. Meier');
  });

  it('schreibt nach eindeutigem Satzende gross', () => {
    expect(schaerfeInterpunktion('Der Satz endet. hier geht es weiter.')).toBe(
      'Der Satz endet. Hier geht es weiter.',
    );
  });

  it('schreibt nach Frage- und Ausrufezeichen gross', () => {
    expect(schaerfeInterpunktion('Wirklich? ja! natürlich.')).toBe('Wirklich? Ja! Natürlich.');
  });

  it('schreibt Umlaute nach Satzende gross', () => {
    expect(schaerfeInterpunktion('Das war gut. ähnliches gilt hier.')).toBe(
      'Das war gut. Ähnliches gilt hier.',
    );
  });

  it('schreibt nach "z. B." NICHT gross (kein sicherer Satzanfang)', () => {
    expect(schaerfeInterpunktion('Das gilt z. B. hier.')).toBe('Das gilt z. B. hier.');
  });

  it('schreibt nach bekannten Abkuerzungen (bzw., usw.) NICHT gross', () => {
    expect(schaerfeInterpunktion('Eins bzw. zwei usw. und weiter.')).toBe(
      'Eins bzw. zwei usw. und weiter.',
    );
  });

  it('schreibt nach Ordinalzahlen ("3. juli") NICHT gross', () => {
    expect(schaerfeInterpunktion('Der Termin ist am 3. juli.')).toBe('Der Termin ist am 3. juli.');
  });

  it('erhaelt Zeilenumbrueche und raeumt Leerraum darum auf', () => {
    expect(schaerfeInterpunktion('Erste Zeile \n zweite Zeile')).toBe('Erste Zeile\nzweite Zeile');
  });

  it('kappt mehr als eine Leerzeile', () => {
    expect(schaerfeInterpunktion('Absatz eins.\n\n\n\nAbsatz zwei.')).toBe(
      'Absatz eins.\n\nAbsatz zwei.',
    );
  });

  it('laesst Uhrzeiten wie 14:30 unangetastet', () => {
    expect(schaerfeInterpunktion('Der Termin ist um 14:30 Uhr.')).toBe(
      'Der Termin ist um 14:30 Uhr.',
    );
  });

  it('ist idempotent (zweiter Lauf aendert nichts)', () => {
    const einmal = schaerfeInterpunktion('Hallo ,wie  geht es ? gut.');
    expect(schaerfeInterpunktion(einmal)).toBe(einmal);
  });
});

describe('entferneFuellwoerter', () => {
  it('entfernt eigenstaendiges "äh" mitten im Satz', () => {
    expect(entferneFuellwoerter('Das ist äh ein Test.')).toBe('Das ist ein Test.');
  });

  it('entfernt "ähm" mit umgebenden Kommas', () => {
    expect(entferneFuellwoerter('Das ist, ähm, ein Test.')).toBe('Das ist, ein Test.');
  });

  it('entfernt Fuellwort am Satzanfang und schreibt den Anfang gross', () => {
    expect(entferneFuellwoerter('Äh, das war gut.')).toBe('Das war gut.');
  });

  it('entfernt Fuellwort am Satzende samt haengendem Komma', () => {
    expect(entferneFuellwoerter('Das war gut, äh.')).toBe('Das war gut.');
  });

  it('entfernt "öhm" und "hm" case-insensitiv (Anfang wird grossgeschrieben)', () => {
    expect(entferneFuellwoerter('Öhm ja, hm, gut.')).toBe('Ja, gut.');
  });

  it('laesst Woerter mit Fuellwort-Teilstring unangetastet (Lehm, Rahmen)', () => {
    expect(entferneFuellwoerter('Der Lehm im Rahmen bleibt.')).toBe('Der Lehm im Rahmen bleibt.');
  });

  it('zieht direkte Wortdopplung zusammen ("das das")', () => {
    expect(entferneFuellwoerter('Ich denke das das reicht.')).toBe('Ich denke das reicht.');
  });

  it('zieht auch dreifache Dopplung zusammen', () => {
    expect(entferneFuellwoerter('das das das reicht')).toBe('das reicht');
  });

  it('behandelt Dopplungen case-insensitiv und behaelt das erste Vorkommen', () => {
    expect(entferneFuellwoerter('Das das war gut.')).toBe('Das war gut.');
  });

  it('laesst legitime Dopplung mit Komma ("sehr, sehr") unangetastet', () => {
    expect(entferneFuellwoerter('Das war sehr, sehr gut.')).toBe('Das war sehr, sehr gut.');
  });

  it('laesst Dopplungen ueber Zeilenumbrueche unangetastet', () => {
    expect(entferneFuellwoerter('Ende\nEnde gut.')).toBe('Ende\nEnde gut.');
  });

  it('dokumentierte Grenze: "dass das das Problem ist" wird mitgetroffen', () => {
    // Bewusste, ehrlich dokumentierte Grenze des Dopplungs-Filters
    // (Modulkommentar textaufbereitung.ts): der Filter kann seltene
    // legitime direkte Dopplungen nicht von Versprechern unterscheiden.
    expect(entferneFuellwoerter('Ich weiß, dass das das Problem ist.')).toBe(
      'Ich weiß, dass das Problem ist.',
    );
  });
});

describe('ersetzeSprachkommandos', () => {
  it('ersetzt "Punkt" am Satzende', () => {
    expect(ersetzeSprachkommandos('Das war gut Punkt')).toBe('Das war gut.');
  });

  it('verbraucht ein von Whisper zusaetzlich gesetztes Satzzeichen', () => {
    expect(ersetzeSprachkommandos('Das war gut Punkt.')).toBe('Das war gut.');
  });

  it('ersetzt "Komma" mitten im Satz', () => {
    expect(ersetzeSprachkommandos('Erstens Komma zweitens')).toBe('Erstens, zweitens');
  });

  it('ersetzt "Fragezeichen", "Ausrufezeichen" und "Doppelpunkt"', () => {
    expect(ersetzeSprachkommandos('Wirklich Fragezeichen')).toBe('Wirklich?');
    expect(ersetzeSprachkommandos('Sofort Ausrufezeichen')).toBe('Sofort!');
    expect(ersetzeSprachkommandos('Betreff Doppelpunkt Angebot')).toBe('Betreff: Angebot');
  });

  it('ersetzt "neue Zeile" durch einen Zeilenumbruch', () => {
    expect(ersetzeSprachkommandos('Erste Zeile neue Zeile zweite Zeile')).toBe(
      'Erste Zeile\nzweite Zeile',
    );
  });

  it('ersetzt "neuer Absatz" durch einen Doppelumbruch', () => {
    expect(ersetzeSprachkommandos('Absatz eins neuer Absatz Absatz zwei')).toBe(
      'Absatz eins\n\nAbsatz zwei',
    );
  });

  it('arbeitet case-insensitiv ("punkt", "NEUE ZEILE")', () => {
    expect(ersetzeSprachkommandos('Ende punkt')).toBe('Ende.');
    expect(ersetzeSprachkommandos('Eins NEUE ZEILE zwei')).toBe('Eins\nzwei');
  });

  it('ersetzt keine Teilwoerter ("Zeitpunkt", "Kommando")', () => {
    expect(ersetzeSprachkommandos('Der Zeitpunkt für das Kommando steht.')).toBe(
      'Der Zeitpunkt für das Kommando steht.',
    );
  });

  it('dokumentierte Unschaerfe: normale Verwendung von "Punkt" wird getroffen', () => {
    // Genau deshalb ist der Schalter standardmaessig AUS (Entscheidung E38).
    expect(ersetzeSprachkommandos('Der Punkt ist wichtig.')).toBe('Der. ist wichtig.');
  });
});

describe('aufbereitenText (Pipeline)', () => {
  it('Default-Schalter: Fuellwoerter AN, Sprachkommandos AUS', () => {
    expect(defaultAufbereitungOptions()).toEqual({
      fuellwoerterEntfernen: true,
      sprachkommandos: false,
    });
  });

  it('kombiniert Interpunktion und Fuellwoerter-Filter', () => {
    expect(aufbereitenText('Das ist äh ein  Test . es funktioniert.', AN)).toBe(
      'Das ist ein Test. Es funktioniert.',
    );
  });

  it('laesst Kommandowoerter bei AUS vollstaendig unangetastet', () => {
    expect(aufbereitenText('Der Punkt ist wichtig, Komma folgt.', AN)).toBe(
      'Der Punkt ist wichtig, Komma folgt.',
    );
  });

  it('setzt Kommandos bei AN um und schreibt nach dem Satzende gross', () => {
    expect(aufbereitenText('das war gut Punkt es geht weiter Punkt', ALLES_AN)).toBe(
      'das war gut. Es geht weiter.',
    );
  });

  it('raeumt Leerraum um eingesetzte Umbrueche auf', () => {
    expect(aufbereitenText('Absatz eins neue Zeile weiter im Text', ALLES_AN)).toBe(
      'Absatz eins\nweiter im Text',
    );
  });

  it('setzt Umbruch-Kommandos auch mit Fuellwoerter-Filter korrekt um', () => {
    expect(
      aufbereitenText('Zeile eins neue Zeile hier gehts weiter', {
        fuellwoerterEntfernen: false,
        sprachkommandos: true,
      }),
    ).toBe('Zeile eins\nhier gehts weiter');
  });

  it('mit allen Schaltern AUS bleibt nur die Interpunktions-Nachschaerfung', () => {
    expect(aufbereitenText('Das ist äh ein  Test , ja.', ALLES_AUS)).toBe(
      'Das ist äh ein Test, ja.',
    );
  });

  it('liefert leeren Text, wenn nur Fuellwoerter diktiert wurden', () => {
    expect(aufbereitenText('Ähm.', AN)).toBe('');
  });

  it('trimmt fuehrenden und schliessenden Leerraum', () => {
    expect(aufbereitenText('  Hallo Welt.  ', ALLES_AUS)).toBe('Hallo Welt.');
  });

  it('veraendert einen bereits sauberen Satz nicht', () => {
    const satz = 'Sehr geehrter Herr Müller, das Angebot ist geprüft und freigegeben.';
    expect(aufbereitenText(satz, AN)).toBe(satz);
  });
});
