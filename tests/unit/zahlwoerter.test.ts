/**
 * Tests des Zahlwort-Parsers. Ohne Modelle, laeuft in der CI. Der Parser ist die
 * Grundlage der format-neutralen Qualitaetsmessung; liest er falsch, misst die
 * Messung falsch. Deshalb wird auch geprueft, was er NICHT lesen darf.
 */
import { describe, expect, it } from 'vitest';
import {
  leseKardinalzahl,
  leseOrdinalzahl,
  leseZahlwort,
  vereinheitliche,
} from '../../src/shared/zahlwoerter';

describe('vereinheitliche', () => {
  it('macht klein und loest Umlaute und Eszett auf', () => {
    expect(vereinheitliche('Gemäß')).toBe('gemaess');
    expect(vereinheitliche('gemäss')).toBe('gemaess');
    expect(vereinheitliche('ZWÖLF')).toBe('zwoelf');
  });
});

describe('leseKardinalzahl', () => {
  it('liest die Einer und die Null', () => {
    expect(leseKardinalzahl('null')).toBe(0);
    expect(leseKardinalzahl('drei')).toBe(3);
    expect(leseKardinalzahl('acht')).toBe(8);
  });

  it('liest die unregelmaessigen Zahlen bis neunzehn', () => {
    expect(leseKardinalzahl('elf')).toBe(11);
    expect(leseKardinalzahl('zwölf')).toBe(12);
    expect(leseKardinalzahl('sechzehn')).toBe(16);
    expect(leseKardinalzahl('achtzehn')).toBe(18);
  });

  it('liest die zusammengesetzten Zehner', () => {
    expect(leseKardinalzahl('zwanzig')).toBe(20);
    expect(leseKardinalzahl('einundzwanzig')).toBe(21);
    expect(leseKardinalzahl('vierundzwanzig')).toBe(24);
    expect(leseKardinalzahl('einunddreißig')).toBe(31);
    expect(leseKardinalzahl('achtundfünfzig')).toBe(58);
  });

  it('liest Hunderter mit und ohne Rest', () => {
    expect(leseKardinalzahl('hundert')).toBe(100);
    expect(leseKardinalzahl('dreihundert')).toBe(300);
    expect(leseKardinalzahl('dreihundertsechzehn')).toBe(316);
    expect(leseKardinalzahl('dreihundertsiebzig')).toBe(370);
    expect(leseKardinalzahl('zweihundertfünfzig')).toBe(250);
  });

  it('liest Tausender, auch als Jahreszahl', () => {
    expect(leseKardinalzahl('tausend')).toBe(1000);
    expect(leseKardinalzahl('zwölftausend')).toBe(12000);
    expect(leseKardinalzahl('vierundzwanzigtausend')).toBe(24000);
    expect(leseKardinalzahl('achtundfünfzigtausend')).toBe(58000);
    expect(leseKardinalzahl('zweitausendvierundzwanzig')).toBe(2024);
    expect(leseKardinalzahl('neunzehnhundertneunundachtzig')).toBe(1989);
  });

  it('liest Millionen', () => {
    expect(leseKardinalzahl('million')).toBe(1000000);
    expect(leseKardinalzahl('zweimillionen')).toBe(2000000);
    expect(leseKardinalzahl('einemillionzweihunderttausend')).toBe(1200000);
  });

  it('liest gleich, egal ob Eszett oder Doppel-s geschrieben wird', () => {
    expect(leseKardinalzahl('dreißig')).toBe(30);
    expect(leseKardinalzahl('dreissig')).toBe(30);
  });

  it('gibt null zurueck, wenn das Wort nicht vollstaendig aufgeht', () => {
    // Das ist der wichtige Teil: sonst wuerde "Achtung" zu 8 und die Messung
    // waere Unsinn.
    expect(leseKardinalzahl('achtung')).toBeNull();
    expect(leseKardinalzahl('einsatz')).toBeNull();
    expect(leseKardinalzahl('sechserpack')).toBeNull();
    expect(leseKardinalzahl('hundertschaft')).toBeNull();
    expect(leseKardinalzahl('tausendfuessler')).toBeNull();
    expect(leseKardinalzahl('patient')).toBeNull();
    expect(leseKardinalzahl('')).toBeNull();
  });

  it('lehnt unsinnige Zusammensetzungen ab', () => {
    expect(leseKardinalzahl('zwanzigundvier')).toBeNull();
    expect(leseKardinalzahl('nullhundert')).toBeNull();
    expect(leseKardinalzahl('undzwanzig')).toBeNull();
  });
});

describe('leseOrdinalzahl', () => {
  it('liest die regelmaessigen Ordnungszahlen in jeder Beugung', () => {
    expect(leseOrdinalzahl('zwölfte')).toBe(12);
    expect(leseOrdinalzahl('zwölften')).toBe(12);
    expect(leseOrdinalzahl('zehnten')).toBe(10);
    expect(leseOrdinalzahl('einunddreißigsten')).toBe(31);
    expect(leseOrdinalzahl('zwanzigste')).toBe(20);
  });

  it('liest die unregelmaessigen Staemme', () => {
    expect(leseOrdinalzahl('erste')).toBe(1);
    expect(leseOrdinalzahl('ersten')).toBe(1);
    expect(leseOrdinalzahl('dritten')).toBe(3);
    expect(leseOrdinalzahl('siebte')).toBe(7);
  });

  it('gibt null zurueck bei normalen Woertern', () => {
    expect(leseOrdinalzahl('patienten')).toBeNull();
    expect(leseOrdinalzahl('rechnung')).toBeNull();
  });
});

describe('leseZahlwort', () => {
  it('nimmt die Grundzahl vor der Ordnungszahl', () => {
    // "acht" ist die Zahl 8, nicht die Beugung von irgendetwas.
    expect(leseZahlwort('acht')).toBe(8);
    expect(leseZahlwort('zwölf')).toBe(12);
  });

  it('faellt auf die Ordnungszahl zurueck, wenn es keine Grundzahl ist', () => {
    expect(leseZahlwort('zwölften')).toBe(12);
    expect(leseZahlwort('ersten')).toBe(1);
  });

  it('laesst normale Woerter unberuehrt', () => {
    expect(leseZahlwort('sonographie')).toBeNull();
    expect(leseZahlwort('gemäß')).toBeNull();
  });
});
