/**
 * FlowController des systemweiten Diktats (M3).
 *
 * Verdrahtet den kompletten Pfad: globaler Hotkey (Toggle) -> Aufnahme
 * (Overlay "Ich hoere zu", Tray-Indikator) -> Hotkey -> VAD/Whisper-Flush ->
 * minimale Nachbearbeitung (trim/join) -> Clipboard-Sequenz ->
 * Accessibility-Check -> Auto-Paste -> Wiederherstellung der Zwischenablage.
 *
 * Grundsaetze:
 * - Der Fokus der Fremd-App wird nie angefasst (Overlay focusable:false,
 *   showInactive; das Hauptfenster wird vom Flow nie geoeffnet/fokussiert).
 * - Kein Text geht verloren: das letzte Transkript bleibt im RAM und ist
 *   jederzeit ueber Kopieren-Knopf (UI und Overlay) erneut kopierbar.
 * - Kein Fehlerpfad loest einen externen Request aus; alle Meldungen sind
 *   deutsch und nennen den naechsten Schritt.
 * - Die Zustandslogik selbst ist die reine Maschine in
 *   shared/dictation-flow.ts (unit-getestet); hier leben nur Seiteneffekte.
 */
import { BrowserWindow, clipboard, globalShortcut, ipcMain, powerMonitor } from 'electron';
import { z } from 'zod';
import {
  defaultGlobalConfig,
  hotkeyAcceleratorSchema,
  type GlobalConfig,
} from '../../shared/config';
import {
  joinTranscriptSegments,
  transitionDictationFlow,
  type DictationFlowAction,
  type DictationFlowEvent,
  type DictationFlowState,
} from '../../shared/dictation-flow';
import type { ActionResult, DeliveryResult } from '../../shared/schema';
import type { OverlayStatePayload } from '../../shared/types';
import type { Result } from '../../shared/result';
import { runClipboardSequence, realDelay } from '../clipboard/transcript-clipboard';
import { readGlobalConfig, writeGlobalConfig } from '../config/config-store';
import { IpcChannel } from '../ipc/channels';
import type { Logger } from '../log/logger';
import { createOverlayWindow, showOverlayInactive } from '../overlay/overlay-window';
import { createPasteAdapter, type PasteAdapter } from '../paste/index';
import {
  ACCESSIBILITY_MISSING_MESSAGE,
  getAccessibilityState,
  openAccessibilitySettings,
} from '../permission/accessibility';
import type { DictationOrchestrator, FlowStatus } from '../stt/orchestrator';
import { createTrayController, type TrayController } from '../tray/tray';

export interface FlowControllerDeps {
  readonly userDataPath: string;
  readonly logger: Logger;
  readonly orchestrator: DictationOrchestrator;
  /** Hauptfenster oeffnen/in den Vordergrund holen (Tray-Menue). */
  readonly openMainWindow: () => void;
  /** App beenden (Tray-Menue). */
  readonly quitApp: () => void;
  /** Aktiviert die Dev-/Test-IPC-Kanaele (nie im ausgelieferten Produkt). */
  readonly enableTestIpc: boolean;
}

/** Sichtbarkeitsdauer des Overlays nach Abschluss (done/no-speech). */
const OVERLAY_DONE_VISIBLE_MS = 4000;
/** Sichtbarkeitsdauer des Overlays nach Fehlern (mehr Lesezeit). */
const OVERLAY_ERROR_VISIBLE_MS = 10_000;

export class DictationFlowController {
  private state: DictationFlowState = 'idle';
  private config: GlobalConfig = defaultGlobalConfig();
  private hotkeyRegistered = false;
  private lastTranscript: string | null = null;
  private sessionSegments: string[] = [];

  private overlay: BrowserWindow | null = null;
  private overlayHideTimer: NodeJS.Timeout | null = null;
  private tray: TrayController | null = null;

  private pasteAdapter: PasteAdapter | null = null;
  private pasteUnsupportedMessage: string | null = null;

  // Dev-/Test-Steuerung (nur ueber Test-IPC erreichbar).
  private mockPasteEnabled = false;
  private mockPasteCalls = 0;
  private accessibilityOverride: boolean | null = null;

  constructor(private readonly deps: FlowControllerDeps) {}

  /** Initialisiert Konfig, Hotkey, Tray, Overlay, IPC und powerMonitor. */
  async init(): Promise<void> {
    this.config = await readGlobalConfig(this.deps.userDataPath, this.deps.logger);

    const adapter = createPasteAdapter(process.platform);
    if (adapter.ok) {
      this.pasteAdapter = adapter.value;
    } else {
      this.pasteUnsupportedMessage = adapter.error;
      this.deps.logger.warn(adapter.error);
    }

    this.deps.orchestrator.setTranscriptListener((text) => {
      // Nur Segmente der laufenden Hotkey-Sitzung sammeln; die Test-UI
      // (Start-/Stop-Knoepfe) liefert weiterhin direkt ins Hauptfenster.
      if (this.state === 'recording' || this.state === 'transcribing') {
        this.sessionSegments.push(text);
      }
    });
    this.deps.orchestrator.setFlowStatusProvider(() => this.flowStatus());

    this.registerIpcHandlers();
    this.registerHotkey(this.config.hotkey.accelerator);

    this.tray = createTrayController({
      onToggleDictation: () => {
        this.toggle();
      },
      onOpenWindow: this.deps.openMainWindow,
      onQuit: this.deps.quitApp,
    });

    // Overlay sofort (versteckt) erzeugen: die Fokus-Flags sind damit ab
    // App-Start pruefbar und der erste Hotkey-Druck zeigt es ohne Ladepause.
    this.overlay = createOverlayWindow();

    // Sperrbildschirm/Suspend: laufende Aufnahme sauber beenden und
    // verwerfen (nicht transkribieren, nicht in den Sperrbildschirm pasten).
    powerMonitor.on('lock-screen', () => {
      this.cancel('Sperrbildschirm');
    });
    powerMonitor.on('suspend', () => {
      this.cancel('Ruhezustand');
    });

    if (this.deps.enableTestIpc) {
      this.registerTestIpcHandlers();
    }
  }

  /** Diktat-Toggle (Hotkey oder Tray-Menue). */
  toggle(): void {
    this.dispatch('toggle');
  }

  /** Aufnahme von aussen abbrechen (Sperrbildschirm, Suspend). */
  cancel(reason: string): void {
    if (this.state === 'recording' || this.state === 'transcribing') {
      this.deps.logger.info(`Diktat abgebrochen (${reason}), Audio wird verworfen.`);
    }
    this.dispatch('cancel');
  }

  /** Geordnetes Herunterfahren (Hotkey frei, Tray/Overlay weg). */
  shutdown(): void {
    globalShortcut.unregisterAll();
    this.hotkeyRegistered = false;
    this.clearOverlayHideTimer();
    if (this.overlay !== null && !this.overlay.isDestroyed()) {
      this.overlay.destroy();
      this.overlay = null;
    }
    this.tray?.destroy();
    this.tray = null;
  }

  // ---------------------------------------------------------------------
  // Zustandsmaschine: Events -> Aktionen
  // ---------------------------------------------------------------------

  private dispatch(event: DictationFlowEvent): void {
    const { next, action } = transitionDictationFlow(this.state, event);
    if (next !== this.state) {
      this.deps.logger.debug(`Diktat-Flow: ${this.state} -> ${next} (${event}/${action})`);
    }
    this.state = next;
    this.runAction(action);
    this.deps.orchestrator.notifyStatusChanged();
  }

  private runAction(action: DictationFlowAction): void {
    switch (action) {
      case 'start-recording':
        void this.startRecording();
        return;
      case 'stop-and-flush':
        void this.stopAndFlush();
        return;
      case 'deliver':
        void this.deliverSession();
        return;
      case 'abort-recording':
        void this.abortRecording();
        return;
      case 'none':
        return;
    }
  }

  private async startRecording(): Promise<void> {
    this.sessionSegments = [];
    const started = await this.deps.orchestrator.startDictation();
    if (!started.ok) {
      // Aufnahme kam nicht zustande: zurueck nach idle, Meldung anzeigen.
      this.state = 'idle';
      this.showOverlay({ kind: 'error', message: started.message }, OVERLAY_ERROR_VISIBLE_MS);
      this.deps.orchestrator.notifyStatusChanged();
      return;
    }
    this.tray?.setRecording(true);
    this.showOverlay({ kind: 'recording', message: null }, null);
  }

  private async stopAndFlush(): Promise<void> {
    this.tray?.setRecording(false);
    this.showOverlay({ kind: 'transcribing', message: null }, null);
    await this.deps.orchestrator.stopDictationAndFlush();
    this.dispatch('flush-complete');
  }

  private async abortRecording(): Promise<void> {
    this.tray?.setRecording(false);
    this.sessionSegments = [];
    this.hideOverlay();
    await this.deps.orchestrator.abortDictation();
  }

  private async deliverSession(): Promise<void> {
    const text = joinTranscriptSegments(this.sessionSegments);
    this.sessionSegments = [];
    if (text.length === 0) {
      this.showOverlay({ kind: 'no-speech', message: null }, OVERLAY_DONE_VISIBLE_MS);
      this.dispatch('delivery-complete');
      return;
    }
    const result = await this.deliverText(text);
    if (result.pasted) {
      this.showOverlay(
        { kind: 'done', message: 'Text eingefuegt (und in der Zwischenablage).' },
        OVERLAY_DONE_VISIBLE_MS,
      );
    } else {
      this.showOverlay(
        { kind: 'error', message: result.message ?? 'Text liegt in der Zwischenablage.' },
        OVERLAY_ERROR_VISIBLE_MS,
      );
    }
    this.dispatch('delivery-complete');
  }

  // ---------------------------------------------------------------------
  // Zustellung: Clipboard-Sequenz + Accessibility-Check + Auto-Paste
  // ---------------------------------------------------------------------

  /**
   * Stellt einen Text zu. Der Text bleibt unabhaengig vom Ergebnis als
   * lastTranscript im RAM und in der Zwischenablage verfuegbar, wenn nicht
   * gepastet wurde (Resilienz-Primaerpfad).
   */
  private async deliverText(text: string): Promise<DeliveryResult> {
    this.lastTranscript = text;

    const paste = this.resolvePaste();
    const sequence = await runClipboardSequence(
      text,
      {
        restorePrevious: this.config.clipboard.restorePrevious,
        restoreDelayMs: this.config.clipboard.restoreDelayMs,
      },
      { clipboard, delay: realDelay, paste: paste.fn },
    );

    // Wiederherstellung laeuft im Hintergrund weiter; Ausgang nur loggen.
    void sequence.restore.then((outcome) => {
      this.deps.logger.debug(`Zwischenablage-Wiederherstellung: ${outcome}`);
    });

    let message: string | null = paste.blockedMessage;
    let pasted = false;
    if (sequence.pasteResult !== null) {
      if (sequence.pasteResult.ok) {
        pasted = true;
      } else {
        message = sequence.pasteResult.error;
      }
    }
    if (message !== null) {
      this.deps.orchestrator.reportFlowError(message);
    } else {
      this.deps.orchestrator.notifyStatusChanged();
    }
    return { delivered: true, pasted, message };
  }

  /**
   * Entscheidet den Paste-Weg VOR dem Versuch: Mock (Test), fehlende
   * macOS-Bedienungshilfen-Freigabe (kein osascript-Versuch, Hinweis mit
   * Deep-Link-Anleitung), nicht unterstuetzte Plattform oder echter Adapter.
   */
  private resolvePaste(): {
    fn: (() => Promise<Result<void, string>>) | null;
    blockedMessage: string | null;
  } {
    if (this.mockPasteEnabled) {
      return {
        fn: () => {
          this.mockPasteCalls += 1;
          return Promise.resolve({ ok: true as const, value: undefined });
        },
        blockedMessage: null,
      };
    }
    if (this.effectiveAccessibility() === 'missing') {
      return { fn: null, blockedMessage: ACCESSIBILITY_MISSING_MESSAGE };
    }
    if (this.pasteAdapter === null) {
      return { fn: null, blockedMessage: this.pasteUnsupportedMessage };
    }
    const adapter = this.pasteAdapter;
    return { fn: () => adapter.paste(), blockedMessage: null };
  }

  private effectiveAccessibility(): 'granted' | 'missing' | 'not-applicable' {
    if (this.accessibilityOverride !== null) {
      return this.accessibilityOverride ? 'granted' : 'missing';
    }
    return getAccessibilityState();
  }

  // ---------------------------------------------------------------------
  // Hotkey
  // ---------------------------------------------------------------------

  private registerHotkey(accelerator: string): boolean {
    let registered = false;
    try {
      registered = globalShortcut.register(accelerator, () => {
        this.toggle();
      });
    } catch (error) {
      this.deps.logger.error(
        `Hotkey-Registrierung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    this.hotkeyRegistered = registered;
    if (registered) {
      this.deps.logger.info(`Globaler Diktat-Hotkey registriert: ${accelerator}`);
    } else {
      this.deps.orchestrator.reportFlowError(
        `Die Tastenkombination ${accelerator} ist bereits von einer anderen App oder vom System belegt. Bitte im VoiceWall-Fenster unter "Systemweites Diktat" eine andere Kombination waehlen, z. B. CommandOrControl+Alt+D.`,
      );
    }
    return registered;
  }

  private async setHotkey(accelerator: string): Promise<ActionResult> {
    const parsed = hotkeyAcceleratorSchema.safeParse(accelerator);
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? 'Ungueltige Tastenkombination.',
      };
    }
    const previous = this.config.hotkey.accelerator;
    if (this.hotkeyRegistered) {
      globalShortcut.unregister(previous);
      this.hotkeyRegistered = false;
    }
    const registered = this.registerHotkey(parsed.data);
    if (!registered) {
      // Alte Kombination reaktivieren, damit das Diktat nicht hotkeylos wird.
      this.registerHotkey(previous);
      this.deps.orchestrator.notifyStatusChanged();
      return {
        ok: false,
        message: `Die Tastenkombination ${parsed.data} ist bereits systemweit belegt. Der bisherige Hotkey ${previous} bleibt aktiv. Bitte eine andere Kombination versuchen.`,
      };
    }
    this.config = {
      ...this.config,
      hotkey: { ...this.config.hotkey, accelerator: parsed.data },
    };
    await writeGlobalConfig(this.deps.userDataPath, this.config);
    this.deps.orchestrator.notifyStatusChanged();
    return { ok: true };
  }

  private async setClipboardRestore(enabled: boolean): Promise<ActionResult> {
    this.config = {
      ...this.config,
      clipboard: { ...this.config.clipboard, restorePrevious: enabled },
    };
    await writeGlobalConfig(this.deps.userDataPath, this.config);
    this.deps.orchestrator.notifyStatusChanged();
    return { ok: true };
  }

  // ---------------------------------------------------------------------
  // Resilienz: Kopieren-Knopf
  // ---------------------------------------------------------------------

  private copyLastTranscript(): ActionResult {
    if (this.lastTranscript === null) {
      return {
        ok: false,
        message: 'Es gibt noch kein Diktat. Bitte zuerst per Hotkey oder Testaufnahme diktieren.',
      };
    }
    clipboard.writeText(this.lastTranscript);
    return { ok: true };
  }

  // ---------------------------------------------------------------------
  // Overlay
  // ---------------------------------------------------------------------

  private showOverlay(state: OverlayStatePayload, hideAfterMs: number | null): void {
    this.clearOverlayHideTimer();
    const overlay = this.overlay;
    if (overlay === null || overlay.isDestroyed()) {
      return;
    }
    const sendState = (): void => {
      overlay.webContents.send(IpcChannel.OverlayState, state);
    };
    if (overlay.webContents.isLoading()) {
      overlay.webContents.once('did-finish-load', sendState);
    } else {
      sendState();
    }
    // Nie aktivierend zeigen: die Fremd-App behaelt den Fokus.
    showOverlayInactive(overlay);
    if (hideAfterMs !== null) {
      this.overlayHideTimer = setTimeout(() => {
        this.hideOverlay();
      }, hideAfterMs);
    }
  }

  private hideOverlay(): void {
    this.clearOverlayHideTimer();
    if (this.overlay !== null && !this.overlay.isDestroyed() && this.overlay.isVisible()) {
      this.overlay.hide();
    }
  }

  private clearOverlayHideTimer(): void {
    if (this.overlayHideTimer !== null) {
      clearTimeout(this.overlayHideTimer);
      this.overlayHideTimer = null;
    }
  }

  // ---------------------------------------------------------------------
  // Status + IPC
  // ---------------------------------------------------------------------

  private flowStatus(): FlowStatus {
    return {
      flowState: this.state,
      hotkey: {
        accelerator: this.config.hotkey.accelerator,
        registered: this.hotkeyRegistered,
      },
      accessibility: this.effectiveAccessibility(),
      lastTranscript: this.lastTranscript,
      clipboardRestoreEnabled: this.config.clipboard.restorePrevious,
    };
  }

  private registerIpcHandlers(): void {
    ipcMain.handle(IpcChannel.SetHotkey, async (_event, raw: unknown): Promise<ActionResult> => {
      const parsed = z.string().min(1).safeParse(raw);
      if (!parsed.success) {
        return { ok: false, message: 'Ungueltige Eingabe fuer die Tastenkombination.' };
      }
      return this.setHotkey(parsed.data);
    });

    ipcMain.handle(
      IpcChannel.SetClipboardRestore,
      async (_event, raw: unknown): Promise<ActionResult> => {
        const parsed = z.boolean().safeParse(raw);
        if (!parsed.success) {
          return { ok: false, message: 'Ungueltige Eingabe fuer den Zwischenablage-Schalter.' };
        }
        return this.setClipboardRestore(parsed.data);
      },
    );

    ipcMain.handle(IpcChannel.CopyLastTranscript, (): ActionResult => this.copyLastTranscript());

    ipcMain.handle(IpcChannel.OpenAccessibilitySettings, async (): Promise<ActionResult> => {
      const result = await openAccessibilitySettings();
      return result.ok ? { ok: true } : { ok: false, message: result.error };
    });

    // Kopieren-Knopf des Overlays (fire-and-forget).
    ipcMain.on(IpcChannel.OverlayCopyLast, () => {
      const result = this.copyLastTranscript();
      if (!result.ok) {
        this.deps.logger.warn(result.message);
      }
    });
  }

  /** Dev-/Test-IPC: Paste-Mock, Accessibility-Override, Flow-Trigger. */
  private registerTestIpcHandlers(): void {
    this.deps.logger.warn('Test-IPC-Kanaele des Diktat-Flows sind AKTIV (nur Dev/Test).');

    ipcMain.handle(IpcChannel.DevMockPaste, (_event, raw: unknown): ActionResult => {
      const parsed = z.boolean().safeParse(raw);
      if (!parsed.success) {
        return { ok: false, message: 'Ungueltige Eingabe fuer den Paste-Mock.' };
      }
      this.mockPasteEnabled = parsed.data;
      return { ok: true };
    });

    ipcMain.handle(IpcChannel.DevGetPasteCalls, (): number => this.mockPasteCalls);

    ipcMain.handle(IpcChannel.DevSetAccessibility, (_event, raw: unknown): ActionResult => {
      const parsed = z.boolean().nullable().safeParse(raw);
      if (!parsed.success) {
        return { ok: false, message: 'Ungueltige Eingabe fuer den Accessibility-Override.' };
      }
      this.accessibilityOverride = parsed.data;
      return { ok: true };
    });

    ipcMain.handle(
      IpcChannel.DevRunDictationResult,
      async (_event, raw: unknown): Promise<DeliveryResult> => {
        const parsed = z.string().min(1).safeParse(raw);
        if (!parsed.success) {
          return { delivered: false, pasted: false, message: 'Ungueltiger Text.' };
        }
        return this.deliverText(parsed.data);
      },
    );
  }
}
