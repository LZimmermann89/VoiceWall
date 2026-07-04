/**
 * Ansicht "Papierkorb" (M7, ABARBEITUNG 4.8): zeigt geloeschte Diktate,
 * stellt sie wieder her oder loescht sie endgueltig (mit Bestaetigungsdialog,
 * unwiderruflich). Soft-Delete verschiebt Dateien nur; hier ist der einzige
 * Ort, an dem endgueltig vernichtet wird.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import type { TrashEntry } from '../../shared/company';
import { ConfirmDialog } from './RegisterView';
import { formatDate } from './format';
import { useSprache } from './i18n';

interface TrashViewProps {
  readonly onDataChanged: () => void;
}

export function TrashView(props: TrashViewProps): ReactElement {
  const { sprache: uiSprache, texte } = useSprache();
  const t = texte.papierkorb;
  const [entries, setEntries] = useState<TrashEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<TrashEntry | null>(null);

  const load = useCallback(async () => {
    const result = await window.voicewall.listTrash();
    if (result.ok) {
      setEntries(result.eintraege);
      setError(null);
    } else {
      setEntries(null);
      setError(result.message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const restore = useCallback(
    async (pfad: string) => {
      setBusy(true);
      setError(null);
      try {
        const result = await window.voicewall.restoreDictate(pfad);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        await load();
        props.onDataChanged();
      } finally {
        setBusy(false);
      }
    },
    [load, props],
  );

  const hardDelete = useCallback(
    async (pfad: string) => {
      setBusy(true);
      setError(null);
      try {
        const result = await window.voicewall.hardDeleteDictate(pfad);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        await load();
        props.onDataChanged();
      } finally {
        setBusy(false);
      }
    },
    [load, props],
  );

  return (
    <div className="view-body">
      <h2 className="view-title" tabIndex={-1}>
        {t.titel}
      </h2>
      <p className="lede">{t.lede}</p>

      {error !== null && (
        <p className="note error" role="alert">
          {error}
        </p>
      )}

      {entries === null && error === null && <p className="placeholder">{t.wirdGeladen}</p>}

      {entries !== null &&
        (entries.length === 0 ? (
          <p className="placeholder" data-testid="trash-empty">
            {t.leer}
          </p>
        ) : (
          <ol className="register-list" data-testid="trash-list">
            {entries.map((entry) => (
              <li key={entry.id} className="trash-row" data-testid="trash-row">
                <div className="register-row-head">
                  <span className="register-title">{entry.titel}</span>
                  <span className="register-quelle">{texte.format.quelle[entry.quelle]}</span>
                </div>
                <span className="register-meta">
                  {formatDate(entry.erstellt, uiSprache)} · {t.wortzahl(entry.wortzahl)}
                </span>
                {entry.vorschau.length > 0 && (
                  <span className="register-preview">{entry.vorschau}</span>
                )}
                <div className="actions">
                  <button
                    type="button"
                    disabled={busy}
                    data-testid="trash-restore"
                    onClick={() => void restore(entry.pfad)}
                  >
                    {t.wiederherstellen}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    disabled={busy}
                    data-testid="trash-delete"
                    onClick={() => {
                      setConfirm(entry);
                    }}
                  >
                    {t.endgueltigLoeschen}
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ))}

      {confirm !== null && (
        <ConfirmDialog
          titel={t.bestaetigungTitel}
          text={t.bestaetigungText(confirm.titel)}
          bestaetigenText={t.endgueltigLoeschen}
          onConfirm={() => {
            const pfad = confirm.pfad;
            setConfirm(null);
            void hardDelete(pfad);
          }}
          onCancel={() => {
            setConfirm(null);
          }}
        />
      )}
    </div>
  );
}
