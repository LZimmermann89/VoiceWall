/**
 * React-Root des Hauptfensters: minimale, funktionale Test-UI fuer den
 * STT-Kern (M2). Bewusst schlicht und ohne Design-Ambition, das Design folgt
 * in M6/M7. Genau eine sichtbare H1.
 *
 * Enthaelt: Status (Modell/Engine/Einwilligung), Consent-Bestaetigung,
 * Modell-Download mit Fortschritt, Start/Stop der Testaufnahme, Pegelanzeige
 * (RMS), Transkript-Ausgabe und Fehleranzeige.
 */
import { StrictMode, useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { AppStatus, ModelProgress, TranscriptPayload } from '../shared/schema';
import './styles.css';

interface TranscriptLine {
  readonly text: string;
  readonly durationMs: number;
  readonly audioMs: number;
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Deutsche Anzeige des Diktat-Flow-Zustands. */
const FLOW_STATE_LABELS: Record<string, string> = {
  idle: 'bereit',
  recording: 'Aufnahme laeuft',
  transcribing: 'transkribiert',
  delivering: 'fuegt Text ein',
};

function App(): ReactElement {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [progress, setProgress] = useState<ModelProgress | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([]);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hotkeyInput, setHotkeyInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const levelDecay = useRef<number | null>(null);

  const refreshStatus = useCallback(async () => {
    setStatus(await window.voicewall.getStatus());
  }, []);

  useEffect(() => {
    void refreshStatus();
    const offStatus = window.voicewall.onStatus(setStatus);
    const offProgress = window.voicewall.onModelProgress(setProgress);
    const offTranscript = window.voicewall.onTranscript((payload: TranscriptPayload) => {
      setTranscripts((previous) => [
        ...previous,
        { text: payload.text, durationMs: payload.durationMs, audioMs: payload.audioMs },
      ]);
    });
    const offLevel = window.voicewall.onAudioLevel(({ rms }) => {
      setLevel(rms);
    });
    const offError = window.voicewall.onError(setError);
    return () => {
      offStatus();
      offProgress();
      offTranscript();
      offLevel();
      offError();
    };
  }, [refreshStatus]);

  // Pegel langsam abklingen lassen, damit die Anzeige nicht springt.
  useEffect(() => {
    levelDecay.current = window.setInterval(() => {
      setLevel((current) => (current > 0.001 ? current * 0.8 : 0));
    }, 150);
    return () => {
      if (levelDecay.current !== null) {
        window.clearInterval(levelDecay.current);
      }
    };
  }, []);

  const runAction = useCallback(
    async (action: () => Promise<{ ok: boolean; message?: string }>) => {
      setBusy(true);
      setError(null);
      try {
        const result = await action();
        if (!result.ok && result.message !== undefined) {
          setError(result.message);
        }
      } finally {
        setBusy(false);
        await refreshStatus();
      }
    },
    [refreshStatus],
  );

  const modelsReady = status?.modelsReady ?? false;
  const engineReady = status?.engineReady ?? false;
  const dictationActive = status?.dictationActive ?? false;
  const hotkey = status?.hotkey ?? null;
  const accessibility = status?.accessibility ?? 'not-applicable';
  const lastTranscript = status?.lastTranscript ?? null;
  const clipboardRestoreEnabled = status?.clipboardRestoreEnabled ?? true;
  const flowState = status?.flowState ?? 'idle';

  return (
    <main>
      <h1>VoiceWall</h1>
      <p className="subtitle">STT-Kern Testkonsole (M2). Alles laeuft lokal, kein Netzwerk.</p>

      <section aria-label="Status">
        <h2>Status</h2>
        <ul className="status-list">
          <li>
            Einwilligung: <strong>{status?.consentGranted ? 'erteilt' : 'ausstehend'}</strong>
          </li>
          <li>
            Mikrofon (OS): <strong>{status?.microphoneState ?? 'unbekannt'}</strong>
          </li>
          <li>
            Modelle:{' '}
            <strong>{modelsReady ? 'vorhanden und verifiziert' : 'nicht vollstaendig'}</strong>
          </li>
          <li>
            Engine: <strong>{engineReady ? 'bereit' : 'nicht gestartet'}</strong>
          </li>
        </ul>
        {status?.models.map((model) => (
          <p key={model.id} className="model-line">
            {model.label}: {model.present ? 'vorhanden' : 'fehlt'}
          </p>
        ))}
      </section>

      {progress !== null && !modelsReady && (
        <section aria-label="Download-Fortschritt">
          <h2>Modell-Download</h2>
          <p>
            {progress.label}: {formatBytes(progress.receivedBytes)}
            {progress.totalBytes !== null ? ` von ${formatBytes(progress.totalBytes)}` : ''}
            {progress.percent !== null ? ` (${progress.percent.toFixed(0)} %)` : ''}
          </p>
          <progress max={100} value={progress.percent ?? 0} />
        </section>
      )}

      <section aria-label="Aktionen">
        <h2>Aktionen</h2>
        <div className="actions">
          <button
            type="button"
            disabled={busy || (status?.consentGranted ?? false)}
            onClick={() => void runAction(() => window.voicewall.grantConsent())}
          >
            Mikrofon-Einwilligung erteilen
          </button>
          <button
            type="button"
            disabled={busy || !(status?.consentGranted ?? false) || modelsReady}
            onClick={() => void runAction(() => window.voicewall.prepareModels())}
          >
            Modelle laden und Engine starten
          </button>
          <button
            type="button"
            disabled={busy || !engineReady || dictationActive}
            onClick={() => void runAction(() => window.voicewall.startDictation())}
          >
            Testaufnahme starten
          </button>
          <button
            type="button"
            disabled={busy || !dictationActive}
            onClick={() => void runAction(() => window.voicewall.stopDictation())}
          >
            Testaufnahme stoppen
          </button>
        </div>
        <p className="consent-hint">
          Ihre Sprache wird ausschliesslich lokal auf diesem Rechner verarbeitet. Es werden keine
          Audiodaten gespeichert oder an einen Server gesendet.
        </p>
      </section>

      <section aria-label="Systemweites Diktat">
        <h2>Systemweites Diktat</h2>
        <ul className="status-list">
          <li>
            Hotkey (Toggle):{' '}
            <strong data-testid="hotkey-current">{hotkey?.accelerator ?? 'unbekannt'}</strong>{' '}
            {hotkey !== null && !hotkey.registered && (
              <span className="warn-text" data-testid="hotkey-conflict">
                (nicht aktiv: Kombination ist bereits belegt, bitte unten eine andere waehlen)
              </span>
            )}
          </li>
          <li>
            Zustand:{' '}
            <strong data-testid="flow-state">{FLOW_STATE_LABELS[flowState] ?? flowState}</strong>
          </li>
        </ul>
        <div className="actions">
          <label htmlFor="hotkey-input">Neue Tastenkombination:</label>
          <input
            id="hotkey-input"
            type="text"
            value={hotkeyInput}
            placeholder="z. B. CommandOrControl+Shift+D"
            onChange={(event) => {
              setHotkeyInput(event.target.value);
            }}
          />
          <button
            type="button"
            disabled={busy || hotkeyInput.trim().length === 0}
            onClick={() => void runAction(() => window.voicewall.setHotkey(hotkeyInput.trim()))}
          >
            Hotkey uebernehmen
          </button>
        </div>
        <div className="actions">
          <label>
            <input
              type="checkbox"
              checked={clipboardRestoreEnabled}
              disabled={busy}
              onChange={(event) =>
                void runAction(() => window.voicewall.setClipboardRestore(event.target.checked))
              }
            />{' '}
            Zwischenablage nach dem Einfuegen wiederherstellen (Datenschutz, empfohlen)
          </label>
        </div>
        {accessibility === 'missing' && (
          <div className="accessibility-hint" data-testid="accessibility-hint">
            <p>
              Fuer das automatische Einfuegen braucht VoiceWall die macOS-Freigabe
              &quot;Bedienungshilfen&quot;. Ohne Freigabe bleibt der Text in der Zwischenablage
              (Cmd+V zum Einfuegen). So geht es: Knopf druecken, dann VoiceWall in der Liste
              aktivieren und das Diktat erneut ausfuehren. Was VoiceWall mit der Freigabe tut und
              was nicht, steht in docs/ACCESSIBILITY.md.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAction(() => window.voicewall.openAccessibilitySettings())}
            >
              Systemeinstellungen oeffnen
            </button>
          </div>
        )}
      </section>

      <section aria-label="Letztes Diktat">
        <h2>Letztes Diktat</h2>
        {lastTranscript === null ? (
          <p className="placeholder" data-testid="last-transcript-empty">
            Noch kein Diktat. Der Text des letzten Diktats bleibt hier abrufbar und geht nie
            verloren, auch wenn das automatische Einfuegen scheitert.
          </p>
        ) : (
          <div className="last-transcript" data-testid="last-transcript">
            <p className="transcript-text">{lastTranscript}</p>
            <button
              type="button"
              disabled={busy}
              data-testid="copy-last-transcript"
              onClick={() =>
                void runAction(async () => {
                  const result = await window.voicewall.copyLastTranscript();
                  if (result.ok) {
                    setNotice(
                      'Text wurde in die Zwischenablage kopiert (Cmd/Strg+V zum Einfuegen).',
                    );
                  }
                  return result;
                })
              }
            >
              Kopieren
            </button>
          </div>
        )}
        {notice !== null && <p className="notice">{notice}</p>}
      </section>

      <section aria-label="Pegel">
        <h2>Pegel</h2>
        <div className="level-track">
          <div
            className="level-fill"
            data-testid="level-fill"
            style={{ width: `${Math.min(100, level * 140).toFixed(0)}%` }}
          />
        </div>
      </section>

      <section aria-label="Transkript">
        <h2>Transkript</h2>
        {transcripts.length === 0 ? (
          <p className="placeholder" data-testid="transcript-empty">
            Noch kein Transkript.
          </p>
        ) : (
          <ol className="transcript-list" data-testid="transcript-list">
            {transcripts.map((line, index) => (
              <li key={`${String(index)}-${line.text}`}>
                <span className="transcript-text">{line.text}</span>
                <span className="transcript-meta">
                  {line.durationMs} ms fuer {(line.audioMs / 1000).toFixed(1)} s Audio
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {error !== null && (
        <section aria-label="Fehler" className="error-box" data-testid="error-box">
          <h2>Fehler</h2>
          <p>{error}</p>
        </section>
      )}
    </main>
  );
}

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Renderer-Bootstrap fehlgeschlagen: Element #root fehlt in index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
