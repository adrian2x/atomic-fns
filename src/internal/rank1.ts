/**
 * Shared pieces of the rank-1 (number, bigint, Decimal, Currency) total order.
 *
 * Rank-1 order is lexicographic: currency code first (`''` for anything that is not a Currency),
 * then numeric value, then the generic kind tie-break in `compare`. Because the code is the most
 * significant key, plain numbers sort before every Currency and Currencies group by code, so the
 * relation stays transitive across mixed values.
 */

import { ValueError } from '../globals/errors.js'

const codes = new WeakMap<object, string>()

/** Records the currency code of a Currency instance (called from its constructor). */
export function registerCurrencyCode(value: object, code: string): void {
  codes.set(value, code)
}

/** Currency code of `v`, or `''` when `v` is not a Currency. */
export function currencyCodeOf(v: unknown): string {
  return typeof v === 'object' && v !== null ? (codes.get(v) ?? '') : ''
}

/** Orders two currency codes (`''` sorts first). */
export function compareCurrencyCodes(a: string, b: string): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Rank-1 order: currency code first, then the numeric result.
 * @param codeX Currency code of the left value (`''` when not a Currency).
 * @param codeY Currency code of the right value (`''` when not a Currency).
 * @param numeric Numeric comparison, used only when the codes are equal.
 */
export function compareCodeThenValue(codeX: string, codeY: string, numeric: number): number {
  const byCode = compareCurrencyCodes(codeX, codeY)
  return byCode !== 0 ? byCode : numeric
}

/**
 * Throws when both values are Currencies with different codes.
 * @throws {ValueError} `currency mismatch: X vs Y`.
 */
export function assertSameCurrency(x: unknown, y: unknown): void {
  const cx = currencyCodeOf(x)
  if (cx === '') return
  const cy = currencyCodeOf(y)
  if (cy !== '' && cx !== cy) {
    throw new ValueError(`currency mismatch: ${cx} vs ${cy}`)
  }
}
