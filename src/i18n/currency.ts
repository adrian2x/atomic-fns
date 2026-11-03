/**
 * Currency amounts with exact decimal arithmetic and Intl formatting.
 */

import { Decimal } from '../decimal/index.js'
import type { DecimalInput, DivOptions } from '../decimal/index.js'
import { ValueError } from '../globals/errors.js'

/** Runtime accepts decimal strings via ToIntlMathematicalValue (ECMA-402). */
function formatExact(fmt: Intl.NumberFormat, decimalStr: string): string {
  return (fmt.format as (value: string) => string)(decimalStr)
}

function assertFormattable(amount: Decimal): void {
  if (amount.greaterThanMaxValue()) {
    throw new RangeError('amount is outside the formattable range')
  }
}

/**
 * Currency represents a local currency amount formatted with `Intl.NumberFormat`.
 */
export class Currency extends Decimal {
  readonly currency: string
  readonly locale: string
  readonly #numberFormat: Intl.NumberFormat
  readonly #options: Intl.NumberFormatOptions

  /**
   * @param amount Decimal amount.
   * @param currency ISO 4217 currency code.
   * @param locale BCP 47 locale, or NumberFormat options when `opts` is omitted.
   * @param opts NumberFormat options (not mutated).
   */
  constructor(
    amount: DecimalInput,
    currency: string,
    locale?: string | Intl.NumberFormatOptions,
    opts?: Intl.NumberFormatOptions
  ) {
    super(amount)
    const loc = typeof locale === 'string' ? locale : undefined
    const userOpts = typeof locale === 'string' || locale === undefined ? opts : locale
    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currencyDisplay: 'symbol',
      maximumFractionDigits: 20,
      ...userOpts,
      currency
    }
    this.#options = { ...options }
    this.#numberFormat = new Intl.NumberFormat(loc, options)
    const resolved = this.#numberFormat.resolvedOptions()
    this.currency = resolved.currency ?? currency
    this.locale = resolved.locale
  }

  /**
   * Clones this currency, optionally replacing the amount.
   * @param n New amount (default: this).
   */
  override clone(n: DecimalInput = this): Currency {
    return new Currency(n, this.currency, this.locale, this.#options)
  }

  override negated(): Currency {
    return this.clone(super.negated())
  }

  override abs(): Currency {
    return this.clone(super.abs())
  }

  #assertSameCurrency(x: DecimalInput): void {
    if (x instanceof Currency && x.currency !== this.currency) {
      throw new ValueError(`currency mismatch: ${this.currency} vs ${x.currency}`)
    }
  }

  override add(x: DecimalInput): Currency {
    this.#assertSameCurrency(x)
    return this.clone(super.add(x))
  }

  override sub(x: DecimalInput): Currency {
    this.#assertSameCurrency(x)
    return this.clone(super.sub(x))
  }

  override mul(x: DecimalInput): Currency {
    this.#assertSameCurrency(x)
    return this.clone(super.mul(x))
  }

  override div(x: DecimalInput, opts?: DivOptions): Currency {
    this.#assertSameCurrency(x)
    return this.clone(super.div(x, opts))
  }

  override compare(x: DecimalInput): -1 | 0 | 1 {
    this.#assertSameCurrency(x)
    return super.compare(x)
  }

  override lt(x: DecimalInput): boolean {
    this.#assertSameCurrency(x)
    return super.lt(x)
  }

  override lte(x: DecimalInput): boolean {
    this.#assertSameCurrency(x)
    return super.lte(x)
  }

  override gt(x: DecimalInput): boolean {
    this.#assertSameCurrency(x)
    return super.gt(x)
  }

  override gte(x: DecimalInput): boolean {
    this.#assertSameCurrency(x)
    return super.gte(x)
  }

  /**
   * Formats the exact decimal string with the instance NumberFormat.
   * @throws {RangeError} when `|amount| > Number.MAX_VALUE`.
   */
  override toString(): string {
    assertFormattable(this)
    return formatExact(this.#numberFormat, super.toString())
  }

  /** Numeric value from the exact decimal string (not the formatted display). */
  override toNumber(): number {
    return Number(super.toString())
  }

  override toJSON(): string {
    return super.toString()
  }

  /**
   * Formats with optional overrides.
   * @param opts NumberFormat options (not mutated).
   * @param locale Override locale.
   * @throws {RangeError} when `|amount| > Number.MAX_VALUE`.
   */
  format(opts: Intl.NumberFormatOptions = {}, locale?: string): string {
    assertFormattable(this)
    const options: Intl.NumberFormatOptions = { ...this.#options, ...opts }
    return formatExact(new Intl.NumberFormat(locale ?? this.locale, options), super.toString())
  }

  /** Formats with `currencyDisplay: 'name'`. */
  displayName(): string {
    return this.format({ currencyDisplay: 'name' })
  }

  /** Formats with `currencySign: 'accounting'`. */
  accounting(): string {
    return this.format({ currencySign: 'accounting' })
  }

  /**
   * Formats with a maximum fraction digit count.
   * @param digits Maximum fraction digits.
   */
  precision(digits?: number): string {
    return this.format({ maximumFractionDigits: digits })
  }

  override eq(x: DecimalInput): boolean {
    if (x instanceof Currency && x.currency !== this.currency) {
      return false
    }
    return super.eq(x)
  }

  /**
   * Total order for operators `compare`: currency code first, then amount. Never throws.
   * @param o Other value.
   */
  override protocolCompare(o: unknown): number | undefined {
    if (o instanceof Currency) {
      if (this.currency < o.currency) return -1
      if (this.currency > o.currency) return 1
      return super.protocolCompare(o)
    }
    return super.protocolCompare(o)
  }

  /**
   * Equal value and, when `o` is Currency, the same currency code.
   * @param o Other value.
   */
  override protocolEquals(o: unknown): boolean {
    if (o instanceof Currency) {
      return this.currency === o.currency && super.protocolEquals(o)
    }
    return super.protocolEquals(o)
  }
}
