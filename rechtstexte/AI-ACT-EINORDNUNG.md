# AI-Act-Einordnung von VoiceWall (Verordnung (EU) 2024/1689)

Diese Einordnung belegt mit dem wörtlichen Normtext, warum VoiceWall
keiner Kennzeichnungspflicht nach Art. 50 Abs. 2 der KI-Verordnung
unterliegt, warum es kein Hochrisiko-System ist und warum der in der App
vorhandene Transparenzhinweis freiwillig über die Rechtslage hinausgeht.
Sie ersetzt Argumentation durch Zitat ("Beleg statt Behauptung").

## 1. Was VoiceWall ist

VoiceWall ist ein lokales Transkriptionswerkzeug: es wandelt die eigene
gesprochene Sprache des Nutzers per Whisper-Spracherkennung in Text um.
Das Transkript ist die 1:1-Verschriftung einer echten menschlichen
Äußerung, kein vom Modell frei erzeugter Inhalt. VoiceWall erzeugt keine
synthetischen Bild-, Audio-, Video- oder Textinhalte, führt keine
Emotionserkennung und keine biometrische Kategorisierung durch und
erstellt keine Deepfakes.

## 2. Der maßgebliche Wortlaut: Art. 50 Abs. 2 mit Carveout

### 2.1 Deutsche Sprachfassung (amtlich, wörtlich)

> "(2) Anbieter von KI-Systemen, einschließlich KI-Systemen mit
> allgemeinem Verwendungszweck, die synthetische Audio-, Bild-, Video-
> oder Textinhalte erzeugen, stellen sicher, dass die Ausgaben des
> KI-Systems in einem maschinenlesbaren Format gekennzeichnet und als
> künstlich erzeugt oder manipuliert erkennbar sind. Die Anbieter
> sorgen dafür, dass — soweit technisch möglich — ihre technischen
> Lösungen wirksam, interoperabel, belastbar und zuverlässig sind und
> berücksichtigen dabei die Besonderheiten und Beschränkungen der
> verschiedenen Arten von Inhalten, die Umsetzungskosten und den
> allgemein anerkannten Stand der Technik, wie er in den einschlägigen
> technischen Normen zum Ausdruck kommen kann. **Diese Pflicht gilt
> nicht, soweit die KI-Systeme eine unterstützende Funktion für die
> Standardbearbeitung ausführen oder die vom Betreiber bereitgestellten
> Eingabedaten oder deren Semantik nicht wesentlich verändern** oder
> wenn sie zur Aufdeckung, Verhütung, Ermittlung oder Verfolgung von
> Straftaten gesetzlich zugelassen sind."

Terminologie-Hinweis: Die amtliche deutsche Fassung verwendet
"Betreiber" als Übersetzung von "deployer" (Definition in Art. 3 Nr. 4).
In früheren Entwurfsfassungen und mancher Sekundärliteratur findet sich
stattdessen "Einsatzgeber"; gemeint ist dieselbe Rolle.

### 2.2 Englische Sprachfassung (amtlich, wörtlich)

> "2. Providers of AI systems, including general-purpose AI systems,
> generating synthetic audio, image, video or text content, shall
> ensure that the outputs of the AI system are marked in a
> machine-readable format and detectable as artificially generated or
> manipulated. Providers shall ensure their technical solutions are
> effective, interoperable, robust and reliable as far as this is
> technically feasible, taking into account the specificities and
> limitations of various types of content, the costs of implementation
> and the generally acknowledged state of the art, as may be reflected
> in relevant technical standards. **This obligation shall not apply to
> the extent the AI systems perform an assistive function for standard
> editing or do not substantially alter the input data provided by the
> deployer or the semantics thereof,** or where authorised by law to
> detect, prevent, investigate or prosecute criminal offences."

## 3. Subsumtion: VoiceWall fällt wörtlich unter den Carveout

1. **Schon der Tatbestand zielt auf anderes:** Satz 1 erfasst Systeme,
   die "synthetische [...] Inhalte erzeugen" ("generating synthetic
   [...] content"). Reine Transkription erzeugt keinen synthetischen
   Inhalt, sondern verschriftet eine reale Äußerung; inhaltlich ist das
   Transkript die Aussage des Nutzers.
2. **Selbst wenn man den Tatbestand bejahte, greift der wörtliche
   Carveout in Satz 3:** Die Eingabedaten sind die vom Nutzer
   (Betreiber im Sinne der Verordnung) bereitgestellte Sprachaufnahme.
   Eine Transkription, die per Design mit `temperature 0.0` und ohne
   inhaltliche Nachbearbeitung arbeitet, verändert "die vom Betreiber
   bereitgestellten Eingabedaten oder deren Semantik nicht wesentlich":
   sie überführt denselben Bedeutungsgehalt verlustarm vom Medium
   Sprache in das Medium Text. VoiceWall fällt damit nicht nur nach
   Auslegung, sondern nach dem Wortlaut aus der Pflicht.
3. **Erwägungsgrund 133 stützt das ausdrücklich:** Die
   Kennzeichnungspflicht soll danach "weder für KI-Systeme, die in
   erster Linie eine unterstützende Funktion für die
   Standardbearbeitung ausführen, noch für KI-Systeme, die die vom
   Betreiber bereitgestellten Eingabedaten oder deren Semantik nicht
   wesentlich verändern," gelten (Wortlaut der amtlichen deutschen
   Fassung, Erwägungsgrund 133).

## 4. Kein Hochrisiko-System (Anhang III)

Bürodiktat-Transkription ist in keinem der in Anhang III gelisteten
Bereiche (unter anderem Biometrie, kritische Infrastruktur, Bildung,
Beschäftigung, wesentliche Dienste, Strafverfolgung, Migration, Justiz)
aufgeführt. VoiceWall trifft dort keine Entscheidungen über Personen und
bewertet niemanden. Die Einordnung "kein Hochrisiko-System" wird hiermit
dokumentiert, nicht nur angenommen. Unabhängig davon ist der zeitliche
Rahmen zu beachten: Die Transparenzpflichten des Art. 50 gelten ab dem 2. August 2026 (Art. 113); für die Anhang-III-Hochrisikopflichten sind
durch das Digital-Omnibus-Paket der Kommission Verschiebungen auf
Ende 2027 vorgesehen, worauf es für VoiceWall aber nicht ankommt, weil
schon der Tatbestand nicht erfüllt ist.

## 5. Freiwilliger Transparenzhinweis (über die Pflicht hinaus)

Obwohl keine Kennzeichnungspflicht besteht, weist VoiceWall im
First-Run-Wizard (informierte Einwilligung), dezent in der Oberfläche
und in der Dokumentation aus, dass die Verschriftung durch ein
KI-Modell (Whisper) erfolgt und automatische Transkription Fehler
enthalten kann, weshalb das Ergebnis vor Verwendung zu prüfen ist.
Dieser Hinweis ist freiwillig und geht über die Rechtslage hinaus:
vorbildlich statt bloß konform, und zugleich ein praktischer Beitrag zur
KI-Kompetenz der Nutzenden (Art. 4).

## 6. Quellen (abgerufen und wörtlich abgeglichen am 03.07.2026)

- Amtliche deutsche Fassung, Verordnung (EU) 2024/1689 (EUR-Lex,
  CELEX 32024R1689):
  https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32024R1689
- Amtliche englische Fassung:
  https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689
- Maschinenzugriff für den Wortlaut-Abgleich (Amt für Veröffentlichungen
  der EU, Cellar; identische Inhalte wie EUR-Lex):
  http://publications.europa.eu/resource/celex/32024R1689
  (Abruf mit `Accept-Language: deu` beziehungsweise `eng`)
- Der Wortlaut wurde zusätzlich gegen zwei unabhängige Spiegel geprüft
  (buzer.de, ai-act-law.eu); alle Fassungen stimmen überein,
  insbesondere die amtliche Übersetzung "Betreiber" für "deployer".
