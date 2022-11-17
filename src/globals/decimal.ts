const NUMBER_REGEX = /^(-?)([0-9]+)(\.([0-9]+))?$/

export type TBigNum = number | BigNum

export function Decimal(x) {
  if (typeof x === 'string' || typeof x === 'number') {
    return new BigNum(x)
  }
  return x as BigNum
}

/**
 * BigNum is an implementation of arbitrary-precision arithmetic based on the native `bigint` type.
 */
export class BigNum {
  static PRECISION = 20

  i = 0n
  e = 0

  /**
   * Returns a new `BigNum` instance from the value or `0`.
   * @param {*} value
   * @returns {BigNum}
   */
  constructor(value?) {
    if (value == null) {
      return this
    }

    var result = NUMBER_REGEX.exec(value.toString())

    if (result) {
      //console.log(result);
      // Construct from string if possible
      //this.i = parseInt(result[1] + result[2] + result[4]);
      if (typeof result[2] === 'undefined') result[2] = ''
      if (typeof result[4] === 'undefined') result[4] = ''
      this.i = BigInt(result[1] + result[2] + result[4])
      this.e = result[4] ? -result[4].length : 0
      this._normalize()
    } else if (typeof value === 'number' || value instanceof BigInt) {
      // Conversion to string failed, so construct from number

      var m = 1n
      if (value < 0) {
        value = -value
        m = -1n
      }

      if (value === 0) {
        this.i = 0n
        this.e = 0
      } else {
        // Multiply the number by 10 until it is an integer
        var e = -Math.floor(Math.log10(value))
        if (e > 0) {
          value *= Math.pow(10, e)
        } else {
          e = 0
        }
        while (value != Math.round(value)) {
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
   * Returns a new `BigNum` with the opposite sign of `x`.
   * @param {TBigNum} x
   * @returns {BigNum}
   */
  static negated(x: TBigNum) {
    let dec = Decimal(x)
    var negated = new BigNum()
    negated.i = -dec.i
    negated.e = dec.e
    return negated
  }

  /**
   * Returns a new `BigNum` that has the opposite sign of this `BigNum`.
   * @example
```js
let a = new BigNum('5')
a.minus()  // -5

// or, equivalently:
BigNum.minus(a)  // -5
```
   * @returns {BigNum}
   */
  negated() {
    return BigNum.negated(this)
  }

  /**
   * Returns a new `BigNum` that is the sum of `a` and `b`.
   * @param {TBigNum} a
   * @param {TBigNum} b
   * @returns {BigNum}
   */
  static add(a: TBigNum, b: TBigNum) {
    a = Decimal(a)
    b = Decimal(b)
    // a+b = a.i * 10^a.e + b.i * 10^b.e

    // a+b = ( a.i * 10^(a.e-b.e) + b.i ) * 10^b.e

    var a_plus_b: BigNum

    // Order arguments so that a.e >= b.e
    if (a.e < b.e) {
      var c = a
      a = b
      b = c
    }

    var a_tens = BigNum.exp(a.i, a.e - b.e)
    a_plus_b = new BigNum()
    a_plus_b.i = a_tens + b.i
    a_plus_b.e = b.e

    a_plus_b._normalize()
    return a_plus_b
  }

  /**
   * Returns a new `BigNum` that is the sum of this and `x`.
   * @param {TBigNum} x
   * @example
```js
let a = new BigNum('50000000000')
let b = new BigNum('0.000000005')
a.add(b)  // 50000000000.000000005

// or, equivalently:
BigNum.add(a, b)  // 50000000000.000000005
```
   * @returns {BigNum}
   */
  add(x: TBigNum) {
    return BigNum.add(this, x)
  }

  /**
   * Subtracts `b` from `a`.
   * @param {TBigNum} a
   * @param {TBigNum} b
   * @returns {BigNum}
   */
  static sub(a: TBigNum, b: TBigNum) {
    return BigNum.add(a, BigNum.negated(b))
  }

  /**
   * Returns a new `BigNum` that is the difference between this and `x`.
   * @param {TBigNum} x
   * @example
```js
let a = new BigNum('1')
let b = new BigNum('0.0000000000000000001')
a.sub(b)  // 0.9999999999999999999

// or, equivalently:
BigNum.sub(a, b)  // 0.9999999999999999999
```
   * @returns {BigNum}
   */
  sub(x: TBigNum) {
    return BigNum.sub(this, x)
  }

  /**
   * Returns a new `BigNum` that is the product of `a` and `b`.
   * @param {TBigNum} a
   * @param {TBigNum} b
   * @returns {BigNum}
   */
  static mul(a: TBigNum, b: TBigNum) {
    ;(a = Decimal(a)), (b = Decimal(b))
    // a * b = (a.i * b.i) * 10^(a.e + b.e)

    var a_times_b = new BigNum()
    a_times_b.i = a.i * b.i
    a_times_b.e = a.e + b.e

    a_times_b._normalize()
    return a_times_b
  }

  /**
   * Returns a new `BigNum` that is the product of this and `x`.
   * @param {TBigNum} x
   * @example
```js
let a = new BigNum('0.0000000000000000000025')
let b = new BigNum('400000000000000000000')
a.mul(b)  // 1

// or, equivalently:
BigNum.mul(a, b)  // 1
```
   * @returns {BigNum}
   */
  mul(x: TBigNum) {
    return BigNum.mul(this, x)
  }

  /**
   * Returns a new `BigNum` that is the quotient of `a` and `b`.
   * @param {TBigNum} a
   * @param {TBigNum} b
   * @returns {BigNum}
   */
  static div(a: TBigNum, b: TBigNum) {
    ;(a = Decimal(a)), (b = Decimal(b))
    // We need to increase the number of digits of a and b so that a / b will have the desired precision.

    // In order for the integer quotient to have the correct precision, a.e - b.e must be greater than that precision.
    // So we need only to increase a.e.
    // TODO: Revisit the value of increaseA. Is it correct in every circumstance?
    var increaseA = Math.max(BigNum.precision - (a.e + b.e), 0)

    var a_increased = new BigNum()
    a_increased.i = BigNum.exp(a.i, increaseA)

    var quotient = new BigNum()

    quotient.i = a_increased.i / b.i
    quotient.e = a.e - b.e - increaseA

    // No need to truncate since we already increased the number of digits before dividing
    quotient._normalize()
    return quotient
  }

  /**
   * Returns a new `BigNum` that is the quotient of this and `x`
   * @param {TBigNum} x
   * @example
```js
let a = new BigNum('1')
let b = new BigNum('3')
a.div(b)  // 0.333333333333333333333333333333

// or, equivalently:
BigNum.div(a, b)  // 0.333333333333333333333333333333
```
   * @returns {BigNum}
   */
  div(x: TBigNum) {
    return BigNum.div(this, x)
  }

  /**
   * Returns the square root of this `BigNum`.
   * @returns {TBigNum}
   */
  sqrt() {
    BigNum.PRECISION++

    // Let the guess value be 10^(e/2), where e is this.e
    var x = new BigNum()
    x.i = 1n
    x.e = Math.floor(this.e / 2)
    var onehalf = new BigNum('0.5')

    var xt = x.clone()
    xt._truncate()
    xt._normalize()
    var lastxt

    var i
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
    BigNum.PRECISION--
    xt._truncate()
    xt._normalize()

    return xt
  }

  clone() {
    var a = new BigNum()
    a.i = this.i
    a.e = this.e
    return a
  }

  /**
   * Returns a BigInt that is equal to `i` times `10^e`
   * @param {bigint} i
   * @param {number} e
   * @returns {bigint}
   */
  static exp(i: bigint, e: number) {
    // TODO: Make this better
    // The implementation is faster than 10n ** BigInt(e). But could we make it faster still?
    var ii = i
    for (var j = 0; j < e; j++) {
      ii *= 10n
    }
    return ii
  }

  /**
   * Remove zeroes in the least-significant digit of this `BigNum`
   */
  _normalize() {
    while (this.i % 10n === 0n && this.i !== 0n) {
      this.i /= 10n
      this.e++
    }
    return this
  }

  /**
   * Truncate this `BigNum` to the configured precision
   */
  _truncate() {
    // TODO: Make this better
    // TODO: Rounding
    var trunc = -this.e - BigNum.PRECISION
    if (trunc > 0) {
      this.i /= 10n ** BigInt(trunc - 1)
      this.e += trunc

      var nextDigit = this.i % 10n
      if (nextDigit >= 5) {
        this.i += 10n
      }

      this.i /= 10n
    }

    // while(-this.e > `BigNum`._precision) {
    //   this.i /= 10n;
    //   this.e++;
    // }

    return this
  }

  /**
   * Returns a string representation of this decimal.
   * @returns {BigNum}
   */
  toString() {
    var s = this.i.toString()
    var m = ''
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
   * Converts this decimal to the Number value
   * @returns {number}
   */
  toNumber() {
    return Number(BigNum.prototype.toString.call(this))
  }

  static get precision() {
    return BigNum.PRECISION
  }

  static set precision(value) {
    BigNum.PRECISION = value
  }

  /**
   * Returns `true` if this value is equal to the value of `x`, otherwise `false`.
   * @param {BigNum} x other
   * @returns {boolean}
   */
  eq(x: BigNum) {
    return this.i === x.i && this.e === x.e
  }

  /**
   * Returns `true` if this value is less than the value of `x`, otherwise `false`.
   * @param {BigNum} x
   * @returns {boolean}
   */
  lt(x: BigNum) {
    if (this.i < x.i) return true
    if (this.i > x.i) return false
    return this.e < x.e
  }

  /**
   * Returns a comparison value representing the ordering of this value in respect to `x`.
   *   * `-1` if this < x
   *   * `1` if this > x
   *   * `0` if this == x
   * @param {TBigNum} x
   * @returns {number}
   */
  compare(x: BigNum) {
    if (this.eq(Decimal(x))) return 0
    if (this.lt(Decimal(x))) return -1
    return 1
  }

  /**
   * Returns `true` if this value is greater than the value of `x`, otherwise `false`.
   * @param {TBigNum} x
   * @returns {boolean}
   */
  gt(x: BigNum) {
    return this.compare(x) > 0
  }

  /**
   * Returns `true` if this value is less than or equal to the value of `x`, otherwise `false`.
   * @param {TBigNum} x
   * @returns {boolean}
   */
  lte(x: BigNum) {
    return this.compare(x) <= 0
  }

  /**
   * Returns `true` if this value is greater than or equal to the value of `x`, otherwise `false`.
   * @param {TBigNum} x
   * @returns {boolean}
   */
  gte(x: BigNum) {
    return this.compare(x) >= 0
  }
}
