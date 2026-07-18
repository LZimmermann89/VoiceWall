/**
 * Tests des WER-Algorithmus. Ohne Modelle, laeuft in der CI. Eine falsche
 * Metrik waere wertlos, deshalb wird jede Fehlerart einzeln geprueft.
 */
import { describe, expect, it } from 'vitest';
import {
  berechneWer,
  berechneWerNormiert,
  inWoerter,
  normalisiereText,
} from '../../src/shared/wer';

describe('normalisiereText', () => {
  it('macht klein, entfernt Interpunktion und fasst Leerraum zusammen', () => {
    expect(normalisiereText('Guten Morgen, Herr Weber!')).toBe('guten morgen herr weber');
    expect(normalisiereText('  viel   Raum  ')).toBe('viel raum');
  });
});

describe('inWoerter', () => {
  it('zerlegt in Woerter und behandelt leeren Text', () => {
    expect(inWoerter('a b c')).toEqual(['a', 'b', 'c']);
    expect(inWoerter('   ')).toEqual([]);
    expect(inWoerter('')).toEqual([]);
  });
});

describe('berechneWer', () => {
  it('ist 0 bei identischem Text', () => {
    const e = berechneWer('das ist ein test', 'das ist ein test');
    expect(e.wer).toBe(0);
    expect(e.woerter).toBe(4);
  });

  it('zaehlt eine Ersetzung', () => {
    const e = berechneWer('das ist ein test', 'das ist ein versuch');
    expect(e.ersetzungen).toBe(1);
    expect(e.loeschungen).toBe(0);
    expect(e.einfuegungen).toBe(0);
    expect(e.wer).toBeCloseTo(0.25, 5);
  });

  it('zaehlt eine Loeschung', () => {
    const e = berechneWer('das ist ein test', 'das ist test');
    expect(e.loeschungen).toBe(1);
    expect(e.ersetzungen).toBe(0);
    expect(e.einfuegungen).toBe(0);
    expect(e.wer).toBeCloseTo(0.25, 5);
  });

  it('zaehlt eine Einfuegung', () => {
    const e = berechneWer('das ist ein test', 'das ist ein kleiner test');
    expect(e.einfuegungen).toBe(1);
    expect(e.ersetzungen).toBe(0);
    expect(e.loeschungen).toBe(0);
    expect(e.wer).toBeCloseTo(0.25, 5);
  });

  it('summiert kombinierte Fehler korrekt zur WER', () => {
    // Referenz: a b c d e (5 Woerter), Hypothese a x c e f. Die guenstigste
    // Ausrichtung kostet 3 Operationen. Welche genaue Mischung aus Ersetzung,
    // Loeschung und Einfuegung das ergibt, ist bei gleichen Kosten mehrdeutig;
    // eindeutig und fuer die Metrik allein massgeblich ist die Gesamtzahl.
    const e = berechneWer('a b c d e', 'a x c e f');
    expect(e.ersetzungen + e.loeschungen + e.einfuegungen).toBe(3);
    expect(e.wer).toBeCloseTo(3 / 5, 5);
  });

  it('schluesselt eindeutige Faelle je Fehlerart korrekt auf', () => {
    // Hier ist die Ausrichtung eindeutig: nur Einfuegungen am Ende.
    const e = berechneWer('a b', 'a b c d');
    expect(e.einfuegungen).toBe(2);
    expect(e.ersetzungen).toBe(0);
    expect(e.loeschungen).toBe(0);
  });

  it('behandelt leere Referenz als Konvention', () => {
    expect(berechneWer('', '').wer).toBe(0);
    expect(berechneWer('', 'ueberfluessig').wer).toBe(1);
    expect(berechneWer('', 'ein zwei').einfuegungen).toBe(2);
  });

  it('zaehlt eine leere Hypothese als lauter Loeschungen', () => {
    const e = berechneWer('das ist ein test', '');
    expect(e.loeschungen).toBe(4);
    expect(e.wer).toBe(1);
  });
});

describe('berechneWerNormiert', () => {
  it('ignoriert Gross- und Kleinschreibung und Interpunktion', () => {
    const e = berechneWerNormiert('Das ist ein Test.', 'das ist ein test');
    expect(e.wer).toBe(0);
  });

  it('misst ohne Normierung Interpunktion mit', () => {
    // Roh betrachtet ist "Test." ein anderes Wort als "test".
    expect(berechneWer('Das ist ein Test.', 'das ist ein test').wer).toBeGreaterThan(0);
  });
});
