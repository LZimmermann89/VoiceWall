/**
 * Zustandsmaschine des systemweiten Diktat-Flows (Hotkey-Toggle).
 *
 * Reine, deterministische Logik ohne Node-/Electron-/DOM-Abhaengigkeit, damit
 * jeder Uebergang unit-testbar ist. Die Seiteneffekte (Aufnahme starten,
 * Engine flushen, Clipboard-Sequenz, Overlay) fuehrt der FlowController im
 * Main-Prozess aus; er interpretiert ausschliesslich die hier gelieferte
 * `action`.
 *
 * Zustaende:
 *   idle         Kein Diktat aktiv.
 *   recording    Aufnahme laeuft (Capture-Fenster + Engine aktiv).
 *   transcribing Aufnahme gestoppt, letztes Segment wird geflusht/transkribiert.
 *   delivering   Text wird zugestellt (Clipboard-Sequenz + Auto-Paste).
 *
 * Toggle-Semantik: Der erste Druck startet, der zweite stoppt. Waehrend
 * transcribing/delivering wird der Hotkey bewusst ignoriert (kein Abbruch
 * halbfertiger Zustellung, kein versehentlicher Doppelstart).
 */

export type DictationFlowState = 'idle' | 'recording' | 'transcribing' | 'delivering';

export type DictationFlowEvent =
  /** Hotkey gedrueckt (Toggle). */
  | 'toggle'
  /** Engine hat das letzte Segment verarbeitet (Flush abgeschlossen). */
  | 'flush-complete'
  /** Zustellung (Clipboard + Paste) abgeschlossen, egal ob erfolgreich. */
  | 'delivery-complete'
  /** Abbruch von aussen (Sperrbildschirm, Suspend, fataler Fehler). */
  | 'cancel';

export type DictationFlowAction =
  /** Aufnahme starten (Capture-Fenster + Engine). */
  | 'start-recording'
  /** Aufnahme stoppen und letztes Segment flushen. */
  | 'stop-and-flush'
  /** Gesammelten Text zustellen (Clipboard-Sequenz + Auto-Paste). */
  | 'deliver'
  /** Laufende Aufnahme verwerfen (kein Text, kein Paste). */
  | 'abort-recording'
  /** Nichts tun (Event in diesem Zustand ignoriert). */
  | 'none';

export interface DictationFlowTransition {
  readonly next: DictationFlowState;
  readonly action: DictationFlowAction;
}

/** Liefert Folgezustand und auszufuehrende Aktion fuer ein Event. */
export function transitionDictationFlow(
  state: DictationFlowState,
  event: DictationFlowEvent,
): DictationFlowTransition {
  switch (event) {
    case 'toggle':
      if (state === 'idle') {
        return { next: 'recording', action: 'start-recording' };
      }
      if (state === 'recording') {
        return { next: 'transcribing', action: 'stop-and-flush' };
      }
      // Waehrend transcribing/delivering ignorieren (siehe Kopfkommentar).
      return { next: state, action: 'none' };
    case 'flush-complete':
      if (state === 'transcribing') {
        return { next: 'delivering', action: 'deliver' };
      }
      return { next: state, action: 'none' };
    case 'delivery-complete':
      if (state === 'delivering') {
        return { next: 'idle', action: 'none' };
      }
      return { next: state, action: 'none' };
    case 'cancel':
      if (state === 'recording') {
        return { next: 'idle', action: 'abort-recording' };
      }
      if (state === 'transcribing') {
        // Aufnahme ist schon gestoppt; angefallenen Text verwerfen.
        return { next: 'idle', action: 'abort-recording' };
      }
      // idle: nichts zu tun. delivering: Zustellung laeuft bereits nur noch
      // auf Clipboard-Ebene und beendet sich selbst (delivery-complete).
      return { next: state, action: 'none' };
  }
}

/**
 * Minimale Nachbearbeitung (M3): Segmente trimmen, Leersegmente verwerfen,
 * mit einfachem Leerzeichen verbinden und Mehrfach-Whitespace zusammenziehen.
 * Mehr Nachbearbeitung (Interpunktion, Fuellwoerter) folgt in spaeteren
 * Meilensteinen, ausschliesslich lokal und regelbasiert.
 */
export function joinTranscriptSegments(segments: readonly string[]): string {
  return segments
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ');
}
