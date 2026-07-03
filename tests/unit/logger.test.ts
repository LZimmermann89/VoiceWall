/**
 * Beweis-Tests des gehaerteten Loggers (ABARBEITUNG 3.6, M4):
 * 1. Redaction: als sensibel geltende Felder (Transkript, Audio,
 *    Zwischenablage, Firmenname-Freitext, ...) erreichen die Logdatei NIE,
 *    auch nicht auf debug-Level und auch nicht als nicht-allowgelistete
 *    Felder. Erlaubte Metadaten (Zeichenzahl, Dauer) kommen durch.
 * 2. Rotation: groessenbasiert, maximal N Dateien, aelteste wird geloescht.
 * 3. Rechte: Log-Ordner 0700, Logdatei 0600 (POSIX).
 * 4. JSON-Lines: jede Zeile ist valides JSON mit ts/level/event.
 */
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createLogger, logDirectoryPath, logFilePath, redactMeta } from '../../src/main/log/logger';

let dirs: string[] = [];

async function freshUserData(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'voicewall-logger-'));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of dirs) {
    await rm(dir, { recursive: true, force: true });
  }
  dirs = [];
});

const SECRET_TRANSCRIPT = 'GEHEIMES-DIKTAT-Patient-Meier-hat-Diagnose-X';
const SECRET_AUDIO = 'PCM-BYTES-BASE64-abcdef';
const SECRET_CLIPBOARD = 'ALTER-ZWISCHENABLAGE-INHALT';
const SECRET_COMPANY = 'Rohtext Firmenname GmbH & Co: /../evil';

describe('Redaction (zentral, allowlist-basiert)', () => {
  it('laesst sensible Felder NIE in die Logdatei, auch nicht via debug', async () => {
    const userData = await freshUserData();
    const logger = createLogger(userData);

    const sensitiveMeta = {
      transcript: SECRET_TRANSCRIPT,
      transkriptText: SECRET_TRANSCRIPT,
      audio: SECRET_AUDIO,
      clipboardPrevious: SECRET_CLIPBOARD,
      firmennameFreitext: SECRET_COMPANY,
      text: SECRET_TRANSCRIPT,
      irgendeinUnbekanntesFeld: SECRET_TRANSCRIPT,
    };
    logger.debug('debug-ereignis', sensitiveMeta);
    logger.info('info-ereignis', sensitiveMeta);
    logger.warn('warn-ereignis', sensitiveMeta);
    logger.error('error-ereignis', sensitiveMeta);

    const content = await readFile(logFilePath(userData), 'utf8');
    expect(content).not.toContain(SECRET_TRANSCRIPT);
    expect(content).not.toContain(SECRET_AUDIO);
    expect(content).not.toContain(SECRET_CLIPBOARD);
    expect(content).not.toContain(SECRET_COMPANY);
    expect(content).not.toContain('GEHEIMES');
    expect(content).toContain('[redigiert]');
  });

  it('laesst explizit freigegebene Metadaten durch', async () => {
    const userData = await freshUserData();
    const logger = createLogger(userData);
    logger.info('Transkript gespeichert.', { chars: 1240, durationMs: 3200 });

    const content = await readFile(logFilePath(userData), 'utf8');
    const line = JSON.parse(content.trim().split('\n').at(-1) ?? '{}') as Record<string, unknown>;
    expect(line['chars']).toBe(1240);
    expect(line['durationMs']).toBe(3200);
    expect(line['level']).toBe('info');
    expect(line['event']).toBe('Transkript gespeichert.');
    expect(typeof line['ts']).toBe('string');
  });

  it('redactMeta redigiert verbotene Feldnamen selbst bei Allowlist-Namen', () => {
    // Doppeltes Gate: selbst wenn ein sensibler Name je allowgelistet wuerde,
    // greift die Verbotsliste (Substring, case-insensitiv).
    const result = redactMeta({
      Transcript: 'x',
      ZWISCHENABLAGE: 'y',
      lastTranscriptChars: 'z',
      chars: 5,
    });
    expect(result['Transcript']).toBe('[redigiert]');
    expect(result['ZWISCHENABLAGE']).toBe('[redigiert]');
    expect(result['lastTranscriptChars']).toBe('[redigiert]');
    expect(result['chars']).toBe(5);
  });

  it('redigiert Nicht-Primitive und entschaerft Steuerzeichen in Strings', () => {
    const result = redactMeta({
      // @ts-expect-error bewusst falscher Typ zur Laufzeit-Absicherung
      reason: { nested: 'objekt' },
      outcome: 'ok\u0000\u001Fzeile',
    });
    expect(result['reason']).toBe('[redigiert]');
    expect(result['outcome']).toBe('ok  zeile');
  });
});

describe('Rotation (groessenbasiert)', () => {
  it('rotiert bei Ueberschreiten der Maximalgroesse und begrenzt auf maxFiles', async () => {
    const userData = await freshUserData();
    const logger = createLogger(userData, { maxFileBytes: 2000, maxFiles: 3 });

    // Genug Zeilen schreiben, um mehrfach zu rotieren.
    for (let index = 0; index < 200; index += 1) {
      logger.debug(`Ereignis Nummer ${String(index)} mit etwas Fuelltext zur Groesse.`);
    }

    const files = (await readdir(logDirectoryPath(userData))).sort();
    expect(files).toContain('betrieb.log');
    expect(files).toContain('betrieb.log.1');
    expect(files).toContain('betrieb.log.2');
    // Niemals mehr als maxFiles Dateien:
    expect(files.filter((name) => name.startsWith('betrieb.log')).length).toBeLessThanOrEqual(3);
    expect(files).not.toContain('betrieb.log.3');

    // Keine Datei waechst nennenswert ueber die Grenze (eine Zeile Toleranz).
    for (const name of files) {
      const { size } = await stat(join(logDirectoryPath(userData), name));
      expect(size).toBeLessThan(2500);
    }
  });
});

describe('Datei- und Ordnerrechte (POSIX)', () => {
  it.skipIf(process.platform === 'win32')(
    'setzt 0700 auf den Ordner, 0600 auf die Datei',
    async () => {
      const userData = await freshUserData();
      const logger = createLogger(userData);
      logger.info('Rechte-Testeintrag.');

      const dirMode = (await stat(logDirectoryPath(userData))).mode & 0o777;
      const fileMode = (await stat(logFilePath(userData))).mode & 0o777;
      expect(dirMode).toBe(0o700);
      expect(fileMode).toBe(0o600);
    },
  );
});

describe('Struktur (JSON-Lines) und Streams', () => {
  it('schreibt ausschliesslich valide JSON-Zeilen', async () => {
    const userData = await freshUserData();
    const logger = createLogger(userData);
    logger.info('Zeile eins');
    logger.warn('Zeile zwei', { count: 2 });
    logger.debug('Zeile drei');

    const lines = (await readFile(logFilePath(userData), 'utf8')).trim().split('\n');
    expect(lines.length).toBe(3);
    for (const line of lines) {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      expect(typeof parsed['ts']).toBe('string');
      expect(typeof parsed['level']).toBe('string');
      expect(typeof parsed['event']).toBe('string');
    }
  });

  it('unterstuetzt den Setup-Stream getrennt vom Betriebslog (M6-Andockpunkt)', async () => {
    const userData = await freshUserData();
    const betrieb = createLogger(userData, { stream: 'betrieb' });
    const setup = createLogger(userData, { stream: 'setup' });
    betrieb.info('Betriebsereignis');
    setup.info('Setupereignis');

    const betriebContent = await readFile(logFilePath(userData, 'betrieb'), 'utf8');
    const setupContent = await readFile(logFilePath(userData, 'setup'), 'utf8');
    expect(betriebContent).toContain('Betriebsereignis');
    expect(betriebContent).not.toContain('Setupereignis');
    expect(setupContent).toContain('Setupereignis');
  });
});
