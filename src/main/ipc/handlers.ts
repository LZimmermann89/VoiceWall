/**
 * Registrierung aller IPC-Handler des Main-Prozesses. Jeder Handler liefert
 * ausschließlich typisierte Werte an den Renderer zurück, nie rohe Fehler
 * oder Stacktraces.
 */
import { ipcMain } from 'electron';
import type { PingResponse } from '../../shared/schema';
import { IpcChannel } from './channels';

export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannel.Ping, (): PingResponse => 'pong');
}
