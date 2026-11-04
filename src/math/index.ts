/**
 * Math and algebraic operations.
 *
 * @module math
 */

import { decimal } from '../decimal/index.js'
import { assertNotHugeSparse } from '../internal/arrayKeys.js'
import { arrayFromIterableMap, forEachArrayElement, isTypedArray } from '../internal/iterable.js'
import { gt, hasMethod, identity, lt, protocol } from '../operators/index.js'
import type { Predicate } from '../types.js'

export type { Predicate } from '../types.js'

/**
 * Returns the absolute value. Dispatches on `protocol.abs`, else `Math.abs`.
 * @param x The value.
 * @returns The absolute value.
 */
export function abs(x: unknown): unknown {
  if (hasMethod(x, protocol.abs)) return x[protocol.abs]()
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

/**
 * Round `x` to `digits` places after the decimal point (ties toward +Infinity).
 * Uses the shortest round-trip decimal string of `x`. Negative `digits` round
 * to tens, hundreds, etc. Any integer `digits` is accepted: values already
 * exact at that place are returned unchanged, and a rounding unit more than
 * 10× `|x|` yields `0`. Non-finite values are returned unchanged.
 *
 * @param x The number to round.
 * @param digits Fractional digits (default 0); may be negative.
 * @returns The rounded number (`0` instead of `-0`).
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round Math.round()}
 */
export function round(x: number, digits = 0): number {
  if (!Number.isFinite(x)) return x
  if (!Number.isInteger(digits)) {
    throw new RangeError('digits must be an integer')
  }
  // SPEC-R61: every finite return is 0 instead of -0.
  if (Object.is(x, -0)) return 0
  if (digits >= fractionalDigitCount(x)) return x
  const absX = Math.abs(x)
  // unit = 10^(-digits) exceeds |x| by more than a factor of 10 -> 0.
  // At the boundary Decimal decides between 0 and the unit.
  if (absX !== 0 && digits < -1 - Math.log10(absX)) return 0
  const rounded = decimal(String(x)).round(digits, x < 0 ? 'halfDown' : 'halfUp')
  const n = Number(rounded.toString())
  return Object.is(n, -0) ? 0 : n
}

/**
 * Returns `[Math.floor(x / y), x - q * y]`.
 *
 * @param x Dividend.
 * @param y Divisor.
 * @returns Quotient and remainder with floor division.
 */
export function divmod(x: number, y: number): [number, number] {
  const q = Math.floor(x / y)
  return [q, x - q * y]
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

function extreme<T>(
  iterable: Iterable<T>,
  key: (x: T) => unknown,
  better: (a: unknown, b: unknown) => boolean
): T | undefined {
  if (Array.isArray(iterable)) assertNotHugeSparse(iterable)
  const it = Iterator.from(iterable)
  const head = it.next()
  if (head.done) return undefined
  let best = head.value
  for (const value of it) {
    if (better(key(value), key(best))) best = value
  }
  return best
}

/**
 * Returns the smallest element in an iterable. Among ties, returns the first.
 * The optional `key` transforms elements before comparing. Empty -> `undefined`.
 * @returns The smallest element, or `undefined` if empty.
 */
export function min(iterable: number[]): number | undefined
export function min<T>(iterable: Iterable<T>, key?: (x: T) => unknown): T | undefined
/**
 * @param iterable The iterable to inspect.
 * @param key Optional key function (default `identity`).
 */
export function min<T>(iterable: Iterable<T>, key: (x: T) => unknown = identity): T | undefined {
  return extreme(iterable, key, lt)
}

/**
 * Returns the largest element in an iterable. Among ties, returns the first.
 * The optional `key` transforms elements before comparing. Empty -> `undefined`.
 * @returns The largest element, or `undefined` if empty.
 */
export function max(iterable: number[]): number | undefined
export function max<T>(iterable: Iterable<T>, key?: (x: T) => unknown): T | undefined
/**
 * @param iterable The iterable to inspect.
 * @param key Optional key function (default `identity`).
 */
export function max<T>(iterable: Iterable<T>, key: (x: T) => unknown = identity): T | undefined {
  return extreme(iterable, key, gt)
}

/**
 * Computes the mean of the values in `iterable` and accepts an optional `key` function which is invoked for each element to generate the values to be averaged.
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
  if (Array.isArray(iterable)) assertNotHugeSparse(iterable)
  const values = arrayFromIterableMap(iterable, (x) => Number(key(x as T)))
  return sum(values) / values.length
}

/**
 * Sums the items of an iterable and returns the total.
 * @example
```js
sum([1, 2, 3, 4])
// 10

sum([{n: 1}, {n: 2}], o => o.n)
// 3
```
 * @returns The total sum.
 */
export function sum(args: number[]): number
export function sum<T>(args: Iterable<T>, key?: Predicate<T, number>): number
/**
 * @param args The elements to sum.
 * @param key Optional key function.
 */
export function sum<T>(args: Iterable<T>, key: Predicate<T, number> = (x) => x as number): number {
  let initial = 0
  if (isTypedArray<T>(args)) {
    forEachArrayElement(args, (x) => {
      initial += key(x)
      return undefined
    })
    return initial
  }
  for (const x of args) {
    initial += key(x)
  }
  return initial
}
