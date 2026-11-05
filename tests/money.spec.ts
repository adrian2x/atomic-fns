import assert from 'node:assert'
import { Currency } from '../src/i18n/index.js'

describe('Money', () => {
  const locale = 'en-US'
  const Money = (x) => new Currency(x, 'USD', locale)

  it('throws wrong currency', () => {
    assert.throws(() => new Currency(100, 'invalid', 'en'))
  })

  it('from number', () => {
    assert(Money(0).toString() === '$0.00')
    assert(Money(1).div(3).toNumber() === 0.3333333333333333)
    assert(Money(1).div(3).toString() === '$0.3333333333333333')
  })

  it('from string', () => {
    assert(Money('0').toString() === '$0.00')
    assert(Money('0.0').toString() === '$0.00')
    assert(Money('0.1234').toString() === '$0.1234')
    assert(Money('1').div('3').toNumber() === 0.3333333333333333)
    assert(Money('1').div('3').toString() === '$0.3333333333333333')
  })

  it('negated', () => {
    assert(Money(0).toString() === '$0.00')
    assert(Money(0).negated().toString() === '$0.00')
    assert(Money('1.00').negated().toString() === '-$1.00')
  })

  it('add', () => {
    let a = Money('50000000000')
    let b = Money('0.000000005')
    assert(a.add(b).toDecimal().toString() === '50000000000.000000005')
    // note rounding when format
    assert(a.add(b).toNumber() === 50000000000)
    assert(a.add(b).toString() === '$50,000,000,000.00')
  })

  it('sub', () => {
    let a = Money('1')
    let b = Money('0.0000000001')
    assert(a.sub(b).toString() === '$0.9999999999')
  })

  it('mul', () => {
    let a = Money('0.0000000000000000000025')
    let b = Money('400000000000000000000')
    assert(a.mul(b).toString() === '$1.00')
  })

  it('div', () => {
    let a = Money('1')
    let b = Money('3')
    assert(a.div(b).toString() === '$0.3333333333333333')
  })

  it('prints every digit past 2^53', () => {
    assert(Money('9007199254740993').toString() === '$9,007,199,254,740,993.00')
    assert(Money('-9007199254740993').toString() === '-$9,007,199,254,740,993.00')
    assert(Money('9007199254740992.5').format() === '$9,007,199,254,740,992.50')
    assert(Money('12345678901234567890.12').toString() === '$12,345,678,901,234,567,890.12')
    assert(Money('12345678901234567890.125').precision(2) === '$12,345,678,901,234,567,890.13')
    assert(Money('9007199254740991').toString() === '$9,007,199,254,740,991.00')
    assert(Money('1e21').toString() === '$1,000,000,000,000,000,000,000.00')
  })

  it('clone', () => {
    assert(Money(5).clone().toString() === '$5.00')
    assert(Money(5).clone(Money(7)).toString() === '$7.00')
    assert(Money(5).clone(null).toString() === '$0.00')
  })

  it('sqrt', () => {
    assert(Money(4).sqrt().toString() === '$2.00')
    assert(Money('0.25').sqrt().toString() === '$0.50')
    assert(Money(0).sqrt().toString() === '$0.00')
  })

  it('precision', () => {
    let a = Money('1')
    let b = Money('3')
    assert(a.div(b).precision(4) === '$0.3333')
  })

  it('displayName', () => {
    let a = Money('1')
    assert(a.displayName() === '1.00 US dollars')
  })

  it('leaves the options object alone', () => {
    const opts = { currencyDisplay: 'code' } as const
    const copy = { ...opts }
    assert(new Currency(1, 'USD', locale, opts).toString() === 'USD\u00a01.00')
    assert(new Currency(1, 'EUR', locale, opts).toString() === 'EUR\u00a01.00')
    assert(Money(1).format(opts) === 'USD\u00a01.00')
    assert(new Currency(1, 'EUR', locale).format(opts) === 'EUR\u00a01.00')
    assert.deepStrictEqual(opts, copy)
  })

  it('keeps its constructor options', () => {
    const coded = new Currency(100, 'USD', locale, { currencyDisplay: 'code' })
    assert(coded.add(1).toString() === 'USD\u00a0101.00')
    assert(coded.negated().toString() === '-USD\u00a0100.00')
    assert(coded.format() === 'USD\u00a0100.00')
    assert(coded.accounting() === 'USD\u00a0100.00')
    assert(coded.format({ currencyDisplay: 'symbol' }) === '$100.00')

    const rounded = new Currency('1.2345', 'USD', locale, { maximumFractionDigits: 2 })
    assert(rounded.mul(1).toString() === '$1.23')
    assert(rounded.format() === '$1.23')
    assert(rounded.precision(3) === '$1.235')

    const opts = { currencyDisplay: 'code' } as const
    assert(new Currency(1, 'USD', opts).add(1).format({}, locale) === 'USD\u00a02.00')
  })

  it('digit options in format replace the constructor ones', () => {
    const padded = new Currency(100, 'USD', locale, { minimumFractionDigits: 4 })
    assert(padded.format() === '$100.0000')
    assert(padded.precision(2) === '$100.00')

    const rounded = new Currency('1.2345', 'USD', locale, { maximumFractionDigits: 2 })
    assert(rounded.format({ minimumFractionDigits: 3 }) === '$1.2345')

    const significant = new Currency('1234.5678', 'USD', locale, { maximumSignificantDigits: 3 })
    assert(significant.format() === '$1,230')
    assert(significant.precision(2) === '$1,234.57')

    const least = new Currency('1234.5678', 'USD', locale, { minimumSignificantDigits: 5 })
    assert(least.format({ maximumSignificantDigits: 3 }) === '$1,230')

    const stepped = new Currency('1.25', 'USD', locale, {
      roundingIncrement: 5,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    assert(stepped.format({ maximumFractionDigits: 3 }) === '$1.25')

    const coded = new Currency('1.2345', 'USD', locale, {
      currencyDisplay: 'code',
      maximumFractionDigits: 2
    })
    assert(coded.precision(3) === 'USD\u00a01.235')
    assert(coded.precision(undefined) === 'USD\u00a01.23')

    assert.throws(
      () => Money(1).format({ minimumFractionDigits: 3, maximumFractionDigits: 2 }),
      RangeError
    )
  })

  it('accounting', () => {
    assert(Money(0).accounting() === '$0.00')
    assert(Money(1).accounting() === '$1.00')
    assert(Money(-0).accounting() === '$0.00')
    assert(Money(-1).accounting() === '($1.00)')
    assert(Money(-100).accounting() === '($100.00)')
  })

  it('equals', () => {
    assert(Money('1').eq(Money('1.00')))
    assert(Money(10).eq(Money('10.00')))
    assert(Money(100).eq(Money('100.00000000000000000000')))
    assert(Money(100).eq(new Currency(100, 'USD')))
    assert(!Money(100).eq(new Currency(100, 'EUR')))
  })

  it('compare keeps two currencies apart', () => {
    assert(new Currency(5, 'USD').compare(new Currency(5, 'EUR')) !== 0)
  })
})
