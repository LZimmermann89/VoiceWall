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
import type { Ersetzung } from '../../shared/vokabular';
import { formatAccelerator, formatBytes } from './format';
import { useSprache } from './i18n';

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
  const { sprache: uiSprache, texte } = useSprache();
  const t = texte.diktat;

  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([]);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hotkeyInput, setHotkeyInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const levelDecay = useRef<number | null>(null);

  // Fach-Woerterbuch der aktiven Firma (Stufe 1).
  const [begriffe, setBegriffe] = useState<string[]>([]);
  const [ersetzungen, setErsetzungen] = useState<Ersetzung[]>([]);
  const [begriffInput, setBegriffInput] = useState('');
  const [vonInput, setVonInput] = useState('');
  const [zuInput, setZuInput] = useState('');
  const [vokabularError, setVokabularError] = useState<string | null>(null);
  const [vokabularNotice, setVokabularNotice] = useState<string | null>(null);

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

  // Vokabular der aktiven Firma laden (bei Firmenwechsel neu).
  const aktiveFirma = companies?.aktiveFirma ?? null;
  useEffect(() => {
    let cancelled = false;
    setVokabularError(null);
    setVokabularNotice(null);
    if (aktiveFirma === null) {
      setBegriffe([]);
      setErsetzungen([]);
      return;
    }
    void window.voicewall.getVokabular().then((result) => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setBegriffe([...result.vokabular.begriffe]);
        setErsetzungen([...result.vokabular.ersetzungen]);
      } else {
        setVokabularError(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [aktiveFirma]);

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
  const aufbereitung = status?.aufbereitung ?? {
    fuellwoerterEntfernen: true,
    sprachkommandos: false,
  };
  const flowState = status?.flowState ?? 'idle';
  const platform = systemInfo?.platform ?? 'darwin';
  const hasCompany = (companies?.firmen.length ?? 0) > 0;
  const levelBucket = Math.min(20, Math.round(Math.min(1, level * 1.4) * 20));

  return (
    <div className="view-body">
      <h2 className="view-title" tabIndex={-1}>
        {t.titel}
      </h2>
      <p className="lede">{t.lede}</p>

      {/* 01 Systemweites Diktat ---------------------------------------- */}
      <section className="main-section" aria-label={t.abschnittDiktatAria}>
        <div className="section-head">
          <span className="section-no">01</span>
          <h3>{t.abschnittDiktat}</h3>
        </div>
        <ul className="status-list">
          <li>
            {t.hotkeyZeile}{' '}
            <strong className="mono" data-testid="hotkey-current">
              {hotkey?.accelerator ?? t.hotkeyUnbekannt}
            </strong>{' '}
            {hotkey !== null && (
              <span className="notice">
                ({formatAccelerator(hotkey.accelerator, platform, uiSprache)}
                {') '}
              </span>
            )}
            {hotkey !== null && !hotkey.registered && (
              <span className="warn-text" data-testid="hotkey-conflict">
                {t.hotkeyKonflikt}
              </span>
            )}
          </li>
          <li>
            {t.zustandZeile}{' '}
            <strong data-testid="flow-state">{texte.format.flowState[flowState]}</strong>
          </li>
        </ul>
        <div className="actions">
          <label htmlFor="hotkey-input">{t.neueKombination}</label>
          <input
            id="hotkey-input"
            type="text"
            value={hotkeyInput}
            placeholder={t.hotkeyPlatzhalter}
            onChange={(event) => {
              setHotkeyInput(event.target.value);
            }}
          />
          <button
            type="button"
            disabled={busy || hotkeyInput.trim().length === 0}
            onClick={() => void runAction(() => window.voicewall.setHotkey(hotkeyInput.trim()))}
          >
            {t.hotkeyUebernehmen}
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
            {t.clipboardWiederherstellen}
          </label>
        </div>
        {accessibility === 'missing' && (
          <div className="accessibility-hint" data-testid="accessibility-hint">
            <p>{t.accessibilityHinweis}</p>
            <button
              type="button"
              disabled={busy}
              data-testid="request-accessibility"
              onClick={() => void runAction(() => window.voicewall.requestAccessibility())}
            >
              {t.freigabeAnfordern}
            </button>{' '}
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAction(() => window.voicewall.openAccessibilitySettings())}
            >
              {t.systemeinstellungen}
            </button>{' '}
            <button
              type="button"
              disabled={busy}
              data-testid="relaunch-app"
              onClick={() => void runAction(() => window.voicewall.relaunchApp())}
            >
              {t.neuStarten}
            </button>
          </div>
        )}
        <h4 className="visually-hidden">{t.letztesDiktat}</h4>
        {lastTranscript === null ? (
          <p className="placeholder" data-testid="last-transcript-empty">
            {t.keinDiktat}
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
                      setNotice(t.kopiertHinweis);
                    }
                    return result;
                  })
                }
              >
                {t.kopieren}
              </button>
              <button
                type="button"
                disabled={busy || !hasCompany}
                data-testid="save-last-dictate"
                onClick={() =>
                  void runAction(async () => {
                    const result = await window.voicewall.saveLastDictate();
                    if (result.ok) {
                      setNotice(t.gespeichertHinweis(result.pfad));
                      await onRefreshCompanies();
                      return { ok: true as const };
                    }
                    return result;
                  })
                }
              >
                {t.alsDiktatSpeichern}
              </button>
            </div>
          </div>
        )}
        {notice !== null && <p className="notice">{notice}</p>}
      </section>

      {/* 02 Status ----------------------------------------------------- */}
      <section className="main-section" aria-label={t.abschnittStatus}>
        <div className="section-head">
          <span className="section-no">02</span>
          <h3>{t.abschnittStatus}</h3>
        </div>
        <ul className="status-list">
          <li>
            {t.statusEinwilligung}{' '}
            <strong>
              {status?.consentGranted ? t.einwilligungErteilt : t.einwilligungAusstehend}
            </strong>
          </li>
          <li>
            {t.statusMikrofon} <strong>{status?.microphoneState ?? t.mikrofonUnbekannt}</strong>
          </li>
          <li>
            {t.statusDiktatsprache}{' '}
            <strong data-testid="dictation-language">
              {status?.dictationLanguage === 'en' ? t.spracheEnglisch : t.spracheDeutsch}
            </strong>
          </li>
          <li>
            {t.statusModelle}{' '}
            <strong>{modelsReady ? t.modelleVorhanden : t.modelleUnvollstaendig}</strong>
          </li>
          <li>
            {t.statusEngine}{' '}
            <strong>{engineReady ? t.engineBereit : t.engineNichtGestartet}</strong>
          </li>
        </ul>
        {status?.engineHinweis != null && (
          <p className="notice" data-testid="engine-hinweis" aria-live="polite">
            {status.engineHinweis}
          </p>
        )}
        {status?.models.map((model) => (
          <p key={model.id} className="model-line">
            {model.label}:{' '}
            {model.present
              ? t.modellVorhanden
              : t.modellFehlt(formatBytes(model.byteSize, uiSprache))}
          </p>
        ))}
        {progress !== null && !modelsReady && (
          <div aria-live="polite">
            <progress max={100} value={progress.percent ?? 0} aria-label={t.downloadAria} />
            <p className="progress-line">
              {t.progressZeile(
                progress.label,
                formatBytes(progress.receivedBytes, uiSprache),
                progress.totalBytes !== null ? formatBytes(progress.totalBytes, uiSprache) : null,
                progress.percent !== null ? progress.percent.toFixed(0) : null,
              )}
            </p>
          </div>
        )}
      </section>

      {/* 03 Funktionsbeleg --------------------------------------------- */}
      <section className="main-section" aria-label={t.abschnittFunktionsbelegAria}>
        <div className="section-head">
          <span className="section-no">03</span>
          <h3>{t.abschnittFunktionsbeleg}</h3>
        </div>
        <div className="actions">
          <button
            type="button"
            disabled={busy || (status?.consentGranted ?? false)}
            onClick={() => void runAction(() => window.voicewall.grantConsent())}
          >
            {t.einwilligungErteilen}
          </button>
          <button
            type="button"
            disabled={busy || !(status?.consentGranted ?? false) || modelsReady}
            onClick={() => void runAction(() => window.voicewall.prepareModels())}
          >
            {t.modelleLaden}
          </button>
          <button
            type="button"
            disabled={busy || !engineReady || dictationActive}
            onClick={() => void runAction(() => window.voicewall.startDictation())}
          >
            {t.testaufnahmeStarten}
          </button>
          <button
            type="button"
            disabled={busy || !dictationActive}
            onClick={() => void runAction(() => window.voicewall.stopDictation())}
          >
            {t.testaufnahmeStoppen}
          </button>
        </div>
        <p className="notice">{t.lokalHinweis}</p>
        <div className="level-track" aria-hidden="true">
          <div className={`level-fill lvl-${String(levelBucket)}`} data-testid="level-fill" />
        </div>
        {transcripts.length === 0 ? (
          <p className="placeholder" data-testid="transcript-empty">
            {t.keinTranskript}
          </p>
        ) : (
          <ol className="transcript-list" data-testid="transcript-list">
            {transcripts.map((line, index) => (
              <li key={`${String(index)}-${line.text}`}>
                <span className="transcript-text">{line.text}</span>
                <span className="transcript-meta">
                  {t.transkriptMeta(line.durationMs, (line.audioMs / 1000).toFixed(1))}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 04 Wörterbuch und Aufbereitung ---------------------------------- */}
      <section className="main-section" aria-label={t.abschnittWoerterbuch}>
        <div className="section-head">
          <span className="section-no">04</span>
          <h3>{t.abschnittWoerterbuch}</h3>
        </div>
        <p className="notice">{t.woerterbuchHinweis}</p>
        <div className="actions">
          <label className="switch-row">
            <input
              type="checkbox"
              data-testid="switch-fuellwoerter"
              checked={aufbereitung.fuellwoerterEntfernen}
              disabled={busy}
              onChange={(event) =>
                void runAction(() =>
                  window.voicewall.setAufbereitung({
                    fuellwoerterEntfernen: event.target.checked,
                    sprachkommandos: aufbereitung.sprachkommandos,
                  }),
                )
              }
            />{' '}
            {t.fuellwoerterLabel}
          </label>
        </div>
        <div className="actions">
          <label className="switch-row">
            <input
              type="checkbox"
              data-testid="switch-sprachkommandos"
              checked={aufbereitung.sprachkommandos}
              disabled={busy}
              onChange={(event) =>
                void runAction(() =>
                  window.voicewall.setAufbereitung({
                    fuellwoerterEntfernen: aufbereitung.fuellwoerterEntfernen,
                    sprachkommandos: event.target.checked,
                  }),
                )
              }
            />{' '}
            {t.sprachkommandosLabel}
          </label>
        </div>
        <h4>{t.fachwoerterbuchTitel}</h4>
        {!hasCompany ? (
          <p className="placeholder">{t.fachwoerterbuchKeineFirma}</p>
        ) : (
          <>
            <p className="notice">{t.fachwoerterbuchHinweis}</p>
            {begriffe.length > 0 && (
              <ul className="status-list" data-testid="vocab-begriffe">
                {begriffe.map((begriff, index) => (
                  <li key={`${String(index)}-${begriff}`}>
                    <span className="mono">{begriff}</span>{' '}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setBegriffe((prev) => prev.filter((_, i) => i !== index));
                      }}
                    >
                      {t.entfernen}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="actions">
              <label htmlFor="vocab-begriff-input">{t.neuerBegriff}</label>
              <input
                id="vocab-begriff-input"
                data-testid="vocab-begriff-input"
                type="text"
                maxLength={80}
                value={begriffInput}
                placeholder={t.begriffPlatzhalter}
                onChange={(event) => {
                  setBegriffInput(event.target.value);
                }}
              />
              <button
                type="button"
                data-testid="vocab-add-begriff"
                disabled={busy || begriffInput.trim().length === 0}
                onClick={() => {
                  setBegriffe((prev) => [...prev, begriffInput.trim()]);
                  setBegriffInput('');
                }}
              >
                {t.hinzufuegen}
              </button>
            </div>
            {ersetzungen.length > 0 && (
              <ul className="status-list" data-testid="vocab-ersetzungen">
                {ersetzungen.map((regel, index) => (
                  <li key={`${String(index)}-${regel.von}`}>
                    <span className="mono">{regel.von}</span> {'->'}{' '}
                    <span className="mono">{regel.zu}</span>{' '}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setErsetzungen((prev) => prev.filter((_, i) => i !== index));
                      }}
                    >
                      {t.entfernen}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="actions">
              <label htmlFor="vocab-von-input">{t.ersetzungVon}</label>
              <input
                id="vocab-von-input"
                data-testid="vocab-von-input"
                type="text"
                maxLength={80}
                value={vonInput}
                placeholder={t.ersetzungVonPlatzhalter}
                onChange={(event) => {
                  setVonInput(event.target.value);
                }}
              />
              <label htmlFor="vocab-zu-input">{t.ersetzungZu}</label>
              <input
                id="vocab-zu-input"
                data-testid="vocab-zu-input"
                type="text"
                maxLength={80}
                value={zuInput}
                placeholder={t.ersetzungZuPlatzhalter}
                onChange={(event) => {
                  setZuInput(event.target.value);
                }}
              />
              <button
                type="button"
                data-testid="vocab-add-ersetzung"
                disabled={busy || vonInput.trim().length === 0}
                onClick={() => {
                  setErsetzungen((prev) => [...prev, { von: vonInput, zu: zuInput }]);
                  setVonInput('');
                  setZuInput('');
                }}
              >
                {t.hinzufuegen}
              </button>
            </div>
            <div className="actions">
              <button
                type="button"
                data-testid="vocab-save"
                disabled={busy}
                onClick={() =>
                  void runAction(async () => {
                    setVokabularError(null);
                    setVokabularNotice(null);
                    const result = await window.voicewall.saveVokabular({
                      begriffe,
                      ersetzungen,
                    });
                    if (result.ok) {
                      setVokabularNotice(t.woerterbuchGespeichert);
                    } else {
                      setVokabularError(result.message);
                    }
                    return { ok: true };
                  })
                }
              >
                {t.woerterbuchSpeichern}
              </button>
            </div>
            {vokabularNotice !== null && (
              <p className="notice" data-testid="vocab-notice">
                {vokabularNotice}
              </p>
            )}
            {vokabularError !== null && (
              <p className="warn-text" data-testid="vocab-error">
                {vokabularError}
              </p>
            )}
          </>
        )}
      </section>

      {error !== null && (
        <section aria-label={t.fehlerAria} className="error-box" data-testid="error-box">
          <h3>{t.fehlerTitel}</h3>
          <p>{error}</p>
        </section>
      )}
    </div>
  );
}
