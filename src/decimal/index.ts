/**
 * `Decimal` provides support for correct rounded floating point arithmetic.
 *
 * @module decimal
 */

import { protocol } from '../operators/protocol.js'

const NUMBER_REGEX = /^(-?)([0-9]+)(\.([0-9]+))?$/

/**
 * Casts the given value as a {@link Decimal}.
 */
export function decimal(x): Decimal {
  return new Decimal(x)
}

function normalizeIE(i: bigint, e: number): { i: bigint; e: number } {
  if (i === 0n) return { i: 0n, e: 0 }
  while (i % 10n === 0n) {
    i /= 10n
    e++
  }
  return { i, e }
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
    const scaled = ai * 10n ** BigInt(ae - be)
    return scaled < bi ? -1 : scaled > bi ? 1 : 0
  }
  const scaled = bi * 10n ** BigInt(be - ae)
  return ai < scaled ? -1 : ai > scaled ? 1 : 0
}

/**
 * `Decimal` provides support for correct rounded floating point arithmetic, unlike the standard
 * `Number` type. It also supports user-defined precision (default is 20 decimal places), which
 * can be as large as needed.
 */
export class Decimal {
  static PRECISION = 20
  private i = 0n
  private e = 0

  /**
   * Returns a new `Decimal` instance from the value or `0`.
   * @param {*} value
   * @returns {Decimal}
   */
  constructor(value?: any) {
    if (value == null) {
      return this
    }

    // Check if value is a Decimal like
    if (typeof value?.i === 'bigint' && typeof value.e === 'number') {
      this.i = value.i
      this.e = value.e
      this._normalize()
      return this
    }

    const result = NUMBER_REGEX.exec(value.toString())

    if (result) {
      // console.log(result);
      // Construct from string if possible
      // this.i = parseInt(result[1] + result[2] + result[4]);
      if (typeof result[2] === 'undefined') result[2] = ''
      if (typeof result[4] === 'undefined') result[4] = ''
      this.i = BigInt(result[1] + result[2] + result[4])
      this.e = result[4] ? -result[4].length : 0
      this._normalize()
    } else {
      // Conversion to string failed, so construct from number
      let m = 1n
      if (value < 0) {
        value = -value
        m = -1n
      }

      if (value === 0) {
        this.i = 0n
        this.e = 0
      } else {
        // Multiply the number by 10 until it is an integer
        let e = -Math.floor(Math.log10(value))
        if (e > 0) {
          value *= Math.pow(10, e)
        } else {
          e = 0
        }
        while (value !== Math.round(value)) {
          e++
          value *= 10
        }
        // Divide the number by 10 until the one's digit is non-zero
        while (value % 10 === 0 && value > 0) {
          e--
          value /= 10
        }
        value = BigInt(value)
        this.i = value * m
        this.e = -e
      }
    }
  }

  /**
   * Returns a new `Decimal` that has the opposite sign of this `Decimal`.
   * @example
```js
let a = decimal('5')
a.negated()  // -5
```
   * @returns {Decimal}
   */
  negated(): Decimal {
    const negated = new Decimal()
    negated.i = -this.i
    negated.e = this.e
    return negated
  }

  /**
   * Returns a new `Decimal` that is the sum of this and `x`.
   * @param x
   * @example
```js
let a = decimal('50000000000')
let b = decimal('0.000000005')
a.add(b)  // 50000000000.000000005
```
   * @returns {Decimal}
   */
  add(x): Decimal {
    let a = new Decimal(this)
    let b = new Decimal(x)
    // a+b = a.i * 10^a.e + b.i * 10^b.e

    // a+b = ( a.i * 10^(a.e-b.e) + b.i ) * 10^b.e

    const result = new Decimal()

    // Order arguments so that a.e >= b.e
    if (a.e < b.e) {
      const c = a
      a = b
      b = c
    }

    const intPart = exp(a.i, a.e - b.e)
    result.i = intPart + b.i
    result.e = b.e

    result._normalize()
    return result
  }

  /**
   * Returns a new `Decimal` that is the difference between this and `x`.
   * @param x
   * @example
```js
let a = decimal('1')
let b = decimal('0.0000000000000000001')
a.sub(b)  // 0.9999999999999999999
```
   * @returns {Decimal}
   */
  sub(x): Decimal {
    return this.add(decimal(x).negated())
  }

  /**
   * Returns a new `Decimal` that is the product of this and `x`.
   * @param x
   * @example
```js
let a = decimal('0.0000000000000000000025')
let b = decimal('400000000000000000000')
a.mul(b)  // 1
```
   * @returns {Decimal}
   */
  mul(x): Decimal {
    const a = new Decimal(this)
    const b = new Decimal(x)
    // a * b = (a.i * b.i) * 10^(a.e + b.e)

    const result = new Decimal()
    result.i = a.i * b.i
    result.e = a.e + b.e

    result._normalize()
    return result
  }

  /**
   * Returns a new `Decimal` that is the quotient of this and `x`
   * @param x
   * @example
```js
let a = decimal('1')
let b = decimal('3')
a.div(b)  // 0.333333333333333333333333333333
```
   * @returns {Decimal}
   */
  div(x: Decimal | string | number): Decimal {
    const a = new Decimal(this)
    const b = new Decimal(x)
    // We need to increase the number of digits of a and b so that a / b will have the desired precision.

    // In order for the integer quotient to have the correct precision, a.e - b.e must be greater than that precision.
    // So we need only to increase a.e.
    // TODO: Revisit the value of increaseA. Is it correct in every circumstance?
    const increaseA = Math.max(Decimal.precision - (a.e + b.e), 0)

    const intIncrease = new Decimal()
    intIncrease.i = exp(a.i, increaseA)

    const quotient = new Decimal()

    quotient.i = intIncrease.i / b.i
    quotient.e = a.e - b.e - increaseA

    // No need to truncate since we already increased the number of digits before dividing
    quotient._normalize()
    return quotient
  }

  /**
   * Returns the square root of this `Decimal`.
   * @returns {TDecimal}
   */
  sqrt(): Decimal {
    Decimal.PRECISION++

    // Let the guess value be 10^(e/2), where e is this.e
    let x = new Decimal()
    x.i = 1n
    x.e = Math.floor(this.e / 2)
    const onehalf = new Decimal('0.5')

    let xt = x.clone()
    xt._truncate()
    xt._normalize()
    let lastxt

    let i
    for (i = 0; i < 100; i++) {
      lastxt = xt

      x = this.div(x).add(x).mul(onehalf)
      xt = x.clone()
      xt._truncate()
      xt._normalize()
      if (xt.i === lastxt.i && xt.e === lastxt.e) break
    }
    if (i >= 100) {
      console.log('Warning: sqrt exceeded maximum iterations. (Did it enter a cycle?)')
    }
    Decimal.PRECISION--
    xt._truncate()
    xt._normalize()

    return xt
  }

  /** Returns a new copy of this Decimal value. */
  clone(): Decimal {
    const a = new Decimal()
    a.i = this.i
    a.e = this.e
    return a
  }

  /**
   * Remove zeroes in the least-significant digit of this `Decimal`
   */
  private _normalize(): this {
    while (this.i % 10n === 0n && this.i !== 0n) {
      this.i /= 10n
      this.e++
    }
    return this
  }

  /**
   * Truncate this `Decimal` to the configured precision
   */
  private _truncate(): this {
    // TODO: Make this better
    // TODO: Rounding
    const trunc = -this.e - Decimal.PRECISION
    if (trunc > 0) {
      this.i /= 10n ** BigInt(trunc - 1)
      this.e += trunc

      const nextDigit = this.i % 10n
      if (nextDigit >= 5) {
        this.i += 10n
      }

      this.i /= 10n
    }

    // while(-this.e > Decimal.PRECISION) {
    //   this.i /= 10n;
    //   this.e++;
    // }

    return this
  }

  /**
   * Returns a string representation of this decimal.
   */
  toString(): string {
    let s = this.i.toString()
    let m = ''
    if (s[0] === '-') {
      s = s.substring(1, s.length)
      m = '-'
    }

    if (this.e > 0) {
      return m + s + '0'.repeat(this.e)
    } else if (this.e < 0) {
      if (-this.e >= s.length) {
        return m + '0.' + '0'.repeat(-this.e - s.length) + s
      }
      return m + s.slice(0, s.length + this.e) + '.' + s.slice(s.length + this.e, s.length)
    } else {
      return m + s
    }
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this.toString()
  }

  /**
   * Converts this decimal to the `Number` value
   * @returns {number}
   */
  toNumber(): number {
    return Number(Decimal.prototype.toString.call(this))
  }

  static get precision(): number {
    return Decimal.PRECISION
  }

  static set precision(value) {
    Decimal.PRECISION = value
  }

  /** Exact-binary / Decimal / bigint compare used by the symbol protocol (F9b). */
  protocolCompare(o: unknown): number | undefined {
    if (o instanceof Decimal) return compareIE(this.i, this.e, o.i, o.e)
    if (typeof o === 'bigint') return compareIE(this.i, this.e, o, 0)
    if (typeof o === 'number') {
      if (Number.isNaN(o)) return undefined
      if (o === Infinity) return -1
      if (o === -Infinity) return 1
      if (!Number.isFinite(o)) return undefined
      const exact = toExact(o)
      return compareIE(this.i, this.e, exact.i, exact.e)
    }
    return undefined
  }

  protocolEquals(o: unknown): boolean {
    return this.protocolCompare(o) === 0
  }

  /**
   * Returns `true` if this value is equal to the value of `x`, otherwise `false`.
   * @param {*} x other
   * @returns {boolean}
   */
  eq(x: any): boolean {
    if (typeof x === 'number') return this.protocolEquals(x)
    const other = decimal(x)
    return this.i === other.i && this.e === other.e
  }

  /**
   * Returns `true` if this value is less than the value of `x`, otherwise `false`.
   * @param {*} x
   * @returns {boolean}
   */
  lt(x): boolean {
    if (typeof x === 'number') {
      const r = this.protocolCompare(x)
      if (r === undefined) throw new TypeError('cannot compare Decimal with NaN')
      return r < 0
    }
    const other = decimal(x)
    if (this.e === other.e) return this.i < other.i
    const e = this.e - other.e
    if (e > 0) {
      return exp(this.i, e) < other.i
    }
    return this.i < exp(other.i, -e)
  }

  /**
   * Returns a comparison value representing the ordering of this value in respect to `x`.
   *   * `-1` if this < x
   *   * `1` if this > x
   *   * `0` if this == x
   * @param {*} x
   * @returns {number}
   */
  compare(x): 0 | 1 | -1 {
    if (typeof x === 'number') {
      const r = this.protocolCompare(x)
      if (r === undefined) throw new TypeError('cannot compare Decimal with NaN')
      return r < 0 ? -1 : r > 0 ? 1 : 0
    }
    if (this.eq(x)) return 0
    if (this.lt(x)) return -1
    return 1
  }

  /**
   * Returns `true` if this value is greater than the value of `x`, otherwise `false`.
   * @param {*} x
   * @returns {boolean}
   */
  gt(x): boolean {
    if (typeof x === 'number') {
      const r = this.protocolCompare(x)
      if (r === undefined) throw new TypeError('cannot compare Decimal with NaN')
      return r > 0
    }
    return this.compare(x) > 0
  }

  /**
   * Returns `true` if this value is less than or equal to the value of `x`, otherwise `false`.
   * @param {*} x
   * @returns {boolean}
   */
  lte(x): boolean {
    if (typeof x === 'number') {
      const r = this.protocolCompare(x)
      if (r === undefined) throw new TypeError('cannot compare Decimal with NaN')
      return r <= 0
    }
    return this.compare(x) <= 0
  }

  /**
   * Returns `true` if this value is greater than or equal to the value of `x`, otherwise `false`.
   * @param {*} x
   * @returns {boolean}
   */
  gte(x): boolean {
    if (typeof x === 'number') {
      const r = this.protocolCompare(x)
      if (r === undefined) throw new TypeError('cannot compare Decimal with NaN')
      return r >= 0
    }
    return this.compare(x) >= 0
  }
}

Object.defineProperty(Decimal.prototype, protocol.rank, {
  get: () => 1,
  enumerable: false,
  configurable: true
})
Object.defineProperty(Decimal.prototype, protocol.compare, {
  value: function (this: Decimal, o: unknown) {
    return this.protocolCompare(o)
  },
  enumerable: false,
  configurable: true
})
Object.defineProperty(Decimal.prototype, protocol.equals, {
  value: function (this: Decimal, o: unknown) {
    return this.protocolEquals(o)
  },
  enumerable: false,
  configurable: true
})

/** Returns a BigInt that is equal to `i` times `10^e` */
function exp(i: bigint, e: number): bigint {
  // TODO: Make this better
  // The implementation is faster than 10n ** BigInt(e). But could we make it faster still?
  let ii = i
  for (let j = 0; j < e; j++) {
    ii *= 10n
  }
  return ii
}
