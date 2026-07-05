# Changelog

Alle nennenswerten Änderungen an VoiceWall werden in dieser Datei
dokumentiert. Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung folgt [SemVer](https://semver.org/lang/de/).

## [Unreleased]

### Added

- Deinstallation per Doppelklick (Entscheidung E49):
  `install/uninstall.command` (macOS) und `install\uninstall.cmd`
  (Windows, prozess-scoped ExecutionPolicy Bypass), analog zu den
  Setup-Wrappern. Firmendaten bleiben wie immer erhalten.

- Drift-Gate für die Install-Checksummen (Entscheidung E49): der neue
  Unit-Test tests/unit/install-checksums.test.ts erzwingt, dass
  `install/lib/checksums.json` exakt die Modelle aus
  `resources/model-manifest.json` mit identischen SHA-256-Werten
  listet (beidseitig, keine verwaisten Einträge).

- Modelle-Reiter in der Verwaltung (Entscheidung E46): alle vier
  Katalog-Modelle (Deutsch Q5_0, Deutsch fp16, Englisch/mehrsprachig,
  Silero-VAD) mit Zweck, Größe, Status (vorhanden und verifiziert /
  fehlt) und gekürzter SHA-256 (voller Wert im title-Attribut).
  Fehlende Modelle lassen sich einzeln nachladen (seriell, bestehender
  Fortschritts-Mechanismus, Verifikation gegen die fest hinterlegte
  Prüfsumme); vorhandene, nicht benötigte Modelle lassen sich nach
  Bestätigungsdialog löschen (Warnung: wird bei Bedarf erneut geladen).
  Das Modell der aktiven Firmensprache und das VAD-Modell sind mit
  erklärender Meldung gesperrt. Neue, zod-validierte IPC-Kanäle
  `model:details`, `model:download`, `model:delete`; E2E in
  tests/e2e/modelle.spec.ts.

- Toast-System für sofort sichtbare Meldungen (Entscheidung E44):
  Fehler (aria-live assertive, 8 s) und wichtige Erfolge (polite, 4 s)
  erscheinen als Papier-Karte unten rechts, unabhängig von Ansicht und
  Scroll-Position; manuell per Tastatur schließbar, maximal 3
  gestapelt, zweisprachig. Verdrahtet für den zentralen Fehlerkanal
  (Diktat-Flow, Engine, Modell-Download, Mikrofon), die
  DiktatView-Aktionen, Wörterbuch speichern, Export (Einzel, Stapel,
  verschlüsselt), Firmen-/Sprachwechsel und den Modelle-Reiter. Die
  Inline-Anzeigen bleiben als Detail-Ort erhalten. E2E in
  tests/e2e/toast.spec.ts.

- Sprachkommando-Aliasse (Entscheidung E43): deutsch "Absatz" (allein)
  und "Zeilenumbruch", englisch "paragraph". Die UI-Erklärung nennt
  die vollständige Kommandoliste und erklärt ehrlich, dass Whisper ein
  gesprochenes "Punkt" manchmal selbst in ein Satzzeichen umwandelt
  (dann greift die Regel nicht und das Ergebnis stimmt trotzdem). Der
  Schalter bleibt Opt-in (E38).

- Wörterbuch-Bereich: sichtbare "Noch nicht gespeichert"-Warnung bei
  ungespeicherten Einträgen, sofort sichtbare Speicher-Bestätigung
  (Toast) und ein ehrlicher Erwartungs-Hinweis (Begriffe machen
  seltene Namen wahrscheinlicher, garantieren sie nicht; hartnäckige
  Fehlerkennungen über die Ersetzungsliste lösen, Beispiel "blaut" ->
  "Plaud"). Neuer deterministischer Prompt-Beweis: der Test-IPC-Kanal
  `dev:get-last-context` (nur Dev/Test) liest den zuletzt an den
  Whisper-Worker gesendeten Kontext; E2E in
  tests/e2e/vokabular-persistenz.spec.ts (Speichern, Ansichtswechsel,
  App-Neustart, Prompt-Inhalt). Befund: die Persistenz- und
  Prompt-Kette war technisch intakt, die Lücke war Sichtbarkeit und
  Erwartung (Entscheidung E45).

### Fixed

- Install-Audit des Selbst-Installations-Wegs (Entscheidung E49,
  sieben Funde): Die Setup-Skripte nennen bei fehlendem Node 26 jetzt
  die exakte Bezugsquelle (nodejs.org/en/download, ausdrücklich
  Version 26 "Current" wählen, nicht die vorausgewählte LTS; macOS
  alternativ `brew install node`) statt eines zirkulären Verweises auf
  den Vendor-Weg; README und Testleitfaden nennen die Voraussetzung
  vor Schritt 1 und trennen Selbst-Installation (online) sauber vom
  Vor-Ort-Vendor-Weg (offline). `npm audit` bricht die Installation
  nicht mehr nach erfolgreichem Build ab, sondern warnt deutlich
  (Log plus Schluss-Zusammenfassung); in der CI bleibt audit ein
  hartes Gate. Der python3-Aufruf in Schritt 8 der setup.sh ist
  geguardet (Macs ohne Xcode CLT: Stub mit Exit ungleich 0 hätte das
  Skript nach dem App-Start abrupt beendet), die
  Vendor-Verifikationspfade prüfen python3 vorab, der Preflight prüft
  shasum. `install/lib/checksums.json` enthält jetzt auch das vierte
  Modell (`ggml-large-v3-turbo-q5_0.bin`, EN); ein gevendortes
  EN-Modell wurde bisher stillschweigend ignoriert. Der
  Windows-Rebuild-Hash bezieht `electron.vite.config.ts` ein (wie
  macOS). Das README warnt ehrlich vor dem ZIP-Download-Weg auf macOS
  (Gatekeeper blockiert `.command`; git clone empfohlen).

- Sprachkommandos erzeugen keinen Interpunktions-Müll mehr, wenn
  Whisper um das Kommandowort selbst Satzzeichen setzt (Entscheidung
  E43, Praxistest-Repro): "Das ist ein Test, Punkt." wird jetzt
  "Das ist ein Test." (bisher "Das ist ein Test,."); ", Komma" wird
  ","; "Neuer Absatz." mitten im Text hinterlässt keinen Rest-Punkt;
  "Hallo Absatz und weiter" erzeugt jetzt einen Absatz. 21 neue
  Unit-Fälle inklusive der vier Repro-Fälle und der EN-Pendants.

### Ausblick

- Für 1.0.0 vorgesehen: bestandene manuelle Abnahme nach
  der internen Abnahme-Checkliste (Auto-Paste auf macOS und Windows,
  TCC-Rebuild-Test, Windows-Setup-Trockenlauf, Schwachhardware-Latenz,
  echter Download-Pfad, SmartScreen/AV-Verhalten, On-Site-Trockenlauf).
  Begründung des Release-Kandidaten: Entscheidung E33.

## [1.0.0-rc.2] - 2026-07-04

Zweiter Release-Kandidat: VoiceWall ist vollständig zweisprachig
(Deutsch/Englisch, Oberfläche UND alle Main-Prozess-Meldungen), die
Diktatsprache Englisch ist pro Firma wählbar, Stufe 1 (Fach-Wörterbuch
und regelbasierte Textaufbereitung) ist enthalten. Zusätzlich alle vier
Pflicht-Fixes aus dem B2-Review (u. a. zentral serialisierte
Konfig-Schreibzugriffe, korrekte Footer-Version).

### Added

- Alle Main-Prozess-Texte zweisprachig (Paket B3, Entscheidung E41):
  Result-Fehlermeldungen aller IPC-Handler (Diktat-Flow, Firmen,
  Register, Export, Verschlüsselung, Wörterbuch, Modelle, Freigaben),
  engineHinweis-Statusmeldungen, Overlay-Zustellmeldungen
  ("Text eingefügt ..."), Tray-Menü, Modell-Anzeigenamen, die
  PDF-Vorlage (Beschriftungen und Fußzeile folgen der UI-Sprache zum
  Exportzeitpunkt) und der Fehlertext des Capture-Fensters stehen im
  neuen Katalog-Bereich `main` (`src/shared/i18n/de.ts`/`en.ts`,
  gleiche Typ-Erzwingung wie B2). Der Main-Prozess hält die aktive
  UI-Sprache zentral in `src/main/i18n.ts` (`setUiLanguage()` beim
  Start aus der Konfiguration und im `config:set-ui-language`-Handler;
  `texte()` liefert den aktiven Katalog, keine verstreuten
  Konfig-Reads pro Meldung). Der Whisper-Worker erhält die UI-Sprache
  mit `init` und `set-context` und übersetzt seine wenigen
  nutzersichtbaren Fehlertexte selbst. Logs bleiben bewusst DEUTSCH
  (interne Betriebssprache, E41). Neue Beweise: EN-Smoke-Unit-Tests
  für Main-Meldungen (tests/unit/main-i18n.test.ts) und ein
  E2E-Durchstich "UI auf Englisch + Diktatfehler-Pfad zeigt englische
  Accessibility-Meldung" (tests/e2e/ui-language.spec.ts).

- Zweisprachige Oberfläche Deutsch/Englisch (Paket B2, Entscheidung
  E40). Eigene, typisierte Text-Kataloge in `src/shared/i18n/` ohne
  neue Abhängigkeit: `de.ts` ist die Quelle der Wahrheit, der Typ
  `Uebersetzung = typeof de` erzwingt die Vollständigkeit von `en.ts`
  beim Kompilieren (Laufzeit-Doppelnetz in tests/unit/i18n.test.ts,
  inklusive "kein EN-Wert leer" und "EN != DE außer dokumentierter
  Allowlist"). Die UI-Sprache liegt global in der config.json
  (`uiSprache`, Default Deutsch, zod mit catch) und ist unabhängig von
  der Diktatsprache der Firmen; gesetzt über den neuen IPC-Kanal
  `config:set-ui-language`. Der First-Run-Wizard beginnt mit einem
  echten Schritt 0 "Sprache / Language" (zweisprachig beschriftet,
  wirkt sofort und schlägt die Diktatsprache entsprechend vor,
  überschreibbar); in der Verwaltung wechselt ein Umschalter in der
  Kopfzeile die Sprache live ohne Reload und persistiert sie. Das
  Diktat-Overlay zeigt seine Texte ("Ich höre zu ..." / "I am
  listening ...") in der UI-Sprache (Sprache reist im
  Overlay-Zustands-Payload mit). Datums- und Zahlformate folgen der
  UI-Sprache (Intl, de-DE/en-GB; deutsche Anzeige unverändert).
  Rechtstexte (Anbieterkennzeichnung, rechtstexte/) bleiben bewusst
  deutsch (deutsches Recht); die englische Oberfläche trägt darüber
  eine kurze Einordnungszeile. Meldungen aus dem Main-Prozess
  (Fehlertexte, Engine-Hinweise, Tray) bleiben in diesem Paket deutsch
  (Paket B3). Neue E2E-Beweise: Wizard-Schritt 0 mit Live-Umschaltung,
  Verwaltungs-Umschalter mit Persistenz über einen Neustart.

- Diktatsprache Englisch als wählbare Sprache pro Firma (Paket B1,
  Entscheidung E39; die Oberfläche bleibt deutsch). Neue Firmen wählen
  im Wizard-Schritt "Sprache" zwischen Deutsch (empfohlen, Standard,
  DE-optimiertes Finetune-Modell) und Englisch (originales
  multilinguales large-v3-turbo, Q5_0, MIT, aus ggerganov/whisper.cpp;
  zusätzlicher einmaliger Download von ca. 574 MB, SHA-256 nach dem
  R14-Verfahren selbst berechnet und identisch mit dem
  Hugging-Face-LFS-OID). Kein Auto-Download: geladen werden nur die
  Modelle der aktiven Sprache plus VAD. Die Sprache der aktiven Firma
  bestimmt Modell und language-Parameter der Transkription
  (Sprachwechsel = geordneter Engine-Neustart mit deutscher
  Statusmeldung); sie ist in der Verwaltung sichtbar und nachträglich
  über ein Auswahlfeld änderbar (Hinweis auf den ggf. nötigen
  Modell-Download). Füllwörter-Filter und Sprachkommandos folgen der
  Firmensprache (englisch: "uh/um/erm" bzw. "period", "comma",
  "new line", "new paragraph", gleiche Opt-in-Logik); Front-Matter
  `sprache` und Modellkennung tragen die echten Werte. Neues englisches
  Test-WAV (tests/fixtures/testdiktat-en.wav), Integrations- und
  E2E-Beweise inklusive Sprachwechsel über die UI.

- Stufe 1: Fach-Wörterbuch pro Firma und regelbasierte lokale
  Textaufbereitung (ABARBEITUNG 2.7; rein deterministische
  String-Verarbeitung, kein Modell, kein externer Aufruf). Neue Datei
  `.voicewall/vokabular.json` je Firma (zod-validiert, atomar
  geschrieben): bis zu 200 Begriffe werden Whisper als Initial-Prompt
  mitgegeben (kommaseparierte Liste, hart auf 600 Zeichen gekappt,
  Entscheidung E37; der Anti-Halluzinations-Pfad bleibt unberührt,
  Stille erzeugt auch mit Prompt keinen Text), und bis zu 200
  Ersetzungsregeln korrigieren häufige Fehltranskriptionen
  deterministisch (nur ganze Wörter, Unicode-korrekte Wortgrenzen mit
  Umlauten, case-sensitiv, längste zuerst, Literalbehandlung,
  Entscheidung E36). Aufbereitungs-Pipeline
  (`src/shared/textaufbereitung.ts`): Interpunktions-Nachschärfung
  (immer an, konservativ), Füllwörter-Filter (Schalter, Standard an)
  und Sprachkommandos ("Punkt", "neue Zeile", ...; Schalter, Standard
  aus, Entscheidung E38); die Schalter liegen global in der
  Konfiguration (Entscheidung E35). Editor für Begriffe und
  Ersetzungen im Bereich Diktat; neue IPC-Kanäle `vocab:get`,
  `vocab:save`, `config:set-aufbereitung`. Die Wortzahl im
  Front-Matter zählt den finalen Text. Die AI-Act-Einordnung wurde um
  die Aufbereitung ergänzt (Carveout "unterstützende Funktion für die
  Standardbearbeitung").

### Fixed

- Lost-Update-Muster in den Konfig-Handlern (Pflicht-Fix aus dem
  B2-Review, Entscheidung E42): `setAufbereitung`,
  `setClipboardRestore`, Hotkey- und Modellwahl-Schreiber sowie die
  CompanyManager-Schreiber (Firmenliste, aktive Firma, Auto-Speichern)
  schrieben teils einen veralteten in-memory-Gesamtstand zurück und
  konnten damit fremde Änderungen überschreiben (dasselbe Muster, das
  in B2 bei `setUiSprache` real frisch angelegte Firmen entfernt
  hätte). Jetzt läuft JEDER globale Konfig-Schreibzugriff über EINE
  zentrale, serialisierte Lesen-Ändern-Schreiben-Funktion
  (`src/main/config/config-writer.ts`, Promise-Kette; FlowController
  und CompanyManager teilen sich dieselbe Instanz). Deterministischer
  Regressionstest nach dem Muster des M7-Lost-Update-Tests:
  tests/unit/config-writer.test.ts.

- Prüfstempel-Footer zeigte im Dev-Modus die Electron-Version
  ("43.0.0") statt der App-Version: `app.getVersion()` liefert im
  ungepackten Zustand die Electron-Version. Die App-Version wird jetzt
  zur Buildzeit aus package.json eingebettet (`__APP_VERSION__` per
  electron-vite define, `src/main/app-version.ts`) und in SystemInfo,
  Beleg-Ansicht, `erstelltMit` neuer Firmen-Konfigs und dem
  Ready-Marker verwendet; im gepackten Build unverändert korrekt.
  Beleg: Unit-Test (main-i18n.test.ts) plus E2E-Footer-Assertion.

- `document.documentElement.lang` folgt jetzt dynamisch der
  UI-Sprache (Hauptfenster und Overlay): Screenreader wählen damit die
  korrekte Aussprache (A11y-Pflicht-Fix aus dem B2-Review).

- Der Fehlertext des Capture-Fensters (Mikrofonzugriff) läuft über den
  Katalog-Kanal: das Capture-Fenster sendet nur noch das technische
  Detail, die nutzersichtbare Meldung baut der Main-Prozess in der
  UI-Sprache (B2-Übergabepunkt).

## [1.0.0-rc.1] - 2026-07-03

Erster Release-Kandidat: alle Funktionsmeilensteine M0 bis M9 umgesetzt,
alle automatisierten Gates grün (Typprüfung, Lint, Format, Unit-Tests,
Build, E2E, npm audit, SBOM, Supply-Chain- und Rechtsverweis-Gate).

### Added

- M9: Vertriebsreife, Rechtstexte und Release-Vorbereitung. Neues
  Verzeichnis `rechtstexte/` mit Impressum (§ 5 DDG, § 7 DDG in
  Verbindung mit der VO (EU) 2022/2065, E-Mail von der Live-Quelle
  der-ki-auditor.de/impressum übernommen), kurzer und beweisbar wahrer
  Datenschutzerklärung (keine Übermittlung mangels Server, § 25 TDDDG
  nicht einschlägig, Hugging-Face-Download transparent inklusive
  IP-Empfänger-Hinweis), Widerrufsbelehrung für den
  49-Euro-Vor-Ort-Dienst mit ehrlicher Differenzierung (Fernabsatz
  § 312c, außerhalb von Geschäftsräumen § 312b, Widerrufsbutton § 356a
  BGB nur bei Vertragsschluss über eine Online-Benutzeroberfläche,
  vorzeitiges Erlöschen § 356 Abs. 5 Nr. 2 BGB, Wertersatz § 357a
  Abs. 2 BGB; alle Fundstellen am 03.07.2026 gegen
  gesetze-im-internet.de geprüft), Muster-Widerrufsformular (Anlage 2
  EGBGB), kundenfertigem DSGVO-Beleg-Blatt (kein AVV, kein
  Drittlandtransfer, sechs nachprüfbare Nachweise, ehrliche
  Restdimensionen) und AI-Act-Einordnung mit dem wörtlichen
  Art.-50-Abs.-2-Carveout der VO (EU) 2024/1689 in Deutsch und
  Englisch (EUR-Lex/Amt für Veröffentlichungen, CELEX 32024R1689).
  In der App: Abschnitt „Über VoiceWall (Anbieterkennzeichnung)“ in
  der Beleg-Ansicht, vollständig lokal gerendert
  (`src/shared/impressum.ts`), plus Knopf zur statischen
  Impressums-Quelle (zweite dokumentierte openExternal-Ausnahme, E31);
  E2E-Beleg in `tests/e2e/manage.spec.ts`. Das CI-Rechtsverweis-Gate
  deckt `rechtstexte/` mit ab (Verstoß-Beweis geführt).
  Signing-Kostenentscheidung aufbereitet
  (interne Signing-Entscheidung E32), Abnahme-Checkliste zu einer
  konsolidierten 1.0.0-Checkliste erweitert, README auf den Ist-Stand
  neu geschrieben, NOTICE und THIRD_PARTY_LICENSES.md vervollständigt
  (whisper.cpp, @fugood/whisper.node samt sechs Plattform-Binaries,
  OpenAI-Whisper-Architektur, primeline-Modell mit
  cstr-Änderungshinweis und vollem Apache-2.0-Text, Silero VAD v5.1.2
  gepinnt, React, zod, Electron/Chromium-Hinweis), SECURITY.md-Kontakt
  auf das Impressum abgestimmt. Release-Artefakte unter `release/`
  (CycloneDX-SBOM und Checksummen-Datei mit Modell-Hashes,
  Plattform-Binary-Hashes und Commit-Bezug).

- M8: Export-, Such- und Backup-Ausbau (v1.1-Posten aus E25). PDF-Export
  über `webContents.printToPDF()` in einem versteckten, sandboxed
  BrowserWindow: lokale Druckvorlage (CSP `default-src 'none'`, Body strikt
  als Text, Prüfdokument-Layout DIN A4 mit Fußzeile „Erstellt mit VoiceWall,
  100 % lokal“), echte Umlaute per Text-Extraktion im E2E-Test bewiesen
  (pdf-parse nur als gepinnte Test-devDependency, E26). Stapel-Export im
  Register (Mehrfachauswahl per Checkbox oder alle gefilterten, MD/TXT/PDF):
  mehrere Dateien landen in einem atomar erzeugten Unterordner
  `Exporte/<datum>-stapel/` statt ZIP (E27), Fortschritt als
  IPC-Progress mit aria-live. Volltextsuche über die Markdown-Bodies
  (Umschalter „Auch im Volltext suchen“): sequenzieller Streaming-Scan,
  Suchbegriff strikt als Literal, Treffer mit Kontext-Snippet, kombiniert
  mit allen Filtern; bewusst ohne Cache nach Messung mit 1000
  Fixture-Diktaten (E28). Tag-Batch-Rename („Tags verwalten“): firmenweit
  inklusive Papierkorb, atomare Datei-Updates, Abschluss per atomarem
  Manifest-Rebuild aus dem Dateizustand, Fehlerstrategie „weiterlaufen und
  sammeln“ (E29). Backup-Härtung (R16): Beleg-Ansicht-Abschnitt „Backup und
  Verschlüsselung“ mit Klartext-/Art.-9-Warnung und
  FileVault-/BitLocker-Anleitung (auch als docs/BACKUP-HINWEISE.md);
  verschlüsselter Einzel-Export als `.vwenc` (AES-256-GCM, scrypt,
  ausschließlich Node-Bordmittel, Passwort mindestens 12 Zeichen mit
  Wiederholung, wird nie gespeichert) plus „Datei entschlüsseln“ in der App
  (E30).

- M7: Verwaltungs-UI (v1-Scope). Ansichts-Container ohne Router-Paket
  (E23) mit vier Ansichten (Diktat, Register, Papierkorb, Beleg) und
  prominentem Firmen-Umschalter. Register als sortierbares
  Aktenverzeichnis (Datum/Titel/Wortzahl) mit Manifest-Schnellsuche und
  Filtern (Zeitraum, Tags-Mehrfachauswahl, Quelle), Tags mit
  Autocomplete aus `tags.json`, Detailansicht mit Volltext strikt als
  Textknoten (Stored-XSS-Beweis per E2E), Bearbeiten mit atomarem
  Schreiben und `geaendert`/`version`-Nachführung, manuelle Notiz
  (Quelle `manuell`), MD/TXT-Export nach `Exporte/` mit „Im Finder
  zeigen“ (Containment auch für Reveal, E24), Soft-Delete/Papierkorb
  mit Wiederherstellen und endgültigem Löschen, Beleg-Ansicht („0
  externe Verbindungen“, Modellversionen mit SHA-256 und Pfad,
  eingebetteter Netzwerk-Selbsttest, Konsent-Zeitstempel, App-Version,
  Log-Pfad). Genau eine sichtbare H1 je Ansicht, Fokus wandert beim
  Ansichtswechsel auf die H2. PDF/Volltext/Tag-Batch-Rename bewusst auf
  M8 verschoben (E25).

- M6: Installer, Packaging und First-Run-Wizard. Packaging als reiner
  `--dir`-Build via electron-builder (`electron-builder.yml`: Bundle-ID
  `de.der-ki-auditor.voicewall`, deutscher NSMicrophoneUsageDescription-Text,
  `electronDist` aus node_modules ohne Netz-Nachladen, `identity: null`;
  Signierung macht das Setup-Skript, Entscheidung E17); programmatisch
  erzeugtes App-Icon ohne Binaerdatei im Repo (`scripts/generate-icon.mjs`,
  E18). Bootstrap-Skripte `install/voicewall-setup.sh|.command|.ps1|.cmd`
  mit den acht idempotenten Schritten aus ABARBEITUNG 4.1 (Preflight,
  portable Node aus Vendor, .npmrc-Haertung, `npm ci --offline` gegen
  Vendor-Cache, Packaging plus Ad-hoc-Codesign mit Bundle-ID-Verifikation
  und TCC-Re-Grant-Hinweis, npm audit/SBOM, App-Start mit
  Ready-Marker-Poll statt Port/Sleep (E19), First-Run-Erkennung), Log nach
  `~/.voicewall/logs/install-<ISO>.log`; Deinstallation entfernt nur
  VoiceWall-Eigenes und laesst Firmendaten IMMER stehen.
  `scripts/prepare-vendor.mjs` bereitet den Offline-Vendor-Stand je
  Zielplattform vor (Node-Tarball gegen offizielle SHASUMS256.txt,
  npm-Cache inkl. Cross-Plattform-Whisper-Subpaket, Modelle verifiziert);
  Ablauf intern dokumentiert.
  First-Run-Wizard als echte App-Shell (ersetzt die M2-Test-UI):
  Willkommen mit informierter Einwilligung und AI-Act-Transparenzhinweis,
  Firmendaten mit Live-Ordnernamen-Vorschau (editierbar) und
  RFC-lax-E-Mail-Validierung, Speicherort mit Sync-Erkennung und
  Empfehlung "lokal mit Desktop-Verknuepfung", Sprache (Deutsch fest),
  Modellwahl mit Hardware-Empfehlung (Q5_0 Standard, fp16 ab 16 GB/6
  Kernen, E21) und einmaligem, pruefsummen-verifiziertem Download samt
  Fortschritt, Hotkey mit Livetest ohne Persistenz (E20) und
  Tastatur-Recorder, macOS-Bedienungshilfen-Schritt (nicht blockierend),
  Zusammenfassung mit atomarer Anlage, Erfolgsseite mit Kurzanleitung und
  eingebettetem Netzwerk-Selbsttest. Uebergangs-Hauptansicht (Diktat-Status,
  Firmen, letzte Diktate, Funktionsbeleg); Wizard aus der Verwaltung erneut
  aufrufbar ("Neue Firma einrichten", nur Firmen-Schritte).
  Design-System "Pruefdokument" (Papier-/Elfenbein-Grund, fast-schwarze
  Tinte, Siegel-Gruen als einziger Akzent, lokale Serifen-Systemfonts,
  Formular-Linien, Pruefstempel-Footer mit Version/Modell-Pruefsumme;
  Kontrast-Nachweis AA in styles.css, A11y-Bilanz E22).
  Neue IPCs: `system:info` (Hardware/Version), `wizard:test-hotkey`,
  `config:set-model-choice`; Firmen-Anlage traegt jetzt optionale
  Firmendaten (Ansprechpartner, E-Mail, Standort, Hinweis), editierten
  Ordnernamen und Modellwahl. fp16-Modell im Katalog/Manifest ergaenzt.
  CI: Skript-Syntax-Gate (bash -n, PowerShell-Parser) und macOS-Packaging-
  Job mit Bundle-Asserts (Info.plist-Keys, Ad-hoc-Signatur, App-Start).

- M5: Ordner-als-Datenbank. Firmenordner-Anlage atomar (Temp-Ordner plus
  Rename) und idempotent mit Struktur nach 4.4.1 (`.voicewall/` mit
  manifest.json/config.json/tags.json/.schema-version, `Diktate/YYYY/MM/`,
  `Exporte/`, `Papierkorb/`, POSIX 0700; fremde Ordner werden nie
  beschrieben, Kollisionsvorschlag statt Ueberschreiben), Transkripte als
  Markdown mit YAML-Front-Matter (eigener injektionssicherer Serializer/
  Parser fuer das flache Schema, Entscheidung E13; Dateinamen
  `YYYY-MM-DD_HHMMSS_<slug>.md` mit id-Suffix bei Kollision), CRUD mit
  atomarem Schreiben und Containment-Pruefung nach `path.resolve` auch beim
  LESEN (manipulierte Manifest-/Konfig-Pfade werden abgewiesen),
  selbstheilendes Manifest (inkrementelle Updates, `rebuildManifest()` per
  Front-Matter-Scan, NFC-normalisierte Pfadvergleiche) mit
  In-Memory-Schnellsuche (Titel/Tags/Vorschau/Zeitraum/Quelle) und
  tags.json-Pflege, zweistufige Konfiguration (firmenbezogen 0600 plus
  globale firmen[]/aktiveFirma/diktatAutoSpeichern mit Pfad-Validierung
  beim Laden), echte Migrationsroutine (backup-erst nach
  `.voicewall/backups/`, Migration auf Kopie, Validierung, Swap, Rollback,
  idempotent; Risiko R12, Entscheidung E14), Sync-Fallen-Erkennung
  (iCloud-Desktop-Redirect via realpath, OneDrive-Muster plus
  Env-Praefix, Dropbox, Google Drive; Risiko R8) mit lokaler
  Alternativ-Strategie `~/VoiceWall/` plus Desktop-Verknuepfung
  (Symlink/Junction, Entscheidung E15), Mehr-Firmen-Verwaltung mit
  physischer Trennung, IPC/Preload-Bruecke (zod-validiert) und minimaler
  Test-UI, Diktat-Flow-Anbindung (Auto-Speichern in der aktiven Firma,
  Default AN sobald eine Firma existiert), Mehrbenutzer-/
  Fast-User-Switching-Klaerung (Entscheidung E16, Kritik D7).

- M4: Sicherheits- und Datenschutz-Fundament. Firmenname-Sanitisierung mit
  7-Stufen-Pipeline und Containment nach `path.resolve`
  (`src/main/storage/sanitize.ts`, 50 Angriffsklassen-Tests, inkl. NFD-/
  Case-Kollisionserkennung fuer macOS/Windows), Desktop-Aufloesung mit
  Windows-Known-Folder-Registry-Lookup (`src/main/storage/paths.ts`),
  gehaerteter Logger (JSON-Lines, zentrale Redaction mit Allowlist plus
  Verbotsliste, Rotation 5 x 1 MB, Rechte 0600/0700, getrennte
  Betriebs-/Setup-Streams), Allowlist-Schleuse fuer native whisper.cpp-Logs
  (Transkript-tragende Zeilen bleiben RAM-only, nie persistiert),
  Supply-Chain-Gate `scripts/verify-checksums.mjs` (SHA-256 aller sechs
  Plattform-Binaries, Versions-Drift, binding.gyp-Scan) und
  Rechtsverweis-Gate `scripts/check-legal-references.mjs` in der CI,
  Dependabot-Konfiguration, auditierbares `resources/model-manifest.json`
  (testgesichert synchron zum Katalog), zentraler Permission-Handler (nur
  Mikrofon fuer die eigene Origin, alles andere abgelehnt), dokumentierte
  CSP je Fenster (media-src nur im Capture-Fenster), IPC-Haertung (zod an
  jeder Eingangsgrenze, nie rohe Fehler an den Renderer),
  Netzwerk-Isolations-E2E-Beweis (null nicht-lokale Requests im kompletten
  Diktat-Flow) und Kunden-Selbsttest-Anleitung
  `docs/NETZWERK-SELBSTTEST.md`.

- M3: Systemweites Diktat. Globaler Hotkey (Toggle, Standard
  `CommandOrControl+Shift+D`, konfigurierbar und persistiert, Konflikt-Handling),
  Tray-Icon mit Aufnahme-Indikator, fokus-neutrales Overlay ("Ich hoere zu"),
  Auto-Paste-Adapter (macOS osascript, Windows PowerShell SendKeys, beide
  ausschliesslich `execFile` mit statischen Argumenten), Clipboard-Sequenz als
  Datenschutzmassnahme (sichern, einfuegen, race-sicher wiederherstellen),
  macOS-Bedienungshilfen-Check mit Deep-Link-Anleitung, Kopieren-Knopf als
  Resilienz-Primaerpfad (Text geht nie verloren), App laeuft nach dem
  Onboarding ohne Fenster im Tray weiter, Aufnahme-Abbruch bei
  Sperrbildschirm/Suspend. Push-to-talk fuer v1 gestrichen (technisch
  unmoeglich mit globalShortcut, intern dokumentiert).

- M2: STT-Kern. Audio-Aufnahme in einem eigenen, unsichtbaren
  Capture-Fenster (getUserMedia, 16 kHz mono, RAM-only, kein
  Datei-Artefakt), informierte Mikrofon-Einwilligung mit Zeitstempel
  und AI-Act-Transparenzhinweis, Whisper-Engine als utilityProcess mit
  dem deutschen Modell whisper-large-v3-turbo-german (Q5_0),
  VAD-gestuetzte Segmentierung (Silero v5.1.2) mit Sliding-Window,
  pruefsummen-verifizierter Modell-Download (SHA-256 aus dem Katalog,
  Quercheck gegen den Hugging-Face-LFS-OID, Risiko R14) und
  Test-Oberflaeche fuer den Diktat-Flow.

- M1: Architektur-Spike (Projektbrecher empirisch geklaert, Ergebnisse
  im internen M1-Spike-Bericht): `@fugood/whisper.node` ist ein echtes
  N-API-Addon (ABI-stabil, kein nan), laedt und transkribiert im
  `utilityProcess` (R1/R2 entschaerft); der Binary-Bezug funktioniert
  unter npm-Skript-Restriktionen ueber optionale Plattform-Subpakete,
  Offline-Vendoring je Zielplattform als Pflichtweg festgelegt (R3);
  TCC-Befund F4: Ad-hoc-Signatur bindet Freigaben an den cdhash, jeder
  Rebuild bricht erteilte Grants (Grundlage der
  Developer-ID-Empfehlung, R4).

- M0: Vollständig gehärtetes, compilerfreies Electron-Projektgerüst
  (Electron, electron-vite, TypeScript strict, ESLint-Modulgrenzen, Vitest,
  Playwright for Electron, CI-Pipeline, SBOM, Sicherheits-Defaults,
  Single-Instance-Lock, deaktiviertes Crash-Reporting).
