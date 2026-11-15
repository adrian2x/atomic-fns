import { type Comparator, defaultCompare } from './internal/compare.ts'
import { assertNotHugeSparse } from './internal/arrayKeys.ts'

/**
 * Check the search bounds and return the exclusive end of the search: `hi` clamped to the length
 * of `array`, or the length when `hi` is omitted. `lo` is checked first, as Python does.
 */
function searchBounds(array: ArrayLike<unknown>, lo: number, hi: number | undefined): number {
  if (!Number.isInteger(lo)) throw new TypeError('lo must be an integer')
  if (lo < 0) throw new RangeError('lo must be non-negative')
  const length = array.length
  if (!Number.isInteger(length)) throw new TypeError('array length must be an integer')
  if (length < 0 || length > Number.MAX_SAFE_INTEGER) {
    throw new RangeError('array length must be a non-negative safe integer')
  }
  if (hi === undefined) return length
  if (!Number.isInteger(hi) && hi !== Infinity && hi !== -Infinity) {
    throw new TypeError('hi must be an integer')
  }
  return Math.min(hi, length)
}

/** Binary search over `[lo, end)`, with bounds already checked by {@link searchBounds}. */
function search<T>(
  array: ArrayLike<T>,
  value: T,
  compareFn: Comparator<T>,
  lo: number,
  end: number,
  right: boolean
): number {
  while (lo < end) {
    const mid = lo + Math.floor((end - lo) / 2)
    const goRight = right ? compareFn(value, array[mid]) >= 0 : compareFn(array[mid], value) < 0
    if (goRight) lo = mid + 1
    else end = mid
  }
  return lo
}

/**
 * The leftmost index at which `value` can be inserted into the sorted `array` and keep it sorted:
 * before any elements equal to it, as Python's `bisect_left`.
 *
 * @param array A sorted array or array-like.
 * @param value The value to locate.
 * @param compareFn Comparator the array is sorted by. Defaults to the primitive order (numbers,
 * bigints and strings).
 * @param lo First index to search, a non-negative integer. Defaults to 0.
 * @param hi End of the search (exclusive): an integer or ±Infinity, clamped to the length.
 * Defaults to the length.
 * @throws {TypeError} when `lo`, `hi` or the length of `array` is not an integer (`hi` may also be
 * ±Infinity).
 * @throws {RangeError} when `lo` is negative or the length of `array` is not a non-negative safe
 * integer.
 * @example
 * ```ts
 * bisectLeft([1, 2, 2, 3], 2) // 1
 * ```
 */
export function bisectLeft<T>(
  array: ArrayLike<T>,
  value: T,
  compareFn: (a: T, b: T) => number = defaultCompare,
  lo = 0,
  hi?: number
): number {
  return search(array, value, compareFn, lo, searchBounds(array, lo, hi), false)
}

/**
 * The rightmost index at which `value` can be inserted into the sorted `array` and keep it sorted:
 * after any elements equal to it, as Python's `bisect_right`. Also exported as `bisect`, Python's
 * short name.
 *
 * @param array A sorted array or array-like.
 * @param value The value to locate.
 * @param compareFn Comparator the array is sorted by. Defaults to the primitive order (numbers,
 * bigints and strings).
 * @param lo First index to search, a non-negative integer. Defaults to 0.
 * @param hi End of the search (exclusive): an integer or ±Infinity, clamped to the length.
 * Defaults to the length.
 * @throws {TypeError} when `lo`, `hi` or the length of `array` is not an integer (`hi` may also be
 * ±Infinity).
 * @throws {RangeError} when `lo` is negative or the length of `array` is not a non-negative safe
 * integer.
 * @example
 * ```ts
 * bisectRight([1, 2, 2, 3], 2) // 3
 * bisect(['a', 'c'], 'b') // 1
 * ```
 */
export function bisectRight<T>(
  array: ArrayLike<T>,
  value: T,
  compareFn: (a: T, b: T) => number = defaultCompare,
  lo = 0,
  hi?: number
): number {
  return search(array, value, compareFn, lo, searchBounds(array, lo, hi), true)
}

export { bisectRight as bisect }

/**
 * Insert `value` into the sorted `array` after any equal elements, keeping it sorted, and return
 * the array.
 *
 * @param array A sorted array; changed in place.
 * @param value The value to insert.
 * @param compareFn Comparator the array is sorted by. Defaults to the primitive order.
 * @param lo First index to search, a non-negative integer. Defaults to 0.
 * @param hi End of the search (exclusive): an integer or ±Infinity, clamped to the length.
 * Defaults to the length.
 * @throws {TypeError} when `lo` or `hi` is not an integer (`hi` may also be ±Infinity).
 * @throws {RangeError} when `lo` is negative or `array` is a huge sparse array.
 * @example
 * ```ts
 * insort([1, 3], 2) // [1, 2, 3]
 * ```
 */
export function insort<T>(
  array: T[],
  value: T,
  compareFn: (a: T, b: T) => number = defaultCompare,
  lo = 0,
  hi?: number
): T[] {
  const end = searchBounds(array, lo, hi)
  assertNotHugeSparse(array)
  array.splice(search(array, value, compareFn, lo, end, true), 0, value)
  return array
}

/**
 * Insert `value` into the sorted `array` before any equal elements, keeping it sorted, and return
 * the array.
 *
 * @param array A sorted array; changed in place.
 * @param value The value to insert.
 * @param compareFn Comparator the array is sorted by. Defaults to the primitive order.
 * @param lo First index to search, a non-negative integer. Defaults to 0.
 * @param hi End of the search (exclusive): an integer or ±Infinity, clamped to the length.
 * Defaults to the length.
 * @throws {TypeError} when `lo` or `hi` is not an integer (`hi` may also be ±Infinity).
 * @throws {RangeError} when `lo` is negative or `array` is a huge sparse array.
 * @example
 * ```ts
 * insortLeft([1, 3], 2) // [1, 2, 3]
 * ```
 */
export function insortLeft<T>(
  array: T[],
  value: T,
  compareFn: (a: T, b: T) => number = defaultCompare,
  lo = 0,
  hi?: number
): T[] {
  const end = searchBounds(array, lo, hi)
  assertNotHugeSparse(array)
  array.splice(search(array, value, compareFn, lo, end, false), 0, value)
  return array
}

/**
 * The index of `value` in the sorted `array`, or `-(insertion index) - 1` when it is absent, so a
 * negative result `r` means `value` belongs at `-r - 1`.
 *
 * @param array A sorted array or array-like.
 * @param value The value to find.
 * @param compareFn Comparator the array is sorted by; 0 means found. Defaults to the primitive
 * order.
 * @param lo First index to search, a non-negative integer. Defaults to 0.
 * @param hi End of the search (exclusive): an integer or ±Infinity, clamped to the length.
 * Defaults to the length.
 * @throws {TypeError} when `lo`, `hi` or the length of `array` is not an integer (`hi` may also be
 * ±Infinity).
 * @throws {RangeError} when `lo` is negative or the length of `array` is not a non-negative safe
 * integer.
 * @example
 * ```ts
 * binarySearch([1, 3, 5], 3) // 1
 * binarySearch([1, 3, 5], 4) // -3
 * ```
 */
export function binarySearch<T>(
  array: ArrayLike<T>,
  value: T,
  compareFn: (a: T, b: T) => number = defaultCompare,
  lo = 0,
  hi?: number
): number {
  const end = searchBounds(array, lo, hi)
  const i = search(array, value, compareFn, lo, end, false)
  return i < end && compareFn(array[i], value) === 0 ? i : -i - 1
}
