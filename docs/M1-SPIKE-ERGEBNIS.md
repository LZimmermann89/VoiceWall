# M1 Architektur-Spike: Ergebnisbericht

Datum: 2026-07-03. Maschine: MacBook Pro M1 Max (10 Kerne, 32 GB RAM), macOS 26.5 (Build 25F71), Node v26.0.0, npm 11.12.1.
Getestet gegen exakt **Electron 43.0.0** (interner Node 24.17.0, ABI `modules=148`) und **@fugood/whisper.node 1.0.22** (zugleich `latest` auf npm, Stand 2026-07-03).
Spike-Code liegt unter dem Session-Scratchpad (`m1-spike/`), das Produkt-Repo wurde nicht verändert. Alle Transkriptionen liefen RAM-only über `transcribeData(ArrayBuffer)`, nie über Dateipfad-APIs.

Testaudio (lokal mit `say -v Anna` erzeugt, `afconvert ... -d LEI16@16000 -c 1`, also 16 kHz mono 16-bit PCM):

| Datei    | Dauer  | Inhalt                                             |
| -------- | ------ | -------------------------------------------------- |
| test.wav | 3,24 s | "Guten Tag, dies ist ein Testdiktat für VoiceWall" |
| t2.wav   | 2,99 s | Wettersatz                                         |
| t5.wav   | 4,19 s | Vertragssatz                                       |
| t10.wav  | 9,85 s | Zwei Sätze Geschäftskorrespondenz                  |

Modell: `ggml-model-q5_0.bin` aus `cstr/whisper-large-v3-turbo-german-ggml`, 574.041.195 Bytes.
**SHA-256: `15e92e3db0993c52fffa781513eec9253475331c1be808f8fb409285c9d9d030`** (selbst berechnet mit `shasum -a 256`; identisch mit dem Hugging-Face-LFS-OID laut `https://huggingface.co/api/models/cstr/whisper-large-v3-turbo-german-ggml/tree/main`, damit ist der R14-Quercheck gegen eine zweite Quelle erledigt).

---

## F1: Whisper-Prozessmodell (R1)

### Messergebnis

| Prozessmodell  | Addon lädt | Transkript (test.wav)                                | Transkriptionsdauer          |
| -------------- | ---------- | ---------------------------------------------------- | ---------------------------- |
| Main-Prozess   | **Ja**     | "Guten Tag, dies ist ein Testdiktat für Voice Wall." | 1264 ms / 1228 ms (Pass 1/2) |
| utilityProcess | **Ja**     | "Guten Tag, dies ist ein Testdiktat für Voice Wall." | 1353 ms / 1259 ms (Pass 1/2) |

Beide Prozessmodelle laden das Addon in Electron 43.0.0 **ohne electron-rebuild** und transkribieren korrekt (einzige Abweichung: "Voice Wall" statt "VoiceWall", was bei einem Kunstwort erwartbar ist). Metal-GPU wird in beiden Prozessen initialisiert (`ggml_metal_device_init: GPU name: MTL0 (Apple M1 Max)` erscheint im Log beider Prozesse). Modell-Ladezeit Main 295 bis 440 ms, utilityProcess 318 ms, also kein messbarer Overhead durch utilityProcess.

Der `utilityProcess` behält die Electron-ABI: im Kind ist `process.type === 'utility'`, `process.versions.modules === '148'` (identisch mit Main), `ELECTRON_RUN_AS_NODE` ist **nicht** gesetzt, `execPath` ist der `Electron Helper`. Das im Risikoregister befürchtete `ELECTRON_RUN_AS_NODE`-Problem tritt bei `utilityProcess.fork` nicht auf (das betrifft `child_process.fork`, nicht `utilityProcess`).

### Empirischer Nebenbefund: Crash-Isolation ist real und wurde unfreiwillig bewiesen

Während des Spikes wurde ein reproduzierbarer nativer Crash gefunden: `JSON.stringify()` auf dem von `ctx.getModelInfo()` zurückgegebenen Napi-Objekt beendet den Prozess mit **SIGTRAP** (drei von drei Läufen). Derselbe Fehler hatte je nach Prozessmodell völlig unterschiedliche Wirkung:

- Im **Main-Prozess**: die gesamte Electron-App stirbt mit SIGTRAP, kein Fehler-Handling möglich.
- Im **utilityProcess**: das Kind stirbt (Exit-Code 5), der Main-Prozess läuft weiter, bekommt das `exit`-Event und beendet kontrolliert mit Exit-Code 0 (belegt in `results-utility.json` des Laufs von 00:44 Uhr).

Zweiter Fallstrick: `ctx.release()` und App-Teardown liefen in allen finalen Läufen sauber durch (Exit 0), der Crash lag ausschließlich am `getModelInfo()`-Objekt. Regel für M2: von nativen Objekten nur benötigte primitive Felder explizit kopieren, nie ganze Napi-Objekte serialisieren oder per IPC schicken (`postMessage` wirft darauf "An object could not be cloned").

### Verbindliche Architektur-Entscheidung

**Option B: utilityProcess.** Beide Optionen funktionieren nachweislich, aber der Spike hat selbst erlebt, dass ein einziger nativer Fehltritt den Main-Prozess komplett wegreißt, während derselbe Fehler im utilityProcess abgefangen wird. Bei null messbarem Latenz- oder Ladezeit-Nachteil ist utilityProcess die robustere Wahl. Whisper-Log läuft dabei über `stdio: 'pipe'` sauber ins Main-Log.

### Offen

- mac-x64 und win-x64 (Definition of Done von M1 verlangt alle drei Plattformen; auf dieser Maschine nur mac-arm64 messbar). Der Mechanismus (N-API, gleiche Paketstruktur) ist plattformneutral, der Beweis steht aus.

## F2: N-API-Verifikation (R2)

### Messergebnis: **N-API Ja.**

Belege aus dem echten installierten Paket:

1. `node_modules/@fugood/whisper.node/package.json` enthält `"binary": { "napi_versions": [6] }` und `node-addon-api ^8.0.0` (devDependency, wird nur beim Bauen der Prebuilts gebraucht).
2. Symbol-Check der echten Binärdatei: `nm -u node_modules/@fugood/node-whisper-darwin-arm64/index.node | grep -c napi_` ergibt **58** undefinierte `napi_`-Symbole; der Gegencheck auf V8/nan-Symbole (`grep -cE '_ZN2v8|Nan'`) ergibt **0**.
3. Der Binding-Quellcode ist im Paket enthalten (`src/WhisperContext.cpp`, `src/addons.cc`) und verwendet durchgehend den `Napi::`-Namespace von node-addon-api.

Explizit: **Das Addon funktioniert in Electron 43.0.0 ohne electron-rebuild** (durch F1 bewiesen, beide Prozessmodelle). Dieselbe Binärdatei lädt außerdem unverändert in Node 26.0.0 (VAD-Test lief in plain Node), was die ABI-Stabilität über N-API praktisch belegt: ein Prebuilt für Node-ABI und Electron-ABI zugleich.

### Entscheidung

`@fugood/whisper.node` bleibt Primärwrapper. Der Fallback `@kutalia/whisper-node-addon` wurde nicht getestet, weil der Primärweg ohne Einschränkung funktioniert.

## F3: npm-Binary-Bezug (R3)

### Messergebnis: Bezugsweg (a), reine Registry-optionalDependencies mit os/cpu-Gate. Funktioniert unter Skript-Verbot: **Ja.**

Belege:

1. Hauptpaket `@fugood/whisper.node@1.0.22` listet 14 Plattform-Subpakete als `optionalDependencies` (u. a. `@fugood/node-whisper-darwin-arm64`, `-darwin-x64`, `-win32-x64`, jeweils Version 1.0.22, dazu vulkan/cuda-Varianten und wasm). Kein postinstall-Download von GitHub-Releases.
2. Subpaket `@fugood/node-whisper-darwin-arm64/package.json`: `"os": ["darwin"]`, `"cpu": ["arm64"]`, **kein `scripts`-Feld**, Inhalt nur `index.node` (2,8 MB), README, package.json.
3. `scripts/check.js` des Hauptpakets (postinstall): ohne gesetztes `npm_config_build_from_source` wird **sofort `process.exit(0)`** ausgeführt, cmake-js wird nie berührt. Wörtlich verifiziert im installierten Paket.
4. Härtetest in frischem Verzeichnis: `npm ci --ignore-scripts` (Skripte komplett verboten) installierte 3 Pakete, `index.node` ist vorhanden, und `require('@fugood/whisper.node')` liefert eine funktionsfähige `initWhisper`-Funktion. Kein Compiler, kein Xcode CLT, kein Netzwerkzugriff außer der npm-Registry.

### Entscheidung

Der Bezugsweg ist auditfest und übersteht Install-Skript-Verbote. Harte Regel bleibt: niemals `--omit=optional`/`--no-optional`, sonst fehlt das Plattformpaket. Für Offline-Vor-Ort-Installation wird pro Zielplattform der `node_modules`-Stand oder ein npm-Cache vendored (M6).

## F4: macOS-TCC-Persistenz (R4)

### Messaufbau

`Electron.app` wurde als `VoiceWall.app` kopiert, `CFBundleIdentifier` auf `de.der-ki-auditor.voicewall` gesetzt und ad-hoc signiert (`codesign -s - --force --deep`). `codesign -dvvv` bestätigt: `Identifier=de.der-ki-auditor.voicewall`, `Signature=adhoc`, `TeamIdentifier=not set`.

### Messergebnis

| Vorgang                                       | CDHash                                                       |
| --------------------------------------------- | ------------------------------------------------------------ |
| Build 1, ad-hoc signiert                      | `c7692aa0f275e969fabc8b88dd88e4f184e959b8`                   |
| Re-Sign von **identischem** Inhalt            | `c7692aa0f275e969fabc8b88dd88e4f184e959b8` (**unverändert**) |
| Rebuild (Inhaltsänderung im Bundle) + Re-Sign | `1cb573f3ecc28612dae0ad2d27c48977244a437b` (**geändert**)    |

Der entscheidende Mechanismus, per `codesign -d -r-` gemessen: die Designated Requirement einer Ad-hoc-Signatur ist **`designated => cdhash H"<hash>"`**, also der konkrete cdhash, nicht die Bundle-ID. TCC speichert erteilte Grants gegen die Designated Requirement. Daraus folgt zwingend: jeder Rebuild, der auch nur ein Byte im Bundle ändert, erzeugt einen neuen cdhash, damit eine neue Designated Requirement, und der einmal erteilte Accessibility-/Mikrofon-Grant passt nicht mehr auf die neue App. Ein reines Neu-Signieren ohne Inhaltsänderung ist dagegen unschädlich (cdhash ist deterministisch).

### Ehrliche Abgrenzung: gemessen vs. offen

- **Gemessen:** stabile Bundle-Identität, Ad-hoc-Signierbarkeit, Determinismus des cdhash, cdhash-Bruch bei Rebuild, cdhash-basierte Designated Requirement (der technische Kern von R4).
- **Offen (manueller Test mit Lars nötig):** das tatsächliche TCC-Verhalten nach Grant (fällt Auto-Paste still aus oder fragt macOS neu?), Persistenz über Zeit und über OS-Updates. Es wurden bewusst keine Systemeinstellungen geöffnet und keine Grants angefordert.

### Entscheidung

Für den lokalen Vertriebsweg gilt: nach jedem Rebuild ist der TCC-Grant als verloren zu betrachten. Konsequenzen: (1) der dokumentierte Re-Grant-Schritt gehört fest ins Update-/Install-Skript, (2) der Clipboard-plus-Kopieren-Knopf-Fallback bleibt Pflicht-Primärresilienz, (3) die Entscheidung über Developer ID plus Notarisierung (99 USD/Jahr, ergibt eine identifier- und teambasierte, rebuild-stabile Designated Requirement) wird nach dem manuellen TCC-Test mit Lars getroffen. Ad-hoc ist nutzbar, aber mit bekanntem, dokumentiertem Re-Grant-Aufwand pro Update.

## F5: Latenz-Realismus (R9)

### Messergebnis (M1 Max, Metal, Q5_0, language 'de', temperature 0)

Modell-Ladezeit (einmalig pro Prozessstart): **295 bis 440 ms** (5 Läufe: 297, 304, 295, 298, 440 ms; utilityProcess 318 ms).

Transkriptionsdauern (`transcribeData`, jeweils 2 Pässe, Werte aus `results-main-release.json` und `results-main-norelease.json`):

| Segment  | Audiodauer | Dauer Pass 1/2 (ms)            | Realtime-Faktor |
| -------- | ---------- | ------------------------------ | --------------- |
| t2.wav   | 2,99 s     | 1352 / 1274 (bzw. 1239 / 1337) | 2,2 bis 2,4     |
| t5.wav   | 4,19 s     | 1317 / 1289 (bzw. 1288 / 1296) | 3,2 bis 3,3     |
| t10.wav  | 9,85 s     | 1405 / 1370 (bzw. 1367 / 1371) | 7,0 bis 7,2     |
| test.wav | 3,24 s     | 843 bis 1402 über alle Läufe   | 2,3 bis 3,8     |

Zentrale Erkenntnis: die Dauer ist über den gemessenen Bereich **nahezu konstant bei ca. 1,2 bis 1,4 s pro Segment**, unabhängig davon, ob 3 oder 10 Sekunden gesprochen wurden (whisper.cpp rechnet den Encoder auf dem gepaddeten 30-s-Fenster, der Encoder dominiert auf dieser Hardware). Für das Diktier-UX heißt das: gefühlte Verzögerung nach Sprechende auf dieser Maschine rund 1,3 s, Realtime-Faktor 2,2x bis 7,2x, je länger das Segment, desto besser der Faktor. Alle Transkripte waren inhaltlich korrekt, inklusive Zahlwort-Umsetzung ("dritten Juli" wurde zu "3. Juli") und Interpunktion.

### Ehrliche Lücke

Die Messung auf bewusst schwacher Windows-Hardware (4-Kern-i5 ohne GPU) ist auf dieser Maschine **unmöglich** und bleibt offen. Sie ist vor dem ersten Windows-Kundeneinsatz nachzuholen. Als Fallback für schwache Hardware werden folgende kleinere Modelle als Kandidaten festgelegt (Quelle: `https://huggingface.co/ggerganov/whisper.cpp`, offizielle ggml-Konvertierungen, multilingual mit Deutsch): `ggml-small.bin` (466 MB, q5_1-Variante 182 MB) und `ggml-base.bin` (142 MB, q5_1-Variante 57 MB). Deutsche WER-Zahlen für diese Fallbacks liegen nicht vor und werden nicht behauptet; sie sind bei Bedarf intern zu messen (Verfahren wie in Abschnitt 2.2 der ABARBEITUNG beschrieben).

## Kür: Silero-VAD und reale API-Oberfläche

### Silero-VAD

`ggml-silero-v5.1.2.bin`, 885.098 Bytes.
**SHA-256: `29940d98d42b91fbd05ce489f3ecf7c72f0a42f027e4875919a28fb4c04ea2cf`** (identisch mit dem Hugging-Face-LFS-OID von `ggml-org/whisper-vad`).

`initWhisperVad` plus `detectSpeechData` funktionieren und erkennen Sprache korrekt:

| Datei             | VAD-Rechenzeit | Erkannte Segmente (t0/t1 in Centisekunden) |
| ----------------- | -------------- | ------------------------------------------ |
| test.wav (3,24 s) | 24 ms          | 1 Segment: 3 bis 326 (0,03 s bis 3,26 s)   |
| t10.wav (9,85 s)  | 62 ms          | 1 Segment: 3 bis 986 (0,03 s bis 9,86 s)   |

VAD-Modell-Ladezeit: 48 bis 54 ms (der allererste Lauf auf der Maschine brauchte einmalig 12,5 s, vermutlich dyld-/Signatur-Erstverifikation der nativen Bibliothek; danach nie wieder). VAD-Kosten sind fürs Latenzbudget vernachlässigbar.

### Reale API-Oberfläche (Korrekturen gegenüber der ABARBEITUNG)

Verifiziert an `lib/binding.ts` und `src/WhisperContext.cpp` des installierten Pakets:

- Funktionsnamen stimmen: `initWhisper`, `initWhisperVad`, `ctx.transcribeData(ArrayBuffer, options)` (gibt `{ stop, promise }` zurück), `vad.detectSpeechData(ArrayBuffer, options)`. Dazu existieren `transcribeFile`, `bench`, `release`, `toggleNativeLog`, `addNativeLogListener`.
- `transcribeData` erwartet **16-bit signed PCM** als ArrayBuffer (wird intern durch 32768 zu float32 normiert, `src/common.cpp`, `convertAudioBufferToFloat`). 16 kHz mono wird vorausgesetzt. Das bestätigt das Aufnahmeformat aus Abschnitt 2.1.
- **Die Option `no_timestamps` existiert nicht.** `TranscribeOptions` sind camelCase: `language`, `temperature`, `beamSize`, `maxLen`, `tokenTimestamps`, `prompt`, `onNewSegments`, `onProgress` usw. Der Spike lief mit `{ language: 'de', temperature: 0 }`. Abschnitt 2.3 der ABARBEITUNG ist entsprechend zu korrigieren.
- VAD-Optionen ebenfalls camelCase: `threshold`, `minSpeechDurationMs`, `minSilenceDurationMs`, `maxSpeechDurationS`, `speechPadMs`.
- Schönheitsfehler im Paket: das `types`-Feld verweist auf `lib/index.d.ts`, die Datei fehlt im publizierten Tarball (nur `.ts`-Quellen liegen bei). Für TypeScript-Nutzung im Produkt ggf. eigene Deklaration oder direkter Import der `.ts`-Typen.

## Zusammenfassung der verbindlichen Entscheidungen

1. **Prozessmodell: Option B, utilityProcess** (Crash-Isolation empirisch belegt, kein Performance-Nachteil).
2. **Wrapper: @fugood/whisper.node 1.0.22 bleibt gesetzt** (N-API bewiesen, kein electron-rebuild, kein Compiler).
3. **Binary-Bezug: Registry-optionalDependencies, verifiziert skriptverbotsfest**; Offline-Vendoring pro Plattform bleibt Pflicht für die Vor-Ort-Installation.
4. **Signing: Ad-hoc ist möglich, aber jeder Rebuild bricht nachweislich die cdhash-basierte TCC-Identität**; Re-Grant-Schritt einplanen, Developer-ID-Entscheidung nach dem manuellen TCC-Test.
5. **Latenz: Diktat-Häppchen kosten auf M1 Max konstant ca. 1,3 s**; Windows-Schwachhardware bleibt die einzige offene Messlücke, Fallback-Modelle (ggml small/base von ggerganov/whisper.cpp) sind benannt.
6. **Codier-Regeln aus dem Spike:** niemals Napi-Objekte (`getModelInfo()`-Rückgabe) serialisieren oder clonen; PCM als frische ArrayBuffer-Kopien übergeben; Whisper-Log per `stdio: 'pipe'` einsammeln.

## Offene Punkte (gesammelt)

- ABI-/Transkriptionstest auf mac-x64 und win-x64 (M1-DoD, andere Hardware nötig).
- Manueller TCC-Test mit Lars: Accessibility-Grant erteilen, App neu bauen, Verhalten beobachten (still kaputt vs. Re-Prompt), danach Developer-ID-Entscheidung.
- Latenzmessung auf schwacher Windows-Referenzmaschine (4-Kern-i5, keine GPU), inkl. Test der Fallback-Modelle.
- WER-Vergleich fp16 vs Q5_0 auf deutschen Testsätzen, falls Auditfestigkeit der Genauigkeitsaussage gewünscht.
