/**
 * Ansicht "Register" (M7, ABARBEITUNG 4.8): das Aktenverzeichnis der aktiven
 * Firma. Liste mit Sortierung und Schnellsuche, kombinierbaren Filtern
 * (Zeitraum, Tags, Quelle), Detailansicht (Volltext als Textknoten, NIE als
 * HTML), Bearbeiten (Titel/Body/Tags, atomar), manuelle Notiz und Export
 * (Markdown/TXT/PDF nach Exporte/).
 *
 * Seit M8 zusaetzlich: Volltextsuche ueber die Bodies (Umschalter, Treffer
 * mit Kontext-Snippet), Mehrfachauswahl mit Stapel-Export (Fortschritt per
 * aria-live), Tag-Batch-Rename ("Tags verwalten") und verschluesselter
 * Einzel-Export (.vwenc) in der Detailansicht.
 *
 * Sicherheit: der Body wird ausschliesslich als React-Textknoten gerendert
 * (kein Roh-HTML-Einschub, kein Markdown-Rendering in v1); ein Diktat mit
 * HTML-artigem Inhalt kann so keinen Code ausfuehren (Stored-XSS-Regel 3.5).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  VWENC_MIN_PASSWORD_LENGTH,
  type DictateDetail,
  type ExportFormat,
  type ExportProgress,
  type ManifestEntry,
  type TranscriptQuelle,
} from '../../shared/company';
import { formatDate, formatDateTime } from './format';
import { useSprache, useTexte } from './i18n';
import { PasswordDialog } from './PasswordDialog';
import { useToast } from './Toasts';

type SortKey = 'datum' | 'titel' | 'wortzahl';

/** Auswahl im Stapel-Format-Menue (md zerfaellt in mit/ohne Kopf). */
type BatchFormatChoice = 'md' | 'md-plain' | 'txt' | 'pdf';

/** UI-Formatwahl zu IPC-Format plus Front-Matter-Flag. */
function toExportFormat(choice: BatchFormatChoice): { format: ExportFormat; mit: boolean } {
  if (choice === 'md') {
    return { format: 'md', mit: true };
  }
  if (choice === 'md-plain') {
    return { format: 'md', mit: false };
  }
  return { format: choice, mit: false };
}

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
  /** M8: zusaetzlich in den Volltext-Bodies suchen. */
  readonly volltext: boolean;
}

const EMPTY_FILTER: Filter = { text: '', tags: [], von: '', bis: '', quelle: '', volltext: false };

/** Baut den IPC-Suchfilter aus dem UI-Filter (Datumsgrenzen zu ISO). */
function toSearchFilter(filter: Filter): Parameters<typeof window.voicewall.listDictates>[0] {
  const result: Parameters<typeof window.voicewall.listDictates>[0] = {};
  if (filter.text.trim().length > 0) {
    result.text = filter.text.trim();
    if (filter.volltext) {
      result.volltext = true;
    }
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
  const { sprache: uiSprache, texte } = useSprache();
  const t = texte.register;
  // Sofortmeldungen (E44): Export-Ausgang zusaetzlich als Toast, die
  // Inline-Anzeigen unten bleiben der Detail-Ort.
  const { showError, showSuccess } = useToast();
  const [entries, setEntries] = useState<ManifestEntry[] | null>(null);
  const [knownTags, setKnownTags] = useState<readonly string[]>([]);
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [sortKey, setSortKey] = useState<SortKey>('datum');
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DictateDetail | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [showTagRename, setShowTagRename] = useState(false);
  // Volltext-Snippets je Eintrag-id (nur bei aktiver Volltextsuche gefuellt).
  const [snippets, setSnippets] = useState<ReadonlyMap<string, string>>(new Map());
  // Stapel-Export: Auswahl (sichere relative Pfade), Format, Fortschritt.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [batchFormat, setBatchFormat] = useState<BatchFormatChoice>('md');
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchProgress, setBatchProgress] = useState<ExportProgress | null>(null);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [batchRelPfad, setBatchRelPfad] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const backTargetRef = useRef<HTMLHeadingElement | null>(null);

  const loadTags = useCallback(async () => {
    setKnownTags(await window.voicewall.listTags());
  }, []);

  const loadList = useCallback(async (current: Filter) => {
    const result = await window.voicewall.listDictates(toSearchFilter(current));
    if (result.ok) {
      setEntries(result.eintraege);
      setSnippets(new Map((result.volltextTreffer ?? []).map((tr) => [tr.id, tr.snippet])));
      setListError(null);
    } else {
      setEntries(null);
      setSnippets(new Map());
      setListError(result.message);
    }
  }, []);

  /** Stapel-Export der uebergebenen Pfade (Fortschritt per aria-live). */
  const runBatchExport = useCallback(
    async (pfade: readonly string[]) => {
      if (pfade.length === 0 || batchBusy) {
        return;
      }
      setBatchBusy(true);
      setBatchError(null);
      setBatchNotice(null);
      setBatchRelPfad(null);
      setBatchProgress({ fertig: 0, gesamt: pfade.length });
      const offProgress = window.voicewall.onExportProgress(setBatchProgress);
      try {
        const { format, mit } = toExportFormat(batchFormat);
        const result = await window.voicewall.exportDictatesBatch({
          pfade: [...pfade],
          format,
          mitFrontMatter: mit,
        });
        if (result.ok) {
          const meldung = t.exportErgebnis(
            result.exportiert,
            result.anzeigePfad,
            result.fehler.length,
          );
          setBatchNotice(meldung);
          setBatchRelPfad(result.relPfad);
          showSuccess(meldung);
        } else {
          setBatchError(result.message);
          showError(result.message);
        }
      } finally {
        offProgress();
        setBatchProgress(null);
        setBatchBusy(false);
      }
    },
    [batchBusy, batchFormat, t, showError, showSuccess],
  );

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
        {t.titel}
      </h2>
      <p className="lede">{t.lede}</p>

      <div className="actions" role="search">
        <label htmlFor="reg-search">{t.schnellsuche}</label>
        <input
          id="reg-search"
          type="text"
          value={filter.text}
          placeholder={t.suchePlatzhalter}
          data-testid="register-search"
          onChange={(event) => {
            setFilter((f) => ({ ...f, text: event.target.value }));
          }}
        />
        <label htmlFor="reg-sort">{t.sortierung}</label>
        <select
          id="reg-sort"
          value={sortKey}
          data-testid="register-sort"
          onChange={(event) => {
            setSortKey(event.target.value as SortKey);
          }}
        >
          <option value="datum">{t.sortDatum}</option>
          <option value="titel">{t.sortTitel}</option>
          <option value="wortzahl">{t.sortWortzahl}</option>
        </select>
        <button
          type="button"
          data-testid="register-new-note"
          onClick={() => {
            setShowNote(true);
          }}
        >
          {t.neueNotiz}
        </button>
        {knownTags.length > 0 && (
          <button
            type="button"
            data-testid="register-manage-tags"
            onClick={() => {
              setShowTagRename(true);
            }}
          >
            {t.tagsVerwalten}
          </button>
        )}
      </div>

      <label className="switch-row volltext-toggle">
        <input
          type="checkbox"
          checked={filter.volltext}
          data-testid="register-volltext"
          onChange={(event) => {
            setFilter((f) => ({ ...f, volltext: event.target.checked }));
          }}
        />{' '}
        {t.volltextToggle}
      </label>

      <div className="filter-bar">
        <div className="filter-field">
          <label htmlFor="reg-von">{t.zeitraumVon}</label>
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
          <label htmlFor="reg-bis">{t.zeitraumBis}</label>
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
          <label htmlFor="reg-quelle">{t.quelleLabel}</label>
          <select
            id="reg-quelle"
            value={filter.quelle}
            onChange={(event) => {
              setFilter((f) => ({ ...f, quelle: event.target.value as TranscriptQuelle | '' }));
            }}
          >
            <option value="">{t.quelleAlle}</option>
            <option value="diktat">{texte.format.quelle.diktat}</option>
            <option value="import">{texte.format.quelle.import}</option>
            <option value="manuell">{texte.format.quelle.manuell}</option>
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
            {t.filterZuruecksetzen}
          </button>
        )}
      </div>

      {knownTags.length > 0 && (
        <div className="tag-filter" aria-label={t.tagFilterAria}>
          <span className="tag-filter-label">{t.tagFilterLabel}</span>
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
                    tags: active ? f.tags.filter((tg) => tg !== tag) : [...f.tags, tag],
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

      {sorted === null && listError === null && <p className="placeholder">{t.wirdGeladen}</p>}

      {sorted !== null && sorted.length > 0 && (
        <div className="batch-bar" data-testid="batch-bar">
          <span className="batch-count" data-testid="batch-count">
            {t.ausgewaehlt(selected.size)}
          </span>
          <label htmlFor="batch-format">{t.exportformat}</label>
          <select
            id="batch-format"
            value={batchFormat}
            disabled={batchBusy}
            data-testid="batch-format"
            onChange={(event) => {
              setBatchFormat(event.target.value as BatchFormatChoice);
            }}
          >
            <option value="md">{t.formatMdMitKopf}</option>
            <option value="md-plain">{t.formatMdOhneKopf}</option>
            <option value="txt">{t.formatTxt}</option>
            <option value="pdf">{t.formatPdf}</option>
          </select>
          <button
            type="button"
            disabled={batchBusy || selected.size === 0}
            data-testid="batch-export-selected"
            onClick={() => void runBatchExport([...selected])}
          >
            {t.auswahlExportieren(selected.size)}
          </button>
          <button
            type="button"
            disabled={batchBusy}
            data-testid="batch-export-filtered"
            onClick={() => void runBatchExport(sorted.map((entry) => entry.pfad))}
          >
            {t.gefilterteExportieren(sorted.length)}
          </button>
          {selected.size > 0 && (
            <button
              type="button"
              className="ghost"
              disabled={batchBusy}
              onClick={() => {
                setSelected(new Set());
              }}
            >
              {t.auswahlAufheben}
            </button>
          )}
        </div>
      )}

      {/* Fortschritt des Stapel-Exports (aria-live fuer Screenreader). */}
      <p className="batch-progress" aria-live="polite" data-testid="batch-progress">
        {batchProgress !== null
          ? t.exportFortschritt(batchProgress.fertig, batchProgress.gesamt)
          : ''}
      </p>

      {batchError !== null && (
        <p className="note error" role="alert" data-testid="batch-error">
          {batchError}
        </p>
      )}
      {batchNotice !== null && (
        <div className="note" data-testid="batch-notice">
          <p>{batchNotice}</p>
          {batchRelPfad !== null && (
            <button
              type="button"
              data-testid="batch-reveal"
              onClick={() => void window.voicewall.revealExport(batchRelPfad)}
            >
              {t.imFinderZeigen}
            </button>
          )}
        </div>
      )}

      {sorted !== null &&
        (sorted.length === 0 ? (
          <EmptyRegister hasFilter={filter !== EMPTY_FILTER} />
        ) : (
          <ol className="register-list" data-testid="register-list">
            {sorted.map((entry) => (
              <li key={entry.id} className="register-item">
                <input
                  type="checkbox"
                  className="register-select"
                  checked={selected.has(entry.pfad)}
                  aria-label={t.auswahlAria(entry.titel)}
                  data-testid="register-select"
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSelected((current) => {
                      const next = new Set(current);
                      if (checked) {
                        next.add(entry.pfad);
                      } else {
                        next.delete(entry.pfad);
                      }
                      return next;
                    });
                  }}
                />
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
                    <span className="register-quelle">{texte.format.quelle[entry.quelle]}</span>
                  </span>
                  <span className="register-meta">
                    {formatDate(entry.erstellt, uiSprache)} · {t.wortzahl(entry.wortzahl)}
                  </span>
                  {entry.vorschau.length > 0 && (
                    <span className="register-preview">{entry.vorschau}</span>
                  )}
                  {snippets.has(entry.id) && (
                    <span className="register-snippet" data-testid="register-snippet">
                      {t.volltextTreffer(snippets.get(entry.id) ?? '')}
                    </span>
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

      {showTagRename && (
        <TagRenameDialog
          knownTags={knownTags}
          onClose={() => {
            setShowTagRename(false);
          }}
          onRenamed={() => {
            void refreshAll();
          }}
        />
      )}
    </div>
  );
}

/** Gestalteter Leerzustand mit Kurzanleitung (Hotkey, sprechen, Hotkey). */
function EmptyRegister(props: { readonly hasFilter: boolean }): ReactElement {
  const t = useTexte().register;
  if (props.hasFilter) {
    return (
      <p className="placeholder" data-testid="register-empty">
        {t.leerMitFilter}
      </p>
    );
  }
  return (
    <div className="empty-state" data-testid="register-empty">
      <p className="empty-state-title">{t.leerTitel}</p>
      <p className="lede">{t.leerLede}</p>
      <ol className="kurzanleitung">
        <li>{t.leerSchritt1}</li>
        <li>{t.leerSchritt2}</li>
        <li>{t.leerSchritt3}</li>
      </ol>
      <p className="notice">{t.leerAlternative}</p>
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
  const { sprache: uiSprache, texte } = useSprache();
  const t = texte.register.detail;
  // Sofortmeldungen (E44): Export-Ausgang zusaetzlich als Toast.
  const { showError, showSuccess } = useToast();
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
  const [showEncrypt, setShowEncrypt] = useState(false);
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
      setNotice(t.gespeichert);
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
  }, [detail, titel, body, tags, props, t]);

  const runExport = useCallback(
    async (format: ExportFormat, mitFrontMatter: boolean) => {
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
          const meldung = t.exportiertNach(result.anzeigePfad);
          setNotice(meldung);
          setExportRelPfad(result.relPfad);
          showSuccess(meldung);
        } else {
          setError(result.message);
          showError(result.message);
        }
      } finally {
        setBusy(false);
      }
    },
    [detail, t, showError, showSuccess],
  );

  /** Verschluesselter Export (.vwenc): Passwort kommt aus dem Dialog. */
  const runEncryptedExport = useCallback(
    async (passwort: string) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      setExportRelPfad(null);
      try {
        const result = await window.voicewall.exportDictateEncrypted({
          pfad: detail.pfad,
          passwort,
        });
        if (result.ok) {
          setShowEncrypt(false);
          const meldung = t.verschluesseltExportiert(result.anzeigePfad);
          setNotice(meldung);
          setExportRelPfad(result.relPfad);
          showSuccess(meldung);
        } else {
          setError(result.message);
          showError(result.message);
          setShowEncrypt(false);
        }
      } finally {
        setBusy(false);
      }
    },
    [detail, t, showError, showSuccess],
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
          {t.zurueck}
        </button>
      </div>
      <h2 className="view-title" tabIndex={-1} ref={headingRef} data-testid="detail-title">
        {editing ? t.bearbeitenTitel : meta.titel}
      </h2>

      {!editing ? (
        <>
          <table className="proto-table detail-meta">
            <tbody>
              <tr>
                <th scope="row">{t.zeileErstellt}</th>
                <td>{formatDateTime(meta.erstellt, uiSprache)}</td>
              </tr>
              <tr>
                <th scope="row">{t.zeileGeaendert}</th>
                <td>{formatDateTime(meta.geaendert, uiSprache)}</td>
              </tr>
              <tr>
                <th scope="row">{t.zeileQuelle}</th>
                <td>{texte.format.quelle[meta.quelle]}</td>
              </tr>
              <tr>
                <th scope="row">{t.zeileModell}</th>
                <td className="mono">{meta.modell}</td>
              </tr>
              {meta.ersetzungen !== undefined && meta.ersetzungen.length > 0 && (
                <tr>
                  <th scope="row">{t.zeileErsetzungen}</th>
                  <td className="mono">
                    {meta.ersetzungen.map((eintrag) => (
                      <div key={eintrag}>{eintrag}</div>
                    ))}
                  </td>
                </tr>
              )}
              <tr>
                <th scope="row">{t.zeileDauer}</th>
                <td>
                  {meta.dauer_sekunden > 0 ? t.dauerSekunden(meta.dauer_sekunden) : t.keinWert}
                </td>
              </tr>
              <tr>
                <th scope="row">{t.zeileWortzahl}</th>
                <td>{meta.wortzahl}</td>
              </tr>
              {meta.ziel_app !== undefined && (
                <tr>
                  <th scope="row">{t.zeileZielApp}</th>
                  <td>{meta.ziel_app}</td>
                </tr>
              )}
              <tr>
                <th scope="row">{t.zeileVersion}</th>
                <td className="mono" data-testid="detail-version">
                  {meta.version}
                </td>
              </tr>
              <tr>
                <th scope="row">{t.zeileTags}</th>
                <td>
                  {meta.tags.length === 0 ? (
                    t.keinWert
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
          <h3>{t.volltextTitel}</h3>
          <div className="detail-body" data-testid="detail-body">
            {detail.body}
          </div>

          <div className="actions detail-actions">
            <button type="button" className="primary" data-testid="detail-edit" onClick={startEdit}>
              {t.bearbeiten}
            </button>
            <button
              type="button"
              disabled={busy}
              data-testid="export-md"
              onClick={() => void runExport('md', true)}
            >
              {t.exportMd}
            </button>
            <button
              type="button"
              disabled={busy}
              data-testid="export-md-plain"
              onClick={() => void runExport('md', false)}
            >
              {t.exportMdOhne}
            </button>
            <button
              type="button"
              disabled={busy}
              data-testid="export-txt"
              onClick={() => void runExport('txt', false)}
            >
              {t.exportTxt}
            </button>
            <button
              type="button"
              disabled={busy}
              data-testid="export-pdf"
              onClick={() => void runExport('pdf', true)}
            >
              {t.exportPdf}
            </button>
            <button
              type="button"
              disabled={busy}
              data-testid="export-encrypted"
              onClick={() => {
                setShowEncrypt(true);
              }}
            >
              {t.exportVerschluesselt}
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
              {t.inDenPapierkorb}
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
                  {texte.register.imFinderZeigen}
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="field-grid">
          <div className="field">
            <label className="field-label" htmlFor="edit-titel">
              {t.titelLabel} <span className="req">*</span>
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
              {t.textLabel}
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
              {t.tagsLabel}
            </label>
            <div className="tag-editor" data-testid="tag-editor">
              {tags.map((tag) => (
                <span key={tag} className="tag-chip tag-chip-active">
                  {tag}
                  <button
                    type="button"
                    className="tag-remove"
                    aria-label={t.tagEntfernenAria(tag)}
                    onClick={() => {
                      setTags((current) => current.filter((tg) => tg !== tag));
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
                placeholder={t.tagPlatzhalter}
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
              {busy ? t.speichert : t.speichern}
            </button>
            <button type="button" disabled={busy} data-testid="edit-cancel" onClick={cancelEdit}>
              {t.abbrechen}
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
          titel={t.loeschenTitel}
          text={t.loeschenText}
          bestaetigenText={t.loeschenBestaetigen}
          onConfirm={() => {
            setConfirmDelete(false);
            void softDelete();
          }}
          onCancel={() => {
            setConfirmDelete(false);
          }}
        />
      )}

      {showEncrypt && (
        <PasswordDialog
          titel={t.verschluesselnTitel}
          beschreibung={t.verschluesselnBeschreibung}
          warnung={t.verschluesselnWarnung}
          bestaetigenText={t.verschluesselnBestaetigen}
          minLength={VWENC_MIN_PASSWORD_LENGTH}
          mitWiederholung={true}
          busy={busy}
          onSubmit={(passwort) => void runEncryptedExport(passwort)}
          onCancel={() => {
            setShowEncrypt(false);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tag-Batch-Rename ("Tags verwalten", M8)
// ---------------------------------------------------------------------------

function TagRenameDialog(props: {
  readonly knownTags: readonly string[];
  readonly onClose: () => void;
  readonly onRenamed: () => void;
}): ReactElement {
  const t = useTexte().register.tagRename;
  const [alt, setAlt] = useState(props.knownTags[0] ?? '');
  const [neu, setNeu] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<string | null>(null);
  const [fehlerListe, setFehlerListe] = useState<readonly string[]>([]);

  const rename = useCallback(async () => {
    const neuTag = neu.trim().normalize('NFC');
    if (alt.length === 0 || neuTag.length === 0) {
      return;
    }
    setBusy(true);
    setError(null);
    setErgebnis(null);
    setFehlerListe([]);
    try {
      const result = await window.voicewall.renameTag({ alt, neu: neuTag });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const gesamt = result.geaendert + result.papierkorbGeaendert;
      setErgebnis(t.ergebnis(alt, neuTag, gesamt, result.papierkorbGeaendert));
      setFehlerListe(result.fehler);
      setNeu('');
      props.onRenamed();
    } finally {
      setBusy(false);
    }
  }, [alt, neu, props, t]);

  return (
    <div className="modal-overlay" role="presentation" onClick={props.onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tag-rename-title"
        data-testid="tag-rename-dialog"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <h3 id="tag-rename-title">{t.titel}</h3>
        <p className="notice">{t.hinweis}</p>
        <div className="field">
          <label className="field-label" htmlFor="tag-rename-alt">
            {t.bestehenderTag}
          </label>
          <select
            id="tag-rename-alt"
            value={alt}
            disabled={busy}
            data-testid="tag-rename-alt"
            onChange={(event) => {
              setAlt(event.target.value);
            }}
          >
            {props.knownTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="tag-rename-neu">
            {t.neuerName} <span className="req">*</span>
          </label>
          <input
            id="tag-rename-neu"
            type="text"
            maxLength={80}
            value={neu}
            disabled={busy}
            data-testid="tag-rename-neu"
            onChange={(event) => {
              setNeu(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void rename();
              }
            }}
          />
        </div>
        {error !== null && (
          <p className="note error" role="alert" data-testid="tag-rename-error">
            {error}
          </p>
        )}
        {ergebnis !== null && (
          <div className="note" data-testid="tag-rename-ergebnis" aria-live="polite">
            <p>{ergebnis}</p>
            {fehlerListe.length > 0 && (
              <ul>
                {fehlerListe.map((meldung) => (
                  <li key={meldung}>{meldung}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={busy || alt.length === 0 || neu.trim().length === 0}
            data-testid="tag-rename-submit"
            onClick={() => void rename()}
          >
            {busy ? t.benenntUm : t.umbenennen}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={props.onClose}
            data-testid="tag-rename-close"
          >
            {t.schliessen}
          </button>
        </div>
      </div>
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
  const t = useTexte().register.notiz;
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
        <h3 id="note-title">{t.titel}</h3>
        <div className="field">
          <label className="field-label" htmlFor="note-titel">
            {t.titelLabel} <span className="req">*</span>
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
            {t.textLabel}
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
            {busy ? t.speichert : t.anlegen}
          </button>
          <button type="button" disabled={busy} onClick={props.onClose}>
            {t.abbrechen}
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
  const texte = useTexte();
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
            {texte.register.detail.abbrechen}
          </button>
        </div>
      </div>
    </div>
  );
}
