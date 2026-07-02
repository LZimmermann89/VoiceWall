/**
 * Preload: exponiert über die contextBridge eine schmale, getypte API an den
 * Renderer. Der Renderer erhält niemals direkten Zugriff auf Node, Electron
 * oder das Dateisystem. Jede IPC-Antwort wird an dieser Vertrauensgrenze mit
 * zod validiert, bevor sie den Renderer erreicht.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannel } from '../main/ipc/channels';
import { pingResponseSchema } from '../shared/schema';
import type { VoiceWallBridge } from '../shared/types';

const bridge: VoiceWallBridge = {
  ping: async () => pingResponseSchema.parse(await ipcRenderer.invoke(IpcChannel.Ping)),
};

contextBridge.exposeInMainWorld('voicewall', bridge);
