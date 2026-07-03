/**
 * E2E-Helfer: liefert deterministisch das Hauptfenster (Verwaltungs-/Test-UI).
 * Seit M3 besitzt die App mehrere Fenster (Hauptfenster, Diktat-Overlay,
 * waehrend Aufnahmen zusaetzlich das versteckte Capture-Fenster); ein blindes
 * firstWindow() waere ein Rennen um die Lade-Reihenfolge.
 */
import type { ElectronApplication, Page } from '@playwright/test';

export async function getMainUiWindow(app: ElectronApplication): Promise<Page> {
  const deadline = Date.now() + 15_000;
  for (;;) {
    const main = app.windows().find((page) => page.url().includes('index.html'));
    if (main !== undefined) {
      return main;
    }
    if (Date.now() > deadline) {
      throw new Error('Hauptfenster (index.html) ist nicht innerhalb von 15 s erschienen.');
    }
    // Auf das naechste Fenster warten oder kurz pollen.
    await Promise.race([
      app.waitForEvent('window').catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 250)),
    ]);
  }
}
