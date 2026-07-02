/**
 * Schlanker, rein lokaler Logger. Schreibt in eine Logdatei unter userData und
 * spiegelt auf die Konsole. Niemals Telemetrie, kein Netzwerkversand: die
 * Logs verlassen den Rechner nie (Grundprinzip von VoiceWall).
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * Erstellt einen dateibasierten Logger. `debug` wird nur in die Datei
 * geschrieben (native whisper-Logs sind sehr gespraechig), ab `info` zusaetzlich
 * auf die Konsole.
 */
export function createLogger(userDataPath: string): Logger {
  const logDir = join(userDataPath, 'logs');
  mkdirSync(logDir, { recursive: true });
  const logFile = join(logDir, 'voicewall.log');

  const write = (level: LogLevel, message: string): void => {
    const line = `${new Date().toISOString()} [${level}] ${message}\n`;
    try {
      appendFileSync(logFile, line);
    } catch {
      // Ein fehlgeschlagener Log-Schreibvorgang darf die App nie stoppen.
    }
    if (level !== 'debug') {
      const target =
        level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      target(`[VoiceWall] ${message}`);
    }
  };

  return {
    debug: (message) => {
      write('debug', message);
    },
    info: (message) => {
      write('info', message);
    },
    warn: (message) => {
      write('warn', message);
    },
    error: (message) => {
      write('error', message);
    },
  };
}
