# VoiceWall

VoiceWall ist ein zu 100 Prozent lokales, DSGVO-freundliches
Sprachdiktiergerät für Mac und Windows. Der gesamte Weg von der Stimme
zum Text läuft auf dem Rechner des Nutzers: keine Cloud, kein externer
Server, kein API-Aufruf, keine Telemetrie. Die App öffnet keinen
Netzwerk-Port; die interne Kommunikation läuft ausschließlich über
Electron-IPC. Das Kernversprechen lautet nicht "vertrauen Sie uns",
sondern "prüfen Sie es nach": Beleg statt Behauptung.

**Projektstatus:** Version 1.0.0-rc.1 (Release-Kandidat). Alle
Funktionsmeilensteine (M0 bis M9) sind umgesetzt und automatisiert
getestet. Für die 1.0.0 stehen noch die manuellen Abnahmen aus
`docs/ABNAHME-CHECKLISTE.md` aus, insbesondere der echte
Auto-Paste-Pfad auf macOS und Windows, der TCC-Grant-/Rebuild-Test und
die Windows-Hardware-Abnahme.

## Was VoiceWall kann

- **Systemweites Diktat:** globaler Hotkey (Standard
  `Cmd/Strg+Shift+D`, Umschalt-Prinzip: einmal drücken startet, einmal
  drücken stoppt), Overlay "Ich höre zu" ohne Fokusklau, automatisches
  Einfügen an der Cursor-Position der Ziel-App (macOS per osascript,
  Windows per SendKeys), Kopieren-Knopf als Resilienzpfad: der Text geht
  nie verloren.
- **Deutsche Spracherkennung lokal:** whisper.cpp mit dem deutschen
  Modell whisper-large-v3-turbo-german (Q5_0 als Standard, fp16 als
  Option für starke Hardware) plus Silero-VAD-Segmentierung. Audio lebt
  ausschließlich im Arbeitsspeicher und wird nie auf die Festplatte
  geschrieben.
- **First-Run-Wizard:** informierte Einwilligung mit
  KI-Transparenzhinweis, Firmendaten, Speicherort mit
  Cloud-Sync-Erkennung (iCloud/OneDrive/Dropbox-Falle), Modellwahl mit
  Hardware-Empfehlung, Hotkey-Livetest, macOS-Bedienungshilfen-Schritt,
  atomare Anlage.
- **Verwaltung (Ordner als Datenbank):** Diktate liegen als
  Markdown-Dateien mit YAML-Front-Matter im Firmenordner auf dem
  Desktop beziehungsweise unter `~/VoiceWall/`. Register mit
  Schnellsuche, Filtern (Zeitraum, Tags, Quelle), Volltextsuche über
  die Diktat-Inhalte, Detailansicht, Bearbeiten, manuelle Notizen,
  Tags mit Autocomplete und firmenweitem Umbenennen.
- **Export:** Markdown, reiner Text und PDF (Prüfdokument-Layout,
  korrekte Umlaute nachgewiesen), einzeln oder als Stapel; zusätzlich
  verschlüsselter Einzel-Export als `.vwenc` (AES-256-GCM, scrypt)
  samt Entschlüsselung in der App.
- **Papierkorb:** Soft-Delete mit Wiederherstellen und endgültigem
  Löschen nach Bestätigung.
- **Mehrere Firmen:** physisch getrennte Bestände je Firma, prominenter
  Umschalter, getrennte Konfiguration.
- **Beleg-Ansicht:** die UI-Seite von "Beleg statt Behauptung": null
  externe Verbindungen, Modellversionen mit SHA-256 und Pfad,
  eingebetteter Netzwerk-Selbsttest, Einwilligungs-Zeitstempel,
  Backup-/Verschlüsselungs-Hinweise und die vollständige
  Anbieterkennzeichnung (Impressum) lokal angezeigt.

## Prüfen statt glauben: der Netzwerk-Selbsttest

`docs/NETZWERK-SELBSTTEST.md` beschreibt drei unabhängige Proben, mit
denen jeder Kunde in Minuten selbst nachprüft, dass VoiceWall keine
Daten sendet: die Netzwerk-Anzeige der App (DevTools), der
Verbindungsmonitor des Betriebssystems und die härteste Probe, der
gezogene Netzstecker (die App funktioniert vollständig offline).
Einzige Ausnahme ist der einmalige, prüfsummen-verifizierte
Modell-Download bei der Einrichtung; bei der Vor-Ort-Installation
entfällt er durch Offline-Vendoring. Zusätzlich erzwingt der
automatisierte Test `tests/e2e/network-isolation.spec.ts` bei jedem
Stand null nicht-lokale Anfragen während eines kompletten
Diktat-Durchlaufs.

## Sicherheitsarchitektur (Überblick)

- **Kein Server, kein Port:** kein `listen(`-Aufruf im Quellcode, nur
  Electron-IPC. Renderer laufen mit `contextIsolation: true`,
  `nodeIntegration: false`, `sandbox: true`; jede IPC-Grenze validiert
  mit zod, nie rohe Fehler über die Prozessgrenze.
- **Whisper im utilityProcess:** die native Spracherkennung läuft in
  einem eigenen Prozess ohne Netzwerkbedarf; native Logzeilen passieren
  eine Allowlist-Schleuse, Transkript-tragende Zeilen bleiben RAM-only.
- **Harte CSP:** die Oberfläche erlaubt keine externe Origin;
  Exfiltration wäre selbst für hypothetischen Schadcode blockiert.
- **Containment:** Firmennamen durchlaufen eine
  Sanitisierungs-Pipeline, alle Pfade werden nach `path.resolve` gegen
  den Firmenordner geprüft (auch beim Lesen); der Renderer übergibt nie
  rohe Pfade. Kein Nutzerwert erreicht eine Shell (`execFile` mit
  statischen Argumenten).
- **RAM-only-Audio:** Mikrofon-Audio wird nie persistiert;
  Crash-Reporting ist hart deaktiviert, das Crash-Dump-Verzeichnis wird
  bei jedem Start geleert (ehrliche Swap-Fußnote im
  DSGVO-Beleg-Blatt).
- **Lieferkette:** `package-lock.json` committet und per `npm ci`
  verifiziert, `npm audit` als CI-Gate, CycloneDX-SBOM je Stand,
  SHA-256-Pinning aller sechs nativen Whisper-Binaries
  (`scripts/verify-checksums.mjs`) und aller Modelle
  (`resources/model-manifest.json`), keine kompilierende `binding.gyp`
  im Baum, Dependabot aktiv.
- **Logging ohne Inhalte:** strukturierte, rotierte Logdateien mit
  restriktiven Rechten; Diktat-Inhalte werden nie geloggt.

Details: `docs/ENTSCHEIDUNGEN.md` (Entscheidungsprotokoll E1 bis E33),
`docs/M1-SPIKE-ERGEBNIS.md` (empirische Architektur-Belege),
`SECURITY.md` (Meldeweg für Schwachstellen).

## Systemvoraussetzungen

- **macOS:** Apple Silicon (arm64) oder Intel (x64); Mikrofon- und
  Bedienungshilfen-Freigabe (führt der Wizard). Nach jedem Rebuild der
  ad-hoc-signierten App verlangt macOS die Freigaben erneut (TCC,
  dokumentiert in `docs/ON-SITE-PROTOKOLL.md`).
- **Windows:** x64. Grenze: in als Administrator laufende Ziel-Apps
  kann systembedingt nicht automatisch eingefügt werden (UIPI), der
  Kopieren-Knopf greift.
- **Ressourcen:** rund 3 GB freier Plattenplatz (App, Node-Runtime,
  Modelle); Standardmodell Q5_0 läuft ab 8 GB RAM, fp16 wird ab 16 GB
  RAM und 6 Kernen angeboten.
- **Entwicklung:** Node.js 26 (siehe `.nvmrc`, `engines` gepinnt),
  npm 11.

## Installation (review-then-run)

VoiceWall wird als inspizierbares Quellcode-Repo ausgeliefert, nicht
als anonymes Binary. Der Grundsatz: erst prüfen, dann ausführen. Vor
jeder Installation kann und soll der gesamte Quellcode eingesehen
werden.

1. Repo prüfen (Quellcode, `package-lock.json`, Skripte unter
   `install/` und `scripts/`).
2. `install/voicewall-setup.command` (macOS) beziehungsweise
   `install\voicewall-setup.cmd` (Windows) ausführen. Das Skript
   arbeitet acht idempotente Schritte ab (Preflight, portable
   Node-Runtime, npm-Härtung, `npm ci` offline gegen den Vendor-Cache,
   Build und Packaging mit Ad-hoc-Signierung, Verifikation inklusive
   SBOM, App-Start, First-Run-Erkennung) und protokolliert nach
   `~/.voicewall/logs/`.
3. Der First-Run-Wizard führt durch Einwilligung, Firma, Speicherort,
   Modell und Hotkey.

Der komplette Vor-Ort-Ablauf (Vendor-Stand vorbereiten, Termin unter
10 Minuten, Funktionsbeleg, Datensauberkeit) steht in
`docs/ON-SITE-PROTOKOLL.md`. Die Deinstallation
(`install/uninstall.sh` beziehungsweise `install\uninstall.ps1`)
entfernt nur VoiceWall-Eigenes; Firmendaten bleiben immer stehen.

## Entwicklung

```bash
npm ci               # Abhängigkeiten exakt aus dem Lockfile installieren
npm run dev          # Entwicklungsmodus (electron-vite)
npm run build        # Produktions-Build nach out/
npm run package      # App-Bundle (electron-builder --dir, inkl. Icon)
npm run typecheck    # TypeScript strict über alle Projektreferenzen
npm run lint         # ESLint inkl. Modulgrenzen, 0 Warnungen erlaubt
npm run format:check # Prettier-Prüfung
npm run test         # Unit-Tests (Vitest)
npm run test:e2e     # E2E gegen die gebaute App (vorher npm run build)
npm run audit        # npm audit, Gate ab Schweregrad high
npm run sbom         # CycloneDX-SBOM nach sbom.cdx.json
```

Teststrategie: Unit-Tests für jede sicherheits- oder datentragende
Funktion (Sanitisierung, Front-Matter, Migration, Verschlüsselung,
Manifest, Volltextsuche), E2E-Tests gegen die echte gebaute App
(Wizard, Diktat-Flow mit PCM-Injektion, Verwaltung inklusive
XSS-Probe, Export mit PDF-Text-Extraktion, Netzwerk-Isolation,
Impressums-Anzeige). Die CI erzwingt zusätzlich das
Rechtsverweis-Gate (`scripts/check-legal-references.mjs`, kein aktives
Zitat aufgehobener Gesetze), das Supply-Chain-Gate
(`scripts/verify-checksums.mjs`), Skript-Syntax-Gates und einen
macOS-Packaging-Job mit Bundle-Asserts.

## KI-Transparenz

Die Verschriftung erfolgt durch ein lokales KI-Modell (Whisper).
Automatische Transkription kann Fehler enthalten; das Ergebnis ist vor
Verwendung zu prüfen. Dieser Hinweis steht auch im First-Run-Wizard und
in der Oberfläche. Die rechtliche Einordnung mit dem wörtlichen
Art.-50-Carveout der KI-Verordnung steht in
`rechtstexte/AI-ACT-EINORDNUNG.md`.

## Rechtstexte

Im Ordner `rechtstexte/` liegen: Impressum (`IMPRESSUM.md`,
Anbieterkennzeichnung nach § 5 DDG, in der App unter Beleg, "Über
VoiceWall" lokal angezeigt), Datenschutzerklärung (`DATENSCHUTZ.md`),
DSGVO-Beleg-Blatt für die Kundendokumentation
(`DSGVO-BELEG-BLATT.md`), AI-Act-Einordnung
(`AI-ACT-EINORDNUNG.md`) sowie die Vertriebs-Rechtstexte für den
Vor-Ort-Installationsdienst (`WIDERRUF.md`,
`MUSTER-WIDERRUFSFORMULAR.md`).

## Lizenz

MIT-Lizenz (siehe `LICENSE`): VoiceWall ist kostenlos nutzbar, der
Quellcode ist zum Prüfen, Selbst-Installieren und Weitergeben frei.
Wer die Einrichtung nicht selbst machen möchte, bekommt sie als
Vor-Ort-Dienstleistung für einmalig 49 Euro (siehe `rechtstexte/`). Drittlizenzen und Attributionen: `THIRD_PARTY_LICENSES.md`
und `NOTICE` (unter anderem whisper.cpp, @fugood/whisper.node, das
GGML-Modell primeline/whisper-large-v3-turbo-german in der
cstr-Konvertierung, Silero VAD v5.1.2, React, zod, Electron/Chromium).
Sicherheitsmeldungen: `SECURITY.md`. Versionshistorie: `CHANGELOG.md`.
