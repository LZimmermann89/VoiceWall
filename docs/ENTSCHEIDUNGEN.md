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
