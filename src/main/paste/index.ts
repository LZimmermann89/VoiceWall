/**
 * Auto-Paste-Adapter: simuliert genau EINEN Tastendruck (Cmd/Strg+V) in der
 * fokussierten Fremd-App, nachdem das Transkript per clipboard.writeText in
 * der Zwischenablage liegt.
 *
 * Harte Sicherheitsregeln (Command-Injection-Abwehr):
 * - Ausnahmslos `execFile` mit Argument-Array, nie `exec`, nie Shell-Strings.
 * - Das Transkript geht NIE in die Kommandozeile: die Adapter kennen den Text
 *   gar nicht, sie loesen nur das Einfuegen aus. Der einzige Datenweg des
 *   Textes ist die Zwischenablage.
 * - Die osascript-/PowerShell-Kommandos sind statische Literale ohne jede
 *   Interpolation.
 *
 * Erweiterbarkeit: Der Orchestrator/FlowController haengt nur am
 * `PasteAdapter`-Interface. Ein spaeterer Fallback-Adapter (z. B.
 * @nut-tree-fork/nut-js, falls der OS-Weg auf einer Zielmaschine scheitert)
 * kann dieses Interface implementieren und im Dispatch andocken, ohne dass
 * sich am Flow etwas aendert. In v1 wird bewusst KEIN nut-js eingebaut
 * (keine zusaetzliche native Flaeche ohne nachgewiesenen Bedarf).
 *
 * Linux wird in v1 nicht unterstuetzt.
 */
import { texte } from '../i18n';
import { err, ok, type Result } from '../../shared/result';
import { createMacosPasteAdapter } from './macos';
import { createWindowsPasteAdapter } from './windows';

export interface PasteAdapter {
  /** Stabile Kennung des Adapters (fuer Logs und Tests). */
  readonly id: string;
  /**
   * Loest das Einfuegen (Cmd/Strg+V) in der fokussierten App aus. Erwartbare
   * Fehler (Exit-Code != 0, fehlendes Werkzeug) kommen als Katalog-Meldung
   * in der UI-Sprache mit naechstem Schritt zurueck, nie als Exception.
   */
  readonly paste: () => Promise<Result<void, string>>;
}

/** Waehlt den Paste-Adapter fuer die Plattform (Dispatch). */
export function createPasteAdapter(platform: NodeJS.Platform): Result<PasteAdapter, string> {
  switch (platform) {
    case 'darwin':
      return ok(createMacosPasteAdapter());
    case 'win32':
      return ok(createWindowsPasteAdapter());
    default:
      return err(texte().paste.nichtUnterstuetzt);
  }
}
