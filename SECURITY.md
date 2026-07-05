> 🇬🇧 English version: [SECURITY.en.md](SECURITY.en.md)

# Sicherheitsrichtlinie (SECURITY.md)

## Schwachstellen melden

Wenn Sie eine Schwachstelle in VoiceWall finden, melden Sie diese bitte
vertraulich an den Anbieter (FERNAU Präzisionstechnik GmbH, siehe
`rechtstexte/IMPRESSUM.md`):

- E-Mail: info@der-ki-auditor.de
- Betreff: `[SECURITY] VoiceWall: <Kurzbeschreibung>`
- Direkter Kontakt zum Projektverantwortlichen (Ausweichweg):
  lars.zimmermann89@gmail.com

Bitte nennen Sie: betroffene Version beziehungsweise Commit, Schritte zur
Reproduktion, erwartetes und tatsächliches Verhalten sowie eine Einschätzung
der Auswirkung. Bitte veröffentlichen Sie keine Details, bevor eine
Korrektur bereitsteht (koordinierte Offenlegung). Eine Eingangsbestätigung
erfolgt in der Regel innerhalb von 7 Tagen.

## Geltungsbereich

VoiceWall verarbeitet Diktate ausschließlich lokal. Besonders relevant sind
deshalb Meldungen zu:

- jeder Form von unerwartetem Netzwerkverkehr (der Anspruch lautet: null
  externe Requests im Betrieb),
- Umgehung der Renderer-Isolation (contextIsolation, Sandbox, CSP),
- Pfad-Ausbrüchen aus dem Firmen-Ordner (Containment),
- Schwächen in der Lieferkette (Abhängigkeiten, Install-Skripte, Lockfile).

## Review-then-run

VoiceWall wird als Quellcode ausgeliefert und vor Ort ausgeführt. Prüfen Sie
den Code vor der Installation, siehe README.md. Die CI erzwingt bei jedem
Stand: Typprüfung, Lint mit Modulgrenzen, Tests, Build, E2E,
`npm audit --audit-level=high`, SBOM-Erzeugung und einen Lockfile-Guard.

## Unterstützte Versionen

Bis zum finalen Release 1.0.0 wird ausschließlich der jeweils aktuelle
Stand des `main`-Branches unterstützt (aktuell: 1.0.0-rc.1). Updates
erfolgen kontrolliert als neues, inspizierbares Repo-Release, das vor
Ort eingespielt wird (review-then-run); es gibt bewusst keinen
automatischen Update-Kanal und kein Phone-Home.
