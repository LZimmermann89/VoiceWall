# On-Site-Protokoll: Der 49-EUR-Installationstermin (unter 10 Minuten)

Dieses Protokoll beschreibt den kompletten Ablauf einer Vor-Ort-Installation
beim Kunden (ABARBEITUNG 4.1.6): Vorbereitung auf Lars' Maschine, Ablauf beim
Kunden, Funktionsbeleg und Datensauberkeit. Die Installation ist offline-fähig
(Vendor-Stand), idempotent und hinterlässt einen auditierbaren Beleg.

## Teil 1: Vorbereitung (vor dem Termin, auf Lars' Maschine, mit Internet)

1. **Repo aktualisieren und prüfen:**

   ```bash
   git pull
   npm ci
   npm run test && npm run build
   ```

2. **Vendor-Stand für die Zielplattform des Kunden erzeugen:**

   ```bash
   # macOS Apple Silicon (Standardfall):
   node scripts/prepare-vendor.mjs --platform darwin-arm64

   # weitere Zielplattformen nach Bedarf:
   node scripts/prepare-vendor.mjs --platform darwin-x64
   node scripts/prepare-vendor.mjs --platform win32-x64
   ```

   Das Skript erledigt drei Dinge, jeweils mit SHA-256-Verifikation:
   - **Portables Node** von nodejs.org laden, gegen die offizielle
     `SHASUMS256.txt` prüfen, unter `vendor/node-runtime/` ablegen und den
     Hash in `install/lib/checksums.json` verankern (gegen genau diesen
     Anker prüft das Setup-Skript beim Kunden).
   - **npm-Cache füllen** (`vendor/npm-cache/`): `npm ci --cache` in einem
     Staging-Verzeichnis plus explizites `npm cache add` des
     plattformrichtigen `@fugood`-Whisper-Subpakets der Zielplattform
     (Cross-Vendoring). Damit läuft `npm ci --offline` beim Kunden ohne
     einen einzigen Registry-Zugriff.
   - **Electron-Binary der Zielplattform** in `vendor/electron-cache/`
     legen (das electron-Postinstall läuft unter Skript-Restriktionen nicht
     automatisch; das Setup-Skript entpackt beim Kunden offline aus diesem
     Cache, verifiziert gegen die im electron-Paket gepinnten Checksummen).
   - **Modelle kopieren** aus dem lokalen Modell-Ordner
     (`~/Library/Application Support/voicewall/models/`) nach
     `vendor/models/`, verifiziert gegen `resources/model-manifest.json`.
     Damit braucht der Wizard beim Kunden keinen Download.

3. **Übergabemedium packen:** Repo (ohne `node_modules/`, mit `vendor/`)
   auf USB-Stick oder als Archiv. Wichtig: `install/lib/checksums.json`
   muss den frisch eingetragenen Node-Hash enthalten (Teil des Repos).

   Hinweis: `vendor/` ist bewusst NICHT committet (.gitignore); es ist ein
   Transportartefakt, kein Quellcode.

## Teil 2: Beim Kunden (unter 10 Minuten)

| Schritt               | Dauer   | Tätigkeit                                                                                                                                                                                                                                         |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Übergabe              | < 1 Min | Repo-Kopie (inkl. `vendor/`) auf den Kundenrechner kopieren. Sichtprüfung: erwartetes VoiceWall-Repo. Lokale Kopie erzeugt in der Regel kein Quarantäne-Attribut, Gatekeeper stört nicht.                                                         |
| Ausführen             | < 3 Min | Doppelklick auf `install/voicewall-setup.command` (Mac) bzw. `install\voicewall-setup.cmd` (Windows, einmal SmartScreen bestätigen). Das Skript läuft die acht Schritte durch und protokolliert nach `~/.voicewall/logs/install-<ISO>.log`.       |
| Wizard                | < 3 Min | Die App startet automatisch im Einrichtungs-Wizard: Einwilligung, Firmendaten, Speicherort (Sync-Warnung beachten), Sprache, Modell (liegt offline vor: Status "vorhanden"), Tastenkürzel, macOS-Bedienungshilfen, Zusammenfassung, "Einrichten". |
| TCC-Freigaben (macOS) | < 1 Min | Mikrofon-Dialog bestätigen; Bedienungshilfen über den Wizard-Knopf in den Systemeinstellungen aktivieren.                                                                                                                                         |
| Funktionsbeleg        | < 2 Min | Siehe Teil 3.                                                                                                                                                                                                                                     |

Die acht Skript-Schritte (jeder idempotent, "check-then-do"):

1. Preflight (OS/Arch, >= 3 GB frei, Schreibrechte, Node-Version, Internet nur informativ)
2. Node-Runtime (System-Node falls passend, sonst portables Node aus `vendor/` nach `~/.voicewall/runtime/`)
3. Skript-Härtung (.npmrc ohne gefährliche Overrides)
4. `npm ci` (offline gegen `vendor/npm-cache`, nie `--omit=optional`) plus Supply-Chain-Prüfung (`scripts/verify-checksums.mjs`)
5. Build + Packaging (`npm run package`) plus Ad-hoc-Signierung mit Bundle-ID-Verifikation (nur macOS)
6. Verifikation (`npm audit` nur online, SBOM nach `~/.voicewall/logs/`, Vendor-Modelle verifiziert in den App-Support-Ordner)
7. App-Start mit aktivem Ready-Poll (Marker-Datei `app-ready.json`, kein HTTP-Port, kein blindes Sleep)
8. First-Run-Erkennung (nur Protokoll; die App entscheidet selbst zwischen Wizard und Verwaltung)

**Erneutes Ausführen** ist das Reparatur-/Update-Werkzeug: auf einer
fertigen Maschine läuft das Skript in Sekunden durch (alle Marker greifen)
und zerstört nie Daten.

**WICHTIG bei Updates (M1-Befund F4):** Jeder Rebuild ändert den cdhash der
ad-hoc-signierten App und bricht damit erteilte TCC-Freigaben. Nach einem
Update deshalb Mikrofon und Bedienungshilfen in den Systemeinstellungen
erneut aktivieren (das Skript loggt diesen Hinweis; die App erkennt die
fehlende Freigabe und führt zum richtigen Einstellungsbereich).

## Teil 3: Funktionsbeleg ("Beleg statt Behauptung", < 2 Min)

1. Testdiktat: Cursor in Word/Outlook setzen, Hotkey drücken, einen Satz
   sprechen, Hotkey drücken. Der Text erscheint per Auto-Paste.
2. Netzwerk-Beweis: DevTools der App öffnen (Cmd+Alt+I), Reiter Netzwerk,
   erneut diktieren: null externe Requests. Alternativ Verbindungsmonitor
   des Systems (siehe docs/NETZWERK-SELBSTTEST.md).
3. Beleg-Artefakte zeigen: Installationslog und SBOM unter
   `~/.voicewall/logs/`, Prüfstempel-Zeile im App-Footer (Version,
   Modell-Prüfsumme, "0 externe Verbindungen").

## Teil 4: Datensauberkeit

- Übergabemedium (USB-Stick/Archiv) wieder mitnehmen.
- Einzige Datenspuren auf dem Kundenrechner: das Repo mit der gebauten App,
  `~/.voicewall/` (Runtime, Logs, SBOM), der App-Support-Ordner
  (Modelle, Konfig) und der neue Firmenordner. Bestehende Kundendaten
  werden nie berührt.
- Deinstallation: `install/uninstall.sh` bzw. `install\uninstall.ps1`
  entfernt nur VoiceWall-Eigenes; **Firmendaten bleiben immer stehen.**

## Offene Punkte (ehrlich)

- Der vollständige Windows-Trockenlauf (`voicewall-setup.ps1` auf einer
  Windows-Referenzmaschine) steht noch aus; das Skript ist deklariert und
  syntaxgeprüft (CI), der belegte Lauf existiert bisher nur für macOS.
- Latenzmessung auf schwacher Windows-Hardware bleibt offen (M1-Bericht).
