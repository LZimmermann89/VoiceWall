/**
 * Laufzeit-Doppelnetz zur Katalog-Vollstaendigkeit.
 *
 * Die PRIMAERE Vollstaendigkeitsgarantie ist das Typsystem
 * (en: Uebersetzung = typeof de, fehlender Schluessel = Compilerfehler).
 * Diese Tests sichern zusaetzlich zur Laufzeit ab:
 *  1. de und en haben rekursiv exakt dieselbe Schluesselstruktur
 *     (inkl. Array-Laengen und Wert-Typen).
 *  2. Kein englischer String-Wert ist leer.
 *  3. Kein englischer String-Wert ist identisch mit dem deutschen,
 *     ausser auf der dokumentierten Allowlist (Eigennamen, bewusst
 *     zweisprachige Texte des Sprachwahl-Schritts, technische Begriffe
 *     und sprachneutrale Werte wie "Status" oder Dokumentpfade).
 */
import { describe, expect, it } from 'vitest';
import { de, en } from '../../src/shared/i18n';

/**
 * Schluessel-Pfade, deren Werte in beiden Sprachen IDENTISCH sein duerfen.
 * Jeder Eintrag ist begruendet; neue Eintraege brauchen eine Begruendung.
 */
const IDENTISCH_ERLAUBT = new Set<string>([
  // Der Sprachumschalter ist bewusst in beiden Sprachen gleich beschriftet
  // (jede Option in ihrer eigenen Sprache, Label zweisprachig fix).
  'app.sprachumschalterLabel',
  'app.sprachumschalterDeutsch',
  'app.sprachumschalterEnglisch',
  // Wizard-Schritt 0 ist bewusst zweisprachig (vor der Sprachwahl).
  'wizard.schrittNamen.sprachwahl',
  'wizard.sprachwahl.titel',
  'wizard.sprachwahl.lede',
  'wizard.sprachwahl.aria',
  'wizard.sprachwahl.deutschTitel',
  'wizard.sprachwahl.deutschBeschreibung',
  'wizard.sprachwahl.englischTitel',
  'wizard.sprachwahl.englischBeschreibung',
  // Technische Eigennamen bzw. sprachneutrale Fachbegriffe.
  'wizard.modell.q5Titel', // "Q5_0"
  'diktat.abschnittStatus', // "Status"
  'diktat.statusEngine', // "Engine:"
  'register.formatTxt', // "TXT"
  'register.formatPdf', // "PDF"
  'register.tagFilterLabel', // "Tags:"
  'register.detail.zeileVersion', // "Version"
  'register.detail.zeileTags', // "Tags"
  'register.detail.tagsLabel', // "Tags"
  'register.detail.keinWert', // "—"
  'register.detail.exportTxt', // "Export TXT" (in beiden Sprachen korrekt)
  'register.detail.exportPdf', // "Export PDF" (in beiden Sprachen korrekt)
  'register.detail.textLabel', // "Text" (in beiden Sprachen korrekt)
  'register.notiz.textLabel', // "Text" (in beiden Sprachen korrekt)
  'format.quelle.import', // "Import"
  // Dokumentpfade (Dateinamen, keine Uebersetzung).
  'beleg.selbsttestDokument',
  'beleg.backupDokument',
  // Main-Katalog: sprachneutrale Werte.
  'main.pdf.quelle.import', // "Import"
  'main.pdf.zeileTags', // "Tags"
  // Modelle-Reiter: sprachneutraler Fachbegriff.
  'modelleTab.pruefsummeLabel', // "SHA-256:"
]);

type Knoten = Record<string, unknown>;

function istObjekt(value: unknown): value is Knoten {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Sammelt rekursiv alle Blatt-Pfade mit ihrem Wert-Typ. */
function beschreibeStruktur(value: unknown, pfad: string, out: Map<string, string>): void {
  if (istObjekt(value)) {
    for (const key of Object.keys(value).sort()) {
      beschreibeStruktur(value[key], pfad === '' ? key : `${pfad}.${key}`, out);
    }
    return;
  }
  if (Array.isArray(value)) {
    out.set(`${pfad}[]`, `array(${String(value.length)})`);
    value.forEach((entry, index) => {
      beschreibeStruktur(entry, `${pfad}[${String(index)}]`, out);
    });
    return;
  }
  out.set(pfad, typeof value);
}

/** Sammelt rekursiv alle String-Blaetter (Pfad -> Wert). */
function sammleStrings(value: unknown, pfad: string, out: Map<string, string>): void {
  if (istObjekt(value)) {
    for (const key of Object.keys(value)) {
      sammleStrings(value[key], pfad === '' ? key : `${pfad}.${key}`, out);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      sammleStrings(entry, `${pfad}[${String(index)}]`, out);
    });
    return;
  }
  if (typeof value === 'string') {
    out.set(pfad, value);
  }
}

describe('i18n-Kataloge', () => {
  it('de und en haben rekursiv dieselbe Schluesselstruktur und Wert-Typen', () => {
    const deStruktur = new Map<string, string>();
    const enStruktur = new Map<string, string>();
    beschreibeStruktur(de, '', deStruktur);
    beschreibeStruktur(en, '', enStruktur);
    expect([...enStruktur.entries()].sort()).toEqual([...deStruktur.entries()].sort());
  });

  it('kein englischer String-Wert ist leer', () => {
    const enStrings = new Map<string, string>();
    sammleStrings(en, '', enStrings);
    const leere = [...enStrings.entries()].filter(([, wert]) => wert.trim().length === 0);
    expect(leere).toEqual([]);
    // Plausibilitaet: der Katalog ist substanziell (kein Stumpf).
    expect(enStrings.size).toBeGreaterThan(250);
  });

  it('kein englischer String-Wert ist identisch mit dem deutschen (ausser Allowlist)', () => {
    const deStrings = new Map<string, string>();
    const enStrings = new Map<string, string>();
    sammleStrings(de, '', deStrings);
    sammleStrings(en, '', enStrings);
    const unerwartetIdentisch: string[] = [];
    for (const [pfad, enWert] of enStrings) {
      // Array-Eintraege (Selbsttest-/Backup-Absaetze) sind uebersetzt; die
      // Allowlist adressiert nur skalare Blatt-Pfade.
      if (IDENTISCH_ERLAUBT.has(pfad)) {
        continue;
      }
      if (deStrings.get(pfad) === enWert) {
        unerwartetIdentisch.push(pfad);
      }
    }
    expect(unerwartetIdentisch).toEqual([]);
  });

  it('jeder Allowlist-Eintrag existiert und ist tatsaechlich identisch', () => {
    const deStrings = new Map<string, string>();
    const enStrings = new Map<string, string>();
    sammleStrings(de, '', deStrings);
    sammleStrings(en, '', enStrings);
    for (const pfad of IDENTISCH_ERLAUBT) {
      expect(deStrings.has(pfad), `Allowlist-Pfad fehlt im Katalog: ${pfad}`).toBe(true);
      expect(enStrings.get(pfad), `Allowlist-Pfad nicht identisch: ${pfad}`).toBe(
        deStrings.get(pfad),
      );
    }
  });

  it('parametrisierte Texte sind in beiden Sprachen Funktionen mit Ergebnis', () => {
    // Stichproben: dieselbe Funktion liefert in beiden Sprachen einen
    // nicht-leeren, unterschiedlichen String.
    expect(de.register.wortzahl(3)).toBe('3 Wörter');
    expect(en.register.wortzahl(3)).toBe('3 words');
    expect(de.register.exportErgebnis(1, 'Exporte/x', 0)).toContain('Eintrag');
    expect(en.register.exportErgebnis(1, 'Exporte/x', 0)).toContain('entry');
    expect(de.register.exportErgebnis(2, 'Exporte/x', 1)).toContain('Einträge');
    expect(en.register.exportErgebnis(2, 'Exporte/x', 1)).toContain('entries');
    expect(de.wizard.kickerSchritt('01', '09')).toBe('Schritt 01 von 09');
    expect(en.wizard.kickerSchritt('01', '09')).toBe('Step 01 of 09');
  });
});
