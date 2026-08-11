/**
 * Tests des CSV-Imports und -Exports fuer das Kontaktverzeichnis.
 *
 * Schwerpunkt liegt auf den Eigenheiten, die in der Praxis jeden zweiten
 * Import zerlegen: deutsches Excel trennt mit Semikolon, schreibt ein BOM und
 * setzt Anfuehrungszeichen, sobald ein Feld ein Trennzeichen enthaelt.
 */
import { describe, expect, it } from 'vitest';
import { baueKontakteCsv, parseKontakteCsv } from '../../src/shared/kontakte-csv';
import { MAX_KONTAKTE } from '../../src/shared/mailbefehl';

describe('parseKontakteCsv', () => {
  it('liest die Form, die deutsches Excel schreibt (Semikolon, Kopfzeile, BOM)', () => {
    const csv = '﻿Name;Adresse\r\nLars;l.zimmermann@fernau-gmbh.de\r\nFrau Weber;weber@x.de\r\n';
    const ergebnis = parseKontakteCsv(csv);
    expect(ergebnis.kontakte).toEqual([
      { name: 'Lars', adresse: 'l.zimmermann@fernau-gmbh.de' },
      { name: 'Frau Weber', adresse: 'weber@x.de' },
    ]);
    expect(ergebnis.verworfen).toEqual([]);
  });

  it('liest ebenso die Komma-Form', () => {
    const ergebnis = parseKontakteCsv('Name,Adresse\nLars,lars@x.de\n');
    expect(ergebnis.kontakte).toEqual([{ name: 'Lars', adresse: 'lars@x.de' }]);
  });

  it('kommt ohne Kopfzeile aus und nimmt dann Name, Adresse', () => {
    const ergebnis = parseKontakteCsv('Lars;lars@x.de\nMeier;meier@x.de');
    expect(ergebnis.kontakte).toHaveLength(2);
    expect(ergebnis.kontakte[0]?.name).toBe('Lars');
  });

  it('erkennt vertauschte Spalten anhand der Kopfzeile', () => {
    const ergebnis = parseKontakteCsv('E-Mail;Name\nlars@x.de;Lars');
    expect(ergebnis.kontakte).toEqual([{ name: 'Lars', adresse: 'lars@x.de' }]);
  });

  it('versteht Anfuehrungszeichen samt enthaltenem Trennzeichen', () => {
    const ergebnis = parseKontakteCsv('Name;Adresse\n"Weber; Klaus";weber@x.de');
    expect(ergebnis.kontakte[0]?.name).toBe('Weber; Klaus');
  });

  it('versteht ein verdoppeltes Anfuehrungszeichen als Zeichen', () => {
    const ergebnis = parseKontakteCsv('Name;Adresse\n"Firma ""Nord""";nord@x.de');
    expect(ergebnis.kontakte[0]?.name).toBe('Firma "Nord"');
  });

  it('verwirft ungueltige Zeilen einzeln und nennt sie, statt alles abzubrechen', () => {
    const ergebnis = parseKontakteCsv(
      'Name;Adresse\nLars;lars@x.de\nOhneAdresse;\nKaputt;keine-adresse\nMeier;meier@x.de',
    );
    expect(ergebnis.kontakte.map((k) => k.name)).toEqual(['Lars', 'Meier']);
    expect(ergebnis.verworfen).toHaveLength(2);
    expect(ergebnis.verworfen[0]).toContain('Zeile 3');
    expect(ergebnis.verworfen[1]).toContain('Zeile 4');
  });

  it('haelt die Obergrenze ein und sagt es', () => {
    const zeilen = ['Name;Adresse'];
    for (let i = 0; i < MAX_KONTAKTE + 5; i += 1) {
      zeilen.push(`Person${String(i)};person${String(i)}@x.de`);
    }
    const ergebnis = parseKontakteCsv(zeilen.join('\n'));
    expect(ergebnis.kontakte).toHaveLength(MAX_KONTAKTE);
    expect(ergebnis.verworfen.join(' ')).toContain('Obergrenze');
  });

  it('kommt mit leerem Inhalt zurecht', () => {
    expect(parseKontakteCsv('').kontakte).toEqual([]);
    expect(parseKontakteCsv('\n\n  \n').kontakte).toEqual([]);
  });

  it('ueberspringt Leerzeilen mitten in der Datei', () => {
    const ergebnis = parseKontakteCsv('Name;Adresse\nLars;lars@x.de\n\nMeier;meier@x.de\n');
    expect(ergebnis.kontakte).toHaveLength(2);
  });
});

describe('parseKontakteCsv: erkennt Spalten ohne feste Wortliste', () => {
  it('nimmt die Tabelle, die man in Excel einfach so tippt', () => {
    // Der Normalfall aus der Praxis: drei Spalten, Ueberschriften frei
    // formuliert, "Firma" zuerst. Genau hier ist eine starre Wortliste
    // gescheitert (Mailadresse stand nicht drin) und hat alles verworfen.
    const ergebnis = parseKontakteCsv(
      'Firma;Name;Mailadresse\nFernau GmbH;Lars;l.zimmermann@fernau-gmbh.de\nBeispiel AG;Frau Weber;weber@beispiel.de',
    );
    expect(ergebnis.verworfen).toEqual([]);
    expect(ergebnis.kontakte).toEqual([
      { name: 'Lars', adresse: 'l.zimmermann@fernau-gmbh.de' },
      { name: 'Frau Weber', adresse: 'weber@beispiel.de' },
    ]);
  });

  it('versteht jede Schreibweise der Adress-Ueberschrift', () => {
    for (const ueberschrift of [
      'Mailadresse',
      'E-Mail-Adresse',
      'eMail_Adresse',
      'E Mail',
      'EMAIL',
      'Adresse',
      'Email Address',
    ]) {
      const ergebnis = parseKontakteCsv(`Name;${ueberschrift}\nLars;lars@x.de`);
      expect(ergebnis.kontakte, ueberschrift).toEqual([{ name: 'Lars', adresse: 'lars@x.de' }]);
    }
  });

  it('nimmt die Firmenspalte als Namen, wenn es keine Namensspalte gibt', () => {
    // Firmenkontakte ohne Ansprechpartner sind ueblich.
    const ergebnis = parseKontakteCsv('Firma;Mailadresse\nFernau GmbH;info@fernau-gmbh.de');
    expect(ergebnis.kontakte).toEqual([{ name: 'Fernau GmbH', adresse: 'info@fernau-gmbh.de' }]);
  });

  it('findet die Adressspalte am Inhalt, wenn die Kopfzeile fehlt', () => {
    // Das ist die verlaesslichste Erkennung: die Adressspalte ist die, in
    // der Adressen stehen. Funktioniert auch, wenn sie vorne steht.
    expect(parseKontakteCsv('Lars;lars@x.de\nWeber;weber@x.de').kontakte).toEqual([
      { name: 'Lars', adresse: 'lars@x.de' },
      { name: 'Weber', adresse: 'weber@x.de' },
    ]);
    expect(parseKontakteCsv('lars@x.de;Lars\nweber@x.de;Weber').kontakte).toEqual([
      { name: 'Lars', adresse: 'lars@x.de' },
      { name: 'Weber', adresse: 'weber@x.de' },
    ]);
  });

  it('kommt auch ohne Kopfzeile mit drei Spalten zurecht', () => {
    expect(parseKontakteCsv('Fernau GmbH;Lars;lars@x.de').kontakte).toEqual([
      { name: 'Fernau GmbH', adresse: 'lars@x.de' },
    ]);
  });

  it('versteht englische Ueberschriften', () => {
    expect(parseKontakteCsv('Company;Contact;Email\nAcme;John;john@acme.com').kontakte).toEqual([
      { name: 'John', adresse: 'john@acme.com' },
    ]);
  });

  it('nimmt bei Vorname und Nachname die erste Namensspalte (dokumentiert)', () => {
    // Beide Ueberschriften enthalten "name"; welche gemeint ist, kann die
    // Datei nicht sagen. Genommen wird die erste, das ist vorhersagbar.
    expect(parseKontakteCsv('Vorname;Nachname;Mail\nLars;Zimmermann;lars@x.de').kontakte).toEqual([
      { name: 'Lars', adresse: 'lars@x.de' },
    ]);
  });

  it('haelt eine Kopfzeile nicht faelschlich fuer Daten', () => {
    // Wenn die erste Zeile selbst eine Adresse enthaelt, ist sie keine
    // Kopfzeile und darf nicht verschluckt werden.
    const ergebnis = parseKontakteCsv('lars@x.de;Lars\nweber@x.de;Weber');
    expect(ergebnis.kontakte).toHaveLength(2);
  });
});

describe('baueKontakteCsv', () => {
  it('schreibt Kopfzeile, Semikolon und BOM, damit Excel es richtig oeffnet', () => {
    const csv = baueKontakteCsv([{ name: 'Lars', adresse: 'lars@x.de' }]);
    expect(csv.startsWith('﻿Name;Adresse\r\n')).toBe(true);
    expect(csv).toContain('Lars;lars@x.de');
  });

  it('maskiert nur, was maskiert werden muss', () => {
    const csv = baueKontakteCsv([
      { name: 'Weber; Klaus', adresse: 'weber@x.de' },
      { name: 'Einfach', adresse: 'einfach@x.de' },
    ]);
    expect(csv).toContain('"Weber; Klaus";weber@x.de');
    expect(csv).toContain('Einfach;einfach@x.de');
  });

  it('ueberlebt den Rundlauf: schreiben, lesen, dasselbe Ergebnis', () => {
    const original = [
      { name: 'Weber; Klaus', adresse: 'weber@x.de' },
      { name: 'Firma "Nord"', adresse: 'nord@x.de' },
      { name: 'Lars', adresse: 'l.zimmermann@fernau-gmbh.de' },
    ];
    expect(parseKontakteCsv(baueKontakteCsv(original)).kontakte).toEqual(original);
  });
});
