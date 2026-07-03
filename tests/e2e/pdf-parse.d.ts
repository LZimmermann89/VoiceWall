/**
 * Minimale Typdeklaration fuer pdf-parse (Test-only-devDependency, exakt
 * gepinnt, Entscheidung E26). Es wird bewusst der direkte lib-Pfad
 * importiert: der Paket-Einstieg (index.js) enthaelt einen Debug-Modus, der
 * ausserhalb von CommonJS-`module.parent` eine Fixture-Datei lesen wuerde.
 */
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    readonly text: string;
    readonly numpages: number;
  }
  function pdfParse(data: Buffer): Promise<PdfParseResult>;
  export = pdfParse;
}
