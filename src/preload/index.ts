/**
 * Preload des Hauptfensters: exponiert über die contextBridge eine schmale,
 * getypte API an den Renderer. Der Renderer erhält niemals direkten Zugriff
 * auf Node, Electron oder das Dateisystem. Jede IPC-Antwort und jedes
 * eingehende Event wird an dieser Vertrauensgrenze mit zod validiert, bevor es
 * den Renderer erreicht.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IpcChannel } from '../main/ipc/channels';
import {
  companyListViewSchema,
  companyNamePreviewSchema,
  createCompanyResultSchema,
  dictateListResultSchema,
  saveDictateResultSchema,
  syncCheckViewSchema,
} from '../shared/company';
import {
  actionResultSchema,
  appStatusSchema,
  audioLevelSchema,
  deliveryResultSchema,
  modelProgressSchema,
  pingResponseSchema,
  transcriptPayloadSchema,
} from '../shared/schema';
import type { Unsubscribe, VoiceWallBridge } from '../shared/types';

/** Meldet einen validierenden Listener an einen Main-zu-Renderer-Kanal an. */
function subscribe<T>(
  channel: string,
  parse: (raw: unknown) => T,
  listener: (value: T) => void,
): Unsubscribe {
  const handler = (_event: IpcRendererEvent, payload: unknown): void => {
    listener(parse(payload));
  };
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const bridge: VoiceWallBridge = {
  ping: async () => pingResponseSchema.parse(await ipcRenderer.invoke(IpcChannel.Ping)),
  getStatus: async () => appStatusSchema.parse(await ipcRenderer.invoke(IpcChannel.GetStatus)),
  grantConsent: async () =>
    actionResultSchema.parse(await ipcRenderer.invoke(IpcChannel.GrantConsent)),
  prepareModels: async () =>
    actionResultSchema.parse(await ipcRenderer.invoke(IpcChannel.PrepareModels)),
  startDictation: async () =>
    actionResultSchema.parse(await ipcRenderer.invoke(IpcChannel.StartDictation)),
  stopDictation: async () =>
    actionResultSchema.parse(await ipcRenderer.invoke(IpcChannel.StopDictation)),
  onStatus: (listener) =>
    subscribe(IpcChannel.StatusChanged, (raw) => appStatusSchema.parse(raw), listener),
  onModelProgress: (listener) =>
    subscribe(IpcChannel.ModelProgress, (raw) => modelProgressSchema.parse(raw), listener),
  onTranscript: (listener) =>
    subscribe(IpcChannel.TranscriptNew, (raw) => transcriptPayloadSchema.parse(raw), listener),
  onAudioLevel: (listener) =>
    subscribe(IpcChannel.AudioLevel, (raw) => audioLevelSchema.parse(raw), listener),
  onError: (listener) =>
    subscribe(
      IpcChannel.DictationError,
      (raw): string => {
        // Fehlermeldungen kommen als reiner String ueber den Kanal.
        return typeof raw === 'string' ? raw : String(raw);
      },
      listener,
    ),
  setHotkey: async (accelerator) =>
    actionResultSchema.parse(await ipcRenderer.invoke(IpcChannel.SetHotkey, accelerator)),
  setClipboardRestore: async (enabled) =>
    actionResultSchema.parse(await ipcRenderer.invoke(IpcChannel.SetClipboardRestore, enabled)),
  copyLastTranscript: async () =>
    actionResultSchema.parse(await ipcRenderer.invoke(IpcChannel.CopyLastTranscript)),
  openAccessibilitySettings: async () =>
    actionResultSchema.parse(await ipcRenderer.invoke(IpcChannel.OpenAccessibilitySettings)),
  listCompanies: async () =>
    companyListViewSchema.parse(await ipcRenderer.invoke(IpcChannel.CompanyList)),
  previewCompanyName: async (name) =>
    companyNamePreviewSchema.parse(await ipcRenderer.invoke(IpcChannel.CompanyPreviewName, name)),
  createCompany: async (name, strategie) =>
    createCompanyResultSchema.parse(
      await ipcRenderer.invoke(IpcChannel.CompanyCreate, { name, strategie }),
    ),
  setActiveCompany: async (pfad) =>
    actionResultSchema.parse(await ipcRenderer.invoke(IpcChannel.CompanySetActive, pfad)),
  checkDesktopSync: async () =>
    syncCheckViewSchema.parse(await ipcRenderer.invoke(IpcChannel.CompanyCheckSync)),
  saveLastDictate: async () =>
    saveDictateResultSchema.parse(await ipcRenderer.invoke(IpcChannel.DictateSaveLast)),
  listDictates: async (filter) =>
    dictateListResultSchema.parse(await ipcRenderer.invoke(IpcChannel.DictateList, filter)),
  setDictateAutoSave: async (enabled) =>
    actionResultSchema.parse(await ipcRenderer.invoke(IpcChannel.SetDictateAutoSave, enabled)),
  devInjectPcm: async (pcm) => {
    try {
      return actionResultSchema.parse(await ipcRenderer.invoke(IpcChannel.DevInjectPcm, pcm));
    } catch (error) {
      return {
        ok: false,
        message: `PCM-Injektion nicht verfuegbar: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
  devMockPaste: async (enabled) => {
    try {
      return actionResultSchema.parse(await ipcRenderer.invoke(IpcChannel.DevMockPaste, enabled));
    } catch (error) {
      return { ok: false, message: toDevErrorMessage(error) };
    }
  },
  devGetPasteCalls: async () => {
    const raw: unknown = await ipcRenderer.invoke(IpcChannel.DevGetPasteCalls);
    return typeof raw === 'number' ? raw : -1;
  },
  devSetAccessibility: async (trusted) => {
    try {
      return actionResultSchema.parse(
        await ipcRenderer.invoke(IpcChannel.DevSetAccessibility, trusted),
      );
    } catch (error) {
      return { ok: false, message: toDevErrorMessage(error) };
    }
  },
  devRunDictationResult: async (text) =>
    deliveryResultSchema.parse(await ipcRenderer.invoke(IpcChannel.DevRunDictationResult, text)),
};

/** Deutsche Fehlermeldung fuer nicht verfuegbare Dev-/Test-Kanaele. */
function toDevErrorMessage(error: unknown): string {
  return `Dev-/Test-Kanal nicht verfuegbar: ${error instanceof Error ? error.message : String(error)}`;
}

contextBridge.exposeInMainWorld('voicewall', bridge);
