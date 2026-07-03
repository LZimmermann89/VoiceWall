/**
 * Unit-Tests des YAML-Front-Matter-Serializers/-Parsers (M5, ABARBEITUNG
 * 4.4.2): Round-trip mit boesartigen Titeln (Quotes, Newlines, YAML-Syntax,
 * Emoji, sehr lang), Injektionsabwehr (kein zweiter Schluessel erzeugbar),
 * Toleranz beim Lesen von Hand editierter Dateien und harte Ablehnung von
 * Nicht-flachem/kaputtem Front-Matter.
 */
import { describe, expect, it } from 'vitest';
import {
  buildPreview,
  countWords,
  normalizeBody,
  parseFrontMatter,
  serializeFrontMatter,
} from '../../src/shared/front-matter';
import { transcriptMetaSchema } from '../../src/shared/company';

const BODY = 'Sehr geehrter Herr Müller,\n\nvielen Dank für Ihre Anfrage.\n';

function baseMeta(titel: string): Record<string, string | number | readonly string[]> {
  return {
    id: '2026-07-02_143210_a1b2c3',
    titel,
    erstellt: '2026-07-02T14:32:10+02:00',
    geaendert: '2026-07-02T14:35:02+02:00',
    sprache: 'de',
    modell: 'whisper-large-v3-turbo-german-q5_0',
    dauer_sekunden: 47,
    wortzahl: 128,
    tags: ['angebot', 'müller', 'vertrieb'],
    quelle: 'diktat',
    version: 1,
  };
}

describe('front-matter: Round-trip mit boesartigen Titeln', () => {
  const evilTitles: readonly [string, string][] = [
    ['doppelte Quotes', 'Angebot "Sonderpreis" fuer Müller'],
    ['einfache Quotes', "Vertrag 'exklusiv' O'Brien"],
    ['Newlines', 'Zeile eins\nzeile zwei\r\nzeile drei'],
    ['YAML-Injektion Doppelpunkt', 'titel: boese: wert # kommentar'],
    ['YAML-Injektion neuer Schluessel', 'x"\nid: gekapert\nboese: [a, b]'],
    ['YAML-Dokumententrenner', '--- alles --- vorbei ---'],
    ['YAML-Sonderzeichen', '{alias: *anchor} &anker !!str %TAG [x, y]'],
    ['Emoji und Umlaute', 'Protokoll 🎙️ Grüße an Herrn Größe ß'],
    ['Backslashes', 'C:\\Pfad\\zu\\nichts \\u0041 \\n'],
    ['Tab und Steuerzeichen-Escape', 'Titel\tmit\tTabs'],
    ['sehr lang', `Sehr langer Titel ${'wirklich sehr lang '.repeat(20)}Ende`],
    ['fuehrende/abschliessende Spaces', '   viel Rand   '],
    ['sieht aus wie bool', 'true'],
    ['sieht aus wie Zahl', '42'],
  ];

  for (const [label, titel] of evilTitles) {
    it(`Round-trip: ${label}`, () => {
      const serialized = serializeFrontMatter(baseMeta(titel), BODY);
      const parsed = parseFrontMatter(serialized);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) {
        return;
      }
      expect(parsed.value.meta['titel']).toBe(titel);
      expect(parsed.value.meta['id']).toBe('2026-07-02_143210_a1b2c3');
      expect(parsed.value.meta['tags']).toEqual(['angebot', 'müller', 'vertrieb']);
      expect(parsed.value.body).toBe(normalizeBody(BODY));
      // Kein injizierter Schluessel darf entstehen (strukturelle Abwehr).
      expect(Object.keys(parsed.value.meta).sort()).toEqual(Object.keys(baseMeta(titel)).sort());
    });
  }

  it('Round-trip: boesartige Tags', () => {
    const meta = {
      ...baseMeta('Normal'),
      tags: ['mit spaces und "quotes"', "o'brien", 'kommazeichen,drin', 'emoji🎙️', 'a]b[c'],
    };
    const parsed = parseFrontMatter(serializeFrontMatter(meta, BODY));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.meta['tags']).toEqual(meta.tags);
    }
  });

  it('serialisierte Metadaten bestehen das Transkript-Schema', () => {
    const serialized = serializeFrontMatter(baseMeta('Angebot "Müller"'), BODY);
    const parsed = parseFrontMatter(serialized);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(transcriptMetaSchema.safeParse(parsed.value.meta).success).toBe(true);
    }
  });
});

describe('front-matter: Parser-Robustheit (Hand-Edits, Angriffe)', () => {
  it('parst das Beispiel aus ABARBEITUNG 4.4.2 (plain Skalare, Kommentare)', () => {
    const content = [
      '---',
      'id: 2026-07-02_143210_a1b2c3       # stabile ID, kollisionsfrei',
      'titel: "Angebot Müller"             # Nutzer-Titel, echte Umlaute',
      'erstellt: 2026-07-02T14:32:10+02:00 # ISO 8601 mit Zeitzone',
      'geaendert: 2026-07-02T14:35:02+02:00',
      'sprache: de',
      'modell: whisper-large-v3-turbo-german-q5_0',
      'dauer_sekunden: 47                  # Laenge des Audios',
      'wortzahl: 128',
      'tags: [angebot, mueller, vertrieb]',
      'quelle: diktat',
      'ziel_app: "Microsoft Word"',
      'version: 1',
      '---',
      '',
      'Sehr geehrter Herr Müller, vielen Dank für Ihre Anfrage ...',
    ].join('\n');
    const parsed = parseFrontMatter(content);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.value.meta['id']).toBe('2026-07-02_143210_a1b2c3');
    expect(parsed.value.meta['titel']).toBe('Angebot Müller');
    expect(parsed.value.meta['dauer_sekunden']).toBe(47);
    expect(parsed.value.meta['tags']).toEqual(['angebot', 'mueller', 'vertrieb']);
    expect(parsed.value.meta['ziel_app']).toBe('Microsoft Word');
    expect(parsed.value.body).toContain('Sehr geehrter Herr Müller');
    expect(transcriptMetaSchema.safeParse(parsed.value.meta).success).toBe(true);
  });

  it('parst einfach quotierte Strings mit Escape', () => {
    const parsed = parseFrontMatter("---\ntitel: 'O''Brien'\n---\nBody\n");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.meta['titel']).toBe("O'Brien");
    }
  });

  it('lehnt doppelte Schluessel ab (Injektionsmuster)', () => {
    const parsed = parseFrontMatter('---\nid: eins\nid: zwei\n---\nBody\n');
    expect(parsed.ok).toBe(false);
  });

  it('lehnt verschachtelte Strukturen ab (kein echtes YAML)', () => {
    expect(parseFrontMatter('---\ntitel: {a: b}\n---\nBody\n').ok).toBe(false);
    expect(parseFrontMatter('---\ntags: [[a], b]\n---\nBody\n').ok).toBe(false);
  });

  it('lehnt fehlendes und nicht abgeschlossenes Front-Matter ab', () => {
    expect(parseFrontMatter('Kein Front-Matter\n').ok).toBe(false);
    expect(parseFrontMatter('---\nid: x\nBody ohne Ende\n').ok).toBe(false);
  });

  it('lehnt ungueltige Zeilen und leere Werte ab', () => {
    expect(parseFrontMatter('---\nid ohne doppelpunkt\n---\nBody\n').ok).toBe(false);
    expect(parseFrontMatter('---\nid:\n---\nBody\n').ok).toBe(false);
  });
});

describe('front-matter: Hilfsfunktionen', () => {
  it('buildPreview kuerzt auf ~160 Zeichen und glaettet Whitespace', () => {
    const long = 'wort '.repeat(100);
    const preview = buildPreview(long);
    expect(Array.from(preview).length).toBeLessThanOrEqual(164);
    expect(preview.endsWith('...')).toBe(true);
    expect(buildPreview('kurz\nund   knapp')).toBe('kurz und knapp');
  });

  it('countWords zaehlt Whitespace-getrennte Tokens', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('  ')).toBe(0);
    expect(countWords('eins zwei\ndrei')).toBe(3);
  });
});
