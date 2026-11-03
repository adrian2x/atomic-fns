import { describe, expect, it } from 'vitest'
import { Currency } from '../src/i18n/index.js'
import { compare, eq } from '../src/operators/index.js'
import { protocol } from '../src/operators/protocol.js'

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
})
