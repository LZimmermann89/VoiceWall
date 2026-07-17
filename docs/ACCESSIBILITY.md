> 🇬🇧 English version: [ACCESSIBILITY.en.md](ACCESSIBILITY.en.md)

# Warum VoiceWall das macOS-Bedienungshilfen-Recht braucht und was es damit NICHT tut

Dieses Dokument ist die auditierbare Begründung für die einzige
"mächtig aussehende" Berechtigung, die VoiceWall auf macOS anfragt:
**Bedienungshilfen** (Systemeinstellungen, Datenschutz und Sicherheit,
Bedienungshilfen; technisch: TCC-Dienst `kTCCServiceAccessibility`).

## Wofür das Recht gebraucht wird

VoiceWall fügt den diktierten Text automatisch in die gerade fokussierte
Fremd-App ein (Word, Outlook, Browser). Dafür simuliert es genau EINEN
Tastendruck: Cmd+V. macOS erlaubt das Simulieren von Tastatureingaben in
andere Apps nur Programmen mit Bedienungshilfen-Freigabe; ohne Freigabe
scheitert der Aufruf still. Das ist der gesamte Zweck.

## Was VoiceWall mit dem Recht konkret tut

Der komplette Code, der unter dieser Berechtigung läuft, ist eine einzige,
gekapselte Stelle: `src/main/paste/macos.ts`. Sie führt per
`execFile('osascript', ['-e', ...])` dieses statische AppleScript aus:

```applescript
tell application "System Events" to keystroke "v" using command down
```

Auditier-Hinweise:

- Das Skript ist ein **Literal im Quellcode**. Es wird niemals dynamisch
  zusammengesetzt, es wird kein Nutzer- oder Transkript-Text interpoliert
  (`execFile` mit Argument-Array, keine Shell).
- Der Transkript-Text erreicht die Fremd-App ausschließlich über die
  Zwischenablage (`clipboard.writeText`), nie über die Kommandozeile und nie
  über simulierte Einzeltasten.
- Vor jedem Einfügen prüft `src/main/permission/accessibility.ts` mit
  `systemPreferences.isTrustedAccessibilityClient(false)`, ob die Freigabe
  vorliegt. Ohne Freigabe wird **kein** osascript-Versuch gestartet; die UI
  erklärt stattdessen die Freigabe (in der gewählten Oberflächensprache) und öffnet auf Knopfdruck den
  richtigen Einstellungsbereich (statischer Deep-Link
  `x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility`).

## Was VoiceWall mit dem Recht NICHT tut

- **Kein Keylogging:** VoiceWall liest keine Tastatureingaben mit, nirgends.
  Es gibt keinen Event-Tap, keinen Keyboard-Hook, kein Input-Monitoring, und
  das entsprechende TCC-Recht (`kTCCServiceListenEvent`) wird nie angefragt.
  Der globale Hotkey läuft über Electrons `globalShortcut`, das nur die EINE
  registrierte Kombination gemeldet bekommt, keine sonstigen Tastendrücke.
- **Kein Auslesen anderer Apps:** Keine Fensterinhalte, keine UI-Elemente,
  kein Screen-Reading. Es wird ausschließlich ein Tastendruck gesendet, nie
  etwas abgefragt.
- **Keine Steuerung anderer Apps** über das Einfügen hinaus: kein Klicken,
  kein Navigieren, keine weiteren keystrokes.
- **Kein Netzwerkbezug:** Der Paste-Pfad (wie die gesamte App zur Laufzeit)
  löst keinen externen Request aus.

Wer das nachprüfen will: `grep -rn "osascript\|keystroke" src/` liefert genau
die eine Stelle in `paste/macos.ts` (plus Dokumentation und Tests).

## Bekannte TCC-Grenze: Die Freigabe hängt an der Signatur-Identität (cdhash)

Empirisch gemessen: Bei
einer ad-hoc-signierten App bildet macOS die TCC-Vertrauensbeziehung über die
Designated Requirement `cdhash H"<hash>"`, also über den Hash des konkreten
Builds, nicht über die Bundle-ID. Konsequenzen:

- **Jeder Rebuild** (auch ein Byte Unterschied im Bundle) erzeugt einen neuen
  cdhash. Die zuvor erteilte Bedienungshilfen-Freigabe passt dann nicht mehr;
  das Einfügen fällt still aus, bis die Freigabe erneut erteilt wird
  (VoiceWall erkennt das über den Check vor jedem Paste und zeigt den
  Hinweis-Pfad statt still zu scheitern).
- Ein reines **Neu-Signieren ohne Inhaltsänderung** ist unschädlich (cdhash
  ist deterministisch).
- Im **Dev-Betrieb** (electron aus node_modules) ist der Client die
  Electron-Helper-Binary; auf der Entwicklungsmaschine liefert
  `isTrustedAccessibilityClient(false)` erwartungsgemäß `false` (am
  2026-07-03 mit Electron 43.0.0 gemessen). Der Hinweis-Pfad ist damit der
  reguläre, getestete Dev-Zustand.
- **Dauerhaft löst das nur eine rebuild-stabile Signatur-Identität:** Apple
  Developer ID plus Notarisierung ergibt eine identifier-/teambasierte
  Designated Requirement, die Rebuilds übersteht (die Entscheidung
  darüber fällt nach dem manuellen TCC-Test). Bis dahin
  gilt: Nach jedem Update ist der Re-Grant-Schritt einzuplanen, und der
  Kopieren-Knopf plus Zwischenablage bleibt der Primär-Resilienzpfad.

## Windows zum Vergleich

Windows kennt keine Bedienungshilfen-Freigabe für SendKeys; dafür gilt dort
die UIPI-Grenze (keine simulierten Eingaben an als Administrator laufende
Ziel-Apps). Auf beiden Plattformen gilt
dieselbe Resilienz-Regel: Scheitert das automatische Einfügen, ist der Text in
der Zwischenablage und über den Kopieren-Knopf jederzeit erneut verfügbar.
