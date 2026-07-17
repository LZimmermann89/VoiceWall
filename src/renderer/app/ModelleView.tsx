/**
 * Ansicht "Modelle" (Verwaltung): der Modellbestand des
 * Rechners als prüfbare Liste. Für jedes Katalog-Modell: Anzeigename, Zweck,
 * Größe, Status (vorhanden und verifiziert / fehlt) und die SHA-256-Konstante
 * (gekürzt, voller Wert im title-Attribut). Fehlende Modelle lassen sich
 * einzeln laden (seriell, bestehender ModelProgress-Mechanismus); vorhandene,
 * nicht benötigte Modelle lassen sich nach Bestätigungsdialog löschen.
 *
 * Regeln:
 * - Das Whisper-Modell der aktiven Firmensprache und das VAD-Modell sind
 *   nicht löschbar (Badge plus erklärende Meldung; der Main-Prozess prüft
 *   dieselbe Regel noch einmal).
 * - Downloads sind der einzige externe Request der App; der Hinweis dazu
 *   steht sichtbar in der Ansicht.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import type { ModelDetailView, ModelIdView, ModelProgress } from '../../shared/schema';
import { formatBytes } from './format';
import { useSprache } from './i18n';
import { ConfirmDialog } from './RegisterView';
import { useToast } from './Toasts';

interface ModelleViewProps {
  /** Laufender Download-Fortschritt (bestehender ModelProgress-Kanal). */
  readonly progress: ModelProgress | null;
  readonly onRefreshStatus: () => Promise<void>;
}

/** Gekuerzte SHA-256-Darstellung (voller Wert im title-Attribut). */
function shortSha(sha256: string): string {
  return `${sha256.slice(0, 16)}…`;
}

export function ModelleView(props: ModelleViewProps): ReactElement {
  const { progress, onRefreshStatus } = props;
  const { sprache: uiSprache, texte } = useSprache();
  const t = texte.modelleTab;
  const { showError, showSuccess } = useToast();

  const [modelle, setModelle] = useState<readonly ModelDetailView[] | null>(null);
  const [busyId, setBusyId] = useState<ModelIdView | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ModelDetailView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const details = await window.voicewall.modelDetails();
    setModelle(details.modelle);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const download = useCallback(
    async (model: ModelDetailView) => {
      setBusyId(model.id);
      setError(null);
      setNotice(null);
      try {
        const result = await window.voicewall.downloadModel(model.id);
        if (result.ok) {
          const meldung = t.downloadFertig(model.label);
          setNotice(meldung);
          showSuccess(meldung);
        } else {
          setError(result.message);
          showError(result.message);
        }
      } finally {
        setBusyId(null);
        await load();
        await onRefreshStatus();
      }
    },
    [load, onRefreshStatus, showError, showSuccess, t],
  );

  const remove = useCallback(
    async (model: ModelDetailView) => {
      setBusyId(model.id);
      setError(null);
      setNotice(null);
      try {
        const result = await window.voicewall.deleteModel(model.id);
        if (result.ok) {
          const meldung = t.geloescht(model.label);
          setNotice(meldung);
          showSuccess(meldung);
        } else {
          setError(result.message);
          showError(result.message);
        }
      } finally {
        setBusyId(null);
        await load();
        await onRefreshStatus();
      }
    },
    [load, onRefreshStatus, showError, showSuccess, t],
  );

  return (
    <div className="view-body">
      <h2 className="view-title" tabIndex={-1}>
        {t.titel}
      </h2>
      <p className="lede">{t.lede}</p>
      <p className="notice">{t.downloadHinweis}</p>

      {modelle === null ? (
        <p className="placeholder">{t.wirdGeladen}</p>
      ) : (
        <ul className="model-cards" data-testid="model-cards">
          {modelle.map((model) => {
            const laufenderDownload =
              busyId === model.id && progress !== null && progress.id === model.id;
            return (
              <li key={model.id} className="model-card" data-testid={`model-card-${model.id}`}>
                <div className="model-card-head">
                  <span className="model-card-label">{model.label}</span>
                  {model.erforderlich && (
                    <span className="badge" title={t.erforderlichHinweis}>
                      {t.badgeErforderlich}
                    </span>
                  )}
                  <span
                    className={model.present ? 'status-ok' : 'status-missing'}
                    data-testid={`model-status-${model.id}`}
                  >
                    {model.present ? t.statusVorhanden : t.statusFehlt}
                  </span>
                </div>
                <p className="model-card-line">
                  {t.zweckLabel} {t.zweck[model.id]}
                </p>
                <p className="model-card-line">
                  {t.groesseLabel} {formatBytes(model.byteSize, uiSprache)} · {t.pruefsummeLabel}{' '}
                  <span className="mono" title={model.sha256}>
                    {shortSha(model.sha256)}
                  </span>
                </p>
                <div className="actions">
                  {!model.present && (
                    <button
                      type="button"
                      className="primary"
                      disabled={busyId !== null}
                      data-testid={`model-download-${model.id}`}
                      onClick={() => void download(model)}
                    >
                      {busyId === model.id ? t.laedt : t.laden}
                    </button>
                  )}
                  {model.present && !model.erforderlich && (
                    <button
                      type="button"
                      className="danger"
                      disabled={busyId !== null}
                      data-testid={`model-delete-${model.id}`}
                      onClick={() => {
                        setConfirmDelete(model);
                      }}
                    >
                      {t.loeschen}
                    </button>
                  )}
                  {model.present && model.erforderlich && (
                    <span className="notice" data-testid={`model-locked-${model.id}`}>
                      {t.erforderlichHinweis}
                    </span>
                  )}
                </div>
                {laufenderDownload && (
                  <div aria-live="polite">
                    <progress
                      max={100}
                      value={progress.percent ?? 0}
                      aria-label={texte.diktat.downloadAria}
                    />
                    <p className="progress-line">
                      {texte.diktat.progressZeile(
                        progress.label,
                        formatBytes(progress.receivedBytes, uiSprache),
                        progress.totalBytes !== null
                          ? formatBytes(progress.totalBytes, uiSprache)
                          : null,
                        progress.percent !== null ? progress.percent.toFixed(0) : null,
                      )}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {notice !== null && (
        <p className="notice" data-testid="model-notice" aria-live="polite">
          {notice}
        </p>
      )}
      {error !== null && (
        <p className="warn-text" data-testid="model-error" role="alert">
          {error}
        </p>
      )}

      {confirmDelete !== null && (
        <ConfirmDialog
          titel={t.loeschenTitel}
          text={t.loeschenText(confirmDelete.label, formatBytes(confirmDelete.byteSize, uiSprache))}
          bestaetigenText={t.loeschenBestaetigen}
          onConfirm={() => {
            const model = confirmDelete;
            setConfirmDelete(null);
            void remove(model);
          }}
          onCancel={() => {
            setConfirmDelete(null);
          }}
        />
      )}
    </div>
  );
}
