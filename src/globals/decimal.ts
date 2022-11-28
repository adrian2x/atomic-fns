const NUMBER_REGEX = /^(-?)([0-9]+)(\.([0-9]+))?$/

/**
 * Casts the given value as a {@link Decimal}.
 */
export function decimal(x) {
  return new Decimal(x)
}

/**
 * `Decimal` provides support for correct rounded floating point arithmetic, unlike the standard Number type. It also supports user-defined precision (default is 20 decimal places) which can be as large as needed.
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
  constructor(value?) {
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
a.minus()  // -5
```
   * @returns {Decimal}
   */
  negated() {
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
  add(x) {
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
  sub(x) {
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
  mul(x) {
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
  div(x) {
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
  sqrt() {
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
  clone() {
    const a = new Decimal()
    a.i = this.i
    a.e = this.e
    return a
  }

  /**
   * Remove zeroes in the least-significant digit of this `Decimal`
   */
  private _normalize() {
    while (this.i % 10n === 0n && this.i !== 0n) {
      this.i /= 10n
      this.e++
    }
    return this
  }

  /**
   * Truncate this `Decimal` to the configured precision
   */
  private _truncate() {
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
   * @returns {Decimal}
   */
  toString() {
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

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toString()
  }

  /**
   * Converts this decimal to the `Number` value
   * @returns {number}
   */
  toNumber() {
    return Number(Decimal.prototype.toString.call(this))
  }

  static get precision() {
    return Decimal.PRECISION
  }

  static set precision(value) {
    Decimal.PRECISION = value
  }

  /**
   * Returns `true` if this value is equal to the value of `x`, otherwise `false`.
   * @param {*} x other
   * @returns {boolean}
   */
  eq(x) {
    const other = decimal(x)
    return this.i === other.i && this.e === other.e
  }

  /**
   * Returns `true` if this value is less than the value of `x`, otherwise `false`.
   * @param {*} x
   * @returns {boolean}
   */
  lt(x) {
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
  compare(x) {
    if (this.eq(x)) return 0
    if (this.lt(x)) return -1
    return 1
  }

  /**
   * Returns `true` if this value is greater than the value of `x`, otherwise `false`.
   * @param {*} x
   * @returns {boolean}
   */
  gt(x) {
    return this.compare(x) > 0
  }

  /**
   * Returns `true` if this value is less than or equal to the value of `x`, otherwise `false`.
   * @param {*} x
   * @returns {boolean}
   */
  lte(x) {
    return this.compare(x) <= 0
  }

  /**
   * Returns `true` if this value is greater than or equal to the value of `x`, otherwise `false`.
   * @param {*} x
   * @returns {boolean}
   */
  gte(x) {
    return this.compare(x) >= 0
  }
}

/** Returns a BigInt that is equal to `i` times `10^e` */
function exp(i: bigint, e: number) {
  // TODO: Make this better
  // The implementation is faster than 10n ** BigInt(e). But could we make it faster still?
  let ii = i
  for (let j = 0; j < e; j++) {
    ii *= 10n
  }
  return ii
}
