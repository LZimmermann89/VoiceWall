/**
 * React-Root des Renderers: minimale Wizard-Platzhalter-Ansicht mit genau
 * einer sichtbaren H1. Beim Start wird die IPC-Brücke über den Ping-Kanal
 * geprüft, damit der Smoke-Test den gesamten Pfad Renderer -> Preload ->
 * Main -> zurück abdeckt.
 */
import { StrictMode, useEffect, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type BridgeStatus = 'pruefe' | 'verbunden' | 'fehler';

function App(): ReactElement {
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>('pruefe');

  useEffect(() => {
    let cancelled = false;
    window.voicewall
      .ping()
      .then(() => {
        if (!cancelled) {
          setBridgeStatus('verbunden');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBridgeStatus('fehler');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <h1>VoiceWall</h1>
      <p>
        Willkommen. Der Einrichtungs-Assistent folgt in einem späteren Meilenstein. Dieses Fenster
        ist der Platzhalter des First-Run-Wizards.
      </p>
      <p data-testid="bridge-status">
        {bridgeStatus === 'pruefe' && 'IPC-Brücke wird geprüft ...'}
        {bridgeStatus === 'verbunden' && 'IPC-Brücke verbunden.'}
        {bridgeStatus === 'fehler' &&
          'IPC-Brücke nicht erreichbar. Bitte die App neu starten und danach die Logs prüfen.'}
      </p>
    </main>
  );
}

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Renderer-Bootstrap fehlgeschlagen: Element #root fehlt in index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
