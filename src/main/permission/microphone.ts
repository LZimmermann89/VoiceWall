/**
 * Mikrofon-Berechtigung auf Betriebssystemebene.
 *
 * macOS (TCC): Der Zugriffsstatus wird ueber `systemPreferences` geprueft. Bei
 * `not-determined` wird proaktiv `askForMediaAccess('microphone')` ausgeloest,
 * damit der macOS-Systemdialog erscheint, solange der Einrichter daneben steht.
 * Fehlt zusaetzlich der `NSMicrophoneUsageDescription`-Schluessel in der
 * Info.plist, schlaegt getUserMedia still fehl (siehe resources/Info.plist.additions).
 *
 * Windows/Linux: Es gibt keine TCC-Entsprechung; hier wird 'granted'
 * angenommen und der reale Test erfolgt ueber getUserMedia im Capture-Fenster.
 */
import { systemPreferences } from 'electron';
import { err, ok, type Result } from '../../shared/result';
import type { Logger } from '../log/logger';

export type MicrophoneAccessState = 'granted' | 'denied' | 'restricted' | 'unknown';

export interface MicrophonePermissionError {
  readonly state: MicrophoneAccessState;
  readonly message: string;
}

/**
 * Stellt sicher, dass der OS-Mikrofonzugriff moeglich ist. Fragt auf macOS bei
 * unbestimmtem Status aktiv nach.
 */
export async function ensureMicrophoneAccess(
  logger: Logger,
): Promise<Result<MicrophoneAccessState, MicrophonePermissionError>> {
  if (process.platform !== 'darwin') {
    // Ausserhalb macOS entscheidet der reale getUserMedia-Aufruf.
    return ok('granted');
  }

  const status = systemPreferences.getMediaAccessStatus('microphone');
  logger.info(`macOS-Mikrofonstatus: ${status}`);

  if (status === 'granted') {
    return ok('granted');
  }
  if (status === 'not-determined') {
    const granted = await systemPreferences.askForMediaAccess('microphone');
    logger.info(`macOS-Mikrofon-Abfrage beantwortet: ${granted ? 'erlaubt' : 'abgelehnt'}`);
    return granted
      ? ok('granted')
      : err({
          state: 'denied',
          message:
            'Der Mikrofonzugriff wurde abgelehnt. Bitte in den Systemeinstellungen unter Datenschutz und Sicherheit, Mikrofon, VoiceWall erlauben und die App neu starten.',
        });
  }
  if (status === 'denied') {
    return err({
      state: 'denied',
      message:
        'Der Mikrofonzugriff ist gesperrt. Bitte in den Systemeinstellungen unter Datenschutz und Sicherheit, Mikrofon, VoiceWall aktivieren und die App neu starten.',
    });
  }
  return err({
    state: 'restricted',
    message:
      'Der Mikrofonzugriff ist auf diesem Rechner eingeschränkt (z. B. durch eine Geräteverwaltung). Bitte die Systemadministration kontaktieren.',
  });
}
