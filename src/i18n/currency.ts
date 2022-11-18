import { defaults } from '../collections/index.js'
import { isObject } from '../globals/index.js'
import { Decimal, BigNum } from '../globals/decimal.js'

/**
 * Currency represents a local currency amount that can be formatted using the `Intl` apis.
 */
export class Currency extends BigNum {
  locale: string
  currency: string
  numberFormat: Intl.NumberFormat
  options: Intl.NumberFormatOptions = {
    style: 'currency',
    currencyDisplay: 'symbol',
    maximumFractionDigits: 20
  }

  constructor(amount, currency: string, locale?: string, opts: Intl.NumberFormatOptions = {}) {
    super(amount)
    if (isObject(locale)) {
      opts = locale as any
      locale = undefined
    }
    let systemLocale = new Intl.NumberFormat(locale, defaults(opts, { currency }, this.options))
    const resolved = systemLocale.resolvedOptions()
    this.numberFormat = systemLocale
    this.options.currency = currency
    this.currency = resolved.currency
    this.locale = resolved.locale
  }

  // @ts-expect-error overrides
  clone(n) {
    return new Currency(n, this.currency, this.locale)
  }

  // @ts-expect-error overrides
  negated() {
    let n = BigNum.negated(this as any)
    return this.clone(n)
  }

  // @ts-expect-error overrides
  add(x) {
    let n = BigNum.add(this.toDecimal(), x)
    return this.clone(n)
  }

  // @ts-expect-error overrides
  sub(x) {
    let n = BigNum.sub(this.toDecimal(), x)
    return this.clone(n)
  }

  // @ts-expect-error overrides
  div(x) {
    let n = BigNum.div(this.toDecimal(), x)
    return this.clone(n)
  }

  // @ts-expect-error overrides
  mul(x) {
    let n = BigNum.mul(this.toDecimal(), x)
    return this.clone(n)
  }

  toDecimal() {
    return BigNum.prototype.clone.call(this)
  }

  toString() {
    let number = this.toNumber()
    return this.numberFormat.format(number)
  }

  format(opts: Intl.NumberFormatOptions = {}, locale?: string) {
    let number = this.toNumber()
    opts = defaults(opts, this.options)
    return new Intl.NumberFormat(locale ?? this.locale, opts).format(number)
  }

  displayName() {
    return this.format({ currencyDisplay: 'name' })
  }

  accounting() {
    return this.format({ currencySign: 'accounting' })
  }

  precision(digits?: number) {
    return this.format({ maximumFractionDigits: digits })
  }

  eq(x) {
    if (x?.currency && x.currency !== this.currency) {
      return false
    }
    return BigNum.prototype.eq.call(this, x)
  }
}
