# Abnahme-Checkliste M3: Systemweites Diktat (manuelle Prüfschritte)

Der echte Auto-Paste in eine Fremd-App lässt sich nicht automatisiert testen
(Playwright kann weder globale Hotkeys senden noch fremde Apps fokussieren,
und die CI darf keine echten OS-Eingaben simulieren). Diese Checkliste wird
beim finalen Test mit Lars auf beiden Zielplattformen durchgespielt und mit
Datum/Ergebnis je Zeile abgehakt.

Vorbereitung (beide Plattformen):

- [ ] App gebaut und gestartet (`npm run build`, dann Start der gebauten App),
      Modelle vorhanden, Einwilligung erteilt, Engine bereit (Status-UI).
- [ ] Notizen bereitlegen: verwendete OS-Version, App-Version/Commit.

## A. macOS

### A1. Bedienungshilfen-Pfad (Erststart, Freigabe fehlt)

- [ ] Sicherstellen, dass VoiceWall in Systemeinstellungen, Datenschutz und
      Sicherheit, Bedienungshilfen NICHT freigegeben ist.
- [ ] TextEdit oeffnen, Cursor in ein Dokument setzen.
- [ ] Hotkey (Standard `Cmd+Shift+D`) druecken, Satz diktieren, Hotkey erneut
      druecken.
- [ ] Erwartet: KEIN osascript-Prompt, kein stiller Fehlschlag. Overlay/UI
      zeigen die deutsche Meldung "keine Bedienungshilfen-Freigabe", der Text
      liegt in der Zwischenablage und laesst sich mit Cmd+V manuell einfuegen.
- [ ] Knopf "Systemeinstellungen oeffnen" fuehrt direkt in den
      Bedienungshilfen-Bereich.
- [ ] Freigabe fuer VoiceWall erteilen.

### A2. Auto-Paste in Fremd-Apps (Freigabe erteilt)

Je Ziel-App: Cursor in ein Textfeld setzen, Hotkey, einen Satz diktieren
("Der Vertrag wurde am dritten Juli geprueft."), Hotkey.

- [ ] Word (oder Pages): Text erscheint automatisch am Cursor.
- [ ] Outlook (oder Mail): Text erscheint im Mail-Entwurf.
- [ ] Browser (Safari/Chrome, z. B. Textfeld in einem Web-Formular): Text
      erscheint im Feld.
- [ ] Waehrend des gesamten Vorgangs verliert die Ziel-App NIE den Fokus
      (Overlay erscheint unten mittig, ohne dass die Titelleiste der
      Ziel-App inaktiv wird).

### A3. Zwischenablage-Verhalten (R7)

- [ ] Vor dem Diktat einen Merktext kopieren (z. B. "MERKER-123").
- [ ] Diktat mit Auto-Paste durchfuehren. Erwartet: Text wird eingefuegt,
      und ca. 1 Sekunde spaeter ist wieder "MERKER-123" in der Zwischenablage
      (Cmd+V in TextEdit prueft das).
- [ ] Race-Test: Diktat durchfuehren und INNERHALB der Sekunde nach dem
      Einfuegen selbst etwas kopieren. Erwartet: der selbst kopierte Inhalt
      bleibt erhalten (wird nicht ueberschrieben).
- [ ] Schalter "Zwischenablage wiederherstellen" in der UI deaktivieren,
      Diktat wiederholen. Erwartet: das Transkript bleibt in der
      Zwischenablage liegen.
- [ ] Falls ein Clipboard-Manager installiert ist (z. B. Maccy, Paste):
      pruefen und notieren, ob das Transkript in dessen Historie auftaucht
      (erwartet: ja, fuer ca. 1 Sekunde sichtbar; dies ist die dokumentierte
      Restluecke aus docs/ENTSCHEIDUNGEN.md E2 und gehoert ins Beleg-Blatt).

### A4. Resilienz und Sonderfaelle

- [ ] Diktat ohne fokussiertes Eingabefeld (z. B. Finder im Vordergrund):
      Text geht nicht verloren, Meldung verweist auf die Zwischenablage,
      Kopieren-Knopf im Fenster und im Overlay funktionieren.
- [ ] Hauptfenster schliessen: App lebt im Tray weiter, Hotkey-Diktat in eine
      Fremd-App funktioniert weiterhin; Tray-Menue "VoiceWall oeffnen" holt
      das Fenster zurueck.
- [ ] Tray-Icon wechselt bei Aufnahme sichtbar (Ring -> roter Punkt) und
      zurueck.
- [ ] Aufnahme starten und Bildschirm sperren: nach dem Entsperren ist die
      Aufnahme sauber beendet (kein Text wurde erzeugt, kein Paste erfolgte),
      naechstes Diktat funktioniert normal.
- [ ] Hotkey-Konflikt: In der UI eine belegte Kombination setzen (z. B.
      eine von einer anderen App registrierte). Erwartet: deutsche Meldung,
      alter Hotkey bleibt aktiv. Danach gueltige Alternative setzen
      (z. B. `CommandOrControl+Alt+D`), App neu starten, Hotkey wirkt
      weiterhin (Konfig persistiert).
- [ ] App beenden: Hotkey ist systemweit wieder frei (in anderer App
      belegbar bzw. loest nichts mehr aus).
- [ ] TCC-Rebuild-Test (Erkenntnis M1/F4): App neu bauen, starten. Erwartet:
      Freigabe gilt als verloren, der Hinweis-Pfad aus A1 greift wieder.
      Ergebnis dokumentieren (Grundlage der Developer-ID-Entscheidung).

## B. Windows

### B1. Auto-Paste in Fremd-Apps

Je Ziel-App: Cursor setzen, Hotkey (`Strg+Shift+D`), Satz diktieren, Hotkey.

- [ ] Word: Text erscheint automatisch am Cursor.
- [ ] Outlook: Text erscheint im Mail-Entwurf.
- [ ] Browser (Edge/Chrome-Textfeld): Text erscheint im Feld.
- [ ] Kein PowerShell-Fenster blitzt auf (windowsHide), keine
      SmartScreen-/AV-Blockade (falls doch: dokumentieren, siehe R5).
- [ ] Fokus der Ziel-App bleibt waehrend des gesamten Vorgangs erhalten.

### B2. UIPI-Grenze (als Administrator laufende Ziel-App)

- [ ] Editor (Notepad) "als Administrator ausfuehren", Cursor setzen,
      Diktat ausfuehren.
- [ ] Erwartet: Der Text erscheint NICHT automatisch (Windows-UIPI blockiert
      simulierte Eingaben an elevierte Prozesse, ohne Systemfehler). Der
      Text ist in der Zwischenablage; Strg+V im Admin-Notepad fuegt ihn ein.
      Die Grenze ist in docs/ENTSCHEIDUNGEN.md E4 dokumentiert.

### B3. Zwischenablage und Resilienz

- [ ] Merktext-Test wie A3 (Wiederherstellung nach ca. 1 Sekunde).
- [ ] Race-Test wie A3.
- [ ] Kein-Fokus-Test wie A4 (Text bleibt verfuegbar, deutsche Meldung).
- [ ] Fenster schliessen: App lebt im System-Tray weiter, Hotkey wirkt.
- [ ] Sperrbildschirm-Test wie A4 (Win+L waehrend Aufnahme).
- [ ] App beenden: Hotkey wieder frei.

## C. Latenz-Notiz (beide Plattformen)

- [ ] Gefuehlte Verzoegerung zwischen Hotkey-Stopp und eingefuegtem Text fuer
      einen kurzen Satz notieren (Erwartung macOS M-Serie: ca. 1 bis 2 s;
      Windows-CPU: laenger, siehe ABARBEITUNG 2.3). Kein Abnahmekriterium,
      aber Ehrlichkeits-Basis fuer das Kundengespraech.
