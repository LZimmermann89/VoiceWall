# Changelog

Alle nennenswerten Änderungen an VoiceWall werden in dieser Datei
dokumentiert. Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung folgt [SemVer](https://semver.org/lang/de/).

## [Unreleased]

### Added

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
