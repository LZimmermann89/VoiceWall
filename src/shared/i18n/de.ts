/**
 * Deutscher Text-Katalog der Oberfläche:
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
 * - Meldungen aus dem MAIN-Prozess (Result-Fehler, engineHinweis, Tray,
 *   Modell-Anzeigenamen, PDF-Vorlage) stehen im Bereich `main`;
 *   der Main-Prozess adressiert sie über
 *   src/main/i18n.ts (texte()). Die deutschen Texte sind 1:1 aus den
 *   Main-Modulen extrahiert. LOGS bleiben bewusst deutsch.
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
    tabModelle: 'Modelle',
    tabBeleg: 'Beleg',
  },

  /** Ansicht "Modelle" (Verwaltung). */
  modelleTab: {
    titel: 'Modelle',
    lede: 'Alle Erkennungsmodelle dieses Rechners im Überblick: Zweck, Größe, Prüfsumme und Status. Fehlende Modelle lassen sich hier einzeln laden, nicht benötigte löschen.',
    zweck: {
      'whisper-q5': 'Deutsches Diktat (Standard)',
      'whisper-fp16': 'Deutsches Diktat, maximale Genauigkeit (optional, starke Hardware)',
      'turbo-q5_0-multilingual': 'Englisches Diktat (mehrsprachiges Originalmodell)',
      'silero-vad': 'Spracherkennungs-Segmentierung (VAD, für jedes Diktat nötig)',
    },
    zweckLabel: 'Zweck:',
    groesseLabel: 'Größe:',
    pruefsummeLabel: 'SHA-256:',
    statusVorhanden: 'vorhanden und verifiziert',
    statusFehlt: 'fehlt',
    badgeErforderlich: 'aktiv benötigt',
    erforderlichHinweis:
      'Dieses Modell wird von der Diktatsprache der aktiven Firma bzw. für jedes Diktat benötigt und kann nicht gelöscht werden.',
    laden: 'Herunterladen',
    laedt: 'Lädt ...',
    loeschen: 'Löschen',
    wirdGeladen: 'Wird geladen ...',
    downloadFertig: (label: string): string => `Modell geladen und verifiziert: ${label}.`,
    geloescht: (label: string): string =>
      `Modell gelöscht: ${label}. Es wird bei Bedarf einfach erneut geladen.`,
    loeschenTitel: 'Modell löschen?',
    loeschenText: (label: string, groesse: string): string =>
      `Die Modelldatei "${label}" (${groesse}) wird von diesem Rechner gelöscht. Es gehen keine Diktate verloren; wird das Modell später wieder gebraucht, lädt VoiceWall es einmalig erneut herunter.`,
    loeschenBestaetigen: 'Modell löschen',
    downloadHinweis:
      'Der Modell-Download ist der einzige Moment, in dem VoiceWall das Internet nutzt (huggingface.co, verifiziert gegen die fest hinterlegte Prüfsumme). Downloads laufen einzeln nacheinander.',
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
      'Sprachkommandos umsetzen: "Punkt", "Komma", "Fragezeichen", "Ausrufezeichen", "Doppelpunkt", "neue Zeile", "Zeilenumbruch", "neuer Absatz", "Absatz" (englisches Diktat: "period", "comma", "new line", "new paragraph", "paragraph"). Satzzeichen, die die Spracherkennung selbst um ein Kommandowort setzt, werden mitentfernt ("Test, Punkt." wird zu "Test."). Manchmal wandelt die Erkennung ein gesprochenes "Punkt" auch direkt in ein Satzzeichen um; dann steht kein Kommandowort im Text und das Ergebnis stimmt trotzdem. Standardmäßig aus, weil die Regel auch die normale Verwendung von Wörtern wie "Punkt" oder "Absatz" trifft.',
    fachwoerterbuchTitel: 'Fach-Wörterbuch der aktiven Firma',
    fachwoerterbuchKeineFirma:
      'Noch keine Firma angelegt. Das Fach-Wörterbuch gehört zur Firma und liegt auditierbar in deren Ordner (.voicewall/vokabular.json).',
    fachwoerterbuchHinweis:
      'Begriffe (Eigennamen, Fachbegriffe, Aktenzeichen) verbessern die Erkennung: sie werden der Spracherkennung lokal als Kontext mitgegeben. Ersetzungen korrigieren häufige Fehltranskriptionen deterministisch, nur als ganze Wörter und exakt in der eingegebenen Groß-/Kleinschreibung.',
    fachwoerterbuchErwartung:
      'Ehrliche Einordnung: Begriffe machen die korrekte Erkennung seltener Namen wahrscheinlicher, garantieren sie aber nicht. Für hartnäckige Fehlerkennungen die Ersetzungsliste nutzen: wird zum Beispiel "Plaud" als "blaut" erkannt, eine Regel "blaut" zu "Plaud" anlegen.',
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
    woerterbuchUngespeichert:
      'Noch nicht gespeichert: Änderungen wirken erst nach "Wörterbuch speichern".',
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
      zeileErsetzungen: 'Angewandte Ersetzungen',
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

  /** Sofort sichtbare Meldungen (Toast-System). */
  toast: {
    fehlerKicker: 'Fehler',
    erfolgKicker: 'Bestätigt',
    schliessenAria: 'Meldung schließen',
  },

  /**
   * Nutzersichtbare Texte des MAIN-Prozesses:
   * Result-Fehlermeldungen, Tray, Overlay-Zustellmeldungen, PDF-Vorlage und
   * Modell-Anzeigenamen. Gegliedert nach Herkunftsmodul. Die deutschen Texte
   * sind 1:1 aus den Main-Modulen extrahiert (prüfbarer Diff).
   */
  main: {
    generisch: {
      internerFehler: 'Unerwarteter interner Fehler. Details stehen im lokalen Log unter userData.',
      statusFehler: 'Interner Fehler beim Statusabruf. Details stehen im lokalen Log.',
      unbekannt: 'unbekannt',
      unbekannterFehler: 'unbekannter Fehler',
    },

    // stt/orchestrator.ts
    stt: {
      ungueltigeDiktatsprache: 'Ungültige Diktatsprache.',
      keinPcmPuffer: 'Kein gültiger PCM-Puffer.',
      einwilligungZuerst: 'Bitte zuerst die Mikrofon-Einwilligung erteilen.',
      sprachwechselEnglisch:
        'Sprachwechsel: die Spracherkennung startet mit dem mehrsprachigen Modell (Englisch) neu ...',
      sprachwechselDeutsch:
        'Sprachwechsel: die Spracherkennung startet mit dem deutschen Modell neu ...',
      modelleFehlenEnglisch:
        'Das mehrsprachige Erkennungsmodell für Englisch fehlt. Bitte den einmaligen Modell-Download starten (Knopf "Modelle laden und Engine starten" bzw. Einrichtungs-Assistent, ca. 574 MB).',
      modelleFehlenDeutsch:
        'Die Modelle fehlen. Bitte zuerst den einmaligen Modell-Download im Einrichtungs-Assistenten ausführen.',
      engineNichtVerfuegbar: 'Engine nicht verfügbar.',
      /** Fehlertext des Capture-Fensters; das Detail liefert getUserMedia. */
      mikrofonZugriffFehler: (detail: string): string =>
        `Der Mikrofonzugriff ist fehlgeschlagen (${detail}). Bitte prüfen, ob ein Mikrofon angeschlossen ist und VoiceWall Zugriff hat.`,
    },

    // whisper/engine-manager.ts und whisper/engine.worker.ts
    engine: {
      beendetVorErgebnis: 'Engine wurde beendet, bevor ein Ergebnis vorlag.',
      mehrfachAbgestuerzt:
        'Die Spracherkennung ist mehrfach abgestürzt und konnte nicht neu gestartet werden. Bitte VoiceWall neu starten; bleibt der Fehler, das Log unter userData prüfen.',
      nochNichtBereit: 'Die Spracherkennung ist noch nicht bereit.',
      nichtBereit: 'Engine nicht bereit.',
      ungueltigeNachricht: (detail: string): string => `Ungültige Worker-Nachricht: ${detail}`,
    },

    // dictation/flow-controller.ts
    flow: {
      overlayTextEingefuegt: 'Text eingefügt (und in der Zwischenablage).',
      overlayTextInZwischenablage: 'Text liegt in der Zwischenablage.',
      hotkeyBelegt: (accelerator: string): string =>
        `Die Tastenkombination ${accelerator} ist bereits von einer anderen App oder vom System belegt. Bitte im VoiceWall-Fenster unter "Systemweites Diktat" eine andere Kombination wählen, z. B. CommandOrControl+Alt+D.`,
      hotkeyWechselBelegt: (neu: string, bisher: string): string =>
        `Die Tastenkombination ${neu} ist bereits systemweit belegt. Der bisherige Hotkey ${bisher} bleibt aktiv. Bitte eine andere Kombination versuchen.`,
      hotkeyTestBelegt: (accelerator: string): string =>
        `Die Tastenkombination ${accelerator} ist bereits von einer anderen App oder vom System belegt. Bitte eine andere Kombination wählen.`,
      /** Ersetzt die zod-Meldung des hotkeyAcceleratorSchema an der IPC-Grenze. */
      ungueltigeTastenkombination:
        'Ungültige Tastenkombination. Bitte mindestens eine Modifier-Taste (z. B. CommandOrControl, Alt, Shift) und genau eine Taste angeben, etwa "CommandOrControl+Shift+D".',
      eingabeTastenkombination: 'Ungültige Eingabe für die Tastenkombination.',
      eingabeZwischenablage: 'Ungültige Eingabe für den Zwischenablage-Schalter.',
      eingabeAufbereitung: 'Ungültige Eingabe für die Aufbereitungs-Schalter.',
      eingabeUiSprache: 'Ungültige Eingabe für die Sprache der Oberfläche.',
      ungueltigeModellwahl: 'Ungültige Modellwahl.',
      keinDiktatVorhanden:
        'Es gibt noch kein Diktat. Bitte zuerst per Hotkey oder Testaufnahme diktieren.',
      firmenverwaltungFehlt: 'Die Firmenverwaltung ist nicht verfügbar.',
      // Dev-/Test-IPC (nie im ausgelieferten Produkt, aber nutzersichtbar im Test).
      eingabePasteMock: 'Ungültige Eingabe für den Paste-Mock.',
      eingabeAccessibilityOverride: 'Ungültige Eingabe für den Accessibility-Override.',
      ungueltigerText: 'Ungültiger Text.',
      aufbereiteterTextLeer: 'Der aufbereitete Text ist leer (nur Füllwörter/Leerraum).',
      vadStille: 'VAD meldete Stille, kein Text erzeugt.',
    },

    // paste/index.ts, paste/macos.ts, paste/windows.ts
    paste: {
      fehlgeschlagenMacos: (detail: string): string =>
        `Automatisches Einfügen fehlgeschlagen${detail}. Der Text liegt in der Zwischenablage, bitte mit Cmd+V manuell einfügen. Bleibt der Fehler, in den Systemeinstellungen unter Datenschutz und Sicherheit, Bedienungshilfen die Freigabe für VoiceWall prüfen.`,
      fehlgeschlagenWindows: (detail: string): string =>
        `Automatisches Einfügen fehlgeschlagen${detail}. Der Text liegt in der Zwischenablage, bitte mit Strg+V manuell einfügen. Hinweis: Läuft die Ziel-App als Administrator, blockiert Windows simulierte Eingaben (UIPI); dann bitte immer den Kopieren-Knopf verwenden.`,
      nichtUnterstuetzt:
        'Automatisches Einfügen wird auf diesem Betriebssystem nicht unterstützt. Der Text liegt in der Zwischenablage, bitte mit Strg+V manuell einfügen.',
    },

    // permission/accessibility.ts und permission/microphone.ts
    freigaben: {
      accessibilityFehlt:
        'Automatisches Einfügen ist noch nicht möglich: VoiceWall hat keine Bedienungshilfen-Freigabe. Der Text liegt in der Zwischenablage, bitte mit Cmd+V manuell einfügen. So erteilen Sie die Freigabe: 1. Knopf "Systemeinstellungen öffnen" drücken (oder Systemeinstellungen, Datenschutz und Sicherheit, Bedienungshilfen). 2. VoiceWall in der Liste aktivieren (ggf. über das Plus-Symbol hinzufügen). 3. Diktat erneut ausführen.',
      accessibilityDialogAngezeigt:
        'macOS hat den Freigabe-Dialog angezeigt. Bitte dort "Systemeinstellungen öffnen" wählen, den Schalter für VoiceWall aktivieren und danach VoiceWall über den Knopf neu starten. Wichtig nach einem Update: einen bereits vorhandenen alten VoiceWall-Eintrag vorher mit dem Minus-Symbol entfernen, er gehört zur alten Programmversion.',
      nurMacos: 'Dieser Einstellungs-Link existiert nur auf macOS.',
      einstellungenFehler: (detail: string): string =>
        `Die Systemeinstellungen konnten nicht geöffnet werden (${detail}). Bitte manuell öffnen: Systemeinstellungen, Datenschutz und Sicherheit, Bedienungshilfen.`,
      mikrofonAbgelehnt:
        'Der Mikrofonzugriff wurde abgelehnt. Bitte in den Systemeinstellungen unter Datenschutz und Sicherheit, Mikrofon, VoiceWall erlauben und die App neu starten.',
      mikrofonGesperrt:
        'Der Mikrofonzugriff ist gesperrt. Bitte in den Systemeinstellungen unter Datenschutz und Sicherheit, Mikrofon, VoiceWall aktivieren und die App neu starten.',
      mikrofonEingeschraenkt:
        'Der Mikrofonzugriff ist auf diesem Rechner eingeschränkt (z. B. durch eine Geräteverwaltung). Bitte die Systemadministration kontaktieren.',
    },

    // model/model-catalog.ts (Anzeigenamen), model/downloader.ts, model/model-store.ts
    modelle: {
      labels: {
        'whisper-q5': 'Deutsches Whisper-Modell (large-v3-turbo, Q5_0)',
        'whisper-fp16': 'Deutsches Whisper-Modell (large-v3-turbo, fp16, maximale Genauigkeit)',
        'turbo-q5_0-multilingual': 'Englisch / mehrsprachig (large-v3-turbo, Q5_0)',
        'silero-vad': 'Silero-VAD-Modell (v5.1.2)',
      },
      downloadNetzwerkfehler: (detail: string): string =>
        `Der Modell-Download ist fehlgeschlagen (Netzwerkfehler: ${detail}). Bitte die Internetverbindung prüfen und erneut versuchen. Nach dem einmaligen Download läuft VoiceWall vollständig offline.`,
      downloadAbgelehnt: (status: string): string =>
        `Der Server hat den Modell-Download abgelehnt (HTTP ${status}). Bitte später erneut versuchen oder die Modell-Quelle prüfen.`,
      downloadNichtGespeichert: (detail: string): string =>
        `Der Modell-Download konnte nicht gespeichert werden (${detail}). Bitte freien Speicherplatz und Schreibrechte prüfen.`,
      downloadGroesseFalsch: (ist: string, soll: string): string =>
        `Die heruntergeladene Datei hat eine unerwartete Größe (${ist} statt ${soll} Bytes). Die Datei wurde gelöscht. Bitte den Download erneut starten.`,
      downloadPruefsummeFalsch:
        'Die Prüfsumme der heruntergeladenen Modelldatei stimmt nicht mit dem erwarteten Wert überein. Die Datei wurde aus Sicherheitsgründen gelöscht. Bitte den Download erneut starten; tritt der Fehler wiederholt auf, ist die Quelle nicht vertrauenswürdig.',
      downloadNichtAbgelegt: (detail: string): string =>
        `Die verifizierte Modelldatei konnte nicht abgelegt werden (${detail}).`,
      dateiFehlt: (dateiname: string): string => `Datei fehlt: ${dateiname}`,
      dateiBeschaedigt: (dateiname: string): string =>
        `Die Modelldatei ${dateiname} ist beschädigt (Prüfsumme stimmt nicht). Sie muss neu geladen werden.`,
      modellFehltDownloadNoetig: (label: string): string =>
        `Das ${label} fehlt. Bitte den einmaligen Modell-Download im Einrichtungs-Assistenten starten.`,
      // Modelle-Reiter.
      unbekannteKennung: 'Unbekannte Modell-Kennung.',
      downloadLaeuftBereits:
        'Es läuft bereits ein Modell-Download. Downloads laufen einzeln nacheinander; bitte warten, bis der laufende Download abgeschlossen ist.',
      loeschenGesperrt: (label: string): string =>
        `Das Modell "${label}" wird aktuell benötigt (Diktatsprache der aktiven Firma bzw. Spracherkennungs-Segmentierung) und kann nicht gelöscht werden. Bitte zuerst die Diktatsprache der aktiven Firma umstellen.`,
      loeschenFehler: (detail: string): string =>
        `Die Modelldatei konnte nicht gelöscht werden: ${detail}`,
    },

    // storage/companies.ts, storage/company-folder.ts, storage/sync-detection.ts, storage/paths.ts
    firmen: {
      keineAktiveFirma: 'Keine aktive Firma. Bitte zuerst eine Firma anlegen oder aktivieren.',
      keineAktiveFirmaKurz: 'Keine aktive Firma.',
      desktopFehltStrategie:
        'Der Desktop-Ordner wurde nicht gefunden. Bitte die Strategie "lokal-mit-verknuepfung" verwenden.',
      desktopFehlt:
        'Der Desktop-Ordner wurde nicht gefunden. Bitte im Einrichtungs-Assistenten einen Zielordner für den Firmenordner auswählen.',
      lokalerOrdnerFehler: (detail: string): string =>
        `Der lokale VoiceWall-Ordner konnte nicht angelegt werden: ${detail}`,
      verknuepfungAngelegt: (ordnername: string, pfad: string): string =>
        `Auf dem Desktop liegt eine Verknüpfung "${ordnername}"; die Diktate selbst bleiben im lokalen Ordner ${pfad}.`,
      verknuepfungHinweis: (detail: string): string => `Hinweis: ${detail}`,
      verknuepfungKollision: (name: string): string =>
        `Auf dem Desktop existiert bereits ein Eintrag namens "${name}". VoiceWall überschreibt nichts; bitte den Eintrag prüfen oder einen anderen Namen wählen.`,
      verknuepfungFehler: (detail: string): string =>
        `Die Desktop-Verknüpfung konnte nicht angelegt werden: ${detail}`,
      nichtInListe:
        'Diese Firma ist nicht in der Liste der gültigen Firmenordner. Bitte die Firma zuerst anlegen oder öffnen.',
      keinGueltigerOrdner:
        'Dieser Ordner ist kein gültiger VoiceWall-Firmenordner an einem erlaubten Ort (Desktop oder ~/VoiceWall).',
      konfigNichtLesbar:
        'Die Firmen-Konfiguration ist nicht lesbar (.voicewall/config.json). Bitte den Firmenordner prüfen.',
      konfigUngueltig:
        'Die Firmen-Konfiguration ist ungültig (.voicewall/config.json). Bitte den Firmenordner prüfen.',
      konfigSchreibFehler: (detail: string): string =>
        `Die Firmen-Konfiguration konnte nicht geschrieben werden: ${detail}`,
      zielordnerNichtLesbar: (detail: string): string =>
        `Der Zielordner ist nicht lesbar: ${detail}`,
      ordnerFremd: (name: string): string =>
        `Der Ordner "${name}" existiert bereits und ist kein VoiceWall-Ordner. VoiceWall schreibt nicht in fremde Ordner. Bitte einen anderen Namen wählen, z. B. den Vorschlag übernehmen.`,
      ordnerAnlageFehler: (detail: string): string =>
        `Der Firmenordner konnte nicht angelegt werden: ${detail}`,
      syncWarnung: (anbieter: string): string =>
        `Achtung: Dieser Speicherort wird von ${anbieter} in die Cloud synchronisiert. ` +
        'Diktate würden damit das "100 Prozent lokal"-Versprechen verlassen. Empfehlung: Diktate in den ' +
        'lokalen Ordner ~/VoiceWall legen und auf dem Desktop nur eine Verknüpfung anzeigen. Die Wahl ' +
        'bleibt bei Ihnen; VoiceWall ändert nichts ohne Bestätigung.',
      eingabeFirmenname: 'Ungültige Eingabe für den Firmennamen.',
      eingabeFirmenAnlage: 'Ungültige Eingabe für die Firmen-Anlage.',
      ungueltigerFirmenpfad: 'Ungültiger Firmenpfad.',
      eingabeAutoSpeichern: 'Ungültige Eingabe für den Auto-Speichern-Schalter.',
    },

    // storage/sanitize.ts
    sanitize: {
      nameLeer:
        'Der Firmenname enthält keine für einen Ordnernamen verwendbaren Zeichen. Bitte einen Namen mit Buchstaben oder Ziffern eingeben.',
      nameReserviert:
        'Dieser Name ist unter Windows ein reservierter Gerätename und kann nicht als Ordnername verwendet werden. Bitte einen anderen Namen wählen.',
      containment:
        'Ungültiger Ordnername: der Pfad liegt außerhalb des Zielordners. Bitte einen anderen Namen wählen.',
      pfadZuLang: (laenge: string, grenze: string): string =>
        `Der vollständige Ordnerpfad würde ${laenge} Zeichen lang (Windows-Grenze: ${grenze}). Bitte einen kürzeren Firmennamen wählen.`,
    },

    // storage/containment.ts
    containment: {
      ausserhalb:
        'Ungültiger Pfad: der Eintrag zeigt außerhalb des Firmenordners und wird abgewiesen.',
    },

    // storage/transcripts.ts
    diktate: {
      titelFallback: 'Diktat',
      metadatenUngueltig: (detail: string): string => `Diktat-Metadaten sind ungültig: ${detail}`,
      ordnerAnlageFehler: (detail: string): string =>
        `Der Diktate-Ordner konnte nicht angelegt werden: ${detail}`,
      schreibFehler: (detail: string): string =>
        `Das Diktat konnte nicht geschrieben werden: ${detail}`,
      anlageKollision: 'Das Diktat konnte nicht angelegt werden (Dateinamens-Kollision).',
      nichtGefunden: 'Das Diktat wurde nicht gefunden oder ist nicht lesbar.',
      beschaedigt: (detail: string): string => `Das Diktat ist beschädigt: ${detail}`,
      schemaVerletzt: (detail: string): string =>
        `Die Diktat-Metadaten verletzen das Schema: ${detail}`,
      pfadAusserhalbWurzel: (wurzel: string): string =>
        `Ungültiger Pfad: erwartet wird ein Eintrag unterhalb von "${wurzel}/". Der Eintrag wird abgewiesen.`,
      papierkorbFehler: (detail: string): string =>
        `Das Diktat konnte nicht in den Papierkorb verschoben werden: ${detail}`,
      papierkorbKollision:
        'Das Diktat konnte nicht in den Papierkorb verschoben werden (Namenskollision).',
      wiederherstellenZielBelegt:
        'Am Zielort existiert bereits eine Datei mit diesem Namen. Bitte zuerst den bestehenden Eintrag prüfen.',
      wiederherstellenFehler: (detail: string): string =>
        `Das Diktat konnte nicht wiederhergestellt werden: ${detail}`,
      endgueltigNurPapierkorb: 'Endgültiges Löschen ist nur direkt aus dem Papierkorb erlaubt.',
      endgueltigFehler: (detail: string): string =>
        `Das Diktat konnte nicht endgültig gelöscht werden: ${detail}`,
      eingabeUngueltig: 'Ungültige Eingabe.',
      pfadUngueltig: 'Ungültiger Diktat-Pfad.',
      suchfilterUngueltig: 'Ungültiger Suchfilter.',
      eingabeBearbeitung: 'Ungültige Eingabe für die Bearbeitung.',
      eingabeNotiz: 'Ungültige Eingabe für die Notiz.',
    },

    // storage/manifest.ts
    manifest: {
      fehlt: 'Manifest fehlt.',
      keinJson: 'Manifest ist kein gueltiges JSON.',
      schemaVerletzt: (detail: string): string => `Manifest verletzt das Schema: ${detail}`,
      schreibFehler: (detail: string): string =>
        `Manifest konnte nicht geschrieben werden: ${detail}`,
    },

    // storage/migration.ts
    migration: {
      schrittFehlt: (von: string, nach: string): string =>
        `Für die Migration von Schema-Version ${von} nach ${nach} ist kein Schritt registriert. Der Firmenordner bleibt unverändert.`,
      schrittUeberspringt: (beschreibung: string, von: string, nach: string): string =>
        `Migrationsschritt "${beschreibung}" überspringt Versionen (${von} -> ${nach}). Der Firmenordner bleibt unverändert.`,
      neuereVersion: (ist: string, verstanden: string): string =>
        `Der Firmenordner hat Schema-Version ${ist}, diese VoiceWall-Version versteht nur ${verstanden}. Bitte VoiceWall aktualisieren; der Ordner bleibt unverändert.`,
      abgebrochen: (grund: string): string =>
        `Migration abgebrochen, der Firmenordner ist unverändert. Grund: ${grund}`,
      swapFehlgeschlagen: (backup: string, grund: string): string =>
        `Migration beim Übernehmen fehlgeschlagen; der alte Stand wurde wiederhergestellt (Backup: ${backup}). Grund: ${grund}`,
    },

    // storage/tag-rename.ts
    tagRename: {
      identisch: 'Der neue Tag-Name ist identisch mit dem alten. Bitte einen anderen Namen wählen.',
      metadatenUngueltig: (detail: string): string =>
        `Die Metadaten wären nach der Umbenennung ungültig: ${detail}`,
      schreibFehler: (detail: string): string =>
        `Die Datei konnte nicht geschrieben werden: ${detail}`,
      eingabe: 'Ungültige Eingabe für die Tag-Umbenennung.',
    },

    // storage/vokabular-store.ts + Handler
    woerterbuch: {
      nichtLesbar: 'Die Datei vokabular.json ist nicht lesbar. Bitte Dateirechte prüfen.',
      keinJson:
        'Die Datei vokabular.json ist kein gültiges JSON. Bitte die Datei korrigieren oder das Wörterbuch in VoiceWall neu speichern.',
      schemaVerletzt: (detail: string): string =>
        `Die Datei vokabular.json verletzt das Schema: ${detail}`,
      speichernFehler: (detail: string): string =>
        `Das Wörterbuch konnte nicht gespeichert werden: ${detail}`,
      eingabe: 'Ungültige Eingabe für das Fach-Wörterbuch.',
    },

    // storage/export.ts, storage/batch-export.ts, storage/pdf-export.ts + Handler
    export: {
      ordnerFehler: (detail: string): string =>
        `Der Exporte-Ordner konnte nicht angelegt werden: ${detail}. Bitte die Schreibrechte im Firmenordner prüfen.`,
      schreibFehler: (detail: string): string =>
        `Der Export konnte nicht geschrieben werden: ${detail}. Bitte die Schreibrechte im Firmenordner prüfen.`,
      kollision:
        'Der Export konnte nicht angelegt werden (Dateinamens-Kollision). Bitte erneut versuchen.',
      keineAuswahl: 'Es wurde kein Eintrag für den Export ausgewählt.',
      pdfNichtVerfuegbar: 'PDF-Export ist in dieser Umgebung nicht verfügbar.',
      pdfFehler: (detail: string): string => `Das PDF konnte nicht erzeugt werden: ${detail}`,
      stapelVorbereitungFehler: (detail: string): string =>
        `Der Stapel-Export konnte nicht vorbereitet werden: ${detail}`,
      stapelAlleFehlgeschlagen: (ersteMeldung: string): string =>
        `Keiner der ausgewählten Einträge konnte exportiert werden. Erste Meldung: ${ersteMeldung}`,
      stapelOrdnerKollision: 'Der Stapel-Ordner konnte nicht angelegt werden (Namenskollision).',
      stapelFehler: (detail: string): string => `Der Stapel-Export ist fehlgeschlagen: ${detail}`,
      eingabe: 'Ungültige Eingabe für den Export.',
      eingabeStapel: 'Ungültige Eingabe für den Stapel-Export.',
      exportpfadUngueltig: 'Ungültiger Exportpfad.',
    },

    // storage/encrypted-export.ts + companies.decryptVwencFile + Handler
    vwenc: {
      eingabeVerschluesselt:
        'Ungültige Eingabe für den verschlüsselten Export (Passwort mindestens 12 Zeichen).',
      eingabeEntschluesseln: 'Ungültige Eingabe für das Entschlüsseln.',
      dialogTitel: 'VoiceWall-verschlüsselte Datei entschlüsseln',
      dialogKnopf: 'Entschlüsseln',
      dialogFilter: 'VoiceWall verschlüsselt (.vwenc)',
      keineDatei: 'Es wurde keine Datei ausgewählt.',
      zuGross: 'Die Datei ist zu groß für eine VoiceWall-.vwenc-Datei (Limit 64 MB).',
      nichtLesbar: 'Die ausgewählte Datei ist nicht lesbar.',
      keinContainer:
        'Diese Datei ist keine VoiceWall-verschlüsselte Datei (.vwenc) oder sie ist unvollständig.',
      neuereVersion:
        'Diese .vwenc-Datei wurde mit einer neueren VoiceWall-Version erstellt. Bitte VoiceWall aktualisieren.',
      fehlgeschlagen:
        'Die Entschlüsselung ist fehlgeschlagen: das Passwort ist falsch oder die Datei wurde verändert. Hinweis: bei Passwortverlust ist der Inhalt unwiederbringlich verloren.',
      schreibFehler: (detail: string): string =>
        `Die entschlüsselte Datei konnte nicht geschrieben werden: ${detail}`,
      namenskollision: 'Die entschlüsselte Datei konnte nicht angelegt werden (Namenskollision).',
    },

    // storage/pdf-template.ts (PDF folgt der UI-Sprache zum Exportzeitpunkt)
    pdf: {
      quelle: {
        diktat: 'Diktat',
        import: 'Import',
        manuell: 'Notiz',
      },
      dokumentart: 'Diktat-Export · 100 % lokal erstellt',
      zeileErstellt: 'Erstellt',
      zeileGeaendert: 'Geändert',
      zeileQuelle: 'Quelle',
      zeileModell: 'Modell',
      zeileWortzahl: 'Wortzahl',
      zeileTags: 'Tags',
      volltext: 'Volltext',
      datumMitZeit: (datum: string, zeit: string): string => `${datum}, ${zeit} Uhr`,
      fussErstelltMit: 'Erstellt mit VoiceWall, 100 % lokal',
      fussSeite: 'Seite',
      fussVon: 'von',
    },

    // tray/tray.ts (Tooltip "VoiceWall" ist ein Eigenname und bleibt im Code)
    tray: {
      diktatStarten: 'Diktat starten',
      diktatStoppen: 'Diktat stoppen',
      fensterOeffnen: 'VoiceWall öffnen',
      beenden: 'VoiceWall beenden',
      tooltipAufnahme: 'VoiceWall: Aufnahme läuft',
    },

    // ipc/handlers.ts
    handlers: {
      browserFehler: (detail: string, url: string): string =>
        `Der Browser konnte nicht geöffnet werden (${detail}). Die Quelle ist ${url}; alle Angaben stehen auch direkt hier in der App.`,
    },
  },
};
