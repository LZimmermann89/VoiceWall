/**
 * Ansicht "Beleg": die UI-Seite von "Beleg statt
 * Behauptung". Belegt den lokalen Charakter mit pruefbaren Fakten: aktive
 * Modellversion samt SHA-256 und Pfad, "0 externe Verbindungen" mit dem
 * eingebetteten Netzwerk-Selbsttest, Konsent-Zeitstempel, App-Version und
 * Pfad zum Betriebslog. Dem Kunden direkt vorführbar.
 *
 * Abschnitt "Backup und Verschlüsselung" mit der
 * Klartext-Warnung (Art.-9-Potenzial), FileVault-/BitLocker-Anleitung und
 * dem Entschlüsseln von .vwenc-Dateien direkt in der App.
 *
 * Abschnitt "Über VoiceWall" mit der vollständigen, lokal
 * angezeigten Anbieterkennzeichnung (§ 5 DDG, shared/impressum.ts,
 * deckungsgleich mit rechtstexte/IMPRESSUM.md) plus Knopf zur statischen
 * Impressums-Quelle (eine der wenigen openExternal-Ausnahmen). Die
 * Anbieterkennzeichnung bleibt auch in der englischen Oberfläche DEUTSCH,
 * weil deutsches Recht gilt; der Katalog liefert dafür eine Einordnungszeile.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import type { BelegInfo } from '../../shared/company';
import { IMPRESSUM_ANGABEN, IMPRESSUM_HINWEIS, IMPRESSUM_QUELLE_URL } from '../../shared/impressum';
import { formatDateTime } from './format';
import { useSprache } from './i18n';
import { PasswordDialog } from './PasswordDialog';

export function BelegView(): ReactElement {
  const { sprache: uiSprache, texte } = useSprache();
  const t = texte.beleg;
  const [beleg, setBeleg] = useState<BelegInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDecrypt, setShowDecrypt] = useState(false);
  const [decryptBusy, setDecryptBusy] = useState(false);
  const [decryptNotice, setDecryptNotice] = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [impressumError, setImpressumError] = useState<string | null>(null);

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

  const runDecrypt = useCallback(
    async (passwort: string) => {
      setDecryptBusy(true);
      setDecryptNotice(null);
      setDecryptError(null);
      try {
        const result = await window.voicewall.decryptVwencFile(passwort);
        setShowDecrypt(false);
        if (result.ok) {
          setDecryptNotice(t.entschluesseltNach(result.zielPfad));
        } else {
          setDecryptError(result.message);
        }
      } finally {
        setDecryptBusy(false);
      }
    },
    [t],
  );

  return (
    <div className="view-body">
      <h2 className="view-title" tabIndex={-1}>
        {t.titel}
      </h2>
      <p className="lede">{t.lede}</p>

      <div className="stamp-panel" data-testid="beleg-network">
        <span className="stamp-mark">0</span>
        <div>
          <p className="stamp-headline">{t.stempelTitel}</p>
          <p className="notice">{t.stempelText(t.selbsttestDokument)}</p>
        </div>
      </div>

      {error !== null && (
        <p className="note error" role="alert">
          {error}
        </p>
      )}

      {beleg === null && error === null && <p className="placeholder">{t.wirdGeladen}</p>}

      {beleg !== null && (
        <>
          <h3>{t.eckdatenTitel}</h3>
          <table className="proto-table" data-testid="beleg-facts">
            <tbody>
              <tr>
                <th scope="row">{t.zeileAppVersion}</th>
                <td className="mono">{beleg.appVersion}</td>
              </tr>
              <tr>
                <th scope="row">{t.zeilePlattform}</th>
                <td className="mono">{beleg.plattform}</td>
              </tr>
              <tr>
                <th scope="row">{t.zeileEinwilligung}</th>
                <td className={beleg.konsentZeitstempel !== null ? 'value-ok' : 'value-warn'}>
                  {beleg.konsentZeitstempel !== null
                    ? t.einwilligungErteiltAm(formatDateTime(beleg.konsentZeitstempel, uiSprache))
                    : t.einwilligungFehlt}
                </td>
              </tr>
              <tr>
                <th scope="row">{t.zeileModellordner}</th>
                <td className="mono breakable">{beleg.modellOrdner}</td>
              </tr>
              <tr>
                <th scope="row">{t.zeileBetriebslog}</th>
                <td className="mono breakable">{beleg.logPfad}</td>
              </tr>
            </tbody>
          </table>

          <h3>{t.modelleTitel}</h3>
          <ul className="beleg-models" data-testid="beleg-models">
            {beleg.modelle.map((modell) => (
              <li key={modell.id} className="beleg-model">
                <div className="beleg-model-head">
                  <span className="beleg-model-label">{modell.label}</span>
                  {modell.aktiv && <span className="badge">{t.badgeAktiv}</span>}
                  <span
                    className={modell.vorhanden ? 'status-ok' : 'status-missing'}
                    data-testid={`beleg-model-state-${modell.id}`}
                  >
                    {modell.vorhanden ? t.modellVorhanden : t.modellFehlt}
                  </span>
                </div>
                <p className="beleg-hash mono">SHA-256: {modell.sha256}</p>
                <p className="beleg-path mono breakable">{modell.pfad}</p>
              </li>
            ))}
          </ul>

          <h3>{t.selbsttestTitel}</h3>
          <p className="notice">{t.selbsttestIntro}</p>
          <ol className="selftest-list" data-testid="beleg-selbsttest">
            {t.selbsttestProben.map((probe) => (
              <li key={probe.titel} className="selftest-item">
                <p className="selftest-title">{probe.titel}</p>
                <ol className="selftest-steps">
                  {probe.schritte.map((schritt) => (
                    <li key={schritt}>{schritt}</li>
                  ))}
                </ol>
                <p className="selftest-result">
                  <strong>{t.selbsttestErgebnis}</strong> {probe.ergebnis}
                </p>
              </li>
            ))}
          </ol>

          <h3>{t.backupTitel}</h3>
          <p className="note warn" data-testid="backup-warnung">
            {t.backupWarnung}
          </p>
          <div className="backup-hinweise" data-testid="backup-hinweise">
            {t.backupHinweise.map((abschnitt) => (
              <div key={abschnitt.titel} className="backup-abschnitt">
                <h4>{abschnitt.titel}</h4>
                {abschnitt.absaetze.map((absatz) => (
                  <p key={absatz} className="notice">
                    {absatz}
                  </p>
                ))}
              </div>
            ))}
          </div>
          <p className="notice">{t.backupDokumentHinweis(t.backupDokument)}</p>
          <div className="actions">
            <button
              type="button"
              data-testid="beleg-decrypt"
              disabled={decryptBusy}
              onClick={() => {
                setShowDecrypt(true);
              }}
            >
              {t.entschluesseln}
            </button>
          </div>
          {decryptNotice !== null && (
            <p className="note" data-testid="decrypt-notice">
              {decryptNotice}
            </p>
          )}
          {decryptError !== null && (
            <p className="note error" role="alert" data-testid="decrypt-error">
              {decryptError}
            </p>
          )}

          <h3>{t.impressumTitel}</h3>
          <p className="notice" data-testid="beleg-impressum-sprachhinweis">
            {t.impressumSprachHinweis}
          </p>
          <table className="proto-table" data-testid="beleg-impressum">
            <tbody>
              {IMPRESSUM_ANGABEN.map((zeile) => (
                <tr key={zeile.label}>
                  <th scope="row">{zeile.label}</th>
                  <td>{zeile.wert}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="notice">{IMPRESSUM_HINWEIS}</p>
          <div className="actions">
            <button
              type="button"
              data-testid="beleg-impressum-quelle"
              onClick={() => {
                setImpressumError(null);
                void (async () => {
                  const result = await window.voicewall.openImpressumSource();
                  if (!result.ok) {
                    setImpressumError(result.message);
                  }
                })();
              }}
            >
              {t.impressumQuelle(IMPRESSUM_QUELLE_URL)}
            </button>
          </div>
          {impressumError !== null && (
            <p className="note error" role="alert">
              {impressumError}
            </p>
          )}
        </>
      )}

      {showDecrypt && (
        <PasswordDialog
          titel={t.entschluesselnTitel}
          beschreibung={t.entschluesselnBeschreibung}
          bestaetigenText={t.entschluesselnBestaetigen}
          minLength={1}
          mitWiederholung={false}
          busy={decryptBusy}
          onSubmit={(passwort) => void runDecrypt(passwort)}
          onCancel={() => {
            setShowDecrypt(false);
          }}
        />
      )}
    </div>
  );
}
