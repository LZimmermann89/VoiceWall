/**
 * English UI catalog (package B2). Typed as `Uebersetzung = typeof de`:
 * a missing key is a compile error (completeness proof), backed by the
 * runtime key test in tests/unit/i18n.test.ts.
 *
 * Terminology follows the glossary in de.ts (records, evidence, trash,
 * management, audit steps, company folder, specialist dictionary, ...).
 * Legal notices (provider identification) intentionally remain German;
 * the evidence view carries a short English explanatory line instead.
 */
import type { Uebersetzung } from './index';

export const en: Uebersetzung = {
  app: {
    kontextEinrichtung: 'Setup record',
    kontextNeueFirma: 'Set up a new company',
    kontextVerwaltung: 'Management',
    lokalBadge: '100 % local',
    lokalBadgeTitel: 'All processing happens on this computer.',
    wirdGeladen: 'Loading ...',
    fussModellPruefsumme: 'Model checksum',
    fussNullVerbindungen: '0 external connections during operation',
    fussHardware: (platformArch: string, kerne: number, ramGb: number): string =>
      `${platformArch} · ${String(kerne)} cores · ${String(ramGb)} GB RAM`,
    sprachumschalterLabel: 'Sprache / Language',
    sprachumschalterDeutsch: 'Deutsch',
    sprachumschalterEnglisch: 'English',
  },

  wizard: {
    schrittNamen: {
      sprachwahl: 'Sprache / Language',
      willkommen: 'Welcome',
      firma: 'Company details',
      speicherort: 'Storage location',
      sprache: 'Language',
      modell: 'Model',
      hotkey: 'Keyboard shortcut',
      bedienungshilfen: 'Accessibility',
      zusammenfassung: 'Summary',
    },
    railTitel: 'Audit steps',
    railAria: 'Setup steps',
    schrittAbgeschlossen: 'completed',
    kickerAbgeschlossen: 'Setup completed',
    kickerSchritt: (nummer: string, gesamt: string): string => `Step ${nummer} of ${gesamt}`,

    sprachwahl: {
      titel: 'Sprache / Language',
      lede: 'Bitte wählen Sie die Sprache der Oberfläche. / Please choose the language of the interface.',
      aria: 'Sprache / Language',
      deutschTitel: 'Deutsch',
      deutschBeschreibung: 'Die Oberfläche von VoiceWall erscheint auf Deutsch.',
      englischTitel: 'English',
      englischBeschreibung: 'The VoiceWall interface appears in English.',
      hinweis:
        'Your choice takes effect immediately and can be changed at any time in the management view. It is independent of the dictation language of your companies.',
    },

    willkommen: {
      titel: 'Welcome to VoiceWall',
      lede: 'VoiceWall turns your speech into text: press the keyboard shortcut, speak, press the shortcut again, and the text appears in the active application. All processing happens on this computer.',
      zeileVerarbeitung: 'Processing',
      zeileVerarbeitungWert: '100 % local on this computer',
      zeileCloud: 'Cloud/server',
      zeileCloudWert: 'none, no data is ever sent',
      zeileAudio: 'Audio recording',
      zeileAudioWert: 'in memory only, never written to a file',
      aiActTitel: 'Transparency notice (EU AI Act):',
      aiActText:
        ' Speech is converted into text by an AI model (Whisper, optimised for German). As with any automatic recognition, errors are possible, especially with names and technical terms. Please review the result before using it.',
      einwilligung:
        'I consent to VoiceWall using the microphone of this computer for local speech-to-text conversion. No audio data is stored or transmitted to any server. This consent is documented locally with a timestamp and can be revoked at any time (withdraw microphone access in the system settings).',
    },

    firma: {
      titel: 'Company details',
      lede: 'These details describe the data space of the company. They remain on this computer and are stored in the company configuration inside the company folder.',
      nameLabel: 'Company name',
      namePlatzhalter: 'e.g. Miller & Sons Ltd',
      nameHinweis:
        '1 to 120 characters, real umlauts allowed. The display name is preserved unchanged.',
      ordnernameLabel: 'Folder name (derived, adjustable)',
      ordnerVorschau: (ordnername: string): string => `Folder: ${ordnername}`,
      ansprechpartnerLabel: 'Contact person (optional)',
      emailLabel: 'Email (optional, local display only)',
      emailFehler:
        'Please enter a valid email address (e.g. name@company.com) or leave the field empty.',
      standortLabel: 'Location/department (optional)',
      hinweisLabel: 'Internal note (optional)',
    },

    speicherort: {
      titel: 'Storage location for dictations',
      lede: 'The company folder is the database: plain files, copyable at any time. Before creating it, VoiceWall checks whether the desktop is synchronised by a cloud service.',
      pruefeSpeicherort: 'Checking storage location ...',
      syncErkannt: 'Cloud synchronisation detected.',
      syncOk:
        'No cloud synchronisation of the desktop detected. The desktop is a suitable storage location.',
      frage: 'Where should the dictations be stored?',
      aria: 'Storage location',
      lokalTitel: 'Local folder with a desktop shortcut',
      badgeEmpfohlen: 'recommended',
      lokalBeschreibung:
        'Dictations are stored under ~/VoiceWall (never synchronised); a shortcut appears on the desktop. This safeguards the "100 percent local" promise.',
      desktopTitel: 'Directly on the desktop',
      badgeStandard: 'default',
      desktopBeschreibung: 'The company folder is placed directly on the desktop.',
      desktopSyncWarnung: ' Caution: it would then be synchronised to the cloud.',
    },

    sprache: {
      titel: 'Dictation language',
      lede: 'VoiceWall is primarily optimised for German dictation. The language applies per company and is passed to the speech recognition as a fixed setting, without automatic language detection. This saves time and prevents language-switching errors.',
      aria: 'Dictation language',
      deutschTitel: 'German (de)',
      deutschBeschreibung:
        'Uses the German fine-tuned Whisper model (the core of this edition): best German recognition, the default for new companies.',
      englischTitel: 'English (en)',
      englischBeschreibung:
        'Uses the original multilingual Whisper model (large-v3-turbo). Honest note: VoiceWall is primarily optimised for German; English requires an additional one-time model download of about 574 MB.',
      hinweis:
        'The dictation language is independent of the interface language and can be changed later per company in the management view.',
    },

    modell: {
      titel: 'Recognition model',
      aria: 'Recognition model',
      ledeEnglisch:
        'For the dictation language English, VoiceWall uses the original multilingual Whisper model (large-v3-turbo, Q5_0). The download happens once; after that, VoiceWall works 100 % offline.',
      ledeDeutschVor: (hardware: string): string =>
        `Recommendation for this computer (${hardware}): `,
      ledeDeutschNach: '. The download happens once; after that, VoiceWall works 100 % offline.',
      hardwareKurz: (kerne: number, ramGb: number): string =>
        `${String(kerne)} cores, ${String(ramGb)} GB RAM`,
      hardwareUnbekannt: 'being determined',
      multilingualTitel: 'English / multilingual (large-v3-turbo, Q5_0)',
      badgeFuerEnglisch: 'for English',
      multilingualBeschreibung: (groesse: string): string =>
        `Original model from OpenAI/whisper.cpp, not optimised for German. ${groesse}.`,
      q5Titel: 'Q5_0',
      badgeEmpfohlen: 'recommended',
      q5Beschreibung: (groesse: string): string =>
        `Best balance of German accuracy and speed; runs on ordinary office hardware. ${groesse}.`,
      fp16Titel: 'Maximum accuracy (fp16)',
      fp16Beschreibung: (groesse: string): string =>
        `For powerful computers; higher accuracy at longer processing time. ${groesse}.`,
      fp16Gesperrt:
        'Not recommended for this computer (requires at least 16 GB RAM and 6 cores); selection disabled.',
      statusVorhanden: 'present and verified',
      statusFehlt: (groesse: string): string => `not yet downloaded · ${groesse}`,
      vadHinweis: (groesse: string, vorhanden: boolean): string =>
        `In addition, the small voice activity detection model (VAD, ${groesse}) is loaded: ${vorhanden ? 'present.' : 'not yet downloaded.'}`,
      vadGroesseUnbekannt: 'under 1 MB',
      downloadAria: (label: string): string => `Download ${label}`,
      progressZeile: (
        label: string,
        empfangen: string,
        gesamt: string | null,
        prozent: string | null,
      ): string =>
        `${label}: ${empfangen}${gesamt !== null ? ` of ${gesamt}` : ''}${prozent !== null ? ` (${prozent} %)` : ''}`,
      bereit:
        'All required model files are present and verified against the hard-coded checksums. No download is needed.',
      ladeKnopf: 'Download model now (one time)',
      laedt: 'Downloading ...',
      downloadHinweisEnglisch:
        'Note: the model download is the only moment VoiceWall uses the internet (huggingface.co, with checksum verification).',
      downloadHinweisDeutsch:
        'Note: the model download is the only moment VoiceWall uses the internet (huggingface.co, with checksum verification). A particularly small Q4 fallback variant for very weak computers is planned for a later version.',
    },

    hotkey: {
      titel: 'Keyboard shortcut for dictation',
      lede: 'One press starts the recording, a second press ends it and inserts the text into the active application. The shortcut works system-wide.',
      label: 'Key combination',
      anzeigeVor: 'Displayed as: ',
      anzeigeNach: ' · Electron notation, e.g. CommandOrControl+Shift+D.',
      aufnehmen: 'Capture combination',
      aufnehmenAktiv: 'Press the key combination now (Esc cancels)',
      testen: 'Test live',
      testOk: 'This key combination is available and works.',
    },

    bedienungshilfen: {
      titel: 'macOS permission: Accessibility',
      lede: 'For automatic insertion, VoiceWall simulates exactly one keystroke (Cmd+V). macOS requires the "Accessibility" permission for this. VoiceWall does not log your keyboard, does not read windows of other programs and does not control anything else (the complete, auditable justification is included in docs/ACCESSIBILITY.md).',
      statusZeile: 'Permission status',
      statusErteilt: 'granted',
      statusFehlt: 'not yet granted',
      hinweisAbsatz1:
        'Without the permission, everything works except automatic insertion: the text then remains in the clipboard and is inserted with Cmd+V. You can also grant the permission at any later time.',
      hinweisAbsatz2:
        'How to proceed: press the button, then enable VoiceWall in the list (add it via the plus symbol if needed), then choose "Refresh status" here.',
      hinweisAbsatz3:
        'Important: macOS often reports a freshly granted permission to an already running program only after the program restarts. If the status here remains "not yet granted", simply finish the setup normally and restart VoiceWall once afterwards (the button for this is available in the Dictation area).',
      freigabeAnfordern: 'Request permission (macOS dialog)',
      systemeinstellungen: 'Open system settings',
      statusAktualisieren: 'Refresh status',
    },

    zusammenfassung: {
      titel: 'Summary',
      lede: 'Please review the details. Only with "Set up" does VoiceWall create the company folder and save the configuration.',
      zeileFirma: 'Company',
      zeileZielordner: 'Target folder',
      zielDesktop: (ordnername: string): string => `Desktop/${ordnername}`,
      zielLokal: (ordnername: string): string =>
        `~/VoiceWall/${ordnername} (the desktop shows a shortcut)`,
      zeileAnsprechpartner: 'Contact person',
      zeileEmail: 'Email',
      zeileStandort: 'Location',
      zeileSprache: 'Language',
      spracheDeutsch: 'German (de)',
      spracheEnglisch: 'English (en)',
      zeileModell: 'Model',
      modellMehrsprachig: 'Multilingual (large-v3-turbo, Q5_0)',
      modellFp16: 'fp16 (maximum accuracy)',
      modellQ5: 'Q5_0 (recommended)',
      zeileHotkey: 'Keyboard shortcut',
      zeileEinwilligung: 'Microphone consent',
      einwilligungWird: 'will be granted during setup',
      einwilligungFehlt: 'missing',
      fehlerMitVorschlag: (meldung: string, vorschlag: string): string =>
        `${meldung} Suggestion: ${vorschlag}`,
    },

    navigation: {
      abbrechen: 'Cancel',
      beenden: 'Quit setup',
      zurueck: 'Back',
      weiter: 'Next',
      einrichten: 'Set up',
      richteEin: 'Setting up ...',
    },

    erfolg: {
      titel: 'Setup completed',
      siegel: (ordnername: string, uebernommen: boolean): string =>
        `✓ Company "${ordnername}" ${uebernommen ? 'adopted' : 'created'}`,
      anleitungTitel: 'How to dictate',
      schritt1Vor: 'Place the cursor in a text field (Word, Outlook, browser), then press ',
      schritt1Nach: '.',
      schritt2: 'Speak. A small window shows "I am listening".',
      schritt3Vor: 'Press ',
      schritt3Nach:
        ' again: the text appears at the cursor position (and is also placed in the clipboard).',
      selbsttestTitel: 'Verify yourself: VoiceWall sends no data (network self-test)',
      selbsttestIntro:
        'You do not have to take the "100 percent local" promise on trust, you can verify it yourself (in detail in the included guide docs/NETZWERK-SELBSTTEST.md):',
      selbsttestPunkt1Titel: 'Network view of the app:',
      selbsttestPunkt1:
        ' Open the developer tools (Cmd+Alt+I or F12), switch to the Network tab, then dictate. Not a single entry to an external address appears.',
      selbsttestPunkt2Titel: 'Connection monitor of the operating system:',
      selbsttestPunkt2:
        ' macOS: LuLu/Little Snitch or lsof; Windows: Resource Monitor, Network tab. VoiceWall establishes no connection during operation.',
      selbsttestPunkt3Titel: 'The network cable:',
      selbsttestPunkt3:
        ' Disconnect the internet (Wi-Fi off, unplug the cable) and dictate as usual. VoiceWall works completely offline.',
      selbsttestAusnahme:
        'The only exception: the one-time, checksum-verified model download during setup.',
      zurVerwaltung: 'Go to management',
    },
  },

  verwaltung: {
    firmaWaehlenAria: 'Choose company',
    firmaLabel: 'Company',
    keineFirma: 'No company created yet.',
    diktatspracheLabel: 'Dictation language',
    diktatspracheDeutsch: 'German',
    diktatspracheEnglisch: 'English',
    diktatspracheUmgestelltEn:
      'Dictation language switched to English (original multilingual model). If the model is still missing, a one-time download of about 574 MB starts with the next dictation or via "Download models and start engine".',
    diktatspracheUmgestelltDe: 'Dictation language switched to German (German-optimised model).',
    autoSpeichern: 'Save dictations automatically',
    neueFirma: 'Set up a new company',
    navAria: 'Management areas',
    tabDiktat: 'Dictation',
    tabRegister: 'Records',
    tabPapierkorb: 'Trash',
    tabBeleg: 'Evidence',
  },

  diktat: {
    titel: 'Dictation',
    lede: 'The operational area: system-wide dictation via keyboard shortcut, the latest result with a copy button, and a test recording as proof of function for the on-site appointment.',
    abschnittDiktatAria: 'System-wide dictation',
    abschnittDiktat: 'System-wide dictation',
    hotkeyZeile: 'Keyboard shortcut (toggle):',
    hotkeyUnbekannt: 'unknown',
    hotkeyKonflikt: '(not active: this combination is already taken, please choose another one)',
    zustandZeile: 'State:',
    neueKombination: 'New key combination:',
    hotkeyPlatzhalter: 'e.g. CommandOrControl+Shift+D',
    hotkeyUebernehmen: 'Apply hotkey',
    clipboardWiederherstellen:
      'Restore the clipboard after inserting (data protection, recommended)',
    accessibilityHinweis:
      'For automatic insertion, VoiceWall needs the macOS "Accessibility" permission. Without it, the text remains in the clipboard (Cmd+V to insert). How to proceed: press the button, then enable VoiceWall in the list and run the dictation again. What VoiceWall does and does not do with this permission is documented in docs/ACCESSIBILITY.md. Two pitfalls: 1. After an update, an OLD VoiceWall entry in the list may show the switch as enabled, but it only applies to the old program version: remove the old entry with the minus symbol, then re-register via "Request permission". 2. macOS often reports a freshly granted permission to the running program only after a restart; use the restart button for that.',
    freigabeAnfordern: 'Request permission (macOS dialog)',
    systemeinstellungen: 'Open system settings',
    neuStarten: 'Restart VoiceWall',
    letztesDiktat: 'Latest dictation',
    keinDiktat:
      'No dictation yet. The text of the latest dictation remains available here and is never lost, even if automatic insertion fails.',
    kopieren: 'Copy',
    kopiertHinweis: 'Text has been copied to the clipboard (Cmd/Ctrl+V to insert).',
    alsDiktatSpeichern: 'Save as dictation',
    gespeichertHinweis: (pfad: string): string => `Dictation saved: ${pfad}`,

    abschnittStatus: 'Status',
    statusEinwilligung: 'Consent:',
    einwilligungErteilt: 'granted',
    einwilligungAusstehend: 'pending',
    statusMikrofon: 'Microphone (OS):',
    mikrofonUnbekannt: 'unknown',
    statusDiktatsprache: 'Dictation language (active company):',
    spracheDeutsch: 'German (de)',
    spracheEnglisch: 'English (en)',
    statusModelle: 'Models:',
    modelleVorhanden: 'present and verified',
    modelleUnvollstaendig: 'incomplete',
    statusEngine: 'Engine:',
    engineBereit: 'ready',
    engineNichtGestartet: 'not started',
    modellVorhanden: 'present',
    modellFehlt: (groesse: string): string => `missing (${groesse})`,
    downloadAria: 'Model download',
    progressZeile: (
      label: string,
      empfangen: string,
      gesamt: string | null,
      prozent: string | null,
    ): string =>
      `${label}: ${empfangen}${gesamt !== null ? ` of ${gesamt}` : ''}${prozent !== null ? ` (${prozent} %)` : ''}`,

    abschnittFunktionsbeleg: 'Proof of function (test recording)',
    abschnittFunktionsbelegAria: 'Proof of function',
    einwilligungErteilen: 'Grant microphone consent',
    modelleLaden: 'Download models and start engine',
    testaufnahmeStarten: 'Start test recording',
    testaufnahmeStoppen: 'Stop test recording',
    lokalHinweis:
      'Your speech is processed exclusively on this computer. No audio data is stored or sent to any server.',
    keinTranskript: 'No transcript yet.',
    transkriptMeta: (durationMs: number, audioSekunden: string): string =>
      `${String(durationMs)} ms for ${audioSekunden} s of audio`,

    abschnittWoerterbuch: 'Dictionary and text processing',
    woerterbuchHinweis:
      'Everything here is pure, local rule-based processing: no language model, no external call. Every rule is deterministic and traceable.',
    fuellwoerterLabel:
      'Remove filler words: standalone "uh", "um", "erm", "hm" and direct word doublings ("the the"). Conservative; rare legitimate doublings may be affected.',
    sprachkommandosLabel:
      'Apply voice commands: "period", "comma", "question mark", "exclamation mark", "colon", "new line", "new paragraph". Off by default because the rule may also affect the ordinary use of the word "period".',
    fachwoerterbuchTitel: 'Specialist dictionary of the active company',
    fachwoerterbuchKeineFirma:
      'No company created yet. The specialist dictionary belongs to the company and is stored auditable in its folder (.voicewall/vokabular.json).',
    fachwoerterbuchHinweis:
      'Terms (proper names, technical terms, file numbers) improve recognition: they are passed to the speech recognition locally as context. Replacements correct frequent mistranscriptions deterministically, only as whole words and exactly in the entered capitalisation.',
    entfernen: 'Remove',
    neuerBegriff: 'New term:',
    begriffPlatzhalter: 'e.g. VoiceWall',
    hinzufuegen: 'Add',
    ersetzungVon: 'Replace from:',
    ersetzungVonPlatzhalter: 'e.g. Voice Wall',
    ersetzungZu: 'to:',
    ersetzungZuPlatzhalter: 'e.g. VoiceWall',
    woerterbuchSpeichern: 'Save dictionary',
    woerterbuchGespeichert: 'Dictionary saved (atomically, in the company folder).',
    fehlerTitel: 'Error',
    fehlerAria: 'Error',
  },

  register: {
    titel: 'Records',
    lede: 'The file registry of this company: all dictations and notes, searchable and filterable. One click opens the full text.',
    schnellsuche: 'Quick search:',
    suchePlatzhalter: 'Title, tag or text preview',
    sortierung: 'Sort order:',
    sortDatum: 'Date (newest first)',
    sortTitel: 'Title (A to Z)',
    sortWortzahl: 'Word count (descending)',
    neueNotiz: 'New note',
    tagsVerwalten: 'Manage tags',
    volltextToggle: 'Also search the full text (searches the complete texts, somewhat slower)',
    zeitraumVon: 'Period from',
    zeitraumBis: 'to',
    quelleLabel: 'Source',
    quelleAlle: 'all',
    filterZuruecksetzen: 'Reset filters',
    tagFilterAria: 'Filter by tags',
    tagFilterLabel: 'Tags:',
    wirdGeladen: 'Loading ...',
    ausgewaehlt: (anzahl: number): string => `${String(anzahl)} selected`,
    exportformat: 'Export format:',
    formatMdMitKopf: 'Markdown (with header)',
    formatMdOhneKopf: 'Markdown (without header)',
    formatTxt: 'TXT',
    formatPdf: 'PDF',
    auswahlExportieren: (anzahl: number): string => `Export selection (${String(anzahl)})`,
    gefilterteExportieren: (anzahl: number): string => `Export all filtered (${String(anzahl)})`,
    auswahlAufheben: 'Clear selection',
    exportFortschritt: (fertig: number, gesamt: number): string =>
      `Exporting ${String(fertig)} of ${String(gesamt)} entries ...`,
    exportErgebnis: (anzahl: number, anzeigePfad: string, fehler: number): string =>
      `${String(anzahl)} ${anzahl === 1 ? 'entry' : 'entries'} exported to: ${anzeigePfad}.${fehler > 0 ? ` ${String(fehler)} entries could not be exported.` : ''}`,
    imFinderZeigen: 'Show in Finder',
    auswahlAria: (titel: string): string => `Select "${titel}" for the batch export`,
    wortzahl: (anzahl: number): string => `${String(anzahl)} words`,
    volltextTreffer: (snippet: string): string => `Full-text match: ${snippet}`,
    leerMitFilter: 'No entries match the current filters. Please adjust the search or filters.',
    leerTitel: 'No dictations in this company yet.',
    leerLede: 'How the first entry is created:',
    leerSchritt1: 'Place the cursor in a text field and press the keyboard shortcut.',
    leerSchritt2: 'Speak. A small window shows "I am listening".',
    leerSchritt3: 'Press the keyboard shortcut again: the text appears and is filed here.',
    leerAlternative: 'Alternatively, use "New note" above to create an entry without dictating.',

    detail: {
      zurueck: '← Back to records',
      bearbeitenTitel: 'Edit entry',
      zeileErstellt: 'Created',
      zeileGeaendert: 'Modified',
      zeileQuelle: 'Source',
      zeileModell: 'Model',
      zeileDauer: 'Duration',
      dauerSekunden: (sekunden: number): string => `${String(sekunden)} s`,
      zeileWortzahl: 'Word count',
      zeileZielApp: 'Target app',
      zeileVersion: 'Version',
      zeileTags: 'Tags',
      keinWert: '—',
      volltextTitel: 'Full text',
      bearbeiten: 'Edit',
      exportMd: 'Export Markdown (with header)',
      exportMdOhne: 'Export Markdown (without header)',
      exportTxt: 'Export TXT',
      exportPdf: 'Export PDF',
      exportVerschluesselt: 'Export encrypted (.vwenc)',
      inDenPapierkorb: 'Move to trash',
      exportiertNach: (anzeigePfad: string): string => `Exported to: ${anzeigePfad}`,
      verschluesseltExportiert: (anzeigePfad: string): string =>
        `Exported encrypted to: ${anzeigePfad}. Without the password the file cannot be read.`,
      gespeichert: 'Changes saved.',
      titelLabel: 'Title',
      textLabel: 'Text',
      tagsLabel: 'Tags',
      tagEntfernenAria: (tag: string): string => `Remove tag ${tag}`,
      tagPlatzhalter: 'Add tag, Enter',
      speichern: 'Save',
      speichert: 'Saving ...',
      abbrechen: 'Cancel',
      loeschenTitel: 'Move to trash?',
      loeschenText:
        'The entry will be moved to the trash. From there it can be restored or deleted permanently.',
      loeschenBestaetigen: 'Move to trash',
      verschluesselnTitel: 'Export encrypted (.vwenc)',
      verschluesselnBeschreibung:
        'The entry is encrypted as Markdown with AES-256-GCM and placed in the Exporte/ folder. Decryption is available in the evidence view under "Decrypt file".',
      verschluesselnWarnung:
        'Important: the password is not stored anywhere. If it is lost, the content of the file is irrecoverably lost.',
      verschluesselnBestaetigen: 'Export encrypted',
    },

    tagRename: {
      titel: 'Manage tags',
      hinweis:
        'A tag is renamed company-wide: across all dictations and notes, including the trash.',
      bestehenderTag: 'Existing tag',
      neuerName: 'New name',
      ergebnis: (alt: string, neu: string, gesamt: number, papierkorb: number): string =>
        `Tag "${alt}" was renamed to "${neu}": ${String(gesamt)} ${gesamt === 1 ? 'entry' : 'entries'} updated${papierkorb > 0 ? ` (of which ${String(papierkorb)} in the trash)` : ''}.`,
      umbenennen: 'Rename',
      benenntUm: 'Renaming ...',
      schliessen: 'Close',
    },

    notiz: {
      titel: 'New note',
      titelLabel: 'Title',
      textLabel: 'Text',
      anlegen: 'Create note',
      speichert: 'Saving ...',
      abbrechen: 'Cancel',
    },
  },

  papierkorb: {
    titel: 'Trash',
    lede: 'Deleted dictations remain here until they are restored or deleted permanently. This makes accidentally deleting a client dictation reversible.',
    wirdGeladen: 'Loading ...',
    leer: 'The trash is empty.',
    wortzahl: (anzahl: number): string => `${String(anzahl)} words`,
    wiederherstellen: 'Restore',
    endgueltigLoeschen: 'Delete permanently',
    bestaetigungTitel: 'Delete permanently?',
    bestaetigungText: (titel: string): string =>
      `The entry "${titel}" will be deleted irrevocably. This action cannot be undone.`,
  },

  beleg: {
    titel: 'Evidence',
    lede: 'VoiceWall works entirely on this computer. This area proves that with verifiable facts instead of mere claims.',
    stempelTitel: 'Zero external connections during operation',
    stempelText: (dokument: string): string =>
      `After the one-time model download, VoiceWall establishes no further network connections. The content security policy of the interface forbids every external connection. You can verify this yourself (see below, in detail in ${dokument}).`,
    wirdGeladen: 'Loading ...',
    eckdatenTitel: 'Key facts',
    zeileAppVersion: 'App version',
    zeilePlattform: 'Platform',
    zeileEinwilligung: 'Microphone consent',
    einwilligungErteiltAm: (zeitpunkt: string): string => `granted on ${zeitpunkt}`,
    einwilligungFehlt: 'not yet granted',
    zeileModellordner: 'Model folder',
    zeileBetriebslog: 'Operation log',
    modelleTitel: 'Models (version and checksum)',
    badgeAktiv: 'active',
    modellVorhanden: 'present and verified',
    modellFehlt: 'not downloaded',
    selbsttestTitel: 'Network self-test',
    selbsttestIntro:
      'Verify the "100 percent local" promise yourself. Three independent probes, from the built-in network view to the unplugged network cable:',
    selbsttestErgebnis: 'Expected result:',
    selbsttestProben: [
      {
        titel: 'Probe 1: network view of the app (developer tools)',
        schritte: [
          'Open the developer tools (Mac: Cmd+Alt+I, Windows: F12 or Ctrl+Shift+I).',
          'Switch to the Network tab and select the filter All.',
          'Now dictate as many texts as you like, via hotkey or test recording.',
        ],
        ergebnis:
          'Not a single entry to an external address appears in the list. The built-in security policy (content security policy) forbids every connection to foreign addresses, even if malicious code tried.',
      },
      {
        titel: 'Probe 2: connection monitor of the operating system',
        schritte: [
          'Mac: watch a firewall tool such as LuLu or Little Snitch, or run lsof -i -a -p <VoiceWall-PID> in the terminal.',
          'Windows: open the Resource Monitor (resmon), Network tab.',
          'Dictate and watch the outgoing connections.',
        ],
        ergebnis:
          'VoiceWall does not appear there. The only exception is the one-time, checksum-verified model download during setup.',
      },
      {
        titel: 'Probe 3: the hardest probe, the network cable',
        schritte: [
          'Make sure the one-time setup (model download) is complete.',
          'Disconnect the internet completely (Wi-Fi off, unplug the cable, flight mode).',
          'Dictate as usual: press the hotkey, speak, press the hotkey.',
        ],
        ergebnis:
          'VoiceWall works completely and without any restriction offline. Recording, recognition and insertion run entirely on your computer. There is no cloud that could be missing.',
      },
    ],
    selbsttestDokument: 'docs/NETZWERK-SELBSTTEST.md',
    backupTitel: 'Backup and encryption',
    backupWarnung:
      'Important: your dictations are stored as plain-text Markdown in the company folder. A copy onto an unencrypted USB stick or an unencrypted network drive is therefore an unencrypted plain-text backup. Dictations can contain highly sensitive content, such as health data or other special categories of personal data within the meaning of Art. 9 GDPR. Therefore use encrypted backup media only.',
    backupHinweise: [
      {
        titel: 'How to back up your dictations (backup)',
        absaetze: [
          'The company folder is the entire database. For a complete backup, simply copy the whole company folder (e.g. "Müller & Söhne GmbH" on the desktop or under ~/VoiceWall) onto your backup medium. There is no hidden database, no registry entries and no passwords that would need to be backed up in addition.',
          'Restoring: place the backed-up folder back at the desktop location, start VoiceWall and the company appears (if necessary, adopt it via "Set up a new company" with the same name). The dictations are plain Markdown and remain readable entirely without VoiceWall.',
        ],
      },
      {
        titel: 'Encrypt the backup medium (strongly recommended)',
        absaetze: [
          'macOS: enable FileVault for the internal disk under System Settings → Privacy & Security → FileVault → "Turn On FileVault". External drives and USB sticks: right-click the drive in the Finder and choose "Encrypt ...", or format the drive as "APFS (encrypted)" in Disk Utility.',
          'Windows: enable BitLocker under Settings → Privacy & Security → Device encryption (or Control Panel → BitLocker Drive Encryption). For USB sticks and external drives use BitLocker To Go: right-click the drive in Explorer → "Turn on BitLocker".',
          'Keep the recovery key of the operating system separate from the backup medium (e.g. printed out in the folder with the company documents).',
        ],
      },
      {
        titel: 'Encrypted single export (.vwenc)',
        absaetze: [
          'For passing on individual dictations (e.g. via USB stick to the tax advisor), VoiceWall offers "Export encrypted" in the detail view: the Markdown file is encrypted locally with AES-256-GCM and placed as a .vwenc file in the Exporte/ folder. Decryption happens exclusively here in the app under "Decrypt file".',
          'The password (at least 12 characters) is not stored anywhere. If the password is lost, the content of the .vwenc file is irrecoverably lost; there is no backdoor and no recovery.',
        ],
      },
    ],
    backupDokumentHinweis: (dokument: string): string =>
      `These notes are included in detail in ${dokument} (part of the evidence sheet).`,
    backupDokument: 'docs/BACKUP-HINWEISE.md',
    entschluesseln: 'Decrypt file (.vwenc)',
    entschluesseltNach: (zielPfad: string): string => `Decrypted to: ${zielPfad}`,
    entschluesselnTitel: 'Decrypt file (.vwenc)',
    entschluesselnBeschreibung:
      'After entering the password, the file picker opens. The decrypted file is placed next to the .vwenc file; nothing is overwritten.',
    entschluesselnBestaetigen: 'Choose file and decrypt',
    impressumTitel: 'About VoiceWall (provider identification)',
    impressumSprachHinweis: 'Legal notices are provided in German as required by German law.',
    impressumQuelle: (url: string): string => `Open source in the browser (${url})`,
  },

  passwortDialog: {
    passwortLabel: 'Password',
    passwortMindestlaenge: (minLength: number): string =>
      `(at least ${String(minLength)} characters)`,
    wiederholenLabel: 'Repeat password',
    fehlerZuKurz: (minLength: number): string =>
      `The password must be at least ${String(minLength)} characters long.`,
    fehlerLeer: 'Please enter the password.',
    fehlerUngleich: 'The two passwords do not match.',
    bitteWarten: 'Please wait ...',
    abbrechen: 'Cancel',
  },

  format: {
    quelle: {
      diktat: 'Dictation',
      import: 'Import',
      manuell: 'Note',
    },
    flowState: {
      idle: 'ready',
      recording: 'recording',
      transcribing: 'transcribing',
      delivering: 'inserting text',
    },
  },

  overlay: {
    recording: 'I am listening ...',
    transcribing: 'Transcribing ...',
    done: 'Text inserted.',
    noSpeech: 'No speech detected.',
    error: 'Insertion failed.',
    kopieren: 'Copy',
  },
};
