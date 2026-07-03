# Changelog

Alle nennenswerten Änderungen an VoiceWall werden in dieser Datei
dokumentiert. Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung folgt [SemVer](https://semver.org/lang/de/).

## [Unreleased]

### Added

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

- M0: Vollständig gehärtetes, compilerfreies Electron-Projektgerüst
  (Electron, electron-vite, TypeScript strict, ESLint-Modulgrenzen, Vitest,
  Playwright for Electron, CI-Pipeline, SBOM, Sicherheits-Defaults,
  Single-Instance-Lock, deaktiviertes Crash-Reporting).
