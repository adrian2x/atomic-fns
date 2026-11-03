import { describe, expect, it } from 'vitest'
import { abs, divmod, max, mean, min, round, sum } from '../src/math/index.js'
import { decimal } from '../src/decimal/index.js'

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
    const start = performance.now()
    expect(() => mean(evil)).toThrow(TypeError)
    expect(performance.now() - start).toBeLessThan(5)
  })
})
