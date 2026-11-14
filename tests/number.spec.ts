import { describe, expect, it } from 'vitest'
import { ceil, clamp, floor, formatBytes, inRange, mean, round, sum } from '../src/number/index.ts'

describe('round', () => {
  it('rounds ties toward +Infinity, as Math.round does', () => {
    expect(round(0.5)).toBe(1)
    expect(round(-0.5)).toBe(0)
    expect(round(1.5)).toBe(2)
    expect(round(-2.5)).toBe(-2)
    expect(round(15, -1)).toBe(20)
    expect(round(-15, -1)).toBe(-10)
  })

  it('rounds the printed decimal, not the binary value', () => {
    expect(round(1.005, 2)).toBe(1.01)
    expect(round(-1.005, 2)).toBe(-1)
    expect(round(1.545, 3)).toBe(1.545)
    expect(round(9.995, 2)).toBe(10)
    expect(round(123.456, 2)).toBe(123.46)
    expect(round(1.5e-7, 7)).toBe(2e-7)
    expect(round(5e-324, 323)).toBe(1e-323)
  })

  it('leaves values that are already exact at that place', () => {
    expect(round(1.54, 2)).toBe(1.54)
    expect(round(1e21, 2)).toBe(1e21)
    expect(round(1e300, 10)).toBe(1e300)
    expect(round(1.5, 1e9)).toBe(1.5)
  })

  it('rounds to zero when the unit dwarfs the value, without building the unit', () => {
    expect(round(1e-7, 2)).toBe(0)
    expect(round(123.456, -5)).toBe(0)
    expect(round(1.5, -1e9)).toBe(0)
  })

  it('passes non-finite values through and turns -0 into 0', () => {
    expect(round(Number.NaN)).toBeNaN()
    expect(round(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY)
    expect(round(Number.NEGATIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY)
    expect(Object.is(round(-0), 0)).toBe(true)
    expect(Object.is(round(-0.4), 0)).toBe(true)
  })

  it('returns Infinity when the rounded value is too large for a number', () => {
    expect(round(Number.MAX_VALUE, -308)).toBe(Number.POSITIVE_INFINITY)
    expect(ceil(1, -309)).toBe(Number.POSITIVE_INFINITY)
  })

  it('refuses non-integer digits and non-numbers', () => {
    expect(() => round(1, 1.5)).toThrow(new RangeError('digits must be an integer'))
    expect(() => round(1, Number.NaN)).toThrow(RangeError)
    expect(() => round(1.5, -1e21)).toThrow(new RangeError('digits must be an integer'))
    expect(() => ceil(1.5, -(2 ** 60))).toThrow(new RangeError('digits must be an integer'))
    expect(() => round('1.5' as never)).toThrow(new TypeError('n must be a number'))
    expect(() => round(1, '2' as never)).toThrow(new TypeError('digits must be a number'))
    expect(() => floor(1, null as never)).toThrow(new TypeError('digits must be a number'))
  })
})

describe('floor and ceil', () => {
  it('round down and up on the printed decimal', () => {
    expect(floor(4.006, 2)).toBe(4)
    expect(ceil(4.006, 2)).toBe(4.01)
    expect(floor(0.29, 2)).toBe(0.29)
    expect(ceil(0.29, 2)).toBe(0.29)
    expect(floor(1.005, 2)).toBe(1)
    expect(ceil(1.001, 2)).toBe(1.01)
    expect(floor(9.995, 2)).toBe(9.99)
  })

  it('follow the sign: floor goes toward -Infinity and ceil toward +Infinity', () => {
    expect(floor(-0.5)).toBe(-1)
    expect(Object.is(ceil(-0.5), 0)).toBe(true)
    expect(floor(-4.006, 2)).toBe(-4.01)
    expect(ceil(-4.006, 2)).toBe(-4)
  })

  it('take negative digits', () => {
    expect(floor(4060, -2)).toBe(4000)
    expect(ceil(6040, -2)).toBe(6100)
    expect(floor(-5, -1)).toBe(-10)
    expect(ceil(5, -1)).toBe(10)
    expect(ceil(123.456, -5)).toBe(100000)
    expect(ceil(1e-320)).toBe(1)
  })

  it('leave integers whose dropped digits are zeros', () => {
    expect(ceil(4000, -2)).toBe(4000)
    expect(floor(-1200, -2)).toBe(-1200)
  })

  it('check their arguments as round does', () => {
    expect(() => floor(1, 0.5)).toThrow(RangeError)
    expect(() => ceil(null as never)).toThrow(TypeError)
    expect(floor(Number.NaN)).toBeNaN()
  })
})

describe('clamp', () => {
  it('limits a number to the inclusive range', () => {
    expect(clamp(-10, -5, 5)).toBe(-5)
    expect(clamp(10, -5, 5)).toBe(5)
    expect(clamp(3, -5, 5)).toBe(3)
    expect(clamp(5, 5, 5)).toBe(5)
    expect(clamp(Number.POSITIVE_INFINITY, 0, 1)).toBe(1)
    expect(clamp(Number.NaN, 0, 1)).toBeNaN()
  })

  it('refuses bounds that are NaN or reversed', () => {
    const message = 'min and max must not be NaN, and min must be <= max'
    expect(() => clamp(1, 5, -5)).toThrow(new RangeError(message))
    expect(() => clamp(1, Number.NaN, 5)).toThrow(new RangeError(message))
    expect(() => clamp(1, 0, Number.NaN)).toThrow(new RangeError(message))
  })

  it.each([
    ['n', ['1', 0, 5]],
    ['min', [1, '0', 5]],
    ['max', [1, 0, '5']],
    ['max', [10, 5]]
  ])('refuses a non-number %s', (name, args) => {
    expect(() => (clamp as (...args: unknown[]) => number)(...args)).toThrow(
      new TypeError(`${name} must be a number`)
    )
  })
})

describe('inRange', () => {
  it('includes start and excludes end', () => {
    expect(inRange(3, 2, 4)).toBe(true)
    expect(inRange(2, 2, 4)).toBe(true)
    expect(inRange(4, 2, 4)).toBe(false)
    expect(inRange(1.2, 1, 2)).toBe(true)
  })

  it('reads one bound as end and swaps reversed bounds, as lodash does', () => {
    expect(inRange(4, 8)).toBe(true)
    expect(inRange(8, 8)).toBe(false)
    expect(inRange(-1, 8)).toBe(false)
    expect(inRange(-3, -2, -6)).toBe(true)
    expect(inRange(-3, -6)).toBe(true)
  })

  it('keeps a NaN n out of every range', () => {
    expect(inRange(Number.NaN, 0, 10)).toBe(false)
    expect(inRange(Number.NaN, 10)).toBe(false)
  })

  it('refuses NaN bounds', () => {
    const error = new RangeError('start and end must not be NaN')
    expect(() => inRange(5, Number.NaN, 10)).toThrow(error)
    expect(() => inRange(5, 0, Number.NaN)).toThrow(error)
    expect(() => inRange(5, Number.NaN)).toThrow(error)
  })

  it.each([
    ['n', ['3', 2, 4]],
    ['n', [null, 0, 1]],
    ['start', [3, '2', 4]],
    ['end', [3, 2, '4']],
    ['end', [1, '5']]
  ])('refuses a non-number %s', (name, args) => {
    expect(() => (inRange as (...args: unknown[]) => boolean)(...args)).toThrow(
      new TypeError(`${name} must be a number`)
    )
  })
})

describe('sum and mean', () => {
  it('add and average any iterable of numbers', () => {
    expect(sum([4, 2, 8, 6])).toBe(20)
    expect(sum(new Set([1, 2]))).toBe(3)
    expect(sum([])).toBe(0)
    expect(mean([4, 2, 8, 6])).toBe(5)
    expect(mean(new Map([[1, 2]]).values())).toBe(2)
    expect(mean([])).toBeNaN()
  })

  it('add left to right, as a loop with + does', () => {
    expect(sum([0.1, 0.2, 0.3])).toBe(0.1 + 0.2 + 0.3)
    expect(sum([Number.POSITIVE_INFINITY, 1])).toBe(Number.POSITIVE_INFINITY)
  })

  it('refuse non-numbers and non-iterables', () => {
    expect(() => sum([1, '2'] as never)).toThrow(new TypeError('sum expects numbers, got string'))
    expect(() => mean([1, undefined] as never)).toThrow(TypeError)
    expect(() => sum(null as never)).toThrow(
      new TypeError('sum expects an iterable of numbers, got null')
    )
    expect(() => sum(undefined as never)).toThrow(
      new TypeError('sum expects an iterable of numbers, got undefined')
    )
    expect(() => mean({ length: 2 } as never)).toThrow(
      new TypeError('mean expects an iterable of numbers, got object')
    )
  })
})

describe('formatBytes', () => {
  it('uses powers of 1000 and SI units by default', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(999)).toBe('999 B')
    expect(formatBytes(1000)).toBe('1 kB')
    expect(formatBytes(1536)).toBe('1.54 kB')
    expect(formatBytes(1234567)).toBe('1.23 MB')
    expect(formatBytes(12345678)).toBe('12.3 MB')
    expect(formatBytes(123456789)).toBe('123 MB')
  })

  it('uses powers of 1024 and IEC units when binary', () => {
    expect(formatBytes(1023, { binary: true })).toBe('1,023 B')
    expect(formatBytes(1024, { binary: true })).toBe('1 KiB')
    expect(formatBytes(1536, { binary: true })).toBe('1.5 KiB')
    expect(formatBytes(1048575, { binary: true })).toBe('1 MiB')
    expect(formatBytes(2 ** 80, { binary: true })).toBe('1 YiB')
  })

  it('moves to the next unit when rounding reaches it', () => {
    expect(formatBytes(999_950)).toBe('1 MB')
    expect(formatBytes(999_499)).toBe('999 kB')
  })

  it('keeps the sign and fractions, and the largest unit past yottabytes', () => {
    expect(formatBytes(-1536)).toBe('-1.54 kB')
    expect(formatBytes(0.5)).toBe('0.5 B')
    expect(formatBytes(1e30)).toBe('1,000,000 YB')
  })

  it('rounds the size the same whatever the sign', () => {
    expect(formatBytes(1535)).toBe('1.54 kB')
    expect(formatBytes(-1535)).toBe('-1.54 kB')
    expect(formatBytes(-1005)).toBe('-1.01 kB')
    expect(formatBytes(-100.5)).toBe('-101 B')
    expect(formatBytes(-999_500)).toBe('-1 MB')
    expect(formatBytes(-0.001)).toBe('0 B')
    expect(formatBytes(-0)).toBe('0 B')
  })

  it('formats the number for the locale', () => {
    expect(formatBytes(1234567, { locale: 'de' })).toBe('1,23 MB')
    expect(formatBytes(1e30, { locale: 'de' })).toBe('1.000.000 YB')
    expect(formatBytes(1234567, { locale: ['de'] })).toBe('1,23 MB')
    expect(formatBytes(1234567, { locale: new Intl.Locale('de') })).toBe('1,23 MB')
  })

  it('keeps each locale apart when it reuses formatters', () => {
    const locales = Intl.NumberFormat.supportedLocalesOf(
      ['de', 'en', 'fr', 'hi', 'ar-EG', 'ja'].flatMap((tag) =>
        Array.from({ length: 20 }, (_, i) => `${tag}-u-cu-x${String(i).padStart(2, '0')}`)
      )
    )
    for (const locale of locales) {
      const expected = `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(1.23)} MB`
      expect(formatBytes(1234567, { locale })).toBe(expected)
      const other = expected.startsWith('1,23') ? 'en' : 'de'
      expect(formatBytes(1234567, { locale: other })).toBe(other === 'en' ? '1.23 MB' : '1,23 MB')
      expect(formatBytes(1234567, { locale })).toBe(expected)
    }
    expect(formatBytes(1)).toBe('1 B')
    expect(() => formatBytes(1, { locale: '' })).toThrow(RangeError)
  })

  it('refuses non-numbers and non-finite numbers', () => {
    expect(() => formatBytes('1' as never)).toThrow(TypeError)
    expect(() => formatBytes(Number.NaN)).toThrow(new RangeError('n must be finite'))
    expect(() => formatBytes(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})
