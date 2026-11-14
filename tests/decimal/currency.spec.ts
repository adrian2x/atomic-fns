import { inspect } from 'node:util'
import { describe, expect, it } from 'vitest'
import { Currency, Decimal } from '../../src/decimal/index.ts'

const usd = (amount: string | number) => new Currency(amount, 'USD')
const intl = (currency: string, options: Intl.NumberFormatOptions, value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, ...options }).format(value)

describe('Currency', () => {
  it('holds an exact amount and an upper-case code', () => {
    const price = new Currency('12.50', 'usd')
    expect(price.amount).toBeInstanceOf(Decimal)
    expect(price.amount.toString()).toBe('12.5')
    expect(price.currency).toBe('USD')
    expect(new Currency(new Decimal('1.5'), 'EUR').amount.toString()).toBe('1.5')
    expect(new Currency(10n, 'JPY').toString()).toBe('10 JPY')
  })

  it('refuses a malformed code or amount', () => {
    for (const code of ['US', 'USDX', 'U$D', '', '１２３']) {
      expect(() => new Currency(1, code), code).toThrow(RangeError)
    }
    expect(() => new Currency(1, 5 as never)).toThrow(TypeError)
    expect(() => new Currency('abc', 'USD')).toThrow(RangeError)
    expect(() => new Currency(null as never, 'USD')).toThrow(TypeError)
  })

  it('repeats at most 40 units of a malformed code', () => {
    expect(() => new Currency(1, 'X'.repeat(100))).toThrow(
      `currency must be a three-letter ISO 4217 code, not "${'X'.repeat(40)}"...`
    )
  })

  it('keeps its amount and code read-only', () => {
    const price = usd(5)
    expect(() => {
      ;(price as { currency: string }).currency = 'eur'
    }).toThrow(TypeError)
    expect(() => {
      ;(price as { amount: unknown }).amount = 5
    }).toThrow(TypeError)
    expect(price.add(usd(1)).toString()).toBe('6 USD')
  })

  it('adds and subtracts amounts of the same currency exactly', () => {
    expect(usd('0.1').add(usd('0.2')).toString()).toBe('0.3 USD')
    expect(usd(10).subtract(usd('2.5')).toString()).toBe('7.5 USD')
  })

  it('flips and drops the sign', () => {
    expect(usd(5).negate().toString()).toBe('-5 USD')
    expect(usd(-5).abs().toString()).toBe('5 USD')
  })

  it('multiplies by a plain factor', () => {
    expect(usd('19.99').multiply(3).toString()).toBe('59.97 USD')
  })

  it('divides by a plain divisor to 34 significant digits', () => {
    expect(usd(1).divide(3).toString()).toBe(`0.${'3'.repeat(34)} USD`)
    expect(usd(10).divide(3, { precision: 3, roundingMode: 'ceil' }).toString()).toBe('3.34 USD')
    expect(usd(10).divide(3).round().toString()).toBe('3.33 USD')
    expect(() => usd(1).divide(0)).toThrow(RangeError)
  })

  it('rounds to the ISO 4217 minor unit by default, half to even', () => {
    expect(usd('2.675').round().toString()).toBe('2.68 USD')
    expect(usd('2.665').round().toString()).toBe('2.66 USD')
    expect(new Currency('1234.5', 'JPY').round().toString()).toBe('1234 JPY')
    expect(new Currency('1.2345', 'BHD').round().toString()).toBe('1.234 BHD')
    expect(new Currency('1.23456', 'CLF').round().toString()).toBe('1.2346 CLF')
    expect(usd('2.665').round(1, 'halfExpand').toString()).toBe('2.7 USD')
    expect(usd('2.665').round(undefined, 'halfExpand').toString()).toBe('2.67 USD')
  })

  it('rounds by ISO 4217, not by the digits Intl displays', () => {
    expect(new Currency('12.345', 'IQD').round().toString()).toBe('12.345 IQD')
    expect(new Currency('1999.99', 'HUF').round().toString()).toBe('1999.99 HUF')
  })

  it('needs the digits for a code ISO 4217 gives no minor unit', () => {
    for (const code of ['XAU', 'XXX', 'QQQ']) {
      expect(() => new Currency('1.5', code).round(), code).toThrow(
        `${code} has no ISO 4217 minor unit; pass the digits to round()`
      )
    }
    expect(new Currency('1.2345', 'XAU').round(2).toString()).toBe('1.23 XAU')
    expect(new Currency('1.2345', 'XAU').format('en-US')).toBe(
      intl('XAU', { maximumFractionDigits: 20 }, 1.2345)
    )
  })

  it('refuses arithmetic and ordering across currencies', () => {
    const eur = new Currency(10, 'EUR')
    for (const op of [
      () => usd(10).add(eur),
      () => usd(10).subtract(eur),
      () => usd(10).compare(eur),
      () => usd(10).lessThan(eur),
      () => usd(10).greaterThanOrEqual(eur),
      () => Currency.compare(usd(10), eur)
    ]) {
      expect(op).toThrow('currency mismatch: USD and EUR')
    }
    expect(() => usd(10).add(10 as never)).toThrow(TypeError)
    expect(() => usd(10).compare(new Decimal(10) as never)).toThrow(TypeError)
    const lookalike = { compare: () => 0 }
    expect(() => Currency.compare(lookalike as never, usd(10))).toThrow(TypeError)
  })

  it('compares amounts of one currency', () => {
    expect(usd(1).compare(usd('1.00'))).toBe(0)
    for (const [amount, less, equal, greater] of [
      [1, true, false, false],
      [2, false, true, false],
      [3, false, false, true]
    ] as const) {
      expect([
        usd(amount).lessThan(usd(2)),
        usd(amount).lessThanOrEqual(usd(2)),
        usd(amount).greaterThan(usd(2)),
        usd(amount).greaterThanOrEqual(usd(2))
      ]).toStrictEqual([less, less || equal, greater, greater || equal])
    }
    const sorted = [usd(5), usd('-1'), usd('2.5')].toSorted(Currency.compare)
    expect(sorted.map(String)).toEqual(['-1 USD', '2.5 USD', '5 USD'])
  })

  it('is equal only to the same amount in the same currency', () => {
    expect(usd(100).equals(usd('100.00000000000000000000'))).toBe(true)
    expect(usd(100).equals(new Currency(100, 'usd'))).toBe(true)
    expect(usd(100).equals(new Currency(100, 'EUR'))).toBe(false)
    expect(usd(100).equals(usd(101))).toBe(false)
    expect(usd(100).equals(new Decimal(100) as never)).toBe(false)
    expect(usd(100).equals(null as never)).toBe(false)
  })

  it('serializes as amount and code', () => {
    expect(JSON.stringify({ total: usd('9.90') })).toBe('{"total":"9.9 USD"}')
    expect(`${new Currency('1e100', 'EUR')}`).toBe('1e+100 EUR')
    expect(usd('1e309').toString()).toBe('1e+309 USD')
  })

  it('shows amount and code when inspected', () => {
    expect(inspect(usd('12.50'))).toBe('Currency { 12.5 USD }')
    expect(inspect([new Currency('1e309', 'EUR')])).toBe('[ Currency { 1e+309 EUR } ]')
  })

  it('refuses implicit conversion', () => {
    const price: unknown = usd(5)
    expect(() => usd(5).valueOf()).toThrow(TypeError)
    expect(() => (price as number) + 1).toThrow(TypeError)
    expect(() => (price as number) < 6).toThrow(TypeError)
  })
})

describe('Currency format', () => {
  it('keeps the amount exact, up to 20 fraction digits', () => {
    expect(usd(0).format('en-US')).toBe('$0.00')
    expect(usd('0.1234').format('en-US')).toBe('$0.1234')
    expect(usd(1).divide(3).format('en-US')).toBe('$0.33333333333333333333')
    expect(new Currency(1.5, 'JPY').format('en-US')).toBe('¥1.5')
    expect(usd('1e-21').format('en-US')).toBe('$0.00')
    expect(usd('12345678901234567.89').format('en-US')).toBe('$12,345,678,901,234,567.89')
    expect(usd('123456789012345678901234567890.25').format('en-US')).toBe(
      '$123,456,789,012,345,678,901,234,567,890.25'
    )
  })

  it('follows the locale and Intl options', () => {
    expect(new Currency('1234.5', 'EUR').format('de-DE')).toBe('1.234,50\u00a0€')
    expect(usd('0.125').format('en-US', { maximumFractionDigits: 2 })).toBe('$0.13')
    expect(usd(5).format('en-US', { currencyDisplay: 'name' })).toBe('5.00 US dollars')
    expect(usd(-5).format('en-US', { currencySign: 'accounting' })).toBe('($5.00)')
    expect(usd('1.5').format('en-US', { minimumFractionDigits: 3 })).toBe('$1.500')
    expect(usd('1.23456').format('en-US', { minimumFractionDigits: 3 })).toBe('$1.23456')
    const wide = { minimumFractionDigits: 25 }
    expect(usd(1).format('en-US', wide)).toBe(intl('USD', wide, 1))
  })

  it('leaves rounding increments, notation and significant digits to Intl', () => {
    const swiss = { roundingIncrement: 5 } as const
    expect(new Currency(1.03, 'CHF').format('de-CH', swiss)).toBe(
      new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', ...swiss }).format(1.03)
    )
    for (const notation of ['compact', 'scientific', 'engineering'] as const) {
      expect(usd(1234567).format('en-US', { notation })).toBe(intl('USD', { notation }, 1234567))
    }
    const significant = { maximumSignificantDigits: 3, roundingPriority: 'morePrecision' } as const
    expect(usd(1234.5678).format('en-US', significant)).toBe(intl('USD', significant, 1234.5678))
    const least = { minimumSignificantDigits: 2, roundingPriority: 'lessPrecision' } as const
    expect(usd('1.23456').format('en-US', least)).toBe(intl('USD', least, 1.23456))
  })

  it('always formats as this currency', () => {
    const options = { style: 'decimal', currency: 'EUR' } as const
    expect(usd(5).format('en-US', options)).toBe('$5.00')
    expect(options).toEqual({ style: 'decimal', currency: 'EUR' })
  })

  it('answers toLocaleString the same way', () => {
    expect(new Currency(5, 'GBP').toLocaleString('en-GB')).toBe('£5.00')
    expect(usd('2.5').toLocaleString('en-US', { maximumFractionDigits: 0 })).toBe(
      usd('2.5').format('en-US', { maximumFractionDigits: 0 })
    )
  })

  it('refuses amounts Intl would show as infinity, and overlong locales', () => {
    expect(usd(String(Number.MAX_VALUE)).format('en-US').startsWith('$179,769')).toBe(true)
    expect(() => usd('1e309').format('en-US')).toThrow(RangeError)
    expect(() => usd('-1e400').toLocaleString()).toThrow(RangeError)
    expect(() => usd(1).format('a'.repeat(256))).toThrow(/255/)
  })
})
