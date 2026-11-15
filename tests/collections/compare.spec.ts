import { describe, expect, it } from 'vitest'
import { defaultCompare, sameValueZero } from '../../src/collections/internal/compare.ts'

describe('defaultCompare', () => {
  it('names the kind of an unsupported value', () => {
    const forged = { constructor: { name: 'x\nFAKE LOG LINE' } }
    const message =
      'the default comparator orders numbers, bigints and strings; pass a comparator to order object and object'
    expect(() => defaultCompare({}, {})).toThrow(new TypeError(message))
    expect(() => defaultCompare(forged, forged)).toThrow(new TypeError(message))
    expect(() => defaultCompare(null, undefined)).toThrow(/order null and undefined$/)
  })
})

describe('sameValueZero', () => {
  it('treats NaN as itself and -0 as 0, and nothing else as equal', () => {
    expect(sameValueZero(NaN, NaN)).toBe(true)
    expect(sameValueZero(0, -0)).toBe(true)
    expect(sameValueZero(1, 1)).toBe(true)
    expect(sameValueZero(1, '1')).toBe(false)
    expect(sameValueZero(NaN, 0)).toBe(false)
    expect(sameValueZero({}, {})).toBe(false)
  })
})
