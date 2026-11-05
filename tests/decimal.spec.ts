import assert from 'assert'
import { decimal, Decimal } from '../src/decimal/index.js'
import { ValueError } from '../src/globals/index.js'

/** Fails a spin on `Math.round` instead of blocking vitest, which cannot interrupt it. */
function failOnSpin(fn: () => void) {
  const round = vi.spyOn(Math, 'round').mockImplementation(() => {
    throw new Error('spinning')
  })
  try {
    fn()
  } finally {
    round.mockRestore()
  }
}

describe('Decimal', () => {
  beforeEach(() => {
    Decimal.PRECISION = 20
  })

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

  it('rejects values that are not numbers', () => {
    const values = [
      'abc',
      '1.2.3',
      '1,000',
      '--1',
      '.',
      'e5',
      '1e',
      '',
      ' ',
      '\n',
      NaN,
      {},
      [],
      [1, 2]
    ]
    failOnSpin(() => {
      for (const value of values) assert.throws(() => decimal(value), ValueError, String(value))
    })
  })

  it('reads every spelling of zero', () => {
    failOnSpin(() => {
      for (const value of ['+0', ' 0', '0 ', '+0.0', '0.', '.0', '0e5', '0x0', false]) {
        assert(decimal(value).toNumber() === 0, String(value))
      }
    })
  })

  it('stays lenient', () => {
    assert(decimal('+1').toString() === '1')
    assert(decimal(' 1.5 ').toString() === '1.5')
    assert(decimal('\t-1\n').toString() === '-1')
    assert(decimal('.5').toString() === '0.5')
    assert(decimal('5.').toString() === '5')
    assert(decimal('007').toString() === '7')
    assert(decimal('0x10').toString() === '16')
    assert(decimal('0b11').toString() === '3')
    assert(decimal(true).toString() === '1')
    assert(decimal([5]).toString() === '5')
    assert(decimal(new Date(5)).toString() === '5')
    assert(decimal({ valueOf: () => 5 }).toString() === '5')
    assert(decimal(null).toString() === '0')
    assert.throws(() => decimal('Infinity'), RangeError)
    assert.throws(() => decimal(-Infinity), RangeError)
  })

  it('negated', () => {
    assert(decimal(0).toString() === '0')
    assert(decimal(0).negated().toString() === '0')
    assert(decimal('1').negated().toString() === '-1')
    assert(decimal('1.00').negated().toString() === '-1')
  })

  it('add', () => {
    let a = decimal('50000000000')
    let b = decimal('0.00000000000000000005')
    assert(a.add(b).toString() === '50000000000.00000000000000000005')
    assert(decimal('0.1').add('0.1').add('0.1').toNumber() === 0.3)
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

  it('eq is false for values that are not numbers', () => {
    for (const value of ['abc', '', NaN, Infinity, -Infinity, {}, Symbol('x')]) {
      assert(decimal(1).eq(value) === false, String(value))
    }
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
