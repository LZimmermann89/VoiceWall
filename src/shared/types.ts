/**
 * Domänen- und Brückentypen, die Main, Preload und Renderer gemeinsam nutzen.
 * Dieses Modul darf weder Node- noch DOM-APIs verwenden.
 */
import type {
  ActionResult,
  AppStatus,
  AudioLevel,
  ModelProgress,
  PingResponse,
  TranscriptPayload,
} from './schema';

/** Funktion zum Abmelden eines Event-Listeners. */
export type Unsubscribe = () => void;

/**
 * Die schmale, getypte API, die der Preload über die contextBridge als
 * `window.voicewall` in den Renderer (Hauptfenster) exponiert.
 */
export interface VoiceWallBridge {
  /** Erreichbarkeitstest der IPC-Brücke: liefert validiert `pong`. */
  readonly ping: () => Promise<PingResponse>;
  /** Aktuellen Gesamtstatus abfragen. */
  readonly getStatus: () => Promise<AppStatus>;
  /** Informierte Mikrofon-Einwilligung erteilen (mit Zeitstempel gespeichert). */
  readonly grantConsent: () => Promise<ActionResult>;
  /** Fehlende Modelle laden (einmaliger Download) und Engine starten. */
  readonly prepareModels: () => Promise<ActionResult>;
  /** Testaufnahme starten (oeffnet das versteckte Capture-Fenster). */
  readonly startDictation: () => Promise<ActionResult>;
  /** Testaufnahme stoppen und letztes Segment verarbeiten. */
  readonly stopDictation: () => Promise<ActionResult>;
  /** Abonniert Statusaenderungen. */
  readonly onStatus: (listener: (status: AppStatus) => void) => Unsubscribe;
  /** Abonniert Modell-Download-Fortschritt. */
  readonly onModelProgress: (listener: (progress: ModelProgress) => void) => Unsubscribe;
  /** Abonniert neue Transkript-Segmente. */
  readonly onTranscript: (listener: (transcript: TranscriptPayload) => void) => Unsubscribe;
  /** Abonniert Pegelaenderungen (RMS). */
  readonly onAudioLevel: (listener: (level: AudioLevel) => void) => Unsubscribe;
  /** Abonniert deutsche Fehlermeldungen. */
  readonly onError: (listener: (message: string) => void) => Unsubscribe;
  /**
   * Nur Dev/Test: injiziert ein vollstaendiges PCM-Segment direkt in die
   * Engine (deterministischer Beweis ohne echtes Mikrofon). Ohne aktiven
   * Test-IPC-Kanal im Main-Prozess schlaegt der Aufruf kontrolliert fehl.
   */
  readonly devInjectPcm: (pcm: ArrayBuffer) => Promise<ActionResult>;
}

/**
 * API des versteckten Audio-Capture-Fensters. Reicht rohes PCM und Fehler an
 * den Main-Prozess und empfaengt Start-/Stop-Kommandos.
 */
export interface VoiceWallCaptureBridge {
  /** Sendet einen 16-bit-PCM-Chunk (ArrayBuffer, transferiert) an den Main. */
  readonly sendPcm: (pcm: ArrayBuffer) => void;
  /** Meldet einen Capture-Fehler (deutsche Meldung) an den Main. */
  readonly reportError: (message: string) => void;
  /** Meldet, dass die Aufnahme im Fenster tatsaechlich laeuft. */
  readonly reportStarted: () => void;
  /** Abonniert das Start-Kommando vom Main-Prozess. */
  readonly onStart: (listener: () => void) => Unsubscribe;
  /** Abonniert das Stop-Kommando vom Main-Prozess. */
  readonly onStop: (listener: () => void) => Unsubscribe;
}
