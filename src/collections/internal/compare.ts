/** A comparator `(a, b) => number`: negative when `a` sorts first, 0 for the same key. */
export type Comparator<T> = (a: T, b: T) => number

function describe(x: unknown): string {
  return x === null ? 'null' : typeof x
}

function isNumeric(x: unknown): x is number | bigint {
  return typeof x === 'number' || typeof x === 'bigint'
}

/**
 * The default order: numbers and bigints by value (compared exactly with each other) and strings
 * by UTF-16 code units, as `<` does. `NaN` throws `RangeError`; mixed strings and numbers, `null`,
 * `undefined` and every other value throw `TypeError` asking for a comparator.
 */
export function defaultCompare(a: unknown, b: unknown): number {
  if (isNumeric(a) && isNumeric(b)) {
    if (Number.isNaN(a) || Number.isNaN(b)) {
      throw new RangeError('NaN has no order; pass a comparator')
    }
    return a < b ? -1 : a > b ? 1 : 0
  }
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0
  throw new TypeError(
    `the default comparator orders numbers, bigints and strings; pass a comparator to order ${describe(a)} and ${describe(b)}`
  )
}

/** SameValueZero, as `Map`, `Set` and `includes` use. */
export function sameValueZero(a: unknown, b: unknown): boolean {
  return a === b || (a !== a && b !== b)
}
