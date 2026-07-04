/**
 * First-Run-Wizard (M6, ABARBEITUNG 4.2): mehrstufig, jede Stufe validiert
 * vor "Weiter". KEIN Schritt schreibt vor der Bestätigung Konfiguration
 * oder Firmendaten; dokumentierte Ausnahmen sind der explizite
 * Modell-Download (Schritt Modell; Infrastruktur, keine Nutzer-/Firmendaten)
 * und die Sprachwahl in Schritt 0 (Paket B2: die UI-Sprache wirkt sofort
 * und wird sofort persistiert, damit die gesamte Einrichtung in der
 * gewählten Sprache abläuft). Zurück-Navigation erhält alle Eingaben;
 * Abbruch ist möglich.
 *
 * Schritt 0 (nur First-Run): Sprache / Language, bewusst zweisprachig
 * beschriftet. Die Wahl stellt die Oberfläche live um und schlägt die
 * Diktatsprache im späteren Sprache-Schritt entsprechend vor
 * (überschreibbar; UI-Sprache und Diktatsprache bleiben unabhängig).
 *
 * Barrierefreiheit (Kritik D4): komplette Tastatur-Bedienbarkeit, sichtbare
 * Fokus-Zustaende (styles.css), genau eine H1 je Ansicht (App-Shell),
 * Schritt-Überschriften erhalten beim Wechsel den Fokus, Download-Status
 * wird per aria-live angesagt, Fehler haengen per aria-describedby am Feld.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import { EMAIL_LAX_PATTERN, type CreateCompanyResult } from '../../shared/company';
import type { Uebersetzung } from '../../shared/i18n';
import type { AppStatus, DictationLanguage, ModelProgress, SystemInfo } from '../../shared/schema';
import type { WizardMode } from './App';
import { formatAccelerator, formatBytes } from './format';
import { useSprache } from './i18n';

type StepId =
  | 'sprachwahl'
  | 'willkommen'
  | 'firma'
  | 'speicherort'
  | 'sprache'
  | 'modell'
  | 'hotkey'
  | 'bedienungshilfen'
  | 'zusammenfassung';

const DEFAULT_HOTKEY = 'CommandOrControl+Shift+D';

interface WizardProps {
  readonly mode: WizardMode;
  readonly status: AppStatus | null;
  readonly systemInfo: SystemInfo | null;
  readonly progress: ModelProgress | null;
  readonly onRefreshStatus: () => Promise<void>;
  readonly onFinished: () => Promise<void>;
  /** Abbrechen (nur im Nachruestmodus; im First-Run schließt "Beenden"). */
  readonly onCancel: (() => void) | null;
}

interface ApplyOutcome {
  readonly pfad: string;
  readonly ordnername: string;
  readonly uebernommen: boolean;
  readonly hinweise: readonly string[];
}

export function Wizard(props: WizardProps): ReactElement {
  const { mode, status, systemInfo, progress, onRefreshStatus, onFinished, onCancel } = props;
  const { sprache: uiSprache, setSprache: setUiSprache, texte } = useSprache();
  const isMac = systemInfo?.platform === 'darwin';

  const steps = useMemo<readonly StepId[]>(() => {
    if (mode === 'add-company') {
      return ['firma', 'speicherort', 'zusammenfassung'];
    }
    const full: StepId[] = [
      'sprachwahl',
      'willkommen',
      'firma',
      'speicherort',
      'sprache',
      'modell',
      'hotkey',
    ];
    if (isMac) {
      full.push('bedienungshilfen');
    }
    full.push('zusammenfassung');
    return full;
  }, [mode, isMac]);

  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ApplyOutcome | null>(null);

  // Schritt 1: Einwilligung (geschrieben erst bei "Einrichten").
  const [consentChecked, setConsentChecked] = useState(false);

  // Schritt 2: Firmendaten.
  const [name, setName] = useState('');
  const [ordnername, setOrdnername] = useState('');
  const [ordnernameEdited, setOrdnernameEdited] = useState(false);
  const [preview, setPreview] = useState<{ ok: boolean; text: string } | null>(null);
  const [ansprechpartner, setAnsprechpartner] = useState('');
  const [email, setEmail] = useState('');
  const [standort, setStandort] = useState('');
  const [hinweis, setHinweis] = useState('');

  // Schritt 3: Speicherort.
  const [syncInfo, setSyncInfo] = useState<{ synchronisiert: boolean; hinweis: string | null }>({
    synchronisiert: false,
    hinweis: null,
  });
  const [syncChecked, setSyncChecked] = useState(false);
  const [strategie, setStrategie] = useState<'desktop' | 'lokal-mit-verknuepfung'>('desktop');

  // Schritt 4: Diktatsprache (Deutsch empfohlen und Standard, Paket B1).
  // Schritt 0 (Sprachwahl) schlaegt sie entsprechend vor (ueberschreibbar).
  const [sprache, setSprache] = useState<DictationLanguage>('de');

  // Schritt 5: Modellwahl.
  const [modell, setModell] = useState<'q5_0' | 'fp16'>('q5_0');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Schritt 6: Hotkey.
  const [hotkey, setHotkey] = useState(DEFAULT_HOTKEY);
  const [hotkeyTest, setHotkeyTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [recording, setRecording] = useState(false);

  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const currentStep: StepId = outcome !== null ? 'zusammenfassung' : (steps[stepIndex] ?? 'firma');

  // Fokus-Management: beim Schrittwechsel erhält die Überschrift den Fokus.
  useEffect(() => {
    headingRef.current?.focus();
  }, [stepIndex, outcome]);

  // Live-Vorschau des sanitisierten Ordnernamens (IPC, leicht entprellt).
  useEffect(() => {
    const source = ordnernameEdited ? ordnername : name;
    if (source.trim().length === 0) {
      setPreview(null);
      return;
    }
    const timer = window.setTimeout(() => {
      void window.voicewall.previewCompanyName(source.trim()).then((result) => {
        if (result.ok) {
          setPreview({ ok: true, text: result.ordnername });
          if (!ordnernameEdited) {
            setOrdnername(result.ordnername);
          }
        } else {
          setPreview({ ok: false, text: result.message });
        }
      });
    }, 150);
    return () => {
      window.clearTimeout(timer);
    };
  }, [name, ordnername, ordnernameEdited]);

  // Sync-Erkennung beim Betreten des Speicherort-Schritts (einmalig).
  useEffect(() => {
    if (currentStep !== 'speicherort' || syncChecked) {
      return;
    }
    void window.voicewall.checkDesktopSync().then((result) => {
      setSyncInfo({ synchronisiert: result.synchronisiert, hinweis: result.hinweis });
      setStrategie(result.synchronisiert ? 'lokal-mit-verknuepfung' : 'desktop');
      setSyncChecked(true);
    });
  }, [currentStep, syncChecked]);

  const testHotkey = useCallback(
    async (accelerator: string) => {
      const result = await window.voicewall.testHotkey(accelerator);
      setHotkeyTest(
        result.ok
          ? { ok: true, message: texte.wizard.hotkey.testOk }
          : { ok: false, message: result.message },
      );
    },
    [texte],
  );

  // Hotkey-Schritt: beim Betreten die aktuelle Kombination einmal live testen.
  const hotkeyStepTested = useRef(false);
  useEffect(() => {
    if (currentStep !== 'hotkey') {
      hotkeyStepTested.current = false;
      return;
    }
    if (hotkeyStepTested.current) {
      return;
    }
    hotkeyStepTested.current = true;
    void testHotkey(hotkey);
  }, [currentStep, hotkey, testHotkey]);

  // ------------------------------------------------------------------
  // Validierung je Schritt (steuert den Weiter-Knopf)
  // ------------------------------------------------------------------
  const nameLength = Array.from(name.trim()).length;
  const nameValid = nameLength >= 1 && nameLength <= 120;
  const emailValid = email.trim().length === 0 || EMAIL_LAX_PATTERN.test(email.trim());
  const firmaValid = nameValid && emailValid && preview?.ok === true;

  const models = status?.models ?? [];
  const vadPresent = models.some((entry) => entry.id === 'silero-vad' && entry.present);
  const selectedModelId =
    sprache === 'en'
      ? 'turbo-q5_0-multilingual'
      : modell === 'fp16'
        ? 'whisper-fp16'
        : 'whisper-q5';
  const selectedPresent = models.some((entry) => entry.id === selectedModelId && entry.present);
  const modelsReadyForChoice = vadPresent && selectedPresent;

  const canProceed = ((): boolean => {
    switch (currentStep) {
      case 'willkommen':
        return consentChecked;
      case 'firma':
        return firmaValid;
      case 'speicherort':
        return syncChecked;
      case 'modell':
        return modelsReadyForChoice && !downloading;
      default:
        return true;
    }
  })();

  // ------------------------------------------------------------------
  // Aktionen
  // ------------------------------------------------------------------
  const startDownload = useCallback(async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      // Die deutsche Modellwahl (q5_0/fp16) betrifft nur die Sprache Deutsch;
      // Englisch nutzt immer das mehrsprachige Originalmodell.
      if (sprache === 'de') {
        const choiceResult = await window.voicewall.setModelChoice(modell);
        if (!choiceResult.ok) {
          setDownloadError(choiceResult.message);
          return;
        }
      }
      const result = await window.voicewall.prepareModels(sprache);
      if (!result.ok) {
        setDownloadError(result.message);
      }
    } finally {
      setDownloading(false);
      await onRefreshStatus();
    }
  }, [modell, sprache, onRefreshStatus]);

  const applySetup = useCallback(async () => {
    setBusy(true);
    setApplyError(null);
    const hinweise: string[] = [];
    try {
      if (mode === 'first-run') {
        if (!(status?.consentGranted ?? false)) {
          const consent = await window.voicewall.grantConsent();
          if (!consent.ok) {
            hinweise.push(consent.message);
          }
        }
        const choice = await window.voicewall.setModelChoice(modell);
        if (!choice.ok) {
          hinweise.push(choice.message);
        }
        if (hotkey !== (status?.hotkey.accelerator ?? DEFAULT_HOTKEY)) {
          const hotkeyResult = await window.voicewall.setHotkey(hotkey);
          if (!hotkeyResult.ok) {
            hinweise.push(hotkeyResult.message);
          }
        }
      }
      const created: CreateCompanyResult = await window.voicewall.createCompany(
        name.trim(),
        strategie,
        {
          ansprechpartner: ansprechpartner.trim(),
          email: email.trim(),
          standort: standort.trim(),
          hinweis: hinweis.trim(),
        },
        modell,
        ordnernameEdited ? ordnername.trim() : undefined,
        mode === 'first-run' ? sprache : undefined,
      );
      if (!created.ok) {
        setApplyError(
          created.vorschlag === null
            ? created.message
            : texte.wizard.zusammenfassung.fehlerMitVorschlag(created.message, created.vorschlag),
        );
        return;
      }
      if (created.syncWarnung !== null) {
        hinweise.push(created.syncWarnung);
      }
      if (created.verknuepfungHinweis !== null) {
        hinweise.push(created.verknuepfungHinweis);
      }
      setOutcome({
        pfad: created.pfad,
        ordnername: created.ordnername,
        uebernommen: created.uebernommen,
        hinweise,
      });
      await onRefreshStatus();
    } finally {
      setBusy(false);
    }
  }, [
    mode,
    status,
    modell,
    sprache,
    hotkey,
    name,
    strategie,
    ansprechpartner,
    email,
    standort,
    hinweis,
    ordnername,
    ordnernameEdited,
    onRefreshStatus,
    texte,
  ]);

  // Hotkey-Recorder: faengt eine Tastenkombination als Accelerator ein.
  const onRecordKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (!recording) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        setRecording(false);
        return;
      }
      const modifiers: string[] = [];
      if (event.metaKey || event.ctrlKey) {
        modifiers.push('CommandOrControl');
      }
      if (event.altKey) {
        modifiers.push('Alt');
      }
      if (event.shiftKey) {
        modifiers.push('Shift');
      }
      const key = normalizeKey(event.key);
      if (key === null || modifiers.length === 0) {
        return; // Noch keine vollständige Kombination.
      }
      const accelerator = [...modifiers, key].join('+');
      setHotkey(accelerator);
      setRecording(false);
      setHotkeyTest(null);
      void testHotkey(accelerator);
    },
    [recording, testHotkey],
  );

  const stepNumber = stepIndex + 1;
  const kicker =
    outcome !== null
      ? texte.wizard.kickerAbgeschlossen
      : texte.wizard.kickerSchritt(
          String(stepNumber).padStart(2, '0'),
          String(steps.length).padStart(2, '0'),
        );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="wizard-layout">
      <nav className="wizard-rail" aria-label={texte.wizard.railAria}>
        <p className="wizard-rail-title" data-testid="wizard-rail-title">
          {texte.wizard.railTitel}
        </p>
        <ol className="wizard-steps">
          {steps.map((step, index) => {
            const state =
              outcome !== null || index < stepIndex
                ? 'done'
                : index === stepIndex
                  ? 'current'
                  : 'pending';
            return (
              <li
                key={step}
                className={
                  state === 'current' ? 'step-current' : state === 'done' ? 'step-done' : ''
                }
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
                {texte.wizard.schrittNamen[step]}
                {state === 'done' && (
                  <span className="step-check" aria-label={texte.wizard.schrittAbgeschlossen}>
                    ✓
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="wizard-page" data-testid="wizard-page" data-step={currentStep}>
        <p className="step-kicker">{kicker}</p>

        {outcome !== null ? (
          <SuccessPage
            outcome={outcome}
            hotkey={hotkey}
            platform={systemInfo?.platform ?? 'darwin'}
            headingRef={headingRef}
            onFinished={onFinished}
            texte={texte}
            uiSprache={uiSprache}
          />
        ) : (
          <>
            {currentStep === 'sprachwahl' && (
              <>
                <h2 ref={headingRef} tabIndex={-1}>
                  {texte.wizard.sprachwahl.titel}
                </h2>
                <p className="lede">{texte.wizard.sprachwahl.lede}</p>
                <div
                  className="choice-list"
                  role="radiogroup"
                  aria-label={texte.wizard.sprachwahl.aria}
                >
                  <label className="choice-card">
                    <input
                      type="radio"
                      name="ui-sprache"
                      value="de"
                      checked={uiSprache === 'de'}
                      data-testid="wizard-ui-language-de"
                      onChange={() => {
                        setUiSprache('de');
                        // Vorschlag fuer die spaetere Diktatsprache.
                        setSprache('de');
                      }}
                    />
                    <span className="choice-title">{texte.wizard.sprachwahl.deutschTitel}</span>
                    <p className="choice-desc">{texte.wizard.sprachwahl.deutschBeschreibung}</p>
                  </label>
                  <label className="choice-card">
                    <input
                      type="radio"
                      name="ui-sprache"
                      value="en"
                      checked={uiSprache === 'en'}
                      data-testid="wizard-ui-language-en"
                      onChange={() => {
                        setUiSprache('en');
                        // Vorschlag fuer die spaetere Diktatsprache.
                        setSprache('en');
                      }}
                    />
                    <span className="choice-title">{texte.wizard.sprachwahl.englischTitel}</span>
                    <p className="choice-desc">{texte.wizard.sprachwahl.englischBeschreibung}</p>
                  </label>
                </div>
                <p className="note">{texte.wizard.sprachwahl.hinweis}</p>
              </>
            )}

            {currentStep === 'willkommen' && (
              <StepWillkommen
                headingRef={headingRef}
                consentChecked={consentChecked}
                onConsentChange={setConsentChecked}
                texte={texte}
              />
            )}

            {currentStep === 'firma' && (
              <>
                <h2 ref={headingRef} tabIndex={-1}>
                  {texte.wizard.firma.titel}
                </h2>
                <p className="lede">{texte.wizard.firma.lede}</p>
                <div className="field-grid">
                  <div className="field">
                    <label className="field-label" htmlFor="wz-name">
                      {texte.wizard.firma.nameLabel} <span className="req">*</span>
                    </label>
                    <input
                      id="wz-name"
                      type="text"
                      value={name}
                      maxLength={120}
                      data-testid="wizard-company-name"
                      aria-invalid={name.length > 0 && !nameValid}
                      aria-describedby="wz-name-hint"
                      placeholder={texte.wizard.firma.namePlatzhalter}
                      onChange={(event) => {
                        setName(event.target.value);
                      }}
                    />
                    <p className="field-hint" id="wz-name-hint">
                      {texte.wizard.firma.nameHinweis}
                    </p>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="wz-ordnername">
                      {texte.wizard.firma.ordnernameLabel}
                    </label>
                    <input
                      id="wz-ordnername"
                      type="text"
                      value={ordnername}
                      maxLength={120}
                      data-testid="wizard-folder-name"
                      aria-describedby="wz-folder-preview"
                      onChange={(event) => {
                        setOrdnername(event.target.value);
                        setOrdnernameEdited(true);
                      }}
                    />
                    {preview !== null && (
                      <p
                        className={`folder-preview${preview.ok ? '' : ' preview-error'}`}
                        id="wz-folder-preview"
                        data-testid="wizard-folder-preview"
                        aria-live="polite"
                      >
                        {preview.ok
                          ? texte.wizard.firma.ordnerVorschau(preview.text)
                          : preview.text}
                      </p>
                    )}
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="wz-ansprechpartner">
                      {texte.wizard.firma.ansprechpartnerLabel}
                    </label>
                    <input
                      id="wz-ansprechpartner"
                      type="text"
                      value={ansprechpartner}
                      maxLength={120}
                      data-testid="wizard-contact"
                      onChange={(event) => {
                        setAnsprechpartner(event.target.value);
                      }}
                    />
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="wz-email">
                      {texte.wizard.firma.emailLabel}
                    </label>
                    <input
                      id="wz-email"
                      type="email"
                      value={email}
                      maxLength={200}
                      data-testid="wizard-email"
                      aria-invalid={!emailValid}
                      aria-describedby={emailValid ? undefined : 'wz-email-error'}
                      onChange={(event) => {
                        setEmail(event.target.value);
                      }}
                    />
                    {!emailValid && (
                      <p className="field-error" id="wz-email-error" role="alert">
                        {texte.wizard.firma.emailFehler}
                      </p>
                    )}
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="wz-standort">
                      {texte.wizard.firma.standortLabel}
                    </label>
                    <input
                      id="wz-standort"
                      type="text"
                      value={standort}
                      maxLength={120}
                      onChange={(event) => {
                        setStandort(event.target.value);
                      }}
                    />
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="wz-hinweis">
                      {texte.wizard.firma.hinweisLabel}
                    </label>
                    <input
                      id="wz-hinweis"
                      type="text"
                      value={hinweis}
                      maxLength={2000}
                      onChange={(event) => {
                        setHinweis(event.target.value);
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            {currentStep === 'speicherort' && (
              <>
                <h2 ref={headingRef} tabIndex={-1}>
                  {texte.wizard.speicherort.titel}
                </h2>
                <p className="lede">{texte.wizard.speicherort.lede}</p>
                {!syncChecked && (
                  <p className="placeholder">{texte.wizard.speicherort.pruefeSpeicherort}</p>
                )}
                {syncChecked && syncInfo.synchronisiert && (
                  <div className="note warn" data-testid="wizard-sync-warning" role="alert">
                    <p>
                      <strong>{texte.wizard.speicherort.syncErkannt}</strong>
                    </p>
                    <p>{syncInfo.hinweis}</p>
                  </div>
                )}
                {syncChecked && !syncInfo.synchronisiert && (
                  <p className="note" data-testid="wizard-sync-ok">
                    {texte.wizard.speicherort.syncOk}
                  </p>
                )}
                <h3>{texte.wizard.speicherort.frage}</h3>
                <div
                  className="choice-list"
                  role="radiogroup"
                  aria-label={texte.wizard.speicherort.aria}
                >
                  <label className="choice-card">
                    <input
                      type="radio"
                      name="strategie"
                      value="lokal-mit-verknuepfung"
                      checked={strategie === 'lokal-mit-verknuepfung'}
                      data-testid="wizard-strategy-local"
                      onChange={() => {
                        setStrategie('lokal-mit-verknuepfung');
                      }}
                    />
                    <span className="choice-title">
                      {texte.wizard.speicherort.lokalTitel}
                      {syncInfo.synchronisiert && (
                        <span className="badge">{texte.wizard.speicherort.badgeEmpfohlen}</span>
                      )}
                    </span>
                    <p className="choice-desc">{texte.wizard.speicherort.lokalBeschreibung}</p>
                  </label>
                  <label className="choice-card">
                    <input
                      type="radio"
                      name="strategie"
                      value="desktop"
                      checked={strategie === 'desktop'}
                      data-testid="wizard-strategy-desktop"
                      onChange={() => {
                        setStrategie('desktop');
                      }}
                    />
                    <span className="choice-title">
                      {texte.wizard.speicherort.desktopTitel}
                      {!syncInfo.synchronisiert && (
                        <span className="badge">{texte.wizard.speicherort.badgeStandard}</span>
                      )}
                    </span>
                    <p className="choice-desc">
                      {texte.wizard.speicherort.desktopBeschreibung}
                      {syncInfo.synchronisiert ? texte.wizard.speicherort.desktopSyncWarnung : ''}
                    </p>
                  </label>
                </div>
              </>
            )}

            {currentStep === 'sprache' && (
              <>
                <h2 ref={headingRef} tabIndex={-1}>
                  {texte.wizard.sprache.titel}
                </h2>
                <p className="lede">{texte.wizard.sprache.lede}</p>
                <div
                  className="choice-list"
                  role="radiogroup"
                  aria-label={texte.wizard.sprache.aria}
                >
                  <label className="choice-card">
                    <input
                      type="radio"
                      name="sprache"
                      value="de"
                      checked={sprache === 'de'}
                      data-testid="wizard-language-de"
                      onChange={() => {
                        setSprache('de');
                        setDownloadError(null);
                      }}
                    />
                    <span className="choice-title">
                      {texte.wizard.sprache.deutschTitel}{' '}
                      <span className="badge">{texte.wizard.modell.badgeEmpfohlen}</span>
                    </span>
                    <p className="choice-desc">{texte.wizard.sprache.deutschBeschreibung}</p>
                  </label>
                  <label className="choice-card">
                    <input
                      type="radio"
                      name="sprache"
                      value="en"
                      checked={sprache === 'en'}
                      data-testid="wizard-language-en"
                      onChange={() => {
                        setSprache('en');
                        setDownloadError(null);
                      }}
                    />
                    <span className="choice-title">{texte.wizard.sprache.englischTitel}</span>
                    <p className="choice-desc">{texte.wizard.sprache.englischBeschreibung}</p>
                  </label>
                </div>
                <p className="note">{texte.wizard.sprache.hinweis}</p>
              </>
            )}

            {currentStep === 'modell' && (
              <StepModell
                headingRef={headingRef}
                models={models}
                systemInfo={systemInfo}
                sprache={sprache}
                modell={modell}
                onModellChange={(choice) => {
                  setModell(choice);
                  setDownloadError(null);
                }}
                vadPresent={vadPresent}
                selectedPresent={selectedPresent}
                downloading={downloading}
                progress={progress}
                downloadError={downloadError}
                onDownload={() => {
                  void startDownload();
                }}
                texte={texte}
                uiSprache={uiSprache}
              />
            )}

            {currentStep === 'hotkey' && (
              <>
                <h2 ref={headingRef} tabIndex={-1}>
                  {texte.wizard.hotkey.titel}
                </h2>
                <p className="lede">{texte.wizard.hotkey.lede}</p>
                <div className="field">
                  <label className="field-label" htmlFor="wz-hotkey">
                    {texte.wizard.hotkey.label}
                  </label>
                  <input
                    id="wz-hotkey"
                    type="text"
                    className="mono"
                    value={hotkey}
                    data-testid="wizard-hotkey-input"
                    aria-describedby="wz-hotkey-result"
                    onChange={(event) => {
                      setHotkey(event.target.value);
                      setHotkeyTest(null);
                    }}
                  />
                  <p className="field-hint">
                    {texte.wizard.hotkey.anzeigeVor}
                    <kbd>
                      {formatAccelerator(hotkey, systemInfo?.platform ?? 'darwin', uiSprache)}
                    </kbd>
                    {texte.wizard.hotkey.anzeigeNach}
                  </p>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    onClick={() => {
                      setRecording(true);
                    }}
                    onKeyDown={onRecordKeyDown}
                    onBlur={() => {
                      setRecording(false);
                    }}
                    data-testid="wizard-hotkey-record"
                  >
                    {recording ? texte.wizard.hotkey.aufnehmenAktiv : texte.wizard.hotkey.aufnehmen}
                  </button>
                  <button
                    type="button"
                    disabled={hotkey.trim().length === 0}
                    data-testid="wizard-hotkey-test"
                    onClick={() => {
                      void testHotkey(hotkey.trim());
                    }}
                  >
                    {texte.wizard.hotkey.testen}
                  </button>
                </div>
                <div id="wz-hotkey-result" aria-live="polite">
                  {hotkeyTest !== null && (
                    <p
                      className={`note${hotkeyTest.ok ? '' : ' warn'}`}
                      data-testid="wizard-hotkey-result"
                    >
                      {hotkeyTest.message}
                    </p>
                  )}
                </div>
              </>
            )}

            {currentStep === 'bedienungshilfen' && (
              <StepBedienungshilfen
                headingRef={headingRef}
                accessibility={status?.accessibility ?? 'not-applicable'}
                onRefresh={onRefreshStatus}
                texte={texte}
              />
            )}

            {currentStep === 'zusammenfassung' && (
              <>
                <h2 ref={headingRef} tabIndex={-1}>
                  {texte.wizard.zusammenfassung.titel}
                </h2>
                <p className="lede">{texte.wizard.zusammenfassung.lede}</p>
                <table className="proto-table" data-testid="wizard-summary">
                  <tbody>
                    <tr>
                      <th scope="row">{texte.wizard.zusammenfassung.zeileFirma}</th>
                      <td>{name.trim()}</td>
                    </tr>
                    <tr>
                      <th scope="row">{texte.wizard.zusammenfassung.zeileZielordner}</th>
                      <td className="mono">
                        {strategie === 'desktop'
                          ? texte.wizard.zusammenfassung.zielDesktop(ordnername || '?')
                          : texte.wizard.zusammenfassung.zielLokal(ordnername || '?')}
                      </td>
                    </tr>
                    {ansprechpartner.trim().length > 0 && (
                      <tr>
                        <th scope="row">{texte.wizard.zusammenfassung.zeileAnsprechpartner}</th>
                        <td>{ansprechpartner.trim()}</td>
                      </tr>
                    )}
                    {email.trim().length > 0 && (
                      <tr>
                        <th scope="row">{texte.wizard.zusammenfassung.zeileEmail}</th>
                        <td>{email.trim()}</td>
                      </tr>
                    )}
                    {standort.trim().length > 0 && (
                      <tr>
                        <th scope="row">{texte.wizard.zusammenfassung.zeileStandort}</th>
                        <td>{standort.trim()}</td>
                      </tr>
                    )}
                    {mode === 'first-run' && (
                      <>
                        <tr>
                          <th scope="row">{texte.wizard.zusammenfassung.zeileSprache}</th>
                          <td>
                            {sprache === 'en'
                              ? texte.wizard.zusammenfassung.spracheEnglisch
                              : texte.wizard.zusammenfassung.spracheDeutsch}
                          </td>
                        </tr>
                        <tr>
                          <th scope="row">{texte.wizard.zusammenfassung.zeileModell}</th>
                          <td>
                            {sprache === 'en'
                              ? texte.wizard.zusammenfassung.modellMehrsprachig
                              : modell === 'fp16'
                                ? texte.wizard.zusammenfassung.modellFp16
                                : texte.wizard.zusammenfassung.modellQ5}
                          </td>
                        </tr>
                        <tr>
                          <th scope="row">{texte.wizard.zusammenfassung.zeileHotkey}</th>
                          <td className="mono">{hotkey}</td>
                        </tr>
                        <tr>
                          <th scope="row">{texte.wizard.zusammenfassung.zeileEinwilligung}</th>
                          <td className={consentChecked ? 'value-ok' : 'value-warn'}>
                            {consentChecked
                              ? texte.wizard.zusammenfassung.einwilligungWird
                              : texte.wizard.zusammenfassung.einwilligungFehlt}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
                {applyError !== null && (
                  <div className="note error" role="alert" data-testid="wizard-apply-error">
                    <p>{applyError}</p>
                  </div>
                )}
              </>
            )}

            <div className="wizard-nav">
              {onCancel !== null ? (
                <button type="button" className="ghost" onClick={onCancel} disabled={busy}>
                  {texte.wizard.navigation.abbrechen}
                </button>
              ) : (
                <button
                  type="button"
                  className="ghost"
                  disabled={busy}
                  onClick={() => {
                    window.close();
                  }}
                >
                  {texte.wizard.navigation.beenden}
                </button>
              )}
              <span className="nav-spacer" />
              <button
                type="button"
                data-testid="wizard-back"
                disabled={stepIndex === 0 || busy}
                onClick={() => {
                  setApplyError(null);
                  setStepIndex((index) => Math.max(0, index - 1));
                }}
              >
                {texte.wizard.navigation.zurueck}
              </button>
              {currentStep === 'zusammenfassung' ? (
                <button
                  type="button"
                  className="primary"
                  data-testid="wizard-apply"
                  disabled={busy || (mode === 'first-run' && !consentChecked) || !firmaValid}
                  onClick={() => {
                    void applySetup();
                  }}
                >
                  {busy ? texte.wizard.navigation.richteEin : texte.wizard.navigation.einrichten}
                </button>
              ) : (
                <button
                  type="button"
                  className="primary"
                  data-testid="wizard-next"
                  disabled={!canProceed || busy}
                  onClick={() => {
                    setStepIndex((index) => Math.min(steps.length - 1, index + 1));
                  }}
                >
                  {texte.wizard.navigation.weiter}
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/** Übersetzt ein KeyboardEvent.key in eine Electron-Accelerator-Taste. */
function normalizeKey(key: string): string | null {
  if (/^[a-z0-9]$/i.test(key)) {
    return key.toUpperCase();
  }
  if (/^F([1-9]|1\d|2[0-4])$/.test(key)) {
    return key;
  }
  const map: Record<string, string> = {
    ' ': 'Space',
    Enter: 'Enter',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
  };
  return map[key] ?? null;
}

// ---------------------------------------------------------------------------
// Teil-Schritte als eigene Komponenten (Lesbarkeit)
// ---------------------------------------------------------------------------

interface HeadingRefProp {
  readonly headingRef: React.MutableRefObject<HTMLHeadingElement | null>;
}

function StepWillkommen(
  props: HeadingRefProp & {
    readonly consentChecked: boolean;
    readonly onConsentChange: (checked: boolean) => void;
    readonly texte: Uebersetzung;
  },
): ReactElement {
  const t = props.texte.wizard.willkommen;
  return (
    <>
      <h2 ref={props.headingRef} tabIndex={-1}>
        {t.titel}
      </h2>
      <p className="lede">{t.lede}</p>
      <table className="proto-table">
        <tbody>
          <tr>
            <th scope="row">{t.zeileVerarbeitung}</th>
            <td className="value-ok">{t.zeileVerarbeitungWert}</td>
          </tr>
          <tr>
            <th scope="row">{t.zeileCloud}</th>
            <td className="value-ok">{t.zeileCloudWert}</td>
          </tr>
          <tr>
            <th scope="row">{t.zeileAudio}</th>
            <td className="value-ok">{t.zeileAudioWert}</td>
          </tr>
        </tbody>
      </table>
      <div className="note" data-testid="wizard-ai-act">
        <p>
          <strong>{t.aiActTitel}</strong>
          {t.aiActText}
        </p>
      </div>
      <label className="consent-row">
        <input
          type="checkbox"
          checked={props.consentChecked}
          data-testid="wizard-consent"
          onChange={(event) => {
            props.onConsentChange(event.target.checked);
          }}
        />
        <span>{t.einwilligung}</span>
      </label>
    </>
  );
}

function StepModell(
  props: HeadingRefProp & {
    readonly models: AppStatus['models'];
    readonly systemInfo: SystemInfo | null;
    readonly sprache: DictationLanguage;
    readonly modell: 'q5_0' | 'fp16';
    readonly onModellChange: (choice: 'q5_0' | 'fp16') => void;
    readonly vadPresent: boolean;
    readonly selectedPresent: boolean;
    readonly downloading: boolean;
    readonly progress: ModelProgress | null;
    readonly downloadError: string | null;
    readonly onDownload: () => void;
    readonly texte: Uebersetzung;
    readonly uiSprache: 'de' | 'en';
  },
): ReactElement {
  const { systemInfo, uiSprache } = props;
  const t = props.texte.wizard.modell;
  const fp16Erlaubt = systemInfo?.fp16Erlaubt ?? false;
  const q5 = props.models.find((entry) => entry.id === 'whisper-q5');
  const fp16 = props.models.find((entry) => entry.id === 'whisper-fp16');
  const multilingual = props.models.find((entry) => entry.id === 'turbo-q5_0-multilingual');
  const vad = props.models.find((entry) => entry.id === 'silero-vad');
  const ready = props.selectedPresent && props.vadPresent;

  const statusLine = (entry: AppStatus['models'][number] | undefined): ReactElement => (
    <p className="choice-status">
      {entry?.present === true ? (
        <span className="status-ok">{t.statusVorhanden}</span>
      ) : (
        <span className="status-missing">
          {t.statusFehlt(entry !== undefined ? formatBytes(entry.byteSize, uiSprache) : '')}
        </span>
      )}
    </p>
  );

  const progressBlock = (
    <div aria-live="polite">
      {props.downloading && props.progress !== null && (
        <>
          <progress
            max={100}
            value={props.progress.percent ?? 0}
            aria-label={t.downloadAria(props.progress.label)}
          />
          <p className="progress-line" data-testid="wizard-download-progress">
            {t.progressZeile(
              props.progress.label,
              formatBytes(props.progress.receivedBytes, uiSprache),
              props.progress.totalBytes !== null
                ? formatBytes(props.progress.totalBytes, uiSprache)
                : null,
              props.progress.percent !== null ? props.progress.percent.toFixed(0) : null,
            )}
          </p>
        </>
      )}
      {ready && (
        <p className="note" data-testid="wizard-model-ready">
          {t.bereit}
        </p>
      )}
    </div>
  );

  const downloadBlock = (
    <>
      {!ready && (
        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={props.downloading}
            data-testid="wizard-model-download"
            onClick={props.onDownload}
          >
            {props.downloading ? t.laedt : t.ladeKnopf}
          </button>
        </div>
      )}
      {props.downloadError !== null && (
        <div className="note error" role="alert">
          <p>{props.downloadError}</p>
        </div>
      )}
    </>
  );

  const vadHinweis = (
    <p className="field-hint">
      {t.vadHinweis(
        vad !== undefined ? formatBytes(vad.byteSize, uiSprache) : t.vadGroesseUnbekannt,
        props.vadPresent,
      )}
    </p>
  );

  if (props.sprache === 'en') {
    // Englisch: es gibt genau ein passendes Modell (mehrsprachiges Original).
    return (
      <>
        <h2 ref={props.headingRef} tabIndex={-1}>
          {t.titel}
        </h2>
        <p className="lede">{t.ledeEnglisch}</p>
        <div className="choice-list">
          <label className="choice-card">
            <span className="choice-title">
              {t.multilingualTitel} <span className="badge">{t.badgeFuerEnglisch}</span>
            </span>
            <p className="choice-desc" data-testid="wizard-model-multilingual">
              {t.multilingualBeschreibung(
                multilingual !== undefined ? formatBytes(multilingual.byteSize, uiSprache) : '',
              )}
            </p>
            {statusLine(multilingual)}
          </label>
        </div>
        {vadHinweis}
        {progressBlock}
        {downloadBlock}
        <p className="field-hint">{t.downloadHinweisEnglisch}</p>
      </>
    );
  }

  return (
    <>
      <h2 ref={props.headingRef} tabIndex={-1}>
        {t.titel}
      </h2>
      <p className="lede">
        {t.ledeDeutschVor(
          systemInfo !== null
            ? t.hardwareKurz(systemInfo.cpuKerne, systemInfo.ramGb)
            : t.hardwareUnbekannt,
        )}
        <strong>Q5_0</strong>
        {t.ledeDeutschNach}
      </p>
      <div className="choice-list" role="radiogroup" aria-label={t.aria}>
        <label className="choice-card">
          <input
            type="radio"
            name="modell"
            value="q5_0"
            checked={props.modell === 'q5_0'}
            data-testid="wizard-model-q5"
            onChange={() => {
              props.onModellChange('q5_0');
            }}
          />
          <span className="choice-title">
            {t.q5Titel} <span className="badge">{t.badgeEmpfohlen}</span>
          </span>
          <p className="choice-desc">
            {t.q5Beschreibung(q5 !== undefined ? formatBytes(q5.byteSize, uiSprache) : '')}
          </p>
          {statusLine(q5)}
        </label>
        <label className="choice-card">
          <input
            type="radio"
            name="modell"
            value="fp16"
            checked={props.modell === 'fp16'}
            disabled={!fp16Erlaubt}
            data-testid="wizard-model-fp16"
            aria-describedby="wz-fp16-hint"
            onChange={() => {
              props.onModellChange('fp16');
            }}
          />
          <span className="choice-title">{t.fp16Titel}</span>
          <p className="choice-desc" id="wz-fp16-hint">
            {fp16Erlaubt
              ? t.fp16Beschreibung(fp16 !== undefined ? formatBytes(fp16.byteSize, uiSprache) : '')
              : t.fp16Gesperrt}
          </p>
          {fp16Erlaubt && statusLine(fp16)}
        </label>
      </div>
      {vadHinweis}
      {progressBlock}
      {downloadBlock}
      <p className="field-hint">{t.downloadHinweisDeutsch}</p>
    </>
  );
}

function StepBedienungshilfen(
  props: HeadingRefProp & {
    readonly accessibility: AppStatus['accessibility'];
    readonly onRefresh: () => Promise<void>;
    readonly texte: Uebersetzung;
  },
): ReactElement {
  const t = props.texte.wizard.bedienungshilfen;
  const granted = props.accessibility === 'granted';
  return (
    <>
      <h2 ref={props.headingRef} tabIndex={-1}>
        {t.titel}
      </h2>
      <p className="lede">{t.lede}</p>
      <table className="proto-table">
        <tbody>
          <tr>
            <th scope="row">{t.statusZeile}</th>
            <td
              className={granted ? 'value-ok' : 'value-warn'}
              data-testid="wizard-accessibility-status"
            >
              {granted ? t.statusErteilt : t.statusFehlt}
            </td>
          </tr>
        </tbody>
      </table>
      {!granted && (
        <div className="note warn">
          <p>{t.hinweisAbsatz1}</p>
          <p>{t.hinweisAbsatz2}</p>
          <p>{t.hinweisAbsatz3}</p>
        </div>
      )}
      <div className="actions">
        <button
          type="button"
          onClick={() => {
            void window.voicewall.requestAccessibility();
          }}
        >
          {t.freigabeAnfordern}
        </button>
        <button
          type="button"
          onClick={() => {
            void window.voicewall.openAccessibilitySettings();
          }}
        >
          {t.systemeinstellungen}
        </button>
        <button
          type="button"
          data-testid="wizard-accessibility-refresh"
          onClick={() => {
            void props.onRefresh();
          }}
        >
          {t.statusAktualisieren}
        </button>
      </div>
    </>
  );
}

function SuccessPage(props: {
  readonly outcome: ApplyOutcome;
  readonly hotkey: string;
  readonly platform: string;
  readonly headingRef: React.MutableRefObject<HTMLHeadingElement | null>;
  readonly onFinished: () => Promise<void>;
  readonly texte: Uebersetzung;
  readonly uiSprache: 'de' | 'en';
}): ReactElement {
  const t = props.texte.wizard.erfolg;
  const shownHotkey = formatAccelerator(props.hotkey, props.platform, props.uiSprache);
  return (
    <div data-testid="wizard-success">
      <h2 ref={props.headingRef} tabIndex={-1}>
        {t.titel}
      </h2>
      <p className="success-seal">
        {t.siegel(props.outcome.ordnername, props.outcome.uebernommen)}
      </p>
      <p className="mono">{props.outcome.pfad}</p>
      {props.outcome.hinweise.map((hinweisText) => (
        <div className="note warn" key={hinweisText}>
          <p>{hinweisText}</p>
        </div>
      ))}
      <h3>{t.anleitungTitel}</h3>
      <ol className="kurzanleitung">
        <li>
          {t.schritt1Vor}
          <kbd>{shownHotkey}</kbd>
          {t.schritt1Nach}
        </li>
        <li>{t.schritt2}</li>
        <li>
          {t.schritt3Vor}
          <kbd>{shownHotkey}</kbd>
          {t.schritt3Nach}
        </li>
      </ol>
      <details className="selftest">
        <summary>{t.selbsttestTitel}</summary>
        <div className="selftest-body">
          <p>{t.selbsttestIntro}</p>
          <ol>
            <li>
              <strong>{t.selbsttestPunkt1Titel}</strong>
              {t.selbsttestPunkt1}
            </li>
            <li>
              <strong>{t.selbsttestPunkt2Titel}</strong>
              {t.selbsttestPunkt2}
            </li>
            <li>
              <strong>{t.selbsttestPunkt3Titel}</strong>
              {t.selbsttestPunkt3}
            </li>
          </ol>
          <p>{t.selbsttestAusnahme}</p>
        </div>
      </details>
      <div className="wizard-nav">
        <span className="nav-spacer" />
        <button
          type="button"
          className="primary"
          data-testid="wizard-to-main"
          onClick={() => {
            void props.onFinished();
          }}
        >
          {t.zurVerwaltung}
        </button>
      </div>
    </div>
  );
}
