import { round } from './round.ts'

/** Adds the numbers of `values` from left to right and counts them. */
function total(values: Iterable<number>, name: string): { sum: number; count: number } {
  if (values == null || typeof values[Symbol.iterator] !== 'function') {
    const received = values === null ? 'null' : typeof values
    throw new TypeError(`${name} expects an iterable of numbers, got ${received}`)
  }
  let sum = 0
  let count = 0
  for (const value of values) {
    if (typeof value !== 'number')
      throw new TypeError(`${name} expects numbers, got ${typeof value}`)
    sum += value
    count++
  }
  return { sum, count }
}

/**
 * Adds the numbers of an iterable from left to right, as a loop with `+` does; an empty iterable
 * sums to `0`. For a correctly rounded total, use `Math.sumPrecise` where the runtime has it.
 * @param values The numbers to add.
 * @returns The total.
 * @throws {TypeError} when `values` is not iterable, `null` and `undefined` included (lodash
 * sums those to `0`), or holds a non-number.
 * @example
 * ```ts
 * sum([4, 2, 8, 6]) // 20
 * sum(new Set([1, 2])) // 3
 * ```
 */
export function sum(values: Iterable<number>): number {
  return total(values, 'sum').sum
}

/**
 * Averages the numbers of an iterable; an empty iterable gives `NaN`, as in lodash.
 * @param values The numbers to average.
 * @returns The arithmetic mean.
 * @throws {TypeError} when `values` is not iterable, `null` and `undefined` included (lodash
 * averages those to `NaN`), or holds a non-number.
 * @example
 * ```ts
 * mean([4, 2, 8, 6]) // 5
 * mean([]) // NaN
 * ```
 */
export function mean(values: Iterable<number>): number {
  const { sum, count } = total(values, 'mean')
  return sum / count
}

/** Options for {@link formatBytes}. */
export interface FormatBytesOptions {
  /** A BCP 47 tag or list of tags for the number, as `Intl.NumberFormat` takes. */
  locale?: Intl.LocalesArgument
  /** Use powers of 1024 and IEC units (`KiB`, `MiB`) instead of powers of 1000 (`kB`, `MB`). */
  binary?: boolean
}

const DECIMAL_UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] as const
const BINARY_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'] as const

/** Fraction digits that show three significant digits below 1000 and none above. */
function fractionDigits(size: number): number {
  return size < 10 ? 2 : size < 100 ? 1 : 0
}

/** Rounds a non-negative size to the digits {@link fractionDigits} picks for it. */
function roundSize(size: number): number {
  return round(size, fractionDigits(size))
}

const MAX_CACHED_FORMATS = 64
/** Formats by fraction digits and locale tag, cleared when full since locales may come from requests. */
const formats = new Map<string, Intl.NumberFormat>()

function numberFormat(locale: Intl.LocalesArgument, digits: number): Intl.NumberFormat {
  const options = { maximumFractionDigits: digits }
  // Locale lists and Intl.Locale objects have no cheap exact key, so they are not cached.
  if (locale !== undefined && typeof locale !== 'string')
    return new Intl.NumberFormat(locale, options)
  const key = locale === undefined ? `${digits}` : `${digits} ${locale}`
  let format = formats.get(key)
  if (format === undefined) {
    format = new Intl.NumberFormat(locale, options)
    if (formats.size >= MAX_CACHED_FORMATS) formats.clear()
    formats.set(key, format)
  }
  return format
}

/**
 * Formats a byte count for people: powers of 1000 with SI units by default, or powers of 1024
 * with IEC units when `binary` is set, rounded to about three significant digits. The number is
 * formatted with `Intl.NumberFormat` for `locale`; the unit symbol follows after a space. Bytes
 * past the yottabyte keep the largest unit.
 * @param n The byte count; may be negative or fractional.
 * @param options `locale` and `binary`.
 * @returns The formatted size.
 * @throws {TypeError} when `n` is not a number.
 * @throws {RangeError} when `n` is not finite.
 * @example
 * ```ts
 * formatBytes(1536) // '1.54 kB'
 * formatBytes(1536, { binary: true }) // '1.5 KiB'
 * formatBytes(1234567, { locale: 'de' }) // '1,23 MB'
 * ```
 */
export function formatBytes(n: number, options?: FormatBytesOptions): string {
  if (typeof n !== 'number') throw new TypeError('n must be a number')
  if (!Number.isFinite(n)) throw new RangeError('n must be finite')
  const binary = options?.binary ?? false
  const units = binary ? BINARY_UNITS : DECIMAL_UNITS
  const base = binary ? 1024 : 1000
  const size = Math.abs(n)
  let exponent = 0
  let rounded = roundSize(size)
  while (exponent < 8 && rounded >= base) {
    exponent++
    rounded = roundSize(size / base ** exponent)
  }
  // `|| 0` turns the -0 of a negative size that rounds to zero into 0.
  const value = (n < 0 ? -rounded : rounded) || 0
  const formatted = numberFormat(options?.locale, fractionDigits(rounded)).format(value)
  // Intl's `style: 'unit'` would localize the symbols, but it has no IEC units and stops at petabyte.
  return `${formatted} ${units[exponent]}`
}
