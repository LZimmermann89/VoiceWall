# Datenschutzerklärung für die Software VoiceWall

Diese Erklärung ist kurz, weil sie beweisbar wahr ist: VoiceWall
verarbeitet alle Daten ausschließlich lokal auf Ihrem Rechner. Der
Anbieter erhält keinerlei Daten.

**Es werden keine Sprach- oder Textdaten übermittelt, weil kein Server
existiert, der sie empfangen könnte.**

## 1. Verantwortlicher

FERNAU Präzisionstechnik GmbH
Merianstraße 5a, 64291 Darmstadt, Deutschland
Telefon: +49 6150 184973-0
E-Mail: info@der-ki-auditor.de

Vollständige Anbieterangaben: siehe `rechtstexte/IMPRESSUM.md`.

Wichtig zur Rollenverteilung: Für die Inhalte, die Sie mit VoiceWall
diktieren und speichern, sind Sie beziehungsweise Ihr Unternehmen selbst
Verantwortlicher im Sinne von Art. 4 Nr. 7 DSGVO. Die FERNAU
Präzisionstechnik GmbH verarbeitet diese Inhalte zu keinem Zeitpunkt und
hat keinerlei Zugriff darauf. Einzelheiten und die Belege dazu stehen im
DSGVO-Beleg-Blatt (`rechtstexte/DSGVO-BELEG-BLATT.md`).

## 2. Was die Software tut und was nicht

- Die gesamte Verarbeitung (Audioaufnahme, Spracherkennung, Speicherung
  der Diktate) findet lokal auf Ihrem Rechner statt. Es gibt keine Cloud,
  keinen Anbieter-Server, keine Konten und keine Anmeldung.
- Die Software enthält keine Telemetrie, keine Analysefunktionen und
  keinen Absturzbericht-Versand. Fehlerprotokolle bleiben ausschließlich
  in einer lokalen Logdatei auf Ihrem Rechner und enthalten niemals
  Diktat-Inhalte.
- Die Software setzt keine Cookies und greift nicht auf Informationen in
  Ihrer Endeinrichtung im Sinne von § 25 des
  Telekommunikation-Digitale-Dienste-Datenschutz-Gesetzes (TDDDG) zu, die
  über das für den Betrieb der Software unbedingt Erforderliche
  hinausgehen. Es gibt kein Tracking und keine Reichweitenmessung; § 25
  TDDDG ist damit nicht einschlägig.

## 3. Der einzige Netzzugriff: einmaliger Modell-Download

Bei der ersten Einrichtung lädt VoiceWall einmalig die
Spracherkennungs-Modelldateien vom Dienst Hugging Face
(`huggingface.co`) herunter und prüft sie gegen fest im Quellcode
hinterlegte SHA-256-Prüfsummen. Transparenzhinweis dazu:

- Bei diesem Download erhält der Betreiber von Hugging Face, wie jeder
  Webserver, technisch bedingt Ihre IP-Adresse sowie übliche
  Verbindungsdaten (Zeitpunkt, angefragte Datei, User-Agent) und kann
  diese in Server-Protokollen speichern. Auf diese Protokolle hat die
  FERNAU Präzisionstechnik GmbH keinen Zugriff. Informationen des
  Anbieters: https://huggingface.co/privacy
- Übertragen wird dabei ausschließlich die Anfrage nach den
  Modelldateien. Es werden keine Sprach-, Text- oder Nutzungsdaten
  gesendet.
- Der Download lässt sich vollständig vermeiden: Bei der
  Vor-Ort-Installation werden die Modelle in der Regel offline vom
  Übergabemedium eingespielt. Danach
  arbeitet die App dauerhaft ohne jede Netzverbindung.

Nach der Einrichtung baut VoiceWall keine Netzwerkverbindung mehr auf.
Ein Knopf in der App kann auf ausdrücklichen Wunsch des Nutzers die
Quelle des Impressums (`https://der-ki-auditor.de/impressum`) im
Standard-Browser öffnen; das ist eine Aktion Ihres Browsers, nicht der
App, und geschieht nie automatisch.

## 4. Prüfen statt glauben: der Netzwerk-Selbsttest

Sie müssen diese Erklärung nicht glauben. `docs/NETZWERK-SELBSTTEST.md`
beschreibt drei unabhängige Proben (Netzwerk-Anzeige der App,
Verbindungsmonitor des Betriebssystems, Betrieb mit gezogenem
Netzstecker), mit denen Sie selbst nachprüfen können, dass VoiceWall im
Betrieb keine Daten sendet. Dieselben Proben sind in der App im Bereich
"Beleg" eingebettet.

## 5. Betroffenenrechte

Soweit die FERNAU Präzisionstechnik GmbH personenbezogene Daten
verarbeitet (das betrifft mangels Datenflusses aus der Software praktisch
nur die Kommunikation mit Ihnen, etwa per E-Mail oder Telefon, sowie die
Vertragsabwicklung des Vor-Ort-Dienstes), stehen Ihnen die Rechte aus
Art. 15 bis 21 DSGVO zu: Auskunft, Berichtigung, Löschung, Einschränkung
der Verarbeitung, Datenübertragbarkeit und Widerspruch. Sie haben zudem
das Recht auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde; für den
Anbieter zuständig ist der Hessische Beauftragte für Datenschutz und
Informationsfreiheit. Kontakt für alle Anliegen:
info@der-ki-auditor.de.

Für die Inhalte Ihrer eigenen Diktate richten sich Betroffenenrechte an
Sie als Verantwortlichen, nicht an den Software-Anbieter; VoiceWall
unterstützt Sie dabei durch offene, lokal löschbare Dateiformate
(Markdown im Firmenordner, kein verstecktes Datensilo).

Stand: 03.07.2026
