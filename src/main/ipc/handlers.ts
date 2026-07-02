/**
 * Registrierung der grundlegenden IPC-Handler des Main-Prozesses. Der
 * STT-spezifische Teil wird vom DictationOrchestrator registriert (siehe
 * stt/orchestrator.ts). Jeder Handler liefert ausschließlich typisierte
 * Werte an den Renderer zurück, nie rohe Fehler oder Stacktraces.
 */
import { ipcMain } from 'electron';
import type { PingResponse } from '../../shared/schema';
import { IpcChannel } from './channels';

export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannel.Ping, (): PingResponse => 'pong');
}
