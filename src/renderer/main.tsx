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
import type { CompanyListView, ManifestEntry } from '../shared/company';
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

  // Firmenverwaltung (M5, minimale Test-UI; die echte Verwaltung folgt in M7).
  const [companies, setCompanies] = useState<CompanyListView | null>(null);
  const [companyNameInput, setCompanyNameInput] = useState('');
  const [companyPreview, setCompanyPreview] = useState<string | null>(null);
  const [companyNotice, setCompanyNotice] = useState<string | null>(null);
  const [localStrategy, setLocalStrategy] = useState(false);
  const [dictates, setDictates] = useState<ManifestEntry[] | null>(null);
  const [searchInput, setSearchInput] = useState('');

  const refreshStatus = useCallback(async () => {
    setStatus(await window.voicewall.getStatus());
  }, []);

  const refreshCompanies = useCallback(async () => {
    setCompanies(await window.voicewall.listCompanies());
  }, []);

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
    void refreshStatus();
    void refreshCompanies();
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
  }, [refreshStatus, refreshCompanies]);

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

      <section aria-label="Firmen und Diktate">
        <h2>Firmen und Diktate</h2>
        <div className="actions">
          <label htmlFor="company-name-input">Neue Firma:</label>
          <input
            id="company-name-input"
            type="text"
            value={companyNameInput}
            placeholder="z. B. Müller & Söhne GmbH"
            data-testid="company-name-input"
            onChange={(event) => {
              setCompanyNameInput(event.target.value);
              setCompanyPreview(null);
            }}
          />
          <button
            type="button"
            disabled={busy || companyNameInput.trim().length === 0}
            data-testid="company-preview-button"
            onClick={() =>
              void runAction(async () => {
                const preview = await window.voicewall.previewCompanyName(companyNameInput.trim());
                if (preview.ok) {
                  setCompanyPreview(preview.ordnername);
                }
                return preview;
              })
            }
          >
            Ordnername pruefen
          </button>
          <button
            type="button"
            disabled={busy || companyNameInput.trim().length === 0}
            data-testid="company-create-button"
            onClick={() =>
              void runAction(async () => {
                const result = await window.voicewall.createCompany(
                  companyNameInput.trim(),
                  localStrategy ? 'lokal-mit-verknuepfung' : 'desktop',
                );
                if (result.ok) {
                  setCompanyNotice(
                    [
                      result.uebernommen
                        ? `Bestehender Firmenordner "${result.ordnername}" uebernommen.`
                        : `Firma "${result.ordnername}" angelegt.`,
                      result.syncWarnung ?? '',
                      result.verknuepfungHinweis ?? '',
                    ]
                      .filter((part) => part.length > 0)
                      .join(' '),
                  );
                  setCompanyNameInput('');
                  setCompanyPreview(null);
                  await refreshCompanies();
                  await refreshDictates(searchInput);
                  return { ok: true as const };
                }
                return {
                  ok: false as const,
                  message:
                    result.vorschlag === null
                      ? result.message
                      : `${result.message} Vorschlag: ${result.vorschlag}`,
                };
              })
            }
          >
            Firma anlegen
          </button>
        </div>
        {companyPreview !== null && (
          <p className="notice" data-testid="company-preview">
            Ordnername: {companyPreview}
          </p>
        )}
        <div className="actions">
          <label>
            <input
              type="checkbox"
              checked={localStrategy}
              disabled={busy}
              onChange={(event) => {
                setLocalStrategy(event.target.checked);
              }}
            />{' '}
            Lokal unter ~/VoiceWall speichern, auf dem Desktop nur Verknuepfung (empfohlen bei
            Cloud-Sync)
          </label>
        </div>
        <div className="actions">
          <label>
            <input
              type="checkbox"
              checked={companies?.autoSpeichern ?? false}
              disabled={busy || (companies?.firmen.length ?? 0) === 0}
              data-testid="dictate-auto-save"
              onChange={(event) =>
                void runAction(async () => {
                  const result = await window.voicewall.setDictateAutoSave(event.target.checked);
                  await refreshCompanies();
                  return result;
                })
              }
            />{' '}
            Diktate automatisch in der aktiven Firma speichern
          </label>
          <button
            type="button"
            disabled={busy || lastTranscript === null || (companies?.firmen.length ?? 0) === 0}
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
            Letztes Diktat speichern
          </button>
        </div>
        {companies !== null && companies.firmen.length > 0 ? (
          <ul className="status-list" data-testid="company-list">
            {companies.firmen.map((firma) => (
              <li key={firma.pfad}>
                {firma.aktiv ? <strong>{firma.anzeigename} (aktiv)</strong> : firma.anzeigename}{' '}
                {!firma.aktiv && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void runAction(async () => {
                        const result = await window.voicewall.setActiveCompany(firma.pfad);
                        await refreshCompanies();
                        await refreshDictates(searchInput);
                        return result;
                      })
                    }
                  >
                    Aktivieren
                  </button>
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
          <label htmlFor="dictate-search-input">Diktate durchsuchen:</label>
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
                    {entry.erstellt} · {entry.wortzahl} Woerter · {entry.pfad}
                  </span>
                </li>
              ))}
            </ol>
          ))}
        {companyNotice !== null && (
          <p className="notice" data-testid="company-notice">
            {companyNotice}
          </p>
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
