/**
 * Registrierung der grundlegenden IPC-Handler des Main-Prozesses. Der
 * STT-spezifische Teil wird vom DictationOrchestrator registriert (siehe
 * stt/orchestrator.ts). Jeder Handler liefert ausschließlich typisierte
 * Werte an den Renderer zurück, nie rohe Fehler oder Stacktraces.
 */
import { cpus, totalmem } from 'node:os';
import { app, ipcMain, shell } from 'electron';
import { IMPRESSUM_QUELLE_URL } from '../../shared/impressum';
import type { ActionResult, PingResponse, SystemInfo } from '../../shared/schema';
import { MODEL_CATALOG } from '../model/model-catalog';
import { IpcChannel } from './channels';

/**
 * Hardware-Schwellen der Modellempfehlung (ABARBEITUNG 2.2): fp16
 * ("Maximale Genauigkeit") nur ab 16 GB RAM und mindestens 6 Kernen.
 * `os.cpus()` zaehlt logische Kerne; auf Apple Silicon entspricht das den
 * physischen Kernen, auf Intel mit Hyper-Threading ist es eine grosszuegige
 * Naeherung. Das ist dokumentiert und fuer eine EMPFEHLUNG ausreichend
 * (die Wahl bleibt beim Nutzer, Q5_0 bleibt immer der Default).
 */
const FP16_MIN_RAM_GB = 16;
const FP16_MIN_CPU_CORES = 6;

/** Sammelt die Systeminformationen fuer Wizard und Beleg-Footer. */
export function collectSystemInfo(): SystemInfo {
  const cpuKerne = Math.max(1, cpus().length);
  const ramGb = Math.round((totalmem() / 1024 ** 3) * 10) / 10;
  return {
    platform: process.platform,
    arch: process.arch,
    cpuKerne,
    ramGb,
    fp16Erlaubt: ramGb >= FP16_MIN_RAM_GB && cpuKerne >= FP16_MIN_CPU_CORES,
    appVersion: app.getVersion(),
    modellPruefsumme: MODEL_CATALOG.whisperQ5.sha256.slice(0, 12),
  };
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannel.Ping, (): PingResponse => 'pong');
  ipcMain.handle(IpcChannel.SystemInfo, (): SystemInfo => collectSystemInfo());

  // Rechtstexte (M9): oeffnet die Impressums-Quelle im Standard-Browser.
  // Bewusste, dokumentierte openExternal-Ausnahme (ENTSCHEIDUNGEN E31):
  // ausschliesslich das statische Literal IMPRESSUM_QUELLE_URL, nie
  // dynamischer Input. Der Nutzer stoesst den Aufruf explizit per Knopf an;
  // die App selbst laedt dabei nichts (der Browser ist ein fremder Prozess).
  ipcMain.handle(IpcChannel.OpenImpressumSource, async (): Promise<ActionResult> => {
    try {
      await shell.openExternal(IMPRESSUM_QUELLE_URL);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: `Der Browser konnte nicht geöffnet werden (${error instanceof Error ? error.message : String(error)}). Die Quelle ist ${IMPRESSUM_QUELLE_URL}; alle Angaben stehen auch direkt hier in der App.`,
      };
    }
  });
}
