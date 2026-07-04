/**
 * Schlankes Toast-/Sofortmeldungs-System des Renderers (Praxistest-Befund,
 * Entscheidung E44): Fehler und wichtige Erfolge erscheinen sofort sichtbar
 * unten rechts, unabhängig von Ansicht und Scroll-Position. Die bestehenden
 * Inline-Anzeigen (error-box, notice) bleiben als Detail-Ort erhalten; der
 * Toast ist die Sofort-Sichtbarkeit.
 *
 * Regeln:
 * - Fixe Position unten rechts, Papier-Karte im Design-System (Siegel-Grün
 *   für Erfolg, Fehlerrot für Fehler, feine Linie), Kontraste siehe
 *   styles.css-Kopf.
 * - Barrierefrei: Fehler mit role="alert" und aria-live="assertive",
 *   Erfolge mit role="status" und aria-live="polite"; der Schließen-Knopf
 *   ist per Tastatur erreichbar und beschriftet.
 * - Automatisches Ausblenden (Fehler 8 s, Erfolg 4 s), manuell schließbar,
 *   stapelbar bis maximal 3 (die älteste Meldung fällt heraus).
 * - Kein Netz, kein Node: reine Renderer-Logik, Texte aus den i18n-Katalogen.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useTexte } from './i18n';

/** Sichtbarkeitsdauer eines Fehler-Toasts (mehr Lesezeit). */
const ERROR_VISIBLE_MS = 8000;
/** Sichtbarkeitsdauer eines Erfolgs-Toasts. */
const SUCCESS_VISIBLE_MS = 4000;
/** Maximal gleichzeitig sichtbare Toasts. */
const MAX_TOASTS = 3;

export type ToastKind = 'error' | 'success';

interface Toast {
  readonly id: number;
  readonly kind: ToastKind;
  readonly text: string;
}

export interface ToastContextValue {
  /** Zeigt eine sofort sichtbare Fehlermeldung (assertive, 8 s). */
  readonly showError: (text: string) => void;
  /** Zeigt eine sofort sichtbare Erfolgsmeldung (polite, 4 s). */
  readonly showSuccess: (text: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showError: () => undefined,
  showSuccess: () => undefined,
});

/** Zugriff auf das Toast-System (überall unterhalb des Providers). */
export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

/**
 * Hält den Toast-Stapel und rendert ihn als fixe Schicht über der App.
 * Timer werden je Toast geführt und beim Schließen aufgeräumt.
 */
export function ToastProvider(props: { readonly children: ReactNode }): ReactElement {
  const texte = useTexte();
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, text: string) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => {
        const next = [...current, { id, kind, text }];
        // Stapel-Obergrenze: die ältesten Meldungen fallen heraus.
        const overflow = next.slice(0, Math.max(0, next.length - MAX_TOASTS));
        for (const dropped of overflow) {
          const timer = timers.current.get(dropped.id);
          if (timer !== undefined) {
            window.clearTimeout(timer);
            timers.current.delete(dropped.id);
          }
        }
        return next.slice(-MAX_TOASTS);
      });
      const timer = window.setTimeout(
        () => {
          dismiss(id);
        },
        kind === 'error' ? ERROR_VISIBLE_MS : SUCCESS_VISIBLE_MS,
      );
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showError: (text: string) => {
        push('error', text);
      },
      showSuccess: (text: string) => {
        push('success', text);
      },
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {props.children}
      <div className="toast-stack" data-testid="toast-stack">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.kind}`}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
            data-testid={`toast-${toast.kind}`}
          >
            <span className="toast-kicker">
              {toast.kind === 'error' ? texte.toast.fehlerKicker : texte.toast.erfolgKicker}
            </span>
            <p className="toast-text">{toast.text}</p>
            <button
              type="button"
              className="toast-close"
              aria-label={texte.toast.schliessenAria}
              data-testid="toast-close"
              onClick={() => {
                dismiss(toast.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
