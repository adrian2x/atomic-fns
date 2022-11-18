import assert from 'assert'
import { decimal, Decimal } from '../src/globals/decimal.js'

describe('Decimal', () => {
  it('from number', () => {
    assert(decimal(0).toString() === '0')
    assert(decimal(1).div(3).toNumber() === 0.3333333333333333)
    assert(decimal(1).div(3).toString() === '0.33333333333333333333')
  })

  it('from string', () => {
    assert(decimal('0').toString() === '0')
    assert(decimal('0.00').toString() === '0.00')
    assert(decimal('0.1234').toString() === '0.1234')
    assert(decimal('1').div(3).toNumber() === 0.3333333333333333)
    assert(decimal('1').div(3).toString() === '0.33333333333333333333')
  })

  it('negated', () => {
    assert(decimal(0).toString() === '0')
    assert(decimal(0).negated().toString() === '0')
    assert(decimal('1').negated().toString() === '-1')
    assert(decimal('1.00').negated().toString() === '-1')
  })

  it('add', () => {
    let a = decimal('50000000000')
    let b = decimal('0.000000005')
    assert(a.add(b).toString() === '50000000000.000000005')
  })

  it('sub', () => {
    let a = decimal('1')
    let b = decimal('0.0000000000000000001')
    assert(a.sub(b).toString() === '0.9999999999999999999')
  })

  it('mul', () => {
    let a = decimal('0.0000000000000000000025')
    let b = decimal('400000000000000000000')
    assert(a.mul(b).eq(1))
    assert(a.mul(b).eq(b.mul(a)))
  })

  it('div', () => {
    let a = decimal('1')
    let b = decimal('3')
    assert(a.div(b).toNumber() === 0.3333333333333333)
    assert(a.div(b).toString() === '0.33333333333333333333')
    Decimal.PRECISION = 30
    assert(a.div(b).toString() === '0.333333333333333333333333333333', a.div(b).toString())
  })

  it('lt', () => {
    let a = decimal('0.0000000000000000000025')
    let b = decimal('0.00000000000000000000255')
    assert(a.lt(b))
    assert(a.lt(1))
    assert(b.lt(1))
  })

  it('gt', () => {
    let a = decimal('0.0000000000000000000025')
    let b = decimal('0.00000000000000000000255')
    assert(a.gt(0))
    assert(b.gt(0))
    assert(b.gt(a))
  })
})
