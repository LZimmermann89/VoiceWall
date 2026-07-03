/**
 * Unit-Tests der Clipboard-Sequenz (Datenschutzmassnahme R7): sichern,
 * schreiben, pasten, wiederherstellen, inklusive Race-Schutz (Nutzer kopiert
 * waehrend der Verzoegerung) und der Resilienz-Regel (kein Restore ohne
 * erfolgreichen Paste). Alles gegen ein gemocktes Clipboard-Interface.
 */
import { describe, expect, it } from 'vitest';
import {
  runClipboardSequence,
  type ClipboardLike,
} from '../../src/main/clipboard/transcript-clipboard';
import { err, ok } from '../../src/shared/result';

/** Deterministisches Fake-Clipboard mit Schreibprotokoll. */
function fakeClipboard(initial: string): ClipboardLike & { writes: string[] } {
  let content = initial;
  const writes: string[] = [];
  return {
    writes,
    readText: () => content,
    writeText: (text: string) => {
      content = text;
      writes.push(text);
    },
  };
}

const immediateDelay = (): Promise<void> => Promise.resolve();

const OPTIONS = { restorePrevious: true, restoreDelayMs: 1000 };

describe('runClipboardSequence', () => {
  it('sichert den alten Inhalt, schreibt das Transkript, pastet und stellt wieder her', async () => {
    const clipboard = fakeClipboard('alter Inhalt');
    let pasteCount = 0;
    const result = await runClipboardSequence('Diktat-Text', OPTIONS, {
      clipboard,
      delay: immediateDelay,
      paste: () => {
        pasteCount += 1;
        // Beim Paste muss das Transkript in der Zwischenablage liegen.
        expect(clipboard.readText()).toBe('Diktat-Text');
        return Promise.resolve(ok(undefined));
      },
    });

    expect(pasteCount).toBe(1);
    expect(result.pasteResult).toEqual(ok(undefined));
    await expect(result.restore).resolves.toBe('restored');
    // Das Transkript hat die Zwischenablage wieder verlassen (R7).
    expect(clipboard.readText()).toBe('alter Inhalt');
    expect(clipboard.writes).toEqual(['Diktat-Text', 'alter Inhalt']);
  });

  it('Race-Schutz: ueberschreibt NICHT, wenn der Nutzer zwischenzeitlich kopiert hat', async () => {
    const clipboard = fakeClipboard('alter Inhalt');
    const result = await runClipboardSequence('Diktat-Text', OPTIONS, {
      clipboard,
      delay: () => {
        // Nutzer kopiert waehrend der Verzoegerung selbst etwas.
        clipboard.writeText('vom Nutzer kopiert');
        return Promise.resolve();
      },
      paste: () => Promise.resolve(ok(undefined)),
    });

    await expect(result.restore).resolves.toBe('skipped-user-copied');
    expect(clipboard.readText()).toBe('vom Nutzer kopiert');
  });

  it('laesst das Transkript liegen, wenn die Wiederherstellung abgeschaltet ist', async () => {
    const clipboard = fakeClipboard('alter Inhalt');
    const result = await runClipboardSequence(
      'Diktat-Text',
      { restorePrevious: false, restoreDelayMs: 1000 },
      { clipboard, delay: immediateDelay, paste: () => Promise.resolve(ok(undefined)) },
    );

    await expect(result.restore).resolves.toBe('disabled');
    expect(clipboard.readText()).toBe('Diktat-Text');
  });

  it('Resilienz: kein Restore bei fehlgeschlagenem Paste, Text bleibt verfuegbar', async () => {
    const clipboard = fakeClipboard('alter Inhalt');
    const result = await runClipboardSequence('Diktat-Text', OPTIONS, {
      clipboard,
      delay: immediateDelay,
      paste: () => Promise.resolve(err('Einfuegen fehlgeschlagen.')),
    });

    expect(result.pasteResult).toEqual(err('Einfuegen fehlgeschlagen.'));
    await expect(result.restore).resolves.toBe('skipped-no-paste');
    expect(clipboard.readText()).toBe('Diktat-Text');
  });

  it('Resilienz: kein Restore, wenn gar kein Paste-Weg existiert (paste: null)', async () => {
    const clipboard = fakeClipboard('alter Inhalt');
    const result = await runClipboardSequence('Diktat-Text', OPTIONS, {
      clipboard,
      delay: immediateDelay,
      paste: null,
    });

    expect(result.pasteResult).toBeNull();
    await expect(result.restore).resolves.toBe('skipped-no-paste');
    expect(clipboard.readText()).toBe('Diktat-Text');
  });

  it('stellt auch eine leere Zwischenablage wieder her (leerer Ausgangszustand)', async () => {
    const clipboard = fakeClipboard('');
    const result = await runClipboardSequence('Diktat-Text', OPTIONS, {
      clipboard,
      delay: immediateDelay,
      paste: () => Promise.resolve(ok(undefined)),
    });

    await expect(result.restore).resolves.toBe('restored');
    expect(clipboard.readText()).toBe('');
  });
});
