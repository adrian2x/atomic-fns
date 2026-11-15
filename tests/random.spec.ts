import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { random, randomInt, sample, sampleSize, shuffle } from '../src/random/index.ts'
import { sparse } from './sparse.ts'

/** Seeded 32-bit generator (mulberry32), so distribution checks are replayable. */
function seeded32Bits(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return (t ^ (t >>> 14)) >>> 0
  }
}

/** Seeded 53-bit stand-in for `Math.random`. */
function seeded(seed: number): () => number {
  const next32 = seeded32Bits(seed)
  return () => ((next32() >>> 5) * 2 ** 26 + (next32() >>> 6)) / 2 ** 53
}

/** Seeded source with 52 bits of precision, as older V8 builds of `Math.random` give. */
function seeded52(seed: number): () => number {
  const next32 = seeded32Bits(seed)
  return () => ((next32() >>> 6) * 2 ** 26 + (next32() >>> 6)) / 2 ** 52
}

/** Seeded source with 32 bits of precision, the usual shape of a seeded generator. */
function seeded32(seed: number): () => number {
  const next32 = seeded32Bits(seed)
  return () => next32() / 2 ** 32
}

const LAST_DRAW = 1 - 2 ** -53
const fixed = (draw: number) => () => draw

afterEach(() => {
  vi.restoreAllMocks()
})

describe('randomInt', () => {
  it('reaches both ends of the inclusive range', () => {
    expect(randomInt(1, 6, { random: fixed(0) })).toBe(1)
    expect(randomInt(1, 6, { random: fixed(0.5) })).toBe(4)
    expect(randomInt(1, 6, { random: fixed(LAST_DRAW) })).toBe(6)
    expect(randomInt(3, 3)).toBe(3)
  })

  it('stays in the inclusive range', () => {
    const random = seeded(1)
    for (let i = 0; i < 1000; i++) {
      const x = randomInt(-2, 2, { random })
      expect(Number.isInteger(x) && x >= -2 && x <= 2).toBe(true)
    }
  })

  it('gives every value the same chance, across spans wider than one draw', () => {
    const share = (min: number, max: number, modulus: number, random: () => number): number[] => {
      const counts = new Array<number>(modulus).fill(0)
      for (let i = 0; i < 30_000; i++) {
        const x = randomInt(min, max, { random })
        counts[((x % modulus) + modulus) % modulus]++
      }
      return counts.map((count) => count / 30_000)
    }
    for (const source of [seeded, seeded52, seeded32]) {
      for (const [min, max, modulus] of [
        [0, 2, 3],
        [0, 2 ** 40 - 1, 2],
        [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 2],
        [0, 3 * 2 ** 51 - 1, 3]
      ]) {
        for (const fraction of share(min, max, modulus, source(7))) {
          expect(Math.abs(fraction - 1 / modulus)).toBeLessThan(0.02)
        }
      }
    }
  })

  it('always ends with a source that keeps repeating a rejected draw', () => {
    expect(
      randomInt(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, { random: fixed(LAST_DRAW) })
    ).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('uses Math.random by default', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(randomInt(1, 6)).toBe(4)
  })

  it('refuses bounds that are not ordered safe integers', () => {
    for (const [min, max] of [
      [1.5, 3],
      [0, Number.NaN],
      [0, 2 ** 53],
      [0, Number.POSITIVE_INFINITY]
    ]) {
      expect(() => randomInt(min, max)).toThrow(new RangeError('min and max must be safe integers'))
    }
    expect(() => randomInt(5, 4)).toThrow(new RangeError('max must be >= min'))
  })

  it('refuses bounds that are not numbers', () => {
    expect(() => randomInt('1' as never, 6)).toThrow(new TypeError('min and max must be numbers'))
    expect(() => randomInt(1, null as never)).toThrow(new TypeError('min and max must be numbers'))
  })
})

describe('the random source', () => {
  it('rejects a source that is not a function, before any draw', () => {
    const error = new TypeError('random must be a function')
    const notAFunction = 1 as never
    expect(() => randomInt(0, 1, { random: notAFunction })).toThrow(error)
    expect(() => random(0, 1, { random: notAFunction })).toThrow(error)
    expect(() => sample([], { random: notAFunction })).toThrow(error)
    expect(() => sampleSize([1], 1, { random: notAFunction })).toThrow(error)
    expect(() => shuffle([1], { random: notAFunction })).toThrow(error)
  })

  it('rejects a draw outside [0, 1)', () => {
    const error = new RangeError('random must return a number in [0, 1)')
    expect(() => randomInt(1, 6, { random: fixed(6) })).toThrow(error)
    expect(() => randomInt(1, 6, { random: fixed(-0.1) })).toThrow(error)
    expect(() => sample([1, 2], { random: fixed(1) })).toThrow(error)
    expect(() => random(0, 10, { float: true, random: fixed(Number.NaN) })).toThrow(error)
  })

  it('rejects a draw that is not a number', () => {
    expect(() => shuffle([1, 2], { random: fixed('0.5' as never) })).toThrow(
      new TypeError('random must return a number')
    )
  })
})

describe('random', () => {
  it('returns integers with both bounds included, as lodash does', () => {
    expect(random({ random: fixed(LAST_DRAW) })).toBe(1)
    expect(random({ random: fixed(0) })).toBe(0)
    expect(random(5, { random: fixed(LAST_DRAW) })).toBe(5)
    expect(random(2, 4, { random: fixed(0.5) })).toBe(3)
  })

  it('returns a float in [min, max) for float bounds or the float option', () => {
    expect(random(1.5, 2.5, { random: fixed(0.5) })).toBe(2)
    expect(random(0, 1, { float: true, random: fixed(0.25) })).toBe(0.25)
    expect(random(4, { float: true, random: fixed(0.5) })).toBe(2)
    expect(random(1, 2, { float: true, random: fixed(LAST_DRAW) })).toBeLessThan(2)
    expect(random(0.1, 0.3, { random: fixed(LAST_DRAW) })).toBeLessThan(0.3)
    expect(random(3, 3, { float: true })).toBe(3)
  })

  it('never falls below min for equal fractional bounds', () => {
    const source = seeded(13)
    const draws = new Set(
      Array.from({ length: 20_000 }, () =>
        random(0.1000004, 0.1000004, { float: true, random: source })
      )
    )
    expect(draws).toStrictEqual(new Set([0.1000004]))
  })

  it('stays finite across the widest float span', () => {
    const value = random(-Number.MAX_VALUE, Number.MAX_VALUE, { random: fixed(LAST_DRAW) })
    expect(value).toBeLessThan(Number.MAX_VALUE)
    expect(value).toBeGreaterThan(-Number.MAX_VALUE)
  })

  it('refuses bounds that are not finite or are reversed', () => {
    expect(() => random(5, 1)).toThrow(new RangeError('max must be >= min'))
    expect(() => random(-5)).toThrow(RangeError)
    expect(() => random(Number.NaN)).toThrow(new RangeError('min and max must be finite'))
    expect(() => random(0, Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })

  it('refuses bounds that are not numbers', () => {
    const error = new TypeError('min and max must be numbers')
    expect(() => random('5' as never, '10' as never)).toThrow(error)
    expect(() => random(5, '10' as never)).toThrow(error)
    expect(() => random(null as never, 5)).toThrow(error)
  })
})

describe('sample, sampleSize and shuffle shapes', () => {
  it('read every collection shape by its values', () => {
    const sorted = (xs: unknown[]) => xs.toSorted()
    expect(sorted(shuffle({ a: 1, b: 2 }))).toEqual([1, 2])
    expect(sorted(shuffle(sparse(4, { 0: 1, 3: 4 })))).toEqual([1, 4])
    expect(sorted(shuffle(new Uint8Array([3, 1, 2])))).toEqual([1, 2, 3])
    expect(sorted(shuffle('a😀b'))).toEqual(['a', 'b', '😀'])
    expect(sorted(shuffle(new Map([['k', 1]])))).toEqual([1])
    expect(sorted(shuffle(new Set([1, 2])))).toEqual([1, 2])
    expect(
      sorted(
        shuffle(
          (function* () {
            yield 5
            yield 6
          })()
        )
      )
    ).toEqual([5, 6])
    expect(shuffle(null)).toEqual([])
    expect(shuffle(undefined)).toEqual([])
    class Point {
      x = 1
      y = 2
    }
    expect(sorted(shuffle(new Point()))).toEqual([1, 2])
  })

  it('type the values they return by the collection shape', () => {
    const map = new Map([['a', 1]])
    expectTypeOf(sample(map)).toEqualTypeOf<number | undefined>()
    expectTypeOf(sampleSize(map, 1)).toEqualTypeOf<number[]>()
    expectTypeOf(shuffle(map)).toEqualTypeOf<number[]>()
    expectTypeOf(shuffle({ a: 1, b: 'x' })).toEqualTypeOf<(string | number)[]>()
    expectTypeOf(sample('ab')).toEqualTypeOf<string | undefined>()
  })

  it('read a huge sparse array through its own keys', () => {
    const sparse: number[] = []
    sparse[2 ** 32 - 2] = 7
    sparse[5] = 1
    expect(shuffle(sparse).toSorted()).toEqual([1, 7])
    expect(sample(sparse, { random: fixed(0) })).toBe(1)
  })

  it('read primitives as empty, as the collection helpers do', () => {
    for (const value of [5, true, 1n, Symbol('x')]) {
      expect(shuffle(value as never)).toEqual([])
      expect(sample(value as never)).toBeUndefined()
      expect(sampleSize(value as never, 1)).toEqual([])
    }
  })
})

describe('sample', () => {
  it('reads only the element it returns', () => {
    const reads = [0, 0, 0, 0]
    const source = reads.map((_, i) => i)
    for (const i of source) {
      Object.defineProperty(source, i, {
        get: () => {
          reads[i]++
          return i
        }
      })
    }

    const result = sample(source, { random: fixed(0.75) })

    expect(result).toBe(3)
    expect(reads).toStrictEqual([0, 0, 0, 1])
  })

  it('draws one value, or undefined when there are none', () => {
    expect(sample([1, 2, 3], { random: fixed(0) })).toBe(1)
    expect(sample([1, 2, 3], { random: fixed(LAST_DRAW) })).toBe(3)
    expect(sample('ab', { random: fixed(0.5) })).toBe('b')
    expect(sample([])).toBeUndefined()
    expect(sample({})).toBeUndefined()
  })

  it('gives every position the same chance', () => {
    const random = seeded(3)
    const counts = { a: 0, b: 0, c: 0 }
    for (let i = 0; i < 30_000; i++) counts[sample(['a', 'b', 'c'] as const, { random }) as 'a']++
    for (const count of Object.values(counts))
      expect(Math.abs(count / 30_000 - 1 / 3)).toBeLessThan(0.02)
  })
})

describe('sampleSize', () => {
  it('draws n values at distinct positions without changing the source', () => {
    const source = [1, 2, 3, 4, 5]
    expect(sampleSize(source, 3, { random: fixed(0.5) })).toStrictEqual([3, 4, 2])
    expect(source).toEqual([1, 2, 3, 4, 5])
  })

  it('returns every value, shuffled, when n passes the size', () => {
    expect(sampleSize([1, 2, 3], 5, { random: fixed(0.5) })).toStrictEqual([2, 3, 1])
    expect(sampleSize(null, 2)).toEqual([])
  })

  it.each(['array', 'object', 'iterable'] as const)('reads nothing for an n of 0: %s', (shape) => {
    let reads = 0
    const collection =
      shape === 'array'
        ? [1]
        : shape === 'object'
          ? { a: 1 }
          : {
              *[Symbol.iterator]() {
                reads++
                yield 1
              }
            }
    if (shape !== 'iterable') {
      Object.defineProperty(collection, shape === 'array' ? 0 : 'a', {
        get: () => ++reads
      })
    }

    const result = sampleSize(collection, 0, {
      random: () => {
        throw new Error('unexpected draw')
      }
    })

    expect(result).toStrictEqual([])
    expect(reads).toBe(0)
  })

  it.each([
    ['2', new TypeError('n must be a number')],
    [-1, new RangeError('n must be a non-negative integer')],
    [0, new TypeError('random must be a function')]
  ])('validates n and options before reading: %s', (n, error) => {
    const source = {
      get a() {
        throw new Error('unexpected read')
      }
    }

    expect(() => sampleSize(source, n as number, { random: 1 as never })).toThrowError(error)
  })

  it('reads only accepted positions once', () => {
    const reads = [0, 0, 0, 0]
    const source = reads.map((_, i) => i)
    for (const i of source) {
      Object.defineProperty(source, i, {
        get: () => {
          reads[i]++
          return i
        }
      })
    }

    const result = sampleSize(source, 2, { random: fixed(0.5) })

    expect(result).toStrictEqual([2, 0])
    expect(reads).toStrictEqual([1, 0, 1, 0])
  })

  it('keeps seeded draws from dense arrays unchanged', () => {
    const random = seeded32(17)
    const source = [10, 20, 30, 40, 50]

    expect([
      sample([9], { random }),
      sampleSize([9], 1, { random }),
      sample(source, { random }),
      sampleSize(source, 3, { random }),
      sampleSize(source, 5, { random }),
      random()
    ]).toStrictEqual([9, [9], 10, [30, 20, 10], [40, 30, 10, 20, 50], 0.6833786198403686])
  })

  it('restarts the whole draw on a late hole before reading values', () => {
    const source = sparse(5, { 0: 10, 1: 20, 2: 30, 4: 40 })
    let reads = 0
    Object.defineProperty(source, 0, {
      get: () => {
        reads++
        return 10
      }
    })
    const draws = [0, 0, 0.5, 0.75, 0, 0.5]
    let calls = 0

    const result = sampleSize(source, 3, { random: () => draws[calls++] })

    expect(result).toStrictEqual([40, 20, 10])
    expect(new Set(result).size).toBe(3)
    expect(calls).toBe(6)
    expect(reads).toBe(1)
  })

  it.each([
    [sparse(4, {}), 5, []],
    [sparse(5, { 1: 10, 4: 20 }), 5, [10, 20]],
    [[7, 7, 7], 5, [7, 7, 7]]
  ])('samples present positions up to n: %j', (source, n, expected) => {
    expect(sampleSize(source, n, { random: fixed(0) })).toStrictEqual(expected)
  })

  it.each(['non-enumerable', 'inherited'] as const)('skips %s array positions', (shape) => {
    const source = [10, 20, 30]
    if (shape === 'non-enumerable') Object.defineProperty(source, 0, { enumerable: false })
    else {
      delete source[0]
      Object.setPrototypeOf(source, Object.assign(Object.create(Array.prototype), { 0: 10 }))
    }

    expect(sample(source, { random: fixed(0) })).toBe(20)
    expect(sampleSize(source, 3, { random: fixed(0) })).toStrictEqual([20, 30])
  })

  it('gives every ordered sparse pair the same chance', () => {
    const source = sparse(5, { 0: 'a', 2: 'b', 4: 'c' })
    const random = seeded(23)
    const counts = new Map<string, number>()
    for (let i = 0; i < 30_000; i++) {
      const key = sampleSize(source, 2, { random }).join()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    expect([...counts.keys()].sort()).toStrictEqual(['a,b', 'a,c', 'b,a', 'b,c', 'c,a', 'c,b'])
    for (const count of counts.values()) expect(Math.abs(count / 30_000 - 1 / 6)).toBeLessThan(0.02)
  })

  it('refuses an n that is not a non-negative integer', () => {
    for (const n of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => sampleSize([1, 2, 3], n)).toThrow(
        new RangeError('n must be a non-negative integer')
      )
    }
  })

  it('refuses an n that is not a number', () => {
    expect(() => sampleSize([1, 2, 3], '2' as never)).toThrow(new TypeError('n must be a number'))
  })
})

describe('shuffle', () => {
  it('returns a new array without changing the source', () => {
    const source = [1, 2, 3]
    const shuffled = shuffle(source)
    expect(shuffled).not.toBe(source)
    expect(source).toEqual([1, 2, 3])
    expect(shuffled.toSorted()).toEqual([1, 2, 3])
  })

  it('gives every permutation the same chance', () => {
    const random = seeded(11)
    const counts = new Map<string, number>()
    for (let i = 0; i < 60_000; i++) {
      const key = shuffle([1, 2, 3], { random }).join()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    expect(counts.size).toBe(6)
    for (const count of counts.values()) expect(Math.abs(count / 60_000 - 1 / 6)).toBeLessThan(0.01)
  })
})
