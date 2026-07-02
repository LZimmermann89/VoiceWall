/**
 * Sichert die Kopplung zwischen den in src/preload/capture.ts inline gehaltenen
 * Kanalnamen und der zentralen Kanaldefinition ab. Der Capture-Preload haelt
 * die Namen bewusst als lokale Literale (Sandbox-Chunk-Vermeidung); dieser Test
 * stellt sicher, dass die zentralen Werte unveraendert bleiben. Aendert jemand
 * einen Wert in channels.ts, schlaegt dieser Test an und erinnert daran, auch
 * capture.ts anzupassen.
 */
import { describe, expect, it } from 'vitest';
import { IpcChannel } from '../../src/main/ipc/channels';

describe('Capture-Kanalnamen (Kopplung Preload <-> channels.ts)', () => {
  it('haelt die vom Capture-Preload gespiegelten Werte konstant', () => {
    expect(IpcChannel.CaptureStart).toBe('capture:start');
    expect(IpcChannel.CaptureStop).toBe('capture:stop');
    expect(IpcChannel.CapturePcm).toBe('capture:pcm');
    expect(IpcChannel.CaptureError).toBe('capture:error');
    expect(IpcChannel.CaptureStarted).toBe('capture:started');
  });
});
