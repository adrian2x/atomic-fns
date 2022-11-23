/**
 * Math and algebraic operations.
 *
 * @module Math
 */

import { call, Predicate } from '../globals/index.js'
import { reduce } from '../itertools/index.js'
import { gt, id, lt } from '../operators/index.js'

/**
 * Returns the absolute value of a number. The argument may be a number or an object implementing the `abs()`.
 * @param x The value.
 * @returns The absolute value.
 */
export function abs(x): number {
  const op = call(x, 'abs')
  if (op != null) return op
  return Math.abs(x)
}

/**
 * Round `x` to the number of digits after the decimal point. If `digits` is
 * omitted, it returns the nearest integer to x.
 *
 * @param {number} x
 * @param {number} [digits=0]
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round Math.round()}
 */
export function round(x: number, digits = 0): number {
  const base = 10 ** digits
  return Math.round(x * base) / base
}

/**
 * Rounds down and returns the largest integer less than or equal to a given number.
 * @param x A number.
 * @returns Nearest integer less than or equal to number.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/floor Math.floor()}
 */
export const floor = (x: number) => Math.floor(x)

/**
 * Rounds up and returns the largest integer greater than or equal to a given number.
 * @param x A number.
 * @returns Nearest integer greater than or equal to number.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/ceil Math.ceil()}
 */
export const ceil = (x: number) => Math.ceil(x)

/**
 * Returns a tuple like `[x / y, x % y]`.
 *
 * @param x
 * @param y
 * @returns
 */
export function divmod(x: number, y: number): [number, number] {
  return [Math.floor(x / y), x % y]
}

export function log2(x): number {
  if (x > 0) {
    return Math.log(x) * 1.442695
  }
  return Number.NaN
}

export function logBase(x, y): number {
  if (x > 0 && y > 0) {
    return Math.log(y) / Math.log(x)
  }
  return Number.NaN
}

/**
 * Returns the smallest element in an iterable. The optional `key` argument specifies a transform on the elements before comparing them. If the elements in the iterable are objects that implement a custom `lt` method, this will be called to compare.
 * @param iterable The iterable to inspect.
 * @param key Optional key function to transform the elements (default `id`).
 * @returns The smallest element in the iterable.
 */
export function min(iterable: number[]): number
export function min<T>(iterable: Iterable<T>, key?: Predicate<T>): T
export function min<T>(iterable: Iterable<T>, key = id): T {
  return reduce(iterable, (x, y) => (lt(key(x), key(y)) ? x : y))
}

/**
 * Returns the largest element in an iterable. The optional `key` argument specifies a transform on the elements before comparing them. If the elements in the iterable are objects that implement a custom `gt` method, this will be called to compare.
 * @param iterable The iterable to inspect.
 * @param key Optional key function to transform the elements (default `id`).
 * @returns The largest element in the iterable.
 */
export function max(iterable: number[]): number
export function max<T>(iterable: Iterable<T>, key?: Predicate<T>): T
export function max<T>(iterable: Iterable<T>, key = id): T {
  return reduce(iterable, (x, y) => (gt(key(x), key(y)) ? x : y))
}

/**
 * Computes the mean of the values in `iterable` and accepts an optional `key` function which is invoked for each element to generate the values to be averaged.
 * @param {Array<number>|Iterable<T>} iterable
 * @param {Function} [key] Optional iteratee invoked per element.
 * @returns Returns the mean value or `NaN` if no elements.
 * @template T
 * @example
```js
let objects = [{ 'n': 4 }, { 'n': 2 }, { 'n': 8 }, { 'n': 6 }]

mean(objects, (o) => o.n)
// 5
```
 */
export function mean(iterable: number[]): number
export function mean<T>(iterable: Iterable<T>, key?: Predicate<T>): number
export function mean<T>(iterable: Iterable<T>, key = id): number {
  let total = 0
  let count = 0
  for (const value of iterable) {
    total += key(value)
    count++
  }
  if (count !== 0) return total / count
  return Number.NaN
}

/**
 * Sums `initial` and the items of an iterable and returns the total.
 * @param args The elements to add to `initial`.
 * @param initial The initial value to add to (default `0`).
 * @returns The total sum of initial and iterable elements.
 * @example
```js
sum([1, 2, 3, 4])
// 10

sum([1, 2, 3, 4], 5)
// 15
```
 */
export function sum(args: number[]): number
export function sum<T>(args: Iterable<T>, key?: Predicate<T>): number
export function sum<T>(args: Iterable<T>, key: Predicate<T> = id): number {
  let initial = 0
  for (const x of args) {
    initial += key(x)
  }
  return initial
}
