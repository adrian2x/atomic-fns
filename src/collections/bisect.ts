/**
 * Binary search and sorted insertion (Python bisect semantics).
 */

import { compare, type Comparer } from '../operators/index.js'

/**
 * Return the leftmost insertion index for `x` in a sorted array.
 * @param arr Sorted array.
 * @param x Value to locate.
 * @param lo Lower bound (inclusive).
 * @param hi Upper bound (exclusive); clamped to `arr.length`.
 * @param cmp Comparator; default total-order `compare`.
 */
export function bisectLeft<T>(
  arr: readonly T[],
  x: T,
  lo = 0,
  hi: number = arr.length,
  cmp: Comparer<T> = compare
): number {
  if (lo < 0) throw new RangeError('lo must be non-negative')
  hi = Math.min(hi, arr.length)
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (cmp(arr[mid], x) < 0) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * Return the rightmost insertion index for `x` in a sorted array (Python `bisect_right`).
 * @param arr Sorted array.
 * @param x Value to locate.
 * @param lo Lower bound (inclusive).
 * @param hi Upper bound (exclusive); clamped to `arr.length`.
 * @param cmp Comparator; default total-order `compare`.
 */
export function bisect<T>(
  arr: readonly T[],
  x: T,
  lo = 0,
  hi: number = arr.length,
  cmp: Comparer<T> = compare
): number {
  if (lo < 0) throw new RangeError('lo must be non-negative')
  hi = Math.min(hi, arr.length)
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (cmp(x, arr[mid]) < 0) hi = mid
    else lo = mid + 1
  }
  return lo
}

/**
 * Insert `x` after equal elements in a sorted array; returns `arr`.
 * @param arr Sorted mutable array.
 * @param x Value to insert.
 * @param lo Lower bound.
 * @param hi Upper bound.
 * @param cmp Comparator.
 */
export function insort<T>(
  arr: T[],
  x: T,
  lo = 0,
  hi: number = arr.length,
  cmp: Comparer<T> = compare
): T[] {
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
 */
export function insortLeft<T>(
  arr: T[],
  x: T,
  lo = 0,
  hi: number = arr.length,
  cmp: Comparer<T> = compare
): T[] {
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
  hi: number = arr.length,
  cmp: Comparer<T> = compare
): number {
  if (lo < 0) throw new RangeError('lo must be non-negative')
  hi = Math.min(hi, arr.length)
  const i = bisectLeft(arr, x, lo, hi, cmp)
  return i < hi && cmp(arr[i], x) === 0 ? i : -i - 1
}
