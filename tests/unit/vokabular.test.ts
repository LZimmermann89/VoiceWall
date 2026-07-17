/**
 * Unit-Tests des Fach-Woerterbuchs (Stufe 1): Ersetzungs-Engine
 * (Unicode-Wortgrenzen mit Umlauten, laengste-zuerst, Literalbehandlung von
 * Regex-Zeichen, Case-Sensitivitaet), Prompt-Bau mit harter Kappung und
 * das zod-Schema (Limits, deutsche Meldungen).
 */
import { describe, expect, it } from 'vitest';
import {
  applyErsetzungen,
  applyErsetzungenMitProtokoll,
  buildInitialPrompt,
  defaultVokabular,
  formatAngewandteErsetzung,
  MAX_BEGRIFFE,
  PROMPT_MAX_CHARS,
  vokabularSchema,
  VOKABULAR_SCHEMA_VERSION,
} from '../../src/shared/vokabular';

describe('applyErsetzungen', () => {
  it('ersetzt ganze Woerter ("Voice Wall" -> "VoiceWall")', () => {
    expect(
      applyErsetzungen('Dies ist ein Test für Voice Wall.', [
        { von: 'Voice Wall', zu: 'VoiceWall' },
      ]),
    ).toBe('Dies ist ein Test für VoiceWall.');
  });

  it('ersetzt NIE Teilwoerter ("Meier" nicht in "Vermeiden")', () => {
    expect(
      applyErsetzungen('Vermeiden Sie Fehler, Herr Meier.', [{ von: 'Meier', zu: 'Meyer' }]),
    ).toBe('Vermeiden Sie Fehler, Herr Meyer.');
  });

  it('Umlaut-Wortgrenzen: "Müller" wird in "Müllers" NICHT ersetzt', () => {
    // JavaScript-\b versagt bei Umlauten; die eigene Grenzlogik nutzt
    // Unicode-Property-Klassen. Bei Teilwoertern gilt: kein Treffer.
    expect(applyErsetzungen('Müllers Auto ist da.', [{ von: 'Müller', zu: 'Mueller' }])).toBe(
      'Müllers Auto ist da.',
    );
  });

  it('Umlaut-Wortgrenzen: "Müller" als ganzes Wort wird ersetzt', () => {
    expect(applyErsetzungen('Herr Müller kommt.', [{ von: 'Müller', zu: 'Mueller' }])).toBe(
      'Herr Mueller kommt.',
    );
  });

  it('erkennt Wortgrenzen VOR dem Treffer mit Umlaut ("ä" grenzt an)', () => {
    // "Bär" endet auf r; "är" darf in "Bär" nicht als eigenes Wort gelten.
    expect(applyErsetzungen('Der Bär schläft.', [{ von: 'är', zu: 'X' }])).toBe('Der Bär schläft.');
  });

  it('ist case-sensitiv exakt wie eingegeben', () => {
    expect(
      applyErsetzungen('voice wall und Voice Wall', [{ von: 'Voice Wall', zu: 'VoiceWall' }]),
    ).toBe('voice wall und VoiceWall');
  });

  it('wendet laengere von-Strings zuerst an (Teilketten-Konflikt)', () => {
    const regeln = [
      { von: 'Voice', zu: 'FALSCH' },
      { von: 'Voice Wall', zu: 'VoiceWall' },
    ];
    expect(applyErsetzungen('Voice Wall ist gut.', regeln)).toBe('VoiceWall ist gut.');
  });

  it('behandelt Regex-Sonderzeichen als Literale (kein ReDoS, Regel 3.5)', () => {
    expect(
      applyErsetzungen('Der Ausdruck (a+b)* ist Text.', [{ von: '(a+b)*', zu: 'FORMEL' }]),
    ).toBe('Der Ausdruck FORMEL ist Text.');
    // Ein boesartiges "Regex" wie (a+)+$ ist nur ein String und terminiert.
    expect(applyErsetzungen('aaaaaaaaaaaaaaaaaaaaaaaaaaaa!', [{ von: '(a+)+$', zu: 'x' }])).toBe(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaa!',
    );
  });

  it('ersetzt mehrere Vorkommen im selben Text', () => {
    expect(
      applyErsetzungen('Akte 4711, nochmal Akte 4711.', [{ von: 'Akte 4711', zu: 'AZ-4711' }]),
    ).toBe('AZ-4711, nochmal AZ-4711.');
  });

  it('durchsucht den eingesetzten zu-Text nicht erneut (terminiert immer)', () => {
    expect(applyErsetzungen('ab', [{ von: 'ab', zu: 'abab' }])).toBe('abab');
  });

  it('ersetzt am Textanfang und Textende', () => {
    expect(applyErsetzungen('Müller ruft Müller', [{ von: 'Müller', zu: 'M.' }])).toBe(
      'M. ruft M.',
    );
  });

  it('erlaubt Loeschung (zu ist leer)', () => {
    expect(applyErsetzungen('bitte dies entfernen', [{ von: ' dies', zu: '' }])).toBe(
      'bitte entfernen',
    );
  });

  it('laesst den Text ohne Regeln unveraendert', () => {
    expect(applyErsetzungen('Nichts zu tun.', [])).toBe('Nichts zu tun.');
  });

  it('Ziffern zaehlen als Wortzeichen ("4711" nicht in "47112")', () => {
    expect(applyErsetzungen('Nummer 47112 bleibt.', [{ von: '4711', zu: 'AZ' }])).toBe(
      'Nummer 47112 bleibt.',
    );
  });
});

describe('buildInitialPrompt', () => {
  it('liefert null ohne Begriffe', () => {
    expect(buildInitialPrompt([])).toEqual({
      prompt: null,
      verwendeteBegriffe: 0,
      gekappt: false,
    });
  });

  it('baut eine kommaseparierte Liste (empirisch verifizierte Form)', () => {
    expect(buildInitialPrompt(['VoiceWall', 'Müller GmbH']).prompt).toBe('VoiceWall, Müller GmbH');
  });

  it('ignoriert leere und reine Leerzeichen-Begriffe', () => {
    expect(buildInitialPrompt(['  ', 'VoiceWall ', ''])).toEqual({
      prompt: 'VoiceWall',
      verwendeteBegriffe: 1,
      gekappt: false,
    });
  });

  it('kappt hart bei PROMPT_MAX_CHARS und meldet die Kappung', () => {
    const begriffe = Array.from({ length: 50 }, (_, i) => `Fachbegriff-${String(i)}-mit-Laenge`);
    const result = buildInitialPrompt(begriffe);
    expect(result.gekappt).toBe(true);
    expect(result.prompt).not.toBeNull();
    expect((result.prompt ?? '').length).toBeLessThanOrEqual(PROMPT_MAX_CHARS);
    expect(result.verwendeteBegriffe).toBeLessThan(begriffe.length);
    expect(result.verwendeteBegriffe).toBeGreaterThan(0);
  });

  it('ein einzelner ueberlanger Begriff ergibt null und gekappt', () => {
    const monster = 'x'.repeat(PROMPT_MAX_CHARS + 1);
    expect(buildInitialPrompt([monster])).toEqual({
      prompt: null,
      verwendeteBegriffe: 0,
      gekappt: true,
    });
  });
});

describe('vokabularSchema', () => {
  it('akzeptiert das Default-Vokabular', () => {
    const parsed = vokabularSchema.safeParse(defaultVokabular());
    expect(parsed.success).toBe(true);
  });

  it('akzeptiert Begriffe und Ersetzungen mit Umlauten', () => {
    const parsed = vokabularSchema.safeParse({
      schemaVersion: VOKABULAR_SCHEMA_VERSION,
      begriffe: ['Müller & Söhne GmbH', 'Aktenzeichen 4711'],
      ersetzungen: [{ von: 'Voice Wall', zu: 'VoiceWall' }],
    });
    expect(parsed.success).toBe(true);
  });

  it('lehnt mehr als 200 Begriffe mit deutscher Meldung ab', () => {
    const parsed = vokabularSchema.safeParse({
      schemaVersion: 1,
      begriffe: Array.from({ length: MAX_BEGRIFFE + 1 }, (_, i) => `B${String(i)}`),
      ersetzungen: [],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain('200');
    }
  });

  it('lehnt Begriffe ueber 80 Zeichen ab', () => {
    const parsed = vokabularSchema.safeParse({
      schemaVersion: 1,
      begriffe: ['x'.repeat(81)],
      ersetzungen: [],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain('80');
    }
  });

  it('lehnt leere von-Strings ab, erlaubt leere zu-Strings', () => {
    const leerVon = vokabularSchema.safeParse({
      schemaVersion: 1,
      begriffe: [],
      ersetzungen: [{ von: '', zu: 'x' }],
    });
    expect(leerVon.success).toBe(false);
    const leerZu = vokabularSchema.safeParse({
      schemaVersion: 1,
      begriffe: [],
      ersetzungen: [{ von: 'x', zu: '' }],
    });
    expect(leerZu.success).toBe(true);
  });

  it('lehnt Steuerzeichen in Begriffen ab', () => {
    const parsed = vokabularSchema.safeParse({
      schemaVersion: 1,
      begriffe: ['boese\u0000zeichen'],
      ersetzungen: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('unbekannte Felder ueberleben das Parsen (Kompatibilitaet)', () => {
    const parsed = vokabularSchema.safeParse({
      schemaVersion: 1,
      begriffe: [],
      ersetzungen: [],
      zukunft: 'bleibt erhalten',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect((parsed.data as Record<string, unknown>)['zukunft']).toBe('bleibt erhalten');
    }
  });
});

describe('applyErsetzungenMitProtokoll (Beleg der Textaufbereitung)', () => {
  it('protokolliert je Regel die tatsaechliche Trefferzahl', () => {
    const { text, angewandt } = applyErsetzungenMitProtokoll(
      'Voice Wall trifft Voice Wall und Herrn Meier.',
      [
        { von: 'Meier', zu: 'Meyer' },
        { von: 'Voice Wall', zu: 'VoiceWall' },
      ],
    );
    expect(text).toBe('VoiceWall trifft VoiceWall und Herrn Meyer.');
    // Reihenfolge = Anwendungsreihenfolge (laengere von-Strings zuerst).
    expect(angewandt).toEqual([
      { von: 'Voice Wall', zu: 'VoiceWall', anzahl: 2 },
      { von: 'Meier', zu: 'Meyer', anzahl: 1 },
    ]);
  });

  it('nicht greifende Regeln erscheinen nicht im Protokoll', () => {
    const { text, angewandt } = applyErsetzungenMitProtokoll('Nichts zu ersetzen.', [
      { von: 'Meier', zu: 'Meyer' },
    ]);
    expect(text).toBe('Nichts zu ersetzen.');
    expect(angewandt).toEqual([]);
  });

  it('Teilwort-Nichttreffer zaehlen nicht ("Müller" nicht in "Müllers")', () => {
    const { angewandt } = applyErsetzungenMitProtokoll('Müllers Auto, Herr Müller.', [
      { von: 'Müller', zu: 'Mueller' },
    ]);
    expect(angewandt).toEqual([{ von: 'Müller', zu: 'Mueller', anzahl: 1 }]);
  });

  it('applyErsetzungen bleibt deckungsgleich zur Protokoll-Variante', () => {
    const regeln = [{ von: 'Voice Wall', zu: 'VoiceWall' }];
    const eingabe = 'Voice Wall bleibt Voice Wall.';
    expect(applyErsetzungen(eingabe, regeln)).toBe(
      applyErsetzungenMitProtokoll(eingabe, regeln).text,
    );
  });
});

describe('formatAngewandteErsetzung (Front-Matter-Beleg)', () => {
  it('formatiert von, zu und Trefferzahl deterministisch', () => {
    expect(formatAngewandteErsetzung({ von: 'Voice Wall', zu: 'VoiceWall', anzahl: 2 })).toBe(
      'Voice Wall -> VoiceWall (2x)',
    );
  });

  it('benennt ein leeres Ziel als [entfernt]', () => {
    expect(formatAngewandteErsetzung({ von: ' dies', zu: '', anzahl: 1 })).toBe(
      ' dies -> [entfernt] (1x)',
    );
  });

  it('bleibt unter dem 200-Zeichen-Schemalimit (80+80-Maximalregel)', () => {
    const lang = formatAngewandteErsetzung({
      von: 'a'.repeat(80),
      zu: 'b'.repeat(80),
      anzahl: 999,
    });
    expect(lang.length).toBeLessThanOrEqual(200);
  });
});
