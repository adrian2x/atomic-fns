import { defaults } from '../collections/index.js'
import { isObject } from '../globals/index.js'
import { Decimal } from '../decimal/index.js'

/** `Intl` options that set the digits shown. Some reject each other, so they replace as a group. */
const DIGIT_OPTION =
  /^(minimum|maximum)(Fraction|Significant)Digits$|^rounding(Increment|Priority)$/

/**
 * Currency represents a local currency amount that can be formatted using the `Intl` apis.
 */
export class Currency extends Decimal {
  private readonly locale: string
  private readonly currency: string
  private readonly numberFormat: Intl.NumberFormat
  private readonly overrides: Intl.NumberFormatOptions
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
    const systemLocale = new Intl.NumberFormat(
      locale,
      defaults({}, opts, { currency }, this.options)
    )
    const resolved = systemLocale.resolvedOptions()
    this.numberFormat = systemLocale
    this.options.currency = currency
    this.overrides = defaults({}, opts)
    this.currency = resolved.currency
    this.locale = resolved.locale
  }

  // @ts-expect-error overrides
  clone(n: Currency): Currency {
    return new Currency(n === undefined ? this : n, this.currency, this.locale, this.overrides)
  }

  // @ts-expect-error overrides
  negated(): Currency {
    const n = super.negated.call(this)
    return this.clone(n)
  }

  // @ts-expect-error overrides
  add(x: Currency | string): Currency {
    const n = super.add.call(this.toDecimal(), x)
    return this.clone(n)
  }

  // @ts-expect-error overrides
  sub(x: Currency | string): Currency {
    const n = super.sub.call(this.toDecimal(), x)
    return this.clone(n)
  }

  // @ts-expect-error overrides
  div(x: Currency | Decimal | string | number): Currency {
    const n = super.div.call(this.toDecimal(), x)
    return this.clone(n)
  }

  // @ts-expect-error overrides
  mul(x: Currency | Decimal): Currency {
    const n = super.mul.call(this.toDecimal(), x)
    return this.clone(n)
  }

  toDecimal(): Decimal {
    return super.clone.call(this)
  }

  /** `Intl` reads a decimal string exactly, while a `Number` past 2^53 has lost digits. */
  private formattable(): number | Intl.StringNumericLiteral {
    const number = this.toNumber()
    if (Math.abs(number) <= Number.MAX_SAFE_INTEGER) return number
    return Decimal.prototype.toString.call(this) as Intl.StringNumericLiteral
  }

  toString(): string {
    return this.numberFormat.format(this.formattable())
  }

  format(opts: Intl.NumberFormatOptions = {}, locale?: string): string {
    const overrides = { ...this.overrides }
    if (Object.keys(opts).some((key) => DIGIT_OPTION.test(key) && opts[key] !== undefined)) {
      for (const key in overrides) if (DIGIT_OPTION.test(key)) delete overrides[key]
    }
    opts = defaults({}, opts, overrides, this.options)
    return new Intl.NumberFormat(locale ?? this.locale, opts).format(this.formattable())
  }

  displayName(): string {
    return this.format({ currencyDisplay: 'name' })
  }

  accounting(): string {
    return this.format({ currencySign: 'accounting' })
  }

  precision(digits?: number): string {
    return this.format({ maximumFractionDigits: digits })
  }

  eq(x: any): boolean {
    if (x?.currency && x.currency !== this.currency) {
      return false
    }
    return super.eq.call(this, x)
  }
}
