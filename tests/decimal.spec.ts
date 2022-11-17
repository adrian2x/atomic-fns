import assert from 'assert'
import { BigNum, Decimal } from '../src/globals/decimal.js'

describe('Decimal', () => {
  it('from number', () => {
    assert(Decimal(0).toString() === '0')
    assert(Decimal(1).div(3).toNumber() === 0.3333333333333333)
    assert(Decimal(1).div(3).toString() === '0.33333333333333333333')
  })

  it('from string', () => {
    assert(Decimal('0').toString() === '0')
    assert(Decimal('0.00').toString() === '0.00')
    assert(Decimal('0.1234').toString() === '0.1234')
    assert(Decimal('1').div(3).toNumber() === 0.3333333333333333)
    assert(Decimal('1').div(3).toString() === '0.33333333333333333333')
  })

  it('negated', () => {
    assert(Decimal(0).toString() === '0')
    assert(Decimal(0).negated().toString() === '0')
    assert(Decimal('1').negated().toString() === '-1')
    assert(Decimal('1.00').negated().toString() === '-1')
  })

  it('add', () => {
    let a = Decimal('50000000000')
    let b = Decimal('0.000000005')
    assert(a.add(b).toString() === '50000000000.000000005')
  })

  it('sub', () => {
    let a = Decimal('1')
    let b = Decimal('0.0000000000000000001')
    assert(a.sub(b).toString() === '0.9999999999999999999')
  })

  it('mul', () => {
    let a = Decimal('0.0000000000000000000025')
    let b = Decimal('400000000000000000000')
    assert(a.mul(b).eq(Decimal(1)))
    assert(a.mul(b).eq(b.mul(a)))
  })

  it('div', () => {
    let a = Decimal('1')
    let b = Decimal('3')
    assert(a.div(b).toNumber() === 0.3333333333333333)
    assert(a.div(b).toString() === '0.33333333333333333333')
    BigNum.PRECISION = 30
    assert(a.div(b).toString() === '0.333333333333333333333333333333', a.div(b).toString())
  })
})
