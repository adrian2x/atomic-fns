/**
 * This module implements pseudo-random generators for various distributions.
 *
 * @module random
 */

import { ValueError } from '../globals/errors.js'
import { isIterable, isObject } from '../globals/index.js'
import { assertNotHugeSparse } from '../internal/arrayKeys.js'

const TWO_53 = 2 ** 53

/** Redraws before accepting that a stubbed `Math.random` keeps repeating a rejected draw. */
const MAX_DRAWS = 64

/**
 * Returns a random float in `[min, max)` (max exclusive).
 * One argument is `max`, with `min` 0.
 * @throws {RangeError} when a bound is not finite or `max < min`.
 */
export function random(max?: number): number
export function random(min: number | undefined, max: number): number
/**
 * @param first Lower bound (inclusive), or the upper bound when it is the only argument.
 * @param second Upper bound (exclusive).
 */
export function random(first?: number, second?: number): number {
  const min = second === undefined ? 0 : (first ?? 0)
  const max = second ?? first ?? 1
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new RangeError('min and max must be finite')
  }
  if (max < min) {
    throw new RangeError('max must be >= min')
  }
  const r = Math.random()
  const value = min * (1 - r) + max * r
  return value < max ? value : min
}

/**
 * Returns a uniform random integer in `[min, max]` (inclusive), at any span of safe integers.
 * @param min Lower bound (inclusive).
 * @param max Upper bound (inclusive).
 * @throws {RangeError} when a bound is not a safe integer or `max < min`.
 */
export function randomInt(min: number, max: number): number {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
    throw new RangeError('min and max must be safe integers')
  }
  if (max < min) {
    throw new RangeError('max must be >= min')
  }
  // One draw covers 2^53 values; a wider span adds a coin flip for the top bit.
  const wide = max - min >= TWO_53
  const span = wide ? TWO_53 : max - min + 1
  const bucket = (TWO_53 - (TWO_53 % span)) / span
  for (let draws = 0; draws < MAX_DRAWS; draws++) {
    const draw = Math.floor(Math.random() * TWO_53)
    const top = wide && Math.random() >= 0.5 ? TWO_53 : 0
    const value = min + top + (draw - (draw % bucket)) / bucket
    if (value <= max) return value
  }
  return max
}

/** The items of an array (itself), an iterable, or a plain object (its values); else none. */
function itemsOf<T>(coll: Iterable<T> | Record<string, T>): T[] {
  if (Array.isArray(coll)) {
    assertNotHugeSparse(coll)
    return coll as T[]
  }
  if (isIterable(coll)) return [...coll]
  return isObject(coll) ? Object.values(coll) : []
}

/**
 * Returns an item at a uniform random index, or `undefined` if there are none.
 * @param coll Array, iterable, or plain object (its values).
 */
export function choice<T>(coll: Iterable<T> | Record<string, T>): T | undefined {
  const items = itemsOf(coll)
  return items[Math.floor(Math.random() * items.length)]
}

/**
 * Returns a random sample of `k` items (without replacement). A negative `k` samples nothing.
 * @param coll Array, iterable, or plain object (its values).
 * @param k Sample size.
 * @throws {RangeError} when `k` is not an integer.
 * @throws {ValueError} when `k` exceeds the item count.
 */
export function sample<T>(coll: Iterable<T> | Record<string, T>, k: number): T[] {
  if (!Number.isInteger(k)) {
    throw new RangeError('k must be an integer')
  }
  if (k <= 0) return []
  const items = itemsOf(coll)
  if (k > items.length) {
    throw new ValueError('sample size larger than population')
  }
  return shuffle(items.slice()).slice(0, k)
}

/**
 * Fisher-Yates shuffle. Arrays are shuffled in place. Other iterables and plain objects yield a
 * new shuffled array of their items.
 * @param coll Array, iterable, or plain object (its values).
 */
export function shuffle<T>(coll: Iterable<T> | Record<string, T>): T[] {
  const arr = itemsOf(coll)
  const n = arr.length
  for (let i = 0; i < n - 1; i++) {
    const j = randomInt(i, n - 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
