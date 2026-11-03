/**
 * Shared pieces of the rank-1 (number, bigint, Decimal, Currency) total order.
 *
 * Rank-1 order is lexicographic: numeric value first, then unit code (`''` for unit-less
 * values), then the generic kind tie-break in `compare`. Numeric order wins first, so
 * Currencies and plain numbers with different amounts sort by amount; equal amounts keep
 * distinct units apart. Units come from `protocol.unit` (see {@link unitOf}).
 */

import { ValueError } from '../globals/errors.js'
import { unitOf } from '../operators/protocol.js'

/**
 * Rank-1 order after a numeric compare: when values differ return that result; when equal,
 * order by unit code (`''` sorts first).
 * @param numeric Numeric comparison of the two values.
 * @param unitX Unit code of the left value (`''` when unit-less).
 * @param unitY Unit code of the right value (`''` when unit-less).
 */
export function compareValueThenUnit(numeric: number, unitX: string, unitY: string): number {
  if (numeric !== 0) return numeric
  return unitX < unitY ? -1 : unitX > unitY ? 1 : 0
}

/**
 * Throws when both values carry different unit codes.
 * @throws {ValueError} `currency mismatch: X vs Y`.
 */
export function assertSameCurrency(x: unknown, y: unknown): void {
  const cx = unitOf(x)
  if (cx === '') return
  const cy = unitOf(y)
  if (cy !== '' && cx !== cy) {
    throw new ValueError(`currency mismatch: ${cx} vs ${cy}`)
  }
}
