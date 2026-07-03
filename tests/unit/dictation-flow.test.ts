/**
 * Unit-Tests der Diktat-Flow-Zustandsmaschine (Toggle-Uebergaenge) und der
 * minimalen Transkript-Nachbearbeitung (trim/join).
 */
import { describe, expect, it } from 'vitest';
import {
  joinTranscriptSegments,
  transitionDictationFlow,
  type DictationFlowState,
} from '../../src/shared/dictation-flow';

describe('transitionDictationFlow', () => {
  it('Toggle aus idle startet die Aufnahme', () => {
    expect(transitionDictationFlow('idle', 'toggle')).toEqual({
      next: 'recording',
      action: 'start-recording',
    });
  });

  it('Toggle aus recording stoppt und flusht', () => {
    expect(transitionDictationFlow('recording', 'toggle')).toEqual({
      next: 'transcribing',
      action: 'stop-and-flush',
    });
  });

  it('Toggle wird waehrend transcribing/delivering ignoriert', () => {
    for (const state of ['transcribing', 'delivering'] as const) {
      expect(transitionDictationFlow(state, 'toggle')).toEqual({ next: state, action: 'none' });
    }
  });

  it('flush-complete fuehrt nur aus transcribing zur Zustellung', () => {
    expect(transitionDictationFlow('transcribing', 'flush-complete')).toEqual({
      next: 'delivering',
      action: 'deliver',
    });
    for (const state of ['idle', 'recording', 'delivering'] as const) {
      expect(transitionDictationFlow(state, 'flush-complete')).toEqual({
        next: state,
        action: 'none',
      });
    }
  });

  it('delivery-complete beendet nur delivering', () => {
    expect(transitionDictationFlow('delivering', 'delivery-complete')).toEqual({
      next: 'idle',
      action: 'none',
    });
    for (const state of ['idle', 'recording', 'transcribing'] as const) {
      expect(transitionDictationFlow(state, 'delivery-complete')).toEqual({
        next: state,
        action: 'none',
      });
    }
  });

  it('cancel (Sperrbildschirm/Suspend) verwirft Aufnahme und Transkription', () => {
    expect(transitionDictationFlow('recording', 'cancel')).toEqual({
      next: 'idle',
      action: 'abort-recording',
    });
    expect(transitionDictationFlow('transcribing', 'cancel')).toEqual({
      next: 'idle',
      action: 'abort-recording',
    });
    expect(transitionDictationFlow('idle', 'cancel')).toEqual({ next: 'idle', action: 'none' });
    expect(transitionDictationFlow('delivering', 'cancel')).toEqual({
      next: 'delivering',
      action: 'none',
    });
  });

  it('kompletter Toggle-Zyklus endet wieder in idle', () => {
    let state: DictationFlowState = 'idle';
    state = transitionDictationFlow(state, 'toggle').next;
    state = transitionDictationFlow(state, 'toggle').next;
    state = transitionDictationFlow(state, 'flush-complete').next;
    state = transitionDictationFlow(state, 'delivery-complete').next;
    expect(state).toBe('idle');
  });
});

describe('joinTranscriptSegments', () => {
  it('trimmt, verbindet und kollabiert Whitespace', () => {
    expect(joinTranscriptSegments(['  Guten Tag. ', '', '  Der  Vertrag ist da. '])).toBe(
      'Guten Tag. Der Vertrag ist da.',
    );
  });

  it('liefert leeren String fuer leere/stille Segmente', () => {
    expect(joinTranscriptSegments([])).toBe('');
    expect(joinTranscriptSegments(['   ', ''])).toBe('');
  });
});
