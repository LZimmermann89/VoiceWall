/**
 * macOS-Paste-Adapter: osascript loest ein einzelnes Cmd+V in der fokussierten
 * App aus. Das ist der komplette Umfang dessen, was VoiceWall mit dem
 * Bedienungshilfen-Recht tut (kein Keylogging, kein Mitlesen; siehe
 * docs/ACCESSIBILITY.md).
 *
 * Voraussetzung: Bedienungshilfen-Freigabe (TCC). Der Aufrufer prueft VOR dem
 * Paste `isTrustedAccessibilityClient` (permission/accessibility.ts); ohne
 * Freigabe wird dieser Adapter gar nicht erst aufgerufen.
 *
 * Sicherheitsregel: execFile mit statischem Argument-Array. Das Kommando ist
 * ein Literal, es wird niemals Nutzer- oder Transkript-Text interpoliert.
 */
import { execFile } from 'node:child_process';
import { texte } from '../i18n';
import { err, ok, type Result } from '../../shared/result';
import type { PasteAdapter } from './index';

/** Statisches AppleScript: genau ein Cmd+V, nichts sonst. */
const PASTE_SCRIPT = 'tell application "System Events" to keystroke "v" using command down';

const PASTE_TIMEOUT_MS = 5000;

export function createMacosPasteAdapter(): PasteAdapter {
  return {
    id: 'macos-osascript',
    paste: () =>
      new Promise<Result<void, string>>((resolve) => {
        execFile(
          'osascript',
          ['-e', PASTE_SCRIPT],
          { timeout: PASTE_TIMEOUT_MS },
          (error, _stdout, stderr) => {
            if (error === null) {
              resolve(ok(undefined));
              return;
            }
            const detail = stderr.trim().length > 0 ? ` (${stderr.trim()})` : '';
            resolve(err(texte().paste.fehlgeschlagenMacos(detail)));
          },
        );
      }),
  };
}
