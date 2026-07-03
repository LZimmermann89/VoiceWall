/**
 * Sichert die Kopplung zwischen den in src/preload/overlay.ts inline
 * gehaltenen Kanalnamen und der zentralen Kanaldefinition ab (gleiche
 * Begruendung wie capture-channels.test.ts: Sandbox-Chunk-Vermeidung).
 */
import { describe, expect, it } from 'vitest';
import { IpcChannel } from '../../src/main/ipc/channels';

describe('Overlay-Kanalnamen (Kopplung Preload <-> channels.ts)', () => {
  it('haelt die vom Overlay-Preload gespiegelten Werte konstant', () => {
    expect(IpcChannel.OverlayState).toBe('overlay:state');
    expect(IpcChannel.OverlayCopyLast).toBe('overlay:copy-last');
  });
});
