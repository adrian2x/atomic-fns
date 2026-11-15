import { inspect } from 'node:util'
import { describe, expect, it, vi } from 'vitest'
import { Decimal } from '../../src/decimal/index.ts'

const d = (value: string | number | bigint) => new Decimal(value)
const MAX_INPUT_LENGTH = 2 * Decimal.MAX_EXPONENT + Decimal.MAX_DIGITS + 32

/** Fastest of three runs, in milliseconds. */
function fastest(fn: () => void): number {
  let best = Number.POSITIVE_INFINITY
  for (let run = 0; run < 3; run++) {
    const start = performance.now()
    fn()
    best = Math.min(best, performance.now() - start)
  }
  return best
}

describe('construction', () => {
  it('reads decimal strings, with or without exponent', () => {
    expect(d('1e3').toString()).toBe('1000')
    expect(d('1E3').toString()).toBe('1000')
    expect(d('  +1.5  ').toString()).toBe('1.5')
    expect(d('.5').toString()).toBe('0.5')
    expect(d('-.5').toString()).toBe('-0.5')
    expect(d('5.').toString()).toBe('5')
    expect(d('007').toString()).toBe('7')
    expect(d(' +.5e1 ').toString()).toBe('5')
    expect(d('-1.5E+3').toString()).toBe('-1500')
    expect(d('1234e-2').toString()).toBe('12.34')
    expect(d('1.2345678901234567890123e5').toString()).toBe('123456.78901234567890123')
  })

  it('reads every spelling of zero as 0', () => {
    for (const zero of ['0', '+0', '-0', ' 0', '0.', '.0', '0.000', '0e5', '-0e-5', '0e99999999']) {
      expect(d(zero).toString()).toBe('0')
    }
  })

  it('reads a number through its shortest round-trip string', () => {
    expect(d(0.1).toString()).toBe('0.1')
    expect(d(0.1).add(0.2).toString()).toBe('0.3')
    expect(d(-0).toString()).toBe('0')
    expect(d(1e21).toString()).toBe('1000000000000000000000')
    expect(d(1.5e-7).toString()).toBe('0.00000015')
    expect(d(Number.MAX_VALUE).toNumber()).toBe(Number.MAX_VALUE)
    expect(d(Number.MIN_VALUE).toNumber()).toBe(Number.MIN_VALUE)
    expect(d(5e-324).toString()).toBe('5e-324')
  })

  it('reads a bigint and another Decimal', () => {
    expect(d(2n ** 64n).toString()).toBe('18446744073709551616')
    expect(d(-10n).toString()).toBe('-10')
    expect(new Decimal(d('2.5')).toString()).toBe('2.5')
  })

  it('refuses malformed strings and non-finite numbers with RangeError', () => {
    for (const bad of ['', ' ', 'abc', '1.2.3', '1,000', '--1', '.', 'e5', '1e', '1e1.5', '0x10']) {
      expect(() => d(bad), bad).toThrow(RangeError)
    }
    expect(() => d('Infinity')).toThrow(/invalid decimal string: "Infinity"/)
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => d(bad)).toThrow(RangeError)
    }
  })

  it('refuses other types with TypeError', () => {
    for (const bad of [null, undefined, true, {}, [], [5], new Date(5), Symbol('x')]) {
      expect(() => new Decimal(bad as never)).toThrow(TypeError)
    }
  })

  it('cuts long bad input in the error message', () => {
    const bad = `${'1'.repeat(40)}x`
    expect(() => d(bad)).toThrow(`invalid decimal string: "${'1'.repeat(40)}"...`)
    expect(() => d(`${'😀'.repeat(30)}`)).toThrow(`invalid decimal string: "${'😀'.repeat(20)}"...`)
  })

  it('parses in time linear in the input', () => {
    const shapes = (n: number) => [
      `${'1'.repeat(n)}x`,
      `.${'1'.repeat(n - 1)}x`,
      `-${'1'.repeat(n - 1)}x`,
      `${'1'.repeat(n - 2)}.x`,
      `${'1'.repeat(n - 2)}ex`,
      `${' '.repeat(n)}x`,
      `${' '.repeat(Math.floor(n / 2))}1${' '.repeat(Math.ceil(n / 2) - 2)}x`
    ]
    const refuse = (bad: string) => fastest(() => expect(() => d(bad)).toThrow(RangeError))
    const n = MAX_INPUT_LENGTH - 1
    const short = shapes(Math.floor(n / 8))
    shapes(n).forEach((bad, k) => {
      expect(bad.length).toBeLessThanOrEqual(MAX_INPUT_LENGTH)
      expect(refuse(bad), bad.slice(0, 8)).toBeLessThan(16 * refuse(short[k]) + 5)
    })
  })
})

describe('bounds', () => {
  it('exposes them as read-only statics', () => {
    expect(Decimal.MAX_DIGITS).toBe(10_000)
    expect(Decimal.MAX_EXPONENT).toBe(10_000)
    for (const name of ['MAX_DIGITS', 'MAX_EXPONENT']) {
      expect(Reflect.set(Decimal, name, 5)).toBe(false)
    }
  })

  it('counts significant digits, so trailing and leading zeros are free', () => {
    const max = '9'.repeat(Decimal.MAX_DIGITS)
    expect(d(max).toPlainString()).toBe(max)
    expect(d(`1${'0'.repeat(10_000)}`).equals('1e10000')).toBe(true)
    expect(d(`0.${'0'.repeat(9_999)}1`).equals('1e-10000')).toBe(true)
    expect(() => d(`${max}9`)).toThrowError(new RangeError('result exceeds 10000 digits'))
  })

  it('bounds the stored exponent, not the written one', () => {
    expect(d('10e-10001').equals('1e-10000')).toBe(true)
    expect(d('0.1e10001').equals('1e10000')).toBe(true)
    expect(d(`${'7'.repeat(10_000)}e10000`).toString()).toBe(
      `${'7'.repeat(1)}.${'7'.repeat(9999)}e+19999`
    )
    for (const bad of ['1e10001', '-1e10001', '1e-10001', '1e1000000', `1e${'9'.repeat(400)}`]) {
      expect(() => d(bad), bad).toThrow('exponent out of range')
    }
  })

  it('caps the input length', () => {
    expect(() => d('1'.repeat(MAX_INPUT_LENGTH + 1))).toThrow(
      `decimal string longer than ${String(MAX_INPUT_LENGTH)} characters`
    )
  })

  it('refuses bigints past every Decimal', () => {
    expect(() => d(10n ** 30_000n)).toThrow('exponent out of range')
    expect(() => d(10n ** 30_000n + 1n)).toThrow('result exceeds 10000 digits')
    expect(d(10n ** 10_000n).equals('1e10000')).toBe(true)
    const odd = (bits: number) => (1n << BigInt(bits)) + 1n
    const refuse = (big: bigint) => fastest(() => expect(() => d(big)).toThrow(RangeError))
    expect(refuse(odd(2 ** 21))).toBeLessThan(64 * refuse(odd(2 ** 17)) + 5)
    const zeros = (count: number) => 10n ** BigInt(count)
    expect(refuse(zeros(2 ** 20))).toBeLessThan(8 * refuse(zeros(2 ** 18)) + 5)
  })

  it('applies to results, after normalizing', () => {
    expect(() => d('1e9999').add('1e-9999')).toThrow('result exceeds 10000 digits')
    expect(() => d('9'.repeat(5001)).multiply('9'.repeat(5000))).toThrow(RangeError)
    expect(() => d('1e10000').multiply(10)).toThrow('exponent out of range')
    expect(
      d(5n ** 10_000n)
        .multiply(2n ** 10_000n)
        .equals('1e10000')
    ).toBe(true)
    expect(
      d(1)
        .subtract('1e-10000')
        .equals(`0.${'9'.repeat(10_000)}`)
    ).toBe(true)
    expect(
      d('1e9999')
        .subtract(`${'9'.repeat(9999)}.9`)
        .equals('0.1')
    ).toBe(true)
  })
})

describe('arithmetic', () => {
  it('adds, subtracts and multiplies exactly', () => {
    expect(d('50000000000').add('0.00000000000000000005').toString()).toBe(
      '50000000000.00000000000000000005'
    )
    expect(d('0.1').add('0.1').add('0.1').toString()).toBe('0.3')
    expect(d('1').subtract('0.0000000000000000001').toString()).toBe('0.9999999999999999999')
    expect(d('0.0000000000000000000025').multiply('400000000000000000000').toString()).toBe('1')
    expect(d('1.5').multiply(-2).toString()).toBe('-3')
    expect(d(2).add(1n).toString()).toBe('3')
  })

  it('prints a zero result as 0', () => {
    expect(d('100').subtract('100').toString()).toBe('0')
    expect(d('1.5').subtract('1.5').toString()).toBe('0')
    expect(d('1000').multiply(0).toString()).toBe('0')
    expect(d(0).negate().toString()).toBe('0')
    expect(d(0).negate().equals(0)).toBe(true)
  })

  it('negates and takes the absolute value', () => {
    expect(d('5').negate().toString()).toBe('-5')
    expect(d('-1.50').negate().toString()).toBe('1.5')
    expect(d('-1.5').abs().toString()).toBe('1.5')
    expect(d('1.5').abs().toString()).toBe('1.5')
    const widest = d(`-${'7'.repeat(Decimal.MAX_DIGITS)}e${String(Decimal.MAX_EXPONENT)}`)
    expect(widest.negate().toString()).toBe(`7.${'7'.repeat(9999)}e+19999`)
    expect(widest.negate().negate().equals(widest)).toBe(true)
  })

  it('adds across a wide gap in scale in one step', () => {
    const tiny = d('1e-9999')
    expect(fastest(() => tiny.add(1))).toBeLessThan(500)
    expect(tiny.add(1).toPlainString()).toBe(`1.${'0'.repeat(9998)}1`)
  })

  it('makes no base-10 conversion in running totals', () => {
    const toString = vi.spyOn(BigInt.prototype, 'toString')
    try {
      let total = d(0)
      for (let i = 0; i < 1400; i++) total = total.add(i % 2 ? '1e-9' : '1e9980')
      expect(toString.mock.calls.filter(([radix]) => (radix ?? 10) === 10)).toHaveLength(0)
      expect(total.greaterThan(0)).toBe(true)
    } finally {
      toString.mockRestore()
    }
  })
})

describe('comparison', () => {
  it('orders by value, whatever the written form', () => {
    expect(d('1.10').compare('1.1')).toBe(0)
    expect(d('-2').compare(1)).toBe(-1)
    expect(d('0.00000000000000000000255').compare('0.0000000000000000000025')).toBe(1)
    expect(d('-0.001').compare('-0.01')).toBe(1)
    expect(d('1e-9999').compare('1e9999')).toBe(-1)
    expect(d(0).compare('-0')).toBe(0)
    expect(d('0.1').compare(0.1)).toBe(0)
    expect(d(2n ** 60n).compare(2 ** 60)).toBe(-1)
    expect(d(2 ** 60).toString()).toBe('1152921504606847000')
  })

  it('answers the relational methods', () => {
    const a = d('0.0000000000000000000025')
    const b = d('0.00000000000000000000255')
    expect(a.lessThan(b)).toBe(true)
    expect(a.lessThanOrEqual(a)).toBe(true)
    expect(a.lessThanOrEqual(b)).toBe(true)
    expect(b.lessThanOrEqual(a)).toBe(false)
    expect(b.greaterThan(a)).toBe(true)
    expect(b.greaterThanOrEqual('0.00000000000000000000255')).toBe(true)
    expect(b.greaterThanOrEqual(a)).toBe(true)
    expect(a.greaterThanOrEqual(b)).toBe(false)
    expect(a.greaterThan(b)).toBe(false)
    expect(d('2.50').equals('2.5')).toBe(true)
    expect(d('2.5').equals(2.51)).toBe(false)
  })

  it('sorts with the static compare', () => {
    const values = ['10', '9', '-1e3', '9.5', '0.1e2'].map((s) => d(s))
    expect(values.toSorted(Decimal.compare).map(String)).toEqual(['-1000', '9', '9.5', '10', '10'])
    expect(Decimal.compare('1', 2)).toBe(-1)
  })

  it('converts the other argument as the constructor does', () => {
    expect(() => d(1).compare('x')).toThrow(RangeError)
    expect(() => d(1).equals(Number.NaN)).toThrow(RangeError)
    expect(() => d(1).lessThan(null as never)).toThrow(TypeError)
  })

  it('agrees with scaling on 1,000 seeded pairs', () => {
    let state = 0xdec23c3
    const rand = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0)
    const scaled = (i: bigint, e: number, k: number) => (e > k ? i * 10n ** BigInt(e - k) : i)
    for (let n = 0; n < 1000; n++) {
      const ai = BigInt(rand()) - 2_147_483_648n
      const bi = BigInt(rand() % 1000) - 500n
      const ae = (rand() % 81) - 40
      const be = (rand() % 81) - 40
      const low = Math.min(ae, be)
      const x = scaled(ai, ae, low)
      const y = scaled(bi, be, low)
      expect(d(`${String(ai)}e${String(ae)}`).compare(`${String(bi)}e${String(be)}`)).toBe(
        x < y ? -1 : x > y ? 1 : 0
      )
    }
  })

  it('reads magnitude first, so extreme exponents compare fast', () => {
    const values = Array.from({ length: 200 }, (_, i) => d(i % 2 ? '1e-9999' : '1e9999'))
    expect(fastest(() => values.toSorted(Decimal.compare))).toBeLessThan(500)
    const wide = Array.from({ length: 9 }, (_, k) => d(`${String(k + 1)}${'9'.repeat(9999)}`))
    wide[0].compare(wide[1])
    const toString = vi.spyOn(BigInt.prototype, 'toString')
    try {
      wide[0].compare(wide[1])
      expect(toString).not.toHaveBeenCalled()
    } finally {
      toString.mockRestore()
    }
  })

  it('compares bigints with trailing zeros within the exponent bound', () => {
    expect(d(12_345_678_901n * 10n ** 10_000n).compare(12_345_678_901n * 10n ** 10_000n)).toBe(0)
  })
})

describe('conversion', () => {
  it('prints plain while that pads at most 64 zeros, then scientific', () => {
    expect(d('1e64').toString()).toBe(`1${'0'.repeat(64)}`)
    expect(d('1e65').toString()).toBe('1e+65')
    expect(d('-25e64').toString()).toBe(`-25${'0'.repeat(64)}`)
    expect(d('25e65').toString()).toBe('2.5e+66')
    expect(d('1e-65').toString()).toBe(`0.${'0'.repeat(64)}1`)
    expect(d('1e-66').toString()).toBe('1e-66')
    expect(d('-12e-66').toString()).toBe(`-0.${'0'.repeat(64)}12`)
    expect(d('12e-67').toString()).toBe('1.2e-66')
    expect(d('1.5e300').toString()).toBe('1.5e+300')
  })

  it('expands any value with toPlainString', () => {
    expect(d('1e10000').toPlainString()).toBe(`1${'0'.repeat(10_000)}`)
    expect(d('-1e-10000').toPlainString()).toBe(`-0.${'0'.repeat(9999)}1`)
    expect(d('-12.5').toPlainString()).toBe('-12.5')
    expect(d(0).toPlainString()).toBe('0')
  })

  it('reads every printed form back to the same value', () => {
    for (const shape of [
      '0',
      '1e65',
      '-1.5e-70',
      '1e10000',
      '1e-10000',
      `${'7'.repeat(10_000)}e10000`,
      `-${'7'.repeat(10_000)}e-10000`
    ]) {
      const value = d(shape)
      expect(d(value.toString()).equals(value)).toBe(true)
      expect(d(value.toPlainString()).equals(value)).toBe(true)
      expect(d(JSON.parse(JSON.stringify(value)) as string).equals(value)).toBe(true)
    }
  })

  it('serializes as its string in JSON and template literals', () => {
    expect(JSON.stringify({ price: d('1.50') })).toBe('{"price":"1.5"}')
    expect(`${d('2.5')}`).toBe('2.5')
    expect(String(d('1e100'))).toBe('1e+100')
  })

  it('returns the nearest number', () => {
    for (const s of [
      '0.1',
      '123.456',
      '1e9999',
      '-1.5e-9999',
      '1.00000000000000011102230246251565404236316680908203126',
      '2.47032822920623272089e-324',
      '1.797693134862315807937289714053e308'
    ]) {
      expect(d(s).toNumber(), s).toBe(Number(s))
    }
    let state = 0x5eed
    const rand = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) >>> 8
    for (let n = 0; n < 2000; n++) {
      const digits = Array.from({ length: 18 + (rand() % 30) }, () => rand() % 10).join('')
      const s = `${String(1 + (rand() % 9))}.${digits}e${String((rand() % 600) - 300)}`
      expect(d(s).toNumber()).toBe(Number(s))
    }
  })

  it('returns a bigint for an integer and refuses a fraction', () => {
    expect(d('1.2e3').toBigInt()).toBe(1200n)
    expect(d('-7').toBigInt()).toBe(-7n)
    expect(d(0).toBigInt()).toBe(0n)
    expect(() => d('1.5').toBigInt()).toThrow(RangeError)
    expect(() => d(`1.${'1'.repeat(9999)}`).toBigInt()).toThrow(
      `"1.${'1'.repeat(38)}"... is not an integer`
    )
  })

  it('formats with Intl.NumberFormat without losing digits', () => {
    expect(d('12345678901234567.25').toLocaleString('en-US', { maximumFractionDigits: 2 })).toBe(
      '12,345,678,901,234,567.25'
    )
    expect(d('1234.5678').toLocaleString('de-DE')).toBe('1.234,568')
    expect(d('0.5').toLocaleString('en-US', { style: 'percent' })).toBe('50%')
    expect(d(String(Number.MAX_VALUE)).toLocaleString('en-US').length).toBeGreaterThan(300)
    expect(() => d('1e309').toLocaleString()).toThrow(RangeError)
    expect(() => d('-1e400').toLocaleString()).toThrow(RangeError)
    expect(() => d('1.5e-330').toLocaleString('en-US', { notation: 'scientific' })).toThrow(
      RangeError
    )
    expect(d('5e-324').toLocaleString('en-US', { notation: 'scientific' })).toBe('5E-324')
    expect(d(0).toLocaleString('en-US')).toBe('0')
  })

  it('reads locales as Intl does', () => {
    expect(d('1234.5').toLocaleString(['de-DE', 'en-US'])).toBe('1.234,5')
    expect(d('1234.5').toLocaleString(new Intl.Locale('de-DE'))).toBe('1.234,5')
    expect(d('1234.5').toLocaleString([new Intl.Locale('de-DE'), 'en-US'])).toBe('1.234,5')
    expect(d('1234.5').toLocaleString([])).toBe(new Intl.NumberFormat().format(1234.5))
    expect(() => d(1).toLocaleString('a'.repeat(256))).toThrow(/255/)
    expect(() => d(1).toLocaleString(Array(64).fill('en-US'))).toThrow(/255/)
    expect(() => d(1).toLocaleString('not a tag')).toThrow(RangeError)
    for (const bad of [null, 5, [5], [null], ['en-US', {}]]) {
      expect(() => d(1).toLocaleString(bad as never)).toThrow(TypeError)
    }
  })

  it('refuses implicit conversion', () => {
    const value: unknown = d(5)
    expect(() => d(5).valueOf()).toThrow(TypeError)
    expect(() => (value as number) + 1).toThrow(TypeError)
    expect(() => (value as number) < 6).toThrow(TypeError)
    expect(() => Number(value)).toThrow(TypeError)
  })

  it('shows its value when inspected', () => {
    expect(inspect(d('1.50'))).toBe('Decimal { 1.5 }')
    expect(inspect({ total: d('-1e100') })).toBe('{ total: Decimal { -1e+100 } }')
  })
})
