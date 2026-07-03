/**
 * Netzwerk-Selbsttest als strukturierte Daten fuer die Beleg-Ansicht (M7).
 *
 * Inhaltlich deckungsgleich mit docs/NETZWERK-SELBSTTEST.md (dort ausfuehrlich
 * fuer den Ausdruck; hier als eingebettete UI-Ansicht). Bewusst als
 * TypeScript-Konstante statt Datei-Import: die CSP der Oberflaeche verbietet
 * externe Ressourcen, und der Renderer hat keinen Dateizugriff. So ist der
 * Beleg auch offline und im paketierten Build garantiert vorhanden.
 *
 * Plattformneutral (kein Node/DOM).
 */
export interface SelbsttestProbe {
  readonly titel: string;
  readonly schritte: readonly string[];
  readonly ergebnis: string;
}

export const NETZWERK_SELBSTTEST_PROBEN: readonly SelbsttestProbe[] = [
  {
    titel: 'Probe 1: Netzwerk-Anzeige der App (Entwicklertools)',
    schritte: [
      'Öffnen Sie die Entwicklertools (Mac: Cmd+Alt+I, Windows: F12 bzw. Strg+Umschalt+I).',
      'Wechseln Sie auf den Reiter Netzwerk und wählen Sie den Filter Alle.',
      'Diktieren Sie nun beliebig viele Texte, per Hotkey oder Testaufnahme.',
    ],
    ergebnis:
      'In der Liste erscheint kein einziger Eintrag zu einer externen Adresse. Die fest eingebaute Sicherheitsrichtlinie (Content-Security-Policy) verbietet jede Verbindung zu fremden Adressen, selbst wenn Schadcode es versuchen würde.',
  },
  {
    titel: 'Probe 2: Verbindungsmonitor des Betriebssystems',
    schritte: [
      'Mac: Firewall-Werkzeug wie LuLu oder Little Snitch beobachten, oder im Terminal lsof -i -a -p <VoiceWall-PID>.',
      'Windows: Ressourcenmonitor (resmon) öffnen, Reiter Netzwerk.',
      'Diktieren Sie und beobachten Sie die ausgehenden Verbindungen.',
    ],
    ergebnis:
      'VoiceWall taucht dort nicht auf. Einzige Ausnahme ist der einmalige, prüfsummen-verifizierte Modell-Download bei der Einrichtung.',
  },
  {
    titel: 'Probe 3: Die härteste Probe, der Netzstecker',
    schritte: [
      'Stellen Sie sicher, dass die einmalige Einrichtung (Modell-Download) abgeschlossen ist.',
      'Trennen Sie die Internetverbindung vollständig (WLAN aus, Kabel ziehen, Flugmodus).',
      'Diktieren Sie wie gewohnt: Hotkey drücken, sprechen, Hotkey drücken.',
    ],
    ergebnis:
      'VoiceWall funktioniert vollständig und ohne jede Einschränkung offline. Aufnahme, Erkennung und Einfügen laufen komplett auf Ihrem Rechner. Es gibt keine Cloud, die fehlen könnte.',
  },
];

/** Kurzer Verweis auf die ausfuehrliche, mitgelieferte Anleitung. */
export const NETZWERK_SELBSTTEST_DOKUMENT = 'docs/NETZWERK-SELBSTTEST.md';
