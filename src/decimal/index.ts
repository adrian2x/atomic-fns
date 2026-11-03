/**
 * `Decimal` provides support for correct rounded floating point arithmetic.
 *
 * @module decimal
 */

import { ValueError, ZeroDivisionError } from '../globals/errors.js'
import { protocol } from '../operators/protocol.js'
import { isqrtRoot } from './isqrt.js'

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
 * @param x Value to convert.
 */
export function decimal(x: DecimalInput): Decimal {
  return x instanceof Decimal ? x : new Decimal(x)
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

function compareIE(ai: bigint, ae: number, bi: bigint, be: number): -1 | 0 | 1 {
  if (ae === be) return ai < bi ? -1 : ai > bi ? 1 : 0
  if (ae > be) {
    const scaled = ai * pow10(ae - be)
    return scaled < bi ? -1 : scaled > bi ? 1 : 0
  }
  const scaled = bi * pow10(be - ae)
  return ai < scaled ? -1 : ai > scaled ? 1 : 0
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
    typeof o === 'number' ||
    typeof o === 'bigint' ||
    typeof o === 'string'
  ) {
    return o
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

  #i = 0n
  #e = 0

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

  static #truncateForError(value: string): string {
    return value.length > 32 ? `${value.slice(0, 32)}...` : value
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
    throw new ValueError(`invalid Decimal string: ${Decimal.#truncateForError(value)}`)
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
    if (!Number.isInteger(precision) || precision < 0) {
      throw new RangeError('precision must be a non-negative integer')
    }
    const b = decimal(x)
    if (b.#i === 0n) {
      throw new ZeroDivisionError('division by zero')
    }
    return this.#scaleRound(this.#i, b.#i, this.#e - b.#e, precision, rounding)
  }

  /**
   * Rounds to `precision` fractional digits (negative precision rounds to tens, hundreds, ...).
   * @param precision Fractional digits (may be negative).
   * @param rounding Rounding mode (default halfEven).
   */
  round(precision: number, rounding: RoundingMode = 'halfEven'): Decimal {
    if (!Number.isInteger(precision)) {
      throw new RangeError('precision must be an integer')
    }
    if (-this.#e <= precision) {
      return Decimal.#fromIE(this.#i, this.#e)
    }
    return this.#scaleRound(this.#i, 1n, this.#e, precision, rounding)
  }

  /**
   * Square root rounded to `precision` fractional digits.
   * @param opts Precision and rounding mode.
   */
  sqrt(opts?: DivOptions): Decimal {
    const precision = opts?.precision ?? Decimal.defaultPrecision
    const rounding = opts?.rounding ?? 'halfEven'
    if (!Number.isInteger(precision) || precision < 0) {
      throw new RangeError('precision must be a non-negative integer')
    }
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
   * Exact comparison with a Decimal, bigint, or number (exact binary for numbers).
   * @param x Other value.
   */
  compare(x: DecimalInput): -1 | 0 | 1 {
    if (typeof x === 'number') {
      const r = this.protocolCompare(x)
      if (r === undefined) throw new TypeError('cannot compare Decimal with NaN')
      return r < 0 ? -1 : r > 0 ? 1 : 0
    }
    const o = decimal(x)
    return compareIE(this.#i, this.#e, o.#i, o.#e)
  }

  /**
   * Value equality (exact binary when `x` is a number).
   * @param x Other value.
   */
  eq(x: DecimalInput): boolean {
    if (typeof x === 'number') return this.protocolEquals(x)
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
   * True when this is greater than or equal to `x`.
   * @param x Other value.
   */
  gte(x: DecimalInput): boolean {
    return this.compare(x) >= 0
  }

  /** Protocol compare: Decimal/bigint exact; finite number exact-binary; +/-Infinity; else undefined. */
  protocolCompare(o: unknown): number | undefined {
    if (o instanceof Decimal) return compareIE(this.#i, this.#e, o.#i, o.#e)
    if (typeof o === 'bigint') return compareIE(this.#i, this.#e, o, 0)
    if (typeof o === 'number') {
      if (Number.isNaN(o)) return undefined
      if (o === Infinity) return -1
      if (o === -Infinity) return 1
      if (!Number.isFinite(o)) return undefined
      const exact = toExact(o)
      return compareIE(this.#i, this.#e, exact.i, exact.e)
    }
    return undefined
  }

  /** Protocol equality over the same domain as protocol compare. */
  protocolEquals(o: unknown): boolean {
    return this.protocolCompare(o) === 0
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
