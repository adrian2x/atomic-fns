/**
 * True for a value with a `length` that is a non-negative safe integer, as lodash's `isArrayLike`
 * decides and the generic `Array.prototype` methods (`Array.prototype.slice.call`) read by index:
 * arrays, strings, typed arrays, `arguments` and objects like `{ length: 2 }`. Functions are not
 * array-like, though they have a `length`.
 * The guard is one-sided: `false` does not rule out a `{ length: number }` type.
 * @param value Any value.
 * @returns Whether `value` is array-like.
 * @example
 * ```ts
 * isArrayLike([1, 2]) // true
 * isArrayLike('abc') // true
 * isArrayLike({ length: 1, 0: 'a' }) // true
 * isArrayLike({ length: -1 }) // false
 * isArrayLike(() => {}) // false
 * ```
 */
export function isArrayLike(value: unknown): value is ArrayLike<unknown> {
  if (typeof value === 'string') return true
  if (value === null || typeof value !== 'object' || !('length' in value)) return false
  const { length } = value
  return typeof length === 'number' && Number.isSafeInteger(length) && length >= 0
}
