/**
 * Renderer des Diktat-Overlays: zeigt den Flow-Zustand ("Ich hoere zu",
 * "Transkribiere", Ergebnis/Fehler) und bietet bei Ergebnis/Fehler den
 * Kopieren-Knopf (Resilienz-Primaerpfad). Nur DOM plus Preload-Bruecke,
 * keine Node-/Electron-APIs.
 */

const overlay = document.getElementById('overlay');
const message = document.getElementById('message');
const copyButton = document.getElementById('copy');

if (overlay === null || message === null || !(copyButton instanceof HTMLButtonElement)) {
  throw new Error('Overlay-Bootstrap fehlgeschlagen: erwartete Elemente fehlen in overlay.html.');
}

const DEFAULT_TEXTS: Record<string, string> = {
  recording: 'Ich hoere zu ...',
  transcribing: 'Transkribiere ...',
  done: 'Text eingefuegt.',
  'no-speech': 'Keine Sprache erkannt.',
  error: 'Fehler beim Einfuegen.',
};

window.voicewallOverlay.onState((state) => {
  overlay.dataset['kind'] = state.kind;
  message.textContent = state.message ?? DEFAULT_TEXTS[state.kind] ?? '';
  // Kopieren-Knopf nur, wenn es ein Transkript gibt, das kopierbar ist.
  copyButton.hidden = !(state.kind === 'done' || state.kind === 'error');
});

copyButton.addEventListener('click', () => {
  window.voicewallOverlay.copyLastTranscript();
});
