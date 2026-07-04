/**
 * App-Shell (M6): entscheidet zwischen First-Run-Wizard und Hauptansicht,
 * hält den geteilten App-Zustand (Status, Firmen, Systeminfo, Fortschritt)
 * und rendert Kopfzeile plus Prüfstempel-Fusszeile.
 *
 * First-Run-Erkennung (ABARBEITUNG 4.1 Schritt 8): existiert mindestens eine
 * gültige Firma, startet die App direkt in der Verwaltung; sonst startet der
 * Wizard. Der Wizard ist aus der Verwaltung erneut aufrufbar ("Neue Firma
 * einrichten", ABARBEITUNG 4.6) und durchläuft dann nur die Firmen-Schritte.
 *
 * Seit Paket B2 hält die App-Shell zusätzlich die UI-Sprache: initialisiert
 * aus der globalen Konfiguration (AppStatus.uiLanguage), umschaltbar zur
 * Laufzeit ohne Reload (Wizard-Schritt 0 bzw. Umschalter in der Kopfzeile
 * der Verwaltung), persistiert über config:set-ui-language. Die UI-Sprache
 * ist unabhängig von der Diktatsprache der Firmen.
 *
 * Die Ansichts-Struktur ist bewusst einfach (view-Zustand statt Router):
 * M7 haengt weitere Ansichten ein, ohne ein Router-Paket zu brauchen.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { CompanyListView } from '../../shared/company';
import { KATALOGE } from '../../shared/i18n';
import type { AppStatus, ModelProgress, SystemInfo, UiLanguage } from '../../shared/schema';
import { I18nProvider, type I18nContextValue } from './i18n';
import { MainView } from './MainView';
import { Wizard } from './Wizard';

type View = 'loading' | 'wizard' | 'main';
export type WizardMode = 'first-run' | 'add-company';

export function App(): ReactElement {
  const [view, setView] = useState<View>('loading');
  const [wizardMode, setWizardMode] = useState<WizardMode>('first-run');
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [companies, setCompanies] = useState<CompanyListView | null>(null);
  const [progress, setProgress] = useState<ModelProgress | null>(null);

  // UI-Sprache (Paket B2): Start mit Deutsch, dann einmalig aus der
  // persistierten Konfiguration uebernommen; Wechsel wirken sofort lokal
  // und werden parallel persistiert (kein Warten auf den Roundtrip).
  const [sprache, setSpracheState] = useState<UiLanguage>('de');
  const spracheAdopted = useRef(false);

  const refreshStatus = useCallback(async () => {
    setStatus(await window.voicewall.getStatus());
  }, []);

  const refreshCompanies = useCallback(async (): Promise<CompanyListView> => {
    const list = await window.voicewall.listCompanies();
    setCompanies(list);
    return list;
  }, []);

  // Initialzustand laden und die First-Run-Entscheidung treffen.
  useEffect(() => {
    void (async () => {
      const [, list, info] = await Promise.all([
        refreshStatus(),
        refreshCompanies(),
        window.voicewall.systemInfo(),
      ]);
      setSystemInfo(info);
      setView(list.firmen.length > 0 ? 'main' : 'wizard');
      setWizardMode('first-run');
    })();
  }, [refreshStatus, refreshCompanies]);

  // Persistierte UI-Sprache genau einmal uebernehmen (danach fuehrt der
  // lokale Zustand, damit ein Live-Wechsel nicht durch einen noch
  // laufenden Status-Broadcast zurueckgesetzt wird).
  useEffect(() => {
    if (status !== null && !spracheAdopted.current) {
      spracheAdopted.current = true;
      setSpracheState(status.uiLanguage);
    }
  }, [status]);

  // Laufende Ereignisse abonnieren.
  useEffect(() => {
    const offStatus = window.voicewall.onStatus(setStatus);
    const offProgress = window.voicewall.onModelProgress(setProgress);
    return () => {
      offStatus();
      offProgress();
    };
  }, []);

  const setSprache = useCallback((next: UiLanguage) => {
    spracheAdopted.current = true;
    setSpracheState(next);
    // Persistenz im Hintergrund; ein Fehlschlag laesst die Live-Umschaltung
    // unangetastet (naechster Start faellt dann auf den alten Wert zurueck).
    void window.voicewall.setUiLanguage(next);
  }, []);

  const i18n = useMemo<I18nContextValue>(
    () => ({ sprache, texte: KATALOGE[sprache], setSprache }),
    [sprache, setSprache],
  );
  const texte = i18n.texte;

  const openAddCompanyWizard = useCallback(() => {
    setWizardMode('add-company');
    setView('wizard');
  }, []);

  const finishWizard = useCallback(async () => {
    await refreshCompanies();
    await refreshStatus();
    setView('main');
  }, [refreshCompanies, refreshStatus]);

  const cancelWizard = useCallback(() => {
    // Abbruch (nur im Nachruestmodus sinnvoll): zurück zur Verwaltung.
    setView('main');
  }, []);

  const contextLabel =
    view === 'wizard'
      ? wizardMode === 'first-run'
        ? texte.app.kontextEinrichtung
        : texte.app.kontextNeueFirma
      : texte.app.kontextVerwaltung;

  return (
    <I18nProvider value={i18n}>
      <div className="app-frame">
        <header className="app-header">
          <h1 className="wordmark">
            VoiceWall<span className="wordmark-dot">.</span>
          </h1>
          <span className="context-label">{contextLabel}</span>
          <span className="header-spacer" />
          {view === 'main' && (
            <label className="switch-row ui-language">
              {texte.app.sprachumschalterLabel}{' '}
              <select
                value={sprache}
                data-testid="ui-language-select"
                onChange={(event) => {
                  i18n.setSprache(event.target.value === 'en' ? 'en' : 'de');
                }}
              >
                <option value="de">{texte.app.sprachumschalterDeutsch}</option>
                <option value="en">{texte.app.sprachumschalterEnglisch}</option>
              </select>
            </label>
          )}
          <span className="local-badge" title={texte.app.lokalBadgeTitel}>
            {texte.app.lokalBadge}
          </span>
        </header>

        <div className="app-content">
          {view === 'loading' && <p className="main-layout placeholder">{texte.app.wirdGeladen}</p>}
          {view === 'wizard' && (
            <Wizard
              mode={wizardMode}
              status={status}
              systemInfo={systemInfo}
              progress={progress}
              onRefreshStatus={refreshStatus}
              onFinished={finishWizard}
              onCancel={wizardMode === 'add-company' ? cancelWizard : null}
            />
          )}
          {view === 'main' && (
            <MainView
              status={status}
              companies={companies}
              progress={progress}
              systemInfo={systemInfo}
              onRefreshStatus={refreshStatus}
              onRefreshCompanies={async () => {
                await refreshCompanies();
              }}
              onAddCompany={openAddCompanyWizard}
            />
          )}
        </div>

        <footer className="app-footer">
          <span>VoiceWall {systemInfo?.appVersion ?? ''}</span>
          <span>
            {texte.app.fussModellPruefsumme}{' '}
            <span className="mono">{systemInfo?.modellPruefsumme ?? ''}</span>
          </span>
          <span className="stamp-seal">{texte.app.fussNullVerbindungen}</span>
          <span>
            {systemInfo !== null
              ? texte.app.fussHardware(
                  `${systemInfo.platform}/${systemInfo.arch}`,
                  systemInfo.cpuKerne,
                  systemInfo.ramGb,
                )
              : ''}
          </span>
        </footer>
      </div>
    </I18nProvider>
  );
}
