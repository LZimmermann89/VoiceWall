/**
 * First-Run-Wizard (M6, ABARBEITUNG 4.2): mehrstufig, jede Stufe validiert
 * vor "Weiter". KEIN Schritt schreibt vor der Bestätigung Konfiguration
 * oder Firmendaten; einzige dokumentierte Ausnahme ist der explizite
 * Modell-Download (Schritt Modell), der die geteilten Modelldateien in den
 * App-Support-Ordner legt (Infrastruktur, keine Nutzer-/Firmendaten).
 * Zurück-Navigation erhält alle Eingaben; Abbruch ist möglich.
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
import type { AppStatus, ModelProgress, SystemInfo } from '../../shared/schema';
import type { WizardMode } from './App';
import { formatAccelerator, formatBytes } from './format';

type StepId =
  | 'willkommen'
  | 'firma'
  | 'speicherort'
  | 'sprache'
  | 'modell'
  | 'hotkey'
  | 'bedienungshilfen'
  | 'zusammenfassung';

const STEP_LABELS: Record<StepId, string> = {
  willkommen: 'Willkommen',
  firma: 'Firmendaten',
  speicherort: 'Speicherort',
  sprache: 'Sprache',
  modell: 'Modell',
  hotkey: 'Tastenkürzel',
  bedienungshilfen: 'Bedienungshilfen',
  zusammenfassung: 'Zusammenfassung',
};

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
  const isMac = systemInfo?.platform === 'darwin';

  const steps = useMemo<readonly StepId[]>(() => {
    if (mode === 'add-company') {
      return ['firma', 'speicherort', 'zusammenfassung'];
    }
    const full: StepId[] = ['willkommen', 'firma', 'speicherort', 'sprache', 'modell', 'hotkey'];
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

  const testHotkey = useCallback(async (accelerator: string) => {
    const result = await window.voicewall.testHotkey(accelerator);
    setHotkeyTest(
      result.ok
        ? { ok: true, message: 'Diese Tastenkombination ist frei und funktioniert.' }
        : { ok: false, message: result.message },
    );
  }, []);

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
  const selectedModelId = modell === 'fp16' ? 'whisper-fp16' : 'whisper-q5';
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
      const choiceResult = await window.voicewall.setModelChoice(modell);
      if (!choiceResult.ok) {
        setDownloadError(choiceResult.message);
        return;
      }
      const result = await window.voicewall.prepareModels();
      if (!result.ok) {
        setDownloadError(result.message);
      }
    } finally {
      setDownloading(false);
      await onRefreshStatus();
    }
  }, [modell, onRefreshStatus]);

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
      );
      if (!created.ok) {
        setApplyError(
          created.vorschlag === null
            ? created.message
            : `${created.message} Vorschlag: ${created.vorschlag}`,
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
      ? 'Einrichtung abgeschlossen'
      : `Schritt ${String(stepNumber).padStart(2, '0')} von ${String(steps.length).padStart(2, '0')}`;

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="wizard-layout">
      <nav className="wizard-rail" aria-label="Einrichtungsschritte">
        <p className="wizard-rail-title">Prüfschritte</p>
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
                {STEP_LABELS[step]}
                {state === 'done' && (
                  <span className="step-check" aria-label="abgeschlossen">
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
          />
        ) : (
          <>
            {currentStep === 'willkommen' && (
              <StepWillkommen
                headingRef={headingRef}
                consentChecked={consentChecked}
                onConsentChange={setConsentChecked}
              />
            )}

            {currentStep === 'firma' && (
              <>
                <h2 ref={headingRef} tabIndex={-1}>
                  Firmendaten
                </h2>
                <p className="lede">
                  Diese Angaben beschreiben den Datenraum der Firma. Sie bleiben auf diesem Rechner
                  und werden in der Firmen-Konfiguration im Firmenordner abgelegt.
                </p>
                <div className="field-grid">
                  <div className="field">
                    <label className="field-label" htmlFor="wz-name">
                      Firmenname <span className="req">*</span>
                    </label>
                    <input
                      id="wz-name"
                      type="text"
                      value={name}
                      maxLength={120}
                      data-testid="wizard-company-name"
                      aria-invalid={name.length > 0 && !nameValid}
                      aria-describedby="wz-name-hint"
                      placeholder="z. B. Müller & Söhne GmbH"
                      onChange={(event) => {
                        setName(event.target.value);
                      }}
                    />
                    <p className="field-hint" id="wz-name-hint">
                      1 bis 120 Zeichen, echte Umlaute erlaubt. Der Anzeigename bleibt unverändert
                      erhalten.
                    </p>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="wz-ordnername">
                      Ordnername (abgeleitet, anpassbar)
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
                        {preview.ok ? `Ordner: ${preview.text}` : preview.text}
                      </p>
                    )}
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="wz-ansprechpartner">
                      Ansprechpartner (optional)
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
                      E-Mail (optional, nur lokale Anzeige)
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
                        Bitte eine gültige E-Mail-Adresse eingeben (z. B. name@firma.de) oder das
                        Feld leer lassen.
                      </p>
                    )}
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="wz-standort">
                      Standort/Abteilung (optional)
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
                      Interner Hinweis (optional)
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
                  Speicherort der Diktate
                </h2>
                <p className="lede">
                  Der Firmenordner ist die Datenbank: einfache Dateien, jederzeit kopierbar. Vor der
                  Anlage prüft VoiceWall, ob der Desktop von einem Cloud-Dienst synchronisiert wird.
                </p>
                {!syncChecked && <p className="placeholder">Prüfe Speicherort ...</p>}
                {syncChecked && syncInfo.synchronisiert && (
                  <div className="note warn" data-testid="wizard-sync-warning" role="alert">
                    <p>
                      <strong>Cloud-Synchronisation erkannt.</strong>
                    </p>
                    <p>{syncInfo.hinweis}</p>
                  </div>
                )}
                {syncChecked && !syncInfo.synchronisiert && (
                  <p className="note" data-testid="wizard-sync-ok">
                    Keine Cloud-Synchronisation des Desktops erkannt. Der Desktop ist als
                    Speicherort geeignet.
                  </p>
                )}
                <h3>Wo sollen die Diktate liegen?</h3>
                <div className="choice-list" role="radiogroup" aria-label="Speicherort">
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
                      Lokaler Ordner mit Desktop-Verknüpfung
                      {syncInfo.synchronisiert && <span className="badge">empfohlen</span>}
                    </span>
                    <p className="choice-desc">
                      Diktate liegen unter ~/VoiceWall (wird nie synchronisiert); auf dem Desktop
                      erscheint eine Verknüpfung. Sichert das Versprechen &quot;100 Prozent
                      lokal&quot;.
                    </p>
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
                      Direkt auf dem Desktop
                      {!syncInfo.synchronisiert && <span className="badge">Standard</span>}
                    </span>
                    <p className="choice-desc">
                      Der Firmenordner liegt direkt auf dem Desktop.
                      {syncInfo.synchronisiert
                        ? ' Achtung: Er würde dann in die Cloud synchronisiert.'
                        : ''}
                    </p>
                  </label>
                </div>
              </>
            )}

            {currentStep === 'sprache' && (
              <>
                <h2 ref={headingRef} tabIndex={-1}>
                  Diktatsprache
                </h2>
                <p className="lede">
                  VoiceWall ist auf deutsches Diktat optimiert. Das Erkennungsmodell ist eine
                  deutsch-feinabgestimmte Whisper-Variante; die Sprache wird fest übergeben, ohne
                  automatische Spracherkennung. Das spart Zeit und verhindert Sprachwechsel-Fehler.
                </p>
                <table className="proto-table">
                  <tbody>
                    <tr>
                      <th scope="row">Diktatsprache</th>
                      <td className="value-ok">Deutsch (de)</td>
                    </tr>
                    <tr>
                      <th scope="row">Oberflächensprache</th>
                      <td>Deutsch</td>
                    </tr>
                  </tbody>
                </table>
                <p className="note">
                  Weitere Diktatsprachen sind für eine spätere Version vorgesehen. Deutsch ist der
                  Markenkern dieser Ausgabe.
                </p>
              </>
            )}

            {currentStep === 'modell' && (
              <StepModell
                headingRef={headingRef}
                models={models}
                systemInfo={systemInfo}
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
              />
            )}

            {currentStep === 'hotkey' && (
              <>
                <h2 ref={headingRef} tabIndex={-1}>
                  Tastenkürzel für das Diktat
                </h2>
                <p className="lede">
                  Ein Druck startet die Aufnahme, ein zweiter Druck beendet sie und fügt den Text in
                  die aktive Anwendung ein. Das Kürzel gilt systemweit.
                </p>
                <div className="field">
                  <label className="field-label" htmlFor="wz-hotkey">
                    Tastenkombination
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
                    Anzeige:{' '}
                    <kbd>{formatAccelerator(hotkey, systemInfo?.platform ?? 'darwin')}</kbd> ·
                    Schreibweise nach Electron, z. B. CommandOrControl+Shift+D.
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
                    {recording
                      ? 'Jetzt Tastenkombination drücken (Esc bricht ab)'
                      : 'Kombination einfangen'}
                  </button>
                  <button
                    type="button"
                    disabled={hotkey.trim().length === 0}
                    data-testid="wizard-hotkey-test"
                    onClick={() => {
                      void testHotkey(hotkey.trim());
                    }}
                  >
                    Live testen
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
              />
            )}

            {currentStep === 'zusammenfassung' && (
              <>
                <h2 ref={headingRef} tabIndex={-1}>
                  Zusammenfassung
                </h2>
                <p className="lede">
                  Bitte prüfen Sie die Angaben. Erst mit &quot;Einrichten&quot; legt VoiceWall den
                  Firmenordner an und speichert die Konfiguration.
                </p>
                <table className="proto-table" data-testid="wizard-summary">
                  <tbody>
                    <tr>
                      <th scope="row">Firma</th>
                      <td>{name.trim()}</td>
                    </tr>
                    <tr>
                      <th scope="row">Zielordner</th>
                      <td className="mono">
                        {strategie === 'desktop'
                          ? `Desktop/${ordnername || '?'}`
                          : `~/VoiceWall/${ordnername || '?'} (Desktop zeigt eine Verknüpfung)`}
                      </td>
                    </tr>
                    {ansprechpartner.trim().length > 0 && (
                      <tr>
                        <th scope="row">Ansprechpartner</th>
                        <td>{ansprechpartner.trim()}</td>
                      </tr>
                    )}
                    {email.trim().length > 0 && (
                      <tr>
                        <th scope="row">E-Mail</th>
                        <td>{email.trim()}</td>
                      </tr>
                    )}
                    {standort.trim().length > 0 && (
                      <tr>
                        <th scope="row">Standort</th>
                        <td>{standort.trim()}</td>
                      </tr>
                    )}
                    {mode === 'first-run' && (
                      <>
                        <tr>
                          <th scope="row">Sprache</th>
                          <td>Deutsch (de)</td>
                        </tr>
                        <tr>
                          <th scope="row">Modell</th>
                          <td>
                            {modell === 'fp16' ? 'fp16 (maximale Genauigkeit)' : 'Q5_0 (empfohlen)'}
                          </td>
                        </tr>
                        <tr>
                          <th scope="row">Tastenkürzel</th>
                          <td className="mono">{hotkey}</td>
                        </tr>
                        <tr>
                          <th scope="row">Mikrofon-Einwilligung</th>
                          <td className={consentChecked ? 'value-ok' : 'value-warn'}>
                            {consentChecked ? 'wird bei Einrichtung erteilt' : 'fehlt'}
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
                  Abbrechen
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
                  Einrichtung beenden
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
                Zurück
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
                  {busy ? 'Richte ein ...' : 'Einrichten'}
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
                  Weiter
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
  },
): ReactElement {
  return (
    <>
      <h2 ref={props.headingRef} tabIndex={-1}>
        Willkommen bei VoiceWall
      </h2>
      <p className="lede">
        VoiceWall wandelt Ihre Sprache in Text um: Tastenkürzel drücken, sprechen, Tastenkürzel
        drücken, der Text erscheint in der aktiven Anwendung. Die gesamte Verarbeitung findet auf
        diesem Rechner statt.
      </p>
      <table className="proto-table">
        <tbody>
          <tr>
            <th scope="row">Verarbeitung</th>
            <td className="value-ok">100 % lokal auf diesem Rechner</td>
          </tr>
          <tr>
            <th scope="row">Cloud/Server</th>
            <td className="value-ok">keine, es werden keine Daten gesendet</td>
          </tr>
          <tr>
            <th scope="row">Audio-Aufzeichnung</th>
            <td className="value-ok">nur im Arbeitsspeicher, nie als Datei</td>
          </tr>
        </tbody>
      </table>
      <div className="note" data-testid="wizard-ai-act">
        <p>
          <strong>Transparenzhinweis (EU-KI-Verordnung):</strong> Die Umwandlung von Sprache in Text
          erfolgt durch ein KI-Modell (Whisper, deutsch optimiert). Wie bei jeder automatischen
          Erkennung sind Fehler möglich, besonders bei Namen und Fachbegriffen. Bitte prüfen Sie das
          Ergebnis, bevor Sie es verwenden.
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
        <span>
          Ich willige ein, dass VoiceWall das Mikrofon dieses Rechners für die lokale
          Sprachumwandlung verwendet. Es werden keine Audiodaten gespeichert oder an einen Server
          übertragen. Diese Einwilligung wird mit Zeitstempel lokal dokumentiert und ist jederzeit
          widerrufbar (Mikrofonzugriff in den Systemeinstellungen entziehen).
        </span>
      </label>
    </>
  );
}

function StepModell(
  props: HeadingRefProp & {
    readonly models: AppStatus['models'];
    readonly systemInfo: SystemInfo | null;
    readonly modell: 'q5_0' | 'fp16';
    readonly onModellChange: (choice: 'q5_0' | 'fp16') => void;
    readonly vadPresent: boolean;
    readonly selectedPresent: boolean;
    readonly downloading: boolean;
    readonly progress: ModelProgress | null;
    readonly downloadError: string | null;
    readonly onDownload: () => void;
  },
): ReactElement {
  const { systemInfo } = props;
  const fp16Erlaubt = systemInfo?.fp16Erlaubt ?? false;
  const q5 = props.models.find((entry) => entry.id === 'whisper-q5');
  const fp16 = props.models.find((entry) => entry.id === 'whisper-fp16');
  const vad = props.models.find((entry) => entry.id === 'silero-vad');
  const ready = props.selectedPresent && props.vadPresent;

  const statusLine = (entry: AppStatus['models'][number] | undefined): ReactElement => (
    <p className="choice-status">
      {entry?.present === true ? (
        <span className="status-ok">vorhanden und verifiziert</span>
      ) : (
        <span className="status-missing">
          noch nicht geladen · {entry !== undefined ? formatBytes(entry.byteSize) : ''}
        </span>
      )}
    </p>
  );

  return (
    <>
      <h2 ref={props.headingRef} tabIndex={-1}>
        Erkennungsmodell
      </h2>
      <p className="lede">
        Empfehlung für diesen Rechner (
        {systemInfo !== null
          ? `${String(systemInfo.cpuKerne)} Kerne, ${String(systemInfo.ramGb)} GB RAM`
          : 'wird ermittelt'}
        ): <strong>Q5_0</strong>. Der Download erfolgt einmalig; danach arbeitet VoiceWall zu 100 %
        offline.
      </p>
      <div className="choice-list" role="radiogroup" aria-label="Erkennungsmodell">
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
            Q5_0 <span className="badge">empfohlen</span>
          </span>
          <p className="choice-desc">
            Bester Kompromiss aus deutscher Genauigkeit und Geschwindigkeit; läuft auf normaler
            Büro-Hardware. {q5 !== undefined ? formatBytes(q5.byteSize) : ''}.
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
          <span className="choice-title">Maximale Genauigkeit (fp16)</span>
          <p className="choice-desc" id="wz-fp16-hint">
            {fp16Erlaubt
              ? `Für starke Rechner; höhere Genauigkeit bei längerer Rechenzeit. ${fp16 !== undefined ? formatBytes(fp16.byteSize) : ''}.`
              : 'Für diesen Rechner nicht empfohlen (benötigt mindestens 16 GB RAM und 6 Kerne); Auswahl deaktiviert.'}
          </p>
          {fp16Erlaubt && statusLine(fp16)}
        </label>
      </div>
      <p className="field-hint">
        Zusätzlich wird das kleine Sprach-Erkennungsmodell (VAD,{' '}
        {vad !== undefined ? formatBytes(vad.byteSize) : 'unter 1 MB'}) geladen:{' '}
        {props.vadPresent ? 'vorhanden.' : 'noch nicht geladen.'}
      </p>

      <div aria-live="polite">
        {props.downloading && props.progress !== null && (
          <>
            <progress
              max={100}
              value={props.progress.percent ?? 0}
              aria-label={`Download ${props.progress.label}`}
            />
            <p className="progress-line" data-testid="wizard-download-progress">
              {props.progress.label}: {formatBytes(props.progress.receivedBytes)}
              {props.progress.totalBytes !== null
                ? ` von ${formatBytes(props.progress.totalBytes)}`
                : ''}
              {props.progress.percent !== null ? ` (${props.progress.percent.toFixed(0)} %)` : ''}
            </p>
          </>
        )}
        {ready && (
          <p className="note" data-testid="wizard-model-ready">
            Alle benötigten Modelldateien sind vorhanden und gegen die fest hinterlegten Prüfsummen
            verifiziert. Es ist kein Download noetig.
          </p>
        )}
      </div>
      {!ready && (
        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={props.downloading}
            data-testid="wizard-model-download"
            onClick={props.onDownload}
          >
            {props.downloading ? 'Lädt ...' : 'Modell jetzt laden (einmalig)'}
          </button>
        </div>
      )}
      {props.downloadError !== null && (
        <div className="note error" role="alert">
          <p>{props.downloadError}</p>
        </div>
      )}
      <p className="field-hint">
        Hinweis: Der Modell-Download ist der einzige Moment, in dem VoiceWall das Internet nutzt
        (huggingface.co, mit Prüfsummen-Verifikation). Eine besonders kleine Q4-Notvariante für sehr
        schwache Rechner ist für eine spätere Version vorgesehen.
      </p>
    </>
  );
}

function StepBedienungshilfen(
  props: HeadingRefProp & {
    readonly accessibility: AppStatus['accessibility'];
    readonly onRefresh: () => Promise<void>;
  },
): ReactElement {
  const granted = props.accessibility === 'granted';
  return (
    <>
      <h2 ref={props.headingRef} tabIndex={-1}>
        macOS-Freigabe: Bedienungshilfen
      </h2>
      <p className="lede">
        Für das automatische Einfügen simuliert VoiceWall genau einen Tastendruck (Cmd+V). Dafür
        verlangt macOS die Freigabe &quot;Bedienungshilfen&quot;. VoiceWall liest damit keine
        Tastatur mit, liest keine Fenster anderer Programme und steuert nichts weiter (die
        vollständige, auditierbare Begruendung liegt in docs/ACCESSIBILITY.md bei).
      </p>
      <table className="proto-table">
        <tbody>
          <tr>
            <th scope="row">Freigabe-Status</th>
            <td
              className={granted ? 'value-ok' : 'value-warn'}
              data-testid="wizard-accessibility-status"
            >
              {granted ? 'erteilt' : 'noch nicht erteilt'}
            </td>
          </tr>
        </tbody>
      </table>
      {!granted && (
        <div className="note warn">
          <p>
            Ohne die Freigabe funktioniert alles ausser dem automatischen Einfügen: der Text liegt
            dann in der Zwischenablage und wird mit Cmd+V eingefügt. Sie können die Freigabe auch
            später jederzeit erteilen.
          </p>
          <p>
            So geht es: Knopf drücken, dann VoiceWall in der Liste aktivieren (ggf. über das
            Plus-Symbol hinzufügen), danach hier &quot;Status aktualisieren&quot; wählen.
          </p>
        </div>
      )}
      <div className="actions">
        <button
          type="button"
          onClick={() => {
            void window.voicewall.openAccessibilitySettings();
          }}
        >
          Systemeinstellungen öffnen
        </button>
        <button
          type="button"
          data-testid="wizard-accessibility-refresh"
          onClick={() => {
            void props.onRefresh();
          }}
        >
          Status aktualisieren
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
}): ReactElement {
  const shownHotkey = formatAccelerator(props.hotkey, props.platform);
  return (
    <div data-testid="wizard-success">
      <h2 ref={props.headingRef} tabIndex={-1}>
        Einrichtung abgeschlossen
      </h2>
      <p className="success-seal">
        ✓ Firma &quot;{props.outcome.ordnername}&quot;{' '}
        {props.outcome.uebernommen ? 'übernommen' : 'angelegt'}
      </p>
      <p className="mono">{props.outcome.pfad}</p>
      {props.outcome.hinweise.map((hinweisText) => (
        <div className="note warn" key={hinweisText}>
          <p>{hinweisText}</p>
        </div>
      ))}
      <h3>So diktieren Sie</h3>
      <ol className="kurzanleitung">
        <li>
          Cursor in ein Textfeld setzen (Word, Outlook, Browser), dann <kbd>{shownHotkey}</kbd>{' '}
          drücken.
        </li>
        <li>Sprechen. Ein kleines Fenster zeigt &quot;Ich höre zu&quot;.</li>
        <li>
          Erneut <kbd>{shownHotkey}</kbd> drücken: der Text erscheint an der Cursor-Position (und
          liegt zusätzlich in der Zwischenablage).
        </li>
      </ol>
      <details className="selftest">
        <summary>Selbst prüfen: VoiceWall sendet keine Daten (Netzwerk-Selbsttest)</summary>
        <div className="selftest-body">
          <p>
            Das Versprechen &quot;100 Prozent lokal&quot; müssen Sie nicht glauben, Sie können es
            selbst nachprüfen (ausführlich in der beiliegenden Anleitung
            docs/NETZWERK-SELBSTTEST.md):
          </p>
          <ol>
            <li>
              <strong>Netzwerk-Anzeige der App:</strong> Entwicklertools öffnen (Cmd+Alt+I bzw.
              F12), Reiter Netzwerk, dann diktieren. Es erscheint kein einziger Eintrag zu einer
              externen Adresse.
            </li>
            <li>
              <strong>Verbindungsmonitor des Systems:</strong> macOS: LuLu/Little Snitch oder lsof;
              Windows: Ressourcenmonitor, Reiter Netzwerk. VoiceWall baut im Betrieb keine
              Verbindung auf.
            </li>
            <li>
              <strong>Der Netzstecker:</strong> Internet trennen (WLAN aus, Kabel ziehen) und wie
              gewohnt diktieren. VoiceWall funktioniert vollständig offline.
            </li>
          </ol>
          <p>
            Einzige Ausnahme: der einmalige, prüfsummen-verifizierte Modell-Download bei der
            Einrichtung.
          </p>
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
          Zur Verwaltung
        </button>
      </div>
    </div>
  );
}
