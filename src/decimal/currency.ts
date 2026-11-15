import { Decimal, type DecimalInput, type DivideOptions, type RoundingMode } from './decimal.ts'
import { quoteForError } from './internal/echo.ts'
import { isoMinorUnits } from './internal/minor-units.ts'

/** Fraction digits {@link Currency.format} shows by default, so an exact amount keeps its digits. */
const EXACT_FRACTION_DIGITS = 20

const CURRENCY_CODE = /^[A-Za-z]{3}$/

function minorUnitDigits(code: string): number {
  const digits = isoMinorUnits(code)
  if (digits === undefined) {
    throw new RangeError(`${code} has no ISO 4217 minor unit; pass the digits to round()`)
  }
  return digits
}

/** True unless `options` already say how many digits to show. */
function showsExactDigits(options: Intl.NumberFormatOptions): boolean {
  return (
    options.maximumFractionDigits === undefined &&
    options.minimumSignificantDigits === undefined &&
    options.maximumSignificantDigits === undefined &&
    (options.roundingIncrement ?? 1) === 1 &&
    (options.notation ?? 'standard') === 'standard'
  )
}

function assertCurrency(value: unknown): asserts value is Currency {
  if (!(value instanceof Currency)) throw new TypeError('expected a Currency')
}

/**
 * An exact amount of money in one ISO 4217 currency, as the TC39 Amount proposal pairs a value
 * with its unit. Arithmetic and ordering with another currency throw `RangeError`; nothing
 * converts between currencies.
 *
 * @example
 * ```ts
 * const price = new Currency('19.99', 'USD')
 * price.multiply(3).format('en-US') // '$59.97'
 * price.add(new Currency('0.01', 'USD')).toString() // '20 USD'
 * ```
 */
export class Currency {
  /**
   * Orders two amounts of the same currency, for `toSorted` and sorted collections.
   * @throws {TypeError} when `a` or `b` is not a Currency.
   * @throws {RangeError} when the currencies differ.
   * @example
   * ```ts
   * [new Currency(5, 'EUR'), new Currency(2, 'EUR')].toSorted(Currency.compare).map(String)
   * // ['2 EUR', '5 EUR']
   * ```
   */
  static compare(a: Currency, b: Currency): -1 | 0 | 1 {
    assertCurrency(a)
    return a.compare(b)
  }

  readonly #amount: Decimal
  readonly #currency: string

  /**
   * Pairs an amount with a currency code.
   * @param amount The amount, read as {@link Decimal} reads it.
   * @param currency A three-letter ISO 4217 code, in any case.
   * @throws {TypeError} when `currency` is not a string, or `amount` not a Decimal input.
   * @throws {RangeError} when `currency` is not three letters, or `amount` is malformed.
   * @example
   * ```ts
   * new Currency('12.50', 'usd').currency // 'USD'
   * ```
   */
  constructor(amount: DecimalInput, currency: string) {
    if (typeof currency !== 'string') throw new TypeError('currency must be a string')
    if (!CURRENCY_CODE.test(currency)) {
      throw new RangeError(
        `currency must be a three-letter ISO 4217 code, not ${quoteForError(currency)}`
      )
    }
    this.#amount = amount instanceof Decimal ? amount : new Decimal(amount)
    this.#currency = currency.toUpperCase()
  }

  /** The exact amount. */
  get amount(): Decimal {
    return this.#amount
  }

  /** The upper-case ISO 4217 code, such as `'USD'`. */
  get currency(): string {
    return this.#currency
  }

  #with(amount: Decimal): Currency {
    return new Currency(amount, this.#currency)
  }

  #amountOf(other: Currency): Decimal {
    assertCurrency(other)
    if (other.#currency !== this.#currency) {
      throw new RangeError(`currency mismatch: ${this.#currency} and ${other.#currency}`)
    }
    return other.#amount
  }

  /**
   * The sum of two amounts of the same currency.
   * @throws {TypeError} when `other` is not a Currency.
   * @throws {RangeError} when the currencies differ.
   * @example
   * ```ts
   * new Currency('0.1', 'USD').add(new Currency('0.2', 'USD')).toString() // '0.3 USD'
   * ```
   */
  add(other: Currency): Currency {
    return this.#with(this.#amount.add(this.#amountOf(other)))
  }

  /**
   * The difference of two amounts of the same currency.
   * @throws {TypeError} when `other` is not a Currency.
   * @throws {RangeError} when the currencies differ.
   * @example
   * ```ts
   * new Currency(10, 'EUR').subtract(new Currency('2.5', 'EUR')).toString() // '7.5 EUR'
   * ```
   */
  subtract(other: Currency): Currency {
    return this.#with(this.#amount.subtract(this.#amountOf(other)))
  }

  /**
   * This amount times a plain factor.
   * @example
   * ```ts
   * new Currency('19.99', 'USD').multiply(3).toString() // '59.97 USD'
   * ```
   */
  multiply(factor: DecimalInput): Currency {
    return this.#with(this.#amount.multiply(factor))
  }

  /**
   * This amount divided by a plain divisor, rounded as {@link Decimal.divide} rounds, to 34
   * significant digits by default; follow with {@link Currency.round} for the minor unit.
   * @throws {RangeError} for a zero divisor.
   * @example
   * ```ts
   * new Currency(10, 'USD').divide(3).round().toString() // '3.33 USD'
   * ```
   */
  divide(divisor: DecimalInput, options?: DivideOptions): Currency {
    return this.#with(this.#amount.divide(divisor, options))
  }

  /**
   * This amount with the opposite sign.
   * @example
   * ```ts
   * new Currency(5, 'USD').negate().toString() // '-5 USD'
   * ```
   */
  negate(): Currency {
    return this.#with(this.#amount.negate())
  }

  /**
   * The absolute amount.
   * @example
   * ```ts
   * new Currency(-5, 'USD').abs().toString() // '5 USD'
   * ```
   */
  abs(): Currency {
    return this.#with(this.#amount.abs())
  }

  /**
   * Rounds the amount, by default to the currency's ISO 4217 minor unit (2 digits for USD, 0 for
   * JPY, 3 for IQD). The mode defaults to `'halfEven'`, while {@link Currency.format} rounds what
   * it shows half away from zero, as `Intl.NumberFormat` does.
   * @param digits Fractional digits (may be negative); defaults to the minor unit.
   * @param roundingMode One of the `Intl.NumberFormat` rounding modes; defaults to `'halfEven'`.
   * @throws {RangeError} when `digits` is left out and ISO 4217 gives the code no minor unit, as
   * for XAU or a code it does not list.
   * @example
   * ```ts
   * new Currency('2.675', 'USD').round().toString() // '2.68 USD'
   * new Currency('1234.5', 'JPY').round().toString() // '1234 JPY'
   * new Currency('2.665', 'USD').round(undefined, 'halfExpand').toString() // '2.67 USD'
   * ```
   */
  round(digits: number = minorUnitDigits(this.#currency), roundingMode?: RoundingMode): Currency {
    return this.#with(this.#amount.round(digits, roundingMode))
  }

  /**
   * Orders this amount against another of the same currency: -1, 0 or 1.
   * @throws {TypeError} when `other` is not a Currency.
   * @throws {RangeError} when the currencies differ.
   * @example
   * ```ts
   * new Currency(1, 'USD').compare(new Currency('1.00', 'USD')) // 0
   * ```
   */
  compare(other: Currency): -1 | 0 | 1 {
    return this.#amount.compare(this.#amountOf(other))
  }

  /**
   * True for a Currency with the same code and amount; false for anything else, including the
   * same amount in another currency.
   * @example
   * ```ts
   * new Currency(1, 'USD').equals(new Currency(1, 'EUR')) // false
   * ```
   */
  equals(other: Currency): boolean {
    return (
      other instanceof Currency &&
      other.#currency === this.#currency &&
      this.#amount.equals(other.#amount)
    )
  }

  /**
   * True when this amount is less than `other`.
   * @throws {TypeError} when `other` is not a Currency.
   * @throws {RangeError} when the currencies differ.
   * @example
   * ```ts
   * new Currency(1, 'USD').lessThan(new Currency(2, 'USD')) // true
   * ```
   */
  lessThan(other: Currency): boolean {
    return this.compare(other) < 0
  }

  /**
   * True when this amount is less than or equal to `other`.
   * @throws {TypeError} when `other` is not a Currency.
   * @throws {RangeError} when the currencies differ.
   * @example
   * ```ts
   * new Currency(2, 'USD').lessThanOrEqual(new Currency(2, 'USD')) // true
   * ```
   */
  lessThanOrEqual(other: Currency): boolean {
    return this.compare(other) <= 0
  }

  /**
   * True when this amount is greater than `other`.
   * @throws {TypeError} when `other` is not a Currency.
   * @throws {RangeError} when the currencies differ.
   * @example
   * ```ts
   * new Currency(3, 'USD').greaterThan(new Currency(2, 'USD')) // true
   * ```
   */
  greaterThan(other: Currency): boolean {
    return this.compare(other) > 0
  }

  /**
   * True when this amount is greater than or equal to `other`.
   * @throws {TypeError} when `other` is not a Currency.
   * @throws {RangeError} when the currencies differ.
   * @example
   * ```ts
   * new Currency(2, 'USD').greaterThanOrEqual(new Currency(3, 'USD')) // false
   * ```
   */
  greaterThanOrEqual(other: Currency): boolean {
    return this.compare(other) >= 0
  }

  /**
   * Formats with `Intl.NumberFormat` in currency style. Unless `options` set the digits, the
   * amount keeps its own fraction digits, up to 20, instead of rounding to the minor unit, so
   * `0.125` dollars show as `$0.125`; pass `{ maximumFractionDigits: 2 }` or {@link Currency.round}
   * first for minor units. A `roundingMode` alone changes nothing, since no digits are cut; pair it
   * with `maximumFractionDigits`. `style` and `currency` always come from this amount.
   * @throws {RangeError} when the amount is beyond `Number.MAX_VALUE`, which `Intl` shows as `∞`,
   * or the locale is malformed or longer than 255 characters.
   * @example
   * ```ts
   * new Currency('1234.5', 'EUR').format('de-DE') // '1.234,50 €'
   * new Currency('0.125', 'USD').format('en-US', { maximumFractionDigits: 2 }) // '$0.13'
   * ```
   */
  format(locale?: Intl.LocalesArgument, options: Intl.NumberFormatOptions = {}): string {
    const merged: Intl.NumberFormatOptions = {
      ...options,
      style: 'currency',
      currency: this.#currency
    }
    if (showsExactDigits(merged)) {
      merged.maximumFractionDigits = Math.max(
        EXACT_FRACTION_DIGITS,
        merged.minimumFractionDigits ?? 0
      )
    }
    return this.#amount.toLocaleString(locale, merged)
  }

  /**
   * The same as {@link Currency.format}, under the name `Intl` and Temporal use.
   * @example
   * ```ts
   * new Currency(5, 'GBP').toLocaleString('en-GB') // '£5.00'
   * ```
   */
  toLocaleString(locales?: Intl.LocalesArgument, options?: Intl.NumberFormatOptions): string {
    return this.format(locales, options)
  }

  /**
   * The amount's canonical string and the code, such as `'12.5 USD'`, for logs and keys.
   * @example
   * ```ts
   * new Currency('12.50', 'usd').toString() // '12.5 USD'
   * ```
   */
  toString(): string {
    return `${this.#amount.toString()} ${this.#currency}`
  }

  /** The same string as {@link Currency.toString}, so `JSON.stringify` keeps every digit. */
  toJSON(): string {
    return this.toString()
  }

  /**
   * What `console.log` and `util.inspect` show, such as `Currency { 12.5 USD }`. The symbol is
   * the runtime's own inspection hook, read by Node and runtimes compatible with it, not a
   * protocol of this package.
   * @example
   * ```ts
   * console.log(new Currency('12.50', 'USD')) // Currency { 12.5 USD }
   * ```
   */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `Currency { ${this.toString()} }`
  }

  /**
   * Throws, so `<` and `+` cannot silently compare or add amounts. Use {@link Currency.compare}
   * or {@link Currency.add}.
   * @throws {TypeError} always.
   */
  valueOf(): never {
    throw new TypeError(
      'Currency cannot be converted to a primitive implicitly; use compare(), add() or format()'
    )
  }
}
