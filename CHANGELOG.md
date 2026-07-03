# Changelog

Alle nennenswerten Änderungen an VoiceWall werden in dieser Datei
dokumentiert. Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung folgt [SemVer](https://semver.org/lang/de/).

## [Unreleased]

### Added

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
