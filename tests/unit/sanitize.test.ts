/**
 * Angriffsklassen-Tests der Firmenname-Sanitisierung und des Containments
 * (ABARBEITUNG 3.4, M4). Jede hier gepruefte Klasse ist ein realer
 * Angriffsweg: Traversal, absolute Pfade, Laufwerksbuchstaben, reservierte
 * Windows-Namen, Unicode-Faelschung (Zero-Width, BiDi), NFD/NFC-Kollisionen,
 * trailing Dots/Spaces, Leer-/Sonderzeichen-Eingaben, Laengengrenzen und
 * Containment-Bypass-Versuche nach path.resolve.
 */
import { resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MAX_SEGMENT_LENGTH,
  MAX_TOTAL_PATH_LENGTH,
  buildCompanyDirPath,
  comparableSegmentKey,
  findEquivalentDirEntry,
  resolveContainedChildPath,
  sanitizeCompanyName,
} from '../../src/main/storage/sanitize';

const BASE = resolve('/Users/test/Desktop');

function expectSegment(raw: string): string {
  const result = sanitizeCompanyName(raw);
  expect(result.ok, `Erwartet ok fuer ${JSON.stringify(raw)}`).toBe(true);
  return result.ok ? result.value : '';
}

function expectErrorKind(raw: string, kind: string): void {
  const result = sanitizeCompanyName(raw);
  expect(result.ok, `Erwartet Fehler fuer ${JSON.stringify(raw)}`).toBe(false);
  if (!result.ok) {
    expect(result.error.kind).toBe(kind);
    expect(result.error.message.length).toBeGreaterThan(10);
  }
}

describe('sanitizeCompanyName: gutartige Eingaben', () => {
  it('laesst normale Firmennamen unveraendert', () => {
    expect(expectSegment('Müller GmbH')).toBe('Müller GmbH');
    expect(expectSegment('Zimmermann & Söhne')).toBe('Zimmermann & Söhne');
    expect(expectSegment('Praxis Dr. Weber')).toBe('Praxis Dr. Weber');
  });

  it('normalisiert NFD-Eingaben zu NFC', () => {
    const nfd = 'Mu\u0308ller'; // "Mueller" dekomponiert (NFD)
    const result = expectSegment(nfd);
    expect(result).toBe('Müller');
    expect(result).toBe(result.normalize('NFC'));
  });
});

describe('sanitizeCompanyName: Traversal-Angriffe', () => {
  it.each([
    ['../geheim', 'geheim'],
    ['..\\geheim', 'geheim'],
    ['....//etc', 'etc'],
    ['....\\\\etc', 'etc'],
    // URL-Encoding wird NIE dekodiert: '%2F' bleibt harmloser Literaltext.
    ['..%2F..', '%2F'],
    ['a/../../b', 'ab'],
    ['..', null],
    ['....', null],
    ['./.', null],
  ])('entschaerft %s', (raw, expected) => {
    const result = sanitizeCompanyName(raw);
    if (expected === null) {
      expect(result.ok).toBe(false);
    } else {
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toContain('..');
        expect(result.value).not.toContain('/');
        expect(result.value).not.toContain('\\');
        expect(result.value).toBe(expected);
      }
    }
  });

  it('entfernt absolute Pfade und Laufwerksbuchstaben', () => {
    expect(expectSegment('/etc/passwd')).toBe('etcpasswd');
    expect(expectSegment('C:\\Windows\\System32')).toBe('CWindowsSystem32');
    expect(expectSegment('C:')).toBe('C');
    expect(expectSegment('\\\\server\\share')).toBe('servershare');
  });
});

describe('sanitizeCompanyName: reservierte Windows-Namen', () => {
  it.each(['CON', 'con', 'PRN', 'AUX', 'NUL', 'nul', 'COM1', 'COM9', 'LPT1', 'LPT9', 'lpt5'])(
    'lehnt %s ab',
    (name) => {
      expectErrorKind(name, 'reserviert');
    },
  );

  it('lehnt reservierte Namen auch mit Endung ab (NUL.txt == NUL)', () => {
    expectErrorKind('NUL.txt', 'reserviert');
    expectErrorKind('con.tar.gz', 'reserviert');
    expectErrorKind('Com1.backup', 'reserviert');
  });

  it('akzeptiert Namen, die reservierte nur enthalten', () => {
    expect(expectSegment('CONSULTING')).toBe('CONSULTING');
    expect(expectSegment('Auxerre GmbH')).toBe('Auxerre GmbH');
    expect(expectSegment('COM10')).toBe('COM10');
  });
});

describe('sanitizeCompanyName: Unicode-Faelschung', () => {
  it('entfernt Zero-Width- und BiDi-Override-Zeichen', () => {
    expect(expectSegment('Fir\u200Bma\u200D\u200EX')).toBe('FirmaX');
    expect(expectSegment('abc\u202Egpj.exe')).toBe('abcgpj.exe');
    expectErrorKind('\u200B\u200C\u200D\u202A\u202E', 'leer');
  });

  it('entfernt Steuerzeichen (0x00-0x1F, 0x7F)', () => {
    expect(expectSegment('Fir\u0000ma\u001F\u007FX')).toBe('FirmaX');
    expectErrorKind('\u0000\u0001\u0002', 'leer');
  });
});

describe('sanitizeCompanyName: reservierte Zeichen, Dots und Spaces', () => {
  it('entfernt die Windows-reservierten Zeichen <>:"/\\|?*', () => {
    expect(expectSegment('Fa. <Meier>? "Nord"|*')).toBe('Fa. Meier Nord');
  });

  it('entfernt trailing Dots und Spaces', () => {
    expect(expectSegment('Firma.')).toBe('Firma');
    expect(expectSegment('Firma...   ')).toBe('Firma');
    expect(expectSegment('Firma . . ')).toBe('Firma');
  });

  it('lehnt leere und Nur-Sonderzeichen-Eingaben ab', () => {
    expectErrorKind('', 'leer');
    expectErrorKind('   ', 'leer');
    expectErrorKind('...', 'leer');
    expectErrorKind('///\\\\', 'leer');
    expectErrorKind('<>:"|?*', 'leer');
    expectErrorKind('.', 'leer');
  });
});

describe('sanitizeCompanyName: Laengengrenze', () => {
  it('kuerzt auf 96 Zeichen (Codepoint-genau)', () => {
    const long = 'A'.repeat(200);
    const result = expectSegment(long);
    expect(result.length).toBe(MAX_SEGMENT_LENGTH);
  });

  it('laesst genau 96 Zeichen unangetastet', () => {
    const exact = 'B'.repeat(MAX_SEGMENT_LENGTH);
    expect(expectSegment(exact)).toBe(exact);
  });

  it('zerreisst keine Surrogatpaare beim Kuerzen', () => {
    const emoji = '😀'.repeat(120); // jedes Emoji: 2 UTF-16-Einheiten
    const result = expectSegment(emoji);
    expect(Array.from(result).length).toBe(MAX_SEGMENT_LENGTH);
    // Kein einsames Surrogat am Ende:
    expect(result.at(-1)).not.toMatch(/[\uD800-\uDBFF]$/);
  });

  it('entfernt durch Kuerzung entstandene trailing Dots', () => {
    const tricky = `${'C'.repeat(MAX_SEGMENT_LENGTH - 1)}.zzzz`;
    const result = expectSegment(tricky);
    expect(result.endsWith('.')).toBe(false);
  });
});

describe('resolveContainedChildPath: Containment nach path.resolve', () => {
  it('akzeptiert ein echtes Kind', () => {
    const result = resolveContainedChildPath(BASE, 'Müller GmbH');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(resolve(BASE, 'Müller GmbH'));
      expect(result.value.startsWith(BASE + sep)).toBe(true);
    }
  });

  it.each(['..', '../x', 'a/../..', '/etc', 'a/b', 'a\\..\\b', 'a\\b', '.', '...'])(
    'lehnt Bypass-Versuch %s ab (Segment haette nie durchgelassen werden duerfen)',
    (segment) => {
      // Bewusst OHNE sanitizeCompanyName: das Containment ist die letzte,
      // eigenstaendige Verteidigungslinie und muss allein standhalten.
      // Backslash-Segmente werden auf ALLEN Plattformen abgelehnt: unter
      // Windows kollabiert path.resolve "a\..\b" sonst zu einem gueltigen
      // Kind, und ein POSIX-Ordner mit Backslash im Namen waere beim Kopieren
      // auf Windows eine Traversal (Portabilitaet des Firmenordners).
      const result = resolveContainedChildPath(BASE, segment);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('containment');
      }
    },
  );

  it('lehnt das leere Segment ab (Ziel == Basis)', () => {
    const result = resolveContainedChildPath(BASE, '');
    expect(result.ok).toBe(false);
  });
});

describe('buildCompanyDirPath: Gesamtpipeline', () => {
  it('liefert Segment und contained Pfad', () => {
    const result = buildCompanyDirPath(BASE, '  Müller GmbH.  ');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.segment).toBe('Müller GmbH');
      expect(result.value.dirPath).toBe(resolve(BASE, 'Müller GmbH'));
    }
  });

  it('weist Traversal-Eingaben ein sicheres Kind zu oder lehnt ab', () => {
    const result = buildCompanyDirPath(BASE, '../../../etc/passwd');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dirPath.startsWith(resolve(BASE) + sep)).toBe(true);
      expect(result.value.dirPath).toBe(resolve(BASE, 'etcpasswd'));
    }
  });

  it('prueft den Gesamtpfad gegen MAX_PATH (260)', () => {
    const deepBase = resolve('/Users/test/Desktop', 'x'.repeat(220));
    const result = buildCompanyDirPath(deepBase, 'Y'.repeat(90));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('pfad-zu-lang');
    }
    expect(deepBase.length + 90 + 1).toBeGreaterThan(MAX_TOTAL_PATH_LENGTH);
  });
});

describe('NFD-/Case-Kollisionserkennung (Kritik B4)', () => {
  it('vergleicht NFC- und NFD-Formen als gleich', () => {
    expect(comparableSegmentKey('Müller')).toBe(comparableSegmentKey('Mu\u0308ller'));
  });

  it('vergleicht case-insensitiv (Müller vs MÜLLER)', () => {
    expect(comparableSegmentKey('Müller')).toBe(comparableSegmentKey('MÜLLER'));
    expect(comparableSegmentKey('Firma')).not.toBe(comparableSegmentKey('Firmen'));
  });

  it('findet den existierenden NFD-Ordner fuer eine NFC-Eingabe', () => {
    const existingNfd = 'Mu\u0308ller GmbH'; // wie APFS/HFS+ ihn liefern kann
    const found = findEquivalentDirEntry(
      [existingNfd, 'Andere AG'],
      'Müller GmbH'.normalize('NFC'),
    );
    expect(found).toBe(existingNfd);
  });

  it('findet den existierenden Ordner bei Case-Kollision (MÜLLER vs Müller)', () => {
    const found = findEquivalentDirEntry(['Müller', 'Schmidt'], 'MÜLLER');
    expect(found).toBe('Müller');
  });

  it('liefert null, wenn kein aequivalenter Eintrag existiert', () => {
    expect(findEquivalentDirEntry(['Schmidt', 'Weber'], 'Müller')).toBeNull();
  });
});
