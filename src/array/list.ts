/**
 * Array building blocks: `chunk`, `zip`, `range`, `remove`, `dropWhile`, `takeWhile`.
 */

import { assertNotHugeSparse, walkArray } from '../internal/sparse.ts'

/** The longest array the platform can build. */
const MAX_LENGTH = 2 ** 32 - 1

/**
 * `array` split into consecutive pieces of `size` elements; the last piece holds the rest.
 * @param array The array to split.
 * @param size The length of each piece, a positive integer.
 * @returns A new array of new arrays.
 * @throws {RangeError} when `size` is not a positive integer, or `array` is a huge sparse array.
 * @example
 * ```ts
 * chunk([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
 * ```
 */
export function chunk<T>(array: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`chunk size must be a positive integer, got ${String(size)}`)
  }
  assertNotHugeSparse(array as unknown[])
  const out: T[][] = []
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size))
  return out
}

/**
 * Rows built from the elements at each index of `arrays`: `zip(a, b)[i]` is `[a[i], b[i]]`. The
 * result is as long as the longest input, and shorter inputs give `undefined`, as lodash does, so
 * `zip(...zip(a, b))` restores `a` and `b` padded to one length.
 * @param arrays The arrays to combine.
 * @returns A new array of rows.
 * @throws {RangeError} when an input is a huge sparse array.
 * @example
 * ```ts
 * zip(['a', 'b'], [1, 2]) // [['a', 1], ['b', 2]]
 * zip(...[['a', 1], ['b', 2]]) // [['a', 'b'], [1, 2]]
 * ```
 */
export function zip<A extends readonly (readonly unknown[])[]>(
  ...arrays: A
): { [K in keyof A]: A[K][number] | undefined }[] {
  let length = 0
  for (const arr of arrays) {
    assertNotHugeSparse(arr as unknown[])
    length = Math.max(length, arr.length)
  }
  return Array.from({ length }, (_, i) => arrays.map((arr) => arr[i])) as {
    [K in keyof A]: A[K][number] | undefined
  }[]
}

/**
 * The numbers from `start` up to, not including, `stop`, `step` apart, with Python's bounds:
 * `range(stop)` starts at 0, and a negative `step` counts down. Each element is
 * `start + i * step`, so fractional steps do not drift. Numbers are doubles: past 2^53, or with a
 * `step` smaller than the gap between doubles near the bounds, neighbouring numbers round to the
 * same value. The length cap is the longest array the platform allows, not a memory budget, so
 * bound `stop` yourself when it comes from untrusted input.
 * @param start The first number, or `stop` when it is the only argument.
 * @param stop The bound the numbers stop before.
 * @param step The distance between numbers; defaults to 1.
 * @returns A new array, empty when `start` is already past `stop`.
 * @throws {TypeError} when a bound or `step` is not a number.
 * @throws {RangeError} for a `NaN` or infinite bound, a zero or infinite `step`, or more than
 * 2^32 - 1 numbers.
 * @example
 * ```ts
 * range(4) // [0, 1, 2, 3]
 * range(1, 10, 3) // [1, 4, 7]
 * range(3, 0, -1) // [3, 2, 1]
 * ```
 */
export function range(stop: number): number[]
/** {@link range} from `start`, with an optional `step`. */
export function range(start: number, stop: number, step?: number): number[]
export function range(first: number, last?: number, by?: number): number[] {
  const [start, stop, step] = last === undefined ? [0, first, 1] : [first, last, by ?? 1]
  for (const n of [start, stop, step]) {
    if (typeof n !== 'number') throw new TypeError(`range bounds must be numbers, got ${typeof n}`)
    if (!Number.isFinite(n)) throw new RangeError('range bounds and step must be finite')
  }
  if (step === 0) throw new RangeError('range step must not be zero')
  const count = Math.max(0, Math.ceil((stop - start) / step))
  if (count > MAX_LENGTH) throw new RangeError(`range of ${String(count)} numbers is too long`)
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    const value = start + i * step
    if (step > 0 ? !(value < stop) : !(value > stop)) break
    out.push(value)
  }
  return out
}

/**
 * Remove from `array`, in place, every element `predicate` returns truthy for, and return them,
 * as lodash does. The predicate gets `(value, index, array)` for the elements present, with the
 * original indices, before `array` changes; holes are skipped and keep their place next to the
 * elements around them.
 * @param array The array to change.
 * @param predicate Tests one element.
 * @returns A new array of the removed elements, in order.
 * @example
 * ```ts
 * const xs = [1, 2, 3, 4]
 * remove(xs, (n) => n % 2 === 0) // [2, 4]
 * xs // [1, 3]
 * ```
 */
export function remove<T, S extends T>(
  array: T[],
  predicate: (value: T, index: number, array: T[]) => value is S
): S[]
/** {@link remove} with a predicate that is not a type guard. */
export function remove<T>(
  array: T[],
  predicate: (value: T, index: number, array: T[]) => unknown
): T[]
export function remove<T>(
  array: T[],
  predicate: (value: T, index: number, array: T[]) => unknown
): T[] {
  const removed: T[] = []
  const kept: [index: number, value: T][] = []
  walkArray(array, (event) => {
    if (event.kind !== 'value') return
    const value = event.value as T
    if (predicate(value, event.index, array)) removed.push(value)
    else kept.push([event.index - removed.length, value])
  })
  if (removed.length === 0) return []
  const length = array.length - removed.length
  array.length = 0
  for (const [index, value] of kept) array[index] = value
  array.length = length
  return removed
}

function splitWhile<T>(
  array: readonly T[],
  predicate: (value: T, index: number, array: readonly T[]) => unknown,
  take: boolean
): T[] {
  const out: T[] = []
  const length = array.length
  let boundary = length
  let matching = true
  walkArray(array, (event) => {
    if (event.kind !== 'value') return
    const value = event.value as T
    if (matching) {
      if (predicate(value, event.index, array)) {
        if (take) out[event.index] = value
        return
      }
      matching = false
      boundary = event.index
    }
    if (take) return false
    out[event.index - boundary] = value
  })
  out.length = take ? boundary : length - boundary
  return out
}

/**
 * `array` without its leading elements for which `predicate` is truthy. Holes are skipped, as
 * {@link remove} skips them, and keep their place in the result.
 * @param array The array to read.
 * @param predicate Tests one element present; gets `(value, index, array)`.
 * @returns A new array from the first element that fails.
 * @example
 * ```ts
 * dropWhile([1, 2, 3, 1], (n) => n < 3) // [3, 1]
 * ```
 */
export function dropWhile<T>(
  array: readonly T[],
  predicate: (value: T, index: number, array: readonly T[]) => unknown
): T[] {
  return splitWhile(array, predicate, false)
}

/**
 * The leading elements of `array` for which `predicate` is truthy. Holes are skipped, as
 * {@link remove} skips them, and keep their place in the result.
 * @param array The array to read.
 * @param predicate Tests one element present; gets `(value, index, array)`.
 * @returns A new array up to the first element that fails.
 * @example
 * ```ts
 * takeWhile([1, 2, 3, 1], (n) => n < 3) // [1, 2]
 * ```
 */
export function takeWhile<T, S extends T>(
  array: readonly T[],
  predicate: (value: T, index: number, array: readonly T[]) => value is S
): S[]
/** {@link takeWhile} with a predicate that is not a type guard. */
export function takeWhile<T>(
  array: readonly T[],
  predicate: (value: T, index: number, array: readonly T[]) => unknown
): T[]
export function takeWhile<T>(
  array: readonly T[],
  predicate: (value: T, index: number, array: readonly T[]) => unknown
): T[] {
  return splitWhile(array, predicate, true)
}
