/**
 * Beleg-Ansicht ("Status/Beleg", M7, ABARBEITUNG 4.8): sammelt die pruefbaren
 * Fakten, die den lokalen Charakter von VoiceWall belegen. Reine Lese-Logik
 * im Main-Prozess (Modellkatalog mit SHA-256, Modellordner, Einwilligungs-
 * Zeitstempel, App-Version, Betriebslog-Pfad). Keine Netzwerkzugriffe.
 *
 * Das ist die UI-Seite von "Beleg statt Behauptung": der Kunde sieht die
 * aktive Modellversion samt Pruefsumme, "0 externe Verbindungen" mit Verweis
 * auf den Netzwerk-Selbsttest und die Konsent-Dokumentation.
 */
import type { BelegInfo, BelegModell } from '../../shared/company';
import { readConsent } from '../consent/consent-store';
import { logFilePath } from '../log/logger';
import { ALL_MODEL_DESCRIPTORS, whisperDescriptorFor } from '../model/model-catalog';
import { getModelsDirectory, getModelStatuses } from '../model/model-store';

export interface BelegDeps {
  readonly userDataPath: string;
  readonly appVersion: string;
  readonly platform: string;
  /** Aktive Whisper-Modellwahl (globale Konfig). */
  readonly modelChoice: 'q5_0' | 'fp16';
}

/**
 * Baut die Beleg-Informationen zusammen. Fuer die Modellliste werden die
 * echten Datei-Integritaetspruefungen (SHA-256 gegen die Katalog-Konstanten)
 * herangezogen; `vorhanden` bedeutet damit "vorhanden UND verifiziert".
 */
export async function collectBelegInfo(deps: BelegDeps): Promise<BelegInfo> {
  const statuses = await getModelStatuses(deps.userDataPath, ALL_MODEL_DESCRIPTORS);
  const aktiverWhisperId = whisperDescriptorFor(deps.modelChoice).id;
  const modelle: BelegModell[] = statuses.map((status) => ({
    id: status.descriptor.id,
    label: status.descriptor.label,
    sha256: status.descriptor.sha256,
    pfad: status.path,
    vorhanden: status.present,
    aktiv: status.descriptor.id === aktiverWhisperId || status.descriptor.id === 'silero-vad',
  }));

  const consent = await readConsent(deps.userDataPath);

  return {
    appVersion: deps.appVersion,
    plattform: deps.platform,
    modelle,
    konsentZeitstempel: consent?.grantedAtIso ?? null,
    logPfad: logFilePath(deps.userDataPath, 'betrieb'),
    modellOrdner: getModelsDirectory(deps.userDataPath),
  };
}
