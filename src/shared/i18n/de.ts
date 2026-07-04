/**
 * Deutscher Text-Katalog der Oberfläche (Paket B2, Entscheidung E40):
 * die QUELLE DER WAHRHEIT für alle Renderer-Texte. `en.ts` ist mit dem
 * abgeleiteten Typ `Uebersetzung = typeof de` typisiert: ein fehlender
 * englischer Schlüssel ist ein Compilerfehler (Vollständigkeitsbeweis),
 * ergänzt um den Laufzeit-Schlüsseltest tests/unit/i18n.test.ts.
 *
 * Regeln:
 * - Die deutschen Texte sind unverändert 1:1 aus den Komponenten extrahiert
 *   (reine Extraktion, keine Umformulierung; einzige dokumentierte Ausnahme:
 *   der Sprache-Schritt-Hinweis, der die feste Oberflächensprache behauptete).
 * - Parametrisierte Texte sind Funktionen `(n) => string` (kein Templating).
 * - Meldungen aus dem MAIN-Prozess (Result-Fehler, engineHinweis, Tray)
 *   erreichen die UI über IPC und sind NICHT Teil dieses Katalogs (Paket B3).
 * - Rechtstexte (Impressum, shared/impressum.ts) bleiben deutsch (deutsches
 *   Recht); die EN-Oberfläche zeigt eine kurze Einordnungszeile.
 *
 * Glossar der EN-Übersetzung (einmal entschieden, durchgängig verwendet):
 *   Diktat = dictation · Firma = company · Firmenordner = company folder ·
 *   Register = records · Beleg = evidence · Papierkorb = trash ·
 *   Verwaltung = management · Einrichtungsprotokoll = setup record ·
 *   Prüfschritte = audit steps · Zwischenablage = clipboard ·
 *   Bedienungshilfen = Accessibility · Freigabe = permission ·
 *   Einwilligung = consent · Tastenkürzel = keyboard shortcut ·
 *   Funktionsbeleg = proof of function · Fach-Wörterbuch = specialist
 *   dictionary · Erkennungsmodell = recognition model ·
 *   Anbieterkennzeichnung = provider identification · Notiz = note ·
 *   Eintrag = entry · Aufnahme = recording.
 *
 * Plattformneutral (kein Node/DOM); nur reine Daten und reine Funktionen.
 */
import {
  BACKUP_HINWEISE,
  BACKUP_HINWEISE_DOKUMENT,
  BACKUP_KLARTEXT_WARNUNG,
} from '../backup-hinweise';
import { NETZWERK_SELBSTTEST_DOKUMENT, NETZWERK_SELBSTTEST_PROBEN } from '../selbsttest';

export const de = {
  app: {
    kontextEinrichtung: 'Einrichtungsprotokoll',
    kontextNeueFirma: 'Neue Firma einrichten',
    kontextVerwaltung: 'Verwaltung',
    lokalBadge: '100 % lokal',
    lokalBadgeTitel: 'Alle Verarbeitung findet auf diesem Rechner statt.',
    wirdGeladen: 'Wird geladen ...',
    fussModellPruefsumme: 'Modell-Prüfsumme',
    fussNullVerbindungen: '0 externe Verbindungen im Betrieb',
    fussHardware: (platformArch: string, kerne: number, ramGb: number): string =>
      `${platformArch} · ${String(kerne)} Kerne · ${String(ramGb)} GB RAM`,
    /** Beschriftung des UI-Sprachumschalters: bewusst zweisprachig fix. */
    sprachumschalterLabel: 'Sprache / Language',
    sprachumschalterDeutsch: 'Deutsch',
    sprachumschalterEnglisch: 'English',
  },

  wizard: {
    schrittNamen: {
      sprachwahl: 'Sprache / Language',
      willkommen: 'Willkommen',
      firma: 'Firmendaten',
      speicherort: 'Speicherort',
      sprache: 'Sprache',
      modell: 'Modell',
      hotkey: 'Tastenkürzel',
      bedienungshilfen: 'Bedienungshilfen',
      zusammenfassung: 'Zusammenfassung',
    },
    railTitel: 'Prüfschritte',
    railAria: 'Einrichtungsschritte',
    schrittAbgeschlossen: 'abgeschlossen',
    kickerAbgeschlossen: 'Einrichtung abgeschlossen',
    kickerSchritt: (nummer: string, gesamt: string): string => `Schritt ${nummer} von ${gesamt}`,

    sprachwahl: {
      titel: 'Sprache / Language',
      lede: 'Bitte wählen Sie die Sprache der Oberfläche. / Please choose the language of the interface.',
      aria: 'Sprache / Language',
      deutschTitel: 'Deutsch',
      deutschBeschreibung: 'Die Oberfläche von VoiceWall erscheint auf Deutsch.',
      englischTitel: 'English',
      englischBeschreibung: 'The VoiceWall interface appears in English.',
      hinweis:
        'Die Wahl wirkt sofort und lässt sich später in der Verwaltung jederzeit ändern. Sie ist unabhängig von der Diktatsprache der Firmen.',
    },

    willkommen: {
      titel: 'Willkommen bei VoiceWall',
      lede: 'VoiceWall wandelt Ihre Sprache in Text um: Tastenkürzel drücken, sprechen, Tastenkürzel drücken, der Text erscheint in der aktiven Anwendung. Die gesamte Verarbeitung findet auf diesem Rechner statt.',
      zeileVerarbeitung: 'Verarbeitung',
      zeileVerarbeitungWert: '100 % lokal auf diesem Rechner',
      zeileCloud: 'Cloud/Server',
      zeileCloudWert: 'keine, es werden keine Daten gesendet',
      zeileAudio: 'Audio-Aufzeichnung',
      zeileAudioWert: 'nur im Arbeitsspeicher, nie als Datei',
      aiActTitel: 'Transparenzhinweis (EU-KI-Verordnung):',
      aiActText:
        ' Die Umwandlung von Sprache in Text erfolgt durch ein KI-Modell (Whisper, deutsch optimiert). Wie bei jeder automatischen Erkennung sind Fehler möglich, besonders bei Namen und Fachbegriffen. Bitte prüfen Sie das Ergebnis, bevor Sie es verwenden.',
      einwilligung:
        'Ich willige ein, dass VoiceWall das Mikrofon dieses Rechners für die lokale Sprachumwandlung verwendet. Es werden keine Audiodaten gespeichert oder an einen Server übertragen. Diese Einwilligung wird mit Zeitstempel lokal dokumentiert und ist jederzeit widerrufbar (Mikrofonzugriff in den Systemeinstellungen entziehen).',
    },

    firma: {
      titel: 'Firmendaten',
      lede: 'Diese Angaben beschreiben den Datenraum der Firma. Sie bleiben auf diesem Rechner und werden in der Firmen-Konfiguration im Firmenordner abgelegt.',
      nameLabel: 'Firmenname',
      namePlatzhalter: 'z. B. Müller & Söhne GmbH',
      nameHinweis:
        '1 bis 120 Zeichen, echte Umlaute erlaubt. Der Anzeigename bleibt unverändert erhalten.',
      ordnernameLabel: 'Ordnername (abgeleitet, anpassbar)',
      ordnerVorschau: (ordnername: string): string => `Ordner: ${ordnername}`,
      ansprechpartnerLabel: 'Ansprechpartner (optional)',
      emailLabel: 'E-Mail (optional, nur lokale Anzeige)',
      emailFehler:
        'Bitte eine gültige E-Mail-Adresse eingeben (z. B. name@firma.de) oder das Feld leer lassen.',
      standortLabel: 'Standort/Abteilung (optional)',
      hinweisLabel: 'Interner Hinweis (optional)',
    },

    speicherort: {
      titel: 'Speicherort der Diktate',
      lede: 'Der Firmenordner ist die Datenbank: einfache Dateien, jederzeit kopierbar. Vor der Anlage prüft VoiceWall, ob der Desktop von einem Cloud-Dienst synchronisiert wird.',
      pruefeSpeicherort: 'Prüfe Speicherort ...',
      syncErkannt: 'Cloud-Synchronisation erkannt.',
      syncOk:
        'Keine Cloud-Synchronisation des Desktops erkannt. Der Desktop ist als Speicherort geeignet.',
      frage: 'Wo sollen die Diktate liegen?',
      aria: 'Speicherort',
      lokalTitel: 'Lokaler Ordner mit Desktop-Verknüpfung',
      badgeEmpfohlen: 'empfohlen',
      lokalBeschreibung:
        'Diktate liegen unter ~/VoiceWall (wird nie synchronisiert); auf dem Desktop erscheint eine Verknüpfung. Sichert das Versprechen "100 Prozent lokal".',
      desktopTitel: 'Direkt auf dem Desktop',
      badgeStandard: 'Standard',
      desktopBeschreibung: 'Der Firmenordner liegt direkt auf dem Desktop.',
      desktopSyncWarnung: ' Achtung: Er würde dann in die Cloud synchronisiert.',
    },

    sprache: {
      titel: 'Diktatsprache',
      lede: 'VoiceWall ist primär auf deutsches Diktat optimiert. Die Sprache gilt pro Firma und wird der Spracherkennung fest übergeben, ohne automatische Spracherkennung. Das spart Zeit und verhindert Sprachwechsel-Fehler.',
      aria: 'Diktatsprache',
      deutschTitel: 'Deutsch (de)',
      deutschBeschreibung:
        'Nutzt das deutsch-feinabgestimmte Whisper-Modell (der Markenkern dieser Ausgabe): beste deutsche Erkennung, Standard für neue Firmen.',
      englischTitel: 'Englisch (en)',
      englischBeschreibung:
        'Nutzt das mehrsprachige Whisper-Originalmodell (large-v3-turbo). Ehrlicher Hinweis: VoiceWall ist primär für Deutsch optimiert; für Englisch fällt ein zusätzlicher einmaliger Modell-Download von ca. 574 MB an.',
      hinweis:
        'Die Diktatsprache ist unabhängig von der Sprache der Oberfläche und lässt sich später in der Verwaltung pro Firma ändern.',
    },

    modell: {
      titel: 'Erkennungsmodell',
      aria: 'Erkennungsmodell',
      ledeEnglisch:
        'Für die Diktatsprache Englisch nutzt VoiceWall das mehrsprachige Whisper-Originalmodell (large-v3-turbo, Q5_0). Der Download erfolgt einmalig; danach arbeitet VoiceWall zu 100 % offline.',
      ledeDeutschVor: (hardware: string): string => `Empfehlung für diesen Rechner (${hardware}): `,
      ledeDeutschNach:
        '. Der Download erfolgt einmalig; danach arbeitet VoiceWall zu 100 % offline.',
      hardwareKurz: (kerne: number, ramGb: number): string =>
        `${String(kerne)} Kerne, ${String(ramGb)} GB RAM`,
      hardwareUnbekannt: 'wird ermittelt',
      multilingualTitel: 'Englisch / mehrsprachig (large-v3-turbo, Q5_0)',
      badgeFuerEnglisch: 'für Englisch',
      multilingualBeschreibung: (groesse: string): string =>
        `Originalmodell von OpenAI/whisper.cpp, nicht deutsch-optimiert. ${groesse}.`,
      q5Titel: 'Q5_0',
      badgeEmpfohlen: 'empfohlen',
      q5Beschreibung: (groesse: string): string =>
        `Bester Kompromiss aus deutscher Genauigkeit und Geschwindigkeit; läuft auf normaler Büro-Hardware. ${groesse}.`,
      fp16Titel: 'Maximale Genauigkeit (fp16)',
      fp16Beschreibung: (groesse: string): string =>
        `Für starke Rechner; höhere Genauigkeit bei längerer Rechenzeit. ${groesse}.`,
      fp16Gesperrt:
        'Für diesen Rechner nicht empfohlen (benötigt mindestens 16 GB RAM und 6 Kerne); Auswahl deaktiviert.',
      statusVorhanden: 'vorhanden und verifiziert',
      statusFehlt: (groesse: string): string => `noch nicht geladen · ${groesse}`,
      vadHinweis: (groesse: string, vorhanden: boolean): string =>
        `Zusätzlich wird das kleine Sprach-Erkennungsmodell (VAD, ${groesse}) geladen: ${vorhanden ? 'vorhanden.' : 'noch nicht geladen.'}`,
      vadGroesseUnbekannt: 'unter 1 MB',
      downloadAria: (label: string): string => `Download ${label}`,
      progressZeile: (
        label: string,
        empfangen: string,
        gesamt: string | null,
        prozent: string | null,
      ): string =>
        `${label}: ${empfangen}${gesamt !== null ? ` von ${gesamt}` : ''}${prozent !== null ? ` (${prozent} %)` : ''}`,
      bereit:
        'Alle benötigten Modelldateien sind vorhanden und gegen die fest hinterlegten Prüfsummen verifiziert. Es ist kein Download nötig.',
      ladeKnopf: 'Modell jetzt laden (einmalig)',
      laedt: 'Lädt ...',
      downloadHinweisEnglisch:
        'Hinweis: Der Modell-Download ist der einzige Moment, in dem VoiceWall das Internet nutzt (huggingface.co, mit Prüfsummen-Verifikation).',
      downloadHinweisDeutsch:
        'Hinweis: Der Modell-Download ist der einzige Moment, in dem VoiceWall das Internet nutzt (huggingface.co, mit Prüfsummen-Verifikation). Eine besonders kleine Q4-Notvariante für sehr schwache Rechner ist für eine spätere Version vorgesehen.',
    },

    hotkey: {
      titel: 'Tastenkürzel für das Diktat',
      lede: 'Ein Druck startet die Aufnahme, ein zweiter Druck beendet sie und fügt den Text in die aktive Anwendung ein. Das Kürzel gilt systemweit.',
      label: 'Tastenkombination',
      anzeigeVor: 'Anzeige: ',
      anzeigeNach: ' · Schreibweise nach Electron, z. B. CommandOrControl+Shift+D.',
      aufnehmen: 'Kombination einfangen',
      aufnehmenAktiv: 'Jetzt Tastenkombination drücken (Esc bricht ab)',
      testen: 'Live testen',
      testOk: 'Diese Tastenkombination ist frei und funktioniert.',
    },

    bedienungshilfen: {
      titel: 'macOS-Freigabe: Bedienungshilfen',
      lede: 'Für das automatische Einfügen simuliert VoiceWall genau einen Tastendruck (Cmd+V). Dafür verlangt macOS die Freigabe "Bedienungshilfen". VoiceWall liest damit keine Tastatur mit, liest keine Fenster anderer Programme und steuert nichts weiter (die vollständige, auditierbare Begründung liegt in docs/ACCESSIBILITY.md bei).',
      statusZeile: 'Freigabe-Status',
      statusErteilt: 'erteilt',
      statusFehlt: 'noch nicht erteilt',
      hinweisAbsatz1:
        'Ohne die Freigabe funktioniert alles außer dem automatischen Einfügen: der Text liegt dann in der Zwischenablage und wird mit Cmd+V eingefügt. Sie können die Freigabe auch später jederzeit erteilen.',
      hinweisAbsatz2:
        'So geht es: Knopf drücken, dann VoiceWall in der Liste aktivieren (ggf. über das Plus-Symbol hinzufügen), danach hier "Status aktualisieren" wählen.',
      hinweisAbsatz3:
        'Wichtig: macOS meldet eine frisch erteilte Freigabe an ein bereits laufendes Programm oft erst nach einem Neustart des Programms. Bleibt der Status hier auf "noch nicht erteilt", schließen Sie die Einrichtung einfach normal ab und starten VoiceWall danach einmal neu (der Knopf dafür steht anschließend im Bereich Diktat).',
      freigabeAnfordern: 'Freigabe anfordern (macOS-Dialog)',
      systemeinstellungen: 'Systemeinstellungen öffnen',
      statusAktualisieren: 'Status aktualisieren',
    },

    zusammenfassung: {
      titel: 'Zusammenfassung',
      lede: 'Bitte prüfen Sie die Angaben. Erst mit "Einrichten" legt VoiceWall den Firmenordner an und speichert die Konfiguration.',
      zeileFirma: 'Firma',
      zeileZielordner: 'Zielordner',
      zielDesktop: (ordnername: string): string => `Desktop/${ordnername}`,
      zielLokal: (ordnername: string): string =>
        `~/VoiceWall/${ordnername} (Desktop zeigt eine Verknüpfung)`,
      zeileAnsprechpartner: 'Ansprechpartner',
      zeileEmail: 'E-Mail',
      zeileStandort: 'Standort',
      zeileSprache: 'Sprache',
      spracheDeutsch: 'Deutsch (de)',
      spracheEnglisch: 'Englisch (en)',
      zeileModell: 'Modell',
      modellMehrsprachig: 'Mehrsprachig (large-v3-turbo, Q5_0)',
      modellFp16: 'fp16 (maximale Genauigkeit)',
      modellQ5: 'Q5_0 (empfohlen)',
      zeileHotkey: 'Tastenkürzel',
      zeileEinwilligung: 'Mikrofon-Einwilligung',
      einwilligungWird: 'wird bei Einrichtung erteilt',
      einwilligungFehlt: 'fehlt',
      fehlerMitVorschlag: (meldung: string, vorschlag: string): string =>
        `${meldung} Vorschlag: ${vorschlag}`,
    },

    navigation: {
      abbrechen: 'Abbrechen',
      beenden: 'Einrichtung beenden',
      zurueck: 'Zurück',
      weiter: 'Weiter',
      einrichten: 'Einrichten',
      richteEin: 'Richte ein ...',
    },

    erfolg: {
      titel: 'Einrichtung abgeschlossen',
      siegel: (ordnername: string, uebernommen: boolean): string =>
        `✓ Firma "${ordnername}" ${uebernommen ? 'übernommen' : 'angelegt'}`,
      anleitungTitel: 'So diktieren Sie',
      schritt1Vor: 'Cursor in ein Textfeld setzen (Word, Outlook, Browser), dann ',
      schritt1Nach: ' drücken.',
      schritt2: 'Sprechen. Ein kleines Fenster zeigt "Ich höre zu".',
      schritt3Vor: 'Erneut ',
      schritt3Nach:
        ' drücken: der Text erscheint an der Cursor-Position (und liegt zusätzlich in der Zwischenablage).',
      selbsttestTitel: 'Selbst prüfen: VoiceWall sendet keine Daten (Netzwerk-Selbsttest)',
      selbsttestIntro:
        'Das Versprechen "100 Prozent lokal" müssen Sie nicht glauben, Sie können es selbst nachprüfen (ausführlich in der beiliegenden Anleitung docs/NETZWERK-SELBSTTEST.md):',
      selbsttestPunkt1Titel: 'Netzwerk-Anzeige der App:',
      selbsttestPunkt1:
        ' Entwicklertools öffnen (Cmd+Alt+I bzw. F12), Reiter Netzwerk, dann diktieren. Es erscheint kein einziger Eintrag zu einer externen Adresse.',
      selbsttestPunkt2Titel: 'Verbindungsmonitor des Systems:',
      selbsttestPunkt2:
        ' macOS: LuLu/Little Snitch oder lsof; Windows: Ressourcenmonitor, Reiter Netzwerk. VoiceWall baut im Betrieb keine Verbindung auf.',
      selbsttestPunkt3Titel: 'Der Netzstecker:',
      selbsttestPunkt3:
        ' Internet trennen (WLAN aus, Kabel ziehen) und wie gewohnt diktieren. VoiceWall funktioniert vollständig offline.',
      selbsttestAusnahme:
        'Einzige Ausnahme: der einmalige, prüfsummen-verifizierte Modell-Download bei der Einrichtung.',
      zurVerwaltung: 'Zur Verwaltung',
    },
  },

  verwaltung: {
    firmaWaehlenAria: 'Firma wählen',
    firmaLabel: 'Firma',
    keineFirma: 'Noch keine Firma angelegt.',
    diktatspracheLabel: 'Diktatsprache',
    diktatspracheDeutsch: 'Deutsch',
    diktatspracheEnglisch: 'Englisch',
    diktatspracheUmgestelltEn:
      'Diktatsprache auf Englisch umgestellt (mehrsprachiges Originalmodell). Falls das Modell noch fehlt, startet beim nächsten Diktat bzw. über "Modelle laden und Engine starten" ein einmaliger Download von ca. 574 MB.',
    diktatspracheUmgestelltDe: 'Diktatsprache auf Deutsch umgestellt (deutsch-optimiertes Modell).',
    autoSpeichern: 'Diktate automatisch speichern',
    neueFirma: 'Neue Firma einrichten',
    navAria: 'Verwaltungsbereiche',
    tabDiktat: 'Diktat',
    tabRegister: 'Register',
    tabPapierkorb: 'Papierkorb',
    tabBeleg: 'Beleg',
  },

  diktat: {
    titel: 'Diktat',
    lede: 'Der operative Bereich: systemweites Diktat per Tastenkürzel, das letzte Ergebnis mit Kopieren-Knopf und eine Testaufnahme als Funktionsbeleg für den Vor-Ort-Termin.',
    abschnittDiktatAria: 'Systemweites Diktat',
    abschnittDiktat: 'Systemweites Diktat',
    hotkeyZeile: 'Tastenkürzel (Toggle):',
    hotkeyUnbekannt: 'unbekannt',
    hotkeyKonflikt: '(nicht aktiv: Kombination ist bereits belegt, bitte eine andere wählen)',
    zustandZeile: 'Zustand:',
    neueKombination: 'Neue Tastenkombination:',
    hotkeyPlatzhalter: 'z. B. CommandOrControl+Shift+D',
    hotkeyUebernehmen: 'Hotkey übernehmen',
    clipboardWiederherstellen:
      'Zwischenablage nach dem Einfügen wiederherstellen (Datenschutz, empfohlen)',
    accessibilityHinweis:
      'Für das automatische Einfügen braucht VoiceWall die macOS-Freigabe "Bedienungshilfen". Ohne Freigabe bleibt der Text in der Zwischenablage (Cmd+V zum Einfügen). So geht es: Knopf drücken, dann VoiceWall in der Liste aktivieren und das Diktat erneut ausführen. Was VoiceWall mit der Freigabe tut und was nicht, steht in docs/ACCESSIBILITY.md. Zwei Stolpersteine: 1. Nach einem Update zeigt ein ALTER VoiceWall-Eintrag in der Liste den Schalter als aktiv, gilt aber nur für die alte Programmversion: den alten Eintrag mit dem Minus-Symbol entfernen, dann über "Freigabe anfordern" neu eintragen lassen. 2. macOS meldet eine frisch erteilte Freigabe an das laufende Programm oft erst nach einem Neustart, dafür gibt es den Neustart-Knopf.',
    freigabeAnfordern: 'Freigabe anfordern (macOS-Dialog)',
    systemeinstellungen: 'Systemeinstellungen öffnen',
    neuStarten: 'VoiceWall neu starten',
    letztesDiktat: 'Letztes Diktat',
    keinDiktat:
      'Noch kein Diktat. Der Text des letzten Diktats bleibt hier abrufbar und geht nie verloren, auch wenn das automatische Einfügen scheitert.',
    kopieren: 'Kopieren',
    kopiertHinweis: 'Text wurde in die Zwischenablage kopiert (Cmd/Strg+V zum Einfügen).',
    alsDiktatSpeichern: 'Als Diktat speichern',
    gespeichertHinweis: (pfad: string): string => `Diktat gespeichert: ${pfad}`,

    abschnittStatus: 'Status',
    statusEinwilligung: 'Einwilligung:',
    einwilligungErteilt: 'erteilt',
    einwilligungAusstehend: 'ausstehend',
    statusMikrofon: 'Mikrofon (OS):',
    mikrofonUnbekannt: 'unbekannt',
    statusDiktatsprache: 'Diktatsprache (aktive Firma):',
    spracheDeutsch: 'Deutsch (de)',
    spracheEnglisch: 'Englisch (en)',
    statusModelle: 'Modelle:',
    modelleVorhanden: 'vorhanden und verifiziert',
    modelleUnvollstaendig: 'nicht vollständig',
    statusEngine: 'Engine:',
    engineBereit: 'bereit',
    engineNichtGestartet: 'nicht gestartet',
    modellVorhanden: 'vorhanden',
    modellFehlt: (groesse: string): string => `fehlt (${groesse})`,
    downloadAria: 'Modell-Download',
    progressZeile: (
      label: string,
      empfangen: string,
      gesamt: string | null,
      prozent: string | null,
    ): string =>
      `${label}: ${empfangen}${gesamt !== null ? ` von ${gesamt}` : ''}${prozent !== null ? ` (${prozent} %)` : ''}`,

    abschnittFunktionsbeleg: 'Funktionsbeleg (Testaufnahme)',
    abschnittFunktionsbelegAria: 'Funktionsbeleg',
    einwilligungErteilen: 'Mikrofon-Einwilligung erteilen',
    modelleLaden: 'Modelle laden und Engine starten',
    testaufnahmeStarten: 'Testaufnahme starten',
    testaufnahmeStoppen: 'Testaufnahme stoppen',
    lokalHinweis:
      'Ihre Sprache wird ausschließlich lokal auf diesem Rechner verarbeitet. Es werden keine Audiodaten gespeichert oder an einen Server gesendet.',
    keinTranskript: 'Noch kein Transkript.',
    transkriptMeta: (durationMs: number, audioSekunden: string): string =>
      `${String(durationMs)} ms für ${audioSekunden} s Audio`,

    abschnittWoerterbuch: 'Wörterbuch und Aufbereitung',
    woerterbuchHinweis:
      'Alles hier ist reine, lokale Regelverarbeitung: kein Sprachmodell, kein externer Aufruf. Jede Regel ist deterministisch und nachvollziehbar.',
    fuellwoerterLabel:
      'Füllwörter entfernen: eigenständige "äh", "ähm", "öhm", "hm" und direkte Wortdopplungen ("das das"). Konservativ; seltene legitime Dopplungen können mitgetroffen werden.',
    sprachkommandosLabel:
      'Sprachkommandos umsetzen: "Punkt", "Komma", "Fragezeichen", "Ausrufezeichen", "Doppelpunkt", "neue Zeile", "neuer Absatz". Standardmäßig aus, weil die Regel auch die normale Verwendung des Wortes "Punkt" treffen kann.',
    fachwoerterbuchTitel: 'Fach-Wörterbuch der aktiven Firma',
    fachwoerterbuchKeineFirma:
      'Noch keine Firma angelegt. Das Fach-Wörterbuch gehört zur Firma und liegt auditierbar in deren Ordner (.voicewall/vokabular.json).',
    fachwoerterbuchHinweis:
      'Begriffe (Eigennamen, Fachbegriffe, Aktenzeichen) verbessern die Erkennung: sie werden der Spracherkennung lokal als Kontext mitgegeben. Ersetzungen korrigieren häufige Fehltranskriptionen deterministisch, nur als ganze Wörter und exakt in der eingegebenen Groß-/Kleinschreibung.',
    entfernen: 'Entfernen',
    neuerBegriff: 'Neuer Begriff:',
    begriffPlatzhalter: 'z. B. VoiceWall',
    hinzufuegen: 'Hinzufügen',
    ersetzungVon: 'Ersetzung von:',
    ersetzungVonPlatzhalter: 'z. B. Voice Wall',
    ersetzungZu: 'zu:',
    ersetzungZuPlatzhalter: 'z. B. VoiceWall',
    woerterbuchSpeichern: 'Wörterbuch speichern',
    woerterbuchGespeichert: 'Wörterbuch gespeichert (atomar, im Firmenordner).',
    fehlerTitel: 'Fehler',
    fehlerAria: 'Fehler',
  },

  register: {
    titel: 'Register',
    lede: 'Das Aktenverzeichnis dieser Firma: alle Diktate und Notizen, durchsuchbar und filterbar. Ein Klick öffnet den vollständigen Text.',
    schnellsuche: 'Schnellsuche:',
    suchePlatzhalter: 'Titel, Tag oder Textvorschau',
    sortierung: 'Sortierung:',
    sortDatum: 'Datum (neueste zuerst)',
    sortTitel: 'Titel (A bis Z)',
    sortWortzahl: 'Wortzahl (absteigend)',
    neueNotiz: 'Neue Notiz',
    tagsVerwalten: 'Tags verwalten',
    volltextToggle: 'Auch im Volltext suchen (durchsucht die vollständigen Texte, etwas langsamer)',
    zeitraumVon: 'Zeitraum von',
    zeitraumBis: 'bis',
    quelleLabel: 'Quelle',
    quelleAlle: 'alle',
    filterZuruecksetzen: 'Filter zurücksetzen',
    tagFilterAria: 'Nach Tags filtern',
    tagFilterLabel: 'Tags:',
    wirdGeladen: 'Wird geladen ...',
    ausgewaehlt: (anzahl: number): string => `${String(anzahl)} ausgewählt`,
    exportformat: 'Exportformat:',
    formatMdMitKopf: 'Markdown (mit Kopf)',
    formatMdOhneKopf: 'Markdown (ohne Kopf)',
    formatTxt: 'TXT',
    formatPdf: 'PDF',
    auswahlExportieren: (anzahl: number): string => `Auswahl exportieren (${String(anzahl)})`,
    gefilterteExportieren: (anzahl: number): string =>
      `Alle gefilterten exportieren (${String(anzahl)})`,
    auswahlAufheben: 'Auswahl aufheben',
    exportFortschritt: (fertig: number, gesamt: number): string =>
      `Exportiere ${String(fertig)} von ${String(gesamt)} Einträgen ...`,
    exportErgebnis: (anzahl: number, anzeigePfad: string, fehler: number): string =>
      `${String(anzahl)} ${anzahl === 1 ? 'Eintrag' : 'Einträge'} exportiert nach: ${anzeigePfad}.${fehler > 0 ? ` ${String(fehler)} Einträge konnten nicht exportiert werden.` : ''}`,
    imFinderZeigen: 'Im Finder zeigen',
    auswahlAria: (titel: string): string => `"${titel}" für den Stapel-Export auswählen`,
    wortzahl: (anzahl: number): string => `${String(anzahl)} Wörter`,
    volltextTreffer: (snippet: string): string => `Volltext-Treffer: ${snippet}`,
    leerMitFilter:
      'Keine Einträge passen zu den aktuellen Filtern. Bitte Suche oder Filter anpassen.',
    leerTitel: 'Noch keine Diktate in dieser Firma.',
    leerLede: 'So entsteht der erste Eintrag:',
    leerSchritt1: 'Cursor in ein Textfeld setzen und das Tastenkürzel drücken.',
    leerSchritt2: 'Sprechen. Ein kleines Fenster zeigt "Ich höre zu".',
    leerSchritt3: 'Erneut das Tastenkürzel drücken: der Text erscheint und wird hier abgelegt.',
    leerAlternative: 'Alternativ oben über "Neue Notiz" einen Eintrag ohne Diktat anlegen.',

    detail: {
      zurueck: '← Zurück zum Register',
      bearbeitenTitel: 'Eintrag bearbeiten',
      zeileErstellt: 'Erstellt',
      zeileGeaendert: 'Geändert',
      zeileQuelle: 'Quelle',
      zeileModell: 'Modell',
      zeileDauer: 'Dauer',
      dauerSekunden: (sekunden: number): string => `${String(sekunden)} s`,
      zeileWortzahl: 'Wortzahl',
      zeileZielApp: 'Ziel-App',
      zeileVersion: 'Version',
      zeileTags: 'Tags',
      keinWert: '—',
      volltextTitel: 'Volltext',
      bearbeiten: 'Bearbeiten',
      exportMd: 'Export Markdown (mit Kopf)',
      exportMdOhne: 'Export Markdown (ohne Kopf)',
      exportTxt: 'Export TXT',
      exportPdf: 'Export PDF',
      exportVerschluesselt: 'Verschlüsselt exportieren (.vwenc)',
      inDenPapierkorb: 'In den Papierkorb',
      exportiertNach: (anzeigePfad: string): string => `Exportiert nach: ${anzeigePfad}`,
      verschluesseltExportiert: (anzeigePfad: string): string =>
        `Verschlüsselt exportiert nach: ${anzeigePfad}. Ohne das Passwort ist die Datei nicht lesbar.`,
      gespeichert: 'Änderungen gespeichert.',
      titelLabel: 'Titel',
      textLabel: 'Text',
      tagsLabel: 'Tags',
      tagEntfernenAria: (tag: string): string => `Tag ${tag} entfernen`,
      tagPlatzhalter: 'Tag hinzufügen, Enter',
      speichern: 'Speichern',
      speichert: 'Speichert ...',
      abbrechen: 'Abbrechen',
      loeschenTitel: 'In den Papierkorb verschieben?',
      loeschenText:
        'Der Eintrag wird in den Papierkorb verschoben. Von dort kann er wiederhergestellt oder endgültig gelöscht werden.',
      loeschenBestaetigen: 'In den Papierkorb',
      verschluesselnTitel: 'Verschlüsselt exportieren (.vwenc)',
      verschluesselnBeschreibung:
        'Der Eintrag wird als Markdown mit AES-256-GCM verschlüsselt und im Ordner Exporte/ abgelegt. Entschlüsseln ist in der Beleg-Ansicht unter „Datei entschlüsseln“ möglich.',
      verschluesselnWarnung:
        'Wichtig: Das Passwort wird nirgends gespeichert. Geht es verloren, ist der Inhalt der Datei unwiederbringlich verloren.',
      verschluesselnBestaetigen: 'Verschlüsselt exportieren',
    },

    tagRename: {
      titel: 'Tags verwalten',
      hinweis:
        'Ein Tag wird firmenweit umbenannt: über alle Diktate und Notizen, einschließlich Papierkorb.',
      bestehenderTag: 'Bestehender Tag',
      neuerName: 'Neuer Name',
      ergebnis: (alt: string, neu: string, gesamt: number, papierkorb: number): string =>
        `Tag „${alt}“ wurde zu „${neu}“ umbenannt: ${String(gesamt)} ${gesamt === 1 ? 'Eintrag' : 'Einträge'} aktualisiert${papierkorb > 0 ? ` (davon ${String(papierkorb)} im Papierkorb)` : ''}.`,
      umbenennen: 'Umbenennen',
      benenntUm: 'Benennt um ...',
      schliessen: 'Schließen',
    },

    notiz: {
      titel: 'Neue Notiz',
      titelLabel: 'Titel',
      textLabel: 'Text',
      anlegen: 'Notiz anlegen',
      speichert: 'Speichert ...',
      abbrechen: 'Abbrechen',
    },
  },

  papierkorb: {
    titel: 'Papierkorb',
    lede: 'Gelöschte Diktate liegen hier, bis sie wiederhergestellt oder endgültig gelöscht werden. So ist ein versehentliches Löschen eines Kundendiktats umkehrbar.',
    wirdGeladen: 'Wird geladen ...',
    leer: 'Der Papierkorb ist leer.',
    wortzahl: (anzahl: number): string => `${String(anzahl)} Wörter`,
    wiederherstellen: 'Wiederherstellen',
    endgueltigLoeschen: 'Endgültig löschen',
    bestaetigungTitel: 'Endgültig löschen?',
    bestaetigungText: (titel: string): string =>
      `Der Eintrag "${titel}" wird unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`,
  },

  beleg: {
    titel: 'Beleg',
    lede: 'VoiceWall arbeitet vollständig auf diesem Rechner. Dieser Bereich belegt das mit prüfbaren Fakten, statt es nur zu behaupten.',
    stempelTitel: 'Null externe Verbindungen im Betrieb',
    stempelText: (dokument: string): string =>
      `Nach dem einmaligen Modell-Download baut VoiceWall keine Netzwerkverbindung mehr auf. Die Content-Security-Policy der Oberfläche verbietet jede externe Verbindung. Sie können das selbst nachprüfen (siehe unten, ausführlich in ${dokument}).`,
    wirdGeladen: 'Wird geladen ...',
    eckdatenTitel: 'Eckdaten',
    zeileAppVersion: 'App-Version',
    zeilePlattform: 'Plattform',
    zeileEinwilligung: 'Mikrofon-Einwilligung',
    einwilligungErteiltAm: (zeitpunkt: string): string => `erteilt am ${zeitpunkt}`,
    einwilligungFehlt: 'noch nicht erteilt',
    zeileModellordner: 'Modellordner',
    zeileBetriebslog: 'Betriebslog',
    modelleTitel: 'Modelle (Version und Prüfsumme)',
    badgeAktiv: 'aktiv',
    modellVorhanden: 'vorhanden und verifiziert',
    modellFehlt: 'nicht geladen',
    selbsttestTitel: 'Netzwerk-Selbsttest',
    selbsttestIntro:
      'Prüfen Sie das Versprechen "100 Prozent lokal" selbst. Drei unabhängige Proben, von der eingebauten Netzwerk-Anzeige bis zum gezogenen Netzstecker:',
    selbsttestErgebnis: 'Erwartetes Ergebnis:',
    selbsttestProben: NETZWERK_SELBSTTEST_PROBEN,
    selbsttestDokument: NETZWERK_SELBSTTEST_DOKUMENT,
    backupTitel: 'Backup und Verschlüsselung',
    backupWarnung: BACKUP_KLARTEXT_WARNUNG,
    backupHinweise: BACKUP_HINWEISE,
    backupDokumentHinweis: (dokument: string): string =>
      `Diese Hinweise liegen ausführlich in ${dokument} bei (Teil des Beleg-Blatts).`,
    backupDokument: BACKUP_HINWEISE_DOKUMENT,
    entschluesseln: 'Datei entschlüsseln (.vwenc)',
    entschluesseltNach: (zielPfad: string): string => `Entschlüsselt nach: ${zielPfad}`,
    entschluesselnTitel: 'Datei entschlüsseln (.vwenc)',
    entschluesselnBeschreibung:
      'Nach der Passwort-Eingabe öffnet sich die Dateiauswahl. Die entschlüsselte Datei wird neben der .vwenc-Datei abgelegt, nichts wird überschrieben.',
    entschluesselnBestaetigen: 'Datei wählen und entschlüsseln',
    impressumTitel: 'Über VoiceWall (Anbieterkennzeichnung)',
    impressumSprachHinweis:
      'Die Anbieterkennzeichnung und alle Rechtstexte werden auf Deutsch bereitgestellt (deutsches Recht).',
    impressumQuelle: (url: string): string => `Quelle im Browser öffnen (${url})`,
  },

  passwortDialog: {
    passwortLabel: 'Passwort',
    passwortMindestlaenge: (minLength: number): string =>
      `(mindestens ${String(minLength)} Zeichen)`,
    wiederholenLabel: 'Passwort wiederholen',
    fehlerZuKurz: (minLength: number): string =>
      `Das Passwort muss mindestens ${String(minLength)} Zeichen lang sein.`,
    fehlerLeer: 'Bitte das Passwort eingeben.',
    fehlerUngleich: 'Die beiden Passwörter stimmen nicht überein.',
    bitteWarten: 'Bitte warten ...',
    abbrechen: 'Abbrechen',
  },

  format: {
    quelle: {
      diktat: 'Diktat',
      import: 'Import',
      manuell: 'Notiz',
    },
    flowState: {
      idle: 'bereit',
      recording: 'Aufnahme läuft',
      transcribing: 'transkribiert',
      delivering: 'fügt Text ein',
    },
  },

  overlay: {
    recording: 'Ich höre zu ...',
    transcribing: 'Transkribiere ...',
    done: 'Text eingefügt.',
    noSpeech: 'Keine Sprache erkannt.',
    error: 'Fehler beim Einfügen.',
    kopieren: 'Kopieren',
  },
};
