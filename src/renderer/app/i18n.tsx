/**
 * React-Anbindung der Übersetzungs-Infrastruktur: schlanker
 * Context plus Hooks, kein externes i18n-Paket. Die App-Shell (App.tsx)
 * hält den Sprach-Zustand, initialisiert ihn aus der globalen Konfiguration
 * (AppStatus.uiLanguage) und persistiert Wechsel über die IPC-Brücke
 * (config:set-ui-language). Der Wechsel wirkt zur Laufzeit ohne Reload.
 */
import { createContext, useContext } from 'react';
import { de, KATALOGE, type Uebersetzung } from '../../shared/i18n';
import type { UiLanguage } from '../../shared/schema';

export interface I18nContextValue {
  /** Aktive UI-Sprache (unabhängig von der Diktatsprache der Firmen). */
  readonly sprache: UiLanguage;
  /** Aktiver Text-Katalog. */
  readonly texte: Uebersetzung;
  /** Wechselt die UI-Sprache live und persistiert sie (IPC). */
  readonly setSprache: (sprache: UiLanguage) => void;
}

/** Default: Deutsch (greift nur, falls kein Provider montiert ist). */
const I18nContext = createContext<I18nContextValue>({
  sprache: 'de',
  texte: de,
  setSprache: () => undefined,
});

export const I18nProvider = I18nContext.Provider;

/** Liefert den aktiven Text-Katalog. */
export function useTexte(): Uebersetzung {
  return useContext(I18nContext).texte;
}

/** Liefert Sprache plus Umschalter (für Sprachauswahl-Bedienelemente). */
export function useSprache(): I18nContextValue {
  return useContext(I18nContext);
}

/** Katalog zu einer Sprache (für Nicht-Hook-Kontexte wie Formatierer). */
export function katalogFuer(sprache: UiLanguage): Uebersetzung {
  return KATALOGE[sprache];
}
