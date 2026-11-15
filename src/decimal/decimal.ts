import { bitLength } from './internal/bits.ts'
import { quoteForError } from './internal/echo.ts'
import { canonicalLocales } from './internal/locale.ts'
import { pow10, pow10Squares } from './internal/pow10.ts'

/**
 * A value {@link Decimal} reads: a Decimal, a decimal string, a bigint or a finite number.
 * @example
 * ```ts
 * const inputs: DecimalInput[] = [new Decimal('1.5'), '2.5', 3n, 4.5]
 * inputs.map((value) => new Decimal(value).toString()) // ['1.5', '2.5', '3', '4.5']
 * ```
 */
export type DecimalInput = Decimal | string | bigint | number

const MAX_EXPONENT = 10_000
const MAX_DIGITS = 10_000
const MAX_INPUT_LENGTH = 2 * MAX_EXPONENT + MAX_DIGITS + 32

/** No Decimal reaches `10^MAX_VALUE_DIGITS`. */
const MAX_VALUE_DIGITS = MAX_DIGITS + MAX_EXPONENT

/** Zeros {@link Decimal.toString} pads a coefficient with before it turns scientific. */
const MAX_PLAIN_PADDING = 64

/**
 * Unambiguous decimal grammar: a mandatory digit run or dot separates the two whitespace runs and no
 * two optional digit runs overlap, so matching is linear.
 */
const PARSE_LEADING_DIGITS = /^\s*([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?\s*$/i
const PARSE_LEADING_DOT = /^\s*([+-]?)\.(\d+)(?:e([+-]?\d+))?\s*$/i

function absBig(n: bigint): bigint {
  return n < 0n ? -n : n
}

/** Strips trailing decimal zeros with bulk divides by cached powers of ten. */
function normalize(i: bigint, e: number): { i: bigint; e: number } {
  if (i === 0n) return { i: 0n, e: 0 }
  if (i % 10n !== 0n) return { i, e }
  let x = i
  let zeros = 0
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

/**
 * Digit count of a non-zero absolute bigint from its bit length and one compare against a power
 * of ten, without a base-10 conversion. Saturates past {@link MAX_VALUE_DIGITS}, where the value
 * is already longer than every Decimal.
 */
function digitLengthAbs(a: bigint): number {
  if (a < 10n) return 1
  const estimate = Math.floor(bitLength(a) * Math.LOG10E * Math.LN2) + 1
  const digits = Math.min(estimate, MAX_VALUE_DIGITS + 2)
  const bound = pow10(digits - 1)
  if (a >= bound * 10n) return digits + 1
  if (a < bound) return digits - 1
  return digits
}

function digitLength(n: bigint): number {
  return n === 0n ? 0 : digitLengthAbs(absBig(n))
}

/** `i * 10^e` with the digit count of `i`, as {@link compareIE} reads it. */
interface Operand {
  i: bigint
  e: number
  digits: number
}

/** The order of two values with the same sign whose magnitudes differ. */
function orderBySign(smallerMagnitude: boolean, negative: boolean): -1 | 1 {
  return smallerMagnitude === negative ? 1 : -1
}

/**
 * Orders `a.i * 10^a.e` and `b.i * 10^b.e`: sign first, then order of magnitude, and only when
 * those tie does it scale one coefficient, by a gap no wider than the digit-count difference.
 */
function compareIE(a: Operand, b: Operand): -1 | 0 | 1 {
  if (a.i === 0n && b.i === 0n) return 0
  if (a.i === 0n) return b.i < 0n ? 1 : -1
  if (b.i === 0n) return a.i < 0n ? -1 : 1
  const negative = a.i < 0n
  if (negative !== b.i < 0n) return negative ? -1 : 1
  const aMag = a.e + a.digits - 1
  const bMag = b.e + b.digits - 1
  if (aMag !== bMag) return orderBySign(aMag < bMag, negative)
  const aAbs = absBig(a.i)
  const bAbs = absBig(b.i)
  const left = a.e > b.e ? aAbs * pow10(a.e - b.e) : aAbs
  const right = b.e > a.e ? bAbs * pow10(b.e - a.e) : bAbs
  if (left === right) return 0
  return orderBySign(left < right, negative)
}

function assertDigitsBound(digits: number): void {
  if (digits > MAX_DIGITS) throw new RangeError(`result exceeds ${String(MAX_DIGITS)} digits`)
}

function assertExponent(e: number): void {
  if (Math.abs(e) > MAX_EXPONENT) throw new RangeError('exponent out of range')
}

/**
 * An exact decimal number, shaped after the TC39 Decimal proposal: immutable, with arithmetic
 * methods instead of operators. Values carry up to {@link Decimal.MAX_DIGITS} significant digits
 * and an exponent within {@link Decimal.MAX_EXPONENT}; a result past either throws `RangeError`.
 * Each operation costs time that grows with the digits of its operands, so size-limit untrusted
 * lists before summing them.
 *
 * @example
 * ```ts
 * const total = new Decimal('0.1').add('0.2')
 * total.toString() // '0.3'
 * total.equals('0.3') // true
 * ```
 */
export class Decimal {
  /** Significant digits a Decimal holds; longer inputs and results throw `RangeError`. */
  static get MAX_DIGITS(): number {
    return MAX_DIGITS
  }

  /** Largest absolute exponent a Decimal stores; larger values throw `RangeError`. */
  static get MAX_EXPONENT(): number {
    return MAX_EXPONENT
  }

  /**
   * Orders two values, for `toSorted` and sorted collections.
   * @example
   * ```ts
   * ['10', '9', '9.5'].map((s) => new Decimal(s)).toSorted(Decimal.compare).map(String)
   * // ['9', '9.5', '10']
   * ```
   */
  static compare(a: DecimalInput, b: DecimalInput): -1 | 0 | 1 {
    return compareIE(Decimal.#operand(a), Decimal.#operand(b))
  }

  #i: bigint
  #e: number
  #digits: number

  /**
   * Reads a Decimal, a decimal string (`'-1.5'`, `'.5'`, `'2e-3'`, surrounding spaces allowed),
   * a bigint, or a finite number through its shortest round-trip string, so `new Decimal(0.1)`
   * is exactly `0.1`.
   * @throws {TypeError} for any other type.
   * @throws {RangeError} for a malformed string, a non-finite number, or a value past the bounds.
   * @example
   * ```ts
   * new Decimal('1.50').toString() // '1.5'
   * new Decimal(2n ** 64n).toString() // '18446744073709551616'
   * ```
   */
  constructor(value: DecimalInput) {
    const parsed = Decimal.#parse(value)
    const digits = digitLength(parsed.i)
    assertDigitsBound(digits)
    assertExponent(parsed.e)
    this.#i = parsed.i
    this.#e = parsed.e
    this.#digits = digits
  }

  static #from(value: DecimalInput): Decimal {
    return value instanceof Decimal ? value : new Decimal(value)
  }

  static #operand(value: DecimalInput): Operand {
    const d = Decimal.#from(value)
    return { i: d.#i, e: d.#e, digits: d.#digits }
  }

  static #parse(value: DecimalInput): { i: bigint; e: number } {
    if (value instanceof Decimal) return { i: value.#i, e: value.#e }
    if (typeof value === 'string') return Decimal.#parseString(value)
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new RangeError(`${String(value)} is not a finite number`)
      return Decimal.#parseString(String(value))
    }
    if (typeof value === 'bigint') {
      Decimal.#assertBigintSpan(value)
      return normalize(value, 0)
    }
    throw new TypeError('Decimal value must be a Decimal, string, bigint or number')
  }

  /** Keeps a bigint too long for any Decimal away from the quadratic {@link normalize}. */
  static #assertBigintSpan(value: bigint): void {
    if (digitLengthAbs(absBig(value)) <= MAX_VALUE_DIGITS) return
    if (value % pow10(MAX_EXPONENT + 1) === 0n) throw new RangeError('exponent out of range')
    throw new RangeError(`result exceeds ${String(MAX_DIGITS)} digits`)
  }

  static #parseString(value: string): { i: bigint; e: number } {
    if (value.length > MAX_INPUT_LENGTH) {
      throw new RangeError(`decimal string longer than ${String(MAX_INPUT_LENGTH)} characters`)
    }
    const leading = PARSE_LEADING_DIGITS.exec(value)
    if (leading) return Decimal.#parseParts(leading[1], leading[2], leading[3] ?? '', leading[4])
    const dotted = PARSE_LEADING_DOT.exec(value)
    if (dotted) return Decimal.#parseParts(dotted[1], '0', dotted[2], dotted[3])
    throw new RangeError(`invalid decimal string: ${quoteForError(value)}`)
  }

  static #parseParts(
    sign: string,
    intDigits: string,
    frac: string,
    exponent: string | undefined
  ): { i: bigint; e: number } {
    // Count significant digits before BigInt sees an oversized coefficient.
    const digits = intDigits + frac
    let start = 0
    while (start < digits.length && digits.charCodeAt(start) === 48) start++
    let end = digits.length
    while (end > start && digits.charCodeAt(end - 1) === 48) end--
    assertDigitsBound(end - start)
    const i = BigInt(sign + digits)
    return normalize(i, Number(exponent ?? 0) - frac.length)
  }

  static #fromIE(i: bigint, e: number): Decimal {
    const n = normalize(i, e)
    const digits = digitLength(n.i)
    assertDigitsBound(digits)
    assertExponent(n.e)
    return Decimal.#of(n.i, n.e, digits)
  }

  /** A Decimal from parts that are already normalized and within the bounds. */
  static #of(i: bigint, e: number, digits: number): Decimal {
    const d = new Decimal(0n)
    d.#i = i
    d.#e = e
    d.#digits = digits
    return d
  }

  /**
   * The exact sum.
   * @example
   * ```ts
   * new Decimal('0.1').add('0.2').toString() // '0.3'
   * ```
   */
  add(other: DecimalInput): Decimal {
    const b = Decimal.#from(other)
    if (this.#i === 0n) return b
    if (b.#i === 0n) return this
    const e = Math.min(this.#e, b.#e)
    return Decimal.#fromIE(this.#i * pow10(this.#e - e) + b.#i * pow10(b.#e - e), e)
  }

  /**
   * The exact difference.
   * @example
   * ```ts
   * new Decimal('1').subtract('0.9').toString() // '0.1'
   * ```
   */
  subtract(other: DecimalInput): Decimal {
    return this.add(Decimal.#from(other).negate())
  }

  /**
   * The exact product.
   * @example
   * ```ts
   * new Decimal('1.5').multiply('-2').toString() // '-3'
   * ```
   */
  multiply(other: DecimalInput): Decimal {
    const b = Decimal.#from(other)
    return Decimal.#fromIE(this.#i * b.#i, this.#e + b.#e)
  }

  /**
   * This value with the opposite sign.
   * @example
   * ```ts
   * new Decimal('5').negate().toString() // '-5'
   * ```
   */
  negate(): Decimal {
    return Decimal.#of(-this.#i, this.#e, this.#digits)
  }

  /**
   * The absolute value.
   * @example
   * ```ts
   * new Decimal('-1.5').abs().toString() // '1.5'
   * ```
   */
  abs(): Decimal {
    return this.#i < 0n ? this.negate() : this
  }

  /**
   * Orders this value against `other`: -1, 0 or 1.
   * @example
   * ```ts
   * new Decimal('1.10').compare('1.1') // 0
   * new Decimal('-2').compare(1) // -1
   * ```
   */
  compare(other: DecimalInput): -1 | 0 | 1 {
    return compareIE({ i: this.#i, e: this.#e, digits: this.#digits }, Decimal.#operand(other))
  }

  /**
   * True when both are the same number, whatever their written form.
   * @example
   * ```ts
   * new Decimal('2.50').equals('2.5') // true
   * ```
   */
  equals(other: DecimalInput): boolean {
    return this.compare(other) === 0
  }

  /**
   * True when this value is less than `other`.
   * @example
   * ```ts
   * new Decimal('0.1').lessThan('0.2') // true
   * ```
   */
  lessThan(other: DecimalInput): boolean {
    return this.compare(other) < 0
  }

  /**
   * True when this value is less than or equal to `other`.
   * @example
   * ```ts
   * new Decimal('0.2').lessThanOrEqual('0.20') // true
   * ```
   */
  lessThanOrEqual(other: DecimalInput): boolean {
    return this.compare(other) <= 0
  }

  /**
   * True when this value is greater than `other`.
   * @example
   * ```ts
   * new Decimal('1e3').greaterThan(999) // true
   * ```
   */
  greaterThan(other: DecimalInput): boolean {
    return this.compare(other) > 0
  }

  /**
   * True when this value is greater than or equal to `other`.
   * @example
   * ```ts
   * new Decimal('-0').greaterThanOrEqual(0) // true
   * ```
   */
  greaterThanOrEqual(other: DecimalInput): boolean {
    return this.compare(other) >= 0
  }

  /**
   * The canonical string: plain notation while that pads at most 64 zeros, scientific past that
   * (`'1e+65'`, `'1.5e-70'`), so its length follows the significant digits and not the exponent.
   * The constructor reads both forms back.
   * @example
   * ```ts
   * new Decimal('1.50').toString() // '1.5'
   * new Decimal('1e100').toString() // '1e+100'
   * ```
   */
  toString(): string {
    const padding = this.#e > 0 ? this.#e : -this.#e - this.#digits
    if (padding <= MAX_PLAIN_PADDING) return this.toPlainString()
    const digits = absBig(this.#i).toString()
    const fraction = digits.length > 1 ? `.${digits.slice(1)}` : ''
    const exponent = this.#e + digits.length - 1
    const sign = this.#i < 0n ? '-' : ''
    return `${sign}${digits.slice(0, 1)}${fraction}e${exponent < 0 ? '' : '+'}${String(exponent)}`
  }

  /**
   * Plain notation at any magnitude. A short input such as `'1e10000'` expands to 10,001
   * characters, so prefer {@link Decimal.toString} for untrusted values.
   * @example
   * ```ts
   * new Decimal('1e5').toPlainString() // '100000'
   * new Decimal('-1.5e-3').toPlainString() // '-0.0015'
   * ```
   */
  toPlainString(): string {
    const digits = absBig(this.#i).toString()
    const sign = this.#i < 0n ? '-' : ''
    if (this.#e >= 0) return sign + digits + '0'.repeat(this.#e)
    if (-this.#e >= digits.length) {
      return `${sign}0.${'0'.repeat(-this.#e - digits.length)}${digits}`
    }
    return `${sign}${digits.slice(0, this.#e)}.${digits.slice(this.#e)}`
  }

  /** The canonical string, as {@link Decimal.toString}, so `JSON.stringify` keeps every digit. */
  toJSON(): string {
    return this.toString()
  }

  /**
   * Formats the exact value with `Intl.NumberFormat`, which reads decimal strings without going
   * through a `Number`, so digits past 2^53 survive.
   * @throws {RangeError} when the value is beyond `Number.MAX_VALUE`, which `Intl` shows as `∞`,
   * or so close to zero that it rounds to a `Number` zero, which `Intl` may show as `0`.
   * @throws {RangeError} for a malformed locale tag, or a locale list longer than 255 characters
   * joined, which `Intl` canonicalizes in quadratic time.
   * @throws {TypeError} for a locale that is neither a string nor an `Intl.Locale`.
   * @example
   * ```ts
   * new Decimal('12345678901234567.25').toLocaleString('en-US', { maximumFractionDigits: 2 })
   * // '12,345,678,901,234,567.25'
   * ```
   */
  toLocaleString(locales?: Intl.LocalesArgument, options?: Intl.NumberFormatOptions): string {
    const nearest = this.toNumber()
    if (!Number.isFinite(nearest) || (nearest === 0 && this.#i !== 0n)) {
      throw new RangeError('value is outside the range Intl.NumberFormat can show')
    }
    const format = new Intl.NumberFormat(canonicalLocales(locales), options)
    // toString always prints a StringNumericLiteral, which the type cannot express.
    return format.format(this.toString() as Intl.StringNumericLiteral)
  }

  /**
   * The nearest `Number`, read from the coefficient and exponent, so extreme exponents stay cheap.
   * @example
   * ```ts
   * new Decimal('0.1').toNumber() // 0.1
   * new Decimal('1e400').toNumber() // Infinity
   * ```
   */
  toNumber(): number {
    return Number(`${String(this.#i)}e${String(this.#e)}`)
  }

  /**
   * The value as a bigint.
   * @throws {RangeError} when the value has a fractional part.
   * @example
   * ```ts
   * new Decimal('1.2e3').toBigInt() // 1200n
   * ```
   */
  toBigInt(): bigint {
    if (this.#e < 0) throw new RangeError(`${quoteForError(this.toString())} is not an integer`)
    return this.#i * pow10(this.#e)
  }

  /**
   * What `console.log` and `util.inspect` show, such as `Decimal { 1.5 }`. The symbol is the
   * runtime's own inspection hook, read by Node and runtimes compatible with it, not a protocol of
   * this package.
   * @example
   * ```ts
   * console.log(new Decimal('1.50')) // Decimal { 1.5 }
   * ```
   */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `Decimal { ${this.toString()} }`
  }

  /**
   * Throws, so `<`, `+` and `==` cannot silently turn a Decimal into a lossy `Number`. Use
   * {@link Decimal.compare}, {@link Decimal.add} or {@link Decimal.toNumber}.
   * @throws {TypeError} always.
   */
  valueOf(): never {
    throw new TypeError(
      'Decimal cannot be converted to a primitive implicitly; use compare(), toNumber() or toString()'
    )
  }
}
