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

/** True when `v` is a Decimal from this or another copy of the library. */
export function isDecimalBrand(v: unknown): boolean {
  return (
    (typeof v === 'object' || typeof v === 'function') &&
    v !== null &&
    (v as Record<symbol, unknown>)[DECIMAL_BRAND] === true
  )
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
 * Foreign Decimals (other library copies) convert exactly via their string form.
 * @param x Value to convert.
 */
export function decimal(x: DecimalInput): Decimal {
  if (x instanceof Decimal) return x
  if (isDecimalBrand(x)) return new Decimal(String(x))
  return new Decimal(x)
}

function pow10(k: number): bigint {
  return 10n ** BigInt(k)
}

function normalizeIE(i: bigint, e: number): { i: bigint; e: number } {
  if (i === 0n) return { i: 0n, e: 0 }
  const s = i.toString()
  let zeros = 0
  for (let k = s.length - 1; k >= 0 && s[k] === '0'; k--) zeros++
  if (zeros === 0) return { i, e }
  return { i: i / pow10(zeros), e: e + zeros }
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

/** Digit count of a non-zero absolute bigint. */
function digitLengthAbs(a: bigint): number {
  return a.toString().length
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
    return isDecimalBrand(o) && !(o instanceof Decimal) ? String(o) : (o as DecimalInput)
  }
  throw new ValueError('Decimal value must be a number, bigint, string, or Decimal')
}

/**
 * Exact decimal arithmetic with per-operation precision and rounding.
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
  static readonly MAX_EXPONENT = 1_000_000

  /** Maximum fractional precision for {@link Decimal.div}, {@link Decimal.sqrt}, and {@link Decimal.round}. */
  static readonly MAX_PRECISION = 100_000

  #i = 0n
  #e = 0
  /** Lazy cache of absolute coefficient decimal digit count (Decimals are immutable). */
  #digits: number | undefined

  static #assertDivPrecision(precision: number): void {
    if (!Number.isInteger(precision) || precision < 0 || precision > Decimal.MAX_PRECISION) {
      throw new RangeError('precision must be an integer from 0 to 100000')
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
    this.#i = parsed.i
    this.#e = parsed.e
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
    const d = new Decimal(0)
    d.#i = n.i
    d.#e = n.e
    return d
  }

  #scaleRound(n0: bigint, d0: bigint, e0: number, precision: number, mode: RoundingMode): Decimal {
    const k = e0 + precision
    const n = k >= 0 ? n0 * pow10(k) : n0
    const d = k >= 0 ? d0 : d0 * pow10(-k)
    const q = roundQuotient(n / d, n % d, d, mode)
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
   * Exact sum of this and `x`.
   * @param x Addend.
   * @example
   * decimal('0.1').add('0.2').toString() // '0.3'
   */
  add(x: DecimalInput): Decimal {
    const b = decimal(x)
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
   * Exact product of this and `x`.
   * @param x Multiplier.
   */
  mul(x: DecimalInput): Decimal {
    const b = decimal(x)
    return Decimal.#fromIE(this.#i * b.#i, this.#e + b.#e)
  }

  /**
   * Quotient rounded to `precision` fractional digits.
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
    return this.#scaleRound(this.#i, b.#i, this.#e - b.#e, precision, rounding)
  }

  /**
   * Rounds to `precision` fractional digits (negative precision rounds to tens, hundreds, ...).
   * `precision` must be an integer in `[-MAX_EXPONENT, MAX_PRECISION]`. When the rounding
   * unit is larger than this value's magnitude, returns 0 or `±10^(-precision)` without
   * building a huge power of ten.
   * @param precision Fractional digits (may be negative).
   * @param rounding Rounding mode (default halfEven).
   */
  round(precision: number, rounding: RoundingMode = 'halfEven'): Decimal {
    Decimal.#assertRoundPrecision(precision)
    if (-this.#e <= precision) {
      return Decimal.#fromIE(this.#i, this.#e)
    }
    const digs = Decimal.#digitLength(this.#i)
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
    if (p > Decimal.MAX_EXPONENT || p > absI.toString().length + 2) {
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
   * Square root rounded to `precision` fractional digits.
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
    const g = Math.max(0, Math.ceil(-(this.#e + 2 * (precision + 1)) / 2))
    const t = -(precision + 1 + g)
    const N = this.#i * pow10(this.#e - 2 * t)
    const { root: s, exact } = isqrtRoot(N)
    const d = pow10(1 + g)
    const q = s / d
    const r = s % d
    return Decimal.#fromIE(roundQuotient(q, r, d, rounding, !exact), -precision)
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
   * Number nearest to this Decimal (`Number(toString())`).
   */
  toNumber(): number {
    return Number(this.toString())
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
   * exact-binary. Foreign branded Decimals convert via their string form.
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
  value: true,
  enumerable: false,
  configurable: false,
  writable: false
})

registerRank1NumericCompare(compareRank1Numeric)
