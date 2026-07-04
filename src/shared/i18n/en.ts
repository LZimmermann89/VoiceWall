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

  /**
   * User-visible texts of the MAIN process (package B3, decision E41):
   * Result error messages, tray, overlay delivery messages, PDF template
   * and model display names. Logs intentionally remain German (E41).
   */
  main: {
    generisch: {
      internerFehler: 'Unexpected internal error. Details are in the local log under userData.',
      statusFehler: 'Internal error while fetching the status. Details are in the local log.',
      unbekannt: 'unknown',
      unbekannterFehler: 'unknown error',
    },

    stt: {
      ungueltigeDiktatsprache: 'Invalid dictation language.',
      keinPcmPuffer: 'Not a valid PCM buffer.',
      einwilligungZuerst: 'Please grant the microphone consent first.',
      sprachwechselEnglisch:
        'Language switch: the speech recognition is restarting with the multilingual model (English) ...',
      sprachwechselDeutsch:
        'Language switch: the speech recognition is restarting with the German model ...',
      modelleFehlenEnglisch:
        'The multilingual recognition model for English is missing. Please start the one-time model download (button "Download models and start engine" or the setup assistant, about 574 MB).',
      modelleFehlenDeutsch:
        'The models are missing. Please run the one-time model download in the setup assistant first.',
      engineNichtVerfuegbar: 'Engine not available.',
      mikrofonZugriffFehler: (detail: string): string =>
        `Microphone access failed (${detail}). Please check that a microphone is connected and that VoiceWall has access.`,
    },

    engine: {
      beendetVorErgebnis: 'The engine was terminated before a result was available.',
      mehrfachAbgestuerzt:
        'The speech recognition crashed repeatedly and could not be restarted. Please restart VoiceWall; if the error persists, check the log under userData.',
      nochNichtBereit: 'The speech recognition is not ready yet.',
      nichtBereit: 'Engine not ready.',
      ungueltigeNachricht: (detail: string): string => `Invalid worker message: ${detail}`,
    },

    flow: {
      overlayTextEingefuegt: 'Text inserted (and in the clipboard).',
      overlayTextInZwischenablage: 'The text is in the clipboard.',
      hotkeyBelegt: (accelerator: string): string =>
        `The key combination ${accelerator} is already taken by another app or by the system. Please choose a different combination in the VoiceWall window under "System-wide dictation", e.g. CommandOrControl+Alt+D.`,
      hotkeyWechselBelegt: (neu: string, bisher: string): string =>
        `The key combination ${neu} is already taken system-wide. The previous hotkey ${bisher} remains active. Please try a different combination.`,
      hotkeyTestBelegt: (accelerator: string): string =>
        `The key combination ${accelerator} is already taken by another app or by the system. Please choose a different combination.`,
      ungueltigeTastenkombination:
        'Invalid key combination. Please specify at least one modifier key (e.g. CommandOrControl, Alt, Shift) and exactly one key, such as "CommandOrControl+Shift+D".',
      eingabeTastenkombination: 'Invalid input for the key combination.',
      eingabeZwischenablage: 'Invalid input for the clipboard switch.',
      eingabeAufbereitung: 'Invalid input for the text processing switches.',
      eingabeUiSprache: 'Invalid input for the interface language.',
      ungueltigeModellwahl: 'Invalid model choice.',
      keinDiktatVorhanden:
        'There is no dictation yet. Please dictate first via hotkey or test recording.',
      firmenverwaltungFehlt: 'The company management is not available.',
      eingabePasteMock: 'Invalid input for the paste mock.',
      eingabeAccessibilityOverride: 'Invalid input for the accessibility override.',
      ungueltigerText: 'Invalid text.',
      aufbereiteterTextLeer: 'The processed text is empty (only filler words/whitespace).',
      vadStille: 'The VAD reported silence, no text was produced.',
    },

    paste: {
      fehlgeschlagenMacos: (detail: string): string =>
        `Automatic insertion failed${detail}. The text is in the clipboard, please insert it manually with Cmd+V. If the error persists, check the permission for VoiceWall in the system settings under Privacy & Security, Accessibility.`,
      fehlgeschlagenWindows: (detail: string): string =>
        `Automatic insertion failed${detail}. The text is in the clipboard, please insert it manually with Ctrl+V. Note: if the target app runs as administrator, Windows blocks simulated input (UIPI); in that case always use the copy button.`,
      nichtUnterstuetzt:
        'Automatic insertion is not supported on this operating system. The text is in the clipboard, please insert it manually with Ctrl+V.',
    },

    freigaben: {
      accessibilityFehlt:
        'Automatic insertion is not yet possible: VoiceWall has no Accessibility permission. The text is in the clipboard, please insert it manually with Cmd+V. How to grant the permission: 1. Press the button "Open system settings" (or System Settings, Privacy & Security, Accessibility). 2. Enable VoiceWall in the list (add it via the plus symbol if needed). 3. Run the dictation again.',
      accessibilityDialogAngezeigt:
        'macOS has shown the permission dialog. Please choose "Open System Settings" there, enable the switch for VoiceWall and then restart VoiceWall via the button. Important after an update: remove an already existing old VoiceWall entry with the minus symbol first, it belongs to the old program version.',
      nurMacos: 'This settings link only exists on macOS.',
      einstellungenFehler: (detail: string): string =>
        `The system settings could not be opened (${detail}). Please open them manually: System Settings, Privacy & Security, Accessibility.`,
      mikrofonAbgelehnt:
        'Microphone access was denied. Please allow VoiceWall in the system settings under Privacy & Security, Microphone, and restart the app.',
      mikrofonGesperrt:
        'Microphone access is blocked. Please enable VoiceWall in the system settings under Privacy & Security, Microphone, and restart the app.',
      mikrofonEingeschraenkt:
        'Microphone access is restricted on this computer (e.g. by device management). Please contact your system administration.',
    },

    modelle: {
      labels: {
        'whisper-q5': 'German Whisper model (large-v3-turbo, Q5_0)',
        'whisper-fp16': 'German Whisper model (large-v3-turbo, fp16, maximum accuracy)',
        'turbo-q5_0-multilingual': 'English / multilingual (large-v3-turbo, Q5_0)',
        'silero-vad': 'Silero VAD model (v5.1.2)',
      },
      downloadNetzwerkfehler: (detail: string): string =>
        `The model download failed (network error: ${detail}). Please check the internet connection and try again. After the one-time download, VoiceWall runs completely offline.`,
      downloadAbgelehnt: (status: string): string =>
        `The server rejected the model download (HTTP ${status}). Please try again later or check the model source.`,
      downloadNichtGespeichert: (detail: string): string =>
        `The model download could not be saved (${detail}). Please check free disk space and write permissions.`,
      downloadGroesseFalsch: (ist: string, soll: string): string =>
        `The downloaded file has an unexpected size (${ist} instead of ${soll} bytes). The file has been deleted. Please start the download again.`,
      downloadPruefsummeFalsch:
        'The checksum of the downloaded model file does not match the expected value. The file has been deleted for security reasons. Please start the download again; if the error occurs repeatedly, the source is not trustworthy.',
      downloadNichtAbgelegt: (detail: string): string =>
        `The verified model file could not be moved into place (${detail}).`,
      dateiFehlt: (dateiname: string): string => `File missing: ${dateiname}`,
      dateiBeschaedigt: (dateiname: string): string =>
        `The model file ${dateiname} is corrupted (checksum mismatch). It must be downloaded again.`,
      modellFehltDownloadNoetig: (label: string): string =>
        `The ${label} is missing. Please start the one-time model download in the setup assistant.`,
    },

    firmen: {
      keineAktiveFirma: 'No active company. Please create or activate a company first.',
      keineAktiveFirmaKurz: 'No active company.',
      desktopFehltStrategie:
        'The desktop folder was not found. Please use the "local folder with desktop shortcut" strategy.',
      desktopFehlt:
        'The desktop folder was not found. Please choose a target folder for the company folder in the setup assistant.',
      lokalerOrdnerFehler: (detail: string): string =>
        `The local VoiceWall folder could not be created: ${detail}`,
      verknuepfungAngelegt: (ordnername: string, pfad: string): string =>
        `A shortcut "${ordnername}" is on the desktop; the dictations themselves remain in the local folder ${pfad}.`,
      verknuepfungHinweis: (detail: string): string => `Note: ${detail}`,
      verknuepfungKollision: (name: string): string =>
        `An entry named "${name}" already exists on the desktop. VoiceWall never overwrites anything; please check the entry or choose a different name.`,
      verknuepfungFehler: (detail: string): string =>
        `The desktop shortcut could not be created: ${detail}`,
      nichtInListe:
        'This company is not in the list of valid company folders. Please create or open the company first.',
      keinGueltigerOrdner:
        'This folder is not a valid VoiceWall company folder in an allowed location (desktop or ~/VoiceWall).',
      konfigNichtLesbar:
        'The company configuration is not readable (.voicewall/config.json). Please check the company folder.',
      konfigUngueltig:
        'The company configuration is invalid (.voicewall/config.json). Please check the company folder.',
      konfigSchreibFehler: (detail: string): string =>
        `The company configuration could not be written: ${detail}`,
      zielordnerNichtLesbar: (detail: string): string =>
        `The target folder is not readable: ${detail}`,
      ordnerFremd: (name: string): string =>
        `The folder "${name}" already exists and is not a VoiceWall folder. VoiceWall does not write into foreign folders. Please choose a different name, e.g. adopt the suggestion.`,
      ordnerAnlageFehler: (detail: string): string =>
        `The company folder could not be created: ${detail}`,
      syncWarnung: (anbieter: string): string =>
        `Caution: this storage location is synchronised to the cloud by ${anbieter}. ` +
        'Dictations would thereby leave the "100 percent local" promise. Recommendation: keep dictations in the ' +
        'local folder ~/VoiceWall and show only a shortcut on the desktop. The choice ' +
        'remains yours; VoiceWall changes nothing without confirmation.',
      eingabeFirmenname: 'Invalid input for the company name.',
      eingabeFirmenAnlage: 'Invalid input for creating the company.',
      ungueltigerFirmenpfad: 'Invalid company path.',
      eingabeAutoSpeichern: 'Invalid input for the auto-save switch.',
    },

    sanitize: {
      nameLeer:
        'The company name contains no characters usable for a folder name. Please enter a name with letters or digits.',
      nameReserviert:
        'This name is a reserved device name on Windows and cannot be used as a folder name. Please choose a different name.',
      containment:
        'Invalid folder name: the path points outside the target folder. Please choose a different name.',
      pfadZuLang: (laenge: string, grenze: string): string =>
        `The full folder path would be ${laenge} characters long (Windows limit: ${grenze}). Please choose a shorter company name.`,
    },

    containment: {
      ausserhalb: 'Invalid path: the entry points outside the company folder and is rejected.',
    },

    diktate: {
      titelFallback: 'Dictation',
      metadatenUngueltig: (detail: string): string => `Dictation metadata is invalid: ${detail}`,
      ordnerAnlageFehler: (detail: string): string =>
        `The dictations folder could not be created: ${detail}`,
      schreibFehler: (detail: string): string => `The dictation could not be written: ${detail}`,
      anlageKollision: 'The dictation could not be created (file name collision).',
      nichtGefunden: 'The dictation was not found or is not readable.',
      beschaedigt: (detail: string): string => `The dictation is corrupted: ${detail}`,
      schemaVerletzt: (detail: string): string =>
        `The dictation metadata violates the schema: ${detail}`,
      pfadAusserhalbWurzel: (wurzel: string): string =>
        `Invalid path: an entry below "${wurzel}/" is expected. The entry is rejected.`,
      papierkorbFehler: (detail: string): string =>
        `The dictation could not be moved to the trash: ${detail}`,
      papierkorbKollision: 'The dictation could not be moved to the trash (name collision).',
      wiederherstellenZielBelegt:
        'A file with this name already exists at the target location. Please check the existing entry first.',
      wiederherstellenFehler: (detail: string): string =>
        `The dictation could not be restored: ${detail}`,
      endgueltigNurPapierkorb: 'Permanent deletion is only allowed directly from the trash.',
      endgueltigFehler: (detail: string): string =>
        `The dictation could not be deleted permanently: ${detail}`,
      eingabeUngueltig: 'Invalid input.',
      pfadUngueltig: 'Invalid dictation path.',
      suchfilterUngueltig: 'Invalid search filter.',
      eingabeBearbeitung: 'Invalid input for the edit.',
      eingabeNotiz: 'Invalid input for the note.',
    },

    manifest: {
      fehlt: 'Manifest missing.',
      keinJson: 'Manifest is not valid JSON.',
      schemaVerletzt: (detail: string): string => `Manifest violates the schema: ${detail}`,
      schreibFehler: (detail: string): string => `Manifest could not be written: ${detail}`,
    },

    migration: {
      schrittFehlt: (von: string, nach: string): string =>
        `No step is registered for the migration from schema version ${von} to ${nach}. The company folder remains unchanged.`,
      schrittUeberspringt: (beschreibung: string, von: string, nach: string): string =>
        `Migration step "${beschreibung}" skips versions (${von} -> ${nach}). The company folder remains unchanged.`,
      neuereVersion: (ist: string, verstanden: string): string =>
        `The company folder has schema version ${ist}, this VoiceWall version only understands ${verstanden}. Please update VoiceWall; the folder remains unchanged.`,
      abgebrochen: (grund: string): string =>
        `Migration aborted, the company folder is unchanged. Reason: ${grund}`,
      swapFehlgeschlagen: (backup: string, grund: string): string =>
        `Migration failed while taking over; the old state was restored (backup: ${backup}). Reason: ${grund}`,
    },

    tagRename: {
      identisch: 'The new tag name is identical to the old one. Please choose a different name.',
      metadatenUngueltig: (detail: string): string =>
        `The metadata would be invalid after the rename: ${detail}`,
      schreibFehler: (detail: string): string => `The file could not be written: ${detail}`,
      eingabe: 'Invalid input for the tag rename.',
    },

    woerterbuch: {
      nichtLesbar: 'The file vokabular.json is not readable. Please check the file permissions.',
      keinJson:
        'The file vokabular.json is not valid JSON. Please correct the file or save the dictionary again in VoiceWall.',
      schemaVerletzt: (detail: string): string =>
        `The file vokabular.json violates the schema: ${detail}`,
      speichernFehler: (detail: string): string => `The dictionary could not be saved: ${detail}`,
      eingabe: 'Invalid input for the specialist dictionary.',
    },

    export: {
      ordnerFehler: (detail: string): string =>
        `The Exporte folder could not be created: ${detail}. Please check the write permissions in the company folder.`,
      schreibFehler: (detail: string): string =>
        `The export could not be written: ${detail}. Please check the write permissions in the company folder.`,
      kollision: 'The export could not be created (file name collision). Please try again.',
      keineAuswahl: 'No entry was selected for the export.',
      pdfNichtVerfuegbar: 'PDF export is not available in this environment.',
      pdfFehler: (detail: string): string => `The PDF could not be created: ${detail}`,
      stapelVorbereitungFehler: (detail: string): string =>
        `The batch export could not be prepared: ${detail}`,
      stapelAlleFehlgeschlagen: (ersteMeldung: string): string =>
        `None of the selected entries could be exported. First message: ${ersteMeldung}`,
      stapelOrdnerKollision: 'The batch folder could not be created (name collision).',
      stapelFehler: (detail: string): string => `The batch export failed: ${detail}`,
      eingabe: 'Invalid input for the export.',
      eingabeStapel: 'Invalid input for the batch export.',
      exportpfadUngueltig: 'Invalid export path.',
    },

    vwenc: {
      eingabeVerschluesselt:
        'Invalid input for the encrypted export (password at least 12 characters).',
      eingabeEntschluesseln: 'Invalid input for the decryption.',
      dialogTitel: 'Decrypt a VoiceWall-encrypted file',
      dialogKnopf: 'Decrypt',
      dialogFilter: 'VoiceWall encrypted (.vwenc)',
      keineDatei: 'No file was selected.',
      zuGross: 'The file is too large for a VoiceWall .vwenc file (limit 64 MB).',
      nichtLesbar: 'The selected file is not readable.',
      keinContainer: 'This file is not a VoiceWall-encrypted file (.vwenc) or it is incomplete.',
      neuereVersion:
        'This .vwenc file was created with a newer VoiceWall version. Please update VoiceWall.',
      fehlgeschlagen:
        'The decryption failed: the password is wrong or the file has been modified. Note: if the password is lost, the content is irrecoverably lost.',
      schreibFehler: (detail: string): string =>
        `The decrypted file could not be written: ${detail}`,
      namenskollision: 'The decrypted file could not be created (name collision).',
    },

    pdf: {
      quelle: {
        diktat: 'Dictation',
        import: 'Import',
        manuell: 'Note',
      },
      dokumentart: 'Dictation export · created 100 % locally',
      zeileErstellt: 'Created',
      zeileGeaendert: 'Modified',
      zeileQuelle: 'Source',
      zeileModell: 'Model',
      zeileWortzahl: 'Word count',
      zeileTags: 'Tags',
      volltext: 'Full text',
      datumMitZeit: (datum: string, zeit: string): string => `${datum}, ${zeit}`,
      fussErstelltMit: 'Created with VoiceWall, 100 % local',
      fussSeite: 'Page',
      fussVon: 'of',
    },

    tray: {
      diktatStarten: 'Start dictation',
      diktatStoppen: 'Stop dictation',
      fensterOeffnen: 'Open VoiceWall',
      beenden: 'Quit VoiceWall',
      tooltipAufnahme: 'VoiceWall: recording',
    },

    handlers: {
      browserFehler: (detail: string, url: string): string =>
        `The browser could not be opened (${detail}). The source is ${url}; all details are also available directly here in the app.`,
    },
  },
};
