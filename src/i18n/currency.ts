/**
 * Currency amounts with exact decimal arithmetic and Intl formatting.
 */

import { Decimal } from '../decimal/index.js'
import type { DecimalInput, DivOptions, RoundingMode } from '../decimal/index.js'
import { assertSameCurrency } from '../internal/rank1.js'
import { protocol } from '../operators/protocol.js'
import { canonicalLocales } from './format.js'

const EXACT_FRACTION_DIGITS = 20

/** Runtime accepts decimal strings via ToIntlMathematicalValue (ECMA-402). */
function formatExact(fmt: Intl.NumberFormat, decimalStr: string): string {
  return (fmt.format as (value: string) => string)(decimalStr)
}

function assertFormattable(amount: Decimal): void {
  if (amount.greaterThanMaxValue()) {
    throw new RangeError('amount is outside the formattable range')
  }
}

/** True unless `options` already say how much of the amount to show. */
function showsExactDigits(options: Intl.NumberFormatOptions): boolean {
  return (
    !('maximumFractionDigits' in options) &&
    options.minimumSignificantDigits === undefined &&
    options.maximumSignificantDigits === undefined &&
    (options.roundingIncrement ?? 1) === 1 &&
    (options.notation ?? 'standard') === 'standard'
  )
}

function numberFormatOptions(options: Intl.NumberFormatOptions): Intl.NumberFormatOptions {
  if (!showsExactDigits(options)) return options
  const least = options.minimumFractionDigits ?? 0
  return { ...options, maximumFractionDigits: Math.max(EXACT_FRACTION_DIGITS, least) }
}

/** `stored` under `overrides`, where one fraction bound replaces the stored other bound. */
function overriddenOptions(
  stored: Intl.NumberFormatOptions,
  overrides: Intl.NumberFormatOptions
): Intl.NumberFormatOptions {
  const options = { ...stored, ...overrides }
  if (!('minimumFractionDigits' in overrides) && 'maximumFractionDigits' in overrides) {
    delete options.minimumFractionDigits
  }
  if (!('maximumFractionDigits' in overrides) && 'minimumFractionDigits' in overrides) {
    delete options.maximumFractionDigits
  }
  return options
}

/**
 * Currency represents a local currency amount formatted with `Intl.NumberFormat`.
 * Display keeps the amount's own digits, up to 20 fraction digits, instead of rounding to the
 * currency's minor unit: `new Currency(1.5, 'JPY')` shows `¥1.5` and `0.1 + 0.2` dollars show
 * `$0.30000000000000004`. Digits past the 20th round away (`1e-21` dollars show `$0.00`, though
 * the amount stays exact). Use {@link Currency.precision} or {@link Currency.round} for minor units.
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
    canonicalLocales(loc)
    const userOpts = typeof locale === 'string' || locale === undefined ? opts : locale
    this.#options = { style: 'currency', currencyDisplay: 'symbol', ...userOpts, currency }
    this.#numberFormat = new Intl.NumberFormat(loc, numberFormatOptions(this.#options))
    const resolved = this.#numberFormat.resolvedOptions()
    this.currency = resolved.currency ?? currency.toUpperCase()
    this.locale = resolved.locale
  }

  /** ISO 4217 code for rank-1 unit ordering and equality. */
  get [protocol.unit](): string {
    return this.currency
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

  /** Unit check via `protocol.unit` so foreign library copies and fakes are covered. */
  #assertSameCurrency(x: DecimalInput): void {
    assertSameCurrency(this, x)
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

  /**
   * Rounds the amount and keeps the unit. The mode defaults to half-even, unlike the half-expand
   * display rounding of {@link Currency.precision}: `0.125` rounds to `0.12` here and shows as
   * `$0.13` there.
   * @param precision Fractional digits (may be negative).
   * @param rounding Rounding mode (default halfEven).
   */
  override round(precision: number, rounding?: RoundingMode): Currency {
    return this.clone(super.round(precision, rounding))
  }

  override sqrt(opts?: DivOptions): Currency {
    return this.clone(super.sqrt(opts))
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
   * Formats the decimal string with the instance NumberFormat, which shows up to 20 fraction
   * digits by default.
   * @throws {RangeError} when `|amount| > Number.MAX_VALUE`.
   */
  override toString(): string {
    assertFormattable(this)
    return formatExact(this.#numberFormat, super.toString())
  }

  /** Logging never throws: amounts past the formattable range print as digits and code. */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this.greaterThanMaxValue() ? `${super.toString()} ${this.currency}` : this.toString()
  }

  override toJSON(): string {
    return super.toString()
  }

  /**
   * Formats with optional overrides. The instance currency always wins over `opts.currency`, and
   * overriding one of `minimumFractionDigits` / `maximumFractionDigits` drops the instance's other.
   * @param opts NumberFormat options (not mutated).
   * @param locale Override locale.
   * @throws {RangeError} when `|amount| > Number.MAX_VALUE`.
   */
  format(opts: Intl.NumberFormatOptions = {}, locale?: string): string {
    assertFormattable(this)
    canonicalLocales(locale)
    const options = overriddenOptions(this.#options, { ...opts, currency: this.currency })
    return formatExact(
      new Intl.NumberFormat(locale ?? this.locale, numberFormatOptions(options)),
      super.toString()
    )
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
}
