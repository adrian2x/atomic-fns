import assert from 'assert'
import { Money as Currency } from '../src/i18n/index.js'

describe('Money', () => {
  const locale = 'en-US'
  const Money = (x) => Currency(x, 'USD', locale)

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
})
