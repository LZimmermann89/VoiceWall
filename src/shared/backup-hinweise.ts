/**
 * Backup- und Verschluesselungs-Hinweise als strukturierte Daten fuer die
 * Beleg-Ansicht (M8, Risiko R16, Kritik D10).
 *
 * Inhaltlich deckungsgleich mit docs/BACKUP-HINWEISE.md (dort ausfuehrlich
 * fuer den Ausdruck bzw. das Beleg-Blatt in M9; hier als eingebettete
 * UI-Ansicht). Bewusst als TypeScript-Konstante statt Datei-Import: die CSP
 * der Oberflaeche verbietet externe Ressourcen und der Renderer hat keinen
 * Dateizugriff. So ist der Hinweis auch offline und im paketierten Build
 * garantiert vorhanden.
 *
 * Plattformneutral (kein Node/DOM).
 */

export interface BackupHinweisAbschnitt {
  readonly titel: string;
  readonly absaetze: readonly string[];
}

/**
 * Die zentrale Warnung (R16): sie wird in der UI hervorgehoben dargestellt
 * und steht wortgleich in docs/BACKUP-HINWEISE.md.
 */
export const BACKUP_KLARTEXT_WARNUNG =
  'Wichtig: Ihre Diktate liegen als Klartext-Markdown im Firmenordner. Eine Kopie auf einen unverschlüsselten USB-Stick oder ein unverschlüsseltes Netzlaufwerk ist damit ein unverschlüsseltes Klartext-Backup. Diktate können hochsensible Inhalte enthalten, etwa Gesundheitsdaten oder andere besondere Kategorien personenbezogener Daten im Sinne von Art. 9 DSGVO. Verwenden Sie deshalb ausschließlich verschlüsselte Backup-Medien.';

export const BACKUP_HINWEISE: readonly BackupHinweisAbschnitt[] = [
  {
    titel: 'So sichern Sie Ihre Diktate (Backup)',
    absaetze: [
      'Der Firmenordner ist die gesamte Datenbank. Für ein vollständiges Backup kopieren Sie einfach den kompletten Firmenordner (z. B. „Müller & Söhne GmbH“ auf dem Desktop bzw. unter ~/VoiceWall) auf Ihr Backup-Medium. Es gibt keine versteckte Datenbank, keine Registry-Einträge und keine Passwörter, die zusätzlich gesichert werden müssten.',
      'Zurückspielen (Restore): den gesicherten Ordner wieder an die Desktop-Stelle legen, VoiceWall starten und die Firma erscheint (notfalls über „Neue Firma einrichten“ mit demselben Namen übernehmen). Die Diktate sind reines Markdown und bleiben auch ganz ohne VoiceWall lesbar.',
    ],
  },
  {
    titel: 'Backup-Medium verschlüsseln (dringend empfohlen)',
    absaetze: [
      'macOS: Aktivieren Sie FileVault für die interne Festplatte unter Systemeinstellungen → Datenschutz & Sicherheit → FileVault → „FileVault aktivieren“. Externe Laufwerke und USB-Sticks: im Finder mit der rechten Maustaste auf das Laufwerk klicken und „… verschlüsseln“ wählen, oder das Laufwerk im Festplattendienstprogramm als „APFS (verschlüsselt)“ formatieren.',
      'Windows: Aktivieren Sie BitLocker unter Einstellungen → Datenschutz und Sicherheit → Geräteverschlüsselung (bzw. Systemsteuerung → BitLocker-Laufwerkverschlüsselung). Für USB-Sticks und externe Laufwerke nutzen Sie BitLocker To Go: im Explorer mit der rechten Maustaste auf das Laufwerk → „BitLocker aktivieren“.',
      'Bewahren Sie den Wiederherstellungsschlüssel des Betriebssystems getrennt vom Backup-Medium auf (z. B. ausgedruckt im Ordner mit den Firmenunterlagen).',
    ],
  },
  {
    titel: 'Verschlüsselter Einzel-Export (.vwenc)',
    absaetze: [
      'Für die Weitergabe einzelner Diktate (z. B. per USB-Stick an die Steuerberatung) bietet VoiceWall in der Detailansicht „Verschlüsselt exportieren“ an: die Markdown-Datei wird lokal mit AES-256-GCM verschlüsselt und als .vwenc-Datei im Ordner Exporte/ abgelegt. Entschlüsselt wird ausschließlich hier in der App unter „Datei entschlüsseln“.',
      'Das Passwort (mindestens 12 Zeichen) wird nirgends gespeichert. Geht das Passwort verloren, ist der Inhalt der .vwenc-Datei unwiederbringlich verloren; es gibt keine Hintertür und keine Wiederherstellung.',
    ],
  },
];

/** Pfad des ausfuehrlichen Dokuments (Teil des Beleg-Blatts in M9). */
export const BACKUP_HINWEISE_DOKUMENT = 'docs/BACKUP-HINWEISE.md';
