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
 * Die Ansichts-Struktur ist bewusst einfach (view-Zustand statt Router):
 * M7 haengt weitere Ansichten ein, ohne ein Router-Paket zu brauchen.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import type { CompanyListView } from '../../shared/company';
import type { AppStatus, ModelProgress, SystemInfo } from '../../shared/schema';
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

  // Laufende Ereignisse abonnieren.
  useEffect(() => {
    const offStatus = window.voicewall.onStatus(setStatus);
    const offProgress = window.voicewall.onModelProgress(setProgress);
    return () => {
      offStatus();
      offProgress();
    };
  }, []);

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
        ? 'Einrichtungsprotokoll'
        : 'Neue Firma einrichten'
      : 'Verwaltung';

  return (
    <div className="app-frame">
      <header className="app-header">
        <h1 className="wordmark">
          VoiceWall<span className="wordmark-dot">.</span>
        </h1>
        <span className="context-label">{contextLabel}</span>
        <span className="header-spacer" />
        <span className="local-badge" title="Alle Verarbeitung findet auf diesem Rechner statt.">
          100 % lokal
        </span>
      </header>

      <div className="app-content">
        {view === 'loading' && <p className="main-layout placeholder">Wird geladen ...</p>}
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
          Modell-Prüfsumme <span className="mono">{systemInfo?.modellPruefsumme ?? ''}</span>
        </span>
        <span className="stamp-seal">0 externe Verbindungen im Betrieb</span>
        <span>
          {systemInfo !== null
            ? `${systemInfo.platform}/${systemInfo.arch} · ${String(systemInfo.cpuKerne)} Kerne · ${String(systemInfo.ramGb)} GB RAM`
            : ''}
        </span>
      </footer>
    </div>
  );
}
