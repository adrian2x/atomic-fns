type Mode = 'halfCeil' | 'floor' | 'ceil'

function assertNumber(n: unknown, name: string): asserts n is number {
  if (typeof n !== 'number') throw new TypeError(`${name} must be a number`)
}

/** The shortest round-trip decimal of `|n|` as integer digits and a base-10 exponent. */
function decimalParts(n: number): { digits: string; exponent: number } {
  const [coefficient, exp = '0'] = String(Math.abs(n)).split('e')
  const [whole, fraction = ''] = coefficient.split('.')
  const digits = (whole + fraction).replace(/^0+(?=\d)/, '')
  return { digits, exponent: Number(exp) - fraction.length }
}

function roundTo(n: number, digits: number, mode: Mode): number {
  assertNumber(n, 'n')
  assertNumber(digits, 'digits')
  if (!Number.isSafeInteger(digits)) throw new RangeError('digits must be an integer')
  if (!Number.isFinite(n) || n === 0) return n === 0 ? 0 : n
  const parts = decimalParts(n)
  const drop = -digits - parts.exponent
  if (drop <= 0) return n
  const negative = n < 0
  const { length } = parts.digits
  // Past the leading digit the dropped part is below half a unit, and it is never zero.
  const head = length > drop ? parts.digits.slice(0, length - drop) : '0'
  const tail = length >= drop ? parts.digits.slice(length - drop) : ''
  const exact = drop <= length && /^0*$/.test(tail)
  let up: boolean
  if (mode === 'floor') up = negative && !exact
  else if (mode === 'ceil') up = !negative && !exact
  else {
    const half = '5'.padEnd(tail.length, '0')
    up = tail > half || (tail === half && !negative)
  }
  const magnitude = BigInt(head) + (up ? 1n : 0n)
  const result = Number(`${negative ? '-' : ''}${magnitude}e${-digits}`)
  return result === 0 ? 0 : result
}

/**
 * Rounds `n` to `digits` places after the decimal point, ties toward `+Infinity` as `Math.round`
 * does. It rounds the decimal that `String(n)` prints, not the binary value, so `round(1.005, 2)`
 * is `1.01` where `(1.005).toFixed(2)` is `'1.00'`. Negative `digits` round to tens, hundreds and
 * so on. Infinities and NaN come back unchanged. A result too large for a number, such as
 * `round(Number.MAX_VALUE, -308)`, is `Infinity`. `-0` becomes `0`, unlike `Math.round`, so a
 * value that rounds to zero, such as `round(-0.004, 2)`, does not print as `-0` through
 * `Intl.NumberFormat`.
 * @param n The number to round.
 * @param digits Places after the decimal point (default 0); may be negative.
 * @returns The rounded number.
 * @throws {TypeError} when `n` or `digits` is not a number.
 * @throws {RangeError} when `digits` is not an integer.
 * @example
 * ```ts
 * round(4.006, 2) // 4.01
 * round(4060, -2) // 4100
 * round(-2.5) // -2
 * ```
 */
export function round(n: number, digits = 0): number {
  return roundTo(n, digits, 'halfCeil')
}

/**
 * Rounds `n` down, toward `-Infinity`, to `digits` places after the decimal point, on the decimal
 * that `String(n)` prints, as {@link round} does.
 * @param n The number to round down.
 * @param digits Places after the decimal point (default 0); may be negative.
 * @returns The rounded number.
 * @throws {TypeError} when `n` or `digits` is not a number.
 * @throws {RangeError} when `digits` is not an integer.
 * @example
 * ```ts
 * floor(4.006, 2) // 4
 * floor(0.29, 2) // 0.29
 * floor(4060, -2) // 4000
 * ```
 */
export function floor(n: number, digits = 0): number {
  return roundTo(n, digits, 'floor')
}

/**
 * Rounds `n` up, toward `+Infinity`, to `digits` places after the decimal point, on the decimal
 * that `String(n)` prints, as {@link round} does.
 * @param n The number to round up.
 * @param digits Places after the decimal point (default 0); may be negative.
 * @returns The rounded number.
 * @throws {TypeError} when `n` or `digits` is not a number.
 * @throws {RangeError} when `digits` is not an integer.
 * @example
 * ```ts
 * ceil(4.006, 2) // 4.01
 * ceil(6040, -2) // 6100
 * ```
 */
export function ceil(n: number, digits = 0): number {
  return roundTo(n, digits, 'ceil')
}

/**
 * Limits `n` to the range from `min` to `max`, both included. NaN stays NaN.
 * @param n The number to clamp.
 * @param min The lower bound.
 * @param max The upper bound.
 * @returns `n`, `min` or `max`.
 * @throws {TypeError} when an argument is not a number.
 * @throws {RangeError} when a bound is NaN or `min > max`.
 * @example
 * ```ts
 * clamp(-10, -5, 5) // -5
 * clamp(10, -5, 5) // 5
 * ```
 */
export function clamp(n: number, min: number, max: number): number {
  assertNumber(n, 'n')
  assertNumber(min, 'min')
  assertNumber(max, 'max')
  if (!(min <= max)) throw new RangeError('min and max must not be NaN, and min must be <= max')
  return Math.min(Math.max(n, min), max)
}

/**
 * Checks whether `n` is at least `start` and below `end`. With two arguments the range is
 * `[0, end)`, and reversed bounds swap, as in lodash. A NaN `n` is never in range.
 * @param n The number to check.
 * @param start The lower bound (included).
 * @param end The upper bound (excluded).
 * @returns Whether `n` is in the range.
 * @throws {TypeError} when an argument is not a number.
 * @throws {RangeError} when a bound is NaN.
 * @example
 * ```ts
 * inRange(3, 2, 4) // true
 * inRange(4, 8) // true
 * inRange(-3, -2, -6) // true
 * ```
 */
export function inRange(n: number, start: number, end: number): boolean
/** {@link inRange} from `0` to `end`. */
export function inRange(n: number, end: number): boolean
export function inRange(n: number, first: number, last?: number): boolean {
  assertNumber(n, 'n')
  const [start, end] = last === undefined ? [0, first] : [first, last]
  assertNumber(start, 'start')
  assertNumber(end, 'end')
  if (Number.isNaN(start) || Number.isNaN(end))
    throw new RangeError('start and end must not be NaN')
  return n >= Math.min(start, end) && n < Math.max(start, end)
}
