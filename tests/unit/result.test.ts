import { describe, expect, it } from 'vitest';
import {
  andThen,
  err,
  isErr,
  isOk,
  map,
  mapErr,
  ok,
  unwrapOr,
  type Result,
} from '../../src/shared/result';

describe('Result<T, E>', () => {
  it('ok() erzeugt ein Erfolgsergebnis mit Wert', () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(42);
  });

  it('err() erzeugt ein Fehlerergebnis mit Fehlerwert', () => {
    const result = err('MODEL_CHECKSUM_MISMATCH');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('MODEL_CHECKSUM_MISMATCH');
  });

  it('isOk() und isErr() sind exklusive Type Guards', () => {
    const success: Result<number, string> = ok(1);
    const failure: Result<number, string> = err('fehler');

    expect(isOk(success)).toBe(true);
    expect(isErr(success)).toBe(false);
    expect(isOk(failure)).toBe(false);
    expect(isErr(failure)).toBe(true);

    if (isOk(success)) {
      expect(success.value).toBe(1);
    }
    if (isErr(failure)) {
      expect(failure.error).toBe('fehler');
    }
  });

  it('map() transformiert nur den Erfolgswert', () => {
    const success: Result<number, string> = ok(2);
    const failure: Result<number, string> = err('fehler');

    expect(map(success, (n) => n * 10)).toEqual(ok(20));
    expect(map(failure, (n: number) => n * 10)).toEqual(err('fehler'));
  });

  it('mapErr() transformiert nur den Fehlerwert', () => {
    const success: Result<number, string> = ok(2);
    const failure: Result<number, string> = err('roh');

    expect(mapErr(success, (e: string) => e.toUpperCase())).toEqual(ok(2));
    expect(mapErr(failure, (e) => e.toUpperCase())).toEqual(err('ROH'));
  });

  it('andThen() verkettet Result-liefernde Operationen und stoppt beim ersten Fehler', () => {
    const parse = (raw: string): Result<number, string> => {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? ok(parsed) : err('KEINE_ZAHL');
    };
    const requirePositive = (n: number): Result<number, string> =>
      n > 0 ? ok(n) : err('NICHT_POSITIV');

    expect(andThen(parse('5'), requirePositive)).toEqual(ok(5));
    expect(andThen(parse('-3'), requirePositive)).toEqual(err('NICHT_POSITIV'));
    expect(andThen(parse('abc'), requirePositive)).toEqual(err('KEINE_ZAHL'));
  });

  it('unwrapOr() liefert Wert oder Ersatzwert', () => {
    const success: Result<number, string> = ok(7);
    const failure: Result<number, string> = err('fehler');

    expect(unwrapOr(success, 0)).toBe(7);
    expect(unwrapOr(failure, 0)).toBe(0);
  });
});
