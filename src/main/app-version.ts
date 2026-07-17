/**
 * Zur BUILDZEIT eingebettete App-Version (Fix fuer den Pruefstempel-Footer):
 * electron-vite ersetzt `__APP_VERSION__` per define durch die Version aus
 * package.json (siehe electron.vite.config.ts; vitest.config.ts definiert
 * denselben Wert fuer Unit-Tests).
 *
 * Hintergrund: `app.getVersion()` liefert im ungepackten Dev-Modus die
 * ELECTRON-Version (z. B. "43.0.0"), nicht die App-Version; der
 * Pruefstempel-Footer zeigte deshalb im Dev-Modus eine falsche Version.
 * Die Buildzeit-Konstante ist in Dev UND im gepackten Build korrekt.
 */
declare const __APP_VERSION__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev';
