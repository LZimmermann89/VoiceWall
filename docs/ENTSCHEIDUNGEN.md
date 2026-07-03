# Architektur- und Produktentscheidungen

Fortlaufendes Entscheidungsprotokoll. Jede Entscheidung nennt Kontext, Beleg
und Konsequenz, damit sie später nachvollziehbar (und revidierbar) ist.

## E1: Push-to-talk wird für v1 gestrichen (M3, Risiko R15)

**Kontext:** Neben dem Toggle-Diktat (Hotkey startet, Hotkey stoppt) war
Push-to-talk (Taste halten = aufnehmen, loslassen = transkribieren) als
Alternative angedacht.

**Entscheidung:** Push-to-talk wird NICHT gebaut. Es ist mit Electrons
`globalShortcut` technisch unmöglich, nicht nur unzuverlässig:
`globalShortcut.register()` liefert ausschließlich ein Auslöse-Event pro
Tastendruck. Es gibt kein Key-Down- und vor allem kein Key-Up-Event, und ohne
Key-Up lässt sich "Taste losgelassen = Aufnahme stoppen" prinzipiell nicht
erkennen.

**Was nötig wäre:** Ein nativer, systemweiter Key-Listener (z. B. ein
Native-Addon mit CGEventTap auf macOS bzw. Low-Level-Keyboard-Hook auf
Windows, oder ein Subprozess-Werkzeug wie `node-global-key-listener`). Das
bedeutet: zusätzliche native Angriffs- und Wartungsfläche, auf macOS
zusätzliche TCC-Rechte (Input Monitoring, ein Recht, das nach Keylogger
aussieht und für einen Datenschutz-Auditor schwer erklärbar ist), ABI-Pflege
und Prebuilt-Beschaffung. Diese Kosten stehen für v1 in keinem Verhältnis zum
Nutzen; der Toggle ist robust und lässt die Hände frei.

**Konsequenz:** Toggle ist der einzige Modus in v1. Falls PTT je gewünscht
wird, ist es ein eigenes, bewusst zu kalkulierendes Vorhaben (siehe
Risikoregister R15 in ABARBEITUNG.md).

## E2: ConcealedType-Marker ist mit Electron 43 nicht setzbar, die wirksame R7-Maßnahme ist die sofortige Wiederherstellung (M3)

**Kontext:** Das Transkript passiert auf dem Weg in die Fremd-App die
systemweite Zwischenablage und könnte dort von Clipboard-Manager-Tools
mitgelesen und persistiert werden (Risiko R7). Geplant war, auf macOS den
`org.nspasteboard.ConcealedType`-Marker zu setzen (die Konvention, mit der
z. B. Passwortmanager Clipboard-Manager bitten, den Eintrag nicht zu
historisieren), zusätzlich zum Text.

**Empirischer Befund (Electron 43.0.0, macOS, 2026-07-03, eigener Probe-Lauf):**
Jeder `clipboard.write*`-Aufruf in Electron löscht das Pasteboard vollständig,
bevor er schreibt. Konkret gemessen:

| Versuch                                                                         | Ergebnis                                                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `writeText('...')`, danach `writeBuffer('org.nspasteboard.ConcealedType', ...)` | Marker vorhanden, aber Text weg (`readText()` leer, `availableFormats()` leer) |
| `writeBuffer(...)`, danach `writeText('...')`                                   | Text vorhanden, Marker weg (`has(...)` false)                                  |
| `clipboard.write({ text: '...', 'org.nspasteboard.ConcealedType': '1' })`       | Custom-Key wird ignoriert, nur Text gesetzt                                    |

Text UND ConcealedType-Marker gleichzeitig sind mit der dokumentierten
Electron-Clipboard-API also NICHT setzbar. Möglich wäre das nur über ein
natives Addon (direkter NSPasteboard-Zugriff), was gegen die
Compilerfrei-/Minimal-Native-Strategie des Projekts verstößt.

**Entscheidung:** Kein ConcealedType in v1, kein natives Addon dafür. Die
wirksame Datenschutzmaßnahme gegen R7 ist die implementierte
Clipboard-Sequenz: Transkript rein, sofort pasten, nach kurzer Verzögerung
(Standard 1 Sekunde, konfigurierbar) den vorherigen Inhalt wiederherstellen.
Das Transkript verlässt die Zwischenablage damit nach rund einer Sekunde
wieder; das Zeitfenster für mitlesende Tools ist minimal, aber ehrlich
vorhanden und wird im Beleg-Blatt (M9) transparent gemacht. Sollte eine
spätere Electron-Version kombinierte Custom-Type-Writes erlauben, wird der
Marker nachgerüstet (die Sequenz ist dafür vorbereitet, der Schreibpunkt ist
eine einzige Stelle in `src/main/clipboard/transcript-clipboard.ts`).

## E3: Verhalten der Zwischenablage-Wiederherstellung (M3)

**Entscheidung im Detail:**

1. **Wiederherstellung ist Standard (an):** Nach erfolgreichem Auto-Paste
   wird der vorherige Inhalt (nur Text-Repräsentation, im RAM gehalten) nach
   der Verzögerung zurückgeschrieben. Das erfüllt gleichzeitig
   Zwischenablage-Höflichkeit (ABARBEITUNG 2.5) und R7 (Transkript verlässt
   die Zwischenablage sofort wieder). Grenze: Nicht-Text-Inhalte (Bilder,
   Dateien) werden nicht gesichert; sie gehen bei der Wiederherstellung
   verloren. Das ist dokumentiert und für ein Diktierwerkzeug akzeptiert.
2. **Race-Schutz:** Kopiert der Nutzer während der Verzögerung selbst etwas,
   wird nichts überschrieben. Vor der Wiederherstellung wird geprüft, ob die
   Zwischenablage noch exakt das Transkript hält; sonst bleibt der
   Nutzer-Inhalt unangetastet (Unit-Test belegt das).
3. **Wiederherstellung abgeschaltet:** Dann bleibt das Transkript bewusst in
   der Zwischenablage liegen (es wird NICHT geleert). Begründung: Wer den
   Schalter deaktiviert, wählt explizit das klassische Diktier-Verhalten
   "Text bleibt zum Mehrfach-Einfügen verfügbar" und opt-out-t die
   R7-Maßnahme. Ein Leeren wäre weder höflich (es zerstörte den erwarteten
   Zustand) noch datenschutzfreundlicher als das Wiederherstellen und würde
   den Resilienz-Primärpfad (Text bleibt verfügbar) schwächen. Der Schalter
   ist in der UI als Datenschutz-Empfehlung beschriftet.
4. **Paste fand nicht statt oder schlug fehl** (fehlende
   Bedienungshilfen-Freigabe, UIPI, osascript-Fehler): Es wird NICHT
   wiederhergestellt. Das Transkript bleibt in der Zwischenablage, denn es
   ist dann der einzige Zustellweg ("Text ist in der Zwischenablage, bitte
   manuell einfügen"). Der Text geht nie verloren; zusätzlich hält die App
   das letzte Transkript im RAM und bietet es über den Kopieren-Knopf (UI und
   Overlay) erneut an.

## E4: Windows-UIPI-Grenze des Auto-Paste (M3, Risiko R6)

SendKeys (`[System.Windows.Forms.SendKeys]::SendWait('^v')`) läuft in
VoiceWall aus einem nicht-elevierten Prozess. Windows UIPI (User Interface
Privilege Isolation) blockiert simulierte Eingaben an Prozesse mit höherer
Integritätsstufe: Läuft die Ziel-App als Administrator (z. B. ein als Admin
gestartetes Word oder eine Verwaltungs-Konsole), kommt das Strg+V dort NIE an,
ohne Fehlermeldung des Systems. Das ist eine harte OS-Grenze, kein Bug.

**Konsequenz:** Der Kopieren-Knopf plus Zwischenablage ist der dokumentierte
und in der Fehlermeldung genannte Ausweg. VoiceWall selbst wird bewusst nicht
eleviert (ein als Admin laufendes Diktierwerkzeug wäre das falsche Signal an
einen Auditor-Kunden). Aufgenommen in die Abnahme-Checkliste.

## E5: Linux-Auto-Paste wird in v1 nicht unterstützt (M3)

Der Paste-Adapter-Dispatch liefert auf Linux ein sauberes deutsches
Fehler-Result ("nicht unterstützt, Text liegt in der Zwischenablage"). Gründe:
kein Zielkunde auf Linux in v1, und der Weg wäre fragmentiert (X11 `xdotool`
vs. Wayland `wtype`, jeweils als externe Abhängigkeit auf dem Zielsystem).
Das Interface `PasteAdapter` ist so geschnitten, dass ein Linux-Adapter später
ohne Änderung am Flow andocken kann.

## E6: Kein nut-js in M3 (Fallback-Schnittstelle vorbereitet)

`@nut-tree-fork/nut-js` bleibt der benannte optionale Fallback, falls der
OS-Scripting-Weg auf einer konkreten Zielmaschine scheitert. Er wird NICHT
vorsorglich eingebaut: jede native Dependency ist Angriffs- und
Wartungsfläche, und der OS-Weg ist auf den Zielplattformen der belegte
Primärpfad. Andockpunkt: `createPasteAdapter()` in `src/main/paste/index.ts`
(ein Fallback-Adapter implementiert dasselbe `PasteAdapter`-Interface; die
Auswahl-Logik läge im Dispatch, der Flow bliebe unverändert).

## E7: App-Lebenszyklus seit M3 (window-all-closed)

Vor dem Onboarding (Mikrofon-Einwilligung noch nicht erteilt) beendet das
Schließen des letzten Fensters die App (M0-Verhalten): ohne Einwilligung gibt
es kein Hintergrund-Diktat und damit keinen Grund weiterzulaufen. Nach dem
Onboarding bleibt die App ohne Fenster am Leben (Tray-Icon plus globaler
Hotkey tragen das systemweite Diktat); Beenden erfolgt über das Tray-Menü
oder Cmd/Strg+Q. Sperrbildschirm und Suspend (powerMonitor `lock-screen`,
`suspend`) brechen eine laufende Aufnahme sauber ab und verwerfen das Audio:
in einen gesperrten Bildschirm wird weder transkribiert noch gepastet.

## E8: Zustellung einmal pro Diktat, nicht pro VAD-Segment (M3)

Während einer Hotkey-Sitzung transkribiert die Engine VAD-segmentweise
weiter (Latenzvorteil bleibt), aber die Zustellung (Clipboard plus ein
einziges Cmd/Strg+V) passiert genau einmal beim Stopp mit dem
zusammengefügten, getrimmten Gesamttext. Segmentweises Pasten während des
Sprechens wäre fehleranfällig (Fokuswechsel des Nutzers mitten im Diktat,
mehrfache Paste-Simulationen, zerrissene Sätze) und würde das
Wiederherstellungs-Fenster der Zwischenablage vervielfachen.

## E9: sanitize-filename wird selbst implementiert, nicht als npm-Paket bezogen (M4)

**Kontext:** ABARBEITUNG 3.4 verlangt einen sanitize-filename-Schritt
(reservierte Zeichen `<>:"/\|?*`, trailing Dots/Spaces). Zur Wahl standen das
npm-Paket `sanitize-filename` oder eine eigene, geprüfte Funktion.

**Prüfung des Pakets:** Funktional identisch zu wenigen Regex-Schritten,
bringt aber zwei transitive Dependencies mit (`truncate-utf8-bytes` →
`utf8-byte-length`), liefert keine eigenen TypeScript-Typen (separates
`@types`-Paket nötig) und hat seit 2020 kein Release gesehen.

**Entscheidung:** Eigene Implementierung in `src/main/storage/sanitize.ts`.
Sie ist ohnehin nur ein Schritt der verbindlichen 7-Stufen-Pipeline
(NFC → Segment-Reduktion → Zeichenfilter → Windows-Reserved → Länge →
Leer-Fehler → Containment nach `path.resolve`) und mit 50 Unit-Tests über
alle Angriffsklassen abgedeckt. Null neue Dependencies, kleinere
Supply-Chain-Fläche.

## E10: Windows-Desktop-Auflösung per `reg.exe query`, nicht per PowerShell (M4)

**Kontext:** Der Windows-Desktop kann umgeleitet sein (OneDrive Known Folder
Move, GPO). `%USERPROFILE%\Desktop` wäre dann falsch.

**Entscheidung:** `src/main/storage/paths.ts` liest den Known-Folder-Pfad aus
`HKCU\...\Explorer\User Shell Folders` per `execFile('reg.exe', [...])` mit
statischem Argument-Array. Gründe gegen den PowerShell-Einzeiler
(`[Environment]::GetFolderPath('Desktop')`): PowerShell-Kaltstart kostet 1
bis 2 Sekunden, berührt die ExecutionPolicy und ist ein größerer
Interpreter; `reg.exe` ist auf jedem unterstützten Windows vorhanden und
startet in Millisekunden. `%USERPROFILE%\Desktop` bleibt Fallback mit
Existenz-Check; existiert kein Desktop, liefert die Funktion ein
Fehler-Result, damit der Wizard nachfragt (nie ein stiller falscher Pfad).

## E11: Modell-Manifest, Single Source of Truth ist der TypeScript-Katalog (M4)

**Kontext:** ABARBEITUNG 3.8 verlangt ein auditierbares Artefakt mit
Modell-URLs und SHA-256. Zur Wahl standen: der Katalog liest das Manifest
(JSON als Quelle) oder das Manifest spiegelt den Katalog.

**Entscheidung:** `src/main/model/model-catalog.ts` bleibt die einzige
Quelle: er ist typgeprüft (Compilezeit-Fehler statt Laufzeit-Parsing im
App-Start) und wird von Downloader und Store direkt importiert.
`resources/model-manifest.json` ist das mitgelieferte, maschinenlesbare
Audit-Artefakt (inkl. Lizenz und Quelle je Modell für die Attribution). Der
Unit-Test `tests/unit/model-manifest.test.ts` erzwingt exakte Synchronität;
Drift bricht die CI.

## E12: Native Whisper-Logs, Allowlist plus RAM-only-Puffer (M4-Pflicht-Befund)

**Kontext:** Der Whisper-utilityProcess leitet native
whisper.cpp-/ggml-Zeilen weiter; bis M3 wanderten sie ungefiltert per
`logger.debug` in die persistente Logdatei. whisper.cpp kann in Randfällen
Segment-/Token-TEXT in Logzeilen ausgeben; die Messlatte aus ABARBEITUNG 3.6
ist aber: auch debug protokolliert NIEMALS Transkriptinhalte.

**Entscheidung (kombinierter Ansatz, `src/main/whisper/native-log.ts`):**

1. Persistiert wird eine native Zeile nur bei Treffer auf einer engen
   Allowlist bekannt unkritischer Präfixe (`whisper_`, `ggml_`,
   `system_info`, Timing-/VAD-Zeilen). Zusätzliche Negativsperre: Zeilen mit
   Segment-Timestamp-Syntax (`-->`, `[hh:mm`) werden nie persistiert, selbst
   mit passendem Präfix.
2. Alle übrigen Zeilen bleiben in einem begrenzten RAM-Ringpuffer (200
   Zeilen) für die Vor-Ort-Fehlersuche und verlassen den RAM nie; bei einem
   Engine-Absturz wird nur ihre Anzahl geloggt.
   Der Beweis steht in `tests/unit/native-log.test.ts`: eine präparierte Zeile
   mit Diktattext erreicht die Logdatei nicht, eine Modell-Load-Zeile schon.
   Damit bleibt die Diagnosefähigkeit (Modell-Load, Backend, Timings) erhalten,
   ohne die Datenschutz-Garantie zu verletzen.
