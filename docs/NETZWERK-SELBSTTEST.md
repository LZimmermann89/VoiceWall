> 🇬🇧 English version: [NETZWERK-SELBSTTEST.en.md](NETZWERK-SELBSTTEST.en.md)

# So prüfen Sie selbst, dass VoiceWall keine Daten sendet

VoiceWall verspricht: **Ihre Diktate verlassen Ihren Rechner nie.** Dieses
Versprechen müssen Sie nicht glauben, Sie können es in wenigen Minuten selbst
nachprüfen. Diese Anleitung beschreibt drei voneinander unabhängige Proben,
vom einfachen Blick in die eingebauten Werkzeuge bis zur härtesten Probe mit
gezogenem Netzwerkstecker.

Einzige Ausnahme, die Sie dabei sehen dürfen: der **einmalige
Modell-Download** bei der ersten Einrichtung. Dabei lädt VoiceWall zwei
Modelldateien von `huggingface.co` und prüft sie gegen fest hinterlegte
Prüfsummen. Danach ist die App vollständig offline.

## Probe 1: Netzwerk-Anzeige der App (Entwicklertools)

VoiceWall basiert auf derselben Technik wie ein Browser und bringt dessen
Netzwerk-Anzeige mit. Sie zeigt jede einzelne Verbindung, die die Oberfläche
aufbauen würde.

1. Öffnen Sie das VoiceWall-Fenster.
2. Öffnen Sie die Entwicklertools: auf dem Mac mit `Cmd+Alt+I`, unter Windows
   mit `F12` beziehungsweise `Strg+Umschalt+I`.
3. Wechseln Sie auf den Reiter **Netzwerk** (englisch: Network) und wählen
   Sie den Filter **Alle** (All).
4. Diktieren Sie nun beliebig viele Texte, per Hotkey oder Testaufnahme.

**Erwartetes Ergebnis:** In der Liste erscheint **kein einziger Eintrag zu
einer externen Adresse.** Sie sehen höchstens lokale Einträge (Dateien der
App selbst, `blob:`- oder `data:`-Quellen) oder gar nichts. Zusätzlich
verbietet die fest eingebaute Sicherheitsrichtlinie der Oberfläche
(Content-Security-Policy) jede Verbindung zu fremden Adressen, selbst wenn
Schadcode es versuchen würde.

## Probe 2: Verbindungsmonitor des Betriebssystems

Unabhängig von der App selbst können Sie das Betriebssystem fragen, welche
Programme Verbindungen aufbauen.

**Auf dem Mac:**

- Mit einem Firewall-Werkzeug wie **LuLu** (kostenlos, Open Source) oder
  **Little Snitch**: Beobachten Sie die Liste der ausgehenden Verbindungen,
  während Sie diktieren. VoiceWall taucht dort nicht auf, mit der einzigen
  Ausnahme des einmaligen `huggingface.co`-Downloads bei der Einrichtung.
- Alternativ im Terminal: `lsof -i -a -p <VoiceWall-Prozess-ID>` zeigt keine
  offenen Internet-Verbindungen.

**Unter Windows:**

- Öffnen Sie den **Ressourcenmonitor** (Startmenü, „resmon" eingeben), Reiter
  **Netzwerk**. Diktieren Sie und beobachten Sie die Liste „Prozesse mit
  Netzwerkaktivität": VoiceWall erscheint dort nicht.

**Erwartetes Ergebnis:** Keine ausgehende Verbindung von VoiceWall im
laufenden Betrieb.

## Probe 3: Die härteste Probe, der Netzstecker

Wenn ein Programm ohne Internet vollständig funktioniert, kann es Ihre Daten
nicht in eine Cloud senden. Das ist der endgültige Beleg.

1. Stellen Sie sicher, dass die einmalige Einrichtung (Modell-Download)
   abgeschlossen ist.
2. Trennen Sie die Internetverbindung vollständig: WLAN ausschalten,
   Netzwerkkabel ziehen, gegebenenfalls Flugmodus.
3. Diktieren Sie wie gewohnt: Hotkey drücken, sprechen, Hotkey drücken.

**Erwartetes Ergebnis:** VoiceWall funktioniert **vollständig und ohne jede
Einschränkung offline.** Aufnahme, Erkennung und Einfügen des Textes laufen
komplett auf Ihrem Rechner. Es gibt keine Cloud, die fehlen könnte.

## Was VoiceWall zusätzlich automatisch belegt

- Ein automatischer Test der Entwicklungs-Pipeline überwacht während eines
  kompletten Diktat-Durchlaufs alle Netzwerkanfragen der App und schlägt
  fehl, sobald auch nur eine einzige Anfrage an eine nicht-lokale Adresse
  auftritt (`tests/e2e/network-isolation.spec.ts`).
- Die App enthält keinerlei Telemetrie-, Analyse- oder
  Absturzbericht-Funktionen, die nach außen senden. Auch Fehlerberichte
  bleiben ausschließlich in einer lokalen Logdatei auf Ihrem Rechner, und
  diese Logdatei enthält niemals Diktat-Inhalte.
- Während und nach dem Diktat existiert keine Audiodatei auf der Festplatte:
  das Mikrofon-Audio lebt nur im Arbeitsspeicher und wird nach der Erkennung
  aktiv gelöscht. Sie können das per Ordnerinspektion jederzeit prüfen.

Wenn eine dieser Proben bei Ihnen ein anderes Ergebnis zeigt, melden Sie es
bitte über den in `SECURITY.md` beschriebenen Weg.
