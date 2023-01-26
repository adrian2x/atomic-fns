import { defaults } from '../collections/index.js'
import { isObject } from '../globals/index.js'
import { Decimal } from '../decimal/index.js'

/**
 * Currency represents a local currency amount that can be formatted using the `Intl` apis.
 */
export class Currency extends Decimal {
  private readonly locale: string
  private readonly currency: string
  private readonly numberFormat: Intl.NumberFormat
  private readonly options: Intl.NumberFormatOptions = {
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
    const systemLocale = new Intl.NumberFormat(locale, defaults(opts, { currency }, this.options))
    const resolved = systemLocale.resolvedOptions()
    this.numberFormat = systemLocale
    this.options.currency = currency
    this.currency = resolved.currency
    this.locale = resolved.locale
  }

  // @ts-expect-error overrides
  clone(n) {
    return new Currency(n, this.currency, this.locale, this.options)
  }

  // @ts-expect-error overrides
  negated() {
    const n = super.negated.call(this)
    return this.clone(n)
  }

  // @ts-expect-error overrides
  add(x) {
    const n = super.add.call(this.toDecimal(), x)
    return this.clone(n)
  }

  // @ts-expect-error overrides
  sub(x) {
    const n = super.sub.call(this.toDecimal(), x)
    return this.clone(n)
  }

  // @ts-expect-error overrides
  div(x) {
    const n = super.div.call(this.toDecimal(), x)
    return this.clone(n)
  }

  // @ts-expect-error overrides
  mul(x) {
    const n = super.mul.call(this.toDecimal(), x)
    return this.clone(n)
  }

  toDecimal() {
    return super.clone.call(this)
  }

  toString() {
    const number = this.toNumber()
    return this.numberFormat.format(number)
  }

  format(opts: Intl.NumberFormatOptions = {}, locale?: string) {
    const number = this.toNumber()
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
    return super.eq.call(this, x)
  }
}
