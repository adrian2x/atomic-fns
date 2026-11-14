import { describe, expect, it } from 'vitest'
import { Decimal, type RoundingMode } from '../../src/decimal/index.ts'
import { d } from './helpers.ts'

const MODES: RoundingMode[] = [
  'ceil',
  'floor',
  'expand',
  'trunc',
  'halfCeil',
  'halfFloor',
  'halfExpand',
  'halfTrunc',
  'halfEven'
]

/** `value` rounded to `digits` in every mode, as `[ceil, floor, ..., halfEven]`. */
const everyMode = (value: string, digits: number) =>
  MODES.map((mode) => d(value).round(digits, mode).toString())

describe('rounding modes', () => {
  it('round ties and remainders as Intl.NumberFormat names them', () => {
    // ceil floor expand trunc halfCeil halfFloor halfExpand halfTrunc halfEven
    expect(everyMode('2.5', 0)).toEqual(['3', '2', '3', '2', '3', '2', '3', '2', '2'])
    expect(everyMode('-2.5', 0)).toEqual(['-2', '-3', '-3', '-2', '-2', '-3', '-3', '-2', '-2'])
    expect(everyMode('1.5', 0)).toEqual(['2', '1', '2', '1', '2', '1', '2', '1', '2'])
    expect(everyMode('-1.5', 0)).toEqual(['-1', '-2', '-2', '-1', '-1', '-2', '-2', '-1', '-2'])
    expect(everyMode('0.125', 2)).toEqual([
      '0.13',
      '0.12',
      '0.13',
      '0.12',
      '0.13',
      '0.12',
      '0.13',
      '0.12',
      '0.12'
    ])
    expect(everyMode('-0.125', 0)).toEqual(['0', '-1', '-1', '0', '0', '0', '0', '0', '0'])
    expect(everyMode('2.6', 0)).toEqual(['3', '2', '3', '2', '3', '3', '3', '3', '3'])
    expect(everyMode('2.5', 2)).toEqual(Array(9).fill('2.5'))
  })

  it('refuse an unknown mode, even when nothing needs rounding', () => {
    const bad = 'halfUp' as RoundingMode
    expect(() => d('1.9').round(0, bad)).toThrow(/roundingMode must be one of/)
    expect(() => d(1).round(2, bad)).toThrow(RangeError)
    expect(() => d(5).divide(2, { roundingMode: bad })).toThrow(RangeError)
    expect(() => d(2).sqrt({ roundingMode: bad })).toThrow(RangeError)
    expect(() => d(2).toFixed(1, bad)).toThrow(RangeError)
  })
})

describe('divide', () => {
  it('rounds to 34 significant digits by default, half to even', () => {
    expect(d(1).divide(3).toString()).toBe(`0.${'3'.repeat(34)}`)
    expect(d(2).divide(3).toString()).toBe(`0.${'6'.repeat(33)}7`)
    expect(d(11).divide(3).toString()).toBe(`3.${'6'.repeat(32)}7`)
    expect(d('0.1').divide(3).toString()).toBe(`0.0${'3'.repeat(34)}`)
    expect(d(1000).divide('0.3').toString()).toBe(`3333.${'3'.repeat(30)}`)
    expect(d('1e10000').divide(3).toString()).toBe(`3.${'3'.repeat(33)}e+9999`)
  })

  it('keeps the scale of small quotients and the digits of exact ones', () => {
    expect(d('1e-30').divide(1).toString()).toBe(`0.${'0'.repeat(29)}1`)
    expect(d('1e-30').divide(3).toString()).toBe(`0.${'0'.repeat(30)}${'3'.repeat(34)}`)
    expect(d(1).divide(8).toString()).toBe('0.125')
    expect(
      d(`1${'0'.repeat(30)}`)
        .divide(`1${'0'.repeat(30)}`)
        .toString()
    ).toBe('1')
    expect(
      d(1)
        .divide(2n ** 15_000n)
        .toString()
    ).toBe('3.548665303440282824232502561095699e-4516')
  })

  it('takes a significant-digit precision and a rounding mode', () => {
    expect(d(1).divide(3, { precision: 30 }).toString()).toBe(`0.${'3'.repeat(30)}`)
    expect(d(2).divide(3, { precision: 2, roundingMode: 'trunc' }).toString()).toBe('0.66')
    expect(d('0.125').divide(1, { precision: 2 }).toString()).toBe('0.12')
    expect(d(10).divide(3, { precision: 2, roundingMode: 'ceil' }).toString()).toBe('3.4')
    expect(d(-7).divide(2, { precision: 1 }).toString()).toBe('-4')
    expect(d('9.99').divide(1, { precision: 2 }).toString()).toBe('10')
    expect(d(1).divide(9, { precision: 1, roundingMode: 'expand' }).toString()).toBe('0.2')
  })

  it('refuses a zero divisor, a precision out of range and options that are not an object', () => {
    expect(() => d(1).divide(0)).toThrow('division by zero')
    for (const precision of [0, -1, 1.5, 10_001, Number.NaN]) {
      expect(() => d(1).divide(3, { precision }), String(precision)).toThrow(RangeError)
    }
    expect(() => d(1).divide(8, { precision: 10_001 })).toThrow(
      new RangeError('precision must be an integer from 1 to 10000')
    )
    expect(() => d(1).divide(3, 2 as never)).toThrow(new TypeError('options must be an object'))
  })

  it('bounds the rounded result, not an estimate', () => {
    const third = d(1).divide(3, { precision: 10_000 })
    expect(third.multiply(2).equals(`0.${'6'.repeat(10_000)}`)).toBe(true)
    expect(third.divide(4).toString()).toBe(`0.08${'3'.repeat(33)}`)
    expect(() => d('1e10000').divide('0.1')).toThrow('exponent out of range')
    expect(() => d('1e-10000').divide(10)).toThrow('exponent out of range')
    expect(() => d('0.1').divide('1e10000')).toThrow('exponent out of range')
    expect(() => d('1e-9990').divide(3)).toThrow('exponent out of range')
    expect(d('1e-9990').divide(3, { precision: 10 }).toString()).toBe('3.333333333e-9991')
  })

  it('divides coprime operands at the digit bound', () => {
    let [previous, current] = [0n, 1n]
    const threshold = 10n ** 9999n
    while (current < threshold) [previous, current] = [current, previous + current]
    expect(d(current).divide(previous).toString()).toBe('1.618033988749894848204586834365638')
    expect(d(1).divide(3, { precision: Decimal.MAX_DIGITS }).toPlainString()).toBe(
      `0.${'3'.repeat(Decimal.MAX_DIGITS)}`
    )
  })

  it('matches exact division on 5000 terminating quotients', () => {
    let state = 0xdec15d1
    const rand = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0)
    for (let n = 0; n < 5000; n++) {
      const a = BigInt((rand() % 10_000) + 1) * (rand() & 1 ? -1n : 1n)
      const twos = rand() % 20
      const fives = rand() % 12
      const m = Math.max(twos, fives)
      const b = 2n ** BigInt(twos) * 5n ** BigInt(fives)
      const exact = `${String(a * 2n ** BigInt(m - twos) * 5n ** BigInt(m - fives))}e-${String(m)}`
      expect(d(a).divide(b).equals(exact)).toBe(true)
    }
  })
})

describe('remainder', () => {
  it('keeps the sign of the dividend, as % does', () => {
    expect(d('7.5').remainder(2).toString()).toBe('1.5')
    expect(d('-7.5').remainder(2).toString()).toBe('-1.5')
    expect(d('7.5').remainder(-2).toString()).toBe('1.5')
    expect(d('1').remainder('0.3').toString()).toBe('0.1')
    expect(d('0.5').remainder(3).toString()).toBe('0.5')
    expect(d(6).remainder(3).toString()).toBe('0')
    expect(d('1e9999').remainder(7).toString()).toBe(String(10n ** 9999n % 7n))
  })

  it('refuses a zero divisor', () => {
    expect(() => d(1).remainder(0)).toThrow('division by zero')
  })
})

describe('round', () => {
  it('rounds to fractional digits, or to tens with a negative count', () => {
    expect(d('2.5').round().toString()).toBe('2')
    expect(d('1.2345').round(2).toString()).toBe('1.23')
    expect(d(15).round(-1).toString()).toBe('20')
    expect(d(-15).round(-1, 'halfExpand').toString()).toBe('-20')
    expect(d(-15).round(-1, 'halfTrunc').toString()).toBe('-10')
    expect(d('1234').round(-2).toString()).toBe('1200')
  })

  it('rounds to zero or one unit when the unit is far above the value', () => {
    for (const mode of MODES) {
      const got = d('1.5').round(-5, mode).toString()
      expect(got).toBe(mode === 'expand' || mode === 'ceil' ? '100000' : '0')
    }
  })

  it('refuses digits out of range and a result past the exponent bound', () => {
    for (const digits of [1.5, -10_001, 10_001, -3e8]) {
      expect(() => d('1.5').round(digits), String(digits)).toThrow(RangeError)
    }
    expect(() => d('1.5').round(10_001)).toThrow(
      new RangeError('digits must be an integer from -10000 to 10000')
    )
    expect(() => d(`${'9'.repeat(Decimal.MAX_DIGITS)}e9999`).round(-10_000, 'ceil')).toThrow(
      'exponent out of range'
    )
  })

  it('rounds a value at the digit cap when the result fits', () => {
    const max = d('9'.repeat(Decimal.MAX_DIGITS))
    expect(max.round(0).equals(max)).toBe(true)
    expect(
      d(`0.${'9'.repeat(Decimal.MAX_DIGITS)}`)
        .round(0)
        .toString()
    ).toBe('1')
  })
})

describe('toFixed', () => {
  it('pads or rounds to exactly the given digits, half away from zero', () => {
    expect(d('2.5').toFixed()).toBe('3')
    expect(d('-2.5').toFixed()).toBe('-3')
    expect(d('1.005').toFixed(2)).toBe('1.01')
    expect(d('3').toFixed(2)).toBe('3.00')
    expect(d('0.1').toFixed(3)).toBe('0.100')
    expect(d('1e21').toFixed(1)).toBe(`1${'0'.repeat(21)}.0`)
    expect(d('-0.4').toFixed()).toBe('0')
    expect(d('2.5').toFixed(0, 'halfEven')).toBe('2')
  })

  it('refuses digits out of range', () => {
    expect(() => d(1).toFixed(-1)).toThrow(
      new RangeError('digits must be an integer from 0 to 10000')
    )
    expect(() => d(1).toFixed(10_001)).toThrow(RangeError)
  })
})

describe('sqrt', () => {
  it('rounds the true root to 34 significant digits by default', () => {
    expect(d(2).sqrt().toString()).toBe('1.414213562373095048801688724209698')
    expect(d(10).sqrt().toString()).toBe('3.162277660168379331998893544432719')
    expect(d(154448).sqrt().toString()).toBe('392.9987277333095896545449188193973')
    expect(d('9008856.40103').sqrt().toString()).toBe('3001.475703888005820750674532832112')
    expect(d('0.000000000000271').sqrt().toString()).toBe(
      '0.0000005205766033928148023641551664622255'
    )
    expect(d('6.25').sqrt().toString()).toBe('2.5')
    expect(d(0).sqrt().toString()).toBe('0')
    expect(d('1e-40').sqrt().toString()).toBe('0.00000000000000000001')
    expect(d('1e-50').sqrt().toString()).toBe(`0.${'0'.repeat(24)}1`)
    expect(d('1e10000').sqrt().toString()).toBe('1e+5000')
  })

  it('takes a significant-digit precision and a rounding mode', () => {
    expect(d(2).sqrt({ precision: 5 }).toString()).toBe('1.4142')
    expect(d('6.25').sqrt({ precision: 1 }).toString()).toBe('2')
    expect(d('6.25').sqrt({ precision: 1, roundingMode: 'halfExpand' }).toString()).toBe('3')
    expect(d(99).sqrt({ precision: 1 }).toString()).toBe('10')
    for (const mode of MODES) {
      const expected = mode === 'ceil' || mode === 'expand' ? '2' : '1'
      expect(d(2).sqrt({ precision: 1, roundingMode: mode }).toString()).toBe(expected)
      expect(d('1.01').sqrt({ precision: 1, roundingMode: mode }).toString()).toBe(expected)
    }
    expect(d('1.96101').sqrt({ precision: 2, roundingMode: 'expand' }).toString()).toBe('1.5')
    expect(d('250559e-10').sqrt({ precision: 1, roundingMode: 'halfTrunc' }).toString()).toBe(
      '0.005'
    )
    expect(
      d(`1.${'0'.repeat(49)}1`)
        .sqrt({ roundingMode: 'ceil' })
        .toString()
    ).toBe(`1.${'0'.repeat(32)}1`)
  })

  it('refuses a precision out of range and options that are not an object', () => {
    for (const precision of [0, 1.5, 10_001]) {
      expect(() => d(2).sqrt({ precision }), String(precision)).toThrow(RangeError)
    }
    expect(() => d(4).sqrt({ precision: 10_001 })).toThrow(
      new RangeError('precision must be an integer from 1 to 10000')
    )
    expect(() => d(2).sqrt(5 as never)).toThrow(new TypeError('options must be an object'))
  })

  it('converges whatever the digit count', () => {
    expect(
      d(`1${'0'.repeat(70)}1`)
        .sqrt()
        .toString()
    ).toBe('316227766016837933199889354443271900')
    expect(
      d(`1${'0'.repeat(70)}1`)
        .sqrt({ precision: 56 })
        .toString()
    ).toBe('316227766016837933199889354443271853.37195551393252168269')
    expect(d('1234567890'.repeat(8)).sqrt({ precision: 60 }).toString()).toBe(
      '3513641828820144253111222381699882939174.84087723940033681655'
    )
    const digits = '1'.repeat(9999)
    const root = d(`${digits}.1`).sqrt({ precision: 5000, roundingMode: 'trunc' }).toBigInt()
    const n = BigInt(`${digits}1`)
    expect(10n * root * root <= n && 10n * (root + 1n) * (root + 1n) > n).toBe(true)
  })

  it.each([
    ['0.5', 10_000, 5n * 10n ** 19_999n],
    ['2', 9999, 2n * 10n ** 19_998n],
    ['2e10000', 4999, 2n * 10n ** 19_998n]
  ] as const)('reaches the digit bound for %s', (value, places, radicand) => {
    const printed = d(value).sqrt({ precision: 10_000, roundingMode: 'trunc' }).toPlainString()
    expect(printed.split('.')[1]).toHaveLength(places)
    const root = BigInt(printed.replace('.', ''))
    expect(root * root <= radicand && (root + 1n) * (root + 1n) > radicand).toBe(true)
  })

  it('throws when the last digit of the rounded root falls below the exponent bound', () => {
    expect(d('2e-10000').sqrt({ precision: 5001 }).toString()).toMatch(
      /^1\.41421356\d{4992}e-5000$/
    )
    expect(() => d('2e-10000').sqrt({ precision: 5002 })).toThrow('exponent out of range')
  })

  it('refuses a negative value', () => {
    for (const value of [-1, '-0.5']) {
      expect(() => d(value).sqrt()).toThrow('square root of a negative number')
    }
  })
})
