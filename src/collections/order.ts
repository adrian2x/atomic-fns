/**
 * The default key order of the key helpers.
 */

import { isNil } from '../is/isNil.ts'

/** The two families of keys the default order compares: numbers with bigints, and strings. */
export type KeyKind = 'number' | 'string'

/**
 * The family of a non-nil key.
 * @throws {RangeError} for `NaN`.
 * @throws {TypeError} for anything but a number, a bigint or a string.
 */
export function keyKind(x: unknown): KeyKind {
  if (typeof x === 'number') {
    if (Number.isNaN(x)) throw new RangeError('NaN has no order; return another key')
    return 'number'
  }
  if (typeof x === 'bigint') return 'number'
  if (typeof x === 'string') return 'string'
  throw new TypeError(`cannot order a ${typeof x} key; return a number, bigint or string`)
}

/**
 * Order two keys in `direction` (`1` ascending, `-1` descending): numbers and bigints by value
 * (`<` is exact across the two), strings by UTF-16 code units as `<` does, and `null` /
 * `undefined` after everything else in either direction.
 * @throws {RangeError} for `NaN`.
 * @throws {TypeError} for any other type, or a number against a string.
 */
export function compareKeys(a: unknown, b: unknown, direction: 1 | -1 = 1): number {
  const aNil = isNil(a)
  const bNil = isNil(b)
  if (aNil || bNil) return aNil === bNil ? 0 : aNil ? 1 : -1
  if (keyKind(a) !== keyKind(b))
    throw new TypeError('cannot order a string key against a number key')
  const ascending = (a as number) < (b as number) ? -1 : (a as number) > (b as number) ? 1 : 0
  return ascending * direction
}
