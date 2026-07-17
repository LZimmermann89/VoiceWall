/**
 * React-Einstiegspunkt des Hauptfensters: rendert die App-Shell, die
 * zwischen First-Run-Wizard und Verwaltungs-Hauptansicht entscheidet
 * (app/App.tsx).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles.css';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Renderer-Bootstrap fehlgeschlagen: Element #root fehlt in index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
