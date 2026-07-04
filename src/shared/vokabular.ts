/**
 * Fach-Wörterbuch je Firma (Stufe 1, ABARBEITUNG 2.7):
 * `.voicewall/vokabular.json` mit Begriffen (fuer den Whisper-Initial-Prompt)
 * und einer deterministischen Ersetzungsliste (Nachkorrektur haeufiger
 * Fehltranskriptionen).
 *
 * HARTE GUARDRAIL (ABARBEITUNG 2.7): Alles hier ist reine, lokale
 * String-Verarbeitung. Kein Modell, kein Cloud-LLM, kein Netzwerkzugriff,
 * fuer gar nichts. Jede Regel ist deterministisch und auditierbar.
 *
 * Sicherheitsregeln:
 * - Die Datei liegt im Firmenordner und ist fremder Input: an der
 *   Vertrauensgrenze wird sie mit diesem zod-Schema geparst.
 * - `von`-Strings der Ersetzungsliste werden IMMER als Literal behandelt,
 *   nie als Regex (ReDoS-/Injektionsregel 3.5): die Ersetzung laeuft ueber
 *   einen eigenen indexOf-Scan, nicht ueber new RegExp(nutzereingabe).
 *
 * Dieses Modul bleibt plattformneutral (nur zod, kein Node/Electron/DOM).
 */
import { z } from 'zod';

/** Aktuelle Schema-Version der vokabular.json. */
export const VOKABULAR_SCHEMA_VERSION = 1;

/** Obergrenzen (bewusst knapp: das Woerterbuch ist ein Fach-, kein Volltextlexikon). */
export const MAX_BEGRIFFE = 200;
export const MAX_ERSETZUNGEN = 200;

/**
 * Harte Kappung des Initial-Prompts in Zeichen. Whisper akzeptiert rund
 * 224 Tokens Prompt; 600 Zeichen deutsche Fachbegriffe liegen konservativ
 * darunter (Entscheidung E37).
 */
export const PROMPT_MAX_CHARS = 600;

// eslint-disable-next-line no-control-regex -- Steuerzeichen sind genau das Pruefziel.
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

/** Ein Fachbegriff/Eigenname/Aktenzeichen (1 bis 80 Zeichen, keine Steuerzeichen). */
export const begriffSchema = z
  .string()
  .min(1, 'Ein Begriff darf nicht leer sein.')
  .max(80, 'Ein Begriff darf höchstens 80 Zeichen lang sein.')
  .refine((value) => !CONTROL_CHARS.test(value), {
    message: 'Begriffe dürfen keine Steuerzeichen enthalten.',
  })
  .refine((value) => value.trim().length > 0, {
    message: 'Ein Begriff darf nicht nur aus Leerzeichen bestehen.',
  });

/** Eine deterministische Ersetzungsregel (von -> zu, beide Literale). */
export const ersetzungSchema = z.object({
  von: z
    .string()
    .min(1, 'Das Feld "von" darf nicht leer sein.')
    .max(80, 'Das Feld "von" darf höchstens 80 Zeichen lang sein.')
    .refine((value) => !CONTROL_CHARS.test(value), {
      message: 'Das Feld "von" darf keine Steuerzeichen enthalten.',
    })
    .refine((value) => value.trim().length > 0, {
      message: 'Das Feld "von" darf nicht nur aus Leerzeichen bestehen.',
    }),
  zu: z
    .string()
    .max(80, 'Das Feld "zu" darf höchstens 80 Zeichen lang sein.')
    .refine((value) => !CONTROL_CHARS.test(value), {
      message: 'Das Feld "zu" darf keine Steuerzeichen enthalten.',
    }),
});
export type Ersetzung = z.infer<typeof ersetzungSchema>;

/** Die vokabular.json eines Firmenordners. */
export const vokabularSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    begriffe: z
      .array(begriffSchema)
      .max(MAX_BEGRIFFE, `Höchstens ${String(MAX_BEGRIFFE)} Begriffe sind erlaubt.`),
    ersetzungen: z
      .array(ersetzungSchema)
      .max(MAX_ERSETZUNGEN, `Höchstens ${String(MAX_ERSETZUNGEN)} Ersetzungen sind erlaubt.`),
  })
  .passthrough();
export type Vokabular = z.infer<typeof vokabularSchema>;

/** Liefert ein leeres Vokabular (frisch erzeugt, nicht geteilt). */
export function defaultVokabular(): Vokabular {
  return { schemaVersion: VOKABULAR_SCHEMA_VERSION, begriffe: [], ersetzungen: [] };
}

/** Ergebnis des Prompt-Baus (Kappung wird gemeldet, nie Inhalte). */
export interface InitialPromptResult {
  /** Der Prompt oder null, wenn keine Begriffe vorhanden sind. */
  readonly prompt: string | null;
  /** Anzahl der tatsaechlich in den Prompt uebernommenen Begriffe. */
  readonly verwendeteBegriffe: number;
  /** True, wenn Begriffe wegen des Zeichenlimits weggelassen wurden. */
  readonly gekappt: boolean;
}

/**
 * Baut den Whisper-Initial-Prompt aus den Begriffen: eine kommaseparierte
 * Liste ("VoiceWall, Müller GmbH, ..."). Form empirisch am eingecheckten
 * Test-WAV verifiziert (Entscheidung E37): die Komma-Liste korrigiert die
 * bekannte Fehltranskription "Voice Wall" zu "VoiceWall" genauso zuverlaessig
 * wie ein ausformulierter deutscher Satz, laesst aber mehr Begriffe in das
 * ~224-Token-Limit. Gekappt wird hart bei PROMPT_MAX_CHARS Zeichen; der
 * Aufrufer loggt bei Kappung NUR die Anzahl, nie Inhalte.
 */
export function buildInitialPrompt(begriffe: readonly string[]): InitialPromptResult {
  const bereinigt = begriffe.map((begriff) => begriff.trim()).filter((b) => b.length > 0);
  if (bereinigt.length === 0) {
    return { prompt: null, verwendeteBegriffe: 0, gekappt: false };
  }
  let prompt = '';
  let verwendet = 0;
  for (const begriff of bereinigt) {
    const kandidat = prompt.length === 0 ? begriff : `${prompt}, ${begriff}`;
    if (kandidat.length > PROMPT_MAX_CHARS) {
      return {
        prompt: prompt.length === 0 ? null : prompt,
        verwendeteBegriffe: verwendet,
        gekappt: true,
      };
    }
    prompt = kandidat;
    verwendet += 1;
  }
  return { prompt, verwendeteBegriffe: verwendet, gekappt: false };
}

/**
 * Ist das Zeichen Teil eines Wortes? Unicode-korrekt ueber Property-Klassen
 * (Buchstaben inkl. Umlauten, Ziffern, Unterstrich). `\b` von JavaScript-Regex
 * versagt bei Umlauten (ASCII-basiert) und wird deshalb bewusst NICHT benutzt.
 */
function isWordChar(char: string): boolean {
  return /[\p{L}\p{N}_]/u.test(char);
}

/**
 * Ersetzt EINE Regel wortgrenzen-bewusst im Text. `von` wird strikt als
 * Literal behandelt (indexOf-Scan, kein Regex aus Nutzereingaben). Grenzen:
 * beginnt/endet `von` mit einem Wortzeichen, darf davor/danach kein weiteres
 * Wortzeichen stehen ("Meier" ersetzt nie in "Vermeiden", "Müller" nie in
 * "Müllers"; Entscheidung E36). Der eingesetzte `zu`-Text wird von derselben
 * Regel nicht erneut durchsucht (kein Selbstbezug, terminiert immer).
 */
function replaceLiteralWord(text: string, von: string, zu: string): string {
  const startsWordy = isWordChar(von.charAt(0));
  const endsWordy = isWordChar(von.charAt(von.length - 1));
  let result = '';
  let cursor = 0;
  for (;;) {
    const found = text.indexOf(von, cursor);
    if (found === -1) {
      result += text.slice(cursor);
      return result;
    }
    const before = found === 0 ? '' : text.charAt(found - 1);
    const afterIndex = found + von.length;
    const after = afterIndex >= text.length ? '' : text.charAt(afterIndex);
    const grenzeVorne = !startsWordy || before === '' || !isWordChar(before);
    const grenzeHinten = !endsWordy || after === '' || !isWordChar(after);
    if (grenzeVorne && grenzeHinten) {
      result += text.slice(cursor, found) + zu;
      cursor = afterIndex;
    } else {
      // Kein ganzes Wort: ein Zeichen weiter suchen.
      result += text.slice(cursor, found + 1);
      cursor = found + 1;
    }
  }
}

/**
 * Wendet die Ersetzungsliste deterministisch auf einen Text an.
 *
 * Regeln (Teil A3):
 * - wortgrenzen-bewusst (keine Teilwort-Treffer, Unicode-korrekt),
 * - case-sensitiv exakt wie eingegeben,
 * - laengere `von`-Strings zuerst (verhindert Teilketten-Konflikte),
 * - `von` ist IMMER ein Literal, nie ein Regex (ReDoS-Regel 3.5),
 * - Regeln laufen sequenziell; das Ergebnis frueherer (laengerer) Regeln
 *   kann von spaeteren Regeln getroffen werden (bewusst, deterministisch).
 */
export function applyErsetzungen(text: string, ersetzungen: readonly Ersetzung[]): string {
  const sortiert = [...ersetzungen]
    .filter((regel) => regel.von.length > 0)
    .sort((a, b) => b.von.length - a.von.length);
  let result = text;
  for (const { von, zu } of sortiert) {
    result = replaceLiteralWord(result, von, zu);
  }
  return result;
}

// ---------------------------------------------------------------------------
// IPC-Sichten (vocab:get / vocab:save)
// ---------------------------------------------------------------------------

/** Ergebnis des Vokabular-Abrufs der aktiven Firma. */
export const vokabularGetResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), vokabular: vokabularSchema }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type VokabularGetResult = z.infer<typeof vokabularGetResultSchema>;

/** Eingabe des Vokabular-Speicherns (Begriffe plus Ersetzungen). */
export const vokabularSaveInputSchema = z.object({
  begriffe: z
    .array(begriffSchema)
    .max(MAX_BEGRIFFE, `Höchstens ${String(MAX_BEGRIFFE)} Begriffe sind erlaubt.`),
  ersetzungen: z
    .array(ersetzungSchema)
    .max(MAX_ERSETZUNGEN, `Höchstens ${String(MAX_ERSETZUNGEN)} Ersetzungen sind erlaubt.`),
});
export type VokabularSaveInput = z.infer<typeof vokabularSaveInputSchema>;
