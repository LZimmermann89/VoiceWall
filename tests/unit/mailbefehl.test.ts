/**
 * Tests des Mail-Befehls. Ohne Modelle, laeuft in der CI.
 *
 * Hier entscheidet sich, an WEN eine Mail vorbereitet wird. Ein Falschtreffer
 * waere gravierender als ein verpasster Befehl, und eine falsch aufgeloeste
 * Adresse waere das Schlimmste von allem. Entsprechend viel Platz nehmen die
 * Negativfaelle ein.
 */
import { describe, expect, it } from 'vitest';
import {
  baueMailtoUrl,
  erkenneMailbefehl,
  findeKontakt,
  kontakteSchema,
  mailAdresseSchema,
  MAILTO_MAX_LAENGE,
  type Kontakt,
} from '../../src/shared/mailbefehl';

const KONTAKTE: readonly Kontakt[] = [
  { name: 'Lars', adresse: 'l.zimmermann@fernau-gmbh.de' },
  { name: 'Frau Weber', adresse: 'weber@beispiel.de' },
  { name: 'Doppelt', adresse: 'eins@beispiel.de' },
  { name: 'doppelt', adresse: 'zwei@beispiel.de' },
];

describe('erkenneMailbefehl: Treffer', () => {
  it('erkennt die ausformulierte Grundform', () => {
    const treffer = erkenneMailbefehl(
      'Verfasse eine Mail an Lars mit folgendem Text: Hallo Test 214',
    );
    expect(treffer?.empfaenger).toBe('Lars');
    expect(treffer?.text).toBe('Hallo Test 214');
    expect(treffer?.betreff).toBeNull();
  });

  it('erkennt die Kurzform mit Doppelpunkt', () => {
    const treffer = erkenneMailbefehl('Mail an Frau Weber: Der Termin passt so.');
    expect(treffer?.empfaenger).toBe('Frau Weber');
    expect(treffer?.text).toBe('Der Termin passt so.');
  });

  it('erkennt Schreibvarianten von E-Mail und die anderen Verben', () => {
    expect(erkenneMailbefehl('Schreibe eine E-Mail an Lars: Kurz und gut')?.empfaenger).toBe(
      'Lars',
    );
    expect(erkenneMailbefehl('Erstelle eine E Mail an Lars: Kurz und gut')?.empfaenger).toBe(
      'Lars',
    );
    expect(erkenneMailbefehl('E-Mail an Lars: Kurz und gut')?.empfaenger).toBe('Lars');
  });

  it('erkennt einen Betreff und trennt ihn vom Empfaenger', () => {
    const treffer = erkenneMailbefehl(
      'Verfasse eine Mail an Lars mit Betreff Angebot 2026 mit folgendem Text: Anbei die Zahlen',
    );
    expect(treffer?.empfaenger).toBe('Lars');
    expect(treffer?.betreff).toBe('Angebot 2026');
    expect(treffer?.text).toBe('Anbei die Zahlen');
  });

  it('laesst den Nachrichtentext unangetastet, auch mit Satzzeichen und Umlauten', () => {
    const treffer = erkenneMailbefehl(
      'Mail an Lars: Sehr geehrter Herr Müller, die Prüfung ist abgeschlossen. Viele Grüße',
    );
    expect(treffer?.text).toBe(
      'Sehr geehrter Herr Müller, die Prüfung ist abgeschlossen. Viele Grüße',
    );
  });

  it('erkennt die englische Form', () => {
    const treffer = erkenneMailbefehl(
      'Write an email to Lars with the following text: Hello',
      'en',
    );
    expect(treffer?.empfaenger).toBe('Lars');
    expect(treffer?.text).toBe('Hello');
  });
});

describe('erkenneMailbefehl: darf NICHT ausloesen', () => {
  it('nicht ohne das Wort Mail', () => {
    // "schreibe an" allein ist zu nah an normalem Diktattext.
    expect(erkenneMailbefehl('Schreibe an Lars: Der Termin passt')).toBeNull();
  });

  it('nicht mitten im Text', () => {
    expect(
      erkenneMailbefehl('Ich habe eine Mail an Lars geschrieben mit folgendem Text: Testinhalt'),
    ).toBeNull();
  });

  it('nicht ohne Nachrichtentext', () => {
    expect(erkenneMailbefehl('Verfasse eine Mail an Lars')).toBeNull();
    expect(erkenneMailbefehl('Verfasse eine Mail an Lars mit folgendem Text:')).toBeNull();
    expect(erkenneMailbefehl('Mail an Lars:')).toBeNull();
  });

  it('nicht ohne Empfaenger', () => {
    expect(erkenneMailbefehl('Verfasse eine Mail an: Hallo')).toBeNull();
    expect(erkenneMailbefehl('Mail an : Hallo')).toBeNull();
  });

  it('nicht bei normalem Diktat, das zufaellig von Mails handelt', () => {
    expect(
      erkenneMailbefehl('Die Mail an den Mandanten ging gestern raus und wurde beantwortet.'),
    ).toBeNull();
    expect(erkenneMailbefehl('Bitte prüfen Sie die Mail an Herrn Weber vom Montag.')).toBeNull();
  });

  it('nicht bei leerem Text', () => {
    expect(erkenneMailbefehl('')).toBeNull();
    expect(erkenneMailbefehl('   ')).toBeNull();
  });
});

describe('findeKontakt', () => {
  it('findet unabhaengig von Gross-/Kleinschreibung und Leerraum', () => {
    expect(findeKontakt('lars', KONTAKTE)?.adresse).toBe('l.zimmermann@fernau-gmbh.de');
    expect(findeKontakt('  Frau   Weber ', KONTAKTE)?.adresse).toBe('weber@beispiel.de');
  });

  it('gibt bei unbekanntem Namen null zurueck', () => {
    expect(findeKontakt('Herr Meier', KONTAKTE)).toBeNull();
  });

  it('gibt bei Mehrdeutigkeit null zurueck', () => {
    // Zwei Eintraege, die sich nur in der Schreibweise unterscheiden: lieber
    // nachfragen als an die falsche Person schreiben.
    expect(findeKontakt('doppelt', KONTAKTE)).toBeNull();
  });
});

describe('mailAdresseSchema', () => {
  it('nimmt uebliche Adressen an', () => {
    expect(mailAdresseSchema.safeParse('l.zimmermann@fernau-gmbh.de').success).toBe(true);
    expect(mailAdresseSchema.safeParse('a@b.de').success).toBe(true);
  });

  it('lehnt ab, was keine Adresse ist', () => {
    expect(mailAdresseSchema.safeParse('ohne-at-zeichen.de').success).toBe(false);
    expect(mailAdresseSchema.safeParse('zwei@at@zeichen.de').success).toBe(false);
    expect(mailAdresseSchema.safeParse('mit leerzeichen@beispiel.de').success).toBe(false);
    expect(mailAdresseSchema.safeParse('ohne@punkt').success).toBe(false);
    expect(mailAdresseSchema.safeParse('').success).toBe(false);
  });
});

describe('baueMailtoUrl', () => {
  it('behaelt das At-Zeichen der Adresse lesbar', () => {
    const url = baueMailtoUrl('l.zimmermann@fernau-gmbh.de', null, 'Hallo');
    expect(url.startsWith('mailto:l.zimmermann@fernau-gmbh.de?')).toBe(true);
  });

  it('kodiert Betreff und Text vollstaendig', () => {
    const url = baueMailtoUrl('a@b.de', 'Angebot & Preis', 'Zeile eins\nZeile zwei');
    expect(url).toContain('subject=Angebot%20%26%20Preis');
    expect(url).toContain('body=Zeile%20eins%0AZeile%20zwei');
  });

  it('laesst den Betreff weg, wenn keiner genannt wurde', () => {
    expect(baueMailtoUrl('a@b.de', null, 'Hallo')).toBe('mailto:a@b.de?body=Hallo');
  });

  it('kann aus dem Text keinen weiteren Parameter einschleusen', () => {
    // Ein Text, der wie ein zusaetzlicher Parameter aussieht, muss kodiert
    // werden, sonst koennte ein Diktat den Empfaenger heimlich erweitern.
    const url = baueMailtoUrl('a@b.de', null, '&bcc=fremder@beispiel.de');
    expect(url).toContain('body=%26bcc%3Dfremder%40beispiel.de');
    expect(url.split('&')).toHaveLength(1);
  });

  it('begrenzt die Laenge', () => {
    const url = baueMailtoUrl('a@b.de', null, 'x'.repeat(MAILTO_MAX_LAENGE * 2));
    expect(url.length).toBeLessThanOrEqual(MAILTO_MAX_LAENGE);
  });
});

describe('kontakteSchema', () => {
  it('nimmt ein leeres Verzeichnis an', () => {
    expect(kontakteSchema.safeParse({ schemaVersion: 1, kontakte: [] }).success).toBe(true);
  });

  it('lehnt einen Eintrag mit ungueltiger Adresse ab', () => {
    const geprueft = kontakteSchema.safeParse({
      schemaVersion: 1,
      kontakte: [{ name: 'Lars', adresse: 'keine-adresse' }],
    });
    expect(geprueft.success).toBe(false);
  });
});
