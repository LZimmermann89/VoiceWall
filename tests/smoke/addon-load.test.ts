/**
 * CI-Smoke: belegt, dass das @fugood/whisper.node-Paket auf der jeweiligen
 * CI-Plattform (Linux, macOS, Windows) geladen werden kann und die genutzten
 * APIs Funktionen sind. Das ist der teilweise Beleg fuer die plattformweite
 * ABI-Verfuegbarkeit (M1-offen). N-API ist ABI-stabil, in reinem Node reicht
 * dieser Import als Naeherung; der volle Electron-Beweis folgt in E2E.
 *
 * Bewusst wird KEIN Modell geladen (kein transcribe/initWhisper-Aufruf): das
 * braeuchte die 574-MB-Datei, die CI nicht hat. Geprueft wird nur die
 * Lade-/API-Oberflaeche.
 */
import { describe, expect, it } from 'vitest';

describe('@fugood/whisper.node Addon-Load', () => {
  it('laesst sich importieren und exportiert die genutzten Funktionen', async () => {
    const whisper = await import('@fugood/whisper.node');
    expect(typeof whisper.initWhisper).toBe('function');
    expect(typeof whisper.initWhisperVad).toBe('function');
    expect(typeof whisper.toggleNativeLog).toBe('function');
    expect(typeof whisper.addNativeLogListener).toBe('function');
  });
});
