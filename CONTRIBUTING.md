# Mitwirken an VoiceWall

Danke für Ihr Interesse. Damit keine falschen Erwartungen entstehen,
hier die ehrlichen Spielregeln dieses Projekts.

## Projektmodus

VoiceWall ist ein bewusst schmales, fertiges Werkzeug im
Wartungsmodus: Sicherheits-Updates der Abhängigkeiten werden gepflegt,
gemeldete Fehler werden nach Möglichkeit behoben. Es gibt keine
Feature-Roadmap und kein Versprechen auf Weiterentwicklung.

## Issues

Fehlerberichte und Windows-Testberichte sind ausdrücklich willkommen,
am besten über die Issue-Vorlagen. Bitte immer Betriebssystem, Version
und Log-Auszug angeben (die Logs enthalten keine Diktat-Inhalte).
Sicherheitsrelevante Funde bitte vertraulich über den Weg in
`SECURITY.md` melden, nicht als öffentliches Issue.

## Pull Requests

Fehlerbehebungen und Sicherheits-Verbesserungen: gern, mit Tests.
Neue Funktionen: bitte vorher ein Issue eröffnen und nicht auf einen
Merge bauen. Die Schmalheit ist eine bewusste Produktentscheidung
(kleine Angriffsfläche, prüfbarer Umfang), deshalb werden viele an
sich gute Ideen abgelehnt. Ein Fork ist ausdrücklich erlaubt und der
richtige Weg für größere Umbauten (MIT-Lizenz).

## Qualitätsmaßstab

Vor jedem Pull Request bitte lokal grün: `npm run typecheck && npm run
lint && npm run format:check && npm run test`. Die CI prüft zusätzlich
auf drei Plattformen inklusive Supply-Chain-Gates. Deutsche
Oberflächentexte mit echten Umlauten; jede nutzersichtbare Meldung
gibt es zweisprachig (siehe `src/shared/i18n/`).
