# DSGVO-Beleg-Blatt zu VoiceWall (kundenfertig)

Dieses Blatt können Sie Ihrer eigenen Datenschutz-Dokumentation
beilegen. Es sagt präzise, was der Einsatz von VoiceWall
datenschutzrechtlich bedeutet, welche Nachweise es dafür gibt und wie
Sie jeden Nachweis selbst prüfen. Es ist bewusst ohne Übertreibung
formuliert: VoiceWall beseitigt die Auftragsverarbeiter- und
Cloud-Dimension vollständig und liefert den Beleg dafür; es macht Sie
nicht pauschal "DSGVO-fertig". Die Pflichten für Ihre eigenen Inhalte
bleiben bei Ihnen (Abschnitt 5).

Herausgeber: FERNAU Präzisionstechnik GmbH, Merianstraße 5a, 64291
Darmstadt, kontakt@der-ki-auditor.de (Anbieterangaben:
`rechtstexte/IMPRESSUM.md`). Stand: 03.07.2026.

## 1. Kein Auftragsverarbeiter, kein AVV nötig (Art. 28 DSGVO)

Ein Auftragsverarbeitungsvertrag ist abzuschließen, wenn ein Dritter
personenbezogene Daten im Auftrag des Verantwortlichen verarbeitet
(Art. 28 Abs. 1 und 3 DSGVO). Bei VoiceWall existiert dieser Dritte
nicht: die gesamte Verarbeitung (Aufnahme, Spracherkennung, Speicherung)
findet ausschließlich lokal auf Ihrem Rechner statt. Weder die FERNAU
Präzisionstechnik GmbH noch ein sonstiger Anbieter erhält, speichert
oder verarbeitet Ihre Diktate. Es gibt keinen Server, kein Konto, keine
Anmeldung. Sie bleiben alleiniger Verantwortlicher für Ihre eigene
lokale Verarbeitung; ein AVV mit dem Software-Anbieter ist deshalb
weder nötig noch inhaltlich möglich (es gäbe keinen Verarbeitungsinhalt).

## 2. Kein Drittlandtransfer (Kapitel V DSGVO)

Da keine Daten den Rechner verlassen, gibt es keine Übermittlung in ein
Drittland: keine Standardvertragsklauseln, kein Angemessenheitsbeschluss,
kein Transfer-Impact-Assessment. Einzige transparent gemachte Ausnahme
außerhalb des Betriebs: der optionale, einmalige Modell-Download bei der
Einrichtung (Abschnitt 4, Nachweis N1), bei dem der Server von Hugging
Face technisch bedingt Ihre IP-Adresse sieht; es werden dabei keine
Diktat- oder Personendaten übertragen, und bei der Vor-Ort-Installation
entfällt der Download in der Regel ganz (Offline-Einspielung).

## 3. Was das für Ihre Dokumentation bedeutet

- **Art. 30 DSGVO (Verzeichnis von Verarbeitungstätigkeiten):** Sie
  führen Ihr Verzeichnis für die eigene Verarbeitung weiter. Für
  VoiceWall entfällt jede Zeile zu einem Auftragsverarbeiter oder
  Empfänger, weil keiner existiert. Als Verarbeitung können Sie
  eintragen: "Lokale Sprach-zu-Text-Erkennung und Ablage von Diktaten
  als Dateien auf dem Arbeitsplatzrechner, Software VoiceWall, keine
  Empfänger, kein Drittlandtransfer."
- **Art. 25 DSGVO (Datenschutz durch Technikgestaltung):** Die
  Architektur ist die Maßnahme: keine Netzwerkfähigkeit im Betrieb,
  Audio nur im Arbeitsspeicher, restriktive Voreinstellungen ohne
  Konfigurationsaufwand. Dieses Blatt und die Nachweise darunter sind
  Ihr Rechenschafts-Beleg im Sinne von Art. 5 Abs. 2 DSGVO.
- **Art. 35 DSGVO (Datenschutz-Folgenabschätzung):** Durch VoiceWall
  entsteht kein zusätzliches Drittrisiko, das eine DSFA wegen einer
  Verarbeitung durch Dritte auslöst. Ob Ihre konkreten Diktat-Inhalte
  (etwa Gesundheitsdaten) für sich eine DSFA erfordern, bleibt Ihre
  eigene Prüfung, unabhängig vom Werkzeug.

## 4. Die Nachweise und wie Sie sie selbst prüfen

| Nr. | Nachweis                                                                                                                                                 | Selbst nachprüfen                                                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | **Netzwerk-Selbsttest:** Im Betrieb null externe Verbindungen; einzige Ausnahme der einmalige Modell-Download bei der Einrichtung.                       | Drei unabhängige Proben in `docs/NETZWERK-SELBSTTEST.md` (auch in der App, Bereich "Beleg"): Netzwerk-Anzeige der App (DevTools), Verbindungsmonitor des Betriebssystems, Betrieb mit gezogenem Netzstecker. Zusätzlich erzwingt ein automatischer Test (`tests/e2e/network-isolation.spec.ts`) bei jedem Entwicklungsstand null nicht-lokale Anfragen. |
| N2  | **Kein offener Netzwerk-Port:** Die App startet keinen Server; die interne Kommunikation läuft über Prozess-IPC.                                         | Portscan von einem zweiten Gerät im selben Netz (z. B. `nmap <IP-des-Rechners>`) zeigt keinen von VoiceWall geöffneten Port; lokal zeigt `lsof -i -a -p <VoiceWall-PID>` (macOS) bzw. der Ressourcenmonitor (Windows) keine lauschende Verbindung. Im Quellcode existiert kein `listen(`-Aufruf.                                                        |
| N3  | **RAM-only-Audio:** Mikrofon-Audio wird nie auf die Festplatte geschrieben; nach der Erkennung wird der Puffer aktiv verworfen.                          | Ordnerinspektion während und nach einem Diktat: weder im Firmenordner noch in den Temp-Verzeichnissen entsteht eine Audiodatei. Ehrliche Fußnote in Abschnitt 5.                                                                                                                                                                                        |
| N4  | **Content-Security-Policy:** Die Oberfläche verbietet per fest eingebauter CSP jede Verbindung zu fremden Adressen, selbst für hypothetischen Schadcode. | DevTools der App öffnen, im Reiter "Netzwerk" diktieren (N1); die CSP ist im Quellcode (`src/main`) einsehbar und enthält keine externe Origin.                                                                                                                                                                                                         |
| N5  | **SBOM (Software-Stückliste):** Jede enthaltene Komponente ist maschinenlesbar dokumentiert (CycloneDX).                                                 | `npm run sbom` erzeugt die Stückliste selbst; je Release liegt sie unter `release/` bei. Abgleich mit `package-lock.json` (Integritäts-Hashes, `npm ci`).                                                                                                                                                                                               |
| N6  | **Checksummen:** Die Whisper-Modelle und alle sechs nativen Plattform-Binaries sind per SHA-256 gepinnt; Abweichung bricht Installation und CI.          | `node scripts/verify-checksums.mjs` ausführen; Modell-Hashes stehen in `resources/model-manifest.json` und in der App im Bereich "Beleg" (mit `shasum -a 256 <Modelldatei>` gegenprüfbar). Je Release: `release/checksums-<version>.txt`.                                                                                                               |

## 5. Ehrliche Restdimensionen (kein Overclaiming)

- **Zwischenablage, Zeitfenster rund 1 Sekunde:** Beim automatischen
  Einfügen liegt das Transkript kurz in der systemweiten Zwischenablage
  und wird standardmäßig nach etwa einer Sekunde durch den vorherigen
  Inhalt ersetzt. Ein installierter Clipboard-Manager des Betreibers
  kann es in diesem Fenster mitlesen und historisieren (Details:
  `docs/ENTSCHEIDUNGEN.md`, E2/E3). Prüfen Sie Ihre
  Clipboard-Werkzeuge, wenn Sie hochsensible Inhalte diktieren.
- **Swap und Kernel-Speicherabbilder (Fußnote zu N3):** "RAM-only"
  bedeutet: die Anwendung schreibt Audio nie selbst auf die Platte. Das
  Betriebssystem kann Arbeitsspeicher jedoch grundsätzlich auslagern
  (Swap) oder bei Systemabstürzen Speicherabbilder erzeugen; das liegt
  außerhalb der Kontrolle jeder Anwendung. Aktivierte
  Festplattenverschlüsselung (FileVault/BitLocker) entschärft genau
  dieses Restrisiko. Das Absturzbericht-System der App selbst ist hart
  deaktiviert.
- **Klartext-Diktate und Backups:** Ihre Diktate liegen bewusst als
  lesbare Markdown-Dateien im Firmenordner (Portabilität, Beweisbarkeit).
  Kopien auf unverschlüsselte Medien sind damit unverschlüsselte
  Klartext-Backups, bei sensiblen Inhalten bis hin zu Art.-9-Daten ein
  reales Risiko. Verwenden Sie verschlüsselte Backup-Medien
  (FileVault/BitLocker To Go) oder den verschlüsselten Einzel-Export
  (.vwenc, AES-256-GCM) der App. Vollständige Anleitung:
  `docs/BACKUP-HINWEISE.md` (inhaltsgleich in der App, Bereich "Beleg").
- **Ihre Eigenverantwortung als Betreiber:** Rechtsgrundlagen für die
  Inhalte Ihrer Diktate, Löschkonzepte, Zugriffskontrolle am Rechner,
  Betroffenenrechte gegenüber Ihren eigenen Betroffenen und die
  Sicherheit des Rechners selbst (Updates, Malware-Schutz,
  Benutzerkonten) bleiben Ihre Aufgaben. VoiceWall reduziert die
  Angriffs- und Übermittlungsfläche strukturell, ersetzt aber kein
  Datenschutz-Management.

## 6. Einordnung in einem Satz

VoiceWall verlagert die Diktat-Verarbeitung vollständig auf Ihren
eigenen Rechner und macht damit Auftragsverarbeitung, Cloud-Empfänger
und Drittlandtransfer gegenstandslos; dieses Blatt und die sechs
Nachweise N1 bis N6 sind der reproduzierbare Beleg, und die
verbleibenden Pflichten aus Abschnitt 5 benennen wir, statt sie zu
verschweigen.
