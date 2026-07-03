/**
 * Lese-/Schreibzugriff auf die globale Konfigurationsdatei
 * (userData/config.json). Zod-validiert an der Vertrauensgrenze, Datei-Rechte
 * 0600, rein lokal. Unbekannte Felder bleiben beim Lesen-Aendern-Schreiben
 * erhalten (passthrough), damit das Format kompatibel erweiterbar ist; die
 * volle Konfig-Architektur folgt in M5.
 */
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultGlobalConfig, globalConfigSchema, type GlobalConfig } from '../../shared/config';
import type { Logger } from '../log/logger';

function configPath(userDataPath: string): string {
  return join(userDataPath, 'config.json');
}

/**
 * Liest die globale Konfiguration. Fehlende oder ungueltige Dateien fuehren
 * nie zum Abbruch: es gelten dann die Defaults (mit Log-Hinweis), damit die
 * App immer startfaehig bleibt.
 */
export async function readGlobalConfig(
  userDataPath: string,
  logger: Logger,
): Promise<GlobalConfig> {
  let raw: string;
  try {
    raw = await readFile(configPath(userDataPath), 'utf8');
  } catch {
    // Datei existiert noch nicht: Defaults, kein Fehler.
    return defaultGlobalConfig();
  }
  try {
    const parsed = globalConfigSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      return parsed.data;
    }
    logger.warn(
      `Konfigurationsdatei ungueltig, es gelten die Standardwerte. Details: ${parsed.error.message}`,
    );
  } catch (error) {
    logger.warn(
      `Konfigurationsdatei nicht lesbar (kein gueltiges JSON), es gelten die Standardwerte. Details: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return defaultGlobalConfig();
}

/** Schreibt die globale Konfiguration (Datei-Modus 0600). */
export async function writeGlobalConfig(userDataPath: string, config: GlobalConfig): Promise<void> {
  const path = configPath(userDataPath);
  await writeFile(path, JSON.stringify(config, null, 2), { mode: 0o600 });
  // `mode` greift nur beim Anlegen; bestehende Dateien explizit haerten.
  await chmod(path, 0o600);
}
