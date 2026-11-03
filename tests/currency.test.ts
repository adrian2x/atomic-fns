import { describe, expect, it } from 'vitest'
import { decimal } from '../src/decimal/index.js'
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
    expect(neg.toJSON().startsWith('-')).toBe(true)
    expect(neg.toJSON().length).toBeGreaterThan(100)
    expect(() => neg.toString()).toThrow(RangeError)
    expect(() => neg.format()).toThrow(RangeError)

    // Pre-fix: hang formatting huge digit strings. Revert of 707087f fails this.
    expectFast(() => {
      expect(decimal('1e-9999').greaterThanMaxValue()).toBe(false)
      expect(decimal('1e9999').greaterThanMaxValue()).toBe(true)
    }, 250)
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
})
