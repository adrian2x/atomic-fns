/**
 * `Decimal` provides support for correct rounded floating point arithmetic.
 *
 * @module decimal
 */

import { ValueError, ZeroDivisionError } from '../globals/errors.js'
import { compareValueThenUnit } from '../internal/rank1.js'
import { truncateForError } from '../internal/truncate.js'
import { registerRank1NumericCompare } from '../operators/order.js'
import { protocol, unitOf } from '../operators/protocol.js'
import { isqrtRoot } from './isqrt.js'

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
 * Numeric-only rank-1 compare (no unit or kind tie-break).
 * Returns `undefined` when either side is not a comparable rank-1 numeric.
 */
function asCmp3(n: number): -1 | 0 | 1 {
  return n < 0 ? -1 : n > 0 ? 1 : 0
}

export function compareRank1Numeric(x: unknown, y: unknown): -1 | 0 | 1 | undefined {
  if (isDecimalBrand(x) || x instanceof Decimal) {
    const r = coerceDecimal(x).numericCompare(y)
    return r === undefined ? undefined : asCmp3(r)
  }
  if (isDecimalBrand(y) || y instanceof Decimal) {
    const r = coerceDecimal(y).numericCompare(x)
    if (r === undefined) return undefined
    return asCmp3(-r)
  }
  if (
    (typeof x === 'number' || typeof x === 'bigint') &&
    (typeof y === 'number' || typeof y === 'bigint')
  ) {
    if (typeof x === 'number' && Number.isNaN(x)) return undefined
    if (typeof y === 'number' && Number.isNaN(y)) return undefined
    return x < y ? -1 : x > y ? 1 : 0
  }
  return undefined
}

function coerceDecimal(v: unknown): Decimal {
  if (v instanceof Decimal) return v
  if (isDecimalBrand(v)) return new Decimal(decimalBrandString(v))
  return new Decimal(String(v))
}

/** Rounding mode for {@link Decimal.div}, {@link Decimal.round} and {@link Decimal.sqrt}. */
export type RoundingMode = 'halfEven' | 'halfUp' | 'halfDown' | 'down' | 'up' | 'floor' | 'ceil'

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
  if (x instanceof Decimal) return x
  if (isDecimalBrand(x)) return new Decimal(decimalBrandString(x))
  return new Decimal(x)
}

/** Cached `10^k` for k in `0..MAX_DIGITS+2` (digit-count bounds and arithmetic). */
const POW10_TABLE: bigint[] = (() => {
  const t: bigint[] = [1n]
  let p = 1n
  for (let k = 1; k <= 10_002; k++) {
    p *= 10n
    t.push(p)
  }
  return t
})()

function pow10(k: number): bigint {
  if (k >= 0 && k < POW10_TABLE.length) return POW10_TABLE[k]
  return 10n ** BigInt(k)
}

/** Bit length of a positive bigint (no decimal strings). */
function bitLengthAbs(a: bigint): number {
  let n = a
  let bits = 0
  while (n > 0xffffffffffffffffn) {
    n >>= 64n
    bits += 64
  }
  if (n > 0xffffffffn) {
    n >>= 32n
    bits += 32
  }
  bits += 32 - Math.clz32(Number(n))
  return bits
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
  const powers: bigint[] = [10n]
  for (let k = 0; k < 13; k++) {
    const last = powers[powers.length - 1]
    powers.push(last * last)
  }
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

function gcdBig(a: bigint, b: bigint): bigint {
  let x = absBig(a)
  let y = absBig(b)
  while (y !== 0n) {
    const t = x % y
    x = y
    y = t
  }
  return x
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
 * power of ten (no decimal toString on the arithmetic path).
 */
function digitLengthAbs(a: bigint): number {
  if (a < 10n) return 1
  const bits = bitLengthAbs(a)
  // digits ≈ floor(bits * log10(2)) + 1; adjust with one table compare
  let digits = Math.floor(bits * Math.LOG10E * Math.LN2) + 1
  if (digits < 1) digits = 1
  if (digits > 10_002) digits = 10_002
  const bound = POW10_TABLE[digits - 1]
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

function roundQuotient(
  q: bigint,
  r: bigint,
  d: bigint,
  mode: RoundingMode,
  inexact = false
): bigint {
  if (r === 0n && !inexact) return q
  const s = r < 0n !== d < 0n ? -1n : 1n
  const twice = 2n * absBig(r)
  const ad = absBig(d)
  const cmpHalf = twice < ad ? -1 : twice > ad || (twice === ad && inexact) ? 1 : 0
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
    o instanceof Decimal ||
    isDecimalBrand(o) ||
    typeof o === 'number' ||
    typeof o === 'bigint' ||
    typeof o === 'string'
  ) {
    return isDecimalBrand(o) && !(o instanceof Decimal)
      ? decimalBrandString(o)
      : (o as DecimalInput)
  }
  throw new ValueError('Decimal value must be a number, bigint, string, or Decimal')
}

/**
 * Exact decimal arithmetic with per-operation precision and rounding.
 * Near {@link Decimal.MAX_DIGITS}, each arithmetic operation costs on the order of 0.2 ms, so
 * a running total over many attacker-chosen items grows linearly with the item count - size-limit
 * untrusted lists before reducing them.
 */
export class Decimal {
  /**
   * Default fractional digit count for {@link Decimal.div} and {@link Decimal.sqrt}.
   * Getter-only so assignment throws at runtime (a `readonly` field is TypeScript-only).
   */
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style -- runtime immutability
  static get defaultPrecision(): 20 {
    return 20
  }

  /** Maximum absolute stored exponent; larger values throw {@link ValueError}. */
  static readonly MAX_EXPONENT = 10_000

  /** Maximum fractional precision for {@link Decimal.div}, {@link Decimal.sqrt}, and {@link Decimal.round}. */
  static readonly MAX_PRECISION = 10_000

  /**
   * Maximum normalized coefficient decimal digit count (significant digits after stripping leading
   * and trailing zeros). Work and results of every arithmetic operation are bounded by this (not
   * by {@link Decimal.MAX_EXPONENT}); larger results throw {@link RangeError}. Exact terminating /
   * perfect-square results may still use any allowed exponent when their significant digit count
   * fits.
   */
  static readonly MAX_DIGITS = 10_000

  /**
   * Maximum raw decimal string length accepted by the parser. Enough for any value within
   * {@link Decimal.MAX_EXPONENT} written in plain notation. Longer inputs throw {@link ValueError}
   * before scanning so parsing stays linear in the allowed length.
   */
  static readonly MAX_INPUT_LENGTH = 1_100_000

  #i = 0n
  #e = 0
  /** Lazy cache of absolute coefficient decimal digit count (Decimals are immutable). */
  #digits: number | undefined

  static #assertDigitsBound(bound: number): void {
    if (bound > Decimal.MAX_DIGITS) {
      throw new RangeError('result exceeds 10000 digits')
    }
  }

  static #assertDivPrecision(precision: number): void {
    if (!Number.isInteger(precision) || precision < 0 || precision > Decimal.MAX_PRECISION) {
      throw new RangeError('precision must be an integer from 0 to 10000')
    }
  }

  static #assertRoundPrecision(precision: number): void {
    if (
      !Number.isInteger(precision) ||
      precision < -Decimal.MAX_EXPONENT ||
      precision > Decimal.MAX_PRECISION
    ) {
      throw new RangeError(
        `precision must be an integer from ${String(-Decimal.MAX_EXPONENT)} to ${String(Decimal.MAX_PRECISION)}`
      )
    }
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
   * Creates a Decimal from a number, bigint, string, or another Decimal.
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
    throw new ValueError('Decimal value must be a number, bigint, string, or Decimal')
  }

  static #parseExponent(expRaw: string | undefined): number {
    if (expRaw === undefined) return 0
    const n = Number(expRaw)
    if (!Number.isFinite(n) || !Number.isSafeInteger(n)) {
      throw new ValueError('exponent out of range')
    }
    if (Math.abs(n) > Decimal.MAX_EXPONENT) {
      throw new ValueError('exponent out of range')
    }
    return n
  }

  static #parseString(value: string): { i: bigint; e: number } {
    if (value.length > Decimal.MAX_INPUT_LENGTH) {
      throw new ValueError('Decimal input too long')
    }
    const leading: (string | undefined)[] | null = PARSE_LEADING_DIGITS.exec(value)
    if (leading) {
      const sign = leading[1] === '-' ? '-' : ''
      const intDigits = leading[2] ?? '0'
      const frac = leading[3] ?? ''
      const exp = Decimal.#parseExponent(leading[4])
      const i = BigInt(sign + intDigits + frac)
      return Decimal.#checked(normalizeIE(i, -frac.length + exp))
    }
    const dotted: (string | undefined)[] | null = PARSE_LEADING_DOT.exec(value)
    if (dotted) {
      const sign = dotted[1] === '-' ? '-' : ''
      const frac = dotted[2] ?? ''
      const exp = Decimal.#parseExponent(dotted[3])
      const i = BigInt(sign + (frac || '0'))
      return Decimal.#checked(normalizeIE(i, -frac.length + exp))
    }
    throw new ValueError(`invalid Decimal string: ${truncateForError(value)}`)
  }

  static #checked(ie: { i: bigint; e: number }): { i: bigint; e: number } {
    if (Math.abs(ie.e) > Decimal.MAX_EXPONENT) {
      throw new ValueError('exponent out of range')
    }
    return ie
  }

  static #fromIE(i: bigint, e: number): Decimal {
    const n = Decimal.#checked(normalizeIE(i, e))
    const digs = Decimal.#digitLength(n.i)
    Decimal.#assertDigitsBound(digs)
    const d = new Decimal(0)
    d.#i = n.i
    d.#e = n.e
    d.#digits = digs
    return d
  }

  #scaleRound(n0: bigint, d0: bigint, e0: number, precision: number, mode: RoundingMode): Decimal {
    const k = e0 + precision
    const nDigits = Decimal.#digitLength(n0)
    const dDigits = Decimal.#digitLength(d0)
    // Intermediates may reach about 2 * MAX_DIGITS; quotient significant digits at most MAX_DIGITS+1.
    const maxWork = 2 * Decimal.MAX_DIGITS
    const maxSig = Decimal.MAX_DIGITS + 1
    if (k >= 0) {
      if (nDigits + k > maxWork || Math.max(1, nDigits + k - dDigits + 1) > maxSig) {
        throw new RangeError('result exceeds 10000 digits')
      }
    } else if (dDigits - k > maxWork || Math.max(1, nDigits - (dDigits - k) + 1) > maxSig) {
      throw new RangeError('result exceeds 10000 digits')
    }
    const n = k >= 0 ? n0 * pow10(k) : n0
    const d = k >= 0 ? d0 : d0 * pow10(-k)
    const q = roundQuotient(n / d, n % d, d, mode)
    return Decimal.#fromIE(q, -precision)
  }

  /** Count trailing zero bits of a positive bigint (factors of 2) without digit strings. */
  static #trailingZeros2(d: bigint): number {
    if ((d & 1n) !== 0n) return 0
    let x = d
    let tz = 0
    while ((x & 0xffffn) === 0n) {
      x >>= 16n
      tz += 16
    }
    if ((x & 0xffn) === 0n) {
      x >>= 8n
      tz += 8
    }
    if ((x & 0xfn) === 0n) {
      x >>= 4n
      tz += 4
    }
    if ((x & 0x3n) === 0n) {
      x >>= 2n
      tz += 2
    }
    if ((x & 1n) === 0n) tz += 1
    return tz
  }

  /**
   * Divide out all factors of 5 from a positive bigint via large powers (repeated squaring).
   * Returns the cofactor and the factor count.
   */
  static #stripFactors5(d: bigint): { rest: bigint; count: number } {
    if (d % 5n !== 0n) return { rest: d, count: 0 }
    const powers: bigint[] = [5n]
    for (;;) {
      const last = powers[powers.length - 1]
      const next = last * last
      if (next > d) break
      powers.push(next)
      if (powers.length > 20) break
    }
    let rest = d
    let count = 0
    for (let k = powers.length - 1; k >= 0; k--) {
      const pk = powers[k]
      const step = 1 << k
      while (rest % pk === 0n) {
        rest /= pk
        count += step
      }
    }
    return { rest, count }
  }

  /**
   * Exact terminating quotient of coefficients, or `undefined` when the denominator has a
   * prime factor other than 2 or 5 (after cancelling gcd). Exponent is adjusted; coefficient
   * growth is capped at {@link Decimal.MAX_DIGITS}. Factors of 2/5 are stripped in bulk and
   * the result digit count is estimated before a single multiply (no digit counts in a loop).
   */
  static #exactTerminating(
    i1: bigint,
    e1: number,
    i2: bigint,
    e2: number
  ): { i: bigint; e: number } | undefined {
    const sign = i1 < 0n !== i2 < 0n ? -1n : 1n
    let n = absBig(i1)
    let d = absBig(i2)
    const g = gcdBig(n, d)
    n /= g
    d /= g
    const twos = Decimal.#trailingZeros2(d)
    if (twos > 0) d >>= BigInt(twos)
    const fives = Decimal.#stripFactors5(d)
    d = fives.rest
    if (d !== 1n) return undefined
    const a = twos
    const b = fives.count
    const e = e1 - e2 - a - b
    if (a > 0 || b > 0) {
      // digits(n * 5^a * 2^b) <= digits(n) + floor(a*log10(5) + b*log10(2)) + 1
      const nDigits = Decimal.#digitLength(n)
      const growth = Math.floor(a * Math.log10(5) + b * Math.log10(2)) + 1
      if (nDigits + growth - 1 > Decimal.MAX_DIGITS) {
        throw new RangeError('result exceeds 10000 digits')
      }
      if (a > 0) n *= 5n ** BigInt(a)
      if (b > 0) n *= 2n ** BigInt(b)
      if (Decimal.#digitLength(n) > Decimal.MAX_DIGITS) {
        throw new RangeError('result exceeds 10000 digits')
      }
    }
    return { i: sign * n, e }
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
   * Exact sum of this and `x`. Result significant digits and intermediate alignment work are
   * bounded by {@link Decimal.MAX_DIGITS} (independent of {@link Decimal.MAX_EXPONENT}).
   * Near the digit cap each add is on the order of 0.2 ms; size-limit untrusted running totals.
   * @param x Addend.
   * @example
   * decimal('0.1').add('0.2').toString() // '0.3'
   */
  add(x: DecimalInput): Decimal {
    const b = decimal(x)
    if (this.#i === 0n) return Decimal.#fromIE(b.#i, b.#e)
    if (b.#i === 0n) return Decimal.#fromIE(this.#i, this.#e)
    const d1 = this.#digitCount()
    const d2 = b.#digitCount()
    const e = Math.min(this.#e, b.#e)
    // Upper bound on aligned sum digits (incl. carry): max(e1+d1, e2+d2) - min(e1,e2) + 1.
    // Allow one carry digit above MAX_DIGITS; normalize then enforces the hard cap.
    const span = Math.max(this.#e + d1, b.#e + d2) - e + 1
    if (span > Decimal.MAX_DIGITS + 1) {
      throw new RangeError('result exceeds 10000 digits')
    }
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
   * Exact product of this and `x`. Checks `digits(this) + digits(x)` before multiplying.
   * @param x Multiplier.
   */
  mul(x: DecimalInput): Decimal {
    const b = decimal(x)
    Decimal.#assertDigitsBound(this.#digitCount() + b.#digitCount())
    return Decimal.#fromIE(this.#i * b.#i, this.#e + b.#e)
  }

  /**
   * Quotient rounded to `precision` fractional digits. Exponents are factored out so work is
   * bounded by {@link Decimal.MAX_DIGITS}; an exact terminating result of any allowed exponent
   * succeeds when its significant digit count fits.
   * @param x Divisor.
   * @param opts Precision and rounding mode.
   */
  div(x: DecimalInput, opts?: DivOptions): Decimal {
    const precision = opts?.precision ?? Decimal.defaultPrecision
    const rounding = opts?.rounding ?? 'halfEven'
    Decimal.#assertDivPrecision(precision)
    const b = decimal(x)
    if (b.#i === 0n) {
      throw new ZeroDivisionError('division by zero')
    }
    const exact = Decimal.#exactTerminating(this.#i, this.#e, b.#i, b.#e)
    if (exact !== undefined) {
      return Decimal.#fromIE(exact.i, exact.e).round(precision, rounding)
    }
    return this.#scaleRound(this.#i, b.#i, this.#e - b.#e, precision, rounding)
  }

  /**
   * Rounds to `precision` fractional digits (negative precision rounds to tens, hundreds, ...).
   * `precision` must be an integer in `[-MAX_EXPONENT, MAX_PRECISION]`. When the rounding
   * unit is larger than this value's magnitude, returns 0 or `±10^(-precision)` without
   * building a huge power of ten. The digit bound applies to the rounded result (not a looser
   * pre-estimate).
   * @param precision Fractional digits (may be negative).
   * @param rounding Rounding mode (default halfEven).
   */
  round(precision: number, rounding: RoundingMode = 'halfEven'): Decimal {
    Decimal.#assertRoundPrecision(precision)
    if (-this.#e <= precision) {
      return Decimal.#fromIE(this.#i, this.#e)
    }
    const digs = this.#digitCount()
    if (digs === 0) return Decimal.#fromIE(0n, 0)
    const msdExp = this.#e + digs - 1
    const unitExp = -precision
    if (msdExp < unitExp) {
      return this.#roundBelowUnit(precision, rounding)
    }
    return this.#scaleRound(this.#i, 1n, this.#e, precision, rounding)
  }

  /**
   * Round when `|this| < 10^(-precision)`: result is 0 or `±10^(-precision)`.
   */
  #roundBelowUnit(precision: number, mode: RoundingMode): Decimal {
    const sign = this.#i < 0n ? -1n : 1n
    const absI = this.#i < 0n ? -this.#i : this.#i
    const p = -precision - this.#e
    let cmpHalf: -1 | 0 | 1
    if (p > Decimal.MAX_EXPONENT || p > digitLengthAbs(absI) + 2) {
      cmpHalf = -1
    } else {
      const twice = absI << 1n
      const threshold = pow10(p)
      cmpHalf = twice < threshold ? -1 : twice > threshold ? 1 : 0
    }
    let up = false
    switch (mode) {
      case 'halfEven':
        up = cmpHalf > 0
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
        up = sign > 0n
        break
      case 'floor':
        up = sign < 0n
        break
    }
    if (!up) return Decimal.#fromIE(0n, 0)
    return Decimal.#fromIE(sign, -precision)
  }

  /**
   * Square root rounded to `precision` fractional digits. Exponents are factored out so work is
   * bounded by {@link Decimal.MAX_DIGITS}; a perfect-square result of any allowed exponent
   * succeeds when its significant digit count fits.
   * @param opts Precision and rounding mode.
   */
  sqrt(opts?: DivOptions): Decimal {
    const precision = opts?.precision ?? Decimal.defaultPrecision
    const rounding = opts?.rounding ?? 'halfEven'
    Decimal.#assertDivPrecision(precision)
    if (this.#i < 0n) {
      throw new ValueError('square root of a negative number')
    }
    if (this.#i === 0n) {
      return decimal(0)
    }
    // Factor exponent: i * 10^e = coeff * 10^(2*half) with coeff = i or i*10.
    let coeff = this.#i
    let halfExp = this.#e
    if (halfExp % 2 !== 0) {
      coeff *= 10n
      halfExp -= 1
    }
    halfExp = halfExp / 2
    const coeffDigits = Decimal.#digitLength(coeff)
    Decimal.#assertDigitsBound(coeffDigits)
    const { root, exact } = isqrtRoot(coeff)
    if (exact) {
      return Decimal.#fromIE(root, halfExp).round(precision, rounding)
    }
    // s ≈ sqrt(coeff) * 10^(halfExp + precision + 1); round off one guard digit.
    const g = halfExp + precision + 1
    if (g < 0) {
      return Decimal.#fromIE(root, halfExp).round(precision, rounding)
    }
    if (coeffDigits + 2 * g > 2 * Decimal.MAX_DIGITS) {
      throw new RangeError('result exceeds 10000 digits')
    }
    if (Math.ceil((coeffDigits + 2 * g) / 2) + 1 > Decimal.MAX_DIGITS + 1) {
      throw new RangeError('result exceeds 10000 digits')
    }
    const N = coeff * pow10(2 * g)
    const scaled = isqrtRoot(N)
    const d = 10n
    return Decimal.#fromIE(
      roundQuotient(scaled.root / d, scaled.root % d, d, rounding, !scaled.exact),
      -precision
    )
  }

  /**
   * Returns a copy of this Decimal.
   */
  clone(): Decimal {
    return Decimal.#fromIE(this.#i, this.#e)
  }

  /**
   * Canonical decimal string.
   */
  toString(): string {
    let s = this.#i.toString()
    let m = ''
    if (s.startsWith('-')) {
      s = s.slice(1)
      m = '-'
    }
    if (this.#e > 0) {
      return m + s + '0'.repeat(this.#e)
    }
    if (this.#e < 0) {
      if (-this.#e >= s.length) {
        return m + '0.' + '0'.repeat(-this.#e - s.length) + s
      }
      return m + s.slice(0, s.length + this.#e) + '.' + s.slice(s.length + this.#e)
    }
    return m + s
  }

  /**
   * Number nearest to this Decimal. Builds at most 17 significant digits plus an exponent
   * (never the full plain `toString()`), so extreme exponents stay cheap.
   */
  toNumber(): number {
    if (this.#i === 0n) return 0
    const neg = this.#i < 0n
    const abs = neg ? -this.#i : this.#i
    const digs = this.#digitCount()
    const keep = digs > 17 ? 17 : digs
    const drop = digs - keep
    const top = drop > 0 ? abs / pow10(drop) : abs
    const exp = this.#e + drop
    const body = top.toString()
    const signed = neg ? '-' + body : body
    if (exp === 0) return Number(signed)
    return Number(signed + 'e' + String(exp))
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
   * Semantic equality. Identical to {@link Decimal.protocolEquals} for Decimal, number,
   * bigint, and branded foreign Decimals; string inputs stay numeric-only.
   * @param x Other value.
   */
  eq(x: DecimalInput): boolean {
    if (
      typeof x === 'number' ||
      typeof x === 'bigint' ||
      x instanceof Decimal ||
      isDecimalBrand(x)
    ) {
      return this.protocolEquals(x)
    }
    const o = decimal(x)
    return this.#i === o.#i && this.#e === o.#e
  }

  /**
   * True when this is strictly less than `x`.
   * @param x Other value.
   */
  lt(x: DecimalInput): boolean {
    return this.compare(x) < 0
  }

  /**
   * True when this is less than or equal to `x`.
   * @param x Other value.
   */
  lte(x: DecimalInput): boolean {
    return this.compare(x) <= 0
  }

  /**
   * True when this is strictly greater than `x`.
   * @param x Other value.
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
   */
  gte(x: DecimalInput): boolean {
    return this.compare(x) >= 0
  }

  /**
   * Numeric-only compare (no unit or kind tie-break): Decimal/bigint exact; finite number
   * exact-binary. Foreign branded Decimals convert via their brand method.
   */
  numericCompare(o: unknown): number | undefined {
    if (o instanceof Decimal) {
      return compareIE(this.#i, this.#e, o.#i, o.#e, this.#digitCount(), o.#digitCount())
    }
    if (isDecimalBrand(o)) {
      const d = coerceDecimal(o)
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

  get [protocol.rank]() {
    return 1 as const
  }

  [protocol.compare](o: unknown) {
    return this.protocolCompare(o)
  }

  [protocol.equals](o: unknown) {
    return this.protocolEquals(o)
  }

  [protocol.add](o: unknown) {
    return this.add(toDecimalInput(o))
  }

  [protocol.sub](o: unknown) {
    return this.sub(toDecimalInput(o))
  }

  [protocol.mul](o: unknown) {
    return this.mul(toDecimalInput(o))
  }

  [protocol.div](o: unknown) {
    return this.div(toDecimalInput(o))
  }

  [protocol.abs]() {
    return this.abs()
  }
}

Object.defineProperty(Decimal.prototype, DECIMAL_BRAND, {
  value: function decimalBrand(this: Decimal): string {
    // Currency overrides toString for display; brand always returns the plain canonical form.
    return Decimal.prototype.toString.call(this)
  },
  enumerable: false,
  configurable: false,
  writable: false
})

registerRank1NumericCompare(compareRank1Numeric)
