# Changelog

Alle nennenswerten Änderungen an VoiceWall werden in dieser Datei
dokumentiert. Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung folgt [SemVer](https://semver.org/lang/de/).

## [Unreleased]

- Für 1.0.0 vorgesehen: bestandene manuelle Abnahme nach
  `docs/ABNAHME-CHECKLISTE.md` (Auto-Paste auf macOS und Windows,
  TCC-Rebuild-Test, Windows-Setup-Trockenlauf, Schwachhardware-Latenz,
  echter Download-Pfad, SmartScreen/AV-Verhalten, On-Site-Trockenlauf).
  Begründung des Release-Kandidaten: Entscheidung E33.

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
  (`docs/SIGNING-ENTSCHEIDUNG.md`, E32), Abnahme-Checkliste zu einer
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
  Ablauf dokumentiert in docs/ON-SITE-PROTOKOLL.md.
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
  unmoeglich mit globalShortcut, siehe docs/ENTSCHEIDUNGEN.md).

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
  in docs/M1-SPIKE-ERGEBNIS.md): `@fugood/whisper.node` ist ein echtes
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
