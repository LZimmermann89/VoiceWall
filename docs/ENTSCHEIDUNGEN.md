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

## E13: YAML-Front-Matter mit eigenem Mini-Serializer/-Parser statt js-yaml (M5)

**Kontext:** Diktate sind Markdown-Dateien mit YAML-Front-Matter
(ABARBEITUNG 4.4.2). Das Metadaten-Schema ist strikt flach: nur
string, number und string[] (id, titel, erstellt, geaendert, sprache,
modell, dauer_sekunden, wortzahl, tags, quelle, ziel_app, version).

**Entscheidung:** Kein YAML-Paket (js-yaml/yaml), sondern ein eigener,
~250 Zeilen kleiner Serializer/Parser NUR für dieses flache Schema
(`src/shared/front-matter.ts`). Gründe:

1. Ein vollwertiger YAML-Parser bringt genau die Features mit, die hier
   Risiko wären: Anker/Aliase (Billion-Laughs-Bomben), Tags, Merge-Keys,
   verschachtelte Strukturen. Der eigene Parser lehnt alles davon hart ab
   (Fehler-Result), es gibt keine eval-artigen Pfade.
2. Injektionssicherheit beim Schreiben ist beweisbar: Strings werden
   JSON-quotiert (gültige YAML-1.2-Double-Quote-Skalare), Quotes,
   Backslashes, Newlines und Steuerzeichen sind escaped. Ein Titel wie
   `x"\nid: gekapert` kann strukturell keinen zweiten Schlüssel erzeugen
   (Round-trip-Tests mit bösartigen Titeln in
   `tests/unit/front-matter.test.ts`, inkl. Doppelte-Schlüssel-Abwehr).
3. Eine Dependency weniger in der Supply Chain (Auditor-Argument).

Beim Lesen toleriert der Parser Hand-Edits (Plain-Skalare, '...'-Strings,
Kommentare), bleibt aber strikt bei Struktur (flach, keine Duplikate).

## E14: Migrations-Backups liegen INNERHALB des Firmenordners unter `.voicewall/backups/` (M5)

**Kontext:** Die Migrationsroutine (Risiko R12) arbeitet backup-erst. Zur
Wahl standen: Backup neben dem Firmenordner (z. B.
`Desktop/<Firma>-backup/`) oder innerhalb des Ordners.

**Entscheidung:** Innerhalb, unter
`.voicewall/backups/vor-migration-v<von>-<timestamp>/`. Gründe: (1) Das
Backup reist bei Kopie/Umzug des Firmenordners mit (Portabilitäts-Garantie
aus 4.7 bleibt vollständig), (2) es braucht keine Schreibrechte außerhalb
des Firmenordners, (3) es liegt versteckt im Verwaltungskern und
verschmutzt nicht den Desktop des Kunden. Strukturell ist es vom
Diktate-Scan ausgenommen (rebuildManifest liest ausschließlich `Diktate/`),
und die Kopierroutine kopiert `backups/` nie mit (keine
Backup-im-Backup-Kaskade). Ablauf und Rollback: `src/main/storage/migration.ts`,
Beweis in `tests/unit/migration.test.ts` (Erfolgsfall, injizierter Fehler
mit byte-identischem Original, Idempotenz).

## E15: Desktop-Verknüpfung als Symlink (macOS) bzw. Directory-Junction (Windows), kein .lnk (M5)

**Kontext:** Die Sync-Fallen-Strategie (Risiko R8) legt Diktate in den
nicht synchronisierten Ordner `~/VoiceWall/` und zeigt auf dem Desktop nur
eine Verknüpfung. Windows-".lnk"-Dateien lassen sich ohne Shell-COM-Objekt
nur über einen PowerShell-Aufruf erzeugen.

**Entscheidung:** `fs.symlink` mit Typ `dir` (macOS/Linux) bzw. `junction`
(Windows). Directory-Junctions funktionieren unter Windows OHNE
Administrator-Rechte und ohne Developer-Mode, verhalten sich im Explorer
wie ein Ordner und brauchen keinen einzigen Kindprozess (kein PowerShell,
kein execFile, keine String-Interpolation, kleinstmögliche Angriffsfläche).
Einschränkung ehrlich dokumentiert: eine Junction zeigt kein
Verknüpfungs-Pfeil-Overlay wie eine .lnk; dafür ist sie robuster (kein
Shell-Handler) und rückstandsfrei löschbar. Die Anlage ist idempotent und
überschreibt nie bestehende Einträge (`src/main/storage/sync-detection.ts`,
Tests mit injizierten Pfaden plus echtem Symlink-Test unter POSIX).

## E16: Fast-User-Switching und Mehrbenutzer-Rechner (M5, Kritik D7)

**Kontext:** Auf Kanzlei-Rechnern können mehrere OS-Benutzerkonten
existieren, teils gleichzeitig angemeldet (Fast-User-Switching). Unklar
war, wessen Desktop, Konfiguration und TCC-Freigaben gelten.

**Festlegung (Ist-Zustand, ehrlich):**

1. **Alles ist pro OS-Nutzer getrennt.** `userData` (globale Konfig, Logs,
   Modelle) liegt im Nutzerprofil (Electron-Standard:
   `~/Library/Application Support/voicewall` bzw. `%APPDATA%`), Firmenordner
   liegen auf dem Desktop bzw. unter `~/VoiceWall/` des jeweiligen Nutzers.
   Nutzer A sieht nie Konfiguration oder Diktate von Nutzer B (zusätzlich
   POSIX 0700/0600 auf Firmenordner, `.voicewall/` und Konfigdateien).
2. **Fast-User-Switching:** meldet sich ein zweiter Nutzer an und startet
   VoiceWall, läuft eine EIGENE Instanz mit eigenem userData. Der
   Single-Instance-Lock von Electron gilt pro userData-Pfad und damit pro
   Nutzer-Session: zwei Nutzer kollidieren nicht, derselbe Nutzer doppelt
   wird weiterhin blockiert (Risiko R13). Einzige geteilte Ressource wäre
   der globale Hotkey; den registriert aber nur die Session im Vordergrund
   wirksam, und macOS/Windows stellen Hintergrund-Sessions stumm.
3. **Modelle werden pro Nutzer gespeichert** (userData/models). Das kostet
   bei mehreren Nutzern Plattenplatz (574 MB je Nutzer), vermeidet aber
   Schreibkonflikte und Rechtefragen an einem geteilten Ort. Ein geteilter
   Modell-Cache wäre eine bewusste, spätere Optimierung (M6-Installer),
   kein M5-Thema.
4. **TCC-Freigaben (macOS)** sind ohnehin pro Nutzer: Mikrofon und
   Bedienungshilfen muss jeder Nutzer einmal freigeben; der Wizard führt
   jeden Nutzer einzeln hindurch.

## E17: electron-builder nur als --dir-Packager, Signierung im Setup-Skript (M6)

**Kontext:** Für die TCC-Persistenz braucht macOS ein echtes App-Bundle mit
stabiler `CFBundleIdentifier` (M1-Spike F4). Zur Wahl standen ein eigener
Bundle-Bauplan (Electron.app kopieren, Plist patchen) oder electron-builder.

**Entscheidung:** `electron-builder` (devDependency 26.15.3, reines
JavaScript, kein Go-Binary, kein Compiler) mit ausschließlich `--dir`-Target:
kein Installer-Artefakt, kein Auto-Update, kein Publish. Konfiguration in
`electron-builder.yml`. Drei bewusste Abweichungen von den Defaults:

1. `electronDist: node_modules/electron/dist`: das Packaging verwendet das
   bereits per `npm ci` bezogene Electron-Binary und lädt beim Bauen nichts
   aus dem Netz nach (offline-fähig, On-Site-Bedingung). Für das dir-Target
   werden auch keine Zusatzwerkzeuge (NSIS, winCodeSign) geladen.
2. `mac.identity: null`: electron-builder signiert NICHT. Die
   Ad-hoc-Signierung (`codesign -s - --force --deep`) macht Schritt 5 des
   Setup-Skripts mit anschließender Verifikation der Bundle-ID; damit ist
   der TCC-relevante Signierzeitpunkt dokumentiert und liegt beim Installer,
   nicht im Build-Werkzeug.
3. `npmRebuild/nodeGypRebuild: false`: es wird nie kompiliert (prebuilt
   Whisper-Binaries, compilerfreie Kette). `asarUnpack: **/*.node` legt die
   nativen Binaries neben das asar (Loader-Anforderung).

Windows ist als dir-Target deklariert, wird aber nur auf einer
Windows-Maschine gebaut (lokal und CI bauen macOS).

## E18: App-Icon wird programmatisch erzeugt, keine Binaerdatei im Repo (M6)

`scripts/generate-icon.mjs` rendert das Icon (dunkles abgerundetes Quadrat,
Schallwellen-Glyphe in Elfenbein, mittlerer Balken Siegel-Grün) per
Signed-Distance-Funktionen mit Supersampling und kodiert die PNGs mit einem
eigenen Mini-Encoder (nur node:zlib, CRC32 von Hand). `iconutil` (macOS
Bordwerkzeug) baut daraus das .icns. Kein Download, kein Grafik-Tool, keine
Binärdatei im Repo; das Packaging (`npm run package`) erzeugt das Icon
idempotent bei Bedarf neu. Damit bleibt das Icon reproduzierbar und
auditierbar (Farbwerte identisch mit der UI-Palette in styles.css).

## E19: Ready-Signal der App ist eine Marker-Datei, kein Port (M6)

Das Setup-Skript (Schritt 7) wartet aktiv auf den App-Start. Da VoiceWall
bewusst keinen Netzwerk-Port öffnet (IPC statt HTTP, ABARBEITUNG 3.2),
schreibt der Main-Prozess nach `app.whenReady` eine Marker-Datei
`userData/app-ready.json` (PID, Version, Startzeit, Modus 0600). Das Skript
pollt auf diese Datei (Fallback: Prozess-Existenz) statt blind zu schlafen.
Ein Health-HTTP-Endpunkt wäre eine neue Angriffsfläche für genau das
Feature, dessen Abwesenheit das Produkt verkauft.

## E20: Wizard schreibt vor "Einrichten" keine Konfiguration; einzige Ausnahme ist der explizite Modell-Download (M6)

ABARBEITUNG 4.2 verlangt: kein Schritt schreibt vor der Bestätigung ins
Dateisystem. Umsetzung: Einwilligung, Hotkey, Modellwahl und Firmendaten
werden im Wizard nur im React-Zustand gehalten und erst bei "Einrichten"
über die bestehenden IPCs persistiert (grantConsent, setModelChoice,
setHotkey, createCompany; letzteres ist die atomare M5-Anlage). Der
Hotkey-Livetest registriert die Kombination nur fluechtig und gibt sie
sofort wieder frei (eigener IPC `wizard:test-hotkey`, persistiert nichts).
Zwei dokumentierte Ausnahmen: (1) der EXPLIZITE Modell-Download legt die
Modelldateien (geteilte Infrastruktur im App-Support-Ordner, keine
Nutzer-/Firmendaten) ab, inklusive der Modellwahl in der globalen Konfig,
weil ein 574-MB-Download ohne Dateisystem-Schreiben nicht existiert; (2)
die informierte Einwilligung wird beim Einrichten mit Zeitstempel
dokumentiert (auditfester Nachweis, gewollt).

## E21: fp16-Modellwahl ist verdrahtet, Q4-Notnagel ist bewusst v1.1 (M6)

Der Wizard bietet nach der 2.2-Tabelle Q5_0 (Standard, immer) und fp16
("Maximale Genauigkeit", nur bei >= 16 GB RAM und >= 6 Kernen wählbar; die
Kernzahl kommt aus os.cpus(), auf Apple Silicon physisch, auf Intel mit
Hyper-Threading eine großzügige Näherung, dokumentiert). Die Wahl steht in
der globalen Konfig (`modell`), Engine und Downloader folgen ihr
(orchestrator). Die fp16-SHA-256 stammt aus dem Hugging-Face-LFS-OID
(der OID IST der Inhalts-SHA-256); der unabhängige Selbst-Hash-Quercheck
(R14) steht für die 1,6-GB-Datei noch aus, schlimmster Fall ist ein
abgelehnter Download. Eine Q4-Notvariante existiert im DE-Repo (cstr)
nicht; sie käme aus den ggerganov-Fallbacks und braucht eigene Hashes und
Schwachhardware-Tests, deshalb bewusst v1.1 (im Wizard als Hinweis genannt).

## E22: Barrierefreiheit der M6-UI (BFSG-Grundlagen, Kritik D4)

**Erfüllt in v1 (Wizard und Übergangs-Hauptansicht):**

- Vollständige Tastatur-Bedienbarkeit: alle Controls sind fokussierbar und
  in logischer Tab-Reihenfolge; der E2E-Test belegt, dass die Controls des
  Firmendaten-Schritts per Tab erreichbar sind.
- Sichtbarer Fokus: 2px-Siegel-Grün-Ring mit 2px Versatz auf allen
  interaktiven Elementen (styles.css, `:focus-visible`).
- Genau eine H1 je Ansicht (App-Shell-Wortmarke); Schritt-Überschriften
  sind H2 und erhalten beim Schrittwechsel programmatisch den Fokus
  (Screenreader-Ansage des neuen Schritts).
- `aria-live="polite"` für Download-Fortschritt und Hotkey-Testergebnis;
  Fehlermeldungen mit `role="alert"` und `aria-describedby` am Feld;
  Labels an allen Formularfeldern; Radiogruppen mit `role="radiogroup"`
  und `aria-label`.
- Kontraste rechnerisch AA: Tinte auf Papier 14,9:1, Sekundärtext 6,3:1,
  Siegel-Grün 6,8:1, Fehlerrot 6,5:1, Warnton 6,1:1 (Nachweis als
  Kommentar in src/renderer/styles.css).
- Kein Informationsverlust durch Farbe allein (Status immer auch als Text).

**Bewusst v1.1 (offen, ehrlich):** Screenreader-Praxistest mit VoiceOver/
NVDA (bisher nur strukturelle ARIA-Korrektheit), `prefers-reduced-motion`
(v1 hat fast keine Animationen), Zoom-Test 200 %, vollständige
BFSG-Konformitätserklärung (M9-Rechtstexte), Overlay-Fenster-Semantik.
