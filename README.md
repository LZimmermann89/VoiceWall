# VoiceWall

VoiceWall ist ein zu 100 Prozent lokales, DSGVO-konformes Sprachdiktiergerät
für Mac und Windows. Der gesamte Weg von der Stimme zum Text läuft auf dem
Rechner des Nutzers: keine Cloud, kein externer Server, kein API-Call, keine
Telemetrie. Die Kommunikation innerhalb der App läuft ausschließlich über
Electron-IPC, es gibt keinen HTTP-Server und keinen offenen Netzwerk-Port.

Aktueller Stand: Meilenstein M0, das gehärtete Projektgerüst. Diktatfunktion,
Whisper-Engine und First-Run-Wizard folgen in den nächsten Meilensteinen
(siehe ABARBEITUNG.md).

## Review-then-run

VoiceWall wird als inspizierbares Quellcode-Repo ausgeliefert, nicht als
Binary. Der Grundsatz lautet: erst prüfen, dann ausführen. Vor jeder
Installation kann und soll der gesamte Quellcode eingesehen werden. Belege
statt Behauptungen:

- Kein `listen(`-Aufruf im Quellcode, kein HTTP-Server, nur IPC.
- Harte Content-Security-Policy im Renderer (nur `'self'`, keine externen
  Origins).
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Crash-Reporting ist hart deaktiviert, Crash-Dump-Verzeichnis wird bei
  jedem Start geleert.
- SBOM (CycloneDX) wird in der CI erzeugt, `package-lock.json` ist committet
  und wird per `npm ci` mit Integritäts-Hashes verifiziert.

## Voraussetzungen

- Node.js 26 (siehe `.nvmrc`, `engines` ist gepinnt)
- npm 11

## Entwicklung

```bash
npm ci               # Abhängigkeiten exakt aus dem Lockfile installieren
npm run dev          # Entwicklungsmodus (electron-vite)
npm run build        # Produktions-Build nach out/
npm run typecheck    # TypeScript strict über alle Projektreferenzen
npm run lint         # ESLint inkl. Modulgrenzen, 0 Warnungen erlaubt
npm run format:check # Prettier-Prüfung
npm run test         # Unit-Tests (Vitest)
npm run test:e2e     # E2E gegen die gebaute App (vorher npm run build)
npm run audit        # npm audit, Gate ab Schweregrad high
npm run sbom         # CycloneDX-SBOM nach sbom.cdx.json
```

## Lizenz

Proprietär, alle Rechte vorbehalten. Details in `LICENSE`, Drittlizenzen in
`THIRD_PARTY_LICENSES.md` und `NOTICE`. Sicherheitsmeldungen: siehe
`SECURITY.md`.
