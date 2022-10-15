import { isObject, round } from './globals'

/** Returns a random float between a [min, max) value (max exclusive). */
export const random = (min = 0, max = 1) => Math.random() * (max - min) + min

/** Returns a random integer between a [min, max] value (inclusive). */
export const randomInt = (min = 0, max = 1) => Math.round(random(min, max))

/** Returns the item at some random index in a sequence. */
export const choice = (arr: any[]) => {
  if (!arr || !arr.length) return
  return arr[randomInt(0, arr.length - 1)]
}

/**
 * Returns a random sample of size k from a list of items.
 *
 * @export
 * @param {any[]} arr
 * @param {number} k
 * @return
 */
export function sample(arr: any[], k: number) {
  if (!arr || !arr.length || arr.length < k) return
  const result: typeof arr = []
  for (let i = 0; i < k; i++) {
    result.push(choice(arr))
  }
  return result
}

/**
 * Shuffles a collection elements in-place. Uses the Fisher-Yates algorithm for uniform shuffling. If collection is an Object it returns shuffled `Object.values()`.
 *
 * @param {*} arr
 * @return
 */
export function shuffle(arr) {
  if (!arr || !arr.length) return
  if (isObject(arr)) arr = Object.values(arr)
  const n = arr.length - 1
  for (let i = n; i > 0; i--) {
    const j = randomInt(0, i)
    const temp = arr[j]
    arr[j] = arr[i]
    arr[i] = temp
  }
  return arr
}
