/**
 * Übergangs-Hauptansicht (M6): Diktat-Status, Firmenverwaltung (minimal)
 * und letzte Diktate. Die volle Verwaltungs-UI folgt in M7 und haengt sich
 * als weitere Ansicht in die App-Shell ein.
 *
 * Aufbau wie ein nummeriertes Prüfprotokoll: Firma, Diktat, Ablage, Status,
 * Funktionsbeleg. Der Funktionsbeleg (Testaufnahme, Pegel, Transkripte) ist
 * zugleich das Vor-Ort-Demowerkzeug für den On-Site-Termin.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import type { CompanyListView, ManifestEntry } from '../../shared/company';
import type { AppStatus, ModelProgress, SystemInfo, TranscriptPayload } from '../../shared/schema';
import { FLOW_STATE_LABELS, formatAccelerator, formatBytes } from './format';

interface TranscriptLine {
  readonly text: string;
  readonly durationMs: number;
  readonly audioMs: number;
}

interface MainViewProps {
  readonly status: AppStatus | null;
  readonly companies: CompanyListView | null;
  readonly progress: ModelProgress | null;
  readonly systemInfo: SystemInfo | null;
  readonly onRefreshStatus: () => Promise<void>;
  readonly onRefreshCompanies: () => Promise<void>;
  readonly onAddCompany: () => void;
}

export function MainView(props: MainViewProps): ReactElement {
  const { status, companies, progress, systemInfo, onRefreshStatus, onRefreshCompanies } = props;

  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([]);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hotkeyInput, setHotkeyInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [companyNotice, setCompanyNotice] = useState<string | null>(null);
  const [dictates, setDictates] = useState<ManifestEntry[] | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const levelDecay = useRef<number | null>(null);

  const refreshDictates = useCallback(async (text: string) => {
    const trimmed = text.trim();
    const result = await window.voicewall.listDictates(
      trimmed.length === 0 ? {} : { text: trimmed },
    );
    if (result.ok) {
      setDictates(result.eintraege);
    } else {
      setDictates(null);
      setCompanyNotice(result.message);
    }
  }, []);

  useEffect(() => {
    void refreshDictates('');
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
  }, [refreshDictates]);

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
  const levelBucket = Math.min(20, Math.round(Math.min(1, level * 1.4) * 20));

  return (
    <main className="main-layout">
      {/* 01 Firma ------------------------------------------------------ */}
      <section className="main-section" aria-label="Firmen">
        <div className="section-head">
          <span className="section-no">01</span>
          <h2>Firma</h2>
        </div>
        {companies !== null && companies.firmen.length > 0 ? (
          <ul className="status-list" data-testid="company-list">
            {companies.firmen.map((firma) => (
              <li key={firma.pfad} className="company-bar">
                {firma.aktiv ? (
                  <span className="company-active">{firma.anzeigename} (aktiv)</span>
                ) : (
                  <>
                    <span>{firma.anzeigename}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void runAction(async () => {
                          const result = await window.voicewall.setActiveCompany(firma.pfad);
                          await onRefreshCompanies();
                          await refreshDictates(searchInput);
                          return result;
                        })
                      }
                    >
                      Aktivieren
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="placeholder" data-testid="company-list-empty">
            Noch keine Firma angelegt.
          </p>
        )}
        <div className="actions">
          <button type="button" onClick={props.onAddCompany} data-testid="add-company">
            Neue Firma einrichten
          </button>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={companies?.autoSpeichern ?? false}
              disabled={busy || (companies?.firmen.length ?? 0) === 0}
              data-testid="dictate-auto-save"
              onChange={(event) =>
                void runAction(async () => {
                  const result = await window.voicewall.setDictateAutoSave(event.target.checked);
                  await onRefreshCompanies();
                  return result;
                })
              }
            />{' '}
            Diktate automatisch in der aktiven Firma speichern
          </label>
        </div>
        {companyNotice !== null && (
          <p className="notice" data-testid="company-notice">
            {companyNotice}
          </p>
        )}
      </section>

      {/* 02 Diktat ------------------------------------------------------ */}
      <section className="main-section" aria-label="Systemweites Diktat">
        <div className="section-head">
          <span className="section-no">02</span>
          <h2>Systemweites Diktat</h2>
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
        <h3 className="visually-hidden">Letztes Diktat</h3>
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
                disabled={busy || (companies?.firmen.length ?? 0) === 0}
                data-testid="save-last-dictate"
                onClick={() =>
                  void runAction(async () => {
                    const result = await window.voicewall.saveLastDictate();
                    if (result.ok) {
                      setCompanyNotice(`Diktat gespeichert: ${result.pfad}`);
                      await refreshDictates(searchInput);
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

      {/* 03 Ablage ------------------------------------------------------ */}
      <section className="main-section" aria-label="Letzte Diktate">
        <div className="section-head">
          <span className="section-no">03</span>
          <h2>Letzte Diktate</h2>
        </div>
        <div className="actions">
          <label htmlFor="dictate-search-input">Durchsuchen:</label>
          <input
            id="dictate-search-input"
            type="text"
            value={searchInput}
            placeholder="Titel, Tag oder Textanfang"
            data-testid="dictate-search-input"
            onChange={(event) => {
              setSearchInput(event.target.value);
            }}
          />
          <button
            type="button"
            disabled={busy || (companies?.firmen.length ?? 0) === 0}
            data-testid="dictate-search-button"
            onClick={() => void refreshDictates(searchInput)}
          >
            Anzeigen
          </button>
        </div>
        {dictates !== null &&
          (dictates.length === 0 ? (
            <p className="placeholder" data-testid="dictate-list-empty">
              Keine Diktate gefunden.
            </p>
          ) : (
            <ol className="transcript-list" data-testid="dictate-list">
              {dictates.map((entry) => (
                <li key={entry.id}>
                  <span className="transcript-text">{entry.titel}</span>
                  <span className="transcript-meta">
                    {entry.erstellt} · {entry.wortzahl} Wörter · {entry.pfad}
                  </span>
                </li>
              ))}
            </ol>
          ))}
      </section>

      {/* 04 Status ------------------------------------------------------ */}
      <section className="main-section" aria-label="Status">
        <div className="section-head">
          <span className="section-no">04</span>
          <h2>Status</h2>
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

      {/* 05 Funktionsbeleg ---------------------------------------------- */}
      <section className="main-section" aria-label="Funktionsbeleg">
        <div className="section-head">
          <span className="section-no">05</span>
          <h2>Funktionsbeleg (Testaufnahme)</h2>
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
          <h2>Fehler</h2>
          <p>{error}</p>
        </section>
      )}
    </main>
  );
}
