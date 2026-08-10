/**
 * Tests der Zielerkennung. Ohne Modelle, laeuft in der CI.
 *
 * Der wichtigste Teil sind die Negativfaelle: Diese Erkennung entscheidet,
 * WOHIN fremder Text geschrieben wird. Ein Falschtreffer waere gravierender
 * als ein verpasster Befehl, deshalb steht hier mehr Text zu dem, was NICHT
 * erkannt werden darf, als zu dem, was erkannt wird.
 */
import { describe, expect, it } from 'vitest';
import {
  erkenneZielbefehl,
  istVerfuegbarAuf,
  zielanwendungMitId,
  zieleFuerPlattform,
  ZIELANWENDUNGEN,
} from '../../src/shared/zielanwendung';

describe('erkenneZielbefehl: Treffer', () => {
  it('erkennt die Grundform und gibt den Text ohne Wendung zurueck', () => {
    const treffer = erkenneZielbefehl('Das Angebot ist geprüft an Word senden');
    expect(treffer?.ziel.id).toBe('word');
    expect(treffer?.text).toBe('Das Angebot ist geprüft');
  });

  it('erkennt alle zugelassenen Praepositionen und Verben', () => {
    expect(erkenneZielbefehl('Der Text in Excel einfügen')?.ziel.id).toBe('excel');
    expect(erkenneZielbefehl('Der Text nach Outlook übertragen')?.ziel.id).toBe('outlook');
    expect(erkenneZielbefehl('Der Text zu Teams schicken')?.ziel.id).toBe('teams');
    expect(erkenneZielbefehl('Der Text ins Notizen kopieren')?.ziel.id).toBe('notizen');
  });

  it('erkennt zweiteilige Namen und bevorzugt den laengeren', () => {
    expect(erkenneZielbefehl('Die Folie an Power Point senden')?.ziel.id).toBe('powerpoint');
    expect(erkenneZielbefehl('Der Code an IntelliJ IDEA senden')?.ziel.id).toBe('intellij');
    expect(erkenneZielbefehl('Die Notiz an Visual Studio Code senden')?.ziel.id).toBe('vscode');
  });

  it('ignoriert Gross-/Kleinschreibung und Satzzeichen der Wendung', () => {
    expect(erkenneZielbefehl('Bitte pruefen, AN WORD SENDEN.')?.ziel.id).toBe('word');
    expect(erkenneZielbefehl('Bitte pruefen an Word senden!')?.ziel.id).toBe('word');
  });

  it('laesst den Text davor unangetastet (Umlaute, Satzzeichen, Schreibweise)', () => {
    const treffer = erkenneZielbefehl(
      'Sehr geehrter Herr Müller, die Prüfung ist abgeschlossen an Outlook senden',
    );
    expect(treffer?.text).toBe('Sehr geehrter Herr Müller, die Prüfung ist abgeschlossen');
  });

  it('entfernt ein haengendes Komma vor der Wendung', () => {
    expect(erkenneZielbefehl('Der Vorgang ist erledigt, an Word senden')?.text).toBe(
      'Der Vorgang ist erledigt',
    );
  });

  it('erkennt die englische Form', () => {
    const treffer = erkenneZielbefehl('The offer is ready to Word send', 'en');
    expect(treffer?.ziel.id).toBe('word');
    expect(treffer?.text).toBe('The offer is ready');
  });
});

describe('erkenneZielbefehl: darf NICHT ausloesen', () => {
  it('nicht ohne Verb am Ende', () => {
    // Der haeufigste Fehlauslöser waere ein Satz, der auf den blossen
    // Anwendungsnamen endet. Genau deshalb ist das Verb Pflicht.
    expect(erkenneZielbefehl('Bitte übertragen Sie die Daten in Excel')).toBeNull();
    expect(erkenneZielbefehl('Das Dokument liegt in Word')).toBeNull();
  });

  it('nicht ohne Praeposition', () => {
    expect(erkenneZielbefehl('Wir werden das Angebot Word senden')).toBeNull();
  });

  it('nicht bei einem unbekannten Zielnamen', () => {
    expect(erkenneZielbefehl('Den Vertrag an Herrn Müller senden')).toBeNull();
    expect(erkenneZielbefehl('Die Unterlagen an die Kanzlei senden')).toBeNull();
  });

  it('nicht mitten im Text', () => {
    // Nur die Schlusswendung zaehlt; sonst wuerde ein beilaeufiger Satz
    // mitten im Diktat den Rest kapern.
    expect(
      erkenneZielbefehl('Wir haben die Datei an Word senden lassen und danach geprüft'),
    ).toBeNull();
  });

  it('nicht bei zu kurzem Text', () => {
    expect(erkenneZielbefehl('an Word senden')).toBeNull();
    expect(erkenneZielbefehl('')).toBeNull();
  });

  it('nicht bei einem Verb, das gar nicht in der Liste steht', () => {
    expect(erkenneZielbefehl('Die Datei an Word anhängen')).toBeNull();
  });
});

describe('Katalog', () => {
  it('hat eindeutige Kennungen und gesprochene Namen', () => {
    const ids = ZIELANWENDUNGEN.map((ziel) => ziel.id);
    expect(new Set(ids).size).toBe(ids.length);
    const namen = ZIELANWENDUNGEN.flatMap((ziel) => ziel.gesprochen);
    expect(new Set(namen).size).toBe(namen.length);
  });

  it('haelt gesprochene Namen klein und ohne Sonderzeichen', () => {
    for (const ziel of ZIELANWENDUNGEN) {
      for (const gesprochen of ziel.gesprochen) {
        expect(gesprochen).toBe(gesprochen.toLowerCase());
        expect(gesprochen).toMatch(/^[a-zäöüß0-9 +]+$/);
      }
    }
  });

  it('ist auf jeder Plattform mindestens einmal ansteuerbar', () => {
    // Ein Eintrag, den es weder auf macOS noch auf Windows gibt, waere tot.
    for (const ziel of ZIELANWENDUNGEN) {
      const irgendwo = istVerfuegbarAuf(ziel, 'darwin') || istVerfuegbarAuf(ziel, 'win32');
      expect(irgendwo, `${ziel.id} ist auf keiner Plattform ansteuerbar`).toBe(true);
    }
  });

  it('nennt fuer macOS immer Prozess UND Anwendungsnamen zusammen', () => {
    for (const ziel of ZIELANWENDUNGEN) {
      expect(ziel.macosProzess.length > 0, ziel.id).toBe(ziel.macosApp !== null);
    }
  });

  it('enthaelt bewusst KEINE Kommandozeile', () => {
    const verboten = ['terminal', 'iterm', 'powershell', 'cmd', 'eingabeaufforderung', 'shell'];
    for (const ziel of ZIELANWENDUNGEN) {
      for (const gesprochen of ziel.gesprochen) {
        expect(verboten).not.toContain(gesprochen);
      }
    }
  });

  it('findet Ziele ueber die Kennung', () => {
    expect(zielanwendungMitId('excel')?.name).toBe('Excel');
    expect(zielanwendungMitId('gibt-es-nicht')).toBeNull();
  });

  it('filtert je Plattform', () => {
    const mac = zieleFuerPlattform('darwin').map((z) => z.id);
    const win = zieleFuerPlattform('win32').map((z) => z.id);
    expect(mac).toContain('safari');
    expect(mac).not.toContain('editor');
    expect(win).toContain('editor');
    expect(win).not.toContain('safari');
    expect(zieleFuerPlattform('linux')).toHaveLength(0);
  });
});
