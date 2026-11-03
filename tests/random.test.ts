import { describe, expect, it } from 'vitest'
import { times } from '../src/itertools/index.js'
import { ValueError } from '../src/globals/errors.js'
import { choice, random, randomInt, sample, shuffle } from '../src/random/index.js'

const randomArr = () => [...times(100, (i) => randomInt(i, 100))]

describe('random', () => {
  it('choice picks from the array', () => {
    const arr = randomArr()
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(choice(arr))
    }
    expect(choice([] as number[])).toBeUndefined()
  })

  it('random is in [min, max)', () => {
    for (let i = 1; i <= 100; i++) {
      const r = random(0, i)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(i)
    }
  })

  it('SPEC-R62 randomInt inclusive range and RangeError', () => {
    for (let i = 1; i <= 100; i++) {
      const r = randomInt(0, i)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(i)
      expect(Number.isInteger(r)).toBe(true)
    }
    expect(() => randomInt(5, 4)).toThrow(RangeError)
  })

  it('SPEC-R62 chi-square randomInt(0,2) within 0.01 absolute', () => {
    const n = 120_000
    const counts = [0, 0, 0]
    for (let i = 0; i < n; i++) {
      counts[randomInt(0, 2)]++
    }
    for (const c of counts) {
      expect(Math.abs(c / n - 1 / 3)).toBeLessThan(0.01)
    }
  })

  it('SPEC-R62 chi-square shuffle permutations within 0.01 absolute', () => {
    const n = 120_000
    const keys = ['1,2,3', '1,3,2', '2,1,3', '2,3,1', '3,1,2', '3,2,1']
    const counts = Object.fromEntries(keys.map((k) => [k, 0])) as Record<string, number>
    for (let i = 0; i < n; i++) {
      const p = shuffle([1, 2, 3]).join(',')
      counts[p]++
    }
    for (const k of keys) {
      expect(Math.abs(counts[k] / n - 1 / 6)).toBeLessThan(0.01)
    }
  })

  it('SPEC-R62 shuffle in-place for arrays; object returns new value array', () => {
    const arr = randomArr()
    const copy = arr.slice()
    expect(shuffle(copy)).toBe(copy)
    expect(copy.some((x, i) => x !== arr[i])).toBe(true)

    const obj = { a: 1, b: 2, c: 3 }
    const shuffled = shuffle(obj)
    expect(shuffled).not.toBe(obj)
    expect(shuffled.sort()).toEqual([1, 2, 3])
  })

  it('SPEC-R62 sample size edges', () => {
    const arr = randomArr()
    expect(sample([1, 2, 3], 0)).toEqual([])
    expect(sample([1, 2, 3], -1)).toEqual([])
    expect(() => sample([1, 2, 3], 4)).toThrow(ValueError)
    const unique = [...times(50, (i) => i)]
    for (let i = 0; i < 100; i++) {
      const s = sample(unique, 30)
      expect(s).toHaveLength(30)
      expect(new Set(s).size).toBe(30)
      expect(s.every((x) => unique.includes(x))).toBe(true)
    }
    expect(sample(arr, 30)).toHaveLength(30)
  })
})
