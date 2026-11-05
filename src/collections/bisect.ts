/**
 * Binary search and sorted insertion (Python bisect semantics).
 */

import { assertNotHugeSparse } from '../internal/arrayKeys.js'
import { compare, type Comparer } from '../operators/index.js'

/** The exclusive end of a search: `hi` clamped to `arr`, or its length when `hi` is nullish. */
function searchEnd(arr: readonly unknown[], hi: number | null | undefined): number {
  if (hi == null) return arr.length
  if (!Number.isInteger(hi) && Math.abs(hi) !== Infinity) {
    throw new TypeError('hi must be an integer')
  }
  return Math.min(hi, arr.length)
}

function search<T>(
  arr: readonly T[],
  x: T,
  lo: number,
  hi: number | null | undefined,
  cmp: Comparer<T>,
  right: boolean
): number {
  if (lo < 0) throw new RangeError('lo must be non-negative')
  if (!Number.isInteger(lo)) throw new TypeError('lo must be an integer')
  let end = searchEnd(arr, hi)
  while (lo < end) {
    const mid = Math.floor((lo + end) / 2)
    const goRight = right ? cmp(x, arr[mid]) >= 0 : cmp(arr[mid], x) < 0
    if (goRight) lo = mid + 1
    else end = mid
  }
  return lo
}

/**
 * Return the leftmost insertion index for `x` in a sorted array.
 * @param arr Sorted array.
 * @param x Value to locate.
 * @param lo Lower bound (inclusive), a non-negative integer.
 * @param hi Upper bound (exclusive), an integer or infinite; clamped to `arr.length`. `null` and
 * `undefined` mean `arr.length`.
 * @param cmp Comparator; default total-order `compare`.
 * @throws {TypeError} when `lo` or `hi` is not an integer.
 * @throws {RangeError} when `lo` is negative.
 */
export function bisectLeft<T>(
  arr: readonly T[],
  x: T,
  lo = 0,
  hi?: number | null,
  cmp: Comparer<T> = compare
): number {
  return search(arr, x, lo, hi, cmp, false)
}

/**
 * Return the rightmost insertion index for `x` in a sorted array (Python `bisect_right`).
 * @param arr Sorted array.
 * @param x Value to locate.
 * @param lo Lower bound (inclusive), a non-negative integer.
 * @param hi Upper bound (exclusive), an integer or infinite; clamped to `arr.length`. `null` and
 * `undefined` mean `arr.length`.
 * @param cmp Comparator; default total-order `compare`.
 * @throws {TypeError} when `lo` or `hi` is not an integer.
 * @throws {RangeError} when `lo` is negative.
 */
export function bisect<T>(
  arr: readonly T[],
  x: T,
  lo = 0,
  hi?: number | null,
  cmp: Comparer<T> = compare
): number {
  return search(arr, x, lo, hi, cmp, true)
}

/**
 * Insert `x` after equal elements in a sorted array; returns `arr`.
 * @param arr Sorted mutable array.
 * @param x Value to insert.
 * @param lo Lower bound.
 * @param hi Upper bound.
 * @param cmp Comparator.
 * @throws {RangeError} when `arr` is a huge sparse array, or as {@link bisect}.
 */
export function insort<T>(
  arr: T[],
  x: T,
  lo = 0,
  hi?: number | null,
  cmp: Comparer<T> = compare
): T[] {
  assertNotHugeSparse(arr)
  arr.splice(bisect(arr, x, lo, hi, cmp), 0, x)
  return arr
}

/**
 * Insert `x` before equal elements in a sorted array; returns `arr`.
 * @param arr Sorted mutable array.
 * @param x Value to insert.
 * @param lo Lower bound.
 * @param hi Upper bound.
 * @param cmp Comparator.
 * @throws {RangeError} when `arr` is a huge sparse array, or as {@link bisectLeft}.
 */
export function insortLeft<T>(
  arr: T[],
  x: T,
  lo = 0,
  hi?: number | null,
  cmp: Comparer<T> = compare
): T[] {
  assertNotHugeSparse(arr)
  arr.splice(bisectLeft(arr, x, lo, hi, cmp), 0, x)
  return arr
}

/**
 * Binary search for `x` in a sorted array.
 * Returns the index when found; otherwise `-(insertionIndex) - 1` where insertion is `bisectLeft`.
 * @param arr Sorted array.
 * @param x Value to find.
 * @param lo Lower bound.
 * @param hi Upper bound.
 * @param cmp Comparator.
 */
export function binarySearch<T>(
  arr: readonly T[],
  x: T,
  lo = 0,
  hi?: number | null,
  cmp: Comparer<T> = compare
): number {
  const end = searchEnd(arr, hi)
  const i = bisectLeft(arr, x, lo, end, cmp)
  return i < end && cmp(arr[i], x) === 0 ? i : -i - 1
}
