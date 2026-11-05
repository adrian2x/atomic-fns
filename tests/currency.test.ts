import { inspect } from 'node:util'
import { describe, expect, it } from 'vitest'
import { decimal } from '../src/decimal/index.js'
import { ValueError } from '../src/globals/index.js'
import { Currency } from '../src/i18n/index.js'
import { compare, eq } from '../src/operators/index.js'
import { protocol } from '../src/operators/protocol.js'
import { expectFast } from './helpers/perf.js'

describe('SPEC-R71 Currency', () => {
  const locale = 'en-US'
  const money = (x: string | number) => new Currency(x, 'USD', locale)

  it('SPEC-R71 throws on invalid currency', () => {
    expect(() => new Currency(100, 'invalid', 'en')).toThrow()
  })

  it('SPEC-R71 formats from number and string', () => {
    expect(money(0).toString()).toBe('$0.00')
    expect(money(1).div(3).toNumber()).toBe(0.3333333333333333)
    expect(money(1).div(3).toString()).toBe('$0.33333333333333333333')
    expect(money('0').toString()).toBe('$0.00')
    expect(money('0.0').toString()).toBe('$0.00')
    expect(money('0.1234').toString()).toBe('$0.1234')
    expect(money('1').div('3').toString()).toBe('$0.33333333333333333333')
  })

  it('SPEC-R71 exact large amounts', () => {
    expect(new Currency('12345678901234567.89', 'USD', 'en-US').toString()).toBe(
      '$12,345,678,901,234,567.89'
    )
    expect(new Currency('123456789012345678901234567890.25', 'USD', 'en-US').toString()).toBe(
      '$123,456,789,012,345,678,901,234,567,890.25'
    )
  })

  it('rejects amounts outside the Intl formattable range', () => {
    const huge = new Currency('1e309', 'USD', 'en-US')
    expect(huge.toJSON()).toMatch(/^1(?:0{309}|e\+?309)$/i)
    expect(() => huge.toString()).toThrow(RangeError)
    expect(() => huge.format()).toThrow('amount is outside the formattable range')
    const neg = new Currency('-1e400', 'USD', 'en-US')
    expect(neg.toJSON()).toMatch(/^-1(?:0{400}|e\+?400)$/i)
    expect(() => neg.toString()).toThrow(RangeError)
    expect(() => neg.format()).toThrow(RangeError)

    // Pre-fix: hang formatting huge digit strings. Revert of 707087f fails this.
    expectFast(() => {
      expect(decimal('1e-9999').greaterThanMaxValue()).toBe(false)
      expect(decimal('1e9999').greaterThanMaxValue()).toBe(true)
    }, 1000)
    expect(() => new Currency('1e-9999', 'USD', 'en-US').toString()).not.toThrow()
    expect(() => new Currency('1e9999', 'USD', 'en-US').toString()).toThrow(RangeError)

    expect(() => new Currency(String(Number.MAX_VALUE), 'USD', 'en-US').toString()).not.toThrow()
    expect(() => new Currency('1.7976931348623159e+308', 'USD', 'en-US').toString()).toThrow(
      RangeError
    )
  })

  it('SPEC-R71 opts are not mutated', () => {
    const opts: Intl.NumberFormatOptions = { currencyDisplay: 'code' }
    const copy = { ...opts }
    new Currency(1, 'USD', 'en-US', opts)
    expect(opts).toEqual(copy)
  })

  it('SPEC-R71 cross-currency compare and eq', () => {
    const eur = new Currency(10, 'EUR', 'en-US')
    const usd = new Currency(10, 'USD', 'en-US')
    expect(compare(eur, usd)).toBe(-1)
    expect(compare(usd, eur)).toBe(1)
    expect(eq(eur, usd)).toBe(false)
    expect(eur.eq(usd)).toBe(false)
    expect(eur.eq(new Currency(10, 'EUR'))).toBe(true)
    expect(eur[protocol.equals](usd)).toBe(false)
    expect(eur[protocol.compare](usd)).toBe(-1)
  })

  it('SPEC-R71 accounting displayName precision', () => {
    expect(money(0).accounting()).toBe('$0.00')
    expect(money(1).accounting()).toBe('$1.00')
    expect(money(-1).accounting()).toBe('($1.00)')
    expect(money(-100).accounting()).toBe('($100.00)')
    expect(money(1).displayName()).toBe('1.00 US dollars')
    expect(money(1).div(3).precision(4)).toBe('$0.3333')
  })

  it('SPEC-R71 arithmetic and negated', () => {
    expect(money(0).negated().toString()).toBe('$0.00')
    expect(money('1.00').negated().toString()).toBe('-$1.00')
    const a = money('50000000000')
    const b = money('0.000000005')
    expect(a.add(b).eq('50000000000.000000005')).toBe(true)
    expect(a.add(b).toString()).toBe('$50,000,000,000.000000005')
    expect(money('1').sub('0.0000000001').toString()).toBe('$0.9999999999')
    expect(money('0.0000000000000000000025').mul('400000000000000000000').toString()).toBe('$1.00')
    expect(money('1').div('3').toString()).toBe('$0.33333333333333333333')
  })

  it('SPEC-R71 equals same currency', () => {
    expect(money('1').eq(money('1.00'))).toBe(true)
    expect(money(10).eq(money('10.00'))).toBe(true)
    expect(money(100).eq(money('100.00000000000000000000'))).toBe(true)
    expect(money(100).eq(new Currency(100, 'USD'))).toBe(true)
    expect(money(100).eq(new Currency(100, 'EUR'))).toBe(false)
  })

  it('SPEC-R71 clone keeps currency', () => {
    const c = money(5)
    const d = c.clone(10)
    expect(d).toBeInstanceOf(Currency)
    expect(d.currency).toBe('USD')
    expect(d.eq(10)).toBe(true)
    expect(c.clone().eq(5)).toBe(true)
  })

  it('C4-1 refuses mixed-currency arithmetic and ordering; operators compare stays total', async () => {
    const { ValueError } = await import('../src/globals/errors.js')
    const { sorted } = await import('../src/itertools/index.js')
    const usd10 = new Currency('10', 'USD')
    const jpy1000 = new Currency('1000', 'JPY')
    const usd100 = new Currency('100', 'USD')
    const jpy100 = new Currency('100', 'JPY')
    const msg = /currency mismatch: USD vs JPY|currency mismatch: JPY vs USD/
    expect(() => usd10.add(jpy1000)).toThrow(ValueError)
    expect(() => usd10.add(jpy1000)).toThrow(msg)
    expect(() => usd10.sub(jpy1000)).toThrow(msg)
    expect(() => usd10.mul(jpy1000)).toThrow(msg)
    expect(() => usd10.div(jpy1000)).toThrow(msg)
    expect(() => usd10.lt(jpy1000)).toThrow(msg)
    expect(() => usd10.lte(jpy1000)).toThrow(msg)
    expect(() => usd10.gt(jpy1000)).toThrow(msg)
    expect(() => jpy100.gte(usd100)).toThrow(msg)
    expect(() => usd10.compare(jpy1000)).toThrow(msg)
    expect(usd10.add(5).eq(15)).toBe(true)
    expect(usd10.add(new Currency(5, 'USD')).eq(15)).toBe(true)
    const usd5 = new Currency(5, 'USD')
    const jpy1 = new Currency(1, 'JPY')
    const usd1 = new Currency(1, 'USD')
    expect(sorted([usd5, jpy1, usd1])).toEqual([jpy1, usd1, usd5])
    expect(compare(jpy1, usd1)).toBeLessThan(0)
    expect(eq(jpy1, usd1)).toBe(false)
  })

  it('R16-D: currency checks use the unit hook across library copies', async () => {
    const { ValueError } = await import('../src/globals/errors.js')
    const { DECIMAL_BRAND } = await import('../src/decimal/index.js')
    const {
      add,
      sub,
      mul,
      div,
      lt,
      lte,
      gt,
      gte,
      eq: oeq
    } = await import('../src/operators/index.js')
    const { min, max } = await import('../src/math/index.js')
    const usd = new Currency('1', 'USD')
    // Foreign Currency-like: Decimal brand + unit hook, not instanceof Currency.
    const foreignJpy = {
      [DECIMAL_BRAND]() {
        return '1000000'
      },
      get [protocol.unit]() {
        return 'JPY'
      }
    }
    const msg = /currency mismatch: (USD vs JPY|JPY vs USD)/
    expect(() => usd.add(foreignJpy as never)).toThrow(ValueError)
    expect(() => usd.add(foreignJpy as never)).toThrow(msg)
    expect(() => usd.sub(foreignJpy as never)).toThrow(msg)
    expect(() => usd.mul(foreignJpy as never)).toThrow(msg)
    expect(() => usd.div(foreignJpy as never)).toThrow(msg)
    expect(() => usd.compare(foreignJpy as never)).toThrow(msg)
    expect(() => usd.lt(foreignJpy as never)).toThrow(msg)
    expect(() => usd.lte(foreignJpy as never)).toThrow(msg)
    expect(() => usd.gt(foreignJpy as never)).toThrow(msg)
    expect(() => usd.gte(foreignJpy as never)).toThrow(msg)
    expect(() => add(usd, foreignJpy)).toThrow(msg)
    expect(() => sub(usd, foreignJpy)).toThrow(msg)
    expect(() => mul(usd, foreignJpy)).toThrow(msg)
    expect(() => div(usd, foreignJpy)).toThrow(msg)
    expect(() => lt(usd, foreignJpy)).toThrow(msg)
    expect(() => lte(usd, foreignJpy)).toThrow(msg)
    expect(() => gt(usd, foreignJpy)).toThrow(msg)
    expect(() => gte(usd, foreignJpy)).toThrow(msg)
    expect(oeq(usd, foreignJpy)).toBe(false)
    expect(() => min([usd, foreignJpy as never])).toThrow(msg)
    expect(() => max([usd, foreignJpy as never])).toThrow(msg)
  })
})

describe('Currency display options', () => {
  const intl = (currency: string, options: Intl.NumberFormatOptions, value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, ...options }).format(value)

  it('takes rounding options the 20-digit default would reject', () => {
    const swiss = { roundingIncrement: 5 } as const
    expect(new Currency(1.03, 'CHF', 'de-CH', swiss).toString()).toBe(
      new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', ...swiss }).format(1.03)
    )
    expect(new Currency(1.03, 'CHF', 'de-CH').format(swiss)).toBe(
      new Currency(1.03, 'CHF', 'de-CH', swiss).toString()
    )
    const wide = { minimumFractionDigits: 25 }
    expect(new Currency(1, 'USD', 'en-US', wide).toString()).toBe(intl('USD', wide, 1))
    expect(new Currency(1, 'USD', 'en-US').format(wide)).toBe(intl('USD', wide, 1))
  })

  it('lets notation pick its own precision', () => {
    for (const notation of ['compact', 'scientific', 'engineering'] as const) {
      expect(new Currency(1234567, 'USD', 'en-US').format({ notation })).toBe(
        intl('USD', { notation }, 1234567)
      )
      expect(new Currency(1234567, 'USD', 'en-US', { notation }).toString()).toBe(
        intl('USD', { notation }, 1234567)
      )
    }
    expect(new Currency('1.23456', 'USD', 'en-US').format({ notation: 'standard' })).toBe(
      '$1.23456'
    )
  })

  it('leaves significant digits to Intl', () => {
    for (const options of [
      { maximumSignificantDigits: 3, roundingPriority: 'morePrecision' },
      { minimumSignificantDigits: 2, roundingPriority: 'lessPrecision' }
    ] as const) {
      expect(new Currency(1234.5678, 'USD', 'en-US', options).toString()).toBe(
        intl('USD', options, 1234.5678)
      )
    }
  })

  it('keeps the exact default next to a minimum', () => {
    expect(new Currency('1.23456', 'USD', 'en-US', { minimumFractionDigits: 3 }).toString()).toBe(
      '$1.23456'
    )
    expect(new Currency('1.5', 'USD', 'en-US', { minimumFractionDigits: 3 }).toString()).toBe(
      '$1.500'
    )
  })

  it('an override of one fraction bound replaces the stored other bound', () => {
    expect(new Currency(1.5, 'USD', 'en-US', { minimumFractionDigits: 2 }).precision(0)).toBe('$2')
    expect(
      new Currency(1.5, 'USD', 'en-US', { maximumFractionDigits: 2 }).format({
        minimumFractionDigits: 3
      })
    ).toBe('$1.500')
    expect(new Currency('1.23456', 'USD', 'en-US').precision()).toBe('$1.23')
  })

  it('normalizes the code under any style', () => {
    const decimalStyle = new Currency(1, 'usd', 'en-US', { style: 'decimal' })
    expect(decimalStyle.currency).toBe('USD')
    expect(decimalStyle.add(new Currency(1, 'USD')).toNumber()).toBe(2)
  })

  it('bounds the locale tag', () => {
    const long = 'a'.repeat(256)
    expect(() => new Currency(1, 'USD', long)).toThrow(/255/)
    expect(() => new Currency(1, 'USD').format({}, long)).toThrow(/255/)
  })
})

describe('Currency logging', () => {
  it('inspects amounts past the formattable range', () => {
    const huge = new Currency('1e309', 'USD', 'en-US')
    expect(inspect(huge)).toBe(`${huge.toJSON()} USD`)
    expect(inspect({ price: huge })).toContain(' USD')
    expect(inspect(new Currency(5, 'USD', 'en-US'))).toBe('$5.00')
  })
})

describe('Currency rounding keeps the unit', () => {
  const price = new Currency('10.555', 'USD', 'en-US')

  it('round returns a Currency', () => {
    const rounded = price.round(2)
    expect(rounded).toBeInstanceOf(Currency)
    expect(rounded.toString()).toBe('$10.56')
    expect(price.round(1, 'down').format()).toBe('$10.50')
    expect(() => price.round(2).add(new Currency(1, 'JPY'))).toThrow(ValueError)
  })

  it('sqrt returns a Currency', () => {
    const root = new Currency(16, 'USD', 'en-US').sqrt()
    expect(root).toBeInstanceOf(Currency)
    expect(root.toString()).toBe('$4.00')
  })

  it('round defaults to half-even while precision displays half-expand', () => {
    const tie = new Currency('0.125', 'USD', 'en-US')
    expect(tie.round(2).toString()).toBe('$0.12')
    expect(tie.precision(2)).toBe('$0.13')
  })
})
