/**
 * Currency amounts with exact decimal arithmetic and Intl formatting.
 */

import { Decimal } from '../decimal/index.js'
import type { DecimalInput, DivOptions } from '../decimal/index.js'

/** Runtime accepts decimal strings via ToIntlMathematicalValue (ECMA-402). */
function formatExact(fmt: Intl.NumberFormat, decimalStr: string): string {
  return (fmt.format as (value: string) => string)(decimalStr)
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

  override add(x: DecimalInput): Currency {
    return this.clone(super.add(x))
  }

  override sub(x: DecimalInput): Currency {
    return this.clone(super.sub(x))
  }

  override mul(x: DecimalInput): Currency {
    return this.clone(super.mul(x))
  }

  override div(x: DecimalInput, opts?: DivOptions): Currency {
    return this.clone(super.div(x, opts))
  }

  /**
   * Formats the exact decimal string with the instance NumberFormat.
   */
  override toString(): string {
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
   */
  format(opts: Intl.NumberFormatOptions = {}, locale?: string): string {
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
   * Value first; equal values compare by currency code when both are Currency.
   * @param o Other value.
   */
  override protocolCompare(o: unknown): number | undefined {
    if (o instanceof Currency) {
      const valueCmp = super.protocolCompare(o)
      if (valueCmp === undefined) return undefined
      if (valueCmp !== 0) return valueCmp
      return this.currency < o.currency ? -1 : this.currency > o.currency ? 1 : 0
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
