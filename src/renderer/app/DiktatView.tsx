/**
 * Ansicht "Diktat" (M7): der operative Kopfbereich der Verwaltung. Buendelt
 * die bisherige Hauptansicht-Funktionalitaet (Aufnahme-Status, letztes Diktat
 * mit Kopieren-Knopf, Hotkey-Anzeige und -Aenderung, Zwischenablage-Schalter,
 * Testaufnahme als Funktionsbeleg) als eigene Ansicht neben dem Register.
 *
 * Aufbau wie ein nummeriertes Pruefprotokoll (Diktat, Status, Funktionsbeleg).
 * Genau eine sichtbare H1 traegt die App-Shell; hier nur H2/H3.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import type { CompanyListView } from '../../shared/company';
import type { AppStatus, ModelProgress, SystemInfo, TranscriptPayload } from '../../shared/schema';
import { FLOW_STATE_LABELS, formatAccelerator, formatBytes } from './format';

interface TranscriptLine {
  readonly text: string;
  readonly durationMs: number;
  readonly audioMs: number;
}

interface DiktatViewProps {
  readonly status: AppStatus | null;
  readonly companies: CompanyListView | null;
  readonly progress: ModelProgress | null;
  readonly systemInfo: SystemInfo | null;
  readonly onRefreshStatus: () => Promise<void>;
  readonly onRefreshCompanies: () => Promise<void>;
}

export function DiktatView(props: DiktatViewProps): ReactElement {
  const { status, companies, progress, systemInfo, onRefreshStatus, onRefreshCompanies } = props;

  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([]);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hotkeyInput, setHotkeyInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const levelDecay = useRef<number | null>(null);

  useEffect(() => {
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
      offTranscript();
      offLevel();
      offError();
    };
  }, []);

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
        await onRefreshStatus();
      }
    },
    [onRefreshStatus],
  );

  const modelsReady = status?.modelsReady ?? false;
  const engineReady = status?.engineReady ?? false;
  const dictationActive = status?.dictationActive ?? false;
  const hotkey = status?.hotkey ?? null;
  const accessibility = status?.accessibility ?? 'not-applicable';
  const lastTranscript = status?.lastTranscript ?? null;
  const clipboardRestoreEnabled = status?.clipboardRestoreEnabled ?? true;
  const flowState = status?.flowState ?? 'idle';
  const platform = systemInfo?.platform ?? 'darwin';
  const hasCompany = (companies?.firmen.length ?? 0) > 0;
  const levelBucket = Math.min(20, Math.round(Math.min(1, level * 1.4) * 20));

  return (
    <div className="view-body">
      <h2 className="view-title" tabIndex={-1}>
        Diktat
      </h2>
      <p className="lede">
        Der operative Bereich: systemweites Diktat per Tastenkürzel, das letzte Ergebnis mit
        Kopieren-Knopf und eine Testaufnahme als Funktionsbeleg für den Vor-Ort-Termin.
      </p>

      {/* 01 Systemweites Diktat ---------------------------------------- */}
      <section className="main-section" aria-label="Systemweites Diktat">
        <div className="section-head">
          <span className="section-no">01</span>
          <h3>Systemweites Diktat</h3>
        </div>
        <ul className="status-list">
          <li>
            Tastenkürzel (Toggle):{' '}
            <strong className="mono" data-testid="hotkey-current">
              {hotkey?.accelerator ?? 'unbekannt'}
            </strong>{' '}
            {hotkey !== null && (
              <span className="notice">
                ({formatAccelerator(hotkey.accelerator, platform)}
                {') '}
              </span>
            )}
            {hotkey !== null && !hotkey.registered && (
              <span className="warn-text" data-testid="hotkey-conflict">
                (nicht aktiv: Kombination ist bereits belegt, bitte eine andere wählen)
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
            Hotkey übernehmen
          </button>
        </div>
        <div className="actions">
          <label className="switch-row">
            <input
              type="checkbox"
              checked={clipboardRestoreEnabled}
              disabled={busy}
              onChange={(event) =>
                void runAction(() => window.voicewall.setClipboardRestore(event.target.checked))
              }
            />{' '}
            Zwischenablage nach dem Einfügen wiederherstellen (Datenschutz, empfohlen)
          </label>
        </div>
        {accessibility === 'missing' && (
          <div className="accessibility-hint" data-testid="accessibility-hint">
            <p>
              Für das automatische Einfügen braucht VoiceWall die macOS-Freigabe
              &quot;Bedienungshilfen&quot;. Ohne Freigabe bleibt der Text in der Zwischenablage
              (Cmd+V zum Einfügen). So geht es: Knopf drücken, dann VoiceWall in der Liste
              aktivieren und das Diktat erneut ausführen. Was VoiceWall mit der Freigabe tut und was
              nicht, steht in docs/ACCESSIBILITY.md.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAction(() => window.voicewall.openAccessibilitySettings())}
            >
              Systemeinstellungen öffnen
            </button>
          </div>
        )}
        <h4 className="visually-hidden">Letztes Diktat</h4>
        {lastTranscript === null ? (
          <p className="placeholder" data-testid="last-transcript-empty">
            Noch kein Diktat. Der Text des letzten Diktats bleibt hier abrufbar und geht nie
            verloren, auch wenn das automatische Einfügen scheitert.
          </p>
        ) : (
          <div className="last-transcript" data-testid="last-transcript">
            <p className="transcript-text">{lastTranscript}</p>
            <div className="actions">
              <button
                type="button"
                disabled={busy}
                data-testid="copy-last-transcript"
                onClick={() =>
                  void runAction(async () => {
                    const result = await window.voicewall.copyLastTranscript();
                    if (result.ok) {
                      setNotice(
                        'Text wurde in die Zwischenablage kopiert (Cmd/Strg+V zum Einfügen).',
                      );
                    }
                    return result;
                  })
                }
              >
                Kopieren
              </button>
              <button
                type="button"
                disabled={busy || !hasCompany}
                data-testid="save-last-dictate"
                onClick={() =>
                  void runAction(async () => {
                    const result = await window.voicewall.saveLastDictate();
                    if (result.ok) {
                      setNotice(`Diktat gespeichert: ${result.pfad}`);
                      await onRefreshCompanies();
                      return { ok: true as const };
                    }
                    return result;
                  })
                }
              >
                Als Diktat speichern
              </button>
            </div>
          </div>
        )}
        {notice !== null && <p className="notice">{notice}</p>}
      </section>

      {/* 02 Status ----------------------------------------------------- */}
      <section className="main-section" aria-label="Status">
        <div className="section-head">
          <span className="section-no">02</span>
          <h3>Status</h3>
        </div>
        <ul className="status-list">
          <li>
            Einwilligung: <strong>{status?.consentGranted ? 'erteilt' : 'ausstehend'}</strong>
          </li>
          <li>
            Mikrofon (OS): <strong>{status?.microphoneState ?? 'unbekannt'}</strong>
          </li>
          <li>
            Modelle:{' '}
            <strong>{modelsReady ? 'vorhanden und verifiziert' : 'nicht vollständig'}</strong>
          </li>
          <li>
            Engine: <strong>{engineReady ? 'bereit' : 'nicht gestartet'}</strong>
          </li>
        </ul>
        {status?.models.map((model) => (
          <p key={model.id} className="model-line">
            {model.label}: {model.present ? 'vorhanden' : `fehlt (${formatBytes(model.byteSize)})`}
          </p>
        ))}
        {progress !== null && !modelsReady && (
          <div aria-live="polite">
            <progress max={100} value={progress.percent ?? 0} aria-label="Modell-Download" />
            <p className="progress-line">
              {progress.label}: {formatBytes(progress.receivedBytes)}
              {progress.totalBytes !== null ? ` von ${formatBytes(progress.totalBytes)}` : ''}
              {progress.percent !== null ? ` (${progress.percent.toFixed(0)} %)` : ''}
            </p>
          </div>
        )}
      </section>

      {/* 03 Funktionsbeleg --------------------------------------------- */}
      <section className="main-section" aria-label="Funktionsbeleg">
        <div className="section-head">
          <span className="section-no">03</span>
          <h3>Funktionsbeleg (Testaufnahme)</h3>
        </div>
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
        <p className="notice">
          Ihre Sprache wird ausschließlich lokal auf diesem Rechner verarbeitet. Es werden keine
          Audiodaten gespeichert oder an einen Server gesendet.
        </p>
        <div className="level-track" aria-hidden="true">
          <div className={`level-fill lvl-${String(levelBucket)}`} data-testid="level-fill" />
        </div>
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
                  {line.durationMs} ms für {(line.audioMs / 1000).toFixed(1)} s Audio
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {error !== null && (
        <section aria-label="Fehler" className="error-box" data-testid="error-box">
          <h3>Fehler</h3>
          <p>{error}</p>
        </section>
      )}
    </div>
  );
}
