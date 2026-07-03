/**
 * Ansicht "Register" (M7, ABARBEITUNG 4.8): das Aktenverzeichnis der aktiven
 * Firma. Liste mit Sortierung und Schnellsuche, kombinierbaren Filtern
 * (Zeitraum, Tags, Quelle), Detailansicht (Volltext als Textknoten, NIE als
 * HTML), Bearbeiten (Titel/Body/Tags, atomar), manuelle Notiz und Export
 * (Markdown/TXT nach Exporte/).
 *
 * Sicherheit: der Body wird ausschliesslich als React-Textknoten gerendert
 * (kein Roh-HTML-Einschub, kein Markdown-Rendering in v1); ein Diktat mit
 * HTML-artigem Inhalt kann so keinen Code ausfuehren (Stored-XSS-Regel 3.5).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { DictateDetail, ManifestEntry, TranscriptQuelle } from '../../shared/company';
import { QUELLE_LABELS, formatGermanDate, formatGermanDateTime } from './format';

type SortKey = 'datum' | 'titel' | 'wortzahl';

interface RegisterViewProps {
  /** Wird nach Aenderungen aufgerufen (z. B. Soft-Delete), damit der
   *  Papierkorb-Zaehler in der Navigation aktuell bleibt. */
  readonly onDataChanged: () => void;
}

interface Filter {
  readonly text: string;
  readonly tags: readonly string[];
  readonly von: string;
  readonly bis: string;
  readonly quelle: TranscriptQuelle | '';
}

const EMPTY_FILTER: Filter = { text: '', tags: [], von: '', bis: '', quelle: '' };

/** Baut den IPC-Suchfilter aus dem UI-Filter (Datumsgrenzen zu ISO). */
function toSearchFilter(filter: Filter): Parameters<typeof window.voicewall.listDictates>[0] {
  const result: Parameters<typeof window.voicewall.listDictates>[0] = {};
  if (filter.text.trim().length > 0) {
    result.text = filter.text.trim();
  }
  if (filter.tags.length > 0) {
    result.tags = [...filter.tags];
  }
  if (filter.von.length > 0) {
    const von = new Date(`${filter.von}T00:00:00`);
    if (!Number.isNaN(von.getTime())) {
      result.von = von.toISOString();
    }
  }
  if (filter.bis.length > 0) {
    const bis = new Date(`${filter.bis}T23:59:59`);
    if (!Number.isNaN(bis.getTime())) {
      result.bis = bis.toISOString();
    }
  }
  if (filter.quelle !== '') {
    result.quelle = filter.quelle;
  }
  return result;
}

function sortEntries(entries: readonly ManifestEntry[], key: SortKey): ManifestEntry[] {
  const copy = [...entries];
  copy.sort((a, b) => {
    if (key === 'titel') {
      return a.titel.localeCompare(b.titel, 'de-DE');
    }
    if (key === 'wortzahl') {
      return b.wortzahl - a.wortzahl;
    }
    // datum: neueste zuerst.
    return a.erstellt < b.erstellt ? 1 : a.erstellt > b.erstellt ? -1 : 0;
  });
  return copy;
}

export function RegisterView(props: RegisterViewProps): ReactElement {
  const [entries, setEntries] = useState<ManifestEntry[] | null>(null);
  const [knownTags, setKnownTags] = useState<readonly string[]>([]);
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [sortKey, setSortKey] = useState<SortKey>('datum');
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DictateDetail | null>(null);
  const [showNote, setShowNote] = useState(false);
  const backTargetRef = useRef<HTMLHeadingElement | null>(null);

  const loadTags = useCallback(async () => {
    setKnownTags(await window.voicewall.listTags());
  }, []);

  const loadList = useCallback(async (current: Filter) => {
    const result = await window.voicewall.listDictates(toSearchFilter(current));
    if (result.ok) {
      setEntries(result.eintraege);
      setListError(null);
    } else {
      setEntries(null);
      setListError(result.message);
    }
  }, []);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  // Live-Filter beim Tippen (leicht entprellt).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadList(filter);
    }, 150);
    return () => {
      window.clearTimeout(timer);
    };
  }, [filter, loadList]);

  const sorted = useMemo(
    () => (entries === null ? null : sortEntries(entries, sortKey)),
    [entries, sortKey],
  );

  const openDetail = useCallback(async (pfad: string) => {
    const result = await window.voicewall.getDictate(pfad);
    if (result.ok) {
      setDetail(result.detail);
    } else {
      setListError(result.message);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadList(filter), loadTags()]);
    props.onDataChanged();
  }, [filter, loadList, loadTags, props]);

  if (detail !== null) {
    return (
      <DetailPanel
        detail={detail}
        knownTags={knownTags}
        onBack={() => {
          setDetail(null);
        }}
        onSaved={(updated) => {
          setDetail(updated);
          void refreshAll();
        }}
        onDeleted={() => {
          setDetail(null);
          void refreshAll();
        }}
      />
    );
  }

  const activeTagFilters = new Set(filter.tags);

  return (
    <div className="view-body">
      <h2 className="view-title" tabIndex={-1} ref={backTargetRef}>
        Register
      </h2>
      <p className="lede">
        Das Aktenverzeichnis dieser Firma: alle Diktate und Notizen, durchsuchbar und filterbar. Ein
        Klick öffnet den vollständigen Text.
      </p>

      <div className="actions" role="search">
        <label htmlFor="reg-search">Schnellsuche:</label>
        <input
          id="reg-search"
          type="text"
          value={filter.text}
          placeholder="Titel, Tag oder Textvorschau"
          data-testid="register-search"
          onChange={(event) => {
            setFilter((f) => ({ ...f, text: event.target.value }));
          }}
        />
        <label htmlFor="reg-sort">Sortierung:</label>
        <select
          id="reg-sort"
          value={sortKey}
          data-testid="register-sort"
          onChange={(event) => {
            setSortKey(event.target.value as SortKey);
          }}
        >
          <option value="datum">Datum (neueste zuerst)</option>
          <option value="titel">Titel (A bis Z)</option>
          <option value="wortzahl">Wortzahl (absteigend)</option>
        </select>
        <button
          type="button"
          data-testid="register-new-note"
          onClick={() => {
            setShowNote(true);
          }}
        >
          Neue Notiz
        </button>
      </div>

      <div className="filter-bar">
        <div className="filter-field">
          <label htmlFor="reg-von">Zeitraum von</label>
          <input
            id="reg-von"
            type="date"
            value={filter.von}
            onChange={(event) => {
              setFilter((f) => ({ ...f, von: event.target.value }));
            }}
          />
        </div>
        <div className="filter-field">
          <label htmlFor="reg-bis">bis</label>
          <input
            id="reg-bis"
            type="date"
            value={filter.bis}
            onChange={(event) => {
              setFilter((f) => ({ ...f, bis: event.target.value }));
            }}
          />
        </div>
        <div className="filter-field">
          <label htmlFor="reg-quelle">Quelle</label>
          <select
            id="reg-quelle"
            value={filter.quelle}
            onChange={(event) => {
              setFilter((f) => ({ ...f, quelle: event.target.value as TranscriptQuelle | '' }));
            }}
          >
            <option value="">alle</option>
            <option value="diktat">Diktat</option>
            <option value="import">Import</option>
            <option value="manuell">Notiz</option>
          </select>
        </div>
        {(filter.tags.length > 0 ||
          filter.von.length > 0 ||
          filter.bis.length > 0 ||
          filter.quelle !== '' ||
          filter.text.length > 0) && (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setFilter(EMPTY_FILTER);
            }}
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {knownTags.length > 0 && (
        <div className="tag-filter" aria-label="Nach Tags filtern">
          <span className="tag-filter-label">Tags:</span>
          {knownTags.map((tag) => {
            const active = activeTagFilters.has(tag);
            return (
              <button
                type="button"
                key={tag}
                className={`tag-chip${active ? ' tag-chip-active' : ''}`}
                aria-pressed={active}
                onClick={() => {
                  setFilter((f) => ({
                    ...f,
                    tags: active ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
                  }));
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}

      {listError !== null && (
        <p className="note error" role="alert">
          {listError}
        </p>
      )}

      {sorted === null && listError === null && <p className="placeholder">Wird geladen ...</p>}

      {sorted !== null &&
        (sorted.length === 0 ? (
          <EmptyRegister hasFilter={filter !== EMPTY_FILTER} />
        ) : (
          <ol className="register-list" data-testid="register-list">
            {sorted.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className="register-row"
                  data-testid="register-row"
                  onClick={() => {
                    void openDetail(entry.pfad);
                  }}
                >
                  <span className="register-row-head">
                    <span className="register-title">{entry.titel}</span>
                    <span className="register-quelle">
                      {QUELLE_LABELS[entry.quelle] ?? entry.quelle}
                    </span>
                  </span>
                  <span className="register-meta">
                    {formatGermanDate(entry.erstellt)} · {entry.wortzahl} Wörter
                  </span>
                  {entry.vorschau.length > 0 && (
                    <span className="register-preview">{entry.vorschau}</span>
                  )}
                  {entry.tags.length > 0 && (
                    <span className="register-tags">
                      {entry.tags.map((tag) => (
                        <span key={tag} className="tag-chip tag-chip-static">
                          {tag}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        ))}

      {showNote && (
        <NoteDialog
          onClose={() => {
            setShowNote(false);
          }}
          onCreated={() => {
            setShowNote(false);
            void refreshAll();
          }}
        />
      )}
    </div>
  );
}

/** Gestalteter Leerzustand mit Kurzanleitung (Hotkey, sprechen, Hotkey). */
function EmptyRegister(props: { readonly hasFilter: boolean }): ReactElement {
  if (props.hasFilter) {
    return (
      <p className="placeholder" data-testid="register-empty">
        Keine Einträge passen zu den aktuellen Filtern. Bitte Suche oder Filter anpassen.
      </p>
    );
  }
  return (
    <div className="empty-state" data-testid="register-empty">
      <p className="empty-state-title">Noch keine Diktate in dieser Firma.</p>
      <p className="lede">So entsteht der erste Eintrag:</p>
      <ol className="kurzanleitung">
        <li>Cursor in ein Textfeld setzen und das Tastenkürzel drücken.</li>
        <li>Sprechen. Ein kleines Fenster zeigt &quot;Ich höre zu&quot;.</li>
        <li>Erneut das Tastenkürzel drücken: der Text erscheint und wird hier abgelegt.</li>
      </ol>
      <p className="notice">
        Alternativ oben über &quot;Neue Notiz&quot; einen Eintrag ohne Diktat anlegen.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detailansicht mit Bearbeiten, Tags und Export
// ---------------------------------------------------------------------------

function DetailPanel(props: {
  readonly detail: DictateDetail;
  readonly knownTags: readonly string[];
  readonly onBack: () => void;
  readonly onSaved: (updated: DictateDetail) => void;
  readonly onDeleted: () => void;
}): ReactElement {
  const { detail } = props;
  const [editing, setEditing] = useState(false);
  const [titel, setTitel] = useState(detail.meta.titel);
  const [body, setBody] = useState(detail.body);
  const [tags, setTags] = useState<readonly string[]>(detail.meta.tags);
  const [tagInput, setTagInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportRelPfad, setExportRelPfad] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const startEdit = useCallback(() => {
    setTitel(detail.meta.titel);
    setBody(detail.body);
    setTags(detail.meta.tags);
    setEditing(true);
    setError(null);
    setNotice(null);
  }, [detail]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setError(null);
    setTitel(detail.meta.titel);
    setBody(detail.body);
    setTags(detail.meta.tags);
  }, [detail]);

  const addTag = useCallback(
    (raw: string) => {
      const value = raw.trim().normalize('NFC');
      if (value.length === 0 || tags.includes(value)) {
        setTagInput('');
        return;
      }
      setTags((current) => [...current, value]);
      setTagInput('');
    },
    [tags],
  );

  const save = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await window.voicewall.updateDictate({
        pfad: detail.pfad,
        titel: titel.trim(),
        body,
        tags: [...tags],
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEditing(false);
      setNotice('Änderungen gespeichert.');
      props.onSaved({
        pfad: detail.pfad,
        body,
        meta: {
          ...detail.meta,
          titel: titel.trim(),
          tags: [...tags],
          version: result.version,
        },
      });
    } finally {
      setBusy(false);
    }
  }, [detail, titel, body, tags, props]);

  const runExport = useCallback(
    async (format: 'md' | 'txt', mitFrontMatter: boolean) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      setExportRelPfad(null);
      try {
        const result = await window.voicewall.exportDictate({
          pfad: detail.pfad,
          format,
          mitFrontMatter,
        });
        if (result.ok) {
          setNotice(`Exportiert nach: ${result.anzeigePfad}`);
          setExportRelPfad(result.relPfad);
        } else {
          setError(result.message);
        }
      } finally {
        setBusy(false);
      }
    },
    [detail],
  );

  const softDelete = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await window.voicewall.softDeleteDictate(detail.pfad);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      props.onDeleted();
    } finally {
      setBusy(false);
    }
  }, [detail, props]);

  const meta = detail.meta;

  return (
    <div className="view-body" data-testid="detail-panel">
      <div className="detail-topbar">
        <button type="button" className="ghost" data-testid="detail-back" onClick={props.onBack}>
          ← Zurück zum Register
        </button>
      </div>
      <h2 className="view-title" tabIndex={-1} ref={headingRef} data-testid="detail-title">
        {editing ? 'Eintrag bearbeiten' : meta.titel}
      </h2>

      {!editing ? (
        <>
          <table className="proto-table detail-meta">
            <tbody>
              <tr>
                <th scope="row">Erstellt</th>
                <td>{formatGermanDateTime(meta.erstellt)}</td>
              </tr>
              <tr>
                <th scope="row">Geändert</th>
                <td>{formatGermanDateTime(meta.geaendert)}</td>
              </tr>
              <tr>
                <th scope="row">Quelle</th>
                <td>{QUELLE_LABELS[meta.quelle] ?? meta.quelle}</td>
              </tr>
              <tr>
                <th scope="row">Modell</th>
                <td className="mono">{meta.modell}</td>
              </tr>
              <tr>
                <th scope="row">Dauer</th>
                <td>{meta.dauer_sekunden > 0 ? `${String(meta.dauer_sekunden)} s` : '—'}</td>
              </tr>
              <tr>
                <th scope="row">Wortzahl</th>
                <td>{meta.wortzahl}</td>
              </tr>
              {meta.ziel_app !== undefined && (
                <tr>
                  <th scope="row">Ziel-App</th>
                  <td>{meta.ziel_app}</td>
                </tr>
              )}
              <tr>
                <th scope="row">Version</th>
                <td className="mono" data-testid="detail-version">
                  {meta.version}
                </td>
              </tr>
              <tr>
                <th scope="row">Tags</th>
                <td>
                  {meta.tags.length === 0 ? (
                    '—'
                  ) : (
                    <span className="register-tags">
                      {meta.tags.map((tag) => (
                        <span key={tag} className="tag-chip tag-chip-static">
                          {tag}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Volltext AUSSCHLIESSLICH als Textknoten (kein HTML-Rendering). */}
          <h3>Volltext</h3>
          <div className="detail-body" data-testid="detail-body">
            {detail.body}
          </div>

          <div className="actions detail-actions">
            <button type="button" className="primary" data-testid="detail-edit" onClick={startEdit}>
              Bearbeiten
            </button>
            <button
              type="button"
              disabled={busy}
              data-testid="export-md"
              onClick={() => void runExport('md', true)}
            >
              Export Markdown (mit Kopf)
            </button>
            <button
              type="button"
              disabled={busy}
              data-testid="export-md-plain"
              onClick={() => void runExport('md', false)}
            >
              Export Markdown (ohne Kopf)
            </button>
            <button
              type="button"
              disabled={busy}
              data-testid="export-txt"
              onClick={() => void runExport('txt', false)}
            >
              Export TXT
            </button>
            <button
              type="button"
              className="danger"
              disabled={busy}
              data-testid="detail-delete"
              onClick={() => {
                setConfirmDelete(true);
              }}
            >
              In den Papierkorb
            </button>
          </div>

          {notice !== null && (
            <div className="note" data-testid="export-notice">
              <p>{notice}</p>
              {exportRelPfad !== null && (
                <button
                  type="button"
                  data-testid="reveal-export"
                  onClick={() => void window.voicewall.revealExport(exportRelPfad)}
                >
                  Im Finder zeigen
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="field-grid">
          <div className="field">
            <label className="field-label" htmlFor="edit-titel">
              Titel <span className="req">*</span>
            </label>
            <input
              id="edit-titel"
              type="text"
              value={titel}
              maxLength={500}
              data-testid="edit-titel"
              onChange={(event) => {
                setTitel(event.target.value);
              }}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="edit-body">
              Text
            </label>
            <textarea
              id="edit-body"
              rows={12}
              value={body}
              data-testid="edit-body"
              onChange={(event) => {
                setBody(event.target.value);
              }}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="edit-tag-input">
              Tags
            </label>
            <div className="tag-editor" data-testid="tag-editor">
              {tags.map((tag) => (
                <span key={tag} className="tag-chip tag-chip-active">
                  {tag}
                  <button
                    type="button"
                    className="tag-remove"
                    aria-label={`Tag ${tag} entfernen`}
                    onClick={() => {
                      setTags((current) => current.filter((t) => t !== tag));
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                id="edit-tag-input"
                type="text"
                className="tag-input"
                list="known-tags"
                value={tagInput}
                placeholder="Tag hinzufügen, Enter"
                data-testid="tag-input"
                onChange={(event) => {
                  setTagInput(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addTag(tagInput);
                  }
                }}
              />
              <datalist id="known-tags">
                {props.knownTags.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={busy || titel.trim().length === 0}
              data-testid="edit-save"
              onClick={() => void save()}
            >
              {busy ? 'Speichert ...' : 'Speichern'}
            </button>
            <button type="button" disabled={busy} data-testid="edit-cancel" onClick={cancelEdit}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {error !== null && (
        <p className="note error" role="alert" data-testid="detail-error">
          {error}
        </p>
      )}

      {confirmDelete && (
        <ConfirmDialog
          titel="In den Papierkorb verschieben?"
          text="Der Eintrag wird in den Papierkorb verschoben. Von dort kann er wiederhergestellt oder endgültig gelöscht werden."
          bestaetigenText="In den Papierkorb"
          onConfirm={() => {
            setConfirmDelete(false);
            void softDelete();
          }}
          onCancel={() => {
            setConfirmDelete(false);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manuelle Notiz und Bestaetigungsdialog
// ---------------------------------------------------------------------------

function NoteDialog(props: {
  readonly onClose: () => void;
  readonly onCreated: () => void;
}): ReactElement {
  const [titel, setTitel] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titelRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    titelRef.current?.focus();
  }, []);

  const create = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await window.voicewall.createManualNote({ titel: titel.trim(), body });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      props.onCreated();
    } finally {
      setBusy(false);
    }
  }, [titel, body, props]);

  return (
    <div className="modal-overlay" role="presentation" onClick={props.onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-title"
        data-testid="note-dialog"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <h3 id="note-title">Neue Notiz</h3>
        <div className="field">
          <label className="field-label" htmlFor="note-titel">
            Titel <span className="req">*</span>
          </label>
          <input
            id="note-titel"
            ref={titelRef}
            type="text"
            value={titel}
            maxLength={500}
            data-testid="note-titel"
            onChange={(event) => {
              setTitel(event.target.value);
            }}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="note-body">
            Text
          </label>
          <textarea
            id="note-body"
            rows={8}
            value={body}
            data-testid="note-body"
            onChange={(event) => {
              setBody(event.target.value);
            }}
          />
        </div>
        {error !== null && (
          <p className="note error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={busy || titel.trim().length === 0}
            data-testid="note-save"
            onClick={() => void create()}
          >
            {busy ? 'Speichert ...' : 'Notiz anlegen'}
          </button>
          <button type="button" disabled={busy} onClick={props.onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog(props: {
  readonly titel: string;
  readonly text: string;
  readonly bestaetigenText: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}): ReactElement {
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);
  return (
    <div className="modal-overlay" role="presentation" onClick={props.onCancel}>
      <div
        className="modal-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        data-testid="confirm-dialog"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <h3 id="confirm-title">{props.titel}</h3>
        <p>{props.text}</p>
        <div className="actions">
          <button
            type="button"
            className="danger"
            ref={confirmRef}
            data-testid="confirm-yes"
            onClick={props.onConfirm}
          >
            {props.bestaetigenText}
          </button>
          <button type="button" data-testid="confirm-no" onClick={props.onCancel}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
