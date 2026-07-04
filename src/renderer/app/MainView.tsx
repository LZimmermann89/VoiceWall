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
import { ModelleView } from './ModelleView';
import { useTexte } from './i18n';
import { RegisterView } from './RegisterView';
import { useToast } from './Toasts';
import { TrashView } from './TrashView';

type ManageTab = 'diktat' | 'register' | 'papierkorb' | 'modelle' | 'beleg';

const TAB_ORDER: readonly ManageTab[] = ['diktat', 'register', 'papierkorb', 'modelle', 'beleg'];

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
  const texte = useTexte();
  // Sofortmeldungen (E44): Fehler beim Firmen-/Sprachwechsel zusaetzlich
  // als Toast; die Inline-Notiz bleibt der Detail-Ort.
  const { showError } = useToast();

  const tabLabels: Record<ManageTab, string> = {
    diktat: texte.verwaltung.tabDiktat,
    register: texte.verwaltung.tabRegister,
    papierkorb: texte.verwaltung.tabPapierkorb,
    modelle: texte.verwaltung.tabModelle,
    beleg: texte.verwaltung.tabBeleg,
  };

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
          showError(result.message);
        }
        await onRefreshCompanies();
      } finally {
        setBusy(false);
      }
    },
    [onRefreshCompanies, showError],
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
          showError(result.message);
        } else if (sprache === 'en') {
          setCompanyNotice(texte.verwaltung.diktatspracheUmgestelltEn);
        } else {
          setCompanyNotice(texte.verwaltung.diktatspracheUmgestelltDe);
        }
        await onRefreshCompanies();
        await onRefreshStatus();
      } finally {
        setBusy(false);
      }
    },
    [onRefreshCompanies, onRefreshStatus, texte, showError],
  );

  return (
    <div className="manage-layout">
      {/* Firmen-Umschalter (prominent, oben) ---------------------------- */}
      <div className="company-switcher" aria-label={texte.verwaltung.firmaWaehlenAria}>
        <span className="company-switcher-label">{texte.verwaltung.firmaLabel}</span>
        {firmen.length === 0 ? (
          <span className="placeholder" data-testid="company-list-empty">
            {texte.verwaltung.keineFirma}
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
            {texte.verwaltung.diktatspracheLabel}{' '}
            <select
              value={aktiveFirma.sprache}
              disabled={busy}
              data-testid="company-language-select"
              onChange={(event) => void setLanguage(event.target.value === 'en' ? 'en' : 'de')}
            >
              <option value="de">{texte.verwaltung.diktatspracheDeutsch}</option>
              <option value="en">{texte.verwaltung.diktatspracheEnglisch}</option>
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
          {texte.verwaltung.autoSpeichern}
        </label>
        <button
          type="button"
          className="primary"
          onClick={props.onAddCompany}
          data-testid="add-company"
        >
          {texte.verwaltung.neueFirma}
        </button>
      </div>
      {companyNotice !== null && (
        <p className="notice company-notice" data-testid="company-notice">
          {companyNotice}
        </p>
      )}

      {/* Ansichts-Navigation ------------------------------------------- */}
      <nav className="manage-nav" aria-label={texte.verwaltung.navAria}>
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
            {tabLabels[entry]}
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
        {tab === 'modelle' && <ModelleView progress={progress} onRefreshStatus={onRefreshStatus} />}
        {tab === 'beleg' && <BelegView />}
      </div>
    </div>
  );
}
