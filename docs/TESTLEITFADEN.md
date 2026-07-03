# Testleitfaden für externe Tester

Stand: 03.07.2026, Version 1.0.0-rc.1. Zielgruppe: technisch versierte
Tester (Entwickler), die VoiceWall auf macOS oder Windows unabhängig
prüfen. Danke fürs Testen: bitte ehrlich und gnadenlos, genau das
brauchen wir.

## Was VoiceWall ist (30 Sekunden)

Ein zu 100 Prozent lokales Sprachdiktiergerät: globaler Hotkey drücken,
sprechen, Hotkey drücken, der Text erscheint per automatischem Einfügen
in der gerade fokussierten Anwendung. Whisper (deutsch optimiert) läuft
komplett auf dem Rechner, es gibt keinen Server, keine Cloud, keine
Telemetrie. Das Kernversprechen ist beweisbar, nicht behauptet: siehe
`docs/NETZWERK-SELBSTTEST.md` und die Beleg-Ansicht in der App.

## Ehrlicher Status vorab

- **macOS (Apple Silicon):** Kernpfad vollständig abgenommen
  (Einrichtung, Aufnahme, Transkription, Auto-Paste) am 03.07.2026 auf
  der Referenzmaschine.
- **Windows:** Der Code ist auf der CI (windows-latest) grün (alle
  Unit- und E2E-Tests, Paste in der CI gemockt), aber der komplette
  Ablauf auf ECHTER Windows-Hardware wurde noch nie ausgeführt. Du
  wärst der Erste. Die offenen Windows-Punkte stehen in
  `docs/ABNAHME-CHECKLISTE.md`, Abschnitte B und D2 bis D4, das ist
  faktisch dein Testprotokoll.
- Es gibt bewusst keine gekauften Code-Signing-Zertifikate
  (Inhaber-Entscheidung, `docs/SIGNING-ENTSCHEIDUNG.md`): Rechne unter
  Windows mit einer SmartScreen-/Defender-Rückfrage, unter macOS mit
  den üblichen TCC-Freigaben.

## Voraussetzungen

- Node.js 26 (`node --version`), npm 11. Kein Compiler, kein Xcode,
  keine Build-Tools nötig: alle nativen Bausteine kommen prebuilt.
- Rund 3 GB freier Plattenplatz, einmalig Internet für den
  Modell-Download (574 MB von huggingface.co, SHA-256-verifiziert; das
  ist der einzige Netzwerkzugriff, den du je sehen wirst).
- Ein Mikrofon.

## Installation

Grundsatz review-then-run: erst Quellcode ansehen, dann ausführen.

**Weg A, das Install-Skript (der Produktweg):**

1. Repo klonen, kurz reinschauen (`install/`, `scripts/`,
   `package-lock.json`).
2. macOS: `install/voicewall-setup.command` doppelklicken (oder
   `bash install/voicewall-setup.sh`). Windows:
   `install\voicewall-setup.cmd` doppelklicken.
3. Das Skript arbeitet acht idempotente Schritte ab und startet die
   App; Log unter `~/.voicewall/logs/`. Zweiter Lauf muss in Sekunden
   durchlaufen (Idempotenz, bitte mittesten).

**Weg B, der Entwicklerweg:**

```bash
npm ci
npm run package          # baut dist/<plattform>/VoiceWall
# macOS zusaetzlich: codesign -s - --force --deep dist/mac-arm64/VoiceWall.app
```

Danach die gebaute App starten. `npm run dev` funktioniert auch, aber
die OS-Berechtigungen (Mikrofon, Bedienungshilfen) hängen dann am
Electron-Binary statt an VoiceWall, für Berechtigungs-Tests immer die
gepackte App verwenden.

## Der Kern-Testpfad (beide Plattformen)

1. First-Run-Wizard komplett durchgehen (Einwilligung, Firmendaten mit
   Umlauten im Namen, Speicherort, Modell Q5_0, Hotkey).
2. Modell-Download abwarten (einmalig; Fortschrittsanzeige).
3. macOS: Bedienungshilfen über den Knopf "Freigabe anfordern
   (macOS-Dialog)" erteilen, danach in der App "VoiceWall neu starten"
   drücken (macOS meldet frische Freigaben erst nach Neustart, das ist
   dokumentiertes OS-Verhalten).
4. Cursor in ein Textfeld einer Fremd-App (Word, Mail, Browser,
   Editor), Hotkey (`Cmd/Strg+Shift+D`), einen deutschen Satz mit
   Umlauten sprechen, Hotkey. Erwartung: Text erscheint an der
   Cursor-Position, korrekt mit Umlauten, nach etwa 1 bis 3 Sekunden.
5. Verwaltung testen: Register (Suche, Filter, Volltext), Detail,
   Bearbeiten, Tags, Export (MD/TXT/PDF, verschlüsselt als .vwenc),
   Papierkorb, zweite Firma anlegen und Trennung prüfen.
6. Den Netzwerk-Selbsttest machen (`docs/NETZWERK-SELBSTTEST.md`):
   Verbindungsmonitor des OS beobachten, danach die härteste Probe:
   Netzwerk trennen und weiterdiktieren.

## Windows-spezifisch bitte genau protokollieren

Das sind die offenen Abnahmepunkte (Details in
`docs/ABNAHME-CHECKLISTE.md` D2 bis D4 und B1 bis B3):

- Läuft `voicewall-setup.cmd` komplett durch? Wo hakt es? (Log
  beilegen: `%USERPROFILE%\.voicewall\logs\`)
- SmartScreen-/Defender-Verhalten beim ersten Start (Screenshot).
- Funktioniert das automatische Einfügen (SendKeys) in Word, Outlook,
  Browser? Bekannte Grenze: in als Administrator laufende Programme
  kann systembedingt nicht eingefügt werden (UIPI), dann greift der
  Kopieren-Knopf.
- Latenz: fühlt es sich wie ein Diktiergerät an? CPU-Modell und
  RAM-Ausstattung bitte mit angeben (wir suchen ausdrücklich auch
  Ergebnisse von schwächerer Hardware).
- OneDrive: liegt dein Desktop in OneDrive? Dann muss der Wizard beim
  Speicherort warnen, bitte prüfen.

## Was du melden solltest (formlos, gern als GitHub-Issue)

OS-Version und Hardware, App-Version/Commit, was du getan hast, was du
erwartet hast, was passiert ist, Log-Auszug
(`~/.voicewall/logs/` bzw. App-Support-Ordner `voicewall/logs/`,
die Logs enthalten by design keine Diktat-Inhalte) und bei UI-Themen
ein Screenshot. Sicherheitsfunde bitte über den Weg in `SECURITY.md`.

## Bekannte Grenzen (kein Bug-Report nötig)

- Nach jedem Neubau der App verlangt macOS die Freigaben erneut
  (Ad-hoc-Signierung, bewusste Entscheidung, siehe
  `docs/SIGNING-ENTSCHEIDUNG.md`); der Knopf "Freigabe anfordern"
  plus App-Neustart ist der vorgesehene Weg.
- Push-to-talk gibt es nicht (nur Toggle), Begründung in
  `docs/ENTSCHEIDUNGEN.md` E1.
- Das Transkript liegt für rund eine Sekunde in der Zwischenablage
  (danach wird der vorherige Inhalt wiederhergestellt); Clipboard-
  Manager können es in diesem Fenster sehen, dokumentierte Restgrenze.
- Die Zwischenablage-Wiederherstellung rettet nur Text-Inhalte,
  Bilder in der Zwischenablage gehen beim Diktat verloren.
