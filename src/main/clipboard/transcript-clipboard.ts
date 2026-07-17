/**
 * Clipboard-Sequenz der Diktat-Zustellung (Datenschutzmassnahme).
 *
 * Ablauf:
 *  (a) Bisherigen Zwischenablage-Inhalt sichern (nur Text-Repraesentation,
 *      ausschliesslich im RAM; Bilder/Dateien gehen bei Wiederherstellung
 *      verloren, das ist die dokumentierte Grenze).
 *  (b) Transkript per writeText in die Zwischenablage schreiben.
 *  (c) Auto-Paste ausloesen (injizierte Funktion; der Aufrufer entscheidet
 *      vorher ueber Accessibility/Adapter).
 *  (d) Nur nach ERFOLGREICHEM Paste und nur bei aktivierter Wiederherstellung:
 *      nach kurzer Verzoegerung den alten Inhalt zurueckschreiben, wodurch das
 *      Transkript die systemweite Zwischenablage sofort wieder verlaesst.
 *
 * Race-Sicherheit: Kopiert der Nutzer waehrend der Verzoegerung selbst etwas,
 * wird NICHT ueberschrieben. Vor der Wiederherstellung wird geprueft, ob die
 * Zwischenablage noch exakt das Transkript haelt; sonst passiert nichts.
 *
 * Resilienz-Primaerpfad: Scheitert das Paste oder ist es nicht moeglich
 * (fehlende Bedienungshilfen-Freigabe, UIPI), bleibt das Transkript bewusst in
 * der Zwischenablage, damit der Nutzer es manuell einfuegen kann; es wird dann
 * NICHT wiederhergestellt. Der Text geht nie verloren.
 *
 * ConcealedType-Befund (empirisch, Electron 43.0.0, macOS): Jeder
 * clipboard.write*-Aufruf loescht das Pasteboard vollstaendig. writeText plus
 * writeBuffer('org.nspasteboard.ConcealedType') im Anschluss loescht den Text;
 * die umgekehrte Reihenfolge loescht den Marker; clipboard.write({...}) kennt
 * keine Custom-Typen. Text UND ConcealedType-Marker gleichzeitig sind mit der
 * Electron-Clipboard-API daher NICHT setzbar (ein natives Addon dafuer wird
 * bewusst nicht eingefuehrt). Die wirksame Massnahme ist stattdessen die
 * hier implementierte sofortige Wiederherstellung/Ueberschreibung.
 *
 * Das Clipboard wird als schmales Interface injiziert (unit-testbar ohne
 * Electron); der FlowController reicht Electrons `clipboard` durch.
 */
import type { Result } from '../../shared/result';

/** Schmale, mockbare Sicht auf die System-Zwischenablage (nur Text). */
export interface ClipboardLike {
  readText(): string;
  writeText(text: string): void;
}

export interface ClipboardSequenceOptions {
  /** Bisherigen Inhalt nach erfolgreichem Paste wiederherstellen. */
  readonly restorePrevious: boolean;
  /** Verzoegerung bis zur Wiederherstellung in Millisekunden. */
  readonly restoreDelayMs: number;
}

export interface ClipboardSequenceDeps {
  readonly clipboard: ClipboardLike;
  /** Injizierbare Verzoegerung (Tests: sofort aufloesen). */
  readonly delay: (ms: number) => Promise<void>;
  /** Loest das Einfuegen aus; null bedeutet: kein Paste versuchen. */
  readonly paste: (() => Promise<Result<void, string>>) | null;
}

export type RestoreOutcome =
  /** Alter Inhalt wurde zurueckgeschrieben. */
  | 'restored'
  /** Nutzer hat zwischenzeitlich selbst kopiert: nicht angefasst (Race-Schutz). */
  | 'skipped-user-copied'
  /** Wiederherstellung per Konfiguration deaktiviert. */
  | 'disabled'
  /** Paste fand nicht statt oder schlug fehl: Transkript bleibt verfuegbar. */
  | 'skipped-no-paste';

export interface ClipboardSequenceResult {
  /** Ergebnis des Paste-Schritts (err mit deutscher Meldung, null = kein Versuch). */
  readonly pasteResult: Result<void, string> | null;
  /**
   * Laeuft nach dem Paste weiter (Verzoegerung + Wiederherstellung) und meldet
   * am Ende, was mit der Zwischenablage passiert ist. Der Aufrufer kann das
   * Paste-Ergebnis sofort verwenden und die Wiederherstellung im Hintergrund
   * abwarten.
   */
  readonly restore: Promise<RestoreOutcome>;
}

/**
 * Fuehrt die Schritte (a) bis (c) aus und liefert das Paste-Ergebnis; Schritt
 * (d) laeuft als `restore`-Promise weiter (siehe ClipboardSequenceResult).
 */
export async function runClipboardSequence(
  transcript: string,
  options: ClipboardSequenceOptions,
  deps: ClipboardSequenceDeps,
): Promise<ClipboardSequenceResult> {
  // (a) Alten Inhalt sichern (Text-Repraesentation, RAM-only).
  const previousText = deps.clipboard.readText();

  // (b) Transkript in die Zwischenablage. Einziger Datenweg des Textes.
  deps.clipboard.writeText(transcript);

  // (c) Paste ausloesen, falls moeglich.
  const pasteResult = deps.paste === null ? null : await deps.paste();

  const restore = (async (): Promise<RestoreOutcome> => {
    if (pasteResult === null || !pasteResult.ok) {
      // Resilienz-Primaerpfad: Text bleibt in der Zwischenablage verfuegbar.
      return 'skipped-no-paste';
    }
    if (!options.restorePrevious) {
      // Bewusste Nutzerentscheidung: Transkript bleibt liegen (Opt-out der
      // Datenschutzmassnahme).
      return 'disabled';
    }
    await deps.delay(options.restoreDelayMs);
    // Race-Schutz: nur wiederherstellen, wenn noch das Transkript drinsteht.
    if (deps.clipboard.readText() !== transcript) {
      return 'skipped-user-copied';
    }
    deps.clipboard.writeText(previousText);
    return 'restored';
  })();

  return { pasteResult, restore };
}

/** Standard-Verzoegerung ueber setTimeout (Produktivpfad). */
export function realDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
