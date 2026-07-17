/**
 * Windows-Paste-Adapter: PowerShell SendKeys loest ein einzelnes Strg+V in der
 * fokussierten App aus.
 *
 * `-ExecutionPolicy Bypass` gilt ausschliesslich prozess-scoped fuer genau
 * diesen einen Aufruf (kein systemweites Aufweichen der Policy);
 * `-NoProfile -NonInteractive` verhindert Profil-Skripte und Rueckfragen.
 *
 * Bekannte Grenze (UIPI): SendKeys aus einem nicht-elevierten Prozess
 * erreicht keine als Administrator laufende Ziel-App. Der Kopieren-Knopf
 * plus Zwischenablage ist dafuer der dokumentierte Ausweg.
 *
 * Sicherheitsregel: execFile mit statischem Argument-Array. Das Kommando ist
 * ein Literal, es wird niemals Nutzer- oder Transkript-Text interpoliert.
 */
import { execFile } from 'node:child_process';
import { texte } from '../i18n';
import { err, ok, type Result } from '../../shared/result';
import type { PasteAdapter } from './index';

/** Statisches PowerShell-Kommando: genau ein Strg+V, nichts sonst. */
const SENDKEYS_COMMAND =
  "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')";

const PASTE_TIMEOUT_MS = 10_000;

export function createWindowsPasteAdapter(): PasteAdapter {
  return {
    id: 'windows-sendkeys',
    paste: () =>
      new Promise<Result<void, string>>((resolve) => {
        execFile(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            SENDKEYS_COMMAND,
          ],
          { timeout: PASTE_TIMEOUT_MS, windowsHide: true },
          (error, _stdout, stderr) => {
            if (error === null) {
              resolve(ok(undefined));
              return;
            }
            const detail = stderr.trim().length > 0 ? ` (${stderr.trim()})` : '';
            resolve(err(texte().paste.fehlgeschlagenWindows(detail)));
          },
        );
      }),
  };
}
