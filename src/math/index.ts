/**
 * Math and algebraic operations.
 *
 * @module math
 */

import { decimal } from '../decimal/index.js'
import { assertNotHugeSparse } from '../internal/arrayKeys.js'
import { arrayFromIterableMap } from '../internal/iterable.js'
import { gt, hasMethod, identity, lt, protocol } from '../operators/index.js'
import type { Predicate } from '../types.js'

/**
 * Returns the absolute value. Dispatches on `protocol.abs`, else `Math.abs`.
 * @param x The value.
 * @returns The absolute value.
 */
export function abs(x: unknown): unknown {
  if (hasMethod(x, protocol.abs)) return x[protocol.abs]()
  return Math.abs(x as number)
}

/**
 * Round `x` to `digits` places after the decimal point (ties toward +Infinity).
 * Uses the shortest round-trip decimal string of `x`. Negative `digits` round
 * to tens, hundreds, etc. Non-finite values are returned unchanged.
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
 * @param iterable The iterable to inspect.
 * @param key Optional key function (default `identity`).
 * @returns The smallest element, or `undefined` if empty.
 */
export function min(iterable: number[]): number | undefined
export function min<T>(iterable: Iterable<T>, key?: (x: T) => unknown): T | undefined
export function min<T>(iterable: Iterable<T>, key: (x: T) => unknown = identity): T | undefined {
  return extreme(iterable, key, lt)
}

/**
 * Returns the largest element in an iterable. Among ties, returns the first.
 * The optional `key` transforms elements before comparing. Empty -> `undefined`.
 * @param iterable The iterable to inspect.
 * @param key Optional key function (default `identity`).
 * @returns The largest element, or `undefined` if empty.
 */
export function max(iterable: number[]): number | undefined
export function max<T>(iterable: Iterable<T>, key?: (x: T) => unknown): T | undefined
export function max<T>(iterable: Iterable<T>, key: (x: T) => unknown = identity): T | undefined {
  return extreme(iterable, key, gt)
}

/**
 * Computes the mean of the values in `iterable` and accepts an optional `key` function which is invoked for each element to generate the values to be averaged.
 * @param iterable Values to average.
 * @param key Optional iteratee invoked per element.
 * @returns The mean value or `NaN` if no elements.
 * @example
```js
const objects = [{ 'n': 4 }, { 'n': 2 }, { 'n': 8 }, { 'n': 6 }]

mean(objects, o => o.n)
// 5
```
 */
export function mean(iterable: number[]): number
export function mean<T>(iterable: Iterable<T>, key?: Predicate<T>): number
export function mean<T>(iterable: Iterable<T>, key: Predicate<T> = identity): number {
  if (Array.isArray(iterable)) assertNotHugeSparse(iterable)
  const values = arrayFromIterableMap(iterable, (x) => Number(key(x as T)))
  return sum(values) / values.length
}

/**
 * Sums the items of an iterable and returns the total.
 * @param args The elements to sum.
 * @param key Optional key function.
 * @returns The total sum.
 * @example
```js
sum([1, 2, 3, 4])
// 10

sum([{n: 1}, {n: 2}], o => o.n)
// 3
```
 */
export function sum(args: number[]): number
export function sum<T>(args: Iterable<T>, key?: Predicate<T, number>): number
export function sum<T>(args: Iterable<T>, key: Predicate<T, number> = (x) => x as number): number {
  let initial = 0
  for (const x of args) {
    initial += key(x)
  }
  return initial
}
