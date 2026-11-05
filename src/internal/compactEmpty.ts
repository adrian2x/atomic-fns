/**
 * Shared emptiness predicate for `compact` / `icompact` (SPEC-R40).
 * Removes exactly the falsy and empty values listed there; keeps everything else
 * (functions, class instances, Decimal, IntlDate, non-empty collections, boxed primitives).
 */

function isPlainObject(x: object): boolean {
  const proto: unknown = Object.getPrototypeOf(x)
  return proto === Object.prototype || proto === null
}

/** True when `compact` / `icompact` should drop `x`. Does not change `isEmpty`. */
export function isCompactEmpty(x: unknown): boolean {
  if (x == null || x === false || x === '' || Number.isNaN(x)) return true
  if (x === 0 || Object.is(x, -0) || x === 0n) return true
  if (typeof x === 'string' || Array.isArray(x)) return x.length === 0
  if (x instanceof Map || x instanceof Set) return x.size === 0
  if (typeof x === 'object' && isPlainObject(x)) return Object.keys(x).length === 0
  return false
}
