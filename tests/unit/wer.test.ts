/**
 * Tests des WER-Algorithmus. Ohne Modelle, laeuft in der CI. Eine falsche
 * Metrik waere wertlos, deshalb wird jede Fehlerart einzeln geprueft.
 */
import { describe, expect, it } from 'vitest';
import {
  berechneWer,
  berechneWerInhaltlichMitDiff,
  berechneWerMitDiff,
  berechneWerNormiert,
  berechneWerNormiertMitDiff,
  formatiereWerAbweichungen,
  inWoerter,
  normalisiereInhaltlich,
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

describe('normalisiereInhaltlich', () => {
  it('schreibt Zahlwoerter als Ziffern', () => {
    expect(normalisiereInhaltlich('zwanzig Milligramm')).toBe('20 milligramm');
    expect(normalisiereInhaltlich('zweitausendvierundzwanzig')).toBe('2024');
  });

  it('loest Einheiten und Zeichen auf', () => {
    expect(normalisiereInhaltlich('20 mg')).toBe('20 milligramm');
    expect(normalisiereInhaltlich('§ 316')).toBe('paragraf 316');
    expect(normalisiereInhaltlich('Paragraph 316')).toBe('paragraf 316');
    expect(normalisiereInhaltlich('1 %')).toBe('1 prozent');
    expect(normalisiereInhaltlich('1%')).toBe('1 prozent');
  });

  it('haelt Tausenderpunkt und Tausenderleerzeichen zusammen', () => {
    expect(normalisiereInhaltlich('58.000 Euro')).toBe('58000 euro');
    expect(normalisiereInhaltlich('58 000 Euro')).toBe('58000 euro');
    expect(normalisiereInhaltlich('achtundfünfzigtausend Euro')).toBe('58000 euro');
  });

  it('bringt gebeugte Einheiten und ihre Kuerzel zusammen', () => {
    // Gesprochen wird "drei Millimetern", geschrieben "3 mm". Ohne diese Regel
    // zaehlt der Messstand den Dativ als Erkennungsfehler.
    expect(normalisiereInhaltlich('drei Millimetern')).toBe('3 millimeter');
    expect(normalisiereInhaltlich('3 mm')).toBe('3 millimeter');
    expect(normalisiereInhaltlich('achtzehn Quadratmetern')).toBe('18 quadratmeter');
    expect(normalisiereInhaltlich('18 m²')).toBe('18 quadratmeter');
  });

  it('verstuemmelt normale Woerter auf n nicht', () => {
    expect(normalisiereInhaltlich('vier Wochen')).toBe('4 wochen');
    expect(normalisiereInhaltlich('den Parteien')).toBe('den parteien');
  });

  it('spricht das Dezimalkomma aus', () => {
    expect(normalisiereInhaltlich('23,5 Prozent')).toBe('23 komma 5 prozent');
    expect(normalisiereInhaltlich('dreiundzwanzig Komma fünf Prozent')).toBe('23 komma 5 prozent');
  });

  it('laesst Fliesstext unveraendert bis auf Schreibweise', () => {
    expect(normalisiereInhaltlich('Der Patient stellte sich vor.')).toBe(
      'der patient stellte sich vor',
    );
  });

  it('faengt keine normalen Woerter als Zahlen ab', () => {
    // Wuerde "Achtung" zu "8ung" oder "8", waere die ganze Messung wertlos.
    expect(normalisiereInhaltlich('Achtung beim Einsatz')).toBe('achtung beim einsatz');
  });
});

describe('berechneWerInhaltlichMitDiff', () => {
  it('wertet reine Formatunterschiede nicht als Fehler', () => {
    // Genau die Faelle aus dem Messlauf gegen das Korpus.
    expect(
      berechneWerInhaltlichMitDiff(
        'Pantoprazol zwanzig Milligramm täglich',
        'Pantoprazol 20 mg täglich',
      ).wer,
    ).toBe(0);
    expect(
      berechneWerInhaltlichMitDiff('gemäß Paragraf dreihundertsechzehn', 'gemäss § 316').wer,
    ).toBe(0);
    expect(
      berechneWerInhaltlichMitDiff(
        'am zwölften Dezember zweitausendvierundzwanzig',
        'am 12. Dezember 2024',
      ).wer,
    ).toBe(0);
  });

  it('zeigt echte Erkennungsfehler weiterhin an', () => {
    const e = berechneWerInhaltlichMitDiff(
      'aus Verbundsicherheitsglas gefertigt',
      'aus Verbund Sicherheitsglas gefertigt',
    );
    expect(e.wer).toBeGreaterThan(0);
    const abweichungen = formatiereWerAbweichungen(e.operationen);
    expect(abweichungen.join(' ')).toContain('sicherheitsglas');
  });

  it('ist nie strenger als die normierte WER', () => {
    const referenz = 'zwanzig Milligramm täglich, gemäß Paragraf dreihundertsechzehn';
    const hypothese = '20 mg täglich, gemäss § 316';
    expect(berechneWerInhaltlichMitDiff(referenz, hypothese).wer).toBeLessThanOrEqual(
      berechneWerNormiert(referenz, hypothese).wer,
    );
  });
});

describe('berechneWerMitDiff', () => {
  it('zeichnet jede Position der Ausrichtung auf', () => {
    const e = berechneWerMitDiff('das ist ein test', 'das ist ein versuch');
    expect(e.operationen).toHaveLength(4);
    expect(e.operationen.slice(0, 3).every((op) => op.art === 'gleich')).toBe(true);
    expect(e.operationen[3]).toEqual({
      art: 'ersetzung',
      referenz: 'test',
      hypothese: 'versuch',
    });
  });

  it('liefert die Operationen in Textreihenfolge, nicht rueckwaerts', () => {
    const e = berechneWerMitDiff('a b', 'a b c d');
    expect(e.operationen.map((op) => op.hypothese)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('markiert fehlende und ueberzaehlige Woerter getrennt', () => {
    const fehlt = berechneWerMitDiff('das ist ein test', 'das ist test');
    expect(fehlt.operationen.filter((op) => op.art === 'loeschung')).toEqual([
      { art: 'loeschung', referenz: 'ein' },
    ]);
    const zuviel = berechneWerMitDiff('das ist test', 'das ist ein test');
    expect(zuviel.operationen.filter((op) => op.art === 'einfuegung')).toEqual([
      { art: 'einfuegung', hypothese: 'ein' },
    ]);
  });

  it('zaehlt die Fehlerarten genau so oft, wie sie in der Ausrichtung stehen', () => {
    const e = berechneWerMitDiff('a b c d e', 'a x c e f');
    const gezaehlt = e.operationen.filter((op) => op.art !== 'gleich').length;
    expect(gezaehlt).toBe(e.ersetzungen + e.loeschungen + e.einfuegungen);
  });

  it('behandelt die leere Referenz als lauter Einfuegungen', () => {
    const e = berechneWerMitDiff('', 'ein zwei');
    expect(e.operationen).toEqual([
      { art: 'einfuegung', hypothese: 'ein' },
      { art: 'einfuegung', hypothese: 'zwei' },
    ]);
  });
});

describe('formatiereWerAbweichungen', () => {
  it('laesst Uebereinstimmungen weg und benennt eine Ersetzung', () => {
    // Eindeutige Ausrichtung: gleich lange Texte, genau ein abweichendes Wort.
    const e = berechneWerNormiertMitDiff('zwanzig Milligramm täglich', 'zwanzig mg täglich');
    expect(formatiereWerAbweichungen(e.operationen)).toEqual(['milligramm -> mg']);
  });

  it('benennt fehlende und ueberzaehlige Woerter', () => {
    // Auch eindeutig: Anhaengen bzw. Weglassen am Ende.
    const fehlt = berechneWerNormiertMitDiff('drei Tabletten täglich', 'drei Tabletten');
    expect(formatiereWerAbweichungen(fehlt.operationen)).toEqual(['[fehlt] täglich']);
    const zuviel = berechneWerNormiertMitDiff('drei Tabletten', 'drei Tabletten täglich');
    expect(formatiereWerAbweichungen(zuviel.operationen)).toEqual(['[zuviel] täglich']);
  });

  it('ergibt eine leere Liste, wenn nichts abweicht', () => {
    const e = berechneWerMitDiff('alles gleich', 'alles gleich');
    expect(formatiereWerAbweichungen(e.operationen)).toEqual([]);
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
