/**
 * Zentraler, serialisierter Schreibpfad der globalen Konfiguration.
 *
 * Problem (Lost-Update-Muster): mehrere Konfig-Schreiber (FlowController:
 * Hotkey/Modellwahl/Zwischenablage/Aufbereitung/UI-Sprache; CompanyManager:
 * Firmenliste/aktive Firma/Auto-Speichern) hielten je einen eigenen
 * in-memory-Stand und schrieben ihn komplett zurueck. Ein Schreiber mit
 * veraltetem Stand ueberschrieb dabei die Aenderungen der anderen (dasselbe
 * Muster, das bei setUiSprache real die frisch angelegten Firmen
 * geloescht haette; Race "Keine aktive Firma").
 *
 * Loesung: ALLE Schreiber laufen ueber EINE Instanz dieses Writers.
 * `update(mutator)` haengt sich an eine Promise-Kette (mutex-artige
 * Serialisierung): frisch von der Platte LESEN, den Mutator auf den
 * frischen Stand anwenden, atomar SCHREIBEN. Zwei parallele Updates koennen
 * einander damit nie mehr verlieren; der Mutator beschreibt nur noch die
 * DELTA-Aenderung, nie den Gesamtzustand.
 *
 * Fehler eines Updates vergiften die Kette nicht (nachfolgende Updates
 * laufen weiter); der Fehler geht an den jeweiligen Aufrufer.
 */
import type { GlobalConfig } from '../../shared/config';
import type { Logger } from '../log/logger';
import { readGlobalConfig, writeGlobalConfig } from './config-store';

/** Reine Delta-Aenderung auf dem frisch gelesenen Konfigurationsstand. */
export type GlobalConfigMutator = (current: GlobalConfig) => GlobalConfig;

export interface GlobalConfigWriterDeps {
  readonly userDataPath: string;
  readonly logger: Logger;
  /** Injektionspunkt fuer Tests (deterministisches Lese-Timing). */
  readonly readConfig?: () => Promise<GlobalConfig>;
  /** Injektionspunkt fuer Tests (deterministisches Schreib-Timing). */
  readonly writeConfig?: (config: GlobalConfig) => Promise<void>;
}

export class GlobalConfigWriter {
  /** Serialisierungs-Kette: jedes Update wartet auf das vorherige. */
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: GlobalConfigWriterDeps) {}

  /**
   * Fuehrt genau EIN Lesen-Aendern-Schreiben aus, serialisiert gegen alle
   * anderen Updates dieser Instanz. Liefert den geschriebenen Stand zurueck
   * (fuer die Aufrufer-Caches).
   */
  update(mutate: GlobalConfigMutator): Promise<GlobalConfig> {
    const run = this.chain.then(async (): Promise<GlobalConfig> => {
      const current = await (this.deps.readConfig?.() ??
        readGlobalConfig(this.deps.userDataPath, this.deps.logger));
      const next = mutate(current);
      await (this.deps.writeConfig?.(next) ?? writeGlobalConfig(this.deps.userDataPath, next));
      return next;
    });
    // Die Kette laeuft auch nach einem Fehler weiter; der Fehler selbst
    // erreicht den Aufrufer ueber das zurueckgegebene Promise.
    this.chain = run.catch(() => undefined);
    return run;
  }
}
