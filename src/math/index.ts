/**
 * Math and algebraic operations.
 *
 * @module math
 */

import { decimal, isDecimalBrand, type Decimal } from '../decimal/index.js'
import { ZeroDivisionError } from '../globals/errors.js'
import {
  arrayFromIterableMap,
  assertArrayNotHugeSparse,
  requireIterable
} from '../internal/iterable.js'
import { add, compare, gte, hasMethod, identity, lt, protocol } from '../operators/index.js'
import type { Predicate } from '../types.js'

export type { Predicate } from '../types.js'

/**
 * Returns the absolute value. Dispatches on `protocol.abs`, then bigint, else `Math.abs`.
 * @param x The value.
 * @returns The absolute value.
 */
export function abs(x: unknown): unknown {
  if (hasMethod(x, protocol.abs)) return x[protocol.abs]()
  if (typeof x === 'bigint') return x < 0n ? -x : x
  return Math.abs(x as number)
}

/** Fractional digit count of the shortest round-trip decimal string of `x`. */
function fractionalDigitCount(x: number): number {
  const s = String(x)
  const expMatch = /e([+-]?\d+)$/i.exec(s)
  if (expMatch !== null) {
    const exp = Number(expMatch[1])
    const coeff = s.slice(0, expMatch.index)
    const dot = coeff.indexOf('.')
    const fracLen = dot === -1 ? 0 : coeff.length - dot - 1
    return Math.max(0, fracLen - exp)
  }
  const dot = s.indexOf('.')
  return dot === -1 ? 0 : s.length - dot - 1
}

function roundTiesUp(x: Decimal, digits: number): Decimal {
  return x.round(digits, x.lt(0) ? 'halfDown' : 'halfUp')
}

/**
 * Round `x` to `digits` places after the decimal point (ties toward +Infinity).
 * Uses the shortest round-trip decimal string of `x`. Negative `digits` round
 * to tens, hundreds, etc. Any integer `digits` is accepted: values already
 * exact at that place are returned unchanged, and a rounding unit more than
 * 10× `|x|` yields `0`. Non-finite values are returned unchanged. Other values
 * coerce with `Number`, as `Math.round` does, and a Decimal rounds exactly and
 * stays a Decimal, within {@link Decimal.round}'s `precision` bounds.
 *
 * @param x The number to round.
 * @param digits Fractional digits (default 0); may be negative.
 * @returns The rounded number (`0` instead of `-0`).
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round Math.round()}
 */
export function round(x: number, digits?: number): number
export function round(x: Decimal, digits?: number): Decimal
/**
 * @param x The value to round.
 * @param digits Fractional digits (default 0); may be negative.
 */
export function round(x: number | Decimal, digits = 0): number | Decimal {
  if (isDecimalBrand(x)) return roundTiesUp(decimal(x), digits)
  const n = Number(x)
  if (!Number.isFinite(n)) return n
  if (!Number.isInteger(digits)) {
    throw new RangeError('digits must be an integer')
  }
  if (n === 0) return 0
  if (digits >= fractionalDigitCount(n)) return n
  // unit = 10^(-digits) exceeds |n| by more than a factor of 10 -> 0.
  // At the boundary Decimal decides between 0 and the unit.
  if (digits < -1 - Math.log10(Math.abs(n))) return 0
  return roundTiesUp(decimal(String(n)), digits).toNumber()
}

/**
 * Python's `divmod`: the floored quotient and a remainder with the sign of `y`, the remainder
 * exact to the last bit. Infinite or NaN operands follow Python, so `divmod(-5, Infinity)` is
 * `[-1, Infinity]`.
 *
 * @param x Dividend.
 * @param y Divisor.
 * @returns Quotient and remainder with floor division.
 * @throws {ZeroDivisionError} when `y` is zero.
 */
export function divmod(x: number, y: number): [number, number] {
  if (y === 0) throw new ZeroDivisionError('division by zero')
  let remainder = x % y
  let quotient = (x - remainder) / y
  if (remainder === 0) {
    remainder = y < 0 ? -0 : 0
  } else if (y < 0 !== remainder < 0) {
    remainder += y
    quotient -= 1
  }
  // A zero quotient takes its sign from the true one.
  if (quotient === 0) return [(x / y) * 0, remainder]
  const floored = Math.floor(quotient)
  return [quotient - floored > 0.5 ? floored + 1 : floored, remainder]
}

/**
 * Logarithm of `y` in base `x`.
 * @param x Base.
 * @param y Argument.
 */
export function logBase(x: number, y: number): number {
  if (x > 0 && y > 0) {
    return Math.log(y) / Math.log(x)
  }
  return Number.NaN
}

function checkedIterable<T>(iterable: Iterable<T>): Iterable<T> {
  const items = requireIterable<T>(iterable)
  assertArrayNotHugeSparse(items)
  return items
}

/** `lt`, with pairs it cannot relate placed by the `compare` total order. */
function comesBefore(a: unknown, b: unknown): boolean {
  return lt(a, b) || (!gte(a, b) && compare(a, b) < 0)
}

function extreme<T>(
  iterable: Iterable<T>,
  key: (x: T) => unknown,
  better: (a: unknown, b: unknown) => boolean
): T | undefined {
  let best: T | undefined
  let bestKey: unknown
  for (const value of checkedIterable(iterable)) {
    const current = key(value)
    if (current === null || current === undefined || Number.isNaN(current)) continue
    if (bestKey === undefined || better(current, bestKey)) {
      best = value
      bestKey = current
    }
  }
  return best
}

/**
 * Returns the smallest element in an iterable. Among ties, returns the first.
 * The optional `key` transforms elements before comparing, once each. Elements whose key is
 * `null`, `undefined`, or `NaN` are skipped, as in Lodash. Mixed kinds keep the `compare` total
 * order (numbers before strings), arrays compare by content, and plain objects order by
 * first-seen identity, so compare those through `key`. Empty or all skipped -> `undefined`.
 * @returns The smallest element, or `undefined` if there is none.
 */
export function min(iterable: number[]): number | undefined
export function min<T>(iterable: Iterable<T>, key?: (x: T) => unknown): T | undefined
/**
 * @param iterable The iterable to inspect.
 * @param key Optional key function (default `identity`).
 */
export function min<T>(iterable: Iterable<T>, key: (x: T) => unknown = identity): T | undefined {
  return extreme(iterable, key, comesBefore)
}

/**
 * Returns the largest element in an iterable. Among ties, returns the first.
 * The optional `key` transforms elements before comparing, once each. Elements whose key is
 * `null`, `undefined`, or `NaN` are skipped, as in Lodash. Mixed kinds keep the `compare` total
 * order (strings after numbers), arrays compare by content, and plain objects order by
 * first-seen identity, so compare those through `key`. Empty or all skipped -> `undefined`.
 * @returns The largest element, or `undefined` if there is none.
 */
export function max(iterable: number[]): number | undefined
export function max<T>(iterable: Iterable<T>, key?: (x: T) => unknown): T | undefined
/**
 * @param iterable The iterable to inspect.
 * @param key Optional key function (default `identity`).
 */
export function max<T>(iterable: Iterable<T>, key: (x: T) => unknown = identity): T | undefined {
  return extreme(iterable, key, (a, b) => comesBefore(b, a))
}

/**
 * Computes the mean of the values in `iterable` and accepts an optional `key` function which is invoked for each element to generate the values to be averaged.
 * Each value coerces with `Number`, so strings and bigints average while a Decimal throws;
 * pass `(d) => d.toNumber()` as `key` for those.
 * @example
```js
const objects = [{ 'n': 4 }, { 'n': 2 }, { 'n': 8 }, { 'n': 6 }]

mean(objects, o => o.n)
// 5
```
 * @returns The mean value or `NaN` if no elements.
 */
export function mean(iterable: number[]): number
export function mean<T>(iterable: Iterable<T>, key?: Predicate<T>): number
/**
 * @param iterable Values to average.
 * @param key Optional iteratee invoked per element.
 */
export function mean<T>(iterable: Iterable<T>, key: Predicate<T> = identity): number {
  const values = arrayFromIterableMap(iterable, (x) => Number(key(x as T)))
  return sum(values) / values.length
}

/** What {@link sum} returns for values of type `V`. An empty iterable sums to `0`. */
export type SumOf<V> = V extends number
  ? number
  : V extends string
    ? string | 0
    : V extends bigint
      ? bigint | 0
      : V | 0

/**
 * Sums the items of an iterable and returns the total.
 * All numbers add natively. Anything else folds with the `add` operator from the first item, so
 * Decimals stay exact, bigints stay bigints, and strings concatenate as in Lodash. Holes are
 * items too: `key` sees each one.
 * @example
```js
sum([1, 2, 3, 4])
// 10

sum([{n: 1}, {n: 2}], o => o.n)
// 3
```
 * @returns The total sum.
 */
export function sum(args: Iterable<number>): number
export function sum<V>(args: Iterable<V>): SumOf<V>
export function sum<T, V>(args: Iterable<T>, key: (x: T) => V): SumOf<V>
/**
 * @param args The elements to sum.
 * @param key Optional key function.
 */
export function sum(args: Iterable<unknown>, key: (x: unknown) => unknown = identity): unknown {
  let total: unknown = 0
  let first = true
  for (const x of checkedIterable(args)) {
    const value = key(x)
    if (first) total = value
    else if (typeof total === 'number' && typeof value === 'number') total += value
    else total = add(total, value)
    first = false
  }
  return total
}
