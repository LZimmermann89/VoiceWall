/**
 * Verwaltungs-UI-Container (M7, ABARBEITUNG 4.8): Firmen-Umschalter (oben,
 * prominent), Ansichts-Navigation (Diktat, Register, Papierkorb, Beleg) und
 * die jeweils aktive Ansicht. Wirkt wie ein Prüfregister/Aktenverzeichnis;
 * die eine sichtbare H1 trägt die App-Shell, jede Ansicht eine H2.
 *
 * Barrierefreiheit: die Navigation ist per Tastatur bedienbar, beim
 * Ansichtswechsel erhält die Ansichts-Überschrift den Fokus (Fokus-Management),
 * der aktive Reiter ist per aria-current markiert.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import type { CompanyListView } from '../../shared/company';
import type { AppStatus, ModelProgress, SystemInfo } from '../../shared/schema';
import { BelegView } from './BelegView';
import { DiktatView } from './DiktatView';
import { RegisterView } from './RegisterView';
import { TrashView } from './TrashView';

type ManageTab = 'diktat' | 'register' | 'papierkorb' | 'beleg';

const TAB_LABELS: Record<ManageTab, string> = {
  diktat: 'Diktat',
  register: 'Register',
  papierkorb: 'Papierkorb',
  beleg: 'Beleg',
};

const TAB_ORDER: readonly ManageTab[] = ['diktat', 'register', 'papierkorb', 'beleg'];

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

  const [tab, setTab] = useState<ManageTab>('diktat');
  const [busy, setBusy] = useState(false);
  const [companyNotice, setCompanyNotice] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Fokus-Management: beim Ansichtswechsel die Ansichts-Ueberschrift fokussieren.
  useEffect(() => {
    const heading = contentRef.current?.querySelector<HTMLElement>('.view-title');
    heading?.focus();
  }, [tab]);

  // Datenaenderungen einer Ansicht (Soft-Delete, Wiederherstellen) sollen den
  // Firmenstatus (Auto-Speichern) aktuell halten; die Ansichten laden ihre
  // Liste selbst neu bzw. beim Reiterwechsel (Remount). Bewusst KEIN Remount
  // per key erzwingen, damit Detail-/Bearbeiten-Zustaende erhalten bleiben.
  const onDataChanged = useCallback(() => {
    void onRefreshCompanies();
  }, [onRefreshCompanies]);

  const activate = useCallback(
    async (pfad: string) => {
      setBusy(true);
      setCompanyNotice(null);
      try {
        const result = await window.voicewall.setActiveCompany(pfad);
        if (!result.ok) {
          setCompanyNotice(result.message);
        }
        await onRefreshCompanies();
      } finally {
        setBusy(false);
      }
    },
    [onRefreshCompanies],
  );

  const firmen = companies?.firmen ?? [];
  const aktiveFirma = firmen.find((firma) => firma.aktiv) ?? null;

  const setLanguage = useCallback(
    async (sprache: 'de' | 'en') => {
      setBusy(true);
      setCompanyNotice(null);
      try {
        const result = await window.voicewall.setCompanyLanguage(sprache);
        if (!result.ok) {
          setCompanyNotice(result.message);
        } else if (sprache === 'en') {
          setCompanyNotice(
            'Diktatsprache auf Englisch umgestellt (mehrsprachiges Originalmodell). Falls das Modell noch fehlt, startet beim nächsten Diktat bzw. über "Modelle laden und Engine starten" ein einmaliger Download von ca. 574 MB.',
          );
        } else {
          setCompanyNotice('Diktatsprache auf Deutsch umgestellt (deutsch-optimiertes Modell).');
        }
        await onRefreshCompanies();
        await onRefreshStatus();
      } finally {
        setBusy(false);
      }
    },
    [onRefreshCompanies, onRefreshStatus],
  );

  return (
    <div className="manage-layout">
      {/* Firmen-Umschalter (prominent, oben) ---------------------------- */}
      <div className="company-switcher" aria-label="Firma wählen">
        <span className="company-switcher-label">Firma</span>
        {firmen.length === 0 ? (
          <span className="placeholder" data-testid="company-list-empty">
            Noch keine Firma angelegt.
          </span>
        ) : (
          <ul className="company-tabs" data-testid="company-list">
            {firmen.map((firma) => (
              <li key={firma.pfad}>
                {firma.aktiv ? (
                  <span className="company-tab company-tab-active" aria-current="true">
                    {firma.anzeigename}
                    {firma.sprache === 'en' ? ' (EN)' : ''}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="company-tab"
                    disabled={busy}
                    onClick={() => void activate(firma.pfad)}
                  >
                    {firma.anzeigename}
                    {firma.sprache === 'en' ? ' (EN)' : ''}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {aktiveFirma !== null && (
          <label className="switch-row company-language">
            Diktatsprache{' '}
            <select
              value={aktiveFirma.sprache}
              disabled={busy}
              data-testid="company-language-select"
              onChange={(event) => void setLanguage(event.target.value === 'en' ? 'en' : 'de')}
            >
              <option value="de">Deutsch</option>
              <option value="en">Englisch</option>
            </select>
          </label>
        )}
        <span className="header-spacer" />
        <label className="switch-row company-autosave">
          <input
            type="checkbox"
            checked={companies?.autoSpeichern ?? false}
            disabled={busy || firmen.length === 0}
            data-testid="dictate-auto-save"
            onChange={(event) =>
              void (async () => {
                setBusy(true);
                try {
                  await window.voicewall.setDictateAutoSave(event.target.checked);
                  await onRefreshCompanies();
                } finally {
                  setBusy(false);
                }
              })()
            }
          />{' '}
          Diktate automatisch speichern
        </label>
        <button
          type="button"
          className="primary"
          onClick={props.onAddCompany}
          data-testid="add-company"
        >
          Neue Firma einrichten
        </button>
      </div>
      {companyNotice !== null && (
        <p className="notice company-notice" data-testid="company-notice">
          {companyNotice}
        </p>
      )}

      {/* Ansichts-Navigation ------------------------------------------- */}
      <nav className="manage-nav" aria-label="Verwaltungsbereiche">
        {TAB_ORDER.map((entry) => (
          <button
            type="button"
            key={entry}
            className={`manage-nav-tab${tab === entry ? ' manage-nav-tab-active' : ''}`}
            aria-current={tab === entry ? 'page' : undefined}
            data-testid={`nav-${entry}`}
            onClick={() => {
              setTab(entry);
            }}
          >
            {TAB_LABELS[entry]}
          </button>
        ))}
      </nav>

      {/* Aktive Ansicht ------------------------------------------------- */}
      <div className="manage-content" ref={contentRef}>
        {tab === 'diktat' && (
          <DiktatView
            status={status}
            companies={companies}
            progress={progress}
            systemInfo={systemInfo}
            onRefreshStatus={onRefreshStatus}
            onRefreshCompanies={onRefreshCompanies}
          />
        )}
        {/* Key nach aktiver Firma: ein Firmenwechsel laedt den getrennten
            Bestand frisch (Remount), Datenaenderungen innerhalb einer Firma
            erhalten dagegen den Detail-/Bearbeiten-Zustand. */}
        {tab === 'register' && (
          <RegisterView
            key={`register-${companies?.aktiveFirma ?? 'none'}`}
            onDataChanged={onDataChanged}
          />
        )}
        {tab === 'papierkorb' && (
          <TrashView
            key={`trash-${companies?.aktiveFirma ?? 'none'}`}
            onDataChanged={onDataChanged}
          />
        )}
        {tab === 'beleg' && <BelegView />}
      </div>
    </div>
  );
}
