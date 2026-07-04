/**
 * Passwort-Dialog fuer den verschluesselten Export und das Entschluesseln
 * (M8, Entscheidung E30).
 *
 * - Beim VERSCHLUESSELN: Mindestlaenge 12 plus Wiederholung, dazu die
 *   deutliche Warnung, dass Passwortverlust unwiederbringlich ist.
 * - Beim ENTSCHLUESSELN: nur die Passwort-Eingabe (die Pruefung macht der
 *   GCM-Auth-Tag im Main-Prozess).
 *
 * Das Passwort verlaesst diese Komponente ausschliesslich ueber onSubmit
 * (IPC an den Main-Prozess); es wird nie gespeichert und nie geloggt.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTexte } from './i18n';

interface PasswordDialogProps {
  readonly titel: string;
  readonly beschreibung: string;
  /** Deutliche Warnung (hervorgehoben), z. B. Passwortverlust-Hinweis. */
  readonly warnung?: string;
  readonly bestaetigenText: string;
  /** Mindestlaenge des Passworts (12 beim Verschluesseln, 1 beim Entschluesseln). */
  readonly minLength: number;
  /** True: zweites Feld "Passwort wiederholen" (nur beim Verschluesseln). */
  readonly mitWiederholung: boolean;
  readonly busy: boolean;
  readonly onSubmit: (passwort: string) => void;
  readonly onCancel: () => void;
}

export function PasswordDialog(props: PasswordDialogProps): ReactElement {
  const t = useTexte().passwortDialog;
  const [passwort, setPasswort] = useState('');
  const [wiederholung, setWiederholung] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (): void => {
    if (passwort.length < props.minLength) {
      setFehler(props.minLength > 1 ? t.fehlerZuKurz(props.minLength) : t.fehlerLeer);
      return;
    }
    if (props.mitWiederholung && passwort !== wiederholung) {
      setFehler(t.fehlerUngleich);
      return;
    }
    setFehler(null);
    props.onSubmit(passwort);
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={props.onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pw-title"
        data-testid="password-dialog"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <h3 id="pw-title">{props.titel}</h3>
        <p className="notice">{props.beschreibung}</p>
        {props.warnung !== undefined && (
          <p className="note warn" data-testid="password-warnung">
            {props.warnung}
          </p>
        )}
        <div className="field">
          <label className="field-label" htmlFor="pw-eingabe">
            {t.passwortLabel} {props.minLength > 1 ? t.passwortMindestlaenge(props.minLength) : ''}
            <span className="req">*</span>
          </label>
          <input
            id="pw-eingabe"
            ref={inputRef}
            type="password"
            autoComplete="off"
            value={passwort}
            data-testid="password-input"
            onChange={(event) => {
              setPasswort(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !props.mitWiederholung) {
                event.preventDefault();
                submit();
              }
            }}
          />
        </div>
        {props.mitWiederholung && (
          <div className="field">
            <label className="field-label" htmlFor="pw-wiederholung">
              {t.wiederholenLabel} <span className="req">*</span>
            </label>
            <input
              id="pw-wiederholung"
              type="password"
              autoComplete="off"
              value={wiederholung}
              data-testid="password-repeat"
              onChange={(event) => {
                setWiederholung(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submit();
                }
              }}
            />
          </div>
        )}
        {fehler !== null && (
          <p className="note error" role="alert" data-testid="password-error">
            {fehler}
          </p>
        )}
        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={props.busy}
            data-testid="password-submit"
            onClick={submit}
          >
            {props.busy ? t.bitteWarten : props.bestaetigenText}
          </button>
          <button type="button" disabled={props.busy} onClick={props.onCancel}>
            {t.abbrechen}
          </button>
        </div>
      </div>
    </div>
  );
}
