/**
 * React-Einstiegspunkt des Hauptfensters (M6): rendert die App-Shell, die
 * zwischen First-Run-Wizard und Verwaltungs-Hauptansicht entscheidet
 * (app/App.tsx). Die M2-Test-UI ist durch die echte App-Shell ersetzt.
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
