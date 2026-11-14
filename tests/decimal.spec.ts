import assert from 'node:assert'
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

  it('reads exponents exactly', () => {
    assert(decimal('1e22').toString() === `1${'0'.repeat(22)}`)
    assert(decimal('1e23').eq(`1${'0'.repeat(23)}`))
    assert(decimal('1.5e300').toString() === `15${'0'.repeat(299)}`)
    assert(decimal('-1.5E+3').toString() === '-1500')
    assert(decimal(' +.5e1 ').toString() === '5')
    assert(decimal('5.e1').toString() === '50')
    assert(decimal('1e-308').toString() === `0.${'0'.repeat(307)}1`)
    assert(decimal('1e-400').toString() === `0.${'0'.repeat(399)}1`)
    assert(decimal('1234e-2').toString() === '12.34')
    assert(
      decimal('123456789012345678901234567890e0').toString() === '123456789012345678901234567890'
    )
    assert(decimal('1.2345678901234567890123e5').toString() === '123456.78901234567890123')
    assert(decimal('0e1000000').toString() === '0')
    assert(decimal('0e-1000000').toString() === '0')
  })

  it('reads numbers in exponent form as they print', () => {
    assert(decimal(1e21).toString() === `1${'0'.repeat(21)}`)
    assert(decimal(-1e21).toString() === `-1${'0'.repeat(21)}`)
    assert(decimal(1e23).toString() === `1${'0'.repeat(23)}`)
    assert(decimal(1.5e300).toString() === `15${'0'.repeat(299)}`)
    assert(decimal(1e23).eq('1e23'))
    assert(decimal(1.5e-7).toString() === '0.00000015')
    assert(decimal(5e-324).toString() === `0.${'0'.repeat(323)}5`)
    assert(decimal(Number.MAX_VALUE).toNumber() === Number.MAX_VALUE)
    assert(decimal(Number.MIN_VALUE).toNumber() === Number.MIN_VALUE)
  })

  it('bounds the exponent without rejecting long digit strings', () => {
    assert(decimal('1e10000').toString() === `1${'0'.repeat(10000)}`)
    assert(decimal('-1e10000').eq(`-1${'0'.repeat(10000)}`))
    assert(decimal('1e-10000').toString() === `0.${'0'.repeat(9999)}1`)
    for (const text of ['1e10001', '-1e10001', '1e-10001', '1e1000000', `1e${'9'.repeat(400)}`]) {
      assert.throws(() => decimal(text), RangeError, text)
    }
    assert(decimal(`0.${'0'.repeat(20000)}1e20001`).toString() === '1')
    assert(decimal(`1.${'1'.repeat(20000)}e0`).toString() === `1.${'1'.repeat(20000)}`)
    assert(decimal(`1${'0'.repeat(20000)}`).toString() === `1${'0'.repeat(20000)}`)
  })

  it('reads a long run of trailing zeros in linear time', () => {
    const start = performance.now()
    const value = decimal(`-1${'0'.repeat(100000)}`)
    assert(performance.now() - start < 1000)
    assert(value.toString() === `-1${'0'.repeat(100000)}`)
    assert(decimal(`0.5${'0'.repeat(100000)}`).toString() === '0.5')
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

  it('adds across a wide gap in scale in one step', () => {
    const tiny = decimal(`0.${'0'.repeat(300000)}1`)
    const start = performance.now()
    const sum = tiny.add(1)
    assert(tiny.lt(1))
    assert(performance.now() - start < 500)
    assert(sum.toString() === `1.${'0'.repeat(300000)}1`)
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

  it('div keeps the precision whatever the trailing zeros', () => {
    assert(decimal(10).div(3).toString() === '3.33333333333333333333')
    assert(decimal(1000).div(3).toString() === '333.33333333333333333333')
    assert(decimal('1000').div('3000').toString() === '0.33333333333333333333')
    assert(
      decimal(`1${'0'.repeat(21)}`)
        .div(3)
        .toString() === `${'3'.repeat(21)}.${'3'.repeat(20)}`
    )
    assert(
      decimal(`1${'0'.repeat(21)}`)
        .div(`3${'0'.repeat(21)}`)
        .eq(decimal(1).div(3))
    )
    assert(decimal(-1000).div(3).toString() === '-333.33333333333333333333')
    assert(decimal(1000).div('0.3').toString() === '3333.33333333333333333333')
    assert(
      decimal(`1${'0'.repeat(30)}`)
        .div(`1${'0'.repeat(30)}`)
        .toString() === '1'
    )
    assert(decimal('0.1').div(3).toString() === '0.0333333333333333333333')
    assert(decimal(11).div(3).toString() === '3.66666666666666666666')
  })

  it('eq is false for values that are not numbers', () => {
    for (const value of ['abc', '', NaN, Infinity, -Infinity, {}, Symbol('x')]) {
      assert(decimal(1).eq(value) === false, String(value))
    }
  })

  it('a zero result prints as zero', () => {
    assert(decimal('100').sub('100').toString() === '0')
    assert(decimal('100').add('-100').toString() === '0')
    assert(decimal('1000').mul(0).toString() === '0')
    assert(decimal(0).mul('100').toString() === '0')
    assert(decimal('1.5').sub('1.5').toString() === '0.0')
  })

  it('zero equals zero at any scale', () => {
    assert(decimal('0.00').eq(0))
    assert(decimal(0).eq('0.00'))
    assert(decimal('0.0').eq('0.00'))
    assert(decimal('1.5').sub('1.5').eq(0))
    assert(decimal(0).div(3).eq(0))
    assert(decimal('0.00').compare(0) === 0)
    assert(!decimal('0.00').gt(0))
    assert(decimal('0.00').lte(0))
    assert(!decimal('0.00').eq('0.01'))
  })

  it('sqrt rounds the last digit once', () => {
    assert(decimal(154448).sqrt().toString() === '392.99872773330958965454')
    assert(decimal('9008856.40103').sqrt().toString() === '3001.47570388800582075067')
    assert(decimal('72746.86').sqrt().toString() === '269.71625831603107125289')
    assert(decimal('0.000000000000271').sqrt().toString() === '0.00000052057660339281')
    assert(decimal(99).sqrt().toString() === '9.94987437106619954734')
    assert(decimal(1000).sqrt().toString() === '31.62277660168379331999')
    assert(decimal(4).sqrt().toString() === '2')
    assert(decimal('0.25').sqrt().toString() === '0.5')
    assert(decimal(0).sqrt().eq(0))
    assert(decimal('1e-50').sqrt().eq(0))
  })

  it('sqrt converges whatever the digit count', () => {
    assert(
      decimal(`1${'0'.repeat(70)}1`)
        .sqrt()
        .toString() === '316227766016837933199889354443271853.37195551393252168269'
    )
    assert(
      decimal(`2${'0'.repeat(80)}`)
        .sqrt()
        .toString() === '14142135623730950488016887242096980785696.7187537694807317668'
    )
    assert(
      decimal(`0.${'1234567890'.repeat(7)}123`)
        .sqrt()
        .toString() === '0.35136418288201442531'
    )
    assert(
      decimal('1234567890'.repeat(8)).sqrt().toString() ===
        '3513641828820144253111222381699882939174.84087723940033681655'
    )
    const value = decimal(`7${'1'.repeat(10000)}`)
    const root = value.sqrt()
    const gap = root.mul(root).sub(value)
    assert(gap.lt('1e4990') && gap.gt('-1e4990'))
  })

  it('sqrt rejects a negative value', () => {
    for (const value of [-1, -4, '-0.5']) {
      assert.throws(() => decimal(value).sqrt(), ValueError, String(value))
      assert(Decimal.PRECISION === 20)
    }
    assert(decimal(1).div(3).toString() === '0.33333333333333333333')
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

  it('eq answers false for null, undefined and booleans', () => {
    assert(!decimal('0').eq(null))
    assert(!decimal('0').eq(undefined))
    assert(!decimal(1).eq(true))
    assert(!decimal(0).eq(false))
  })

  it('compare still reads null and booleans as numbers', () => {
    assert(decimal(0).compare(null) === 0)
    assert(!decimal(0).gt(null))
    assert(decimal(0).lte(null))
    assert(decimal(1).lte(true))
  })
})
