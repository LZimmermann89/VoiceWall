# VoiceWall - Umsetzungsplan (ABARBEITUNG.md)

VoiceWall ist ein wirklich DSGVO-konformes, zu 100 Prozent lokales Sprachdiktiergeraet fuer Mac und Windows. Der gesamte Weg von der Stimme zum Text laeuft auf dem Rechner des Nutzers: keine Cloud, kein externer Server, kein API-Call, keine Telemetrie, kein KI-Dienst zur Laufzeit. Die DSGVO-Konformitaet ist damit architektonisch beweisbar (der Netzwerk-Tab zeigt im Betrieb null externe Requests), nicht bloss behauptet. Die Verteilung erfolgt als inspizierbares Quellcode-Repo, das der Auftraggeber Lars Zimmermann einmalig fuer 49 Euro vor Ort beim Kunden ausfuehrt. Ein mitgeliefertes Installations-Skript richtet alles compilerfrei ein (npm-basiert, prebuilt native Bausteine, keine schwere Toolchain), startet einen lokalen First-Run-Wizard, legt einen Firmen-Ordner auf dem Desktop an und macht den Rechner zum systemweiten Diktiergeraet: globaler Hotkey, sprechen, lokale Transkription per whisper.cpp, Ergebnis per Zwischenablage und simuliertem Cmd/Strg+V in die fokussierte Fremd-App. Der Markenkern des Auftraggebers, eines ISO-42001/27001 Senior Lead Auditors, lautet "Beleg statt Behauptung". Dieses Dokument haelt diesen Massstab auch an sich selbst an: jede tragende Behauptung ist entweder belegt oder als offene, vor der Umsetzung zu klaerende Annahme markiert.

> ## So nutzt eine andere Session dieses Dokument
> 
> Dieses Dokument ist der vollstaendige, umsetzungsreife Bauplan. Arbeite es so ab:
> 
> - **Meilenstein fuer Meilenstein, sequenziell.** Beginne bei M0 und gehe der Reihe nach vor. Ueberspringe M1 (Architektur-Spike) unter keinen Umstaenden: Er entscheidet ueber die gesamte Machbarkeit. Die drei Projektbrecher-Risiken (Whisper-Prozessmodell, npm-v12-Binary-Bezug, macOS-TCC-Persistenz) muessen dort geklaert werden, bevor auch nur eine Zeile Produktcode entsteht.
> - **Definition of Done pruefen.** Kein Meilenstein gilt als fertig, bevor jeder Punkt seiner Definition of Done nachweisbar erfuellt ist. "Nachweisbar" heisst: reproduzierbarer Test, Screenshot, Log oder Portscan, nicht eine Zusicherung im Code-Kommentar.
> - **Kein Cloud/KI-Dienst zur Laufzeit, fuer gar nichts.** Der einzige je erlaubte externe Request ist der einmalige Modell-Download im First-Run gegen huggingface.co (und dieser wird durch Offline-Vendoring zum Ausnahmefall degradiert). Jede andere ausgehende Verbindung ist ein Fehler und bricht den DSGVO-Beweis.
> - **Stil-Regeln.** Deutsch, echte Umlaute (ae/oe/ue/ss ist verboten, ausser in Code, Paketnamen und Pfaden). Keine Gedankenstriche als Satzzeichen (nutze Kommas, Doppelpunkte, Punkte). Praezise, tief, konkret. Fehlermeldungen sind deutsch und nennen den naechsten Schritt.
> - **Ehrlichkeit vor Eleganz.** Wo ein "beweisbar"-Claim nicht mit exakt einer reproduzierbaren Pruefung hinterlegt werden kann, wird er ehrlich abgeschwaecht (Beispiel: "RAM-only, mit der bekannten Restdimension Swap/Crash-Dump"). Ueberclaiming ist bei diesem Auftraggeber der einzige unverzeihliche Fehler.
> - **Ablage.** Es existiert noch kein VoiceWall-Repo. Es ist unter `/Users/larszimmermann/Documents/GitHub/voicewall/` neu anzulegen. Das aktuelle Verzeichnis `der-ki-auditor` ist das Website-Repo und darf nicht vermischt werden.

**Kern-Prinzipien:**

- **Lokal und beweisbar.** Alles laeuft auf dem Kundenrechner. Der Beweis (Netzwerk-Tab, Portscan, Offline-Betrieb, SBOM) ist Teil des Produkts, nicht nur des Marketings.
- **Compilerfrei vor Ort.** Kein Rust, kein node-gyp, kein Xcode CLT, keine VS Build Tools. Nur prebuilt native Bausteine und ein prebuilt Electron-Binary. Das gesamte Prozessmodell haengt an dieser Bedingung und wird empirisch dagegen abgesichert.
- **Sicherheit und Qualitaet ab Tag 0.** STRIDE-Bedrohungsmodell, harte CSP, Pfad-Containment, Command-Injection-Abwehr, TypeScript strict, SBOM, Supply-Chain-Pinning. Nicht nachgeruestet, sondern Fundament.
- **Ordner als Datenbank.** Keine echte DB. Transkripte als portables Markdown mit Front-Matter, ableitbares Manifest, Backup durch simples Kopieren. Die Daten ueberleben das Produkt.
- **Resilienz ueber Bequemlichkeit.** Der Clipboard-Fallback, das Offline-Vendoring und echtes Code-Signing sind keine Kuer, sondern die Absicherung gegen die realen Bruchstellen beim Kunden vor Ort.

**Inhaltsverzeichnis:**

1. Architektur und Projekt-Setup (Runtime Electron, Repo-Struktur, Tech-Stack, Qualitaetsstandards, Teststrategie, CI, Release, Lizenzen)
2. STT-Engine und systemweites Diktat (Audio-Aufnahme, whisper.cpp ohne On-Site-Compile, VAD und Latenz, globaler Hotkey, Auto-Paste, Modellauswahl, lokale Nachbearbeitung, Fehlerbehandlung)
3. Sicherheit und Datenschutz by Design (STRIDE, Loopback-Server, CSP als Exfiltrations-Beweis, Sanitisierung, Input/Output-Encoding, kein Telemetrie, RAM-only, Supply-Chain, Lizenzen, EU-AI-Act, DSGVO, DDG-Rechtstexte, sichere Defaults)
4. Installer, First-Run-Wizard und Ordner-Datenmodell (Bootstrap-Skript, Wizard-Flow, Ordner-Anlage, Ordner-als-DB-Schema, Konfig, Mehr-Firmen, Backup und Export, Verwaltungs-UI)
5. Umsetzungs-Roadmap (Meilensteine M0 bis M9 mit Ziel, Aufgaben, Definition of Done, Aufwand)
6. Risikoregister (18 Risiken mit Wahrscheinlichkeit, Wirkung, Gegenmassnahme)
7. Empfehlungen: sauberer und sicherer geloest, und was noch fehlt (priorisierte Korrekturen aus der Kritik-Runde)


> **Nachtrag nach M1-Spike (2026-07-03, verbindlich, Details in `docs/M1-SPIKE-ERGEBNIS.md`):**
> Der Architektur-Spike ist abgeschlossen. Die drei Projektbrecher-Fragen sind empirisch entschieden:
> 1. **Prozessmodell: utilityProcess (Option B).** `@fugood/whisper.node@1.0.22` laedt und transkribiert in Electron 43.0.0 ohne electron-rebuild sowohl im Main-Prozess als auch im utilityProcess (mac-arm64, Metal aktiv). utilityProcess gewaehlt wegen empirisch belegter Crash-Isolation (reproduzierbarer nativer SIGTRAP via `JSON.stringify(getModelInfo())` toetet im Main-Prozess die ganze App, im utilityProcess nur das Kind) bei null Performance-Nachteil.
> 2. **N-API bestaetigt:** napi_versions [6], 58 napi_-Symbole, 0 V8/nan-Symbole in der echten .node-Datei. Kein Compiler noetig.
> 3. **Binary-Bezug bestaetigt:** Registry-optionalDependencies mit os/cpu-Gate, Subpaket ohne scripts-Feld, `npm ci --ignore-scripts` liefert die .node trotzdem. Skriptverbotsfest.
> 4. **TCC/Ad-hoc-Signing:** Designated Requirement einer Ad-hoc-Signatur ist der cdhash, NICHT die Bundle-ID. Jeder Rebuild bricht nachweislich die TCC-Identitaet. Re-Grant-Schritt pro Update einplanen; Developer-ID-Entscheidung nach manuellem TCC-Test mit Lars.
> 5. **Latenz M1 Max:** konstant ca. 1,2 bis 1,4 s pro VAD-Segment (Encoder auf 30-s-Fenster dominiert), Realtime-Faktor 2,2x bis 7,2x, Modell-Load ca. 300 ms. Windows-Schwachhardware bleibt offene Messluecke, Fallback-Modelle ggml-small/base (ggerganov/whisper.cpp) benannt.
> 6. **API-Korrekturen zu Abschnitt 2:** Die Option `no_timestamps` existiert nicht; Optionen sind camelCase (`language`, `temperature`, `beamSize`, ...); VAD-Optionen `minSpeechDurationMs` usw.; `transcribeData` erwartet 16-bit-PCM-ArrayBuffer; das npm-Paket liefert keine funktionierende index.d.ts, eigene Typdeklaration noetig. Niemals Napi-Rueckgabeobjekte serialisieren oder clonen.
> 7. **Modell-Checksummen (R14, gegen HF-LFS-OID quergecheckt):** Q5_0 `15e92e3db0993c52fffa781513eec9253475331c1be808f8fb409285c9d9d030` (574.041.195 Bytes), Silero-VAD v5.1.2 `29940d98d42b91fbd05ce489f3ecf7c72f0a42f027e4875919a28fb4c04ea2cf` (885.098 Bytes).

## 1. Architektur & Projekt-Setup

Dieser Abschnitt ist die verbindliche Grundlage für alle folgenden Abschnitte der ABARBEITUNG.md. Er legt Runtime, Architektur, Repo-Struktur, Tech-Stack, Qualitätsstandards, Teststrategie, CI und Release-Prozess so fest, dass eine andere Session ohne Rückfragen weiterbauen kann. Leitprinzip durchgängig: **Beleg statt Behauptung.** Jede DSGVO-Aussage muss architektonisch beweisbar sein (0 externe Requests im Betrieb, Loopback-Bindung, keine Telemetrie), nicht nur behauptet.

### 1.1 Finale Runtime-Empfehlung: Electron

**Entscheidung: Electron als App-Shell.** Nicht reiner Node-Server plus Fremd-Browser, nicht Tauri. Die Begründung ergibt sich direkt aus dem Geschäftsmodell (Lars führt ein Quellcode-Repo einmalig vor Ort für 49 EUR aus, Kunde ist Nicht-Techniker, kein Internet-Vertrieb eines Binaries) und aus der harten Prioritätenliste (kein schwerer Compiler on-site, Sicherheit ab Tag 1, systemweites Diktat, 100 Prozent lokal).

Ehrliche Tradeoff-Tabelle für das On-Site-49-EUR-Modell:

| Kriterium (Gewicht fürs Modell) | Node-Server + Fremd-Browser | **Electron (gewählt)** | Tauri |
|---|---|---|---|
| **Compiler-Freiheit on-site** (K.-o.-Kriterium) | Gegeben, wenn alle natives prebuilt sind. `npm ci` reicht. | Gegeben. Electron-Binary ist prebuilt (kein Compiler), `globalShortcut`/`clipboard`/`BrowserWindow` sind eingebaut, brauchen kein Native-Addon. | **Verletzt.** Rust-Toolchain (rustc >= 1.77) plus OS-Buildtools (macOS Xcode CLT, Windows MSVC) zwingend, `cargo build` kompiliert die App beim Kunden. Sofort disqualifiziert. |
| **Systemweites Diktat (Auto-Paste, Fokus-Erhalt)** | Der schwächste Punkt. Auto-Paste in die fokussierte Fremd-App braucht ohnehin OS-Scripting oder Native-Automation. Auf macOS bekommt terminalgestarteter, unsignierter Node **keine stabilen TCC-/Accessibility-Rechte** (keine feste Bundle-ID), Kernfeature wird unzuverlässig. | **Robust.** Echte `.app`/`.exe` mit stabiler Bundle-ID, dadurch hält macOS-TCC die einmal erteilte Accessibility-Berechtigung über Neustarts. `clipboard.writeText()` eingebaut, Paste per `osascript`/PowerShell aus dem Main-Prozess. | Technisch ok (Paste per OS-Scripting oder `enigo`-Crate), aber alles im Rust-Build. |
| **Globaler Hotkey** | Braucht `node-global-key-listener` (Subprozess, `sudo-prompt`, rechteintensiv, fragil). | **Eingebaut:** `globalShortcut.register()`, appübergreifend ohne Fokus. Sauberste Lösung. | `tauri-plugin-global-shortcut` (Rust), Teil des Builds. |
| **Sicherheitsfläche** | Offener localhost-Port, den jeder lokale Prozess/Tab erreicht. Muss hart an 127.0.0.1 gebunden, Origin-gecheckt, Token-geschützt werden. Zusätzliche vermeidbare Angriffsfläche. | Kein offener HTTP-Port nötig, IPC statt HTTP. `contextIsolation:true`, `nodeIntegration:false`, harte CSP. Chromium ist groß, aber ohne externe Requests beherrschbar. | Kleinste Fläche (System-WebView statt Chromium), aber WebView-Versionen variieren je Kunde: Kompatibilitätsrisiko bei heterogener Kundenhardware. |
| **On-Site-Install-Friktion** | Am geringsten (`npm ci` + `node server.js`). | Gering. `npm install electron` lädt ein fertiges Prebuilt-Binary, kein Compiler. | Hoch (Rust plus Buildtools). |
| **Download-/Footprint** | Kleinster. | Groß (~150 bis 250 MB Chromium), bei lokalem Einmal-Install aber irrelevant. | App klein (~5 bis 15 MB), aber Build-Umgebung riesig. |
| **Wartbarkeit (JS-nativer Stack, Claude-Code-Stack)** | Mittel: zwei Prozesse plus Fremd-Browser, uneinheitliches Lifecycle. | Hoch: ein Framework, eine Sprache (TS), ein Prozessmodell, riesiges Ökosystem. | Mittel: Zwei-Sprachen-Projekt (Rust + JS), jede native Funktion lebt in Rust. |
| **Signing fürs Quellcode-/Lokal-Build-Modell** | Problematisch (unsignierter Node bekommt keine stabilen TCC-Grants). | **Lösbar per Ad-hoc-Codesign** (`codesign -s -`) mit fester `CFBundleIdentifier` beim lokalen Build. Keine Apple Developer ID, keine Notarisierung nötig, da kein Internet-Vertrieb (kein `com.apple.quarantine` bei lokal gebautem/kopiertem Bundle). | Ähnlich ad-hoc signierbar, aber Rust-Build-Aufwand überwiegt. |

**Fazit:** Electron ist die einzige Option, die alle drei harten Kernanforderungen gleichzeitig erfüllt: (1) compilerfreie On-Site-Installation (prebuilt Electron-Binary plus prebuilt whisper-Addon), (2) zuverlässiges, fokuserhaltendes systemweites Diktat mit stabilen macOS-Berechtigungen über eine feste Bundle-ID, (3) 100 Prozent lokal ohne offenen Netzwerk-Port. Tauri scheidet an Prio 1 aus (Rust-Toolchain beim Kunden). Reiner Node plus Fremd-Browser bleibt ausschließlich als dokumentierter Fallback-Pfad relevant, falls Electron auf einer exotischen Zielmaschine partout scheitert, nie als Primärarchitektur.

Wichtige Randbedingung, die die Architektur unten prägt: whisper.cpp läuft als prebuilt N-API-Addon (`@fugood/whisper.node`, Details in Abschnitt whisper) und wird **ausschließlich im Main- bzw. `utilityProcess` geladen, nie im Renderer**. Auto-Paste erfolgt OS-nativ (`osascript`/PowerShell) als Primärpfad, `@nut-tree-fork/nut-js` (Apache-2.0, prebuilt, kein Install-Skript) nur als optionaler Fallback.

### 1.2 High-Level-Architektur

VoiceWall ist ein Electron-Programm mit drei Prozess-Ebenen: **Main-Prozess** (Orchestrierung, Betriebssystem-Integration, Whisper-Inferenz im `utilityProcess`), **Renderer** (die Wizard- und Verwaltungs-UI in einem `BrowserWindow`), und ein verstecktes **Audio-Capture-Fenster** (nur Web-Audio, liefert rohes PCM). Kommunikation ausschließlich über Electron-IPC (kein HTTP-Server, kein offener Port). Persistenz ist der Firmen-Ordner auf dem Desktop (Dateien als Datenbank), plus ein App-Support-Ordner für Modelle und Konfig.

Verantwortlichkeiten je Komponente:

- **Main-Prozess (`src/main/`)**: Fenster-Lifecycle, `globalShortcut`-Registrierung, `clipboard`-Zugriff, Start/Stop der Aufnahme, Steuerung des Whisper-`utilityProcess`, Aufruf des OS-Paste-Moduls, First-Run-Erkennung, Ordner-Anlage, Konfig-Lesen/Schreiben, lokales Logging. Der Main-Prozess ist die einzige Vertrauens-Instanz, die Dateisystem und OS-APIs berührt.
- **Whisper-Engine (`src/main/whisper/`, im `utilityProcess`)**: Lädt das GGML-Modell einmalig in den RAM, nimmt PCM-ArrayBuffer entgegen (`transcribeData`, RAM-only, nie auf Platte), macht VAD-Segmentierung (Silero-ggml), liefert Text zurück. Isoliert, damit ein Absturz der Inferenz nicht das UI mitreißt.
- **Hotkey/Paste-Modul (`src/main/paste/`)**: Kapselt plattformspezifisches Einfügen. macOS: `osascript` `keystroke "v" using command down`. Windows: PowerShell `SendKeys ^v` (prozess-scoped `-ExecutionPolicy Bypass`). Klar getrennte Adapter je Plattform hinter einem Interface `PasteAdapter`. Fallback-Adapter `@nut-tree-fork/nut-js` optional, hinter demselben Interface.
- **Audio-Capture (`src/renderer/audio/`, verstecktes Fenster)**: `getUserMedia({audio:{channelCount:1}})` plus AudioWorklet mit `AudioContext({sampleRate:16000})`, defensives Resampling auf 16 kHz mono Int16-PCM, schiebt Chunks per IPC an den Main-Prozess. Nichts auf Platte.
- **UI/Renderer (`src/renderer/`)**: First-Run-Wizard (Firmendaten) und Verwaltungs-Oberfläche (Liste, Suche, Tags, Export der Transkript-Dateien). `contextIsolation:true`, `nodeIntegration:false`, Zugriff auf Main nur über eine schmale, getypte Preload-Bridge.
- **Ordner-Speicher (`src/main/storage/`)**: Ordner-als-Datenbank. Transkripte/Notizen als Markdown plus JSON-Sidecar (Metadaten, Tags) im Firmen-Ordner. Keine echte DB. Alle Schreibvorgänge idempotent und containment-geprüft (aufgelöster Pfad muss unter dem Firmen-Basisordner liegen).

Datenfluss Diktat (der Kernpfad):

```
 [Globaler Hotkey]                                   Main-Prozess
        |                                          (globalShortcut)
        v                                                |
  Aufnahme START ------------------ IPC ------------------+
        |                                                 |
        v                                                 v
 [Audio-Capture-Fenster]                          [utilityProcess: Whisper]
  getUserMedia(mono)                                      |
  AudioWorklet @16kHz                                     |
  -> Int16-PCM-Chunks                                     |
        |                                                 |
        |  PCM-Chunks (RAM, ArrayBuffer)                  |
        +---------------- IPC --------------------------->|
                                                          |
                                          Silero-VAD (ggml): Sprachende?
                                                          |
                                                 Segment -> transcribeData
                                                 (language:'de', temp:0,
                                                  no_timestamps:true)
                                                          |
                                                     Text (String)
                                                          |
                              +--------------- IPC -------+
                              v
                     Main-Prozess:
                     clipboard.writeText(text)
                              |
                              v
                     [Paste-Adapter]
              macOS: osascript keystroke "v" (Cmd)
              win:   PowerShell SendKeys ^v
                              |
                              v
              ==> Text erscheint in fokussierter
                  Fremd-App (Word/Outlook/Browser)

 Parallel (optional, wenn Nutzer speichert):
   Text -> storage/ -> Firmen-Ordner/YYYY-MM-DD_HHMM.md
                       + .meta.json (Tags, Dauer, Modell)

 NETZWERK: 0 externe Requests im Betrieb.
 Einziger je erlaubter Netzzugriff: First-Run-Modell-Download
 (huggingface.co) im Wizard, danach nie wieder.
```

Der Beweis-Punkt für DSGVO: Nach dem First-Run (Modell und VAD gecacht, Checksumme geprüft) zeigt der DevTools-Network-Tab im laufenden Betrieb null externe Requests. Es gibt keinen HTTP-Server, nur IPC. Das ist auditierbar und Teil der Definition of Done.

### 1.3 Repo- und Ordnerstruktur (Monorepo: nein)

**Kein Monorepo.** Ein einzelnes, überschaubares Repo mit einem `package.json`. VoiceWall ist ein Produkt mit einer Codebasis, kein Paket-Verbund. Ein Monorepo (Workspaces, Turborepo, pnpm-Workspaces) würde nur Komplexität und zusätzliche Install-Skript-Fläche einführen, ohne Nutzen. Die Trennung Main/Renderer/Shared erfolgt über Ordner und getrennte tsconfig-Projektreferenzen, nicht über separate npm-Pakete.

Dateibaum mit Kommentaren:

```
voicewall/
├─ package.json                # 1 Manifest; type:module; engines.node gepinnt;
│                              # allowScripts-Freigabeliste minimal (npm v12)
├─ package-lock.json           # committet; npm ci verifiziert Integritaets-Hashes
├─ tsconfig.json               # Basis: strict:true, Projektreferenzen
├─ tsconfig.main.json          # Main-Prozess (Node/Electron-Main-Target)
├─ tsconfig.renderer.json      # Renderer (DOM-Target)
├─ electron.vite.config.ts     # electron-vite: baut main/preload/renderer
├─ eslint.config.js            # Flat-Config, typed-linting
├─ .prettierrc                 # Formatierung
├─ vitest.config.ts            # Unit/Integration
├─ playwright.config.ts        # E2E gegen die gebaute Electron-App
├─ CHANGELOG.md                # Keep-a-Changelog, aus Conventional Commits
├─ LICENSE                     # VoiceWall-Lizenz (siehe 1.9)
├─ NOTICE                      # Attribution (Apache-2.0-Modell etc.)
├─ THIRD_PARTY_LICENSES.md     # MIT/Apache-Texte aller Abhaengigkeiten
├─ README.md                   # Kurzbeschreibung + Review-then-run-Hinweis
├─ ABARBEITUNG.md              # dieses Dokument
│
├─ scripts/                    # Bootstrap / On-Site-Install
│  ├─ setup.sh                 # macOS/Linux: set -euo pipefail; Node-Check,
│  │                           # npm ci --offline, Ad-hoc-Codesign, Start
│  ├─ setup.ps1                # Windows: $ErrorActionPreference='Stop';
│  │                           # Set-StrictMode; -Scope Process Bypass
│  ├─ uninstall.sh / .ps1      # entfernt nur ~/.voicewall/, laesst Firmendaten stehen
│  ├─ verify-checksums.mjs     # SHA-256 gegen fest hinterlegte Erwartungswerte
│  └─ codesign-adhoc.sh        # codesign -s - mit fixer CFBundleIdentifier
│
├─ resources/
│  ├─ icons/                   # App-Icons (mac .icns, win .ico)
│  ├─ Info.plist.additions     # NSMicrophoneUsageDescription (macOS TCC!)
│  └─ model-manifest.json      # Modell-URLs + erwartete SHA-256 (auditfest)
│
├─ src/
│  ├─ main/                    # ELECTRON MAIN-PROZESS (Vertrauensgrenze)
│  │  ├─ index.ts              # App-Bootstrap, Fenster, App-Lifecycle
│  │  ├─ ipc/                  # getypte IPC-Handler (ein Modul je Kanal)
│  │  │  ├─ channels.ts        # zentrale Kanal-Enums + Payload-Typen (shared)
│  │  │  └─ handlers.ts
│  │  ├─ hotkey/
│  │  │  └─ globalShortcut.ts  # register/unregister, Konflikt-Handling
│  │  ├─ whisper/
│  │  │  ├─ engine.ts          # laeuft im utilityProcess; initWhisper/transcribeData
│  │  │  ├─ vad.ts             # Silero-ggml Segmentierung
│  │  │  └─ engine.worker.ts   # utilityProcess-Entry
│  │  ├─ paste/
│  │  │  ├─ index.ts           # PasteAdapter-Interface + Plattform-Dispatch
│  │  │  ├─ macos.ts           # osascript keystroke "v" using command down
│  │  │  ├─ windows.ts         # PowerShell SendKeys ^v
│  │  │  └─ fallback-nutjs.ts  # optional @nut-tree-fork/nut-js
│  │  ├─ storage/
│  │  │  ├─ paths.ts           # Desktop-Pfad plattformrobust, Containment-Check
│  │  │  ├─ company-folder.ts  # idempotente Ordner-Anlage
│  │  │  ├─ transcripts.ts     # Markdown + .meta.json lesen/schreiben/suchen
│  │  │  └─ sanitize.ts        # sanitize-filename + NFC + Windows-Reserved
│  │  ├─ config/
│  │  │  └─ config.ts          # JSON-Konfig, 0600-Rechte, Schema-Validierung (zod)
│  │  ├─ model/
│  │  │  └─ downloader.ts      # First-Run-Download, Range/Resume, SHA-256-Check
│  │  └─ logging/
│  │     └─ logger.ts          # lokales Log OHNE Transkript-Inhalte, Rotation
│  │
│  ├─ preload/
│  │  └─ index.ts              # contextBridge: schmale, getypte API an Renderer
│  │
│  ├─ renderer/                # UI (kein Node-Zugriff)
│  │  ├─ index.html
│  │  ├─ main.tsx              # React-Root
│  │  ├─ audio/
│  │  │  ├─ capture.ts         # getUserMedia + AudioWorklet-Steuerung
│  │  │  └─ pcm-worklet.ts     # AudioWorklet: 16kHz mono Int16-PCM
│  │  ├─ wizard/               # First-Run: Firmendaten, Modell-Download-UI,
│  │  │                        # macOS-Accessibility-Erklaerung
│  │  ├─ manage/               # Liste, Suche, Tags, Export
│  │  └─ components/           # UI-Bausteine
│  │
│  └─ shared/                  # von main UND renderer importierbar, KEIN Node/DOM
│     ├─ types.ts              # Domaenentypen (Transcript, CompanyConfig, ...)
│     ├─ schema.ts             # zod-Schemas (Konfig, IPC-Payloads)
│     └─ result.ts             # Result<T,E>-Typ fuer Fehlerbehandlung
│
└─ tests/
   ├─ unit/                    # sanitize, paths/containment, config-schema, vad-logik
   ├─ integration/             # storage roundtrip, whisper-engine gegen kurzes WAV
   └─ e2e/                     # Playwright: Wizard-Flow, Diktat-Simulation
```

Modulgrenze als harte Regel: `src/shared/` darf weder Node- noch DOM-APIs importieren (nur reine TS-Typen und -Logik). `src/renderer/` darf niemals `fs`, `child_process` oder native Addons importieren, jeglicher Zugriff auf OS/Dateisystem läuft über die Preload-Bridge in den Main-Prozess. ESLint-Regeln (`no-restricted-imports`, boundaries) erzwingen das (siehe 1.5).

### 1.4 Tech-Stack mit Versionen

Versionen sind Mindeststände zum Recherchestand Juli 2026, im Lockfile exakt zu pinnen. Auswahl konsequent nach: compilerfrei, prebuilt, aktiv gepflegt, JS-nativ, minimale Install-Skript-Fläche.

| Baustein | Wahl | Version | Begründung |
|---|---|---|---|
| Sprache | **TypeScript, `strict:true`** | ^5.6 | Typsicherheit ab Tag 1, ein Sprachraum für Main/Renderer/Shared. |
| Runtime/Shell | **Electron** | aktuelle Stable-Linie (>= 32) | Prebuilt-Binary, `globalShortcut`/`clipboard`/`BrowserWindow`/`Tray`/`utilityProcess` eingebaut, kein Compiler. |
| Node (gebündelt) | portable Node | LTS, `engines` gepinnt | Bootstrap bringt Node nach `~/.voicewall/runtime/`, prozesslokaler PATH, kein Admin, kein Systemeingriff. |
| Build-Tool | **electron-vite** | ^2 | Baut Main + Preload + Renderer in einem Config-Schritt, schnelles HMR im Renderer, TS-nativ, kein eigener Compiler-Bedarf. |
| Bundler (intern) | Vite/esbuild | via electron-vite | esbuild ist prebuilt, kein node-gyp. |
| UI-Framework | **React** | ^18 | Reifstes Ökosystem, passt zum bestehenden KI-Auditor-Web-Stack (Wiederverwendbarkeit von Wissen/Komponenten-Denken), gute Testbarkeit. |
| UI-Styling | Tailwind + wenige Radix-Primitiven | Tailwind ^3, Radix aktuell | Kein Heavy-Component-Framework nötig; barrierearme Primitiven für Dialog/Listbox, sonst eigene schlanke Komponenten. Genau eine sichtbare H1 je Ansicht (Konsistenz mit Lars-Standard). |
| Whisper-Wrapper | **`@fugood/whisper.node`** | ^1.0.22 | Prebuilt `.node` via optionalDependencies, `postinstall` `check.js` macht `exit(0)` ohne Compiler, `transcribeData` nimmt PCM-ArrayBuffer (RAM-only), MIT. Im `utilityProcess` laden. |
| Whisper-Fallback | `@kutalia/whisper-node-addon` | 1.1.0 | Prebuilt, PCM+VAD, „experimental", nur falls fugood ABI-Probleme in der Ziel-Electron-Version zeigt. |
| DE-Modell | `cstr/whisper-large-v3-turbo-german-ggml`, **Q5_0** | `ggml-model-q5_0.bin` (574 MB) | Apache-2.0, DE-optimiert, Sweet-Spot Genauigkeit/Latenz. fp16 (1,62 GB) optional als „max. Genauigkeit". First-Run-Download mit SHA-256-Check. |
| VAD | Silero ggml `ggml-silero-v5.1.2.bin` | <1 MB, MIT | Von `ggml-org/whisper-vad`, via `initWhisperVad`. |
| Clipboard | Electron `clipboard` (eingebaut) | n. v. | Kein Extra-Paket im Electron-Pfad. |
| Auto-Paste | OS-nativ `osascript`/PowerShell via `child_process` | n. v. | Null zusätzliche native Dep, auditierbare OS-Aufrufe. |
| Auto-Paste-Fallback | `@nut-tree-fork/nut-js` + `@nut-tree-fork/libnut-*` | 4.2.6 / 2.7.5 | Apache-2.0, prebuilt `.node`, **kein** Install-Skript. NICHT das kostenpflichtige `@nut-tree/nut-js`. Nur bei Bedarf. |
| Konfig-/Payload-Validierung | **zod** | ^3 | Schema-Validierung für Konfig und IPC-Payloads, defensive Programmierung gegen manipulierte Konfig (Containment). |
| Dateinamen-Sanitisierung | `sanitize-filename` | aktuell | Referenz für Steuerzeichen, reservierte Namen, trailing dots/spaces. Ergänzt um eigene Containment-Prüfung. |
| Browser-Öffnen (nur Fallback-Node-Pfad) | `open` (sindresorhus) | aktuell | Nur relevant, falls je der Node-Fallback greift; im Electron-Pfad nicht nötig. |
| Logging | eigener schlanker Logger | n. v. | Kein schweres Log-Framework, keine Telemetrie, lokal, ohne Inhalte. |

Bewusst NICHT im Stack: kein Rust/Tauri (Prio 1), kein `robotjs` (tot), kein `smart-whisper`/`nodejs-whisper` (kompilieren zur Install-Zeit), kein `@nut-tree/nut-js` (Abo + Redistribution verboten), keine echte DB, kein HTTP-Server, keine Cloud-/KI-API zur Laufzeit.

### 1.5 Code-Qualitäts-Standards ab Tag 1

- **TypeScript strict maximal.** `strict:true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Kein `any` (ESLint `@typescript-eslint/no-explicit-any` als Error, `no-unsafe-*` an). Externe, ungetypte Daten (JSON-Konfig, IPC-Payload, Modell-Manifest) werden am Rand mit zod geparst, danach existiert im Code nur der validierte Typ.
- **ESLint (Flat-Config) plus Prettier.** Typed-Linting (`parserOptions.project`). Prettier ausschließlich für Formatierung, ESLint für Korrektheit, kein Regel-Overlap. `eslint-plugin-import` bzw. Boundary-Regeln erzwingen die Modulgrenzen aus 1.3: `src/renderer/**` darf `fs`/`child_process`/native Addons nicht importieren (`no-restricted-imports`), `src/shared/**` darf weder Node- noch DOM-Globals nutzen. Verstoß = CI rot.
- **Fehlerbehandlungs-Philosophie.** Erwartbare Fehler (Modell-Download fehlgeschlagen, Checksumme falsch, Ordner existiert, Mikrofon verweigert, Accessibility fehlt) werden als Werte modelliert (`Result<T,E>` in `src/shared/result.ts`), nicht als geworfene Exceptions durch die halbe Codebasis geschleift. Nur wirklich unerwartete Zustände werfen. Jeder externe OS-/`child_process`-Aufruf prüft Exit-Code. Fehlermeldungen sind deutsch, konkret, mit nächstem Schritt (Lars steht daneben, muss aber eindeutig sein). IPC-Handler fangen jeden Fehler ab und geben ein typisiertes Fehlerergebnis an den Renderer zurück, nie ein rohes Stack-Leak.
- **Lokales Logging ohne Inhalte.** Der Logger schreibt nur nach `~/.voicewall/logs/` (rotiert). **Niemals** Transkript-Text, Audio, Firmendaten-Freitext oder Zwischenablage-Inhalte. Erlaubt sind: Zeitstempel, Ereignistyp, Modellname/-version, Dauer, Segmentanzahl, Fehlercodes, verwendete Versionen/Checksummen (als „Beleg statt Behauptung", passend zur SBOM-Idee). Ein Unit-Test prüft, dass Log-Aufrufe keine als „sensibel" markierten Felder enthalten.
- **Konfig-Management.** Genau eine Konfig-Quelle: `~/.voicewall/config.json` (App-Ebene, Modellpfad, Sprache) plus die firmenbezogene Konfig im Firmen-Ordner. Beim Lesen immer zod-validieren, Containment-Regel erneut anwenden (eine manipulierte Konfig darf keinen Pfad außerhalb des Basisordners erzwingen). Restriktive Rechte (`0600` Datei, `0700` Ordner) unter POSIX. Keine Secrets (VoiceWall ist lokal, keine API-Keys), das ist selbst ein DSGVO-Vorteil.
- **Sicherheits-Defaults Electron.** `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true` wo möglich, kein `@electron/remote`, harte CSP im Renderer (nur `self`, keine externen Origins), Preload exponiert eine minimale getypte API. `webSecurity` an. Kein `shell.openExternal` mit dynamischem Input.

### 1.6 Teststrategie

Testpyramide, alles lokal und offline lauffähig:

- **Unit (Vitest).** Reine Logik ohne OS: `sanitize.ts` (inkl. Path-Traversal `../` und `..\`, Windows-Reserved `CON`/`NUL.txt`, trailing dots/spaces, Unicode-NFC), `paths.ts` Containment-Prüfung (aufgelöster Pfad unter Basis), `config`/`schema` zod-Validierung inkl. bewusst manipulierter Eingaben, VAD-Schwellwert-Logik, Result-Typ, Logger-Redaction (keine sensiblen Felder). Diese Klasse hat den größten Testwert, weil hier die Sicherheitslogik sitzt.
- **Integration (Vitest).** Storage-Roundtrip (Transkript schreiben, wiederfinden, Tags, Export) gegen ein temporäres Verzeichnis. Whisper-Engine gegen ein kurzes, im Repo eingechecktes deutsches Test-WAV: prüft, dass `transcribeData` einen plausiblen deutschen Text liefert (Toleranz-Assertion auf Schlüsselwörter, nicht auf exakten String, da nichtdeterministisch). Modell-Downloader gegen einen lokalen Fixture-Server, um SHA-256-Match und Mismatch-Abbruch zu testen (kein echter HF-Zugriff in Tests).
- **E2E (Playwright for Electron).** Gegen die gebaute App: First-Run-Wizard-Flow (Firmendaten eingeben, Ordner wird auf Desktop-Fixture angelegt, Konfig geschrieben), Verwaltungs-UI (Liste/Suche/Export), und ein Diktat-Smoke-Test mit gemocktem Audio-Input (vorgefertigter PCM-Puffer statt echtem Mikrofon), der prüft, dass am Ende `clipboard` den erwarteten Text hält. Der reale OS-Paste-Schritt (`osascript`/SendKeys in Fremd-App) wird in CI **nicht** ausgeführt (Headless, keine Fremd-App, keine Accessibility-Grants), sondern der Paste-Adapter wird gemockt und der Aufruf verifiziert; der echte Paste-Pfad wird manuell in einer dokumentierten Abnahme-Checkliste auf macOS und Windows geprüft.
- **Deterministik-Regel.** Kein Test darf Netzwerk brauchen. Modell- und HF-Zugriffe sind in Tests immer gefixtured. Das ist zugleich der Beleg, dass die Codebasis offline funktioniert.

### 1.7 CI (GitHub Actions)

Pipeline auf jeden Push und PR, Matrix `ubuntu-latest`, `macos-latest`, `windows-latest` (damit plattformspezifische Paste-/Pfad-Logik früh bricht). Schritte in Reihenfolge, jeder Fehler bricht ab (entspricht Lars-Regel „lint && test && build && audit" vor jedem Push):

1. `actions/setup-node` mit gepinnter Node-Version aus `engines`.
2. `npm ci` (verifiziert Integritäts-Hashes gegen `package-lock.json`, installiert prebuilt natives passend zur Matrix-Plattform, **niemals** `--omit=optional`/`--no-optional`, sonst fehlt das fugood-Binary).
3. `npm run typecheck` (`tsc --noEmit` über alle tsconfig-Projektreferenzen).
4. `npm run lint` (ESLint, inkl. Modulgrenzen-Regeln, `--max-warnings 0`).
5. `npm run format:check` (Prettier `--check`).
6. `npm run test` (Vitest Unit + Integration).
7. `npm run build` (electron-vite build, muss auf allen drei Plattformen grün sein).
8. `npm run test:e2e` (Playwright-Electron; nur auf macOS und Windows sinnvoll, mit gemocktem Audio/Paste).
9. `npm audit --audit-level=high` (Supply-Chain-Gate).
10. `npm sbom` (SBOM-Artefakt erzeugen und als Build-Artefakt hochladen, „Beleg statt Behauptung": nachweisbare Stückliste aller lokalen Komponenten).
11. Lockfile-Guard: `git diff --exit-code package-lock.json` (verhindert unbeabsichtigte Lockfile-Drift).

Zusätzlich ein separater, manuell auslösbarer Workflow für den lokalen Ad-hoc-Codesign-Build als Referenz (nicht für Vertrieb, da Auslieferung als Quellcode erfolgt).

### 1.8 Versionierung und Releases

- **SemVer.** MAJOR bei Bruch der Konfig-/Ordnerstruktur oder Modell-Inkompatibilität, MINOR für Features, PATCH für Fixes. Ausgangsversion `0.1.0` (Pre-Stable, bis der Diktat-plus-Verwaltungs-Kernpfad auf mac und win abgenommen ist), dann `1.0.0`.
- **Conventional Commits.** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:`, `perf:`. Deutsche Commit-Bodies erlaubt, Typ-Präfix englisch (Tooling-Konvention). BREAKING CHANGE im Footer erzwingt MAJOR.
- **CHANGELOG.md** im Keep-a-Changelog-Format, aus den Conventional Commits generiert/gepflegt. Jede Version dokumentiert insbesondere: Änderungen an Modellversion/-Checksumme, an der Ordnerstruktur, an der Konfig-Migration.
- **Release = getaggter Commit plus Quellcode-Zustand.** Kein Internet-vertriebenes Binary (das ist Kern des Modells). Ein Release ist ein sauberer, getaggter Repo-Stand, den Lars klont/kopiert und vor Ort per `scripts/setup.*` ausführt. Optional ein signiertes lokales App-Bundle als Abnahme-Referenz.

### 1.9 LICENSE und Attribution

- **VoiceWall-Eigencode:** proprietäre Lizenz (kommerzielles 49-EUR-Produkt, Inhaber Lars Zimmermann). Kein OSS-Zwang, da alle Abhängigkeiten MIT/Apache-2.0 sind (weitergabe- und kommerzfreundlich, keine Copyleft-Falle). Die genaue Lizenzformulierung stimmt Lars ab; Default-Vorschlag: „All rights reserved, Nutzungsrecht je erworbener On-Site-Installation".
- **THIRD_PARTY_LICENSES.md** enthält die vollständigen Lizenztexte: MIT (whisper.cpp/ggml-org, `@fugood/whisper.node` und Plattform-Binaries, Silero VAD, OpenAI-Whisper-Architektur, `clipboardy`/`open`/`sanitize-filename`), Apache-2.0 (`@nut-tree-fork/*`, falls eingebaut).
- **NOTICE** deckt die Apache-2.0-Pflichten des Modells ab: Attribution `primeline/whisper-large-v3-turbo-german`, Änderungshinweis (GGML/Q5_0-Konvertierung durch `cstr/whisper-large-v3-turbo-german-ggml`), Apache-2.0-Text und NOTICE des Finetunes. OpenAI-Whisper (MIT) nennen.
- **Auditfestigkeit:** Alle vier Lizenzklassen sind kommerziell weitergabe-tauglich, passend zum 49-EUR-On-Site-Vertrieb ohne Lizenzrisiko. Die SBOM (aus CI) plus THIRD_PARTY_LICENSES/NOTICE bilden zusammen den nachprüfbaren Lizenz-Beleg.

**Definition of Done für Abschnitt 1:** Repo initialisiert (nicht Monorepo), `package.json` mit gepinnter `engines`-Node, `strict`-tsconfig-Projektreferenzen, electron-vite-Build grün auf mac/win/linux, ESLint-Modulgrenzen aktiv und rot bei Verletzung, Vitest- und Playwright-Grundgerüst vorhanden, GitHub-Actions-Pipeline (typecheck/lint/format/test/build/e2e/audit/sbom/lockfile-guard) grün, `LICENSE`/`NOTICE`/`THIRD_PARTY_LICENSES.md` angelegt, leerer Electron-Shell-Start öffnet ein Fenster ohne offenen Netzwerk-Port (Beleg: kein `http`-Server im Code, IPC-only), und der DevTools-Network-Tab zeigt im Leerlauf null externe Requests.

Relevanter Pfad für die nächste Session: Es existiert noch **kein VoiceWall-Repo**. Es ist neu anzulegen, sinnvoll unter `/Users/larszimmermann/Documents/GitHub/voicewall/`. Das aktuelle Arbeitsverzeichnis `/Users/larszimmermann/Documents/GitHub/der-ki-auditor` ist das KI-Auditor-Website-Repo und darf nicht mit VoiceWall vermischt werden.

No existing repo, as the research already noted. The task is to produce the Section 2 text as the deliverable. This is a document section, so my final response is the literal Markdown content.


## 2. STT-Engine & systemweites Diktat

Dieser Abschnitt beschreibt das Herzstück von VoiceWall: die Kette von Mikrofon zu Text zu Fremd-App, komplett lokal, ohne Compiler beim Kunden, ohne einen einzigen externen Laufzeit-Request. Jede Entscheidung ist so getroffen, dass sie im DevTools-Netzwerk-Tab beweisbar ist (Beleg statt Behauptung). Die Bausteine sind gepinnt und prebuilt, damit die Vor-Ort-Installation in Sekunden und ohne Xcode CLT, VS Build Tools, Rust oder node-gyp durchläuft.

**Runtime-Verortung (gilt für alle Unterabschnitte):** Whisper, VAD, globaler Hotkey und das Paste laufen im Electron-**Main-Prozess** bzw. in einem `utilityProcess`, niemals im Renderer. Die Audio-Aufnahme läuft im Renderer (Web Audio), weil nur dort `getUserMedia`/AudioWorklet verfügbar ist. PCM wandert per `postMessage`/IPC in den Main-Prozess. Grund: native `.node`-Addons gehören nicht in den Renderer (Sandbox, `contextIsolation: true`, `nodeIntegration: false`), und die Berechtigungs-/TCC-Zuordnung braucht die stabile Bundle-ID der `.app`.

### 2.1 Audio-Aufnahme: 16 kHz Mono, RAM-only, Consent

**Zielformat:** 16-bit signed PCM, mono, 16 kHz, als `ArrayBuffer` im RAM. Das ist exakt das, was `@fugood/whisper.node` (`transcribeData`) und der Silero-VAD erwarten. Es wird zu keinem Zeitpunkt eine Audiodatei auf die Platte geschrieben. Das ist eine harte Architekturregel, kein Feature-Wunsch: Diktate sind potenziell personenbezogene/vertrauliche Sprachdaten, und der einzige belastbare DSGVO-Nachweis ist, dass Rohaudio nie persistiert wird.

**Aufnahmeweg (Electron, compilerfrei):**
1. Im Renderer (oder einem versteckten `BrowserWindow`) `navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`. Die drei DSP-Filter bewusst aus, weil sie bei Diktat die Whisper-Genauigkeit eher verschlechtern und Latenz kosten.
2. `AudioContext({ sampleRate: 16000 })` anlegen. Explizit 16 kHz erzwingen. Falls das Betriebssystem/der Browser 48 kHz erzwingt (kommt vor), wird im AudioWorklet-Prozessor defensiv auf 16 kHz resampled (lineare Interpolation reicht für Sprache).
3. Ein **AudioWorklet-Prozessor** empfängt Float32-Frames, rechnet auf Int16-PCM (Clamping auf [-1, 1], dann `* 32767`), und schiebt Chunks (z. B. alle 100 ms, ca. 1600 Samples) per `port.postMessage(transferable)` an den Main-Thread. Ein RAM-Ringpuffer im Main-Prozess sammelt die Chunks.
4. Der Main-Prozess füttert den Ringpuffer in VAD + Whisper (siehe 2.3). Nach der Transkription wird der Puffer verworfen (überschrieben/nullen), damit auch im RAM keine Diktat-Historie liegen bleibt.

**Warum AudioWorklet und nicht MediaRecorder:** MediaRecorder liefert komprimierte Container (webm/opus), die man erst dekodieren müsste. AudioWorklet gibt rohes PCM direkt, ideal für Whisper, garantiert RAM-only, keine Extra-Dekodier-Dependency.

**Electron-Fallstrick:** Das AudioWorklet-Modul muss als Blob-URL bzw. inline geladen werden, sonst findet `audioWorklet.addModule()` unter dem `file://`-Protokoll die Datei nicht (CSP-/Protokoll-Falle). Konkret: den Worklet-Code als String halten, `new Blob([code], {type:'application/javascript'})`, `URL.createObjectURL`, `addModule(blobUrl)`.

**Consent-/Berechtigungs-Flow:**
- **macOS (TCC):** Die App braucht `NSMicrophoneUsageDescription` in der `Info.plist` (deutscher Text, z. B. "VoiceWall nutzt das Mikrofon ausschließlich lokal für die Sprach-zu-Text-Umwandlung. Es werden keine Audiodaten übertragen oder gespeichert."). Fehlt der Key, schlägt `getUserMedia` **stillschweigend** fehl. Beim First-Run zusätzlich `systemPreferences.getMediaAccessStatus('microphone')` prüfen und bei `not-determined` proaktiv `systemPreferences.askForMediaAccess('microphone')` auslösen, damit der macOS-Dialog erscheint, solange Lars daneben steht.
- **Windows:** Mikrofon-Zugriff hängt an den Datenschutz-Einstellungen (Einstellungen, Datenschutz, Mikrofon, "Apps dürfen auf Mikrofon zugreifen"). Für Desktop-Apps meist erlaubt, aber im Wizard als Prüfschritt behandeln: Testaufnahme über 500 ms, Pegel messen, bei Stille warnen.
- **In-App-Consent (beide OS):** Der First-Run-Wizard zeigt einen expliziten Consent-Screen, bevor je ein Mikrofonzugriff passiert: eine kurze, deutsche Erklärung, dass Audio nur lokal verarbeitet und nie gespeichert oder gesendet wird, plus ein aktiver Bestätigen-Button. Diese Zustimmung wird mit Zeitstempel in die lokale Konfig geschrieben (Nachweis der informierten Einwilligung, ohne Telemetrie). Das ist der auditfeste Consent-Beleg.

**Definition of Done (2.1):** Testaufnahme im Wizard produziert einen sichtbaren Pegelausschlag; im DevTools-Network-Tab passiert während der Aufnahme null externer Request; auf der Platte entsteht keine Audiodatei (per `fs`-Watch im Test verifizieren).

### 2.2 whisper.cpp ohne On-Site-Compile: Wrapper, Modell, Download, Cache

**Gewählter Wrapper: `@fugood/whisper.node@^1.0.22`** (npm-Scope `@fugood`, Repo `mybigday/whisper.node`), MIT-lizenziert.

Begründung (belegt): Die plattformspezifischen Binaries sind als `optionalDependencies` hinterlegt (`@fugood/node-whisper-darwin-arm64`, `-darwin-x64`, `-win32-x64`, `-win32-arm64`, `-linux-x64`, `-linux-arm64`). npm zieht beim Install automatisch nur das Paket, dessen `os`/`cpu`-Feld zur Maschine passt. Das Subpaket hat `scripts: none`, enthält nur die fertige `.node`-Datei, kein Build. Der `postinstall`-Hook (`scripts/check.js`) ruft **sofort `process.exit(0)`**, außer `npm_config_build_from_source` ist gesetzt. Ohne diese Variable wird `cmake-js` nie aufgerufen. Kein CMake, kein node-gyp, kein Xcode CLT, kein VS Build Tools. Auf macOS-arm64 ist Metal-GPU im Default-Binary enthalten; Windows/Linux laufen CPU-only im Default (`-vulkan`/`-cuda`-Varianten werden bewusst NICHT verwendet, um compilerfrei und breit kompatibel zu bleiben).

**Harte Install-Regel:** `npm ci` normal laufen lassen, **niemals** `--no-optional` oder `--omit=optional`, sonst wird kein Binary gezogen. Diese Regel gehört als Kommentar ins Install-Skript. Für Offline-Vor-Ort-Install wird der `node_modules`-Stand bzw. ein lokaler npm-Cache mitgeliefert (siehe Installer-Abschnitt), damit `npm ci --offline` das plattformrichtige Prebuilt findet.

**Electron-ABI:** `@fugood/whisper.node` ist ein N-API/node-addon-api-Addon, also ABI-stabil, normalerweise ohne `electron-rebuild` nutzbar. Trotzdem in der Ziel-Electron-Version testen und das Addon nur im Main-/`utilityProcess` laden.

**Fallback-Wrapper (nur wenn fugood in der Ziel-Electron-Version ABI-Probleme macht):** `@kutalia/whisper-node-addon@1.1.0` (prebuilt `.node` für win-x64, mac-x64/arm64, linux-x64, PCM+VAD), mit dem Vorbehalt "experimental". Nicht als Primärweg.

**Deutsches Modell:** `cstr/whisper-large-v3-turbo-german-ggml` auf Hugging Face (Apache-2.0), die GGML-Konvertierung von `primeline/whisper-large-v3-turbo-german` (primeline selbst liefert nur Transformers/CT2, nicht GGML).

| Datei | Format | Größe | Verwendung |
|---|---|---|---|
| `ggml-model-q5_0.bin` | Q5_0 quantisiert | 574 MB | **Standard, VoiceWall-Default** |
| `ggml-model.bin` | fp16 | 1,62 GB | Optional "Maximale Genauigkeit" für starke Rechner |

**Quantisierungs-Empfehlung:** Primär **Q5_0** ausliefern. Q5_0/Q5_1 ist der Sweet-Spot (effektiv ca. 5,5 Bit/Gewicht); der WER-Zuwachs gegenüber fp16 liegt laut allgemeinen Quantisierungsstudien im Zehntel-Prozent-Bereich, für Diktat praktisch nicht wahrnehmbar, bei ca. 30 bis 60 % weniger Speicher/Latenz. Q4_0 (ca. 4,5 Bit) nur als Notnagel für sehr schwache Hardware anbieten, mit sichtbarem Hinweis auf reduzierte Genauigkeit (riskanter bei deutschem Fachvokabular). Eine getrennte Encoder-fp16/Decoder-q5-Aufteilung ist über die Standard-whisper.cpp-`quantize`-Pipeline nicht der übliche Weg; der pragmatische Hebel ist die Schema-Wahl (Q5_0), nicht Encoder/Decoder-Splitting. Wer es auditfest will, misst VoiceWall-intern einmal WER fp16 vs Q5_0 auf einigen deutschen Testsätzen und dokumentiert das.

**Modellgrößen-Wahl je Hardware (Wizard-Logik):**
- Apple Silicon (M-Serie) oder Windows-CPU ab ca. 6 physischen Kernen und >= 16 GB RAM: Q5_0 als Default, fp16 optional freischalten.
- Ältere/schwächere Windows-CPUs (< 4 Kerne, 8 GB RAM): Q5_0 bleibt Default (turbo+Q5_0 ist der wichtigste Latenz-Hebel), fp16 ausgrauen, Q4_0 als Notnagel-Option einblenden.
- Die Auswahl wird im Wizard vorgeschlagen (Hardware-Erkennung via `os.cpus()`, `os.totalmem()`), bleibt aber überschreibbar.

**Download beim ersten Start, Cache, Checksumme, Fortschritt:**
- Ziel-Ordner: macOS `~/Library/Application Support/VoiceWall/models/`, Windows `%APPDATA%\VoiceWall\models\` (via `app.getPath('userData')`).
- URL immer die stabile `resolve/main`-URL, Redirects folgen lassen (Node `fetch`/`undici` folgt standardmäßig). Die HF-CDN-URL ist signiert mit Ablaufzeit, deshalb **nie** die CDN-URL hardcoden.
  - `https://huggingface.co/cstr/whisper-large-v3-turbo-german-ggml/resolve/main/ggml-model-q5_0.bin`
  - `https://huggingface.co/cstr/whisper-large-v3-turbo-german-ggml/resolve/main/ggml-model.bin`
- **Checksumme:** Eine im Code fest hinterlegte SHA-256-Konstante pro Modelldatei (einmal beim Bauen selbst berechnet). Nach dem Download prüfen. Bei Mismatch: Datei löschen, Abbruch mit klarer deutscher Meldung. Das ist auditfest und unabhängig von HF-Metadaten (robuster als der LFS-Pointer-Hash).
- **Idempotenz:** Existiert die Datei und passt die Checksumme, wird der Download übersprungen.
- **Fortschrittsanzeige:** `Content-Length` aus dem Response-Header lesen, Bytes streamend zählen, Prozent/MB per IPC an den Wizard-Renderer pushen (Progressbar plus "X von 574 MB"). Da 574 MB spürbar dauern, ist eine ehrliche Fortschrittsanzeige plus geschätzte Restzeit Pflicht, sonst wirkt der Wizard hängend.
- **Resume:** HF-CDN unterstützt Range-Requests. Für 574 MB reicht aber ein einfacher "bei Abbruch komplett neu laden"-Ansatz; Resume optional.
- **Der Download ist der EINZIGE erlaubte externe Request der ganzen App**, und er passiert ausschließlich im First-Run-Wizard gegen `huggingface.co`, danach nie wieder. Das ist explizit im Wizard zu benennen ("Einmaliger Modell-Download, danach 100 % offline").

**VAD-Modell (Silero, ggml):** `ggml-silero-v5.1.2.bin` (MIT, < 1 MB) aus `ggml-org/whisper-vad`, gleiche Download-/Checksummen-/Cache-Logik.
- `https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin`

**Attribution (Apache-2.0/MIT-Pflicht):** `NOTICE`/`THIRD_PARTY_LICENSES` mitliefern mit MIT-Texten (whisper.cpp, `@fugood/whisper.node`, Silero, OpenAI-Whisper) und Apache-2.0-Text + NOTICE für das primeline-Modell inkl. Hinweis "in GGML/Q5_0 konvertiert von cstr". Keine Copyleft-Falle, passt zum kommerziellen Vertrieb.

**Definition of Done (2.2):** `npm ci` zieht ohne Compiler das plattformrichtige `.node`; First-Run lädt Q5_0 (574 MB) mit sichtbarem Fortschritt, prüft SHA-256 gegen die Konstante, cached idempotent; ein zweiter Start überspringt den Download; nach dem Download 0 externe Requests im Betrieb.

### 2.3 Live-Diktat: VAD + Sliding-Window, ehrliche Latenz/Genauigkeit

Whisper ist **kein natives Streaming-Modell**. Der Weg ist VAD-gesteuerte Segmentierung, nicht Wort-für-Wort-Streaming. Für Diktat ist das genau das richtige UX: sprechen, kurze Pause, Text erscheint.

**Ablauf:**
1. Globaler Hotkey startet Aufnahme (2.4).
2. Mikrofon-PCM (16 kHz mono) fließt in den RAM-Ringpuffer (2.1).
3. **Silero VAD** (über fugoods `initWhisperVad`/`detectSpeechData`) detektiert Sprachende (Stille > Schwellwert, z. B. 300 bis 700 ms).
4. Das abgeschlossene Sprachsegment geht an `ctx.transcribeData(pcm, { language: 'de', temperature: 0.0, no_timestamps: true })`.
5. Text raus zu Clipboard + simuliertem Paste (2.5).

**VAD-Parameter (gegen Halluzination):**
- `min-speech-duration-ms` ca. 250, damit Klicks/Atmen/Räuspern nicht transkribiert werden. Whisper halluziniert gern bei sehr kurzen/leeren Segmenten.
- `temperature: 0.0` und `no_timestamps: true` für Diktat: weniger Halluzination, weniger Latenz.
- `language: 'de'` fix vorgeben, **nie** Auto-Detect (spart Zeit, verhindert Sprachwechsel-Fehler).
- VAD-Quelle: Silero-ggml über denselben whisper-Layer (kein separates `onnxruntime-node`/`@ricky0123/vad-node`, spart eine native Dependency und bleibt compilerfrei).

**Sliding-Window (nur bei langen Diktaten):** Für pausenfreie Monologe > ca. 25 s ein Fenster mit 30 bis 50 % Overlap fahren und die überlappenden Tokens dedupen (Whisper-Kontext bleibt über Segmentgrenzen kohärenter). Für typisches Satz-für-Satz-Diktat reicht die VAD-Segmentierung, Overlap ist dann unnötig.

**Ehrliche Latenz-/Genauigkeitserwartung DE:**
- **Apple Silicon (M-Serie, Metal an):** large-v3-turbo-german (809M aktive Parameter) ist deutlich schneller als large-v3. Für Diktat-Häppchen (VAD-Segmente 1 bis 10 s Sprache) faktisch nahe Echtzeit oder besser; ein M3/M4 verarbeitet 1 Minute Audio in der large-v3-Klasse in ca. 20 s, turbo schneller. M1/M2 langsamer, aber turbo+Q5_0 bleibt für kurze Segmente flott. Realistische gefühlte Verzögerung nach Sprechende: unter 1 s bis wenige Sekunden je nach Segmentlänge.
- **Windows-CPU (ohne GPU):** spürbar langsamer als Mac-M. Weil pro VAD-Segment aber nur wenige Sekunden Audio verarbeitet werden (nicht eine ganze Aufnahme), bleibt Satz-für-Satz-Diktat praktikabel. Thread-Zahl auf physische Kerne setzen. Auf schwachen Windows-CPUs ist turbo-Q5_0 gegenüber large-v3 der entscheidende Hebel. Ehrlich kommunizieren: auf schwacher Hardware kann die Verzögerung nach einem längeren Satz einige Sekunden betragen, das ist kein Fehler, sondern lokale Rechenlast.
- **Genauigkeit DE:** Basis ist stark auf Deutsch optimiert (large-v3-turbo-german). Q5_0-Degradation gegenüber fp16 im Zehntel-Prozent-Bereich, für Diktat nicht wahrnehmbar. Keine öffentlichen sauberen DE-WER-Zahlen exakt für turbo-german-Q5_0; wer es auditfest will, misst intern (siehe 2.2).

**Definition of Done (2.3):** Ein gesprochener deutscher Satz erscheint nach kurzer Sprechpause als korrekter Text; kurze Geräusche (Klick, Atmen) erzeugen keinen Text; Sprache ist fest DE, keine Halluzinations-Phantomsätze bei Stille.

### 2.4 Globaler Hotkey: Mechanismus, Push-to-talk vs Toggle

**Gewählter Mechanismus: Electrons eingebautes `globalShortcut.register()`.** Funktioniert app-übergreifend auch ohne Fokus, ist Teil des Frameworks, braucht kein Native-Addon, keine Compiler-Fläche. Das ist die sauberste, wartungsärmste Lösung und der Grund, warum `node-global-key-listener` (Subprozess-basiert, rechteintensiv) NICHT verwendet wird (der wäre nur im reinen-Node-Szenario ohne Electron relevant).

**Default-Belegung:** Ein gut merkbarer, kollisionsarmer Shortcut, im Wizard konfigurierbar (Konflikte mit System/Fremd-App vermeiden). `globalShortcut.register` gibt `false` zurück, wenn die Kombination schon belegt ist; in dem Fall im Wizard eine Alternative anbieten statt still zu scheitern.

**Push-to-talk vs Toggle:**
- **Toggle (empfohlener Default):** Ein Tastendruck startet die Aufnahme, der nächste stoppt sie. Robust, weil `globalShortcut` verlässlich auf Key-Events feuert und der Nutzer die Hände frei hat. Ein sichtbarer Zustand (Tray-Icon-Farbe/Overlay "Ich höre zu") ist Pflicht, damit klar ist, ob gerade aufgenommen wird.
- **Push-to-talk (optionale Alternative):** Taste gedrückt halten = Aufnahme, loslassen = Stop + Transkription. Näher am klassischen Diktiergerät, aber technisch heikler, weil `globalShortcut` primär auf Auslösung ausgelegt ist, sauberes Key-Down/Key-Up global unter Electron nicht überall zuverlässig ist. Wenn PTT gewünscht, ist ein zusätzlicher globaler Key-Listener nötig; das ist bewusst optional und Zweitpriorität.
- **Empfehlung:** Toggle als Default (robust, compilerfrei über `globalShortcut`), PTT als späteres Opt-in.

**Zustandssicherheit:** Bei App-Fokusverlust/Sperrbildschirm die Aufnahme sauber beenden; `globalShortcut.unregisterAll()` beim Beenden, sonst bleibt der Hotkey systemweit hängen. 2026 bietet Electron zusätzlich `globalShortcut`-Suspend-APIs, um den Hotkey temporär zu pausieren (z. B. während eines Modal-Dialogs im Wizard).

**Definition of Done (2.4):** Hotkey löst aus beliebiger Fremd-App (Word/Outlook/Browser) die Aufnahme aus, sichtbarer Zustandsindikator; zweiter Druck (Toggle) stoppt und transkribiert; beim App-Beenden ist der Hotkey wieder frei.

### 2.5 Text-Einfügen: Zwischenablage + simuliertes Cmd/Strg+V

**Primärweg (OS-nativ, KEINE zusätzliche native Dependency):** Transkript per Electron-eingebautem `clipboard.writeText()` in die Zwischenablage schreiben, dann `Cmd+V` (macOS) bzw. `Strg+V` (Windows) in die fokussierte Fremd-App simulieren über `child_process`. Das ist der "Beleg statt Behauptung"-Weg: nachvollziehbare, auditierbare OS-Aufrufe statt Blackbox-Native-Modul, und null zusätzliche native Angriffs-/Wartungsfläche.

- **macOS:** `osascript -e 'tell application "System Events" to keystroke "v" using command down'`.
- **Windows:** PowerShell mit `[System.Windows.Forms.SendKeys]::SendWait("^v")` (oder `WScript.Shell.SendKeys`). PowerShell gezielt mit `-ExecutionPolicy Bypass` **nur für diesen Aufruf** starten, nie systemweit.
- **Linux (optional):** `xdotool key ctrl+v` (X11) bzw. `wtype` (Wayland).

**Zwischenablage-Höflichkeit:** Vor dem Schreiben den bisherigen Clipboard-Inhalt sichern und nach dem Paste (kurz verzögert) wiederherstellen, damit VoiceWall nicht dauerhaft die Zwischenablage des Nutzers überschreibt. Optional per Wizard abschaltbar.

**macOS-Bedienungshilfen-Berechtigung (Accessibility/TCC) plus Erststart-Anleitung:** Das simulierte Cmd+V setzt voraus, dass die VoiceWall-App in Systemeinstellungen, Datenschutz & Sicherheit, Bedienungshilfen freigegeben ist. Ohne diese Freigabe passiert nichts (stiller Fehler). Deshalb:
- Die App muss eine **stabile Bundle-ID** haben (z. B. `de.der-ki-auditor.voicewall`) und beim lokalen Build **ad-hoc codegesignt** werden (`codesign -s -`), sonst kann macOS-TCC die einmal erteilte Berechtigung nicht über Neustarts halten. Der Ad-hoc-Sign-Schritt gehört ins Install-Skript nach dem Electron-Build. Keine Apple Developer ID/Notarisierung nötig, weil kein Internet-Vertrieb (lokal gebaut/kopiert, keine Gatekeeper-Quarantäne).
- Der First-Run-Wizard erkennt fehlende Berechtigung (`systemPreferences.isTrustedAccessibilityClient(false)`), erklärt sie auf Deutsch und führt Schritt für Schritt in den richtigen Systemeinstellungen-Bereich (Deep-Link via `open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"`). Lars klickt das beim Vor-Ort-Setup einmal durch.

**Windows:** Keine Accessibility-Freigabe nötig, SendKeys läuft direkt. Ggf. einmaliger SmartScreen-Hinweis beim ersten Start, den Lars vor Ort wegklickt.

**Robustheit + Fallback:**
- Manche Apps weisen programmatisches Paste ab oder haben Timing-Probleme. Deshalb nach dem Paste-Aufruf keine Erfolgsannahme, sondern immer einen sichtbaren **Kopieren-Knopf** und den Hinweis "Text ist in der Zwischenablage, mit Cmd/Strg+V einfügen" im VoiceWall-Fenster/Overlay. Der Text ist also nie verloren, auch wenn Auto-Paste scheitert.
- Optionaler "Tippen"-Modus als Zweit-Fallback (zeichenweises Simulieren) für Apps, die Paste hart abweisen. Standardmäßig aus (langsamer, fehleranfälliger).
- **Optionaler Native-Fallback fürs Paste**, nur falls OS-Scripting-Rechte auf einer Zielmaschine partout haken: `@nut-tree-fork/nut-js@4.2.6` mit `@nut-tree-fork/libnut-*@2.7.5` (Apache-2.0, prebuilt `.node`, kein Install-Skript, kein Compiler). **Nicht** das kostenpflichtige `@nut-tree/nut-js` (Abo, Redistribution verboten). Nur einbauen, wenn wirklich nötig, wegen zusätzlicher nativer Fläche und Einzelpersonen-Maintenance.

**Definition of Done (2.5):** Transkribierter Text landet per Auto-Paste in Word, Outlook und Browser-Textfeld; bei fehlender macOS-Bedienungshilfen-Freigabe führt der Wizard sichtbar durch die Freigabe; scheitert Auto-Paste, ist der Text trotzdem via Kopieren-Knopf/Zwischenablage verfügbar.

### 2.6 Sprach-/Modellauswahl-UI

Ein schlanker Einstellungsbereich (Teil des Wizards und dauerhaft erreichbar), rein lokal, ohne jeden Netzwerkbezug außer dem einmaligen Modell-Download:

- **Modellwahl:** Q5_0 (Standard, empfohlen) / fp16 "Maximale Genauigkeit" (nur bei ausreichender Hardware aktiv) / Q4_0 "Notnagel für schwache Rechner" (mit Warnhinweis). Der jeweils gewählte Modellpfad wird in die lokale Konfig geschrieben. Wird ein noch nicht vorhandenes Modell gewählt, startet der gecachte, checksummen-geprüfte Download mit Fortschrittsanzeige (2.2).
- **Sprache:** Default fest Deutsch (`de`), weil das das Produktversprechen ist und Auto-Detect Fehler/Latenz bringt. Optional weitere Sprachen des Multilingual-Modells freischaltbar, aber deutlich als "primär für Deutsch optimiert" gekennzeichnet.
- **Hotkey-Belegung** (2.4) und **Toggle vs Push-to-talk** (2.4) hier konfigurierbar.
- **Zwischenablage-Wiederherstellung** und **Tippen-Modus-Fallback** (2.5) als Schalter.
- **Hardware-Hinweis:** Erkannte CPU/RAM/GPU-Situation und die daraus abgeleitete Empfehlung transparent anzeigen (Beleg, warum welches Modell vorgeschlagen wird).

**Definition of Done (2.6):** Modell- und Sprachwahl persistieren in der lokalen Konfig, ein Modellwechsel triggert bei Bedarf den geprüften Download, keine Auswahl löst einen sonstigen externen Request aus.

### 2.7 Lokale Text-Nachbearbeitung (harte Guardrail: KEIN Cloud-LLM)

**Harte Regel:** Jede Text-Nachbearbeitung läuft ausschließlich lokal und regelbasiert/deterministisch. **Kein Cloud-LLM, kein Claude/OpenAI/irgendein API-Call zur Laufzeit, für gar nichts.** Das ist nicht verhandelbar und der Kern des Produktversprechens.

**Warum diese Guardrail (im Code als Kommentar dokumentieren):** VoiceWall wirbt mit architektonisch beweisbarer DSGVO-Konformität (Netzwerk-Tab = 0 externe Requests). Ein einziger LLM-Call zur "Verbesserung" des Textes würde genau die vertraulichen Diktatinhalte (Namen, Geschäftsgeheimnisse, Gesundheitsdaten) an einen externen Dienst senden und den gesamten Vertrauensbeweis zerstören. Der ganze Wettbewerbsvorteil gegenüber gehypten Cloud-Diktier-Tools ist, dass VoiceWall das eben NICHT tut. Eine "nur ein kleiner Cloud-Aufruf"-Ausnahme gibt es nicht.

**Was lokal erlaubt und sinnvoll ist:**
- **Interpunktion/Kapitalisierung:** Der deutsche turbo-Finetune setzt Satzzeichen und Großschreibung bereits recht gut. Ergänzend rein regelbasierte Nachschärfung: erster Buchstabe nach Satzende groß, doppelte Leerzeichen zusammenziehen, Leerzeichen vor Satzzeichen entfernen.
- **Füllwörter/Disfluenzen:** Optional per konfigurierbarer Wortliste "äh", "ähm", "öhm", Wortdopplungen ("das das") entfernen. Standard: konservativ (nur eindeutige Disfluenzen), abschaltbar, weil aggressive Filter Inhalt fressen können.
- **Sprachkommandos (optional, lokal):** Einfache gesprochene Befehle wie "neue Zeile", "Punkt", "Komma", "neuer Absatz" per lokalem Mapping in die entsprechenden Zeichen umsetzen. Rein String-basiert, kein Modell nötig.
- **Kundenspezifisches Vokabular:** Optional eine lokale Ersetzungsliste (Firmen-/Produktnamen, Fachbegriffe), die häufige Fehltranskriptionen deterministisch korrigiert. Liegt als Datei im Firmen-Ordner, ist auditierbar.

Alle diese Schritte sind reine String-Operationen im Main-Prozess, ohne Modell, ohne Netz. Wenn irgendwann eine LLM-gestützte Glättung gewünscht wäre, müsste das ein **lokales** Modell sein (separates Projekt, außerhalb dieses Scopes), niemals ein Cloud-Aufruf.

**Definition of Done (2.7):** Nachbearbeitung verbessert Interpunktion/Füllwörter sichtbar; im DevTools-Network-Tab passiert dabei null externer Request; die Guardrail ist im Code als Kommentar und im NOTICE verankert.

### 2.8 Fehlerbehandlung

Jeder Fehlerpfad hat eine klare deutsche Meldung mit konkretem nächsten Schritt (Lars steht beim Setup daneben, aber die Meldungen müssen auch im späteren Alltag eindeutig sein) und einen lokalen Log-Eintrag (kein Telemetrie-Versand).

- **Mikrofon verweigert/nicht verfügbar:** `getUserMedia`-Fehler abfangen. macOS: auf fehlende TCC-Freigabe prüfen und in Systemeinstellungen, Datenschutz, Mikrofon führen. Windows: auf Datenschutz-Einstellung hinweisen. Kein Gerät gefunden: verfügbare Eingabegeräte auflisten, Auswahl anbieten. Nie stiller Fehlschlag.
- **Modell fehlt/Checksumme falsch:** Wenn die Modelldatei fehlt oder die SHA-256 nicht passt, Datei löschen und Download (erneut) anbieten, mit Fortschrittsanzeige. Bei fehlendem Internet im First-Run klare Meldung ("Für den einmaligen Modell-Download wird jetzt Internet benötigt, danach läuft VoiceWall 100 % offline"). Nach dem Cache nie wieder relevant.
- **whisper-Crash/Addon-Ladefehler:** Whisper im Main-/`utilityProcess` isoliert; Absturz fängt der Main-Prozess ab, ohne die ganze App zu killen. Bei ABI-/Ladefehler des fugood-Addons klare Meldung und (dokumentierter) Fallback-Pfad auf `@kutalia/whisper-node-addon`. Bei Transkriptions-Timeout Segment verwerfen, Nutzer sieht "Konnte nicht transkribieren, bitte erneut sprechen", das Rohaudio ist ohnehin schon aus dem RAM verworfen.
- **Kein Fokus-Fenster/Paste-Ziel:** Wenn beim Paste keine Fremd-App im Fokus ist (oder das Ziel Paste ablehnt), nicht ins Leere tippen. Stattdessen: Text in der Zwischenablage lassen, sichtbaren Kopieren-Knopf plus Hinweis "Kein Eingabefeld im Fokus, Text ist in der Zwischenablage" anzeigen. Der Text geht nie verloren.
- **Hotkey-Konflikt:** `globalShortcut.register` gibt `false` bei Belegung; im Wizard Alternative anbieten statt still zu scheitern.
- **Grundsatz:** Kein Fehler darf dazu führen, dass Rohaudio oder Transkript unbemerkt verloren geht, und kein Fehlerpfad darf einen externen Request auslösen (auch kein "Error-Reporting" nach außen).

**Definition of Done (2.8):** Jeder der genannten Fehlerfälle produziert eine verständliche deutsche Meldung mit Handlungsanweisung und einen lokalen Log-Eintrag; in keinem Fehlerpfad entsteht ein externer Request; in keinem Fehlerfall geht bereits transkribierter Text verloren (immer per Zwischenablage/Kopieren-Knopf gerettet).

Both legal facts confirmed: DDG (§5 DDG) replaced §5 TMG on 14 May 2024, and AI Act Art. 50 transparency/marking obligations apply from 2 August 2026 (with the nuance that machine-readable marking is Art. 50(1) provider duty, human-visible disclosure the Art. 50(2)/(4) split). One important nuance for VoiceWall: Whisper transcription is arguably NOT "KI-generierter Inhalt" in the Art. 50(2) sense (it transcribes the user's own speech, it does not synthesize content), which is the precise auditor point to make. This is the deliverable.

## 3. Sicherheit & Datenschutz by Design

VoiceWall ist ein Projekt eines ISO-42001/27001-Auditors. Der Massstab lautet nicht "sicher genug", sondern "auditfest": jede Schutzbehauptung muss vor Ort in unter fuenf Minuten beweisbar sein (Netzwerk-Tab, Portscan, SBOM, Logdatei). Dieser Abschnitt ist zugleich Sicherheitskonzept, Datenschutz-Nachweis und Umsetzungsvorgabe. Er ist so geschrieben, dass eine andere Session ihn direkt in Code, Konfigurationsdateien und Rechtstexte giessen kann. Wo eine Anforderung normativ verankert ist, ist die Klausel genannt, damit VoiceWall selbst als Referenzimplementierung im Audit vorgezeigt werden kann.

Leitprinzip: **Beleg statt Behauptung.** Datenschutz ist bei VoiceWall nicht zugesichert, sondern architektonisch erzwungen und mit Bordmitteln des Betriebssystems und des Browsers nachpruefbar.

### 3.1 Bedrohungsmodell (STRIDE fuer eine lokale Desktop-App)

Das Bedrohungsmodell ist bewusst eng gefasst, weil die Architektur (100% lokal, keine Cloud) ganze Angriffsklassen von vornherein ausschliesst. Genau diese Ausschluesse sind der Wettbewerbsvorteil und muessen dokumentiert bleiben.

**Schutzgueter (Assets):**
- Die diktierten Transkripte im Firmenordner (potenziell hochsensibel: Personaldaten, Vertragsdiktate, medizinische oder anwaltliche Inhalte, damit ggf. Art. 9 DSGVO). Hoechstes Schutzgut.
- Das Mikrofon-Audio im RAM waehrend der Aufnahme.
- Die Zwischenablage (enthaelt kurzzeitig das Transkript).
- Die Firmenstammdaten aus dem Wizard (Konfigurationsdatei).
- Die Integritaet der ausgelieferten Binaerbausteine (Whisper-Addon, Modell, Paste-Baustein).

**Vertrauensgrenzen (Trust Boundaries):**
1. Zwischen der lokalen HTTP-/IPC-Schnittstelle und jedem anderen lokalen Prozess (anderer Nutzer, anderer Browser-Tab, Schadsoftware auf demselben Rechner).
2. Zwischen dem Renderer (UI, potenziell mit Web-Inhalt) und dem Main-Prozess (Dateisystem, Shell, natives Whisper).
3. Zwischen VoiceWall und dem Netz beim einmaligen Modell-Download im First-Run.
4. Zwischen Nutzereingabe (Firmenname, Tags, Suchbegriffe) und den Senken Dateisystem, Shell und HTML.

**STRIDE-Analyse mit Gegenmassnahmen:**

| Kategorie | Konkrete Bedrohung fuer VoiceWall | Gegenmassnahme (Abschnitt) |
|---|---|---|
| **S**poofing | Fremder lokaler Prozess oder bosartiger Browser-Tab ruft die lokale API auf und schleust Diktate aus oder loest Aktionen aus | 127.0.0.1-Bindung, Origin-Allowlist, Session-Token, CSRF-Schutz (3.2) |
| **T**ampering | Manipuliertes Whisper-Binary oder untergeschobenes Modell (Supply-Chain); manipulierte Konfig erzwingt Pfad ausserhalb des Basisordners | Lockfile + SHA-256-Pinning der natives und des Modells (3.8), Schema- und Containment-Pruefung der Konfig beim Lesen (3.4) |
| **R**epudiation | Unklar, welche Version/Checksumme installiert wurde, kein Nachweis der Nicht-Exfiltration | Lokales Installations- und Betriebslog mit Versionen/Hashes (3.6), SBOM (3.8), Netzwerk-Selbsttest (3.3) |
| **I**nformation Disclosure | Transkripte landen in Logs, offener Port ist von aussen erreichbar, Audio wird auf Platte geschrieben, Cloud-Call | Kein 0.0.0.0 (3.2), Logging ohne Inhalte + Rotation (3.6), RAM-only-Audio (3.7), harte CSP ohne externe Origins (3.3) |
| **D**enial of Service | Riesiges Audio/riesige Datei sprengt RAM; Portkollision blockiert Start | Ringpuffer mit fester Obergrenze, VAD-Segmentgrenzen (3.7), Ephemeral-Port-Wahl mit Retry (3.2) |
| **E**levation of Privilege | Path-Traversal/Command-Injection ueber den Firmennamen; Renderer erlangt Node-/Dateisystemzugriff | Sanitisierung + Containment + kein Shell-Interpolieren (3.4/3.5), contextIsolation an, nodeIntegration aus (3.2) |

**Bewusst ausgeschlossene Bedrohungen (und warum):** Server-seitige Angriffe, Datenlecks beim Cloud-Anbieter, kompromittierte API-Keys, Man-in-the-Middle zur Laufzeit, Account-Uebernahme, Auftragsverarbeiter-Kette. All das existiert bei VoiceWall nicht, weil es zur Laufzeit weder Server, Cloud, API-Key noch Account gibt. Dieser Ausschluss ist der zentrale Datenschutz-Beweis (siehe 3.11) und wird im Audit als kompensierende Architektur ("privacy by design", Art. 25 DSGVO) gefuehrt.

### 3.2 Lokaler Server: nur 127.0.0.1, zufaelliger Port, Token, Origin- und CSRF-Schutz

Falls die UI ueber einen lokalen HTTP-Server im Standardbrowser laeuft (Fallback-Architektur), ist der offene Loopback-Port die groesste vermeidbare Angriffsflaeche. Bei der empfohlenen Electron-Architektur entfaellt der Port ganz, weil UI und Main-Prozess ueber IPC statt HTTP kommunizieren. Die folgenden Regeln gelten fuer den HTTP-Fall und sind Pflicht.

**Bindung strikt an Loopback.** Der Server bindet ausschliesslich an `127.0.0.1`, niemals an `0.0.0.0` und niemals an eine LAN-IP. In Node explizit als zweites Argument, nicht dem Default ueberlassen:

```js
// RICHTIG: nur ueber die Loopback-Schnittstelle erreichbar
server.listen(port, '127.0.0.1');
// FALSCH (waere im ganzen LAN erreichbar): server.listen(port) oder server.listen(port, '0.0.0.0')
```

Begruendung und Beleg: Bindet man an `0.0.0.0`, ist der Dienst im gesamten Netzwerk erreichbar; die Loopback-Bindung macht ihn von aussen physisch nicht ansprechbar. Das ist im Audit mit einem Portscan von einem zweiten Geraet ("Port gefiltert/geschlossen") beweisbar.

**Zufaelliger, ephemerer Port.** Kein fester Port (kein Rateziel, keine Kollision mit anderen Diensten). Der Server fordert Port `0` an, das OS vergibt einen freien Port, die tatsaechliche URL wird intern weitergereicht. Bei belegtem Port automatischer Retry.

**Session-Token zwischen UI und Server.** Beim Start erzeugt der Server ein kryptografisch zufaelliges Token (mindestens 256 Bit, `crypto.randomBytes(32).toString('base64url')`). Nur der Prozess, der die UI ausliefert, kennt es (Injektion in die ausgelieferte Seite oder Uebergabe als `?token=` genau einmal beim Oeffnen). Jede API-Anfrage muss das Token im Header `Authorization: Bearer <token>` mitfuehren. Ohne gueltiges Token: `401`, keine Verarbeitung. Das Token liegt nur im RAM, wird nie auf Platte geschrieben und rotiert bei jedem Start. Damit kann ein fremder lokaler Prozess, der die Port-URL kennt, dennoch nichts abrufen.

**Origin-Allowlist statt CORS-Wildcard.** Der Server setzt niemals `Access-Control-Allow-Origin: *`. Zustandsaendernde und datenliefernde Endpunkte pruefen serverseitig den `Origin`- bzw. `Sec-Fetch-Site`-Header gegen eine feste Allowlist (die eigene Loopback-Origin). Alles andere: `403`. Das ist derselbe serverseitige Origin-Guard, der bereits in der Edge-Function-Baseline des KI-Auditors etabliert ist, hier auf den lokalen Server uebertragen.

**CSRF-Schutz.** Da eine bosartige Webseite im selben Browser theoretisch Requests an `127.0.0.1:<port>` absetzen kann (DNS-Rebinding, CSRF), greifen drei Schichten zusammen: (1) das Bearer-Token, das eine Fremdseite nicht kennt und das nicht automatisch mitgesendet wird (im Gegensatz zu Cookies); (2) die `Origin`/`Sec-Fetch-Site`-Pruefung; (3) ein `Host`-Header-Check gegen `127.0.0.1:<port>` (Abwehr von DNS-Rebinding, bei dem der Angreifer eine eigene Domain auf die Loopback-IP zeigen laesst). Zusaetzlich: keine Session-Cookies verwenden (Token im Header statt Cookie schaltet die klassische CSRF-Automatik aus).

**Security-Header auf jeder Antwort:** `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin`, `Cache-Control: no-store` fuer API-Antworten. Kein `Server`-Header mit Versionsinfo.

**Electron-Haertung (empfohlene Architektur, damit der Port ganz entfaellt):** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, kein `@electron/remote`, `webSecurity` an. Kommunikation nur ueber einen schmalen, typisierten `contextBridge`-Kanal mit fester Methodenliste (kein generisches `ipcRenderer.send` freigeben). `will-navigate` und `setWindowOpenHandler` blockieren jede Navigation zu externen URLs (die UI darf den lokalen Kontext nie verlassen). Damit gibt es weder offenen Port noch Renderer-zu-Node-Bruecke.

### 3.3 Strikte Content-Security-Policy als beweisbare Nicht-Exfiltration

Die CSP ist bei VoiceWall nicht nur XSS-Abwehr, sondern der technische Beweis, dass die UI keine externe Verbindung aufbauen kann. Sie wird per HTTP-Header und zusaetzlich per `<meta http-equiv>` gesetzt (Guertel und Hosentraeger).

**Die Policy (Laufzeit, nach dem First-Run-Download):**

```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data:;
font-src 'self';
media-src 'self' blob:;
connect-src 'self';
worker-src 'self' blob:;
object-src 'none';
frame-src 'none';
frame-ancestors 'none';
base-uri 'none';
form-action 'self';
upgrade-insecure-requests
```

**Warum das der Exfiltrations-Beweis ist:** `connect-src 'self'` verbietet `fetch`, `XMLHttpRequest`, WebSocket, `EventSource` und `sendBeacon` zu jeder anderen Herkunft als der eigenen. `default-src 'self'` plus `object-src 'none'` schliessen Plugins und externe Ressourcen. `img-src` erlaubt keine externen Hosts (kein Tracking-Pixel als versteckter Exfil-Kanal). Selbst wenn per Lieferkette Schadcode in den Renderer gelangte, koennte er die Transkripte technisch nicht ins Netz senden, weil der Browser den Request an eine Fremd-Origin verweigert. Das ist der Kern von "architektonisch beweisbar".

**Wichtige Regeln:**
- **Kein `'unsafe-inline'`, kein `'unsafe-eval'`.** Skripte und Styles kommen aus lokalen Dateien. Falls Inline unumgaenglich ist (z. B. Token-Injektion), per `nonce` oder `sha256`-Hash statt `'unsafe-inline'`.
- **Der AudioWorklet** wird als `blob:`-URL geladen (deshalb `worker-src blob:` und `media-src blob:`), niemals von einer externen URL.
- **Zwei CSP-Profile.** Ein einziger, klar abgegrenzter Ausnahmezustand ist der First-Run-Download: dort ist genau `connect-src 'self' https://huggingface.co https://*.hf.co` erlaubt, ausschliesslich fuer den Modell- und VAD-Download. Sobald das Modell gecacht und per SHA-256 verifiziert ist, schaltet die App dauerhaft auf die restriktive Laufzeit-CSP ohne jede externe Origin. Dieser Wechsel wird im Log vermerkt.
- **Trusted Types** (falls die Ziel-Chromium-Version es traegt): `require-trusted-types-for 'script'` als zusaetzliche DOM-XSS-Sperre.

**Selbsttest fuer den Nutzer (der beweisbare Teil, gehoert in README und First-Run-Wizard als "So pruefen Sie das selbst"):**
1. Diktat normal benutzen, dann Entwicklertools oeffnen (F12 bzw. Cmd+Alt+I), Reiter **Netzwerk**, Filter "Fetch/XHR" und "All".
2. Beliebig viele Diktate durchfuehren. Ergebnis: **null Requests zu einer externen Domain.** Nur lokale (`127.0.0.1`, `blob:`, `data:`) Eintraege oder gar keine.
3. Gegenprobe im Firewall-/Verbindungsmonitor des Betriebssystems (Little Snitch, LuLu oder macOS-Firewall bzw. Windows-Ressourcenmonitor "Netzwerkaktivitaet"): VoiceWall taucht mit keiner ausgehenden Verbindung auf, ausser dem einmaligen `huggingface.co`-Download im First-Run.
4. Haerteste Probe: **Netzwerkkabel ziehen / WLAN aus**, nach dem einmaligen Modell-Download. VoiceWall funktioniert vollstaendig offline. Das ist der endgueltige Beleg, dass keine Cloud im Spiel ist.

Dieser Selbsttest ist bewusst Teil des Produkts. Er verwandelt eine Datenschutz-Behauptung in eine vom Kunden in Minuten reproduzierbare Tatsache und ist damit ein Verkaufs- und Auditargument zugleich.

### 3.4 Pfad-Traversal- und Dateinamen-Sanitisierung fuer den Firmen-Ordner

Der Firmenname aus dem Wizard fliesst in einen Verzeichnispfad. Das ist die gefaehrlichste Datenbewegung der App (Nutzereingabe in Dateisystem-Senke). Die Abwehr ist mehrstufig, ein einzelner Regex reicht nicht.

**Reihenfolge der Verarbeitung (verbindlich):**

1. **Unicode-Normalisierung (NFC)** und Entfernen aller Steuerzeichen (`\u0000`-`\u001F`, `\u007F`, sowie Zero-Width- und BiDi-Override-Zeichen `\u200B`-`\u200F`, `\u202A`-`\u202E`, die Dateinamen visuell faelschen koennen). Deckt sich mit der `clean()`-Baseline des KI-Auditors.
2. **Reduktion auf ein einziges Pfadsegment.** Jeder Verzeichnistrenner wird verboten, nicht ersetzt: Vorkommen von `/`, `\`, `..`, `:` fuehren dazu, dass diese Zeichen entfernt werden und der Name als reiner Bezeichner behandelt wird. Damit sind `../`, `..\`, verschachtelte Sequenzen wie `....//` und absolute Pfade ab Root strukturell unmoeglich.
3. **`sanitize-filename`** anwenden (Referenzimplementierung: entfernt reservierte Zeichen `<>:"/\|?*`, Steuerzeichen, `.`/`..`, trailing dots und spaces).
4. **Windows-reservierte Namen abfangen**, auch mit Endung: `CON, PRN, AUX, NUL, COM1..COM9, LPT1..LPT9` (Vergleich case-insensitiv gegen den Namen VOR dem ersten Punkt, denn `NUL.txt` ist aequivalent zu `NUL`). Bei Treffer: Fallback-Name oder erneute Abfrage.
5. **Laengenbegrenzung** (Segment auf z. B. 96 Zeichen, Gesamtpfad gegen das Windows-MAX_PATH-Limit pruefen).
6. **Leerergebnis-Abfang.** Besteht der Name nach Sanitisierung nur aus entfernten Zeichen, kein stilles Default, sondern erneute, klare Nachfrage im Wizard.
7. **Containment-Pruefung NACH `path.resolve`** (die entscheidende Schicht): den finalen absoluten Pfad bilden und verifizieren, dass er als Praefix tatsaechlich unter dem erwarteten Desktop-Basisordner liegt. Erst nach Aufloesung pruefen, nie vorher.

```js
import path from 'node:path';

function firmenordnerPfad(basisDesktop, roherName) {
  const segment = sanitizeSegment(roherName); // Schritte 1..6
  const ziel = path.resolve(basisDesktop, segment);
  const basis = path.resolve(basisDesktop);
  // Containment: ziel MUSS echtes Kind von basis sein
  const rel = path.relative(basis, ziel);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Ungueltiger Ordnername: Pfad liegt ausserhalb des Zielordners.');
  }
  return ziel;
}
```

**Command-Injection, wenn der Name in Shell oder Skript landet:** Der Firmenname (und jede andere Nutzereingabe) darf **niemals per String-Interpolation in eine Shell-Kommandozeile** gelangen. Weder `exec('mkdir ' + name)` noch ein in ein PowerShell-/Bash-Skript eingesetzter Name. Regeln:
- Ordner ausschliesslich per `fs.mkdir(zielPfad, { recursive: true })` anlegen, nie per Shell.
- Fuer alle externen Aufrufe (osascript, PowerShell, xdotool fuer das Paste; siehe Runtime-Recherche) ausnahmslos `execFile`/`spawn` mit **Argument-Array** verwenden, nie `exec` mit einem zusammengesetzten String. Das Betriebssystem uebergibt die Argumente dann ohne Shell-Interpretation.
- In die osascript-/PowerShell-Aufrufe fliesst nur das Transkript in die Zwischenablage, nicht der Firmenname. Falls doch je ein Nutzerwert in ein Skript muesste, wird er als `argv`-Parameter uebergeben (`-ArgumentList`, `$args`), nie in den Skriptkoerper interpoliert.
- Die PowerShell-Aufrufe laufen prozess-scoped mit `-ExecutionPolicy Bypass` gezielt fuer den Einzelaufruf, nie systemweit gesetzt.

**Idempotente Kollision:** Existiert der Ordner bereits, wird er weiterverwendet, nie ueberschrieben und nie geloescht (der Ordner enthaelt Kundendiktate, Datenverlust waere fatal).

### 3.5 Input-Validierung ueberall, Ausgabe-Encoding

**Eingang (jede Wizard- und UI-Eingabe, Whitelist-Prinzip):**
- Jedes Feld gegen ein explizites Schema (empfohlen `zod`): Typ, Laenge, erlaubte Zeichenklasse. Beispiel: Firmenname nicht leer und max. Laenge; E-Mail nur, wenn ein solches Feld ueberhaupt existiert, gegen ein konservatives Muster; Tags als kurze alphanumerische Tokens.
- Validierung geschieht serverseitig bzw. im Main-Prozess, nicht nur im Renderer (clientseitige Pruefung ist Komfort, nicht Schutz).
- Suchbegriffe fuer die Transkriptsuche werden als reine Suchstrings behandelt, nie als Pfad, nie als Regex mit unkontrolliertem Nutzerinput (ReDoS-Vermeidung: entweder Literalsuche oder ein Timeout/eine sichere Suchbibliothek).
- Dateien, die die App liest (Transkripte, Konfig), werden beim Einlesen gegen ein Schema validiert und ihr Pfad erneut der Containment-Pruefung unterzogen (eine manipulierte Konfig darf keinen Pfad ausserhalb des Basisordners erzwingen).

**Ausgang (kontextgerechtes Encoding, gegen Stored XSS in der Verwaltungs-UI):**
- Transkriptinhalte, Tags und Firmennamen werden in der UI **niemals per `innerHTML`/`dangerouslySetInnerHTML`** eingefuegt, sondern als Textknoten (`textContent`) bzw. ueber das JSX-Standard-Escaping des Frameworks. Ein Transkript, das zufaellig `<script>` enthaelt, darf niemals ausgefuehrt werden.
- Wird Markdown gerendert, dann nur mit einem Sanitizer (z. B. `DOMPurify` mit strenger Allowlist), keine rohen HTML-Passagen aus Transkripten.
- Beim Schreiben in Dateipfade greift die Sanitisierung aus 3.4; beim Schreiben in JSON wird strukturiert serialisiert (`JSON.stringify`), nie per String-Konkatenation.
- Die harte CSP aus 3.3 ist die zweite Verteidigungslinie: selbst bei einem Encoding-Fehler blockiert `script-src 'self'` das Nachladen und die Ausfuehrung von Fremdskripten.

### 3.6 Keine Telemetrie, lokales Logging mit Rotation und ohne sensible Inhalte

**Null Telemetrie, null Analytics, null Crash-Reporting nach aussen.** VoiceWall sendet zur Laufzeit keine Nutzungsdaten, keine Fehlerberichte, kein Ping, kein Update-Check an irgendeinen Server. Kein Sentry, kein Google Analytics, kein Plausible, kein Cloudflare-Beacon. In Electron zusaetzlich das eingebaute Crash-Reporting explizit nicht aktivieren und `app.setPath('crashDumps', ...)` nur lokal, oder Crash-Uploads hart deaktivieren. Das ist ein bewusster Kontrast zur ueblichen Desktop-App und ein tragender Datenschutz-Beleg.

**Lokales Logging (rein lokal, als Nachweis, nicht als Ueberwachung):**
- Zwei Logs: ein **Installations-/Setup-Log** (welche Versionen, welche Checksummen, welcher Ordner angelegt, Zeitstempel, Ausgang) und ein **Betriebslog** (Start/Stop, Modell geladen, Hotkey registriert, Fehlerklassen).
- **Niemals sensible Inhalte im Log:** kein Transkripttext, kein Audio, kein Dateiinhalt, keine Suchbegriffe, keine Firmen-Detaildaten ausser dem bereits sichtbaren Ordnernamen. Geloggt werden Ereignisse und Metadaten (z. B. "Transkript gespeichert, 1240 Zeichen, Dauer 3,2 s"), nie das Was.
- **Redaction als Default:** ein zentraler Log-Wrapper, der strukturiert (JSON-Lines) loggt und nur explizit freigegebene Felder durchlaesst. Freitext-Logging von Nutzerdaten ist im Code verboten (per Lint-Regel/Review durchsetzen).
- **Rotation und Begrenzung:** groessenbasierte Rotation (z. B. 5 Dateien a 1 MB), aeltere werden geloescht. Kein unbegrenztes Wachstum, keine Altdaten-Halde.
- **Speicherort und Rechte:** unter `~/.voicewall/logs/` mit restriktiven POSIX-Rechten (`0600` Dateien, `0700` Ordner). Log-Level ueber Konfig, Default `info`; ein `debug`-Level, das mehr Kontext zeigt, aktiviert Lars nur zur Vor-Ort-Fehlersuche und schaltet es danach wieder ab (auch `debug` protokolliert niemals Transkriptinhalte).

### 3.7 Audio wird nie persistiert (RAM only)

Das Mikrofon-Audio verlaesst zu keinem Zeitpunkt den Arbeitsspeicher.
- Aufnahme ueber `getUserMedia` + AudioWorklet, roher Int16-PCM landet in einem **RAM-Ringpuffer mit fester Obergrenze** (DoS-Schutz: die Puffergroesse begrenzt den maximalen RAM-Verbrauch).
- Uebergabe an VAD und `transcribeData` erfolgt als ArrayBuffer direkt aus dem RAM. Es wird **keine WAV/Opus/Temp-Datei** geschrieben, kein `os.tmpdir()`, kein Cache.
- Nach Abschluss der Transkription eines Segments wird der PCM-Puffer aktiv ueberschrieben/freigegeben. Das Transkript (Text) wird persistiert, das Audio nicht.
- Kein Whisper-`transcribe({file})`-Pfad, der einen Dateipfad erwartet; ausschliesslich der In-Memory-Pfad `transcribeData`.
- Beleg im Audit: Waehrend und nach dem Diktat existiert keine Audiodatei im Firmenordner, in `~/.voicewall/` oder im Temp-Verzeichnis. Das ist per Ordnerinspektion pruefbar und wird im README zugesichert.

### 3.8 Dependency-Hygiene und Supply-Chain-Haertung

Die Lieferkette ist bei einer lokal ausgelieferten App mit nativen Bausteinen der realistischste Angriffsweg (siehe Miasma-Wurm, Juni 2026, phantom `binding.gyp`). VoiceWall haertet sie vollstaendig.

- **Lockfile committen und via `npm ci` installieren.** `npm ci` installiert exakt nach `package-lock.json`, verifiziert jedes Paket gegen seinen Integritaets-Hash und bricht bei Divergenz ab. Das Lockfile ist Pflicht-Artefakt im Repo.
- **Kein Compiler, keine Install-Skripte.** Unter npm v12 sind Install-Skripte per Default aus; die minimal noetige `allowScripts`-Freigabeliste wird bewusst leer gehalten, indem nur Pakete mit prebuilt natives (ohne Postinstall-Build) gewaehlt werden (Whisper-Addon mit `check.js`-`exit(0)`, Paste-Baustein mit mitgelieferter `.node`). Kein Paket im Baum bringt eine kompilierende `binding.gyp` mit (phantom-gyp-Falle aktiv ausschliessen und im Review bestaetigen).
- **Pinnen und Checksummen der prebuilt native Binaries.** Jede ausgelieferte `.node`-Datei (Whisper darwin/win32, ggf. Paste-Fallback) und das Modell werden mit **fest im Repo hinterlegter SHA-256** versehen und beim Install/First-Run gegen diese Konstante geprueft. Mismatch: Abbruch mit klarer Meldung, Datei loeschen, kein Weiterlauf. Damit greift ein untergeschobenes Binary nicht.
- **Modell-Download auditfest.** Das GGML-Modell (`ggml-model-q5_0.bin`, Apache-2.0) und das Silero-VAD-Modell werden nur ueber die `resolve/main`-URL von Hugging Face geladen, Redirects wird gefolgt, danach SHA-256 gegen den Repo-Erwartungswert. Kein blinder Download.
- **`npm audit`** als fester Teil der CI und des Bootstrap-Checks (analog zur bestehenden KI-Auditor-Regel `lint && test && build && audit`).
- **SBOM im CycloneDX-Format** erzeugen und mitliefern (`npm sbom --sbom-format cyclonedx` bzw. `@cyclonedx/cyclonedx-npm`). Die SBOM ist der nachweisbare Stuecklisten-Beleg aller lokalen Komponenten mit Versionen und Lizenzen, exakt "Beleg statt Behauptung", und ist im ISO-27001-Kontext (A.5.19/A.5.21, Lieferantenbeziehungen) sowie fuer die ISO-42001-Datenprovenienz vorzeigbar.
- **Dependabot** (bzw. Renovate) fuer automatische, gepruefte Dependency-Updates am Repo aktivieren; Lockfile-Diffs werden reviewt, nicht blind gemergt.
- **Vendoring/Offline-Install.** Fuer die Vor-Ort-Installation ein mitgelieferter npm-Cache bzw. vorbereitete `node_modules`, sodass `npm ci --offline` ohne Netzzugriff und ohne Registry-Risiko laeuft. Das macht die Installation deterministisch und ist zugleich ein DSGVO-Argument (kein Netzwerkzugriff waehrend der Installation).
- **Verteilung als review-then-run.** Auslieferung als inspizierbares Quellcode-Repo, das Lars vor Ort ausfuehrt, niemals `curl | bash`. Der Installationsweg selbst ist damit ein Compliance-Beleg.

### 3.9 Lizenz- und Attribution-Compliance

Alle verwendeten Komponenten sind weitergabefreundlich (MIT/Apache-2.0), keine Copyleft-Falle. Sauber dokumentiert wird das in einer mitgelieferten Datei `THIRD_PARTY_LICENSES` bzw. `NOTICE`:

| Komponente | Lizenz | Pflicht |
|---|---|---|
| whisper.cpp (ggml-org) | MIT | Copyright + MIT-Text beilegen |
| Whisper-Node-Addon + Plattform-Binaries | MIT | MIT-Text beilegen |
| OpenAI Whisper (Architektur) | MIT | nennen |
| `primeline/whisper-large-v3-turbo-german` | Apache-2.0 | Attribution + Aenderungshinweis (GGML-Konvertierung ist modifizierte Distribution) + Apache-2.0-Text + NOTICE |
| `cstr/whisper-large-v3-turbo-german-ggml` | Apache-2.0 | Quelle nennen ("in GGML/Q5_0 konvertiert von cstr") |
| Silero VAD | MIT | MIT-Text beilegen |
| uebrige npm-Bausteine | MIT/ISC/BSD | via SBOM + `THIRD_PARTY_LICENSES` |

Die SBOM (3.8) und diese Datei zusammen liefern den vollstaendigen Lizenznachweis. Fuer das "49 EUR Vor-Ort"-Modell besteht damit kein Lizenzrisiko.

### 3.10 EU-AI-Act: Transparenz und Einordnung von VoiceWall

**Praezise Einordnung (auditwichtig, weil hier oft falsch pauschalisiert wird).** VoiceWall ist ein Transkriptionswerkzeug: es wandelt die eigene Sprache des Nutzers in Text. Das ist **Spracherkennung, nicht Erzeugung synthetischer Inhalte.** Die Kennzeichnungspflicht fuer "KI-generierte Inhalte" nach Art. 50 Abs. 2 EU-AI-Act zielt auf synthetisch erzeugte Bild-, Audio-, Video- oder Textinhalte (Deepfakes, generative Ausgaben), nicht auf die 1:1-Verschriftung einer echten menschlichen Aeusserung. Ein Diktat-Transkript ist inhaltlich die Aussage des Nutzers, kein vom Modell frei generierter Inhalt.

**Haltung von VoiceWall (bewusst konservativ, "Beleg statt Behauptung"):**
- VoiceWall nutzt zur Laufzeit ein KI-System (Whisper). Auch wenn Art. 50 Abs. 2 auf reine Transkription nach hiesiger Auslegung nicht direkt anwendbar ist, weist VoiceWall **transparent aus, dass die Verschriftung durch ein KI-Modell (Whisper) erfolgt**, inklusive des Hinweises, dass automatische Transkription Fehler enthalten kann und der Nutzer das Ergebnis vor Verwendung pruefen sollte. Dieser Transparenzhinweis steht im First-Run-Wizard, in der UI (dezent) und im README.
- Die relevanten Fristen werden korrekt benannt: die Transparenzpflichten des Art. 50 gelten ab dem **2. August 2026.** Die maschinenlesbare Markierung generativer Outputs ist eine Anbieterpflicht aus Art. 50 Abs. 1; die menschlich erkennbare Offenlegung betrifft Abs. 2/Abs. 4. Da VoiceWall keine synthetischen Inhalte generiert, trifft die Markierungspflicht das Produkt nach hiesiger Einordnung nicht; der freiwillige Transparenzhinweis geht darueber hinaus und ist damit vorbildlich statt bloss konform.
- Kein Hochrisiko-System nach Anhang III (Transkription fuer Buerodiktat ist kein gelisteter Hochrisiko-Anwendungsfall; die Anhang-III-Pflichten sind zudem durch den Digital Omnibus auf Dezember 2027 verschoben). Diese Einordnung wird dokumentiert, nicht nur angenommen.

Diese differenzierte Argumentation ist selbst ein Kompetenzbeleg des KI-Auditors: sie zeigt, dass hier jemand den AI Act genau liest, statt pauschal zu kennzeichnen oder pauschal zu ignorieren.

### 3.11 DSGVO-Einordnung: 100% lokal bedeutet keine Auftragsverarbeitung

Dies ist der zentrale rechtliche Beweis von VoiceWall und muss sauber dokumentiert werden, weil er der schaerfste Kontrast zu cloudbasierten Diktier-Tools ist.

- **Keine Auftragsverarbeitung, kein AVV noetig.** VoiceWall verarbeitet keine personenbezogenen Daten fuer den Kunden auf fremder Infrastruktur. Es gibt keinen Anbieter, der als Auftragsverarbeiter im Sinne von Art. 28 DSGVO Daten des Kunden verarbeitet, weil die gesamte Verarbeitung ausschliesslich lokal auf dem Rechner des Kunden stattfindet. Damit entfaellt der Abschluss eines Auftragsverarbeitungsvertrags. Der Betreiber ist allein Verantwortlicher fuer seine eigene lokale Verarbeitung, es tritt kein Dritter hinzu.
- **Kein Drittlandtransfer.** Da keine Daten den Rechner verlassen, gibt es keine Uebermittlung in ein Drittland, keine Standardvertragsklauseln, kein Transfer-Impact-Assessment.
- **Art. 30 (Verzeichnis von Verarbeitungstaetigkeiten):** Der Betreiber fuehrt weiterhin sein eigenes Verzeichnis fuer die eigene Verarbeitung, aber es entfaellt jede Zeile zu einem VoiceWall-Auftragsverarbeiter, weil keiner existiert. Die Kette ist maximal kurz.
- **Art. 35 (Datenschutz-Folgenabschaetzung):** Fuer den Werkzeugeinsatz selbst entsteht durch VoiceWall kein zusaetzliches Drittrisiko, das eine DSFA wegen der Verarbeitung durch Dritte ausloest, weil es keine Verarbeitung durch Dritte gibt. Ob der Betreiber fuer seine konkreten Diktat-Inhalte (z. B. Gesundheitsdaten) eine DSFA braucht, bleibt seine eigene Prueflast, unabhaengig vom Werkzeug; VoiceWall reduziert das Risiko strukturell, statt es zu erhoehen.
- **Beweisbarkeit dokumentieren.** Genau hier zahlt die Architektur ein: der Netzwerk-Selbsttest (3.3), der Portscan (3.2), das RAM-only-Audio (3.7), die restriktive CSP und die SBOM (3.8) sind zusammen der dokumentierte Nachweis, dass keine Datenweitergabe stattfindet. VoiceWall legt diese Nachweise als kurzes, kundenfertiges "Datenschutz-Beleg-Blatt" bei (was geprueft wurde, wie man es selbst nachprueft), das der Kunde seiner eigenen Dokumentation beilegen kann. Das ist Art. 5 Abs. 2 DSGVO (Rechenschaftspflicht) in Reinform und der praktische Ausdruck von Art. 25 (Datenschutz durch Technikgestaltung und datenschutzfreundliche Voreinstellungen).

Wichtige Ehrlichkeit im Text (kein Overclaiming): VoiceWall macht den Kunden nicht "DSGVO-fertig" fuer alle seine Zwecke; es beseitigt die Auftragsverarbeiter- und Cloud-Dimension vollstaendig und liefert den Beleg dafuer. Die verbleibenden Pflichten des Verantwortlichen fuer seine eigenen Inhalte bleiben bei ihm.

### 3.12 VoiceWalls eigene Rechtstexte: DDG statt TMG

Die Rechtstexte der VoiceWall-Projektseite und des README muessen selbst vorbildlich sein, denn ein KI-Auditor, der im eigenen Impressum das falsche Gesetz zitiert, verliert Glaubwuerdigkeit. Bewusster Kontrast zum Wettbewerber, der oft noch veraltete Verweise fuehrt.

- **Impressum/Anbieterkennzeichnung zitiert `§ 5 DDG`**, nicht `§ 5 TMG`. Das Telemediengesetz ist am 14. Mai 2024 aufgehoben und ins Digitale-Dienste-Gesetz (DDG) ueberfuehrt worden; die Impressumspflicht steht jetzt in **§ 5 DDG**. Ein aktives "nach § 5 TMG" waere ein falscher Verweis. Zulaessig ist auch, ganz ohne Paragraphenverweis nur "Impressum"/"Anbieterkennzeichnung" zu schreiben; wo ein Verweis steht, ist er auf DDG zu aktualisieren.
- **Weitere aktualisierte Verweise:** das ehemalige TTDSG heisst seit Mai 2024 **TDDDG** (Telekommunikation-Digitale-Dienste-Datenschutz-Gesetz), relevant fuer Cookie-/Endgeraet-Formulierungen. VoiceWall setzt zur Laufzeit keine Cookies und greift nicht auf Endgeraeteinformationen im Sinne des § 25 TDDDG zu (kein Tracking, keine Analytics), was in der Datenschutzerklaerung der Projektseite explizit und positiv festgehalten wird.
- **Datenschutzerklaerung der Projektseite** beschreibt die tatsaechliche Realitaet: bei der reinen Software keine Verarbeitung durch den Anbieter; fuer die Projekt-Website selbst nur das, was dort wirklich laeuft (analog zur bestehenden KI-Auditor-Praxis, die die real eingesetzte Loesung beschreibt und nicht ein nicht genutztes Tool). Keine Textbausteine, die eine nicht existente Cloud-Verarbeitung suggerieren.
- **Konsistenzcheck:** Kein Vorkommen von "TMG" oder "TTDSG" in aktiver Verweisfunktion in README, Impressum, Datenschutz oder Landingpage. Ein einfacher Grep als CI-/Review-Gate ("kein aktives TMG/TTDSG-Zitat") macht das pruefbar, im Geist der KI-Auditor-CI-Gates.

### 3.13 Sichere Defaults, Update- und Patch-Haltung

**Sichere Defaults (secure by default):**
- Restriktive CSP ohne externe Origins ist der Default, die Download-Ausnahme ein klar begrenzter Sonderfall (3.3).
- Loopback-Bindung, Token-Pflicht, Origin-Guard sind eingeschaltet, ohne dass der Nutzer etwas konfiguriert (3.2).
- Kein Telemetrie-Opt-out noetig, weil Telemetrie gar nicht existiert (3.6).
- Dateirechte restriktiv (`0600`/`0700`) von Anfang an (3.4/3.6).
- Sprache fest auf Deutsch, `temperature: 0.0`, `no_timestamps: true` fuer stabile, halluzinationsarme Diktate.
- Der Firmen-Datenordner wird bei Deinstallation **nie automatisch geloescht**; das `uninstall`-Skript entfernt nur VoiceWall-Eigenes unter `~/.voicewall/` und fragt vor jeder Beruehrung von Nutzerdaten explizit nach (3.6/Installer-Konzept).

**Update- und Patch-Haltung (bewusst ohne Auto-Update-Kanal, aber nicht wartungslos):**
- Kein automatischer, phone-home Update-Mechanismus (der waere ein ausgehender Kanal und widerspraeche der Nicht-Exfiltrations-Zusicherung). Updates erfolgen kontrolliert ueber ein neues, inspizierbares Repo-Release, das Lars vor Ort einspielt (review-then-run).
- **Prozess statt Automatik:** Dependabot/Renovate am Repo halten die Abhaengigkeiten aktuell; `npm audit` in der CI meldet Schwachstellen; sicherheitsrelevante Updates der nativen Bausteine (Whisper-Addon, Electron/Chromium) werden zeitnah eingepflegt, weil Chromium die groesste Angriffsflaeche traegt und regelmaessige Sicherheitspatches braucht.
- **Nachvollziehbarkeit:** Jedes Release fuehrt eine aktualisierte SBOM und aktualisierte Checksummen mit. Der Kunde (und der Auditor) kann jederzeit belegen, welche Versionen und welche Hashes auf einem Geraet laufen (Setup-Log aus 3.6).
- **Verantwortliche Offenlegung:** Ein `SECURITY.md` im Repo mit Kontaktweg fuer Schwachstellenmeldungen, passend zu einem Auditor-Projekt (ISO-27001 A.5.7 Threat Intelligence / A.5.24-A.5.26 Incident Management analog auf das Produkt angewandt).

**Verbindliche Definition of Done fuer diesen Abschnitt (fuer die abarbeitende Session):**
1. Server bindet nachweislich nur an `127.0.0.1` (Portscan von zweitem Geraet zeigt keinen offenen Port), ephemerer Port, Bearer-Token erzwungen, Origin-/Host-Guard aktiv (oder Electron-IPC ohne Port).
2. Laufzeit-CSP enthaelt keine externe Origin; Netzwerk-Tab zeigt nach First-Run null externe Requests; Offline-Betrieb funktioniert vollstaendig; der Selbsttest steht dokumentiert in README und Wizard.
3. Firmenname durchlaeuft Sanitisierung plus `path.resolve`-Containment; reservierte Windows-Namen, Unicode und Traversal getestet; kein Nutzerwert gelangt per String in eine Shell (`execFile`/Argument-Array ueberall).
4. Alle Eingaben schemavalidiert, Ausgabe kontextgerecht escaped (kein `innerHTML` fuer Nutzerinhalte).
5. Kein Telemetrie-/Analytics-/Crash-Upload-Code im Baum; Logging strukturiert, rotiert, ohne Transkriptinhalte, mit restriktiven Rechten.
6. Kein Audio-Artefakt auf Platte waehrend/nach Diktat (per Ordner- und Temp-Inspektion belegt).
7. `package-lock.json` committet, `npm ci` gruen, `npm audit` ohne offene High/Critical, CycloneDX-SBOM erzeugt und mitgeliefert, jede `.node`-Datei und das Modell per hinterlegter SHA-256 verifiziert, Dependabot aktiv, keine kompilierende `binding.gyp` im Baum.
8. `THIRD_PARTY_LICENSES`/`NOTICE` vollstaendig (MIT + Apache-2.0 inkl. primeline/cstr-Attribution).
9. AI-Act-Transparenzhinweis (KI-Transkription, Fehlerhinweis) in Wizard/UI/README; die Nicht-Anwendbarkeit der Art.-50-Markierung fuer reine Transkription dokumentiert.
10. DSGVO-Beleg-Blatt (kein AVV noetig, kein Drittlandtransfer, Beweisbarkeit) beigelegt.
11. Eigene Rechtstexte zitieren `§ 5 DDG` (nicht TMG) und `TDDDG` (nicht TTDSG); CI-/Review-Grep verbietet aktive TMG/TTDSG-Zitate.
12. `SECURITY.md` vorhanden; sichere Defaults ohne Nutzerkonfiguration aktiv; Update-Weg als kontrolliertes review-then-run-Release dokumentiert, kein phone-home.

Sources: [Digitale-Dienste-Gesetz ersetzt TMG (IT-Recht-Kanzlei)](https://www.it-recht-kanzlei.de/tmg-ttdsg-ausser-kraft-impressum-datenschutz.html), [DDG und § 5 DDG im Impressum (eRecht24)](https://www.e-recht24.de/news/datenschutz/13296-webseitenbetreiber-aufgepasst-das-tmg-wird-zum-digitale-dienste-gesetz-aktualisieren-sie-jetzt-ihr-impressum.html), [EU AI Act Artikel 50 ab 2. August 2026 (Plotdesk)](https://plotdesk.com/magazin/eu-ai-act-artikel-50-transparenzpflichten-unternehmen-2026), [Kennzeichnungspflichten fuer KI-Inhalte, Art. 50 (abd Rechtsanwaelte)](https://www.abd-partner.de/de/blog/kennzeichnungspflichten-fuer-ki-inhalte)


---

## 4. Installer, First-Run-Wizard & Ordner-Datenmodell

Dieser Abschnitt ist umsetzungsreif. Er definiert konkrete Dateien, Befehle, Datenschemata und eine Definition of Done (DoD) pro Baustein. Die harten Prioritäten gelten durchgängig: On-Site-Install ohne Compiler-Toolchain, alles lokal, idempotent, wiederholbar, "Beleg statt Behauptung". Die Runtime-Grundlage ist Electron mit prebuilt native Addons (siehe Abschnitt 1 bis 3); dieser Abschnitt baut darauf auf.

### 4.0 Verzeichnisüberblick des ausgelieferten Repos (Kontext)

Damit die folgenden Skripte konkret referenzierbar sind, hier die relevante Repo-Struktur, die vor Ort geklont oder als Archiv übergeben wird:

```
voicewall/
  package.json
  package-lock.json          committet, Pflicht fuer npm ci
  install/
    voicewall-setup.command  macOS-Doppelklick-Wrapper (chmod +x)
    voicewall-setup.sh        eigentliches bash/zsh-Bootstrap (Mac + Linux)
    voicewall-setup.ps1       Windows-Bootstrap (PowerShell)
    uninstall.sh              macOS/Linux-Deinstallation
    uninstall.ps1             Windows-Deinstallation
    lib/
      preflight.sh / .ps1     Systemcheck (OS, Arch, Node-Version, Rechte)
      node-bootstrap.sh / .ps1  portable Node nach ~/.voicewall/runtime/
      checksums.json          SHA-256 aller extern geladenen Artefakte
  vendor/
    node-runtime/            optional: portable Node-Tarballs (offline)
    npm-cache/              optional: vorgefuellter npm-Cache (offline npm ci)
  src/
    main/                   Electron-Main (Hotkey, Whisper, Paste, FS)
    wizard/                 First-Run-Wizard (lokale UI)
    manage/                 Verwaltungs-UI (Liste, Suche, Tags, Export)
    core/
      paths.ts              Desktop-/AppSupport-Pfad-Aufloesung
      sanitize.ts           Firmenname-Sanitisierung + Containment
      folderModel.ts        Ordner-als-DB (Anlegen, Lesen, Schreiben)
      manifest.ts           Index/Manifest-Verwaltung + Suche
      export.ts             Markdown/PDF/TXT-Export
  NOTICE, THIRD_PARTY_LICENSES
```

Alle Nutzerdaten liegen NIE im Repo, sondern ausschließlich in `Desktop/<Firmenname>/` und im App-Support-Ordner (Runtime/Modelle/Konfig). Das Repo bleibt read-only-artig und ist jederzeit per `git clean` zurücksetzbar, ohne Diktate zu berühren.

### 4.1 Das Bootstrap-/Installations-Skript (macOS + Windows)

#### 4.1.1 Zielbild und Aufrufweg

Es gibt genau zwei Einstiegspunkte, je Plattform einen, plus je einen Doppelklick-Wrapper für Nicht-Techniker:

- macOS/Linux: `install/voicewall-setup.sh`, gestartet über den Doppelklick-Wrapper `voicewall-setup.command` (damit Finder es ohne Terminal-Kenntnis startet).
- Windows: `install/voicewall-setup.ps1`, gestartet prozess-scoped über `powershell -NoProfile -ExecutionPolicy Bypass -File install\voicewall-setup.ps1`. Ein `voicewall-setup.cmd`-Wrapper kapselt genau diesen Aufruf, damit ein Doppelklick reicht.

Beide Skripte sind streng gehärtet:

- bash/zsh: erste Zeilen `set -euo pipefail` und `IFS=$'\n\t'`.
- PowerShell: `$ErrorActionPreference = 'Stop'`, `Set-StrictMode -Version Latest`, `-Scope Process`-Bypass ausschließlich für die eigene Prozesskette, kein dauerhafter Systemeingriff.

Kein `curl | bash`. Verteilung ist review-then-run: Lars klont oder entpackt das Repo, prüft es, führt es dann aus. Jeder externe Download wird gegen `install/lib/checksums.json` (SHA-256) verifiziert, sonst Abbruch.

#### 4.1.2 Schrittfolge (identisch in Logik, plattformspezifisch in Implementierung)

Jeder Schritt ist "check-then-do" (idempotent). Die Nummerierung ist zugleich die Log-Struktur.

1. Preflight (`lib/preflight`). Erfasst OS (darwin/win32), Architektur (arm64/x64), verfügbaren Plattenplatz (mind. 3 GB frei wegen Modell + Electron + Runtime), Schreibrecht auf `$HOME` und Desktop, Internet-Erreichbarkeit von `huggingface.co` (nur informativ, offline-Pfad existiert). Prüft, ob bereits eine ausreichend neue Node-Version erreichbar ist (`node --version` gegen die `engines`-Mindestversion aus `package.json`). Ergebnis wird geloggt, nichts verändert.

2. Node-Runtime bereitstellen (`lib/node-bootstrap`). Primärweg: gebündeltes portables Node aus `vendor/node-runtime/` nach `~/.voicewall/runtime/node/` entpacken (kein Systempfad, keine Admin-Rechte, keine globale PATH-Änderung, PATH nur prozesslokal gesetzt). Falls kein Vendor-Tarball vorliegt und eine passende System-Node existiert, wird diese verwendet. Der Runtime-Ordner ist versionsbenannt (`node-v<major>-<os>-<arch>/`), damit ein späteres Update idempotent danebenlegt statt zu überschreiben. DoD: `~/.voicewall/runtime/node/bin/node --version` liefert die erwartete Version.

3. Integritäts- und Skript-Härtung setzen. Vor dem Install wird sichergestellt, dass kein Paket im Baum zur Installationszeit kompiliert (Antipattern gemäß npm-v12-Realität). Konkret: `.npmrc` im Projekt setzt `audit=false` für den Offline-Install (kein Registry-Call nötig, Audit läuft separat in Schritt 6), und die npm-v12-`allowScripts`-Freigabeliste in `package.json` bleibt minimal (idealerweise leer, weil alle nativen Bausteine prebuilt-`.node` ohne Postinstall liefern, siehe Whisper-Recherche: `@fugood/whisper.node` `check.js` beendet sich mit `exit(0)`). `ignore-scripts=true` wird NICHT gesetzt, damit die `allowScripts`-Logik greift.

4. Dependencies installieren via `npm ci`. Reproduzierbar, integritätsgeprüft gegen `package-lock.json`. Bevorzugt offline gegen den mitgelieferten Cache: `npm ci --offline --cache vendor/npm-cache --prefer-offline`. Dadurch keine Registry-Zugriffe während der Installation (starkes DSGVO-Argument, deterministisch, schnell). Wichtig: niemals `--omit=optional` oder `--no-optional`, weil die prebuilt Plattform-Binaries (Whisper) als `optionalDependencies` mit `os`/`cpu`-Gate gezogen werden. Nach `npm ci` verifiziert das Skript, dass für die laufende Plattform genau die passende `.node`-Datei vorhanden ist (Existenzcheck auf das erwartete Subpaket), sonst klare Fehlermeldung.

5. Electron ad-hoc signieren (nur macOS). Nach dem Install signiert das Skript das lokale App-Bundle ad-hoc mit fester Bundle-ID `de.der-ki-auditor.voicewall` (`codesign -s - --deep --force` mit stabiler `CFBundleIdentifier`). Das ist Pflicht, damit macOS-TCC die einmal erteilte Accessibility-/Mikrofon-Berechtigung über Neustarts hält. Windows braucht diesen Schritt nicht.

6. Verifikation (`npm audit`, optional `npm sbom`). `npm audit` läuft gegen das Lockfile (rein lokal, Ergebnis ins Installationslog). Optional erzeugt das Skript eine SBOM (`npm sbom --sbom-format cyclonedx > ~/.voicewall/logs/sbom-<datum>.json`) als nachweisbare Stückliste. Das ist der "Beleg statt Behauptung"-Baustein: eine auditierbare Liste aller lokalen Komponenten.

7. Localhost starten und Browser öffnen. Das Skript startet die Electron-App bzw. den lokalen Server, der an `127.0.0.1` (nie `0.0.0.0`) auf einem freien Ephemeral-Port bindet. Es wartet aktiv auf "ready" (Health-Poll auf `http://127.0.0.1:<port>/health`, nicht blind sleepen), dann öffnet es den First-Run-Wizard. Im Electron-Modell ist das ein `BrowserWindow` (kein offener Port, IPC statt HTTP, kleinste Angriffsfläche). Der localhost-Server existiert nur, falls der Browser-Tab-Fallback aktiv ist; dann hart an Loopback gebunden, Origin-gecheckt, Token-geschützt.

8. First-Run-Erkennung. Existiert bereits eine gültige Konfig (siehe 4.5), überspringt das Skript den Wizard und startet direkt die Verwaltungs-UI. Existiert keine, startet der Wizard (Abschnitt 4.2).

#### 4.1.3 Idempotenz und erneutes Ausführen

Jeder der acht Schritte prüft zuerst "schon erledigt?":

- Node-Runtime vorhanden und Version korrekt: Schritt 2 überspringen.
- Lockfile-Hash unverändert seit letztem erfolgreichen `npm ci` (Marker `~/.voicewall/state/deps.ok` mit gespeichertem Lockfile-SHA-256): Schritt 4 überspringen.
- Bundle bereits ad-hoc signiert mit korrekter Bundle-ID (`codesign -dv` prüfen): Schritt 5 überspringen.
- Konfig + Firmenordner vorhanden: Wizard überspringen.

Mehrfaches Ausführen darf nie Daten zerstören und läuft im Idealfall in unter 30 Sekunden durch, wenn alles steht. Das Skript ist damit auch das Reparatur-/Update-Werkzeug.

#### 4.1.4 Fehlerbehandlung

- Jeder externe Aufruf mit Exit-Code-Prüfung, jeder Download mit SHA-256-Verifikation gegen `checksums.json`. Bei Mismatch: Datei löschen, Abbruch mit deutscher Klartext-Meldung und konkretem nächsten Schritt.
- Fehlermeldungen sind eindeutig und deutsch (Lars steht daneben, muss aber sofort wissen, woran es liegt), zum Beispiel: "Node-Runtime nicht entpackbar, Ziel `~/.voicewall/runtime/` nicht beschreibbar. Rechte prüfen, dann Skript erneut ausführen."
- Alle Ausgaben zusätzlich in ein lokales Installationslog `~/.voicewall/logs/install-<ISO-Datum>.log` (rein lokal, keine Telemetrie). Das Log hält Versionen, Checksummen, Zeitstempel fest, ist Teil des "Beleg"-Gedankens.

#### 4.1.5 Deinstallation und Cleanup

`install/uninstall.sh` bzw. `uninstall.ps1`:

- Entfernt ausschließlich VoiceWall-Eigenes: `~/.voicewall/` (Runtime, Cache-Marker, Logs, State) und den App-Support-Ordner (`~/Library/Application Support/VoiceWall/` bzw. `%APPDATA%\VoiceWall\`) mit Modellen und Konfig.
- Lässt die Firmen-Datenordner (`Desktop/<Firmenname>/`) standardmäßig STEHEN, weil sie die Kundendiktate enthalten. Datenverlust wäre fatal. Erst nach expliziter Rückfrage ("Auch die Diktat-Ordner löschen? Das ist unwiderruflich. [nein]") und ausdrücklicher Bestätigung werden diese berührt.
- Kein systemweiter Eingriff ist rückabzuwickeln (Vorteil des Bundled-Node-Ansatzes, keine globale PATH-Manipulation). Auf macOS zusätzlich Hinweis, die Accessibility-/Mikrofon-Freigabe in den Systemeinstellungen manuell zu entfernen (kann ein Skript nicht sauber für den Nutzer zurücknehmen).

#### 4.1.6 On-Site-Protokoll für den 49-EUR-Termin (unter 10 Minuten)

Lars arbeitet vor Ort auf einem Kundenrechner, auf dem vertrauliche Daten liegen. Das Protokoll ist entsprechend diszipliniert und hinterlässt einen nachvollziehbaren Beleg:

1. Vorbereitung (vor dem Termin, auf Lars' Gerät): Repo aktuell ziehen, Vendor-Ordner (portable Node + npm-Cache + Modell optional) auf einen USB-Stick oder in ein übergebenes Archiv legen. Damit ist die Vor-Ort-Installation offline-fähig und braucht kein Kundennetz.
2. Übergabe und Sichtprüfung (unter 1 Min): Repo auf den Kundenrechner kopieren (Klon oder Archiv entpacken). Kurzer Blick, dass es das erwartete VoiceWall-Repo ist. Da es lokal kopiert/geklont ist, entsteht auf macOS in der Regel kein `com.apple.quarantine`-xattr, Gatekeeper macht keine Probleme.
3. Ausführen (unter 3 Min): Doppelklick auf `voicewall-setup.command` (Mac) bzw. `voicewall-setup.cmd` (Windows). Das Skript läuft die acht Schritte durch. Auf Windows einmal die SmartScreen-Warnung wegklicken (Lars führt es bewusst aus). Auf macOS führt das Skript nach dem Build automatisch die Accessibility-/Mikrofon-Freigabe-Erklärung im Wizard, Lars klickt die Systemeinstellungen-Freigabe einmal durch.
4. Wizard (unter 3 Min): Lars gibt gemeinsam mit dem Kunden die Firmendaten ein (Abschnitt 4.2), wählt Sprache (Default Deutsch), Modell (Default Q5_0), Hotkey. Der Firmenordner wird angelegt.
5. Funktionsbeleg (unter 2 Min, "Beleg statt Behauptung"): Lars öffnet den Netzwerk-Tab bzw. zeigt das Installationslog und die SBOM. Er führt eine Testaufnahme durch, diktiert einen Satz in Word/Outlook, das Ergebnis erscheint per Auto-Paste. Danach: DevTools-Network-Tab zeigt im Betrieb null externe Requests. Das ist der auditfeste Nachweis der lokalen Verarbeitung, den Lars als Auditor dem Kunden direkt vorführen kann.
6. Datensauberkeit auf dem Kundenrechner: Nach dem Termin räumt Lars sein Übergabe-Archiv/USB-Medium wieder ab. Die einzige Datenspur, die bleibt, ist VoiceWall selbst plus der leere Firmenordner. Lars berührt keine bestehenden Kundendaten, das Skript schreibt ausschließlich in `~/.voicewall/`, den App-Support-Ordner und den neuen Desktop-Firmenordner. Das ist explizit auditierbar und Teil des Vertrauensversprechens gegenüber einem Kunden mit vertraulichen Beständen.

DoD On-Site: In unter 10 Minuten läuft VoiceWall, der Firmenordner existiert, eine Testtranskription wurde per Auto-Paste eingefügt, und der Netzwerk-Tab belegt null externe Requests.

### 4.2 First-Run-Wizard-Flow

Der Wizard ist eine lokale UI (Electron-Fenster). Er ist mehrstufig, jede Stufe validiert vor "Weiter". Kein Schritt schreibt ins Dateisystem, bevor am Ende bestätigt wird (atomare Anlage, siehe 4.3).

#### 4.2.1 Schritt 1: Firmendaten

Erfasste Felder mit Validierung:

| Feld | Pflicht | Validierung |
|---|---|---|
| Firmenname (Anzeigename) | ja | 1 bis 120 Zeichen, Unicode erlaubt, echte Umlaute erlaubt. Wird als Anzeigename gespeichert, NICHT direkt als Pfad. |
| Ordnername (abgeleitet) | ja | automatisch aus Firmenname sanitisiert (Abschnitt 4.3), im Wizard als Vorschau angezeigt und editierbar; Live-Validierung gegen Reserved-Names und Containment. |
| Ansprechpartner | nein | 0 bis 120 Zeichen, Steuerzeichen gestrippt. |
| E-Mail | nein | wenn gesetzt, RFC-lax-Format (nur lokale Anzeige, kein Versand, kein Netzwerk). |
| Standort/Abteilung | nein | frei, 0 bis 120 Zeichen. |
| Interner Hinweis | nein | Freitextnotiz für die Konfig. |

Alle Textfelder werden bei Eingabe Unicode-NFC-normalisiert und von Steuerzeichen befreit (konsistent zur bestehenden `clean()`-Baseline aus der Edge-Function-Security). Es fließen keinerlei Daten ins Netz, alles bleibt lokal.

#### 4.2.2 Schritt 2: Sprache

- Diktatsprache: Default Deutsch (`de`), fest voreingestellt. Auswahl möglich, aber Deutsch ist Markenkern (deutsch-optimiertes Modell). Die Sprache wird fix an Whisper übergeben (`language: 'de'`), nie Auto-Detect, das spart Latenz und verhindert Sprachwechsel-Fehler.
- UI-Sprache: Deutsch (echte Umlaute), einzige aktive Variante zum Start.

#### 4.2.3 Schritt 3: Modellwahl

Drei Optionen, mit klarer Empfehlung:

| Option | Datei | Größe | Wann |
|---|---|---|---|
| Empfohlen (Default) | `ggml-model-q5_0.bin` | 574 MB | bester Kompromiss DE-Genauigkeit/Latenz, passt auf normale Büro-Hardware |
| Maximale Genauigkeit | `ggml-model.bin` (fp16) | 1,62 GB | starke Rechner, wenn höchste Genauigkeit gewünscht |
| Schwache Hardware | Q4-Variante | kleiner | Notnagel, mit sichtbarem Hinweis auf reduzierte Genauigkeit |

Nach Auswahl lädt der Wizard das Modell beim First-Run (falls nicht schon lokal vorhanden) in den App-Support-Ordner (siehe 4.3.3), verifiziert die SHA-256 gegen einen fest im Code hinterlegten Erwartungswert, und cacht idempotent (existiert Datei + Checksumme passt, wird übersprungen). Zusätzlich lädt er das VAD-Modell `ggml-silero-v5.1.2.bin` (unter 1 MB). Das ist der EINZIGE Moment, in dem VoiceWall gegen `huggingface.co` spricht. Im Offline-Modus liegt das Modell im Vendor-Ordner und wird nur kopiert und verifiziert, kein Netzwerk. Fortschrittsbalken zeigt den Download, bei Fehler kompletter Neuversuch (574 MB verkraften das).

#### 4.2.4 Schritt 4: Hotkey-Wahl

- Vorschlag plattformabhängig: macOS `Cmd+Shift+D`, Windows `Strg+Shift+D` (D wie Diktat). Frei änderbar.
- Der Wizard testet die Registrierung sofort über Electrons `globalShortcut.register()` und meldet, falls die Kombination bereits belegt ist (dann andere wählen).
- macOS-Hinweis: der Wizard erklärt die Accessibility-Freigabe (für simuliertes Cmd+V) und die Mikrofon-Freigabe (TCC), führt den Nutzer bzw. Lars zu den Systemeinstellungen und prüft danach, ob die Berechtigung erteilt wurde. Ohne diese Freigaben ist das Kernfeature nicht funktionsfähig, deshalb ist es ein blockierender, aber gut erklärter Schritt.

#### 4.2.5 Schritt 5: Bestätigung und Anlage

Zusammenfassung aller Eingaben plus Vorschau des Zielpfads (`Desktop/<sanitisierter Ordnername>/`). Erst auf "Einrichten" werden atomar Ordner angelegt, Konfig geschrieben und Manifest initialisiert (Abschnitt 4.3, 4.4, 4.5). Danach springt VoiceWall in die Verwaltungs-UI.

### 4.3 Automatische Ordner-Anlage: Desktop/<Firmenname>/

#### 4.3.1 Plattformneutraler Desktop-Pfad

Der Desktop-Pfad wird nie hart als `~/Desktop` angenommen:

- macOS: `$HOME/Desktop` ist verlässlich (`os.homedir()` + `Desktop`).
- Windows: der Desktop kann lokalisiert oder per OneDrive/Known-Folder-Redirection verschoben sein. Ermittlung über die Known-Folder-Logik (Registry-Lookup des tatsächlichen Desktop-Pfads, `USERPROFILE` nur als Fallback). Niemals blind `%USERPROFILE%\Desktop`.
- Fallback-Kette: existiert der ermittelte Desktop nicht, fragt der Wizard nach einem Zielordner statt zu raten.

Implementiert in `src/core/paths.ts` als eine Funktion `resolveDesktopDir()`, die den geprüften, existierenden Basispfad zurückgibt oder eine klare Fehlermeldung wirft.

#### 4.3.2 Firmenname-Sanitisierung und Containment (sicherheitskritisch)

Der Firmenname ist Nutzereingabe, die in einen Pfad fließt. Der Anzeigename bleibt unverändert (in Konfig/Manifest), aber der Ordnername wird mehrstufig abgesichert (`src/core/sanitize.ts`):

1. Unicode-NFC-Normalisierung, Steuerzeichen entfernen.
2. Auf ein einziges Pfadsegment reduzieren: jeden Verzeichnistrenner verbieten (sowohl `/` als auch `\`), keine `..`-Sequenzen zulassen. Nicht nur naiv strippen, sondern verbotene Zeichen `<>:"/\|?*` entfernen.
3. Windows-reservierte Namen abfangen (`CON, PRN, AUX, NUL, COM1..COM9, LPT1..LPT9`), auch mit Endung (`NUL.txt` ist äquivalent zu `NUL`). Keine Punkte oder Leerzeichen am Ende.
4. Längen begrenzen (Segment und Gesamtpfad, MAX_PATH-Stolperstein unter Windows beachten). Leere oder nur-aus-Sonderzeichen-bestehende Ergebnisse abfangen, dann Fallback-Name (`Firma-<Zeitstempel>`) oder erneute Abfrage.
5. Containment-Prüfung nach Auflösung: finalen Pfad per `path.resolve(desktopDir, ordnername)` bilden und verifizieren, dass er tatsächlich unter dem aufgelösten Desktop-Basisordner liegt (Präfix-Check NACH der Auflösung, nicht davor). Liegt er außerhalb, harter Abbruch.

Werkzeug: `sanitize-filename` als Basis (deckt Steuerzeichen, reservierte Namen, trailing dots/spaces ab), ergänzt um die eigene NFC-Normalisierung UND die Containment-Prüfung. `sanitize-filename` allein ersetzt die Containment-Prüfung NICHT, beides kombinieren.

Beispiele:
- "Müller & Söhne GmbH" bleibt als Anzeigename erhalten, Ordner wird `Müller & Söhne GmbH` (echte Umlaute erlaubt, `&` ist unter beiden OS zulässig).
- "../../etc" wird zu einem harmlosen Segment reduziert bzw. abgewiesen, der Containment-Check greift zusätzlich.
- "NUL" wird abgefangen und zu `NUL-Firma` oder Rückfrage.

#### 4.3.3 Kollisionsbehandlung (idempotent)

Existiert `Desktop/<Ordnername>/` bereits:

- Enthält der Ordner eine gültige VoiceWall-Struktur (Marker `.voicewall/manifest.json`, siehe 4.4): als bestehenden Firmen-Datenraum weiterverwenden, nicht überschreiben. Der Wizard bietet an, diesen Bestand zu übernehmen (idempotent, kein Datenverlust).
- Existiert der Ordner, ist aber kein VoiceWall-Ordner (fremder Inhalt): NICHT hineinschreiben. Vorschlag eines alternativen Namens (`<Ordnername> (VoiceWall)` oder `<Ordnername>-2`), Rückfrage.
- Anlage ist atomar: erst in einen temporären `.voicewall-tmp-<rand>`-Ordner schreiben, dann per Rename an die finale Stelle bewegen. Bricht etwas ab, bleibt kein halbfertiger Firmenordner zurück.

Der App-Support-Ordner für Modelle/Runtime ist firmenunabhängig und wird geteilt: `~/Library/Application Support/VoiceWall/` (macOS) bzw. `%APPDATA%\VoiceWall\` (Windows), mit Unterordner `models/`. Modelle werden also einmal geladen und von allen Firmen auf dem Rechner genutzt (spart Platz).

### 4.4 Ordner-als-Datenbank: Schema

Es gibt KEINE echte Datenbank. Der Firmenordner IST die Datenbank. Alles sind Dateien, menschenlesbar, portabel, versionierbar, backup-fähig durch simples Kopieren.

#### 4.4.1 Unterordner-Struktur

```
Desktop/<Firmenname>/
  .voicewall/
    manifest.json          Index aller Diktate (fuer die Verwaltungs-UI)
    config.json            firmenbezogene Konfig (siehe 4.5)
    tags.json              bekannte Tags (fuer Autocomplete/Filter)
    .schema-version        Format-Version fuer Migrationen
  Diktate/
    2026/
      07/
        2026-07-02_143210_angebot-mueller.md
        2026-07-02_151145_protokoll-audit.md
  Exporte/
    2026-07-02_angebot-mueller.pdf
    2026-07-02_angebot-mueller.txt
  Anhaenge/                optionale Audio-Schnipsel, falls je aktiviert (Default: nichts)
  Papierkorb/             geloeschte Diktate (soft-delete, siehe 4.8)
```

- Der `.voicewall/`-Ordner ist der Verwaltungskern (versteckt vor dem Nutzer, damit er die Diktate nicht mit Metadaten verwechselt).
- `Diktate/` ist nach Jahr/Monat gegliedert, damit auch bei tausenden Einträgen die Ordner handhabbar bleiben und ein Datei-Explorer nicht überläuft.
- `Anhaenge/` bleibt per Default leer (Audio wird RAM-only verarbeitet und NICHT gespeichert, siehe Whisper-Recherche). Nur falls ein Kunde ausdrücklich Audio-Archivierung will, wandert hier ein Schnipsel hin, das ist eine bewusste Opt-in-Ausnahme.
- Restriktive Rechte: unter POSIX `0700` auf `.voicewall/` und den Firmenordner, damit nur der Nutzer liest.

#### 4.4.2 Transkript als Markdown mit YAML-Front-Matter

Jedes Diktat ist eine `.md`-Datei. Front-Matter trägt die Metadaten, der Body den Text. Damit ist jedes Diktat sofort in jedem Editor lesbar und ohne VoiceWall nutzbar (Datenportabilität).

```markdown
---
id: 2026-07-02_143210_a1b2c3       # stabile ID, kollisionsfrei
titel: "Angebot Müller"             # Nutzer-Titel, echte Umlaute
erstellt: 2026-07-02T14:32:10+02:00 # ISO 8601 mit Zeitzone
geaendert: 2026-07-02T14:35:02+02:00
sprache: de
modell: whisper-large-v3-turbo-german-q5_0
dauer_sekunden: 47                  # Laenge des Audios (nicht gespeichert)
wortzahl: 128
tags: [angebot, mueller, vertrieb]
quelle: diktat                      # diktat | import | manuell
ziel_app: "Microsoft Word"          # in welche App eingefuegt wurde (optional)
version: 1
---

Sehr geehrter Herr Müller, vielen Dank für Ihre Anfrage ...
```

Front-Matter-Felder im Detail:

- `id`: stabil, aus Zeitstempel plus kurzem Zufalls-Suffix, dient als Primärschlüssel im Manifest und als Dateiname-Basis.
- `erstellt`/`geaendert`: ISO 8601 mit Zeitzone, für Sortierung und Filter.
- `sprache`, `modell`: Nachvollziehbarkeit, welches Modell den Text erzeugt hat (Beleg-Gedanke).
- `dauer_sekunden`, `wortzahl`: für Statistik/Suche, ohne Audio zu speichern.
- `tags`: Liste, gepflegt aus `tags.json`.
- `quelle`: unterscheidet Diktat, Import und manuelle Notiz.
- `ziel_app`: in welche App das Ergebnis eingefügt wurde (optional, hilft dem Nutzer beim Wiederfinden).
- `version`: Schema-Version des einzelnen Eintrags, für spätere Migrationen.

#### 4.4.3 Namenskonventionen

Dateiname: `<YYYY-MM-DD>_<HHMMSS>_<slug>.md`, zum Beispiel `2026-07-02_143210_angebot-mueller.md`.

- Zeitstempel vorne, damit die Datei-Explorer-Sortierung chronologisch ist.
- `slug` aus dem Titel abgeleitet (kleingeschrieben, Umlaute zu Basis, Leerzeichen zu `-`, auf 40 Zeichen begrenzt). Der Slug ist nur für Dateisystem-Lesbarkeit, die echte Anzeige nutzt `titel` aus dem Front-Matter (mit echten Umlauten).
- Kollision im selben Sekunden-Zeitstempel: das Zufalls-Suffix der `id` wird an den Dateinamen gehängt.

#### 4.4.4 Index/Manifest für die Verwaltungs-UI

`.voicewall/manifest.json` ist der schnelle Lese-Index, damit die UI nicht bei jedem Start hunderte Markdown-Dateien parsen muss:

```json
{
  "schemaVersion": 1,
  "generiert": "2026-07-02T15:12:00+02:00",
  "eintraege": [
    {
      "id": "2026-07-02_143210_a1b2c3",
      "pfad": "Diktate/2026/07/2026-07-02_143210_angebot-mueller.md",
      "titel": "Angebot Müller",
      "erstellt": "2026-07-02T14:32:10+02:00",
      "geaendert": "2026-07-02T14:35:02+02:00",
      "tags": ["angebot", "mueller", "vertrieb"],
      "wortzahl": 128,
      "vorschau": "Sehr geehrter Herr Müller, vielen Dank ..."
    }
  ]
}
```

- Das Manifest ist ableitbar: Wahrheitsquelle bleiben immer die Markdown-Dateien. Ist das Manifest beschädigt oder fehlt, baut VoiceWall es durch einmaliges Scannen aller `.md`-Front-Matter neu auf (`manifest.ts:rebuildManifest()`). Damit ist das System robust und der Ordner bleibt auch ohne Manifest vollständig portabel.
- Schreibvorgänge am Manifest sind atomar (Schreiben in Tempdatei, dann Rename), damit ein Absturz das Manifest nicht zerreißt.
- Beim Anlegen/Ändern/Löschen eines Diktats wird das Manifest inkrementell aktualisiert, nicht komplett neu geschrieben (Performance bei großen Beständen).

#### 4.4.5 Suchansatz über Dateien

Zwei Ebenen, beide lokal, kein Index-Server:

- Schnellsuche (Default): über das Manifest (Titel, Tags, `vorschau`, Datum). In-Memory-Filter, sofort, für tausende Einträge ausreichend.
- Volltextsuche: bei Bedarf über die Markdown-Bodies. Umsetzung als Streaming-Scan der Dateien (kein Laden aller Inhalte in den RAM auf einmal) mit einfacher Case-insensitive-Substring- plus optionaler Token-Suche. Für sehr große Bestände optional ein lokaler, wiederaufbaubarer Volltext-Cache in `.voicewall/` (reines Ableitungsartefakt, jederzeit löschbar). Kein externes Search-Binary, keine native DB, damit compilerfrei und portabel.
- Filter kombinierbar: Zeitraum, Tag(s), Sprache, Volltext. Die Filterlogik liegt in `manifest.ts`.

### 4.5 Konfig-Datei

- Format: JSON.
- Ort: zwei Ebenen. Firmenbezogene Konfig in `Desktop/<Firmenname>/.voicewall/config.json` (reist mit dem Firmenordner mit, wichtig für Backup/Portabilität). Globale, firmenübergreifende Konfig (Hotkey, aktive Firma, Modellpfade) in `~/Library/Application Support/VoiceWall/config.json` bzw. `%APPDATA%\VoiceWall\config.json`.

Firmenbezogene `config.json` (Beispiel):

```json
{
  "schemaVersion": 1,
  "firma": {
    "anzeigename": "Müller & Söhne GmbH",
    "ordnername": "Müller & Söhne GmbH",
    "ansprechpartner": "Frau Schmidt",
    "email": "info@mueller-soehne.de",
    "standort": "Werk Süd",
    "hinweis": ""
  },
  "sprache": "de",
  "modell": "q5_0",
  "erstelltMit": "VoiceWall 1.0.0",
  "erstellt": "2026-07-02T14:20:00+02:00"
}
```

Globale `config.json` (Beispiel):

```json
{
  "schemaVersion": 1,
  "hotkey": "CommandOrControl+Shift+D",
  "aktiveFirma": "/Users/kunde/Desktop/Müller & Söhne GmbH",
  "firmen": [
    "/Users/kunde/Desktop/Müller & Söhne GmbH",
    "/Users/kunde/Desktop/Beispiel AG"
  ],
  "modellPfade": {
    "q5_0": "~/Library/Application Support/VoiceWall/models/ggml-model-q5_0.bin",
    "vad": "~/Library/Application Support/VoiceWall/models/ggml-silero-v5.1.2.bin"
  }
}
```

Regeln:

- KEINE Secrets. VoiceWall ist lokal, ohne API-Keys, ohne Passwörter, das ist ein DSGVO-Vorteil. Käme je ein schützenswerter lokaler Wert dazu, gehörte er in den OS-Keychain/Credential-Store, nie in Klartext.
- Restriktive Dateirechte (POSIX `0600`).
- Schema-Validierung beim Lesen (defensive Programmierung): eine manipulierte Konfig darf keinen Pfad außerhalb des erwarteten Basisordners erzwingen. Dieselbe Containment-Regel wie bei der Anlage greift beim erneuten Start (die Firmenpfade werden gegen `resolveDesktopDir()` bzw. gegen ihr gespeichertes Elternverzeichnis validiert). Ungültige Einträge werden ignoriert statt blind gefolgt.

### 4.6 Mehrere Firmen auf einem Rechner

Explizit unterstützt, häufiger Fall (Lars richtet auf einem Berater-/Kanzlei-Rechner mehrere Mandanten ein):

- Jede Firma ist ein eigener, in sich geschlossener `Desktop/<Firmenname>/`-Ordner mit eigener `config.json`, eigenem Manifest, eigenen Diktaten. Vollständige Datentrennung auf Dateisystemebene.
- Die globale `config.json` führt die Liste aller Firmen (`firmen[]`) und die aktuell aktive Firma (`aktiveFirma`).
- Die Verwaltungs-UI hat einen Firmen-Umschalter (oben, prominent). Ein Wechsel lädt das jeweilige Manifest und arbeitet ausschließlich in diesem Ordner. Ein Diktat landet immer in der gerade aktiven Firma.
- Neue Firma anlegen: der Wizard ist aus der Verwaltungs-UI erneut aufrufbar ("Neue Firma einrichten"), durchläuft nur Schritt 1 bis 5 (Firmendaten, Bestätigung), legt einen weiteren Firmenordner an und ergänzt die globale Konfig. Modelle werden geteilt, nicht erneut geladen.
- Datentrennung ist auditrelevant: Mandant A sieht nie Mandant B, weil physisch getrennte Ordner mit eigenen Rechten. Das ist ein starkes Argument für beratungsnahe Kunden.

### 4.7 Backup, Datenportabilität, Export

Backup und Portabilität sind trivial, genau weil der Ordner die Datenbank ist:

- Backup: der gesamte `Desktop/<Firmenname>/`-Ordner kopieren (USB, Netzlaufwerk, verschlüsselter Container). Nichts liegt in einer proprietären DB, nichts hängt an Registry/System-Keychain (keine Secrets). Kopieren genügt.
- Portabilität: der Ordner ist auf einen anderen Rechner übertragbar. Beim ersten Start dort erkennt VoiceWall die vorhandene `.voicewall/`-Struktur (Kollisionsbehandlung 4.3.3) und übernimmt sie. Die Diktate sind ohnehin reines Markdown, also auch komplett ohne VoiceWall lesbar.
- Restore: Ordner an die Desktop-Stelle legen, VoiceWall starten, Firma erscheint (ggf. über "Firma öffnen" den Pfad wählen).

Export (`src/core/export.ts`), pro Diktat oder als Stapel:

- Markdown: Direktkopie der `.md`-Datei (verlustfrei, mit Front-Matter oder ohne, wählbar).
- TXT: nur der Body, reiner Text, für maximale Kompatibilität.
- PDF: aus dem Markdown-Body gerendert. Umsetzung compilerfrei und lokal, ohne Headless-Chromium-Download-Ballast wenn möglich; im Electron-Kontext ist `webContents.printToPDF()` der naheliegende, lokale Weg (kein externes Tool, keine Netzwerkabhängigkeit). Echte Umlaute im PDF sind Pflicht.
- Stapel-Export: mehrere ausgewählte Diktate oder ein ganzer Zeitraum/Tag als ZIP oder als ein zusammengeführtes PDF/Markdown. Ziel ist `Exporte/` im Firmenordner.
- Alle Exporte sind rein lokal, kein Cloud-Dienst, kein Upload.

### 4.8 Feature-Set der Verwaltungs-UI

Die Verwaltungs-UI (`src/manage/`) ist die zweite Säule neben dem systemweiten Diktat. Sie liest ausschließlich aus dem aktiven Firmenordner. Funktionsumfang, umsetzungsreif:

- Liste: alle Diktate der aktiven Firma, sortierbar nach Datum (Default: neueste oben), Titel, Wortzahl. Anzeige aus dem Manifest (schnell), mit Titel, Datum, Tags, Vorschau-Snippet.
- Suche: Schnellsuche über Manifest (Titel/Tags/Vorschau) plus optionale Volltextsuche über die Bodies (4.4.5). Live-Filter beim Tippen.
- Filter: Zeitraum, Tag(s) (Mehrfachauswahl aus `tags.json`), Sprache, Quelle (Diktat/Import/manuell).
- Detailansicht: vollständiger Text plus Front-Matter-Metadaten (erstellt, geändert, Modell, Ziel-App, Dauer, Wortzahl).
- Bearbeiten: Titel und Body editierbar (Diktate enthalten gelegentlich Erkennungsfehler, Nachkorrektur muss möglich sein). Beim Speichern wird `geaendert` aktualisiert, `version` hochgezählt, Manifest inkrementell nachgeführt, atomares Schreiben.
- Tags: Hinzufügen/Entfernen pro Diktat, Autocomplete aus `tags.json`, neue Tags werden dort ergänzt. Tag-Umbenennung wirkt über alle betroffenen Diktate (Batch-Update mit atomarem Manifest-Rewrite).
- Manuelle Notiz: neuen Eintrag ohne Diktat anlegen (Quelle `manuell`), gleiche Struktur.
- Export: pro Eintrag oder Stapel als Markdown/TXT/PDF (Abschnitt 4.7), Ziel `Exporte/`.
- Löschen: Soft-Delete nach `Papierkorb/` (verschieben, nicht sofort vernichten), aus dem Papierkorb endgültig löschen mit Rückfrage. Damit ist ein versehentliches Löschen eines Kundendiktats umkehrbar. Manifest wird bei Soft-Delete aktualisiert (Eintrag ausgeblendet, Papierkorb separat sichtbar).
- Firmen-Umschalter: Wechsel zwischen mehreren Firmen (Abschnitt 4.6), Anlegen einer neuen Firma über den Wizard.
- Status/Beleg-Ansicht: kleiner Bereich, der den lokalen Charakter belegt (aktuelle Modellversion, Modellpfad, "0 externe Verbindungen", Link zum Installationslog/SBOM). Das ist die UI-Seite des "Beleg statt Behauptung"-Versprechens und dem Kunden direkt vorführbar.

DoD Verwaltungs-UI: Ein Diktat kann angelegt, gefunden (Schnell- und Volltextsuche), bearbeitet, getaggt, exportiert (Markdown/TXT/PDF) und per Soft-Delete gelöscht/wiederhergestellt werden; ein Firmenwechsel lädt korrekt den jeweils getrennten Bestand; alle Operationen schreiben atomar und aktualisieren das Manifest; im Betrieb zeigt der Netzwerk-Tab null externe Requests.

---

Hinweis zur Ablage: Es existiert noch kein VoiceWall-Repo. Dieser Abschnitt gehört in die neu anzulegende `ABARBEITUNG.md` eines neuen `voicewall/`-Repos (nicht in `/Users/larszimmermann/Documents/GitHub/der-ki-auditor`, das ist das KI-Auditor-Website-Repo). Die referenzierten Dateien (`install/voicewall-setup.sh|ps1`, `src/core/paths.ts`, `sanitize.ts`, `folderModel.ts`, `manifest.ts`, `export.ts`) sind in derselben Session mit anzulegen, in der die ABARBEITUNG.md umgesetzt wird.

## 5. Umsetzungs-Roadmap (Meilensteine)

Die Roadmap ist streng sequenziell. Sie ist bewusst so geschnitten, dass die drei Projektbrecher-Risiken (Whisper-Prozessmodell, npm-v12-Binary-Bezug, macOS-TCC-Persistenz) ganz am Anfang in einem Architektur-Spike entschieden werden, bevor Produktcode entsteht. Wird M1 uebersprungen, ist das gesamte Projekt gefaehrdet. Aufwandsschaetzungen sind grob und in Personentagen (PT) fuer eine fokussierte Umsetzung angegeben.

### M0: Setup, Repo, CI-Fundament

**Ziel:** Ein leeres, aber vollstaendig gehaertetes Projektgeruest, das compilerfrei baut und dessen CI ab der ersten Zeile rot wird, wenn Qualitaets- oder Sicherheitsregeln verletzt werden.

**Aufgaben (Checkliste):**
- [ ] Repo unter `/Users/larszimmermann/Documents/GitHub/voicewall/` anlegen (nicht Monorepo, ein `package.json`, `type: module`).
- [ ] Electron plus electron-vite plus TypeScript strict einrichten (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, Projektreferenzen main/renderer/shared).
- [ ] ESLint Flat-Config mit typed-linting und Modulgrenzen-Regeln: `src/renderer/**` darf `fs`/`child_process`/native Addons nicht importieren, `src/shared/**` weder Node- noch DOM-Globals. Prettier getrennt.
- [ ] Vitest- und Playwright-for-Electron-Grundgeruest.
- [ ] GitHub-Actions-Matrix (ubuntu, macos, windows): typecheck, lint (`--max-warnings 0`), format:check, test, build, e2e, `npm audit --audit-level=high`, `npm sbom` (CycloneDX-Artefakt), Lockfile-Guard.
- [ ] `LICENSE`, `NOTICE`, `THIRD_PARTY_LICENSES.md`, `SECURITY.md`, `.npmrc`, gepinnte `engines.node`.
- [ ] `app.requestSingleInstanceLock()` im Bootstrap (verhindert Doppelinstanz und Manifest-Korruption, siehe Kritik D8).
- [ ] Crash-Reporting hart deaktivieren: `crashReporter` nie starten, `app.setPath('crashDumps', ...)` auf ein beim Start geleertes Verzeichnis (Kritik B7).

**Definition of Done:** Leerer Electron-Shell-Start oeffnet ein Fenster ohne offenen Netzwerk-Port (IPC-only, kein `http`-Server im Code); DevTools-Network-Tab zeigt im Leerlauf null externe Requests; CI ist auf allen drei Plattformen gruen; ESLint-Modulgrenzen brechen bei einem Test-Verstoss die CI; nur eine Instanz startbar.

**Aufwand:** 2 bis 3 PT.

### M1: Architektur-Spike (Projektbrecher entscheiden, BLOCKIEREND)

**Ziel:** Die drei potenziell projektbrechenden Annahmen empirisch klaeren und die Architektur danach festschreiben. Dies ist der wichtigste Meilenstein. Kein weiterer Bau, bevor M1 abgeschlossen ist.

**Aufgaben (Checkliste):**
- [ ] **Whisper-Prozessmodell (Risiko R1):** `@fugood/whisper.node` sowohl im Main-Prozess als auch im `utilityProcess` auf mac-arm64, mac-x64 und win-x64 laden und ein kurzes deutsches WAV transkribieren. Verifizieren, ob `utilityProcess` die Electron-ABI behaelt oder ob `ELECTRON_RUN_AS_NODE`-Verhalten das Addon-Laden verhindert. Ergebnis: verbindliche Festlegung Main-Prozess-Load (Option A, empfohlen wegen einfacher Belegbarkeit) oder verifizierter utilityProcess (Option B).
- [ ] **N-API-Verifikation (Risiko R2):** Im echten `package.json`/`binding`-Code von `@fugood/whisper.node` pruefen, ob `node-api`/`napi_*` verwendet wird (ABI-stabil, ohne `electron-rebuild`) oder raw-nan/V8 (dann Rekompilierung pro Electron-Version noetig, was den Compiler zum Kunden zurueckbraechte). Wenn nan: Wrapper wechseln oder Electron-ABI-Prebuild vendored mitliefern. Fallback `@kutalia/whisper-node-addon` gegentesten.
- [ ] **npm-v12-Binary-Bezug (Risiko R3):** Im echten Paketbaum verifizieren, wie das plattformrichtige `.node` bezogen wird: reine Registry-optionalDependencies mit `os`/`cpu`-Gate (von `--allow-remote=none` unberuehrt) oder `postinstall`-Download von GitHub-Releases (unter npm v12 doppelt gebrochen). Ergebnis dokumentieren.
- [ ] **macOS-TCC-Persistenz (Risiko R4):** Ad-hoc-signiertes Bundle bauen, Accessibility- und Mikrofon-Grant erteilen, dann rebuilden und pruefen, ob der Grant ueber Rebuild und ueber Zeit haelt. Entscheidung ueber Developer-ID plus Notarisierung (99 USD/Jahr) als Standard-Signing-Weg gegen ad-hoc.
- [ ] **Latenz-Realismus (Risiko R9):** large-v3-turbo-german-Q5_0 auf einer bewusst schwachen Referenz-Windows-Maschine (4-Kern-i5, keine GPU) messen. Echte Sekunden pro Satz-Segment dokumentieren. Fallback-Modell (kleineres DE-Modell) fuer schwache Hardware festlegen.

**Definition of Done:** Fuer jede der fuenf Fragen liegt ein reproduzierbares Messergebnis mit Zahl oder Ja/Nein vor, kein Konjunktiv. Das Prozessmodell, der Signing-Weg, der Binary-Bezug und die Fallback-Modell-Strategie sind in Abschnitt 1 und 2 verbindlich nachgetragen. Ein Whisper-Transkript laeuft nachweislich auf allen drei Plattformen im gewaehlten Prozessmodell mit korrekter Electron-ABI, ohne `electron-rebuild`.

**Aufwand:** 3 bis 5 PT (Forschungsaufwand, bewusst grosszuegig).

### M2: STT-Kern (Aufnahme, Whisper, VAD, RAM-only)

**Ziel:** Von Mikrofon zu deutschem Text, komplett lokal, im RAM, ohne Auto-Paste.

**Aufgaben (Checkliste):**
- [ ] Audio-Capture im versteckten Fenster: `getUserMedia` mono, AudioWorklet als Blob-URL, 16 kHz Int16-PCM, RAM-Ringpuffer mit fester Obergrenze (DoS-Schutz), Consent-Screen mit Zeitstempel.
- [ ] macOS `NSMicrophoneUsageDescription` in `Info.plist`; `askForMediaAccess` proaktiv im Wizard.
- [ ] Whisper-Engine im gewaehlten Prozessmodell (Ergebnis M1): `transcribeData` mit `language: 'de'`, `temperature: 0.0`, `no_timestamps: true`.
- [ ] Silero-VAD-Segmentierung (ggml), Halluzinations-Abwehr (`min-speech-duration`, Stille-Schwellwert).
- [ ] Modell- und VAD-Download mit Fortschritt, SHA-256 gegen fest hinterlegte Konstante, idempotenter Cache. Checksum-Ursprung gegen zweite Quelle plus LFS-OID belegen (Risiko R14).
- [ ] PCM-Puffer nach jedem Segment aktiv ueberschreiben. Kein Audio auf Platte (per `fs`-Watch im Test verifizieren).

**Definition of Done:** Ein gesprochener deutscher Satz erscheint nach kurzer Pause als korrekter Text im Log/Testfenster; kurze Geraeusche erzeugen keinen Text; keine Audiodatei entsteht in Firmenordner, `~/.voicewall/` oder Temp; nach dem Download null externe Requests; SHA-256-Mismatch bricht sauber ab.

**Aufwand:** 4 bis 6 PT.

### M3: Systemweites Diktat (Hotkey und Auto-Paste mit Resilienz)

**Ziel:** Der vollstaendige Diktatpfad in eine fokussierte Fremd-App, mit dem Clipboard-Fallback als Primaerresilienz.

**Aufgaben (Checkliste):**
- [ ] Globaler Hotkey via `globalShortcut` (Toggle als Default). Konflikt-Handling (`register` gibt `false`). `unregisterAll()` beim Beenden.
- [ ] Push-to-talk: als mit `globalShortcut` unmoeglich dokumentieren (Risiko R15, Kritik B1). Entweder streichen oder nativen Key-Listener mit Kosten einplanen.
- [ ] Auto-Paste-Adapter hinter Interface: macOS `osascript` (Argument-Array, `execFile`), Windows PowerShell `SendKeys ^v` (prozess-scoped Bypass). Optionaler `@nut-tree-fork/nut-js`-Fallback.
- [ ] **Clipboard als Datenschutzmassnahme (Risiko R7):** vor dem Paste alten Inhalt sichern, danach sofort ueberschreiben/wiederherstellen; auf macOS `org.nspasteboard.ConcealedType`-Marker setzen; im Beleg-Blatt transparent machen.
- [ ] **Clipboard-plus-Kopieren-Knopf als PRIMAERER Resilienz-Pfad** (nicht Notnagel), solange TCC/UIPI-Risiken bestehen. Text geht nie verloren, auch wenn Auto-Paste scheitert.
- [ ] Windows-UIPI-Grenze dokumentieren: Auto-Paste scheitert gegen als-Admin laufende Ziel-Apps (Risiko R6, Kritik D2).
- [ ] macOS-Accessibility-Deep-Link im Wizard, `isTrustedAccessibilityClient(false)`-Check.
- [ ] Unterabschnitt "Warum VoiceWall das Accessibility-Recht braucht und was es damit NICHT tut" (Kritik B6): kein Keylogging, nur ein gekapseltes Cmd/Strg+V in `paste/macos.ts`, auditierbar.

**Definition of Done:** Diktat landet per Auto-Paste in Word, Outlook und Browser; bei fehlender Freigabe fuehrt der Wizard sichtbar durch die Berechtigung; scheitert Auto-Paste, ist der Text via Kopieren-Knopf verfuegbar; Transkript passiert die Zwischenablage nur mit ConcealedType-Marker und wird sofort ueberschrieben.

**Aufwand:** 4 bis 6 PT.

### M4: Sicherheits- und Datenschutz-Fundament haerten

**Ziel:** Die Schutzbehauptungen aus Abschnitt 3 vollstaendig implementieren und beweisbar machen.

**Aufgaben (Checkliste):**
- [ ] Firmenname-Sanitisierung: NFC, Steuerzeichen, Segment-Reduktion, `sanitize-filename`, Windows-Reserved (auch `NUL.txt`), Containment nach `path.resolve`. NFD-Vergleichsfall auf macOS und case-insensitive-Kollision ergaenzen (Kritik B4).
- [ ] Command-Injection-Abwehr: ausnahmslos `execFile`/`spawn` mit Argument-Array, kein `exec` mit String, Firmenname nie in Shell.
- [ ] Harte Laufzeit-CSP (kein `unsafe-inline`/`unsafe-eval`, `connect-src 'self'`), Download-CSP als klar begrenzter Ausnahmezustand, Umschalt-Log.
- [ ] Falls HTTP-Fallback: Loopback-Bindung, ephemerer Port, Bearer-Token nur im Header (nie in URL, Kritik B2), Origin/Host-Guard. Klar als Nachrang zu Electron-IPC markieren.
- [ ] Input-Schemavalidierung (zod) ueberall, Output-Encoding (kein `innerHTML` fuer Nutzerinhalte), Markdown nur via Sanitizer.
- [ ] Logging strukturiert, rotiert, ohne Transkriptinhalte, Rechte `0600`/`0700`. Redaction-Test.
- [ ] Supply-Chain: Lockfile committet, `npm ci`, SHA-256-Pinning jeder `.node`, CycloneDX-SBOM, keine kompilierende `binding.gyp` im Baum, Dependabot. Silero-VAD-Version pinnen und Lizenz belegen (Kritik D12).
- [ ] Netzwerk-Selbsttest als dokumentierte "So pruefen Sie das selbst"-Prozedur.

**Definition of Done:** Alle 12 Punkte der Abschnitt-3-DoD erfuellt und je mit einer reproduzierbaren Pruefung belegt; Portscan von zweitem Geraet zeigt keinen offenen Port; Sanitisierung besteht Traversal-, Reserved-, NFC/NFD- und Kollisions-Tests; SBOM erzeugt; kein Telemetrie-Code im Baum.

**Aufwand:** 4 bis 5 PT.

### M5: Ordner-als-Datenbank (Datenmodell, Manifest, Migration)

**Ziel:** Das portable Datei-Datenmodell mit robustem, selbstheilendem Manifest und einer echten Migrationsroutine.

**Aufgaben (Checkliste):**
- [ ] Ordnerstruktur (`.voicewall/`, `Diktate/YYYY/MM/`, `Exporte/`, `Papierkorb/`), Rechte `0700`.
- [ ] Transkript als Markdown mit YAML-Front-Matter (id, titel, erstellt, modell, tags, version). Dateinamens-Konvention mit Slug plus id-Suffix.
- [ ] Manifest inkrementell und atomar (Temp plus Rename), `rebuildManifest()` als Selbstheilung. Pfad-Vergleiche NFC-normalisiert (Kritik B4).
- [ ] Konfig zweistufig (firmenbezogen plus global), zod-Validierung beim Lesen, Containment auch beim Neustart, keine Secrets.
- [ ] **Migrationsroutine (Risiko R12, Kritik D6):** idempotente, atomare, backup-erst Migration mit Rollback fuer `schemaVersion`-Aenderungen. Nicht nur `schemaVersion` als Dekoration, sondern echte, getestete Migration.
- [ ] **Sync-Falle entschaerfen (Risiko R8, Kritik D11):** OneDrive/iCloud/Time-Machine-Redirection des Desktop erkennen und warnen; Diktate in einen bewusst nicht-synchronisierten lokalen Pfad legen, nur eine Verknuepfung auf dem Desktop. Dies rettet das "100 Prozent lokal"-Kernversprechen.
- [ ] Mehr-Firmen-Trennung (eigene Ordner, globaler Umschalter). Fast-User-Switching und Mehrbenutzer-Fall klaeren (Kritik D7).

**Definition of Done:** Diktat schreiben, wiederfinden, Manifest-Rebuild nach Loeschen des Manifests funktioniert; eine simulierte v1-zu-v2-Schema-Migration laeuft backup-erst und rollback-faehig; Desktop-Sync wird erkannt und der Nutzer gewarnt oder umgeleitet; zwei Firmen sind physisch getrennt.

**Aufwand:** 5 bis 7 PT.

### M6: Installer und First-Run-Wizard (On-Site, offline, idempotent)

**Ziel:** Der compilerfreie, idempotente On-Site-Install unter 10 Minuten, mit Offline-Vendoring als Default.

**Aufgaben (Checkliste):**
- [ ] Bootstrap `voicewall-setup.sh`/`.ps1` gehaertet (`set -euo pipefail`, `Set-StrictMode`), Doppelklick-Wrapper, review-then-run, kein `curl | bash`.
- [ ] Acht Schritte check-then-do: Preflight, portable Node, Skript-Haertung, `npm ci`, Ad-hoc- oder Developer-ID-Signing (mac), Verifikation (`npm audit`, SBOM), Start plus Health-Poll, First-Run-Erkennung.
- [ ] **Offline-Vendoring je Plattform als Default (Risiko R3, R10, Kritik A2/C2):** je Zielplattform (mac-arm64, mac-x64, win-x64) ein eigener vorbereiteter Vendor-Stand (npm-Cache plus plattformrichtige `.node` plus Modell). `npm ci --offline`. HF-Download nur als Ausnahme.
- [ ] CI-Job, der `npm ci` unter npm-v12-Restriktiv-Defaults ausfuehrt und die Existenz der plattformrichtigen `.node` asserted.
- [ ] Wizard-Flow (Firmendaten, Sprache DE, Modell Q5_0, Hotkey, Bestaetigung, atomare Anlage). Modellwahl je Hardware. AI-Act-Transparenzhinweis. Barrierefreiheit (BFSG) pruefen und A11y-Strategie ergaenzen (Kritik D4).
- [ ] Deinstallation entfernt nur `~/.voicewall/` und App-Support, laesst Firmendaten stehen (Rueckfrage).

**Definition of Done:** On-Site-Install laeuft offline auf mac und win in unter 10 Minuten durch; erneutes Ausfuehren ist idempotent (unter 30 Sekunden); Firmenordner entsteht; Testtranskription per Auto-Paste; Netzwerk-Tab belegt null externe Requests; CI-Assert auf `.node` unter npm-v12-Defaults gruen.

**Aufwand:** 5 bis 7 PT.

### M7: Verwaltungs-UI (v1-Scope, ehrlich geschnitten)

**Ziel:** Die zweite Saeule neben dem Diktat, auf das v1-Notwendige geschnitten (Kritik C3).

**Aufgaben (Checkliste):**
- [ ] **v1:** Liste, Schnellsuche (Manifest), Tags, MD/TXT-Export, Soft-Delete/Papierkorb, Detailansicht, Bearbeiten (atomar, `geaendert`/`version` nachfuehren), Firmen-Umschalter, Beleg-Ansicht ("0 externe Verbindungen", Modellversion, SBOM-Link).
- [ ] **Explizit v1.1 (nicht v1):** PDF-Export, Volltext-Cache, Tag-Batch-Rename. So markieren, damit sich das Kernprodukt nicht hinter UI-Ausbau verschiebt.
- [ ] Genau eine sichtbare H1 je Ansicht (Konsistenz-Standard des Auftraggebers).

**Definition of Done:** Diktat anlegen, per Schnellsuche finden, bearbeiten, taggen, als MD/TXT exportieren, per Soft-Delete loeschen und wiederherstellen; Firmenwechsel laedt getrennten Bestand; alle Operationen schreiben atomar; Netzwerk-Tab null externe Requests; v1.1-Posten sind sichtbar zurueckgestellt.

**Aufwand:** 6 bis 8 PT.

### M8: Export, PDF, Backup-Haertung (v1.1)

**Ziel:** Die zurueckgestellten Export- und Backup-Funktionen sauber nachziehen.

**Aufgaben (Checkliste):**
- [ ] PDF-Export via `webContents.printToPDF()`. **DoD-Pflichtpunkt: echte Umlaute ae oe ue ss im PDF korrekt eingebettet** (Kritik C4).
- [ ] Stapel-Export (ZIP oder zusammengefuehrtes PDF/MD), Ziel `Exporte/`.
- [ ] Volltext-Cache (ableitbar, loeschbar), Tag-Batch-Rename mit atomarem Manifest-Rewrite.
- [ ] **Backup-Verschluesselung (Risiko R16, Kritik D10):** FileVault/BitLocker-Empfehlung im Beleg-Blatt, optionaler verschluesselter Export. Hinweis, dass Klartext-Markdown mit moeglichen Art.-9-Daten unverschluesselt kopiert wird.

**Definition of Done:** PDF mit korrekten Umlauten erzeugt; Stapel-Export funktioniert; Volltextsuche liefert Treffer aus Bodies; Backup-Verschluesselungs-Hinweis im Beleg-Blatt; verschluesselter Export optional verfuegbar.

**Aufwand:** 4 bis 5 PT.

### M9: Vertriebsreife, Rechtstexte, Release

**Ziel:** Produkt und Verkauf rechtssicher und auslieferungsreif machen.

**Aufgaben (Checkliste):**
- [ ] Produkt-Rechtstexte: `§ 5 DDG` (nicht TMG), `TDDDG` (nicht TTDSG), CI-Grep gegen aktive TMG/TTDSG-Zitate.
- [ ] **Vertriebs-Rechtstexte (Risiko R17, Kritik D5):** Fernabsatz-Widerrufsbelehrung und Widerrufsbutton nach § 356a BGB fuer den 49-Euro-Verkauf, getrennt vom Produkt-Impressum.
- [ ] DSGVO-Beleg-Blatt (kein AVV noetig, kein Drittlandtransfer, Beweisbarkeit) kundenfertig beilegen.
- [ ] **Windows-Code-Signing (Risiko R5/R18, Kritik D1/D3):** EV/Standard-Zertifikat einplanen und als Kostenposition fuehren, oder dokumentiertes Defender-Ausnahme-Vorgehen mit Kundeneinwilligung. AV-Whitelisting-Doku fuer das Whisper-`.node`.
- [ ] AI-Act-Einordnung mit woertlichem Art.-50(2)-Carveout belegen (nicht nur argumentieren, Kritik B8).
- [ ] SemVer 1.0.0, Conventional Commits, CHANGELOG, getaggter Release, SBOM plus Checksummen je Release.
- [ ] Abnahme-Checkliste: echter Paste-Pfad auf mac und win manuell verifiziert; On-Site-Protokoll durchgespielt.

**Definition of Done:** Vertriebs- und Produkt-Rechtstexte vollstaendig und aktuell; CI-Grep gruen; Windows-Signing-Entscheidung getroffen und umgesetzt oder dokumentiert; Beleg-Blatt beigelegt; Release 1.0.0 getaggt mit SBOM und Checksummen; manuelle Abnahme auf beiden Plattformen bestanden.

**Aufwand:** 4 bis 6 PT.

**Gesamtaufwand grob:** 41 bis 58 PT bis Release 1.0.0, ohne die als v1.1 markierten Ausbaustufen und ohne unerwartete Ergebnisse aus dem M1-Spike. M1 kann den Gesamtaufwand nach oben verschieben, falls der Whisper-Wrapper doch nan statt N-API ist oder das utilityProcess-Modell scheitert.

## 6. Risikoregister

Das Register speist sich aus der Kritik-Runde. Die drei mit "Kritisch" bewerteten Risiken R1 bis R3 sowie R8 sind vor beziehungsweise waehrend des Architektur-Spikes (M1, M5, M6) zu klaeren. Die Reihenfolge ist grob nach Prioritaet sortiert.

| # | Risiko | Wahrscheinlichkeit | Wirkung | Gegenmassnahme |
|---|---|---|---|---|
| R1 | Whisper-Addon laedt im `utilityProcess` nicht (ELECTRON_RUN_AS_NODE, ABI-Mismatch), Kernfeature startet nicht | Hoch | Kritisch | Prozessmodell im Spike klaeren: Main-Prozess-Load (Option A) vs verifizierter utilityProcess (Option B); ABI-Test auf mac-arm64, mac-x64, win-x64 als Definition of Done (M1) |
| R2 | `@fugood/whisper.node` ist kein N-API-Addon, sondern raw-nan, damit Rekompilierung pro Electron-Version noetig, Compiler kehrt zum Kunden zurueck | Mittel | Kritisch | Im echten Code `napi_*` vs nan pruefen; wenn nan: Wrapper wechseln oder Electron-ABI-Prebuild vendored mitliefern; Fallback `@kutalia/whisper-node-addon` (M1) |
| R3 | npm v12 (`--allow-remote=none`, Install-Skripte aus) bricht den Binary-Bezug vor Ort, `npm ci` laeuft ohne `.node` durch | Hoch | Kritisch | Bezugsweg im echten Paketbaum verifizieren; Offline-Vendoring je Plattform zur Pflicht machen; CI-Assert auf `.node`-Existenz unter v12-Defaults (M1, M6) |
| R8 | Desktop-Ordner wird via OneDrive/iCloud/Time-Machine in die Cloud synchronisiert, "100 Prozent lokal" ist gebrochen | Mittel bis Hoch | Kritisch | Sync-Redirection erkennen und warnen; Diktate in nicht-synchronisierten lokalen Pfad legen, nur Verknuepfung auf dem Desktop (M5) |
| R4 | macOS-TCC verwirft den Ad-hoc-Grant ueber Zeit oder nach Rebuild, Auto-Paste und Mikrofon fallen still aus | Mittel bis Hoch | Hoch | Developer-ID plus Notarisierung (99 USD/Jahr) statt ad-hoc; Clipboard-Fallback als Primaerresilienz; dokumentierter Re-Grant-Schritt (M1, M3) |
| R5 | Windows AV/EDR/AppLocker blockiert unsigniertes exe plus SendKeys plus PowerShell-Bypass als Verhaltens-Malware | Mittel bis Hoch | Hoch | Windows-Code-Signing-Zertifikat; nativer Paste-Fallback; Defender-Ausnahme-Doku mit Kundeneinwilligung (M9) |
| R7 | Transkript leakt ueber die OS-Zwischenablage an Clipboard-Manager-Tools des Kunden | Mittel | Hoch (DSGVO, Art. 9 moeglich) | ConcealedType-Marker, sofortiges Clipboard-Overwrite als Datenschutzmassnahme, Transparenz im Beleg-Blatt (M3) |
| R6 | Windows-Auto-Paste scheitert gegen elevierte Ziel-Apps (UIPI, als-Admin laufendes Word) | Mittel | Mittel | Kopieren-Knopf-Fallback Pflicht; klare Doku der Grenze (M3) |
| R9 | Latenz auf schwacher Windows-Hardware zerstoert das Diktiergeraet-Gefuehl | Mittel | Mittel bis Hoch | Auf Referenz-Schwach-Hardware messen; kleineres DE-Modell als echten Fallback, nicht nur Q4 (M1) |
| R10 | On-Site-Modell-Download (574 MB) scheitert an Kundennetz, Proxy oder Firewall, Termin platzt | Mittel | Mittel | Offline-Modell-Vendoring als Default (M6) |
| R11 | Audio landet trotz "RAM-only"-Claim ueber Swap oder Crash-Dump doch auf Platte | Niedrig bis Mittel | Mittel (Ueberclaim-Risiko) | `crashReporter` nie starten, crashDumps-Pfad leeren; Claim ehrlich mit Swap-Fussnote (M0, M2) |
| R12 | Schema-Migration bei v2 zerstoert oder verwaist bestehende Diktate | Niedrig jetzt, Hoch spaeter | Hoch (Kundendatenverlust) | Migrationsroutine backup-erst, atomar, rollback-faehig als Definition of Done (M5) |
| R13 | Zwei Instanzen korrumpieren das Manifest oder registrieren denselben globalShortcut doppelt | Niedrig | Mittel | `app.requestSingleInstanceLock()` (M0) |
| R14 | Modell-Checksumme versiegelt einen manipulierten Ursprung (Trust-on-First-Use) | Niedrig | Hoch | Ursprung gegen zweite Quelle plus HuggingFace-LFS-OID belegen und im NOTICE dokumentieren (M2) |
| R15 | Push-to-talk wurde als Feature versprochen, ist mit `globalShortcut` aber unmoeglich | Mittel | Niedrig bis Mittel | PTT streichen oder nativen Key-Listener samt Kosten (prebuilt, ABI, Rechte) einplanen (M3) |
| R16 | Unverschluesseltes Klartext-Backup hochsensibler Diktate auf USB-Stick | Mittel | Hoch (DSGVO) | FileVault/BitLocker-Empfehlung plus optionaler verschluesselter Export (M8) |
| R17 | Vertriebsrechtliche Luecke (Widerruf, § 356a BGB) beim 49-Euro-Verkauf | Mittel | Mittel (Abmahnung) | Fernabsatz-Rechtstexte plus Widerrufsbutton, getrennt vom Produkt-Impressum (M9) |
| R18 | Windows-EDR flaggt das Whisper-`.node` per Malware-Heuristik | Niedrig bis Mittel | Mittel | Code-Signing (siehe R5) plus AV-Whitelisting-Doku (M9) |

## 7. Empfehlungen: sauberer und sicherer geloest, und was noch fehlt

Die vier Fach-Abschnitte sind ueberdurchschnittlich, in Teilen exzellent. Stark und beizubehalten sind: STRIDE mit bewussten Ausschluessen, die CSP als Exfiltrations-Beweis samt Kunden-Selbsttest, das Ordner-als-DB-Modell mit ableitbarem Manifest und Rebuild-Selbstheilung, die DSGVO-Argumentation (kein AVV, kein Drittland), der woertliche Art.-50-Carveout fuer reine Transkription, DDG statt TMG, SBOM und SHA-256-Pinning, sowie die `execFile`-Command-Injection-Abwehr mit Containment nach `path.resolve`. Das ist Auditor-Niveau. Die folgenden Empfehlungen sind das, was zwischen "beeindruckendes Dokument" und "laeuft beim echten Kunden durch" steht, ehrlich priorisiert.

### Prioritaet 1: Die drei Projektbrecher zuerst empirisch klaeren (vor jeder weiteren Zeile)

R1 bis R3 sind der einzige echte Show-Stopper. Ein halbtaegiger bis mehrtaegiger Spike (Whisper-Addon im Main-Prozess UND im utilityProcess auf mac und win laden und transkribieren; im echten Code N-API vs nan pruefen; den Binary-Bezug im Paketbaum verifizieren) entscheidet die gesamte Architektur. Das gehoert vor alles andere (Meilenstein M1). Der Grund ist der Markenkern: In den Abschnitten steht an genau diesen Stellen "im utilityProcess laden" und "N-API, also ABI-stabil" als Behauptung, nicht als Beleg. Bei diesem Auftraggeber ist eine unbelegte tragende Annahme der schwerste Fehler.

### Prioritaet 2: Signing ehrlich als Kostenposition fuehren, nicht wegdefinieren

Die Tradeoff-Tabelle in Abschnitt 1.1 beschoenigt die Signing-Frage mit "keine Developer ID noetig". Das ist eine Fehlentscheidung aus Bequemlichkeit. Ad-hoc-Signatur ist die minimale Voraussetzung, damit macOS-TCC ueberhaupt eine Zuordnung bilden kann, aber sie kann bei Rebuild oder ueber Zeit brechen (R4). Fuer ein kommerzielles Produkt, das systemweite Eingabe simuliert und von einem Auditor verkauft wird, sind macOS Developer ID plus Notarisierung (99 USD/Jahr) und ein Windows-Code-Signing-Zertifikat keine Option, sondern Pflichtausstattung. Sie loesen R4 und R5 dauerhaft. Die 1.1-Tabelle ist entsprechend zu korrigieren, und die Formulierung "haelt die Berechtigung ueber Neustarts" ist abzuschwaechen.

### Prioritaet 3: Nicht auf den Sync-Desktop schreiben

R8 ist der stillste und gefaehrlichste Widerspruch zum Kernversprechen. Der bewusst gewaehlte Speicherort (Desktop) kann die Nicht-Cloud-Garantie unterlaufen, weil der Windows-Desktop oft OneDrive-redirected ist und der macOS-Desktop in iCloud/Time-Machine synct. Ein "100 Prozent lokal"-Produkt, dessen Diktate automatisch in Microsofts oder Apples Cloud landen, zerstoert sein Fundament. Empfehlung: Sync-Redirection erkennen und warnen, Diktate in einen bewusst nicht-synchronisierten lokalen Pfad legen und dem Nutzer per Verknuepfung auf dem Desktop zeigen (M5).

### Prioritaet 4: Clipboard als Datenschutz-, nicht Hoeflichkeitsproblem behandeln

Zwischen `clipboard.writeText` und dem simulierten Cmd/Strg+V liegt ein Zeitfenster, in dem das Transkript in der systemweiten Zwischenablage steht und von Clipboard-Manager-Tools mitgelesen und persistiert werden kann (R7). Das ist ein realer, in keinem Abschnitt benannter Datenabfluss vertraulicher Diktate, der dem "RAM-only"-Versprechen widerspricht. Empfehlung: ConcealedType-Marker setzen, Clipboard sofort nach dem Paste ueberschreiben, und diesen Restfluss im Beleg-Blatt transparent machen (M3).

### Prioritaet 5: Offline-Vendoring je Plattform als Default-Auslieferung

Das entschaerft in einem Zug R3 (npm-v12-Binary-Bezug), R10 (Modell-Download-Risiko im Kundennetz) und den optimistischen "unter 10 Minuten"-Anspruch. Wichtig und in keinem Abschnitt genannt: `node_modules` und der Vendor-Stand sind plattformspezifisch, es braucht je Zielplattform (mac-arm64, mac-x64, win-x64) einen eigenen vorbereiteten Vendor-Stand, nicht einen (M6).

### Prioritaet 6: Jeden "beweisbar"-Claim mit exakt einer reproduzierbaren Pruefung hinterlegen

Der Netzwerk-Tab-Selbsttest ist vorbildlich. RAM-only (mit Swap- und Crash-Dump-Fussnote, R11), TCC-Persistenz und das utilityProcess-Native brauchen dasselbe Niveau. Wo das nicht geht, wird der Claim ehrlich abgeschwaecht statt ueberversprochen.

### Was Lars vergessen hat (Luecken, die kein Fach-Abschnitt nennt)

Diese Punkte sind ehrlich zu ergaenzen, weil sie beim echten Kunden oder beim eigenen Verkauf zuschlagen:

- **Windows-SmartScreen, AV, EDR und AppLocker (D1, D3).** Ein unsigniertes, frisch gebautes exe plus PowerShell-Bypass plus SendKeys wird auf gehaertetem Firmen-Windows nicht nur gewarnt, sondern als Verhaltens-Malware geflaggt oder blockiert. Das ist die realistischste On-Site-Bruchstelle auf Windows. Gegenmassnahme: Code-Signing als Kostenposten plus AV-Whitelisting-Doku.
- **Windows-UIPI-Grenze (D2).** SendKeys aus einem nicht-elevierten Prozess kann einer als-Admin laufenden Ziel-App keine Eingaben senden. Der Kopieren-Knopf-Fallback ist Pflicht, die Grenze ist zu dokumentieren.
- **Schema-Migration (D6).** `schemaVersion` steht ueberall, aber es gibt keine beschriebene Migrationsroutine. Ohne idempotente, atomare, backup-erst Migration mit Rollback ist das nur Dekoration und ein Datenverlust-Risiko (R12).
- **Genau-eine-Instanz-Sperre (D8).** `app.requestSingleInstanceLock()` fehlt. Zwei Instanzen korrumpieren Manifest und Hotkey.
- **Barrierefreiheit (BFSG, D4).** Seit 28.06.2025 gilt das Barrierefreiheitsstaerkungsgesetz. Ob VoiceWall darunterfaellt, ist zu pruefen; fuer einen Auditor, der Compliance verkauft, waere eine unbarrierefreie UI ein Eigentor.
- **Vertriebsrecht (D5, R17).** Die Abschnitte regeln die Produkt-Rechtstexte (DDG statt TMG, gut), aber nicht die Vertriebs-Rechtstexte. Beim 49-Euro-Fernabsatz greifen Widerrufsbelehrung und Widerrufsbutton nach § 356a BGB. Fuer einen Auditor waere ein unsauberer eigener Verkauf peinlich.
- **Backup-Verschluesselung (D10, R16).** "Ordner kopieren = Backup" bedeutet unverschluesselter Export potenziell hochsensibler Klartext-Diktate. Mindestens FileVault/BitLocker-Empfehlung im Beleg-Blatt, optional verschluesselter Export.
- **Mehrbenutzer und Fast-User-Switching (D7).** Bei mehreren Nutzerkonten auf einem Kanzlei-Rechner ist unklar, wessen Desktop, Konfig und TCC-Grant gilt. Nicht behandelt.
- **Push-to-talk (D, R15).** Mit `globalShortcut` unmoeglich, nicht nur unzuverlaessig. Entweder streichen oder nativen Key-Listener samt Kosten einplanen.
- **Silero-VAD-Version pinnen (D12).** MIT gilt fuer v5, aeltere Distributionen hatten abweichende Lizenzlagen. Version pinnen und Lizenz zum konkreten Artefakt belegen.

### Positiv-Befund zur Staerkung

Die AI-Act-Einordnung ist nicht nur korrekt, sondern unterverkauft (B8). Art. 50(2) hat einen woertlichen Carveout: die Kennzeichnungspflicht gilt nicht, wenn KI-Systeme "perform an assistive function for standard editing or do not substantially alter the input data provided by the deployer or the semantics thereof". Reine Transkription veraendert die Semantik der Eingabe nicht und faellt damit woertlich unter den Carveout, nicht nur nach Auslegung. In Abschnitt 3.10 ist dieser woertliche Carveout zu zitieren statt nur zu argumentieren. Das macht die Rechtsposition belastbar statt bloss plausibel und ist selbst ein Kompetenzbeleg.

## 8. Anhang: Impressum-Baustein (FERNAU Präzisionstechnik GmbH)

VoiceWall wird als Angebot der FERNAU Präzisionstechnik GmbH veröffentlicht (Lizenznehmerin der Marke "Der KI-Auditor"; die Marke gehört Lars Zimmermann privat und ist der FERNAU überlassen, Entscheidung des Auftraggebers vom 02.07.2026). Das Impressum wird eins zu eins von der-ki-auditor.de/impressum übernommen. Zu verlinken auf der Projekt- und Verteilungsseite und im Repo-README; im First-Run-Wizard und im "Über"-Bereich der App genügt ein Link auf dieselbe Quelle. Rechtsgrundlage durchgängig DDG, nicht TMG.

### 8.1 Anbieter gemäß § 5 DDG

FERNAU Präzisionstechnik GmbH
Merianstraße 5a
64291 Darmstadt
Deutschland

Vertreten durch die Geschäftsführung: Clara Fernau, Theodor Fernau, Lars Zimmermann
Telefon: +49 6150 184973-0
E-Mail: die auf der Live-Seite gegen Spam verschleierte Adresse beim Umsetzen eins zu eins von der-ki-auditor.de/impressum übernehmen, nicht abtippen und nicht erfinden.
Registergericht: Amtsgericht Darmstadt, HRB 7378
Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: DE812710783
Inhaltlich verantwortlich gemäß § 18 Abs. 2 MStV: Lars Zimmermann, Anschrift wie oben.

### 8.2 Pflicht-Hinweise für die Umsetzung

- Rechtsgrundlagen im Impressum: § 5 DDG sowie § 7 DDG in Verbindung mit dem Digital Services Act (Verordnung (EU) 2022/2065). Niemals TMG oder RStV zitieren (häufiger Fehler, den der Auftraggeber gerade beim Wettbewerber aufgedeckt hat).
- Haftungsschutz für das kostenlose, quelloffene Tool ergibt sich aus der Open-Source-Lizenz (Haftungs- und Gewährleistungsausschluss), nicht aus dem Weglassen des Impressums. Ein Impressum ist trotz Kostenlosigkeit Pflicht, weil das Angebot geschäftsmäßig unter einer Marke erfolgt.
- Datenschutz: Da VoiceWall zu 100 Prozent lokal arbeitet und keine personenbezogenen Daten an Dritte übermittelt, ist die Datenschutzerklärung kurz und beweisbar wahr: "Es werden keine Sprach- oder Textdaten übermittelt, weil kein Server existiert, der sie empfangen könnte." Für die Projektwebseite und das Repo als Telemedium gelten zusätzlich die üblichen Hinweise nach Art. 13 DSGVO. Details in Abschnitt 3.
- Vertriebsrechtstexte für den 49-Euro-Vor-Ort-Dienst (Widerrufsbelehrung, Widerrufsbutton nach § 356a BGB) sind separat zu regeln, siehe Abschnitt 7 und Risikoregister.
