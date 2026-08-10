/**
 * Zielanwendung am Ende des Diktats ("... an Word senden").
 *
 * Zweck: Der Text soll nicht in der gerade aktiven Anwendung landen, sondern
 * in einer benannten. Der Sprecher haengt dafuer eine feste Schlusswendung an,
 * VoiceWall trennt sie ab, holt die Anwendung nach vorne und fuegt dort ein.
 *
 * HARTE GUARDRAIL, wie ueberall in der Textverarbeitung: Das hier ist eine
 * endliche Liste und ein festes Muster. Kein Modell, kein Sprachverstaendnis,
 * kein Netzaufruf. Eine freie Formulierung ("packe das mal rueber zu Word")
 * wird bewusst NICHT erkannt: An der Stelle, an der entschieden wird, WOHIN
 * fremder Text geschrieben wird, waere ein nichtdeterministischer Rater die
 * falsche Wahl.
 *
 * Sicherheitsgewinn der festen Liste: Der Anwendungsbezeichner, der spaeter
 * an das Betriebssystem geht, stammt IMMER aus diesem einkompilierten
 * Katalog, nie aus dem Transkript. Aus dem Diktat kommt nur die Entscheidung,
 * WELCHER Eintrag gemeint ist.
 *
 * Erkennungsmuster, bewusst eng:
 * - Praeposition UND Verb sind Pflicht ("an Word senden"), nicht nur der Name.
 *   "Bitte die Daten in Excel" loest deshalb nichts aus.
 * - Die Wendung muss am ENDE des Textes stehen.
 * Die verbleibende Unschaerfe (ein Diktat, das woertlich auf "in Excel
 * einfuegen" endet) ist der Grund, warum der Schalter standardmaessig AUS ist.
 *
 * Zu den Prozessnamen: Sie sind KEINE Vermutung. Die macOS-Namen sind die
 * tatsaechlichen Programmnamen aus den Info.plist der installierten
 * Anwendungen (Microsoft Teams heisst intern "MSTeams", LibreOffice
 * "soffice", IntelliJ "idea"). Wo mehrere Schreibweisen im Umlauf sind, etwa
 * ueber Programmversionen hinweg, stehen mehrere Kandidaten; gesucht wird der
 * erste, der laeuft. Ein Kandidat, den es nicht gibt, richtet keinen Schaden
 * an: er wird schlicht nicht gefunden.
 *
 * Dieses Modul bleibt plattformneutral (kein Node/Electron/DOM).
 */
import type { DictationLanguage } from './schema';

/**
 * Betriebssystem-Kennung, wie sie process.platform liefert. Bewusst ein
 * eigener Typ statt NodeJS.Platform: dieses Modul bleibt plattformneutral und
 * damit frei von Node-Typen (ESLint-Modulgrenze src/shared).
 */
export type Plattform = string;

/** Eine ansteuerbare Anwendung samt ihrer Bezeichner je Betriebssystem. */
export interface Zielanwendung {
  /** Stabile Kennung (Konfiguration, Logs, Tests). */
  readonly id: string;
  /** Anzeigename in der Oberflaeche. */
  readonly name: string;
  /** Gesprochene Namen, kleingeschrieben; der erste ist der Hauptname. */
  readonly gesprochen: readonly string[];
  /**
   * Programmnamen auf macOS, wie `pgrep -x` sie sieht. Leer bedeutet: auf
   * dieser Plattform nicht ansteuerbar.
   */
  readonly macosProzess: readonly string[];
  /** Anwendungsname fuer `open -a` auf macOS (null: nicht verfuegbar). */
  readonly macosApp: string | null;
  /** Programmnamen auf Windows, wie Get-Process sie sieht (ohne .exe). */
  readonly windowsProzess: readonly string[];
}

/**
 * Der mitgelieferte Katalog.
 *
 * Eine Kommandozeile ist absichtlich NICHT dabei: eingefuegter Text steht
 * dort einen Tastendruck vor der Ausfuehrung, und eine Fehlerkennung haette
 * eine ganz andere Tragweite als in einem Textfeld.
 */
export const ZIELANWENDUNGEN: readonly Zielanwendung[] = [
  // --- Microsoft Office ---------------------------------------------------
  {
    id: 'word',
    name: 'Word',
    gesprochen: ['word'],
    macosProzess: ['Microsoft Word'],
    macosApp: 'Microsoft Word',
    windowsProzess: ['WINWORD'],
  },
  {
    id: 'excel',
    name: 'Excel',
    gesprochen: ['excel'],
    macosProzess: ['Microsoft Excel'],
    macosApp: 'Microsoft Excel',
    windowsProzess: ['EXCEL'],
  },
  {
    id: 'powerpoint',
    name: 'PowerPoint',
    gesprochen: ['powerpoint', 'power point'],
    macosProzess: ['Microsoft PowerPoint'],
    macosApp: 'Microsoft PowerPoint',
    windowsProzess: ['POWERPNT'],
  },
  {
    id: 'outlook',
    name: 'Outlook',
    gesprochen: ['outlook'],
    macosProzess: ['Microsoft Outlook'],
    macosApp: 'Microsoft Outlook',
    windowsProzess: ['OUTLOOK', 'olk'],
  },
  {
    id: 'onenote',
    name: 'OneNote',
    gesprochen: ['onenote', 'one note'],
    macosProzess: ['Microsoft OneNote'],
    macosApp: 'Microsoft OneNote',
    windowsProzess: ['ONENOTE', 'onenoteim'],
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    gesprochen: ['teams', 'microsoft teams'],
    macosProzess: ['MSTeams', 'Microsoft Teams'],
    macosApp: 'Microsoft Teams',
    windowsProzess: ['ms-teams', 'Teams'],
  },
  // --- Apple-Produktivitaet -----------------------------------------------
  {
    id: 'mail',
    name: 'Mail',
    gesprochen: ['mail', 'apple mail'],
    macosProzess: ['Mail'],
    macosApp: 'Mail',
    windowsProzess: [],
  },
  {
    id: 'kalender',
    name: 'Kalender',
    gesprochen: ['kalender', 'calendar'],
    macosProzess: ['Calendar'],
    macosApp: 'Calendar',
    // Windows hat keine eigenstaendige Kalender-Anwendung mit stabilem
    // Programmnamen; dort ist der Kalender Teil von Outlook.
    windowsProzess: [],
  },
  {
    id: 'notizen',
    name: 'Notizen',
    gesprochen: ['notizen', 'notes'],
    macosProzess: ['Notes'],
    macosApp: 'Notes',
    windowsProzess: [],
  },
  {
    id: 'erinnerungen',
    name: 'Erinnerungen',
    gesprochen: ['erinnerungen', 'reminders'],
    macosProzess: ['Reminders'],
    macosApp: 'Reminders',
    windowsProzess: [],
  },
  {
    id: 'nachrichten',
    name: 'Nachrichten',
    gesprochen: ['nachrichten', 'messages', 'imessage'],
    macosProzess: ['Messages'],
    macosApp: 'Messages',
    windowsProzess: [],
  },
  {
    id: 'kontakte',
    name: 'Kontakte',
    gesprochen: ['kontakte', 'contacts'],
    macosProzess: ['Contacts'],
    macosApp: 'Contacts',
    windowsProzess: [],
  },
  {
    id: 'facetime',
    name: 'FaceTime',
    gesprochen: ['facetime', 'face time'],
    macosProzess: ['FaceTime'],
    macosApp: 'FaceTime',
    windowsProzess: [],
  },
  {
    id: 'freeform',
    name: 'Freeform',
    gesprochen: ['freeform', 'free form'],
    macosProzess: ['Freeform'],
    macosApp: 'Freeform',
    windowsProzess: [],
  },
  {
    id: 'notizzettel',
    name: 'Notizzettel',
    gesprochen: ['notizzettel', 'stickies'],
    macosProzess: ['Stickies'],
    macosApp: 'Stickies',
    windowsProzess: [],
  },
  {
    id: 'textedit',
    name: 'TextEdit',
    gesprochen: ['textedit', 'text edit'],
    macosProzess: ['TextEdit'],
    macosApp: 'TextEdit',
    windowsProzess: [],
  },
  {
    id: 'vorschau',
    name: 'Vorschau',
    gesprochen: ['vorschau', 'preview'],
    macosProzess: ['Preview'],
    macosApp: 'Preview',
    windowsProzess: [],
  },
  {
    id: 'pages',
    name: 'Pages',
    gesprochen: ['pages'],
    macosProzess: ['Pages'],
    macosApp: 'Pages',
    windowsProzess: [],
  },
  {
    id: 'numbers',
    name: 'Numbers',
    gesprochen: ['numbers'],
    macosProzess: ['Numbers'],
    macosApp: 'Numbers',
    windowsProzess: [],
  },
  {
    id: 'keynote',
    name: 'Keynote',
    gesprochen: ['keynote', 'key note'],
    macosProzess: ['Keynote'],
    macosApp: 'Keynote',
    windowsProzess: [],
  },
  // --- Windows-Bordmittel -------------------------------------------------
  {
    id: 'editor',
    name: 'Editor',
    gesprochen: ['editor', 'notepad'],
    macosProzess: [],
    macosApp: null,
    windowsProzess: ['notepad'],
  },
  {
    id: 'wordpad',
    name: 'WordPad',
    gesprochen: ['wordpad', 'word pad'],
    macosProzess: [],
    macosApp: null,
    windowsProzess: ['wordpad'],
  },
  // --- Browser ------------------------------------------------------------
  {
    id: 'safari',
    name: 'Safari',
    gesprochen: ['safari'],
    macosProzess: ['Safari'],
    macosApp: 'Safari',
    windowsProzess: [],
  },
  {
    id: 'chrome',
    name: 'Chrome',
    gesprochen: ['chrome', 'google chrome'],
    macosProzess: ['Google Chrome'],
    macosApp: 'Google Chrome',
    windowsProzess: ['chrome'],
  },
  {
    id: 'firefox',
    name: 'Firefox',
    gesprochen: ['firefox', 'fire fox'],
    macosProzess: ['firefox'],
    macosApp: 'Firefox',
    windowsProzess: ['firefox'],
  },
  {
    id: 'edge',
    name: 'Edge',
    gesprochen: ['edge', 'microsoft edge'],
    macosProzess: ['Microsoft Edge'],
    macosApp: 'Microsoft Edge',
    windowsProzess: ['msedge'],
  },
  {
    id: 'brave',
    name: 'Brave',
    gesprochen: ['brave'],
    macosProzess: ['Brave Browser'],
    macosApp: 'Brave Browser',
    windowsProzess: ['brave'],
  },
  {
    id: 'opera',
    name: 'Opera',
    gesprochen: ['opera'],
    macosProzess: ['Opera'],
    macosApp: 'Opera',
    windowsProzess: ['opera'],
  },
  {
    id: 'vivaldi',
    name: 'Vivaldi',
    gesprochen: ['vivaldi'],
    macosProzess: ['Vivaldi'],
    macosApp: 'Vivaldi',
    windowsProzess: ['vivaldi'],
  },
  {
    id: 'arc',
    name: 'Arc',
    gesprochen: ['arc'],
    macosProzess: ['Arc'],
    macosApp: 'Arc',
    windowsProzess: ['Arc'],
  },
  // --- Kommunikation ------------------------------------------------------
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    gesprochen: ['whatsapp', 'whats app'],
    macosProzess: ['WhatsApp'],
    macosApp: 'WhatsApp',
    windowsProzess: ['WhatsApp'],
  },
  {
    id: 'zoom',
    name: 'Zoom',
    gesprochen: ['zoom'],
    macosProzess: ['zoom.us'],
    macosApp: 'zoom.us',
    windowsProzess: ['Zoom'],
  },
  {
    id: 'slack',
    name: 'Slack',
    gesprochen: ['slack'],
    macosProzess: ['Slack'],
    macosApp: 'Slack',
    windowsProzess: ['slack'],
  },
  {
    id: 'signal',
    name: 'Signal',
    gesprochen: ['signal'],
    macosProzess: ['Signal'],
    macosApp: 'Signal',
    windowsProzess: ['Signal'],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    gesprochen: ['telegram'],
    macosProzess: ['Telegram'],
    macosApp: 'Telegram',
    windowsProzess: ['Telegram'],
  },
  {
    id: 'discord',
    name: 'Discord',
    gesprochen: ['discord'],
    macosProzess: ['Discord'],
    macosApp: 'Discord',
    windowsProzess: ['Discord'],
  },
  {
    id: 'skype',
    name: 'Skype',
    gesprochen: ['skype'],
    macosProzess: ['Skype'],
    macosApp: 'Skype',
    windowsProzess: ['Skype'],
  },
  {
    id: 'webex',
    name: 'Webex',
    gesprochen: ['webex', 'web ex'],
    macosProzess: ['Webex'],
    macosApp: 'Webex',
    windowsProzess: ['CiscoCollabHost', 'webexmta'],
  },
  // --- Notizen und Wissen -------------------------------------------------
  {
    id: 'notion',
    name: 'Notion',
    gesprochen: ['notion'],
    macosProzess: ['Notion'],
    macosApp: 'Notion',
    windowsProzess: ['Notion'],
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    gesprochen: ['obsidian'],
    macosProzess: ['Obsidian'],
    macosApp: 'Obsidian',
    windowsProzess: ['Obsidian'],
  },
  {
    id: 'evernote',
    name: 'Evernote',
    gesprochen: ['evernote', 'ever note'],
    macosProzess: ['Evernote'],
    macosApp: 'Evernote',
    windowsProzess: ['Evernote'],
  },
  {
    id: 'bear',
    name: 'Bear',
    gesprochen: ['bear'],
    macosProzess: ['Bear'],
    macosApp: 'Bear',
    windowsProzess: [],
  },
  // --- Entwicklung --------------------------------------------------------
  {
    id: 'intellij',
    name: 'IntelliJ IDEA',
    gesprochen: ['intellij', 'intellij idea', 'intelli j'],
    macosProzess: ['idea'],
    macosApp: 'IntelliJ IDEA',
    windowsProzess: ['idea64'],
  },
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    gesprochen: ['visual studio code', 'vs code', 'vscode'],
    macosProzess: ['Code', 'Electron'],
    macosApp: 'Visual Studio Code',
    windowsProzess: ['Code'],
  },
  {
    id: 'xcode',
    name: 'Xcode',
    gesprochen: ['xcode', 'x code'],
    macosProzess: ['Xcode'],
    macosApp: 'Xcode',
    windowsProzess: [],
  },
  {
    id: 'pycharm',
    name: 'PyCharm',
    gesprochen: ['pycharm', 'py charm'],
    macosProzess: ['pycharm'],
    macosApp: 'PyCharm',
    windowsProzess: ['pycharm64'],
  },
  {
    id: 'webstorm',
    name: 'WebStorm',
    gesprochen: ['webstorm', 'web storm'],
    macosProzess: ['webstorm'],
    macosApp: 'WebStorm',
    windowsProzess: ['webstorm64'],
  },
  {
    id: 'androidstudio',
    name: 'Android Studio',
    gesprochen: ['android studio'],
    macosProzess: ['studio'],
    macosApp: 'Android Studio',
    windowsProzess: ['studio64'],
  },
  {
    id: 'sublime',
    name: 'Sublime Text',
    gesprochen: ['sublime', 'sublime text'],
    macosProzess: ['Sublime Text'],
    macosApp: 'Sublime Text',
    windowsProzess: ['sublime_text'],
  },
  {
    id: 'notepadplusplus',
    name: 'Notepad++',
    gesprochen: ['notepad plus plus'],
    macosProzess: [],
    macosApp: null,
    windowsProzess: ['notepad++'],
  },
  // --- Sonstige Buero-Anwendungen -----------------------------------------
  {
    id: 'libreoffice',
    name: 'LibreOffice',
    gesprochen: ['libreoffice', 'libre office'],
    macosProzess: ['soffice'],
    macosApp: 'LibreOffice',
    windowsProzess: ['soffice'],
  },
  {
    id: 'acrobat',
    name: 'Acrobat Reader',
    gesprochen: ['acrobat', 'adobe acrobat', 'acrobat reader'],
    macosProzess: ['AdobeAcrobat', 'Acrobat Reader'],
    macosApp: 'Adobe Acrobat Reader',
    windowsProzess: ['Acrobat', 'AcroRd32'],
  },
  {
    id: 'thunderbird',
    name: 'Thunderbird',
    gesprochen: ['thunderbird', 'thunder bird'],
    macosProzess: ['thunderbird'],
    macosApp: 'Thunderbird',
    windowsProzess: ['thunderbird'],
  },
];

/** Praepositionen, die die Schlusswendung einleiten (je Diktatsprache). */
const PRAEPOSITIONEN: Readonly<Record<DictationLanguage, readonly string[]>> = {
  de: ['an', 'in', 'nach', 'ins', 'zu'],
  en: ['to', 'into'],
};

/** Verben, die die Schlusswendung abschliessen (je Diktatsprache). */
const VERBEN: Readonly<Record<DictationLanguage, readonly string[]>> = {
  de: ['senden', 'schicken', 'einfügen', 'einfuegen', 'übertragen', 'uebertragen', 'kopieren'],
  en: ['send', 'insert', 'paste', 'transfer'],
};

/** Ergebnis der Erkennung: bereinigter Text plus erkanntes Ziel. */
export interface Zielbefehl {
  /** Der Text ohne die Schlusswendung. */
  readonly text: string;
  /** Die erkannte Zielanwendung. */
  readonly ziel: Zielanwendung;
}

/** Vergleichsform: klein, ohne Satzzeichen, einfacher Leerraum. */
function vergleichsform(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[.,;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sucht am Textende die Wendung "<Praeposition> <Zielname> <Verb>" und gibt
 * den Text ohne sie plus das Ziel zurueck. Ohne Treffer: null.
 *
 * Verglichen wird auf Wortebene gegen den eigenen Katalog, nicht per Regex
 * aus Nutzerdaten. Laengere Zielnamen gewinnen vor kuerzeren, damit
 * "power point" nicht als "point" missverstanden wird.
 */
export function erkenneZielbefehl(
  text: string,
  sprache: DictationLanguage = 'de',
): Zielbefehl | null {
  const praepositionen = PRAEPOSITIONEN[sprache];
  const verben = VERBEN[sprache];
  const woerter = vergleichsform(text)
    .split(' ')
    .filter((wort) => wort.length > 0);
  if (woerter.length < 3) {
    return null;
  }
  // Das letzte Wort muss das Verb sein, sonst ist es keine Schlusswendung.
  const letztes = woerter[woerter.length - 1] ?? '';
  if (!verben.includes(letztes)) {
    return null;
  }
  // Alle Namensvarianten nach Wortzahl absteigend pruefen (laengste zuerst).
  const kandidaten = ZIELANWENDUNGEN.flatMap((ziel) =>
    ziel.gesprochen.map((gesprochen) => ({ ziel, gesprochen })),
  ).sort((a, b) => b.gesprochen.split(' ').length - a.gesprochen.split(' ').length);

  for (const { ziel, gesprochen } of kandidaten) {
    const namensteile = gesprochen.split(' ');
    const start = woerter.length - 1 - namensteile.length;
    if (start < 1) {
      continue;
    }
    if (woerter.slice(start, woerter.length - 1).join(' ') !== gesprochen) {
      continue;
    }
    const praeposition = woerter[start - 1] ?? '';
    if (!praepositionen.includes(praeposition)) {
      continue;
    }
    // Treffer: die Wendung aus dem ORIGINALTEXT entfernen. Abgeschnitten wird
    // von hinten so viel, wie die Wendung an Woertern hat; davor bleibt das
    // Original unangetastet (Gross-/Kleinschreibung, Umlaute, Satzzeichen).
    const originalWoerter = text.trim().split(/\s+/);
    const rest = originalWoerter.slice(0, originalWoerter.length - (namensteile.length + 2));
    const bereinigt = rest
      .join(' ')
      .replace(/[\s,;:]+$/, '')
      .trim();
    if (bereinigt.length === 0) {
      // Nur die Wendung, kein Inhalt davor: Es gaebe nichts zuzustellen. Dann
      // ist es kein Befehl, sondern normaler Text (und bleibt es auch).
      return null;
    }
    return { text: bereinigt, ziel };
  }
  return null;
}

/** Liefert die Zielanwendung zu einer Kennung oder null. */
export function zielanwendungMitId(id: string): Zielanwendung | null {
  return ZIELANWENDUNGEN.find((ziel) => ziel.id === id) ?? null;
}

/** Ist die Anwendung auf dieser Plattform ueberhaupt ansteuerbar? */
export function istVerfuegbarAuf(ziel: Zielanwendung, platform: Plattform): boolean {
  if (platform === 'darwin') {
    return ziel.macosProzess.length > 0 && ziel.macosApp !== null;
  }
  if (platform === 'win32') {
    return ziel.windowsProzess.length > 0;
  }
  return false;
}

/** Alle auf dieser Plattform ansteuerbaren Ziele (fuer die Oberflaeche). */
export function zieleFuerPlattform(platform: Plattform): readonly Zielanwendung[] {
  return ZIELANWENDUNGEN.filter((ziel) => istVerfuegbarAuf(ziel, platform));
}
