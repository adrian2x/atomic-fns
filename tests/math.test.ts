import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { abs, divmod, logBase, max, mean, min, round, sum } from '../src/math/index.js'
import { decimal, Decimal } from '../src/decimal/index.js'
import { ZeroDivisionError } from '../src/globals/errors.js'
import { expectFast } from './helpers/perf.js'

describe('math', () => {
  it('SPEC-R61 min max return first among ties', () => {
    expect(min([5, 4, 3, 1, 2])).toBe(1)
    expect(max([7, 9, 3, 11])).toBe(11)
    expect(
      min(
        [
          { v: 1, id: 'a' },
          { v: 1, id: 'b' }
        ],
        (o) => o.v
      )?.id
    ).toBe('a')
    expect(
      max(
        [
          { v: 1, id: 'a' },
          { v: 1, id: 'b' }
        ],
        (o) => o.v
      )?.id
    ).toBe('a')
    expect(min([])).toBeUndefined()
    expect(max([])).toBeUndefined()
  })

  it('SPEC-R61 round table ties toward +Infinity', () => {
    expect(round(0.5)).toBe(1)
    expect(round(-0.5)).toBe(0)
    expect(round(1.5)).toBe(2)
    expect(round(1.54, 2)).toBe(1.54)
    expect(round(1.545, 3)).toBe(1.545)
    expect(round(1.005, 2)).toBe(1.01)
    expect(round(-1.005, 2)).toBe(-1)
    expect(round(1e-7, 2)).toBe(0)
    expect(round(1e21, 2)).toBe(1e21)
    expect(round(15, -1)).toBe(20)
    expect(round(-15, -1)).toBe(-10)
  })

  it('SPEC-R61 round non-integer digits throws; non-finite passthrough', () => {
    expect(() => round(1, 1.5)).toThrow(RangeError)
    expect(() => round(1, 1.5)).toThrow(/digits must be an integer/)
    expect(Number.isNaN(round(Number.NaN))).toBe(true)
    expect(round(Infinity)).toBe(Infinity)
    expect(round(-Infinity)).toBe(-Infinity)
  })

  it('R16-C: round accepts any integer digits', () => {
    expect(round(1.5, 1e9)).toBe(1.5)
    expect(round(1.5, -1e9)).toBe(0)
    expect(round(123.456, 2)).toBe(123.46)
  })

  it('SPEC-R61 round normalizes -0 to 0', () => {
    expect(Object.is(round(-0), -0)).toBe(false)
    expect(Object.is(round(-0), 0)).toBe(true)
    expect(Object.is(round(-0, 5), 0)).toBe(true)
  })

  it('SPEC-R60 divmod floor quotient and matching remainder', () => {
    expect(divmod(-7, 2)).toEqual([-4, 1])
    expect(divmod(7, -2)).toEqual([-4, -1])
    expect(divmod(7, 2)).toEqual([3, 1])
    expect(divmod(-7, -2)).toEqual([3, -1])
  })

  it('abs dispatches protocol.abs', () => {
    expect(abs(-3)).toBe(3)
    expect(String(abs(decimal(-4)))).toBe('4')
  })

  it('sum', () => {
    expect(sum([])).toBe(0)
    expect(sum([1, 2, 3, 4])).toBe(10)
  })

  it('mean rejects length-driven array-likes before allocating', () => {
    const evil = JSON.parse('{"length":4294967295}') as never
    expectFast(() => {
      expect(() => mean(evil)).toThrow(TypeError)
    }, 1000)
  })
})

describe('SPEC-R61 math helpers coverage', () => {
  it('SPEC-R61 logBase mean empty and plain', () => {
    expect(logBase(10, 100)).toBe(2)
    expect(Number.isNaN(logBase(-1, 10))).toBe(true)
    expect(Number.isNaN(mean([]))).toBe(true)
  })
})

describe('round inputs', () => {
  const loose = round as unknown as (x: unknown, digits?: number) => unknown

  it('coerces other values with Number, as Math.round does', () => {
    expect(loose('1.5')).toBe(2)
    expect(loose('4.006', 2)).toBe(4.01)
    expect(loose(null)).toBe(0)
    expect(loose(true)).toBe(1)
    expect(loose(15n)).toBe(15)
    expect(loose('abc')).toBeNaN()
    expect(loose(undefined)).toBeNaN()
  })

  it('dispatches Decimals with the same ties toward +Infinity', () => {
    expect(round(decimal('1.55'), 1)).toBeInstanceOf(Decimal)
    expect(String(round(decimal('1.55'), 1))).toBe('1.6')
    expect(String(round(decimal('-1.55'), 1))).toBe('-1.5')
    expect(String(round(decimal('2.5')))).toBe('3')
    expect(String(round(decimal('-2.5')))).toBe('-2')
    const foreign = {
      [Symbol.for('atomic-fns.decimal')]() {
        return '1.55'
      }
    }
    expect(String(loose(foreign, 1))).toBe('1.6')
  })

  it('accepts any integer digits for zero', () => {
    expect(round(0, -10001)).toBe(0)
    expect(round(0, -1e9)).toBe(0)
    expect(Object.is(round(-0, -1e9), 0)).toBe(true)
  })
})

describe('min and max', () => {
  it('skip nullish and NaN, with and without key', () => {
    const loose = [3, null, 5] as number[]
    expect(max(loose)).toBe(5)
    expect(min(loose)).toBe(3)
    expect(max([1, undefined])).toBe(1)
    const holey = [1]
    holey[2] = 3
    expect(max(holey)).toBe(3)
    expect(max([NaN, 1])).toBe(1)
    expect(min([NaN, 1])).toBe(1)
    expect(max([1, NaN, 3])).toBe(3)
    expect(min([null, undefined, NaN])).toBeUndefined()
    expect(max([NaN])).toBeUndefined()
    const rows = [{ n: null }, { n: 2 }, { n: NaN }, { n: 1 }]
    expect(max(rows, (row) => row.n)).toBe(rows[1])
    expect(min(rows, (row) => row.n)).toBe(rows[3])
  })

  it('keep the total order across mixed kinds', () => {
    expect(max([10, '9'])).toBe('9')
    expect(max(['9', 10])).toBe('9')
    expect(min([10, '9'])).toBe(10)
    expect(min(['9', 10])).toBe(10)
    expect(String(max([decimal(1), null, 2]))).toBe('2')
    expect(String(min([2, decimal(1)]))).toBe('1')
  })

  it('compare arrays by content and plain objects by identity', () => {
    expect(min([[2], [1]])).toEqual([1])
    expect(min([[1], [2]])).toEqual([1])
    expect(max([[1], [2]])).toEqual([2])
    const [a, b] = [{ n: 1 }, { n: 2 }]
    expect(min([a, b])).toBe(min([b, a]))
    expect(max([a, b])).toBe(max([b, a]))
    expect(max([a, b])).not.toBe(min([a, b]))
  })

  it('call key once per item', () => {
    const key = vi.fn((x: number) => x)
    max([1, 2, 3], key)
    expect(key).toHaveBeenCalledTimes(3)
    key.mockClear()
    min([1], key)
    expect(key).toHaveBeenCalledTimes(1)
  })

  it('refuse a non-iterable with the shared message', () => {
    for (const bad of [5, null, undefined, {}]) {
      expect(() => min(bad as never)).toThrow('expected an iterable')
      expect(() => max(bad as never)).toThrow('expected an iterable')
    }
  })
})

describe('sum', () => {
  it('calls key for every hole', () => {
    expect(sum(new Array(3), () => 1)).toBe(3)
    const holey: (number | undefined)[] = []
    holey[2] = 1
    expect(sum(holey, (x) => x ?? 10)).toBe(21)
  })

  it('refuses a huge sparse array like mean', () => {
    const sparse: number[] = []
    sparse[2 ** 32 - 2] = 1
    expect(() => sum(sparse)).toThrow('sparse array too large')
    expect(() => mean(sparse)).toThrow('sparse array too large')
  })

  it('folds non-numbers with the add operator from the first item', () => {
    expect(sum(['1', '2'])).toBe('12')
    expect(sum('12')).toBe('12')
    expect(sum([1n, 2n])).toBe(3n)
    expect(String(sum([decimal('0.1'), decimal('0.2')]))).toBe('0.3')
    expect(String(sum([{ d: decimal('0.1') }, { d: decimal('0.2') }], (o) => o.d))).toBe('0.3')
    expect(sum([1, 2, 'a'])).toBe('3a')
    expect(sum(['a'])).toBe('a')
    expect(sum([] as string[])).toBe(0)
  })

  it('types the total as what it returns', () => {
    expectTypeOf(sum([1, 2])).toEqualTypeOf<number>()
    expectTypeOf(sum([{ n: 1 }], (o) => o.n)).toEqualTypeOf<number>()
    expectTypeOf(sum(['1', '2'])).toEqualTypeOf<string | 0>()
    expectTypeOf(sum([{ s: 'a' }], (o) => o.s)).toEqualTypeOf<string | 0>()
    expectTypeOf(sum([1n])).toEqualTypeOf<bigint | 0>()
    expectTypeOf(sum([decimal(1)])).toEqualTypeOf<Decimal | 0>()
  })

  it('leaves mean coercing with Number', () => {
    expect(mean(['1', '2'])).toBe(1.5)
    expect(mean([1n, 2n])).toBe(1.5)
    expect(() => mean([decimal(1)])).toThrow(TypeError)
    expect(mean([decimal(1)], (d) => d.toNumber())).toBe(1)
  })
})

describe('abs and divmod', () => {
  it('abs takes bigint', () => {
    expect(abs(-5n)).toBe(5n)
    expect(abs(5n)).toBe(5n)
  })

  it('divmod matches Python', () => {
    const table: [number, number, number, number][] = [
      [7, 2, 3, 1],
      [-7, 2, -4, 1],
      [7, -2, -4, -1],
      [-7, -2, 3, -1],
      [7.5, 2, 3, 1.5],
      [-7.5, 2, -4, 0.5],
      [7.5, -2, -4, -0.5],
      [0.3, 0.1, 2, 0.09999999999999998],
      [1, 0.1, 9, 0.09999999999999995],
      [41.4, 5.389, 7, 3.676999999999997],
      [65.98, 0.6, 109, 0.5800000000000064],
      [5, Infinity, 0, 5],
      [-5, Infinity, -1, Infinity],
      [5, -Infinity, -1, -Infinity],
      [-5, -Infinity, 0, -5],
      [0, 5, 0, 0],
      [-0, 5, -0, 0],
      [0, -5, -0, -0],
      [-0, -5, 0, -0],
      [6, 3, 2, 0],
      [-6, 3, -2, 0],
      [6, -3, -2, -0],
      [1e17, 3, 33333333333333332, 1],
      [1e300, 7, 1.4285714285714286e299, 1],
      [2 ** 53, 3, 3002399751580330, 2],
      [1e308, 1e-308, Infinity, 3.498445546245627e-309],
      [5e-324, 3, 0, 5e-324],
      [-5e-324, 3, -1, 3]
    ]
    for (const [x, y, q, r] of table) {
      expect(divmod(x, y)).toEqual([q, r])
    }
    for (const [x, y] of [
      [NaN, 2],
      [2, NaN],
      [Infinity, 2],
      [-Infinity, 2],
      [Infinity, Infinity]
    ]) {
      expect(divmod(x, y)).toEqual([NaN, NaN])
    }
  })

  it('divmod refuses a zero divisor', () => {
    for (const [x, y] of [
      [1, 0],
      [0, 0],
      [1, -0],
      [NaN, 0]
    ]) {
      expect(() => divmod(x, y)).toThrow(ZeroDivisionError)
    }
  })
})
