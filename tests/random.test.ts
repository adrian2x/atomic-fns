import { afterEach, describe, expect, it, vi } from 'vitest'
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

/** Seeded 53-bit stand-in for `Math.random`, so distribution checks are replayable. */
function seeded(seed: number): () => number {
  let state = seed
  const next32 = (): number => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return (t ^ (t >>> 14)) >>> 0
  }
  return () => ((next32() >>> 5) * 2 ** 26 + (next32() >>> 6)) / 2 ** 53
}

describe('random bounds', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stays below max through rounding and overflow', () => {
    const top = 1 - 2 ** -53
    vi.spyOn(Math, 'random').mockReturnValue(top)
    expect(random(1, 2)).toBeLessThan(2)
    expect(random(0.1, 0.3)).toBeLessThan(0.3)
    expect(random(1, 1 + 2 ** -52)).toBeLessThan(1 + 2 ** -52)
    expect(random(-Number.MAX_VALUE, Number.MAX_VALUE)).toBeLessThan(Number.MAX_VALUE)
    expect(random(-Number.MAX_VALUE, Number.MAX_VALUE)).toBeGreaterThan(-Number.MAX_VALUE)
    expect(random(3, 3)).toBe(3)
  })

  it('one argument is max', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(random()).toBe(0.5)
    expect(random(5)).toBe(2.5)
    expect(random(undefined, 5)).toBe(2.5)
    expect(random(2, 4)).toBe(3)
  })

  it('validates like randomInt', () => {
    for (const [min, max] of [
      [5, 1],
      [NaN, 1],
      [0, NaN],
      [0, Infinity],
      [-Infinity, 0],
      ['1', '3']
    ] as [number, number][]) {
      expect(() => random(min, max)).toThrow(RangeError)
    }
    expect(() => random(-5)).toThrow(RangeError)
    expect(() => random(NaN)).toThrow(RangeError)
  })
})

describe('randomInt bounds and spread', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requires safe integer bounds', () => {
    for (const [min, max] of [
      [1.2, 3.7],
      [0, 2.5],
      [0.5, 2],
      [NaN, 5],
      [0, NaN],
      [0, Infinity],
      [-Infinity, 0],
      [0, 2 ** 53],
      ['1', '3'],
      [undefined, undefined]
    ] as [number, number][]) {
      expect(() => randomInt(min, max)).toThrow(RangeError)
      expect(() => randomInt(min, max)).toThrow('min and max must be safe integers')
    }
    expect(() => randomInt(5, 4)).toThrow('max must be >= min')
  })

  it('reaches every residue across spans wider than one draw', () => {
    vi.spyOn(Math, 'random').mockImplementation(seeded(7))
    const share = (draws: number, min: number, max: number, modulus: number): number[] => {
      const counts = new Array<number>(modulus).fill(0)
      for (let i = 0; i < draws; i++) {
        const x = randomInt(min, max)
        expect(x).toBeGreaterThanOrEqual(min)
        expect(x).toBeLessThanOrEqual(max)
        counts[((x % modulus) + modulus) % modulus]++
      }
      return counts.map((count) => count / draws)
    }
    for (const fraction of share(30_000, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 2)) {
      expect(Math.abs(fraction - 1 / 2)).toBeLessThan(0.02)
    }
    for (const fraction of share(30_000, 0, 3 * 2 ** 51 - 1, 3)) {
      expect(Math.abs(fraction - 1 / 3)).toBeLessThan(0.02)
    }
    for (const fraction of share(30_000, 0, 2 ** 53 - 1, 4)) {
      expect(Math.abs(fraction - 1 / 4)).toBeLessThan(0.02)
    }
    for (const fraction of share(30_000, -3, 3, 7)) {
      expect(Math.abs(fraction - 1 / 7)).toBeLessThan(0.02)
    }
  })

  it('keeps the floor mapping for a stubbed Math.random and always terminates', () => {
    const random = vi.spyOn(Math, 'random')
    random.mockReturnValue(0)
    expect(randomInt(1, 6)).toBe(1)
    random.mockReturnValue(0.5)
    expect(randomInt(1, 6)).toBe(4)
    random.mockReturnValue(0.99)
    expect(randomInt(1, 6)).toBe(6)
    random.mockReturnValue(1 - 2 ** -53)
    expect(randomInt(1, 6)).toBe(6)
    expect(randomInt(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toBe(
      Number.MAX_SAFE_INTEGER
    )
  })
})

describe('choice, sample and shuffle inputs', () => {
  it('sample requires an integer k and keeps the negative result', () => {
    for (const k of [undefined, NaN, 1.5, 'x', '2', Infinity, -Infinity, null]) {
      expect(() => sample([1, 2, 3], k as number)).toThrow(RangeError)
      expect(() => sample([1, 2, 3], k as number)).toThrow('k must be an integer')
    }
    expect(sample([1, 2, 3], -1)).toEqual([])
  })

  it('all three share one rule for what holds items', () => {
    const set = new Set([1, 2, 3])
    expect([1, 2, 3]).toContain(choice(set))
    expect(sample(set, 3).sort()).toEqual([1, 2, 3])
    expect(shuffle(set).sort()).toEqual([1, 2, 3])

    expect(choice({ a: 1 })).toBe(1)
    expect(sample({ a: 1, b: 2 }, 2).sort()).toEqual([1, 2])
    expect(choice(new Map([[1, 2]]))).toEqual([1, 2])
    expect(choice('😀')).toBe('😀')
    expect(sample('ab', 2).sort()).toEqual(['a', 'b'])
    function* one() {
      yield 1
    }
    expect(choice(one())).toBe(1)
    expect(sample(one(), 1)).toEqual([1])

    expect(choice(null as never)).toBeUndefined()
    expect(sample(null as never, 0)).toEqual([])
    expect(() => sample(null as never, 1)).toThrow(ValueError)
    expect(shuffle(null as never)).toEqual([])
  })

  it('sample leaves its source untouched', () => {
    const source = [1, 2, 3, 4]
    sample(source, 2)
    expect(source).toEqual([1, 2, 3, 4])
    const huge: number[] = []
    huge[2 ** 32 - 2] = 1
    expect(() => choice(huge)).toThrow('sparse array too large')
    expect(() => sample(huge, 1)).toThrow('sparse array too large')
  })
})
