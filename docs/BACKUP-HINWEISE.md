> 🇬🇧 English version: [BACKUP-HINWEISE.en.md](BACKUP-HINWEISE.en.md)

# Backup und Verschlüsselung (VoiceWall)

Dieses Dokument gehört zum DSGVO-Beleg-Blatt
(`rechtstexte/DSGVO-BELEG-BLATT.md`, Abschnitt 5) und ist inhaltlich
deckungsgleich mit dem Abschnitt „Backup und Verschlüsselung“ in der
Beleg-Ansicht der App (`src/shared/backup-hinweise.ts`). Es adressiert
ein bewusst ernst genommenes Risiko: unverschlüsseltes Klartext-Backup
hochsensibler Diktate.

## Die zentrale Warnung zuerst

> Wichtig: Ihre Diktate liegen als Klartext-Markdown im Firmenordner. Eine
> Kopie auf einen unverschlüsselten USB-Stick oder ein unverschlüsseltes
> Netzlaufwerk ist damit ein unverschlüsseltes Klartext-Backup. Diktate können
> hochsensible Inhalte enthalten, etwa Gesundheitsdaten oder andere besondere
> Kategorien personenbezogener Daten im Sinne von Art. 9 DSGVO. Verwenden Sie
> deshalb ausschließlich verschlüsselte Backup-Medien.

Das Klartext-Format ist eine bewusste Architektur-Entscheidung (Ordner als
Datenbank): es macht die Daten beweisbar lokal, portabel und
auch ohne VoiceWall lesbar. Die Kehrseite ist, dass der SCHUTZ der Kopien in
Ihrer Hand liegt. Diese Seite sagt konkret, wie.

## So sichern Sie Ihre Diktate (Backup)

Der Firmenordner ist die gesamte Datenbank. Für ein vollständiges Backup
kopieren Sie einfach den kompletten Firmenordner (z. B. „Müller & Söhne GmbH“
auf dem Desktop bzw. unter `~/VoiceWall`) auf Ihr Backup-Medium. Es gibt keine
versteckte Datenbank, keine Registry-Einträge und keine Passwörter, die
zusätzlich gesichert werden müssten.

Zurückspielen (Restore): den gesicherten Ordner wieder an die Desktop-Stelle
legen, VoiceWall starten und die Firma erscheint (notfalls über „Neue Firma
einrichten“ mit demselben Namen übernehmen). Die Diktate sind reines Markdown
und bleiben auch ganz ohne VoiceWall lesbar.

## Backup-Medium verschlüsseln (dringend empfohlen)

### macOS: FileVault und verschlüsselte Laufwerke

- Interne Festplatte: Systemeinstellungen → Datenschutz & Sicherheit →
  FileVault → „FileVault aktivieren“.
- Externe Laufwerke und USB-Sticks: im Finder mit der rechten Maustaste auf
  das Laufwerk klicken und „… verschlüsseln“ wählen, oder das Laufwerk im
  Festplattendienstprogramm als „APFS (verschlüsselt)“ formatieren.

### Windows: BitLocker und BitLocker To Go

- Interne Festplatte: Einstellungen → Datenschutz und Sicherheit →
  Geräteverschlüsselung (bzw. Systemsteuerung →
  BitLocker-Laufwerkverschlüsselung).
- USB-Sticks und externe Laufwerke: im Explorer mit der rechten Maustaste auf
  das Laufwerk → „BitLocker aktivieren“ (BitLocker To Go).

Bewahren Sie den Wiederherstellungsschlüssel des Betriebssystems getrennt vom
Backup-Medium auf (z. B. ausgedruckt im Ordner mit den Firmenunterlagen).

## Verschlüsselter Einzel-Export (.vwenc)

Für die Weitergabe einzelner Diktate (z. B. per USB-Stick an die
Steuerberatung) bietet VoiceWall in der Detailansicht „Verschlüsselt
exportieren“ an: die Markdown-Datei wird lokal mit AES-256-GCM verschlüsselt
und als `.vwenc`-Datei im Ordner `Exporte/` abgelegt. Entschlüsselt wird
ausschließlich hier in der App unter „Datei entschlüsseln“ (Beleg-Ansicht).

Das Passwort (mindestens 12 Zeichen) wird nirgends gespeichert. Geht das
Passwort verloren, ist der Inhalt der `.vwenc`-Datei unwiederbringlich
verloren; es gibt keine Hintertür und keine Wiederherstellung.

Technische Eckdaten (`src/main/storage/encrypted-export.ts`):
eigenes schlichtes Container-Format `VWENC1` (Magic, Versions- und
KDF-Kennung, Salt, Nonce, Auth-Tag, Ciphertext), Schlüsselableitung scrypt
(N=16384, r=8, p=1), AES-256-GCM mit authentifizierter Entschlüsselung: ein
falsches Passwort oder eine manipulierte Datei schlägt hart und erkennbar
fehl. Alles mit Node-Bordmitteln, keine zusätzliche Abhängigkeit, kein
Netzwerk.
