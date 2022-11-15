/**
 * This module implements pseudo-random generators for various distributions.
 *
 * @module Random
 */

import { isObject } from '../globals/index.js'

/**
 * Returns a random float between a [min, max) value (max exclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export const random = (min = 0, max = 1) => Math.random() * (max - min) + min

/**
 * Returns a random integer between a [min, max] value (inclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export const randomInt = (min = 0, max = 1) => Math.round(random(min, max))

/**
 * Returns the item at some random index in a sequence.
 * @returns {T}
 * @template T
 */
export const choice = <T>(arr: T[]) => {
  if (!arr?.length) return
  return arr[randomInt(0, arr.length - 1)]
}

/**
 * Returns a random sample of size k from a list of items.
 * @param {Array} arr
 * @param {number} size
 * @returns A new array with `size` random elements from `arr`.
 * @template T
 */
export function sample<T>(arr: T[], size: number) {
  if (!arr?.length || arr.length < size) return []
  return shuffle(arr.slice()).slice(-size)
}

/**
 * Shuffles a collection elements in-place. Uses the Fisher-Yates algorithm for uniform shuffling. If collection is an Object it returns shuffled `Object.values()`.
 *
 * @param {Array} arr
 * @param {number} size
 * @returns The shuffled array.
 * @template T
 */
export function shuffle<T>(arr: T[], size?: number) {
  if (!arr?.length) return arr
  if (isObject(arr)) arr = Object.values(arr)
  if (size == null) size = arr.length - 1
  for (let i = 0; i <= size; i++) {
    const j = randomInt(i, size)
    const temp = arr[j]
    arr[j] = arr[i]
    arr[i] = temp
  }
  return arr
}
