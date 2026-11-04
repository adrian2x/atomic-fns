/**
 * `Decimal` provides support for correct rounded floating point arithmetic.
 *
 * @module decimal
 */

import { ValueError, ZeroDivisionError } from '../globals/errors.js'
import { assertSameCurrency, compareValueThenUnit, NUMERIC_COMPARE } from '../internal/rank1.js'
import { truncateForError } from '../internal/truncate.js'
import { protocol, unitOf, type Rank } from '../operators/protocol.js'
import { bitLength, isqrtRoot } from './isqrt.js'
import { pow10, pow10Squares } from './pow10.js'

/** Cross-realm Decimal brand (`Symbol.for` so every copy of the library shares it). */
export const DECIMAL_BRAND: unique symbol = Symbol.for('atomic-fns.decimal')

/** True when `v` carries the Decimal brand method from this or another copy of the library. */
export function isDecimalBrand(v: unknown): boolean {
  return (
    (typeof v === 'object' || typeof v === 'function') &&
    v !== null &&
    typeof (v as Record<symbol, unknown>)[DECIMAL_BRAND] === 'function'
  )
}

/** Canonical plain decimal string from a branded foreign Decimal (not `toString()`). */
function decimalBrandString(v: unknown): string {
  if ((typeof v !== 'object' && typeof v !== 'function') || v === null) {
    throw new TypeError('Decimal brand method missing')
  }
  const fn = (v as Record<symbol, unknown>)[DECIMAL_BRAND]
  if (typeof fn !== 'function') {
    throw new TypeError('Decimal brand method missing')
  }
  return String((fn as (this: object) => unknown).call(v))
}

/**
 * Rounding mode for {@link Decimal.div}, {@link Decimal.round} and {@link Decimal.sqrt}.
 * - `halfEven`: nearest, ties to the even neighbour (the default).
 * - `halfUp`: nearest, ties away from zero. Note `Math.round` ties toward +Infinity instead.
 * - `halfDown`: nearest, ties toward zero.
 * - `up`: away from zero.
 * - `down`: toward zero.
 * - `ceil`: toward +Infinity.
 * - `floor`: toward -Infinity.
 */
export type RoundingMode = 'halfEven' | 'halfUp' | 'halfDown' | 'down' | 'up' | 'floor' | 'ceil'

const ROUNDING_MODES: readonly RoundingMode[] = [
  'halfEven',
  'halfUp',
  'halfDown',
  'down',
  'up',
  'floor',
  'ceil'
]

/** Options for division and square-root precision. */
export interface DivOptions {
  precision?: number
  rounding?: RoundingMode
}

/** Values accepted by the {@link Decimal} constructor and arithmetic methods. */
export type DecimalInput = Decimal | number | bigint | string

/** Unambiguous decimal grammar (SPEC-R65 language; no overlapping optional digit runs). */
const PARSE_LEADING_DIGITS = /^\s*([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?\s*$/i
const PARSE_LEADING_DOT = /^\s*([+-]?)\.(\d+)(?:e([+-]?\d+))?\s*$/i

/**
 * Casts the given value as a {@link Decimal}.
 * Foreign Decimals (other library copies) convert via their brand method's canonical string.
 * @param x Value to convert.
 */
export function decimal(x: DecimalInput): Decimal {
  return x instanceof Decimal ? x : new Decimal(x)
}

/**
 * Strip trailing decimal zeros via `% 10^k` bulk divides (no coefficient toString).
 */
function normalizeIE(i: bigint, e: number): { i: bigint; e: number } {
  if (i === 0n) return { i: 0n, e: 0 }
  if (i % 10n !== 0n) return { i, e }
  let x = i
  let zeros = 0
  // powers: 10^(2^k) for k = 0..13 (10^8192); enough for MAX_DIGITS trailing zeros
  const powers = pow10Squares()
  for (let k = powers.length - 1; k >= 0; k--) {
    const pk = powers[k]
    const step = 1 << k
    while (x % pk === 0n) {
      x /= pk
      zeros += step
    }
  }
  return { i: x, e: e + zeros }
}

function absBig(n: bigint): bigint {
  return n < 0n ? -n : n
}

/** Exact binary value of a finite number as decimal `(i, e)`. */
function toExact(n: number): { i: bigint; e: number } {
  const dv = new DataView(new ArrayBuffer(8))
  dv.setFloat64(0, n)
  const bits = dv.getBigUint64(0)
  const exp = Number((bits >> 52n) & 0x7ffn)
  const frac = bits & ((1n << 52n) - 1n)
  const m = exp === 0 ? frac : frac | (1n << 52n)
  const k = (exp === 0 ? 1 : exp) - 1075
  const sign = bits >> 63n ? -1n : 1n
  if (k >= 0) {
    return normalizeIE(sign * m * 2n ** BigInt(k), 0)
  }
  return normalizeIE(sign * m * 5n ** BigInt(-k), k)
}

/**
 * Digit count of a non-zero absolute bigint via bit length + one compare against a cached
 * power of ten (no decimal toString on the arithmetic path). Saturates past
 * {@link MAX_VALUE_DIGITS}, where the value is already longer than every Decimal.
 */
function digitLengthAbs(a: bigint): number {
  if (a < 10n) return 1
  // digits ≈ floor(bits * log10(2)) + 1; adjust with one table compare
  const estimate = Math.floor(bitLength(a) * Math.LOG10E * Math.LN2) + 1
  const digits = Math.min(estimate, MAX_VALUE_DIGITS + 2)
  const bound = pow10(digits - 1)
  if (a >= bound * 10n) return digits + 1
  if (a < bound) return digits - 1
  return digits
}

/**
 * Compare `ai * 10^ae` vs `bi * 10^be`.
 * Sign first, then order of magnitude (`e + digits - 1`); scale only when magnitudes match
 * (exponent gap then equals the digit-count difference).
 * Optional `aDigits` / `bDigits` skip bigint toString when the caller already knows them.
 */
function compareIE(
  ai: bigint,
  ae: number,
  bi: bigint,
  be: number,
  aDigits?: number,
  bDigits?: number
): -1 | 0 | 1 {
  if (ai === 0n && bi === 0n) return 0
  if (ai === 0n) return bi < 0n ? 1 : -1
  if (bi === 0n) return ai < 0n ? -1 : 1
  if (ai < 0n !== bi < 0n) return ai < 0n ? -1 : 1

  const sign = ai < 0n ? -1 : 1
  const aAbs = ai < 0n ? -ai : ai
  const bAbs = bi < 0n ? -bi : bi
  const aMag = ae + (aDigits ?? digitLengthAbs(aAbs)) - 1
  const bMag = be + (bDigits ?? digitLengthAbs(bAbs)) - 1
  if (aMag !== bMag) {
    if (aMag < bMag) return sign < 0 ? 1 : -1
    return sign < 0 ? -1 : 1
  }

  let cmp: -1 | 0 | 1
  if (ae === be) {
    cmp = aAbs < bAbs ? -1 : aAbs > bAbs ? 1 : 0
  } else if (ae > be) {
    const scaled = aAbs * pow10(ae - be)
    cmp = scaled < bAbs ? -1 : scaled > bAbs ? 1 : 0
  } else {
    const scaled = bAbs * pow10(be - ae)
    cmp = aAbs < scaled ? -1 : aAbs > scaled ? 1 : 0
  }
  if (cmp === 0) return 0
  return sign < 0 ? (cmp < 0 ? 1 : -1) : cmp
}

/** `n / d` rounded to an integer. */
function roundQuotient(n: bigint, d: bigint, mode: RoundingMode): bigint {
  const q = n / d
  const r = n % d
  if (r === 0n) return q
  const s = r < 0n !== d < 0n ? -1n : 1n
  const twice = 2n * absBig(r)
  const ad = absBig(d)
  const cmpHalf = twice < ad ? -1 : twice > ad ? 1 : 0
  let up = false
  switch (mode) {
    case 'halfEven':
      up = cmpHalf > 0 || (cmpHalf === 0 && q % 2n !== 0n)
      break
    case 'halfUp':
      up = cmpHalf >= 0
      break
    case 'halfDown':
      up = cmpHalf > 0
      break
    case 'up':
      up = true
      break
    case 'down':
      up = false
      break
    case 'ceil':
      up = s > 0n
      break
    case 'floor':
      up = s < 0n
      break
  }
  return up ? q + s : q
}

function toDecimalInput(o: unknown): DecimalInput {
  if (
    isDecimalBrand(o) ||
    typeof o === 'number' ||
    typeof o === 'bigint' ||
    typeof o === 'string'
  ) {
    return o as DecimalInput
  }
  throw new ValueError('Decimal value must be a number, bigint, string, or Decimal')
}

const DEFAULT_PRECISION = 20
const MAX_EXPONENT = 10_000
const MAX_PRECISION = 10_000
const MAX_DIGITS = 10_000
const MAX_INPUT_LENGTH = 2 * MAX_EXPONENT + MAX_DIGITS + 32

/** No Decimal reaches `10^MAX_VALUE_DIGITS`. */
const MAX_VALUE_DIGITS = MAX_DIGITS + MAX_EXPONENT

/** Zeros {@link Decimal.toString} pads a coefficient with before it turns scientific. */
const MAX_PLAIN_PADDING = 64

/**
 * Exact decimal arithmetic with per-operation precision and rounding.
 * Near {@link Decimal.MAX_DIGITS}, each arithmetic operation costs on the order of 0.2 ms, so
 * a running total over many attacker-chosen items grows linearly with the item count - size-limit
 * untrusted lists before reducing them.
 */
export class Decimal {
  /** Default fractional digit count for {@link Decimal.div} and {@link Decimal.sqrt}. */
  static get defaultPrecision(): 20 {
    return DEFAULT_PRECISION
  }

  /** Maximum absolute stored exponent; larger values throw {@link ValueError}. */
  static get MAX_EXPONENT(): 10000 {
    return MAX_EXPONENT
  }

  /** Maximum fractional precision for {@link Decimal.div}, {@link Decimal.sqrt}, and {@link Decimal.round}. */
  static get MAX_PRECISION(): 10000 {
    return MAX_PRECISION
  }

  /**
   * Maximum normalized coefficient decimal digit count (significant digits after stripping leading
   * and trailing zeros). Results of every arithmetic operation are bounded by this; larger results
   * throw `RangeError`. Division and square root round first, so only the rounded result counts.
   * Intermediate work stays within a few multiples of this, because exponents are bounded too.
   */
  static get MAX_DIGITS(): 10000 {
    return MAX_DIGITS
  }

  /**
   * Maximum raw decimal string length accepted by the parser. Sized for any value within
   * {@link Decimal.MAX_DIGITS} significant digits and {@link Decimal.MAX_EXPONENT} written in
   * plain notation (`2 * MAX_EXPONENT + MAX_DIGITS + 32`). Longer inputs throw {@link ValueError}
   * before scanning so parsing stays linear in the allowed length.
   */
  static get MAX_INPUT_LENGTH(): number {
    return MAX_INPUT_LENGTH
  }

  #i = 0n
  #e = 0
  /** Lazy cache of absolute coefficient decimal digit count (Decimals are immutable). */
  #digits: number | undefined

  static #assertDigitsBound(bound: number): void {
    if (bound > MAX_DIGITS) {
      throw new RangeError('result exceeds 10000 digits')
    }
  }

  static #assertDivPrecision(precision: number): void {
    if (!Number.isInteger(precision) || precision < 0 || precision > MAX_PRECISION) {
      throw new RangeError('precision must be an integer from 0 to 10000')
    }
  }

  static #assertRoundPrecision(precision: number): void {
    if (!Number.isInteger(precision) || precision < -MAX_EXPONENT || precision > MAX_PRECISION) {
      throw new RangeError(
        `precision must be an integer from ${String(-MAX_EXPONENT)} to ${String(MAX_PRECISION)}`
      )
    }
  }

  static #assertRounding(rounding: RoundingMode): void {
    if (!ROUNDING_MODES.includes(rounding)) {
      throw new RangeError(`rounding must be one of ${ROUNDING_MODES.join(', ')}`)
    }
  }

  /** Keeps a bigint too long for any Decimal away from the quadratic {@link normalizeIE}. */
  static #assertBigintSpan(value: bigint): void {
    if (digitLengthAbs(absBig(value)) <= MAX_VALUE_DIGITS) return
    if (value % pow10(MAX_EXPONENT + 1) === 0n) throw new ValueError('exponent out of range')
    throw new RangeError('result exceeds 10000 digits')
  }

  /** Digit count of a non-zero bigint; 0 for 0n. */
  static #digitLength(n: bigint): number {
    const a = n < 0n ? -n : n
    if (a === 0n) return 0
    return digitLengthAbs(a)
  }

  /** Cached absolute coefficient digit count (0 for zero). */
  #digitCount(): number {
    if (this.#digits === undefined) {
      this.#digits = Decimal.#digitLength(this.#i)
    }
    return this.#digits
  }

  /**
   * Creates a Decimal from a number, bigint, string, or another Decimal (a foreign library copy's
   * too). A number enters through its shortest round-trip string, while comparisons with numbers
   * use its exact binary value, so `decimal(0.1).eq(0.1)` is false.
   * @param value Finite number, bigint, decimal string, or Decimal.
   */
  constructor(value: DecimalInput) {
    const parsed = Decimal.#parse(value)
    const digs = Decimal.#digitLength(parsed.i)
    Decimal.#assertDigitsBound(digs)
    this.#i = parsed.i
    this.#e = parsed.e
    this.#digits = digs
  }

  static #parse(value: DecimalInput): { i: bigint; e: number } {
    if (value instanceof Decimal) {
      return { i: value.#i, e: value.#e }
    }
    if (typeof value === 'bigint') {
      Decimal.#assertBigintSpan(value)
      return Decimal.#checked(normalizeIE(value, 0))
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new ValueError('Decimal value must be a finite number')
      }
      return Decimal.#parseString(String(value))
    }
    if (typeof value === 'string') {
      return Decimal.#parseString(value)
    }
    if (isDecimalBrand(value)) {
      return Decimal.#parseString(decimalBrandString(value))
    }
    throw new ValueError('Decimal value must be a number, bigint, string, or Decimal')
  }

  /**
   * Significant digit count of a plain digit run (int + frac), skipping leading and trailing
   * zeros. Used to refuse oversized coefficients before constructing a BigInt.
   */
  static #significantDigitCount(intDigits: string, frac: string): number {
    const digits = intDigits + frac
    let start = 0
    while (start < digits.length && digits.charCodeAt(start) === 48) start++
    let end = digits.length
    while (end > start && digits.charCodeAt(end - 1) === 48) end--
    return end - start
  }

  static #parseString(value: string): { i: bigint; e: number } {
    if (value.length > MAX_INPUT_LENGTH) {
      throw new ValueError('Decimal input too long')
    }
    const leading: (string | undefined)[] | null = PARSE_LEADING_DIGITS.exec(value)
    if (leading) {
      return Decimal.#parseParts(leading[1], leading[2] ?? '0', leading[3] ?? '', leading[4])
    }
    const dotted: (string | undefined)[] | null = PARSE_LEADING_DOT.exec(value)
    if (dotted) {
      return Decimal.#parseParts(dotted[1], '0', dotted[2] ?? '', dotted[3])
    }
    throw new ValueError(`invalid Decimal string: ${truncateForError(value)}`)
  }

  static #parseParts(
    sign: string | undefined,
    intDigits: string,
    frac: string,
    exponent: string | undefined
  ): { i: bigint; e: number } {
    Decimal.#assertDigitsBound(Decimal.#significantDigitCount(intDigits, frac))
    const i = BigInt((sign === '-' ? '-' : '') + intDigits + frac)
    return Decimal.#checked(normalizeIE(i, Number(exponent ?? 0) - frac.length))
  }

  static #checked(ie: { i: bigint; e: number }): { i: bigint; e: number } {
    if (Math.abs(ie.e) > MAX_EXPONENT) {
      throw new ValueError('exponent out of range')
    }
    return ie
  }

  static #fromIE(i: bigint, e: number): Decimal {
    const n = normalizeIE(i, e)
    const digs = Decimal.#digitLength(n.i)
    Decimal.#assertDigitsBound(digs)
    Decimal.#checked(n)
    const d = new Decimal(0)
    d.#i = n.i
    d.#e = n.e
    d.#digits = digs
    return d
  }

  /** Rounds `(n / d) * 10^e` to `precision` fractional digits. */
  static #scaleRound(
    n: bigint,
    d: bigint,
    e: number,
    precision: number,
    mode: RoundingMode
  ): Decimal {
    const k = e + precision
    const q = k >= 0 ? roundQuotient(n * pow10(k), d, mode) : roundQuotient(n, d * pow10(-k), mode)
    return Decimal.#fromIE(q, -precision)
  }

  /**
   * Returns a new Decimal with the opposite sign.
   * @example
   * decimal('5').negated().toString() // '-5'
   */
  negated(): Decimal {
    return Decimal.#fromIE(-this.#i, this.#e)
  }

  /**
   * Absolute value.
   */
  abs(): Decimal {
    return this.#i < 0n ? this.negated() : Decimal.#fromIE(this.#i, this.#e)
  }

  /**
   * Exact sum of this and `x`. The result must fit {@link Decimal.MAX_DIGITS} significant digits.
   * Near the digit cap each add is on the order of 0.2 ms; size-limit untrusted running totals.
   * @param x Addend.
   * @example
   * decimal('0.1').add('0.2').toString() // '0.3'
   */
  add(x: DecimalInput): Decimal {
    const b = decimal(x)
    if (this.#i === 0n) return Decimal.#fromIE(b.#i, b.#e)
    if (b.#i === 0n) return Decimal.#fromIE(this.#i, this.#e)
    const e = Math.min(this.#e, b.#e)
    const ai = this.#i * pow10(this.#e - e)
    const bi = b.#i * pow10(b.#e - e)
    return Decimal.#fromIE(ai + bi, e)
  }

  /**
   * Exact difference of this and `x`.
   * @param x Subtrahend.
   */
  sub(x: DecimalInput): Decimal {
    return this.add(decimal(x).negated())
  }

  /**
   * Exact product of this and `x`. The result must fit {@link Decimal.MAX_DIGITS} significant
   * digits.
   * @param x Multiplier.
   */
  mul(x: DecimalInput): Decimal {
    const b = decimal(x)
    return Decimal.#fromIE(this.#i * b.#i, this.#e + b.#e)
  }

  /**
   * Quotient rounded to `precision` fractional digits (default 20), exact or not:
   * `decimal('1e-30').div(1)` is 0 unless `precision` reaches 30. Bounds apply to the rounded
   * result.
   * @param x Divisor.
   * @param opts Precision and rounding mode.
   * @throws {RangeError} for a `precision` out of range or an unknown rounding mode.
   */
  div(x: DecimalInput, opts?: DivOptions): Decimal {
    const precision = opts?.precision ?? DEFAULT_PRECISION
    const rounding = opts?.rounding ?? 'halfEven'
    Decimal.#assertDivPrecision(precision)
    Decimal.#assertRounding(rounding)
    const b = decimal(x)
    if (b.#i === 0n) {
      throw new ZeroDivisionError('division by zero')
    }
    return Decimal.#scaleRound(this.#i, b.#i, this.#e - b.#e, precision, rounding)
  }

  /**
   * Rounds to `precision` fractional digits (negative precision rounds to tens, hundreds, ...).
   * `precision` must be an integer in `[-MAX_EXPONENT, MAX_PRECISION]`. The digit bound applies to
   * the rounded result.
   * @param precision Fractional digits (may be negative).
   * @param rounding Rounding mode (default halfEven).
   * @throws {RangeError} for a `precision` out of range or an unknown rounding mode.
   */
  round(precision: number, rounding: RoundingMode = 'halfEven'): Decimal {
    Decimal.#assertRoundPrecision(precision)
    Decimal.#assertRounding(rounding)
    if (-this.#e <= precision) {
      return Decimal.#fromIE(this.#i, this.#e)
    }
    return Decimal.#scaleRound(this.#i, 1n, this.#e, precision, rounding)
  }

  /**
   * Square root rounded to `precision` fractional digits (default 20), exact or not:
   * `decimal('1e-50').sqrt()` is 0 unless `precision` reaches 25. Bounds apply to the rounded
   * result.
   * @param opts Precision and rounding mode.
   * @throws {RangeError} for a `precision` out of range or an unknown rounding mode.
   */
  sqrt(opts?: DivOptions): Decimal {
    const precision = opts?.precision ?? DEFAULT_PRECISION
    const rounding = opts?.rounding ?? 'halfEven'
    Decimal.#assertDivPrecision(precision)
    Decimal.#assertRounding(rounding)
    if (this.#i < 0n) {
      throw new ValueError('square root of a negative number')
    }
    if (this.#i === 0n) {
      return decimal(0)
    }
    // Factor exponent: i * 10^e = coeff * 10^(2*half) with coeff = i or i*10.
    const odd = this.#e % 2 !== 0
    const coeff = odd ? this.#i * 10n : this.#i
    const halfExp = (odd ? this.#e - 1 : this.#e) / 2
    // Rounding boundaries fall on whole root units, so a sticky digit stands in for the rest.
    const scale = Math.max(0, halfExp + precision + 1)
    const { root, exact } = isqrtRoot(coeff * pow10(2 * scale))
    const sticky = root * 10n + (exact ? 0n : 1n)
    return Decimal.#scaleRound(sticky, 1n, halfExp - scale - 1, precision, rounding)
  }

  /**
   * Returns a copy of this Decimal.
   */
  clone(): Decimal {
    return Decimal.#fromIE(this.#i, this.#e)
  }

  /**
   * Canonical decimal string: plain notation while that pads at most 64 zeros, scientific form
   * (`1e+65`, `1.5e-70`) past that, so its length follows the significant digits and not the
   * exponent. {@link decimal} parses both forms; {@link Decimal.toPlainString} always expands.
   */
  toString(): string {
    const padding = this.#e > 0 ? this.#e : -this.#e - this.#digitCount()
    if (padding <= MAX_PLAIN_PADDING) return this.toPlainString()
    const digits = absBig(this.#i).toString()
    const fraction = digits.length > 1 ? `.${digits.slice(1)}` : ''
    const exponent = this.#e + digits.length - 1
    const sign = this.#i < 0n ? '-' : ''
    return `${sign}${digits.slice(0, 1)}${fraction}e${exponent < 0 ? '' : '+'}${String(exponent)}`
  }

  /**
   * Plain notation at any magnitude: up to `MAX_DIGITS + MAX_EXPONENT` characters, so a few bytes
   * of untrusted input can expand 1000 times over. Prefer `toString`.
   */
  toPlainString(): string {
    const digits = absBig(this.#i).toString()
    const sign = this.#i < 0n ? '-' : ''
    if (this.#e >= 0) {
      return sign + digits + '0'.repeat(this.#e)
    }
    if (-this.#e >= digits.length) {
      return sign + '0.' + '0'.repeat(-this.#e - digits.length) + digits
    }
    return sign + digits.slice(0, this.#e) + '.' + digits.slice(this.#e)
  }

  /**
   * Number nearest to this Decimal, read from the coefficient and exponent, so extreme exponents
   * stay cheap.
   */
  toNumber(): number {
    return Number(`${String(this.#i)}e${String(this.#e)}`)
  }

  /**
   * JSON serialization uses the canonical decimal string.
   */
  toJSON(): string {
    return this.toString()
  }

  /**
   * Implicit numeric conversion is not allowed.
   */
  valueOf(): never {
    throw new TypeError('Decimal cannot be converted implicitly; use toNumber()')
  }

  /**
   * String hint returns the canonical form; number/default throw.
   * @param hint Type coercion hint.
   */
  [Symbol.toPrimitive](hint: string): string {
    if (hint === 'string') return this.toString()
    throw new TypeError('Decimal cannot be converted implicitly; use toNumber()')
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this.toString()
  }

  /**
   * Numeric compare with a Decimal, bigint, or number (exact binary for numbers).
   * Equal values of any rank-1 kind return `0` (no unit/kind tie-break). The `compare`
   * operator keeps those tie-breaks for sorted containers.
   * @param x Other value.
   * @throws {TypeError} for `NaN`.
   * @throws {ValueError} for anything else that is not a number, bigint, Decimal, or parsable string.
   */
  compare(x: DecimalInput): -1 | 0 | 1 {
    if (typeof x === 'number') {
      if (Number.isNaN(x)) throw new TypeError('cannot compare Decimal with NaN')
    }
    const r = this.numericCompare(x)
    if (r === undefined) {
      const o = decimal(x)
      return compareIE(this.#i, this.#e, o.#i, o.#e, this.#digitCount(), o.#digitCount())
    }
    return r < 0 ? -1 : r > 0 ? 1 : 0
  }

  /**
   * Semantic equality. Identical to {@link Decimal.protocolEquals} for everything but strings,
   * which compare numerically with no unit check. Anything unparsable is `false`, while the
   * ordering methods throw on it, as {@link Decimal.compare} does.
   * @param x Other value.
   */
  eq(x: unknown): boolean {
    if (typeof x !== 'string') return this.protocolEquals(x)
    try {
      return this.numericCompare(decimal(x)) === 0
    } catch {
      return false
    }
  }

  /**
   * True when this is strictly less than `x`.
   * @param x Other value.
   * @throws Whatever {@link Decimal.compare} throws.
   */
  lt(x: DecimalInput): boolean {
    return this.compare(x) < 0
  }

  /**
   * True when this is less than or equal to `x`.
   * @param x Other value.
   * @throws Whatever {@link Decimal.compare} throws.
   */
  lte(x: DecimalInput): boolean {
    return this.compare(x) <= 0
  }

  /**
   * True when this is strictly greater than `x`.
   * @param x Other value.
   * @throws Whatever {@link Decimal.compare} throws.
   */
  gt(x: DecimalInput): boolean {
    return this.compare(x) > 0
  }

  /**
   * True when `|this| > Number.MAX_VALUE`. Uses coefficient digit count plus exponent so extreme
   * exponents stay cheap; only the `[1e308, 1e309)` band does an exact compare.
   */
  greaterThanMaxValue(): boolean {
    if (this.#i === 0n) return false
    const digs = this.#digitCount()
    const order = this.#e + digs - 1
    if (order < 308) return false
    if (order >= 309) return true
    return this.abs().gt(Number.MAX_VALUE)
  }

  /**
   * True when this is greater than or equal to `x`.
   * @param x Other value.
   * @throws Whatever {@link Decimal.compare} throws.
   */
  gte(x: DecimalInput): boolean {
    return this.compare(x) >= 0
  }

  /**
   * Numeric-only compare (no unit or kind tie-break): Decimal/bigint exact; finite number
   * exact-binary. Foreign branded Decimals convert via their brand method.
   */
  numericCompare(o: unknown): number | undefined {
    if (isDecimalBrand(o)) {
      const d = decimal(o as DecimalInput)
      return compareIE(this.#i, this.#e, d.#i, d.#e, this.#digitCount(), d.#digitCount())
    }
    if (typeof o === 'bigint') {
      return compareIE(this.#i, this.#e, o, 0, this.#digitCount())
    }
    if (typeof o === 'number') {
      if (Number.isNaN(o)) return undefined
      if (o === Infinity) return -1
      if (o === -Infinity) return 1
      if (!Number.isFinite(o)) return undefined
      const exact = toExact(o)
      return compareIE(this.#i, this.#e, exact.i, exact.e, this.#digitCount())
    }
    return undefined
  }

  /**
   * Protocol compare: Decimal/bigint exact; finite number exact-binary; +/-Infinity; else undefined.
   * Rank-1 order is lexicographic: numeric value, then unit code (`''` when unit-less).
   */
  protocolCompare(o: unknown): number | undefined {
    const numeric = this.numericCompare(o)
    if (numeric === undefined) return undefined
    return compareValueThenUnit(numeric, unitOf(this), unitOf(o))
  }

  /**
   * Protocol equality: numeric equality, plus the same unit code when both sides carry a unit.
   * Never derived from compare (eq is not transitive across units).
   */
  protocolEquals(o: unknown): boolean {
    const numeric = this.numericCompare(o)
    if (numeric === undefined || numeric !== 0) return false
    const ux = unitOf(this)
    const uy = unitOf(o)
    if (ux !== '' && uy !== '' && ux !== uy) return false
    return true
  }

  readonly [protocol.rank]: Rank = 1;

  [protocol.compare](o: unknown): number | undefined {
    return this.protocolCompare(o)
  }

  [NUMERIC_COMPARE](o: unknown): number | undefined {
    return this.numericCompare(o)
  }

  [protocol.equals](o: unknown): boolean {
    return this.protocolEquals(o)
  }

  [protocol.add](o: unknown): Decimal {
    // Check units on the original operand before brand→string coercion drops the unit hook.
    assertSameCurrency(this, o)
    return this.add(toDecimalInput(o))
  }

  [protocol.sub](o: unknown, reflected = false): Decimal {
    assertSameCurrency(this, o)
    const input = toDecimalInput(o)
    return reflected ? this.mul(-1).add(input) : this.sub(input)
  }

  [protocol.mul](o: unknown): Decimal {
    assertSameCurrency(this, o)
    return this.mul(toDecimalInput(o))
  }

  [protocol.div](o: unknown, reflected = false): Decimal {
    assertSameCurrency(this, o)
    const input = toDecimalInput(o)
    return reflected ? decimal(input).div(this) : this.div(input)
  }

  [protocol.abs](): Decimal {
    return this.abs()
  }
}

Object.defineProperty(Decimal.prototype, DECIMAL_BRAND, {
  value: function decimalBrand(this: Decimal): string {
    // Currency overrides toString for display; brand always returns the plain canonical form.
    return Decimal.prototype.toPlainString.call(this)
  },
  enumerable: false,
  configurable: false,
  writable: false
})
