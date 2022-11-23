import assert from 'assert'
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

  it('precision', () => {
    let a = Money('1')
    let b = Money('3')
    assert(a.div(b).precision(4) === '$0.3333')
  })

  it('displayName', () => {
    let a = Money('1')
    assert(a.displayName() === '1.00 US dollars')
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
})
