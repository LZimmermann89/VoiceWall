/**
 * Result<T, E>: erwartbare Fehler als Werte, nicht als Exceptions.
 *
 * Erwartbare Fehlerzustände (Modell-Download fehlgeschlagen, Checksumme falsch,
 * Mikrofon verweigert, ...) werden als typisierte Werte durch die Codebasis
 * gereicht. Nur wirklich unerwartete Zustände werfen. Dieses Modul ist reine
 * TypeScript-Logik ohne Node- und ohne DOM-Abhängigkeit.
 */

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E> = Ok<T> | Err<E>;

/** Erzeugt ein Erfolgsergebnis. */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/** Erzeugt ein Fehlerergebnis. */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/** Type Guard: Ergebnis ist ein Erfolg. */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/** Type Guard: Ergebnis ist ein Fehler. */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/** Transformiert den Erfolgswert, lässt Fehler unverändert durch. */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

/** Transformiert den Fehlerwert, lässt Erfolge unverändert durch. */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return result.ok ? result : err(fn(result.error));
}

/** Verkettet eine weitere Result-liefernde Operation an einen Erfolg. */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}

/** Liefert den Erfolgswert oder den angegebenen Ersatzwert. */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}
