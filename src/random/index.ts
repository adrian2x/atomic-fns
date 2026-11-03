/**
 * This module implements pseudo-random generators for various distributions.
 *
 * @module random
 */

import { ValueError } from '../globals/errors.js'
import { isIterable, isObject } from '../globals/index.js'

/**
 * Returns a random float in `[min, max)` (max exclusive).
 * @param min Lower bound (inclusive).
 * @param max Upper bound (exclusive).
 */
export function random(min = 0, max = 1): number {
  return Math.random() * (max - min) + min
}

/**
 * Returns a random integer in `[min, max]` (inclusive).
 * @param min Lower bound (inclusive).
 * @param max Upper bound (inclusive).
 */
export function randomInt(min: number, max: number): number {
  if (max < min) {
    throw new RangeError('max must be >= min')
  }
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Returns the item at a uniform random index, or `undefined` if empty.
 * @param arr The sequence to pick from.
 */
export function choice<T>(arr: readonly T[]): T | undefined {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Returns a random sample of `k` items (without replacement).
 * @param arr Source array.
 * @param k Sample size.
 */
export function sample<T>(arr: readonly T[], k: number): T[] {
  if (k <= 0) return []
  if (k > arr.length) {
    throw new ValueError('sample size larger than population')
  }
  return shuffle(arr.slice()).slice(0, k)
}

/**
 * Fisher-Yates shuffle. Arrays are shuffled in place. Plain objects yield a
 * new shuffled array of their values.
 * @param coll Array or plain object.
 */
export function shuffle<T>(coll: T[] | Record<string, T> | Iterable<T>): T[] {
  const arr = Array.isArray(coll)
    ? coll
    : isIterable(coll)
      ? [...coll]
      : isObject(coll)
        ? Object.values(coll)
        : []
  const n = arr.length
  for (let i = 0; i < n - 1; i++) {
    const j = randomInt(i, n - 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
