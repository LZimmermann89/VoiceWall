/**
 * Ansicht "Beleg" (M7, ABARBEITUNG 4.8): die UI-Seite von "Beleg statt
 * Behauptung". Belegt den lokalen Charakter mit pruefbaren Fakten: aktive
 * Modellversion samt SHA-256 und Pfad, "0 externe Verbindungen" mit dem
 * eingebetteten Netzwerk-Selbsttest, Konsent-Zeitstempel, App-Version und
 * Pfad zum Betriebslog. Dem Kunden direkt vorführbar.
 */
import { useEffect, useState, type ReactElement } from 'react';
import type { BelegInfo } from '../../shared/company';
import { NETZWERK_SELBSTTEST_DOKUMENT, NETZWERK_SELBSTTEST_PROBEN } from '../../shared/selbsttest';
import { formatGermanDateTime } from './format';

export function BelegView(): ReactElement {
  const [beleg, setBeleg] = useState<BelegInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const result = await window.voicewall.belegInfo();
      if (result.ok) {
        setBeleg(result.beleg);
      } else {
        setError(result.message);
      }
    })();
  }, []);

  return (
    <div className="view-body">
      <h2 className="view-title" tabIndex={-1}>
        Beleg
      </h2>
      <p className="lede">
        VoiceWall arbeitet vollständig auf diesem Rechner. Dieser Bereich belegt das mit prüfbaren
        Fakten, statt es nur zu behaupten.
      </p>

      <div className="stamp-panel" data-testid="beleg-network">
        <span className="stamp-mark">0</span>
        <div>
          <p className="stamp-headline">Null externe Verbindungen im Betrieb</p>
          <p className="notice">
            Nach dem einmaligen Modell-Download baut VoiceWall keine Netzwerkverbindung mehr auf.
            Die Content-Security-Policy der Oberfläche verbietet jede externe Verbindung. Sie können
            das selbst nachprüfen (siehe unten, ausführlich in {NETZWERK_SELBSTTEST_DOKUMENT}).
          </p>
        </div>
      </div>

      {error !== null && (
        <p className="note error" role="alert">
          {error}
        </p>
      )}

      {beleg === null && error === null && <p className="placeholder">Wird geladen ...</p>}

      {beleg !== null && (
        <>
          <h3>Eckdaten</h3>
          <table className="proto-table" data-testid="beleg-facts">
            <tbody>
              <tr>
                <th scope="row">App-Version</th>
                <td className="mono">{beleg.appVersion}</td>
              </tr>
              <tr>
                <th scope="row">Plattform</th>
                <td className="mono">{beleg.plattform}</td>
              </tr>
              <tr>
                <th scope="row">Mikrofon-Einwilligung</th>
                <td className={beleg.konsentZeitstempel !== null ? 'value-ok' : 'value-warn'}>
                  {beleg.konsentZeitstempel !== null
                    ? `erteilt am ${formatGermanDateTime(beleg.konsentZeitstempel)}`
                    : 'noch nicht erteilt'}
                </td>
              </tr>
              <tr>
                <th scope="row">Modellordner</th>
                <td className="mono breakable">{beleg.modellOrdner}</td>
              </tr>
              <tr>
                <th scope="row">Betriebslog</th>
                <td className="mono breakable">{beleg.logPfad}</td>
              </tr>
            </tbody>
          </table>

          <h3>Modelle (Version und Prüfsumme)</h3>
          <ul className="beleg-models" data-testid="beleg-models">
            {beleg.modelle.map((modell) => (
              <li key={modell.id} className="beleg-model">
                <div className="beleg-model-head">
                  <span className="beleg-model-label">{modell.label}</span>
                  {modell.aktiv && <span className="badge">aktiv</span>}
                  <span
                    className={modell.vorhanden ? 'status-ok' : 'status-missing'}
                    data-testid={`beleg-model-state-${modell.id}`}
                  >
                    {modell.vorhanden ? 'vorhanden und verifiziert' : 'nicht geladen'}
                  </span>
                </div>
                <p className="beleg-hash mono">SHA-256: {modell.sha256}</p>
                <p className="beleg-path mono breakable">{modell.pfad}</p>
              </li>
            ))}
          </ul>

          <h3>Netzwerk-Selbsttest</h3>
          <p className="notice">
            Prüfen Sie das Versprechen &quot;100 Prozent lokal&quot; selbst. Drei unabhängige
            Proben, von der eingebauten Netzwerk-Anzeige bis zum gezogenen Netzstecker:
          </p>
          <ol className="selftest-list" data-testid="beleg-selbsttest">
            {NETZWERK_SELBSTTEST_PROBEN.map((probe) => (
              <li key={probe.titel} className="selftest-item">
                <p className="selftest-title">{probe.titel}</p>
                <ol className="selftest-steps">
                  {probe.schritte.map((schritt) => (
                    <li key={schritt}>{schritt}</li>
                  ))}
                </ol>
                <p className="selftest-result">
                  <strong>Erwartetes Ergebnis:</strong> {probe.ergebnis}
                </p>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
