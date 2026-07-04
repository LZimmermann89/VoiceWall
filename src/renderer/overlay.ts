/**
 * Renderer des Diktat-Overlays: zeigt den Flow-Zustand ("Ich hoere zu",
 * "Transkribiere", Ergebnis/Fehler) und bietet bei Ergebnis/Fehler den
 * Kopieren-Knopf (Resilienz-Primaerpfad). Nur DOM plus Preload-Bruecke,
 * keine Node-/Electron-APIs.
 *
 * Sprache (Paket B2/B3): jeder Anzeige-Zustand traegt die UI-Sprache aus
 * der globalen Konfiguration; die eigenen Overlay-Texte kommen aus den
 * Katalogen (shared/i18n). Meldungen, die der Main-Prozess als fertigen
 * String mitliefert (`state.message`, done/error), stammen seit Paket B3
 * ebenfalls aus dem Katalog (main-Bereich) und sind bereits uebersetzt.
 */
import { KATALOGE } from '../shared/i18n';

const overlay = document.getElementById('overlay');
const message = document.getElementById('message');
const copyButton = document.getElementById('copy');

if (overlay === null || message === null || !(copyButton instanceof HTMLButtonElement)) {
  throw new Error('Overlay-Bootstrap fehlgeschlagen: erwartete Elemente fehlen in overlay.html.');
}

window.voicewallOverlay.onState((state) => {
  const sprache = state.uiSprache ?? 'de';
  // A11y (Paket B3): Dokumentsprache folgt der UI-Sprache des Zustands.
  document.documentElement.lang = sprache;
  const texte = KATALOGE[sprache].overlay;
  const defaultTexts: Record<string, string> = {
    recording: texte.recording,
    transcribing: texte.transcribing,
    done: texte.done,
    'no-speech': texte.noSpeech,
    error: texte.error,
  };
  overlay.dataset['kind'] = state.kind;
  message.textContent = state.message ?? defaultTexts[state.kind] ?? '';
  copyButton.textContent = texte.kopieren;
  // Kopieren-Knopf nur, wenn es ein Transkript gibt, das kopierbar ist.
  copyButton.hidden = !(state.kind === 'done' || state.kind === 'error');
});

copyButton.addEventListener('click', () => {
  window.voicewallOverlay.copyLastTranscript();
});
