/**
 * Anbieterkennzeichnung (Impressum) für den "Über VoiceWall"-Bereich der
 * Beleg-Ansicht (M9, ABARBEITUNG Abschnitt 8). Die App zeigt den Inhalt
 * vollständig LOKAL an; es ist kein Web-Zugriff nötig. Der Inhalt ist
 * bewusst deckungsgleich mit rechtstexte/IMPRESSUM.md (Repo) und der
 * Quelle der-ki-auditor.de/impressum.
 *
 * Rechtsgrundlagen: § 5 DDG sowie § 7 DDG in Verbindung mit der Verordnung
 * (EU) 2022/2065 (Digital Services Act). Bewusst NIE das aufgehobene
 * Telemediengesetz zitieren (CI-Gate scripts/check-legal-references.mjs).
 */

/** Kurzbezeichnung des Anbieters für Fußzeilen und Kurzangaben. */
export const ANBIETER_KURZ = 'FERNAU Präzisionstechnik GmbH, Darmstadt';

/**
 * Statische Quelle des Impressums im Web. Wird ausschließlich als Literal
 * an shell.openExternal übergeben (dokumentierte Ausnahme neben dem
 * Bedienungshilfen-Deep-Link, siehe docs/ENTSCHEIDUNGEN.md E31): nie
 * dynamischer Input, nie Nutzerdaten.
 */
export const IMPRESSUM_QUELLE_URL = 'https://der-ki-auditor.de/impressum';

/** Strukturierte Impressums-Zeilen für die lokale Anzeige in der App. */
export const IMPRESSUM_ANGABEN: readonly { readonly label: string; readonly wert: string }[] = [
  { label: 'Anbieter (§ 5 DDG)', wert: 'FERNAU Präzisionstechnik GmbH' },
  { label: 'Anschrift', wert: 'Merianstraße 5a, 64291 Darmstadt, Deutschland' },
  {
    label: 'Vertreten durch die Geschäftsführung',
    wert: 'Clara Fernau, Theodor Fernau, Lars Zimmermann',
  },
  { label: 'Telefon', wert: '+49 6150 184973-0' },
  { label: 'E-Mail', wert: 'info@der-ki-auditor.de' },
  { label: 'Registergericht', wert: 'Amtsgericht Darmstadt, HRB 7378' },
  { label: 'USt-IdNr. (§ 27a UStG)', wert: 'DE812710783' },
  {
    label: 'Inhaltlich verantwortlich (§ 18 Abs. 2 MStV)',
    wert: 'Lars Zimmermann, Anschrift wie oben',
  },
] as const;

/** Erläuterung unter den Angaben (Marke, Rechtsgrundlage, Rechtstexte). */
export const IMPRESSUM_HINWEIS =
  'VoiceWall ist ein Angebot der FERNAU Präzisionstechnik GmbH (Lizenznehmerin der Marke ' +
  '"Der KI-Auditor"). Rechtsgrundlagen der Anbieterkennzeichnung: § 5 DDG sowie § 7 DDG in ' +
  'Verbindung mit der Verordnung (EU) 2022/2065 (Digital Services Act). Die vollständigen ' +
  'Rechtstexte (Impressum, Datenschutzerklärung, DSGVO-Beleg-Blatt, AI-Act-Einordnung, ' +
  'Widerrufsbelehrung für den Vor-Ort-Dienst) liegen dem Quellcode im Ordner rechtstexte/ bei.';
