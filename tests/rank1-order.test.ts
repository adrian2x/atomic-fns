import { describe, expect, it } from 'vitest'
import { BTree } from '../src/collections/BTree.js'
import { Heap } from '../src/collections/Heap.js'
import { SortedMap } from '../src/collections/SortedMap.js'
import { decimal, Decimal } from '../src/decimal/index.js'
import { ValueError } from '../src/globals/errors.js'
import { Currency } from '../src/i18n/index.js'
import { contains, sorted } from '../src/itertools/index.js'
import { max, min } from '../src/math/index.js'
import { compare, eq, gt, gte, lt, lte } from '../src/operators/index.js'

/** Deterministic PRNG so failures reproduce. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CODES = ['EUR', 'JPY', 'USD'] as const

function randomRank1(rand: () => number): unknown {
  const kind = Math.floor(rand() * 5)
  const value = Math.floor(rand() * 7) - 3
  switch (kind) {
    case 0:
      return value
    case 1:
      return BigInt(value)
    case 2:
      return decimal(value)
    default:
      return new Currency(value, CODES[Math.floor(rand() * CODES.length)] ?? 'USD', 'en-US')
  }
}

function mixedKeys(): unknown[] {
  const keys: unknown[] = []
  for (let i = 0; i < 10; i++) {
    keys.push(i, BigInt(i), decimal(`${String(i)}.5`))
    for (const code of CODES) keys.push(new Currency(i, code, 'en-US'))
  }
  return keys.slice(0, 60)
}

function unitOfSample(v: unknown): string {
  return v instanceof Currency ? v.currency : ''
}

describe('rank-1 total order across numbers and Currencies', () => {
  it('SPEC-R13 reported bugs: eq/gt/min/contains agree methods and operators', () => {
    const usd5 = new Currency(5, 'USD', 'en-US')
    const usd1 = new Currency(1, 'USD', 'en-US')
    expect(eq(usd5, 5)).toBe(true)
    expect(usd5.eq(5)).toBe(true)
    expect(eq(5, usd5)).toBe(true)
    expect(gt(usd1, 1e6)).toBe(false)
    expect(usd1.gt(1e6)).toBe(false)
    expect(min([usd1, 5])).toBe(usd1)
    expect(contains([usd5], 5)).toBe(true)
    expect(eq(decimal(5), usd5)).toBe(true)
    expect(eq(usd5, new Currency(5, 'JPY', 'en-US'))).toBe(false)
  })

  it('SPEC-R13 value-first order: numeric wins, then unit, then kind', () => {
    const usd1 = new Currency(1, 'USD', 'en-US')
    const jpy1000 = new Currency(1000, 'JPY', 'en-US')
    expect(compare(usd1, 5)).toBe(-1)
    expect(compare(5, usd1)).toBe(1)
    expect(compare(5, jpy1000)).toBe(-1)
    expect(compare(jpy1000, usd1)).toBe(1)
    expect(sorted([usd1, jpy1000, 5])).toEqual([usd1, 5, jpy1000])

    const eur9 = new Currency(9, 'EUR', 'en-US')
    const usd2 = new Currency(2, 'USD', 'en-US')
    expect(sorted([usd2, 1e300, eur9, usd1, 5n, decimal(7)])).toEqual([
      usd1,
      usd2,
      5n,
      decimal(7),
      eur9,
      1e300
    ])
  })

  it('SPEC-R13 equal amounts keep EUR and USD apart while numbers sort by unit code', () => {
    const eur10 = new Currency(10, 'EUR', 'en-US')
    const usd10 = new Currency(10, 'USD', 'en-US')
    expect(compare(eur10, usd10)).toBe(-1)
    expect(compare(10, eur10)).toBe(-1)
    expect(compare(eur10, 10)).toBe(1)
    expect(eq(eur10, usd10)).toBe(false)
    expect(eq(eur10, 10)).toBe(true)
  })

  it('SPEC-R13 5000 random triples are antisymmetric and transitive', () => {
    const rand = mulberry32(0xc0ffee)
    for (let i = 0; i < 5000; i++) {
      const a = randomRank1(rand)
      const b = randomRank1(rand)
      const c = randomRank1(rand)
      expect(compare(a, b)).toBe(-compare(b, a) || 0)
      expect(compare(b, c)).toBe(-compare(c, b) || 0)
      expect(compare(a, c)).toBe(-compare(c, a) || 0)
      const ab = compare(a, b)
      const bc = compare(b, c)
      const ac = compare(a, c)
      if (ab <= 0 && bc <= 0) expect(ac).toBeLessThanOrEqual(0)
      if (ab >= 0 && bc >= 0) expect(ac).toBeGreaterThanOrEqual(0)
      if (ab < 0 && bc < 0) expect(ac).toBe(-1)
      if (ab === 0 && bc === 0) expect(ac).toBe(0)
    }
  })

  it('SPEC-R13 60 mixed keys are all reachable in BTree and SortedMap', () => {
    const keys = mixedKeys()
    expect(keys).toHaveLength(60)
    const expected = sorted(keys)
    const shuffled = [...keys].reverse()
    const tree = new BTree<unknown, number>()
    const map = new SortedMap<unknown, number>()
    shuffled.forEach((k, i) => {
      tree.set(k, i)
      map.set(k, i)
    })
    expect(tree.size).toBe(60)
    expect(map.size).toBe(60)
    expect([...tree.keys()]).toEqual(expected)
    expect([...map.keys()]).toEqual(expected)
    shuffled.forEach((k, i) => {
      expect(tree.get(k)).toBe(i)
      expect(map.get(k)).toBe(i)
      expect(tree.has(k)).toBe(true)
      expect(map.has(k)).toBe(true)
    })
  })

  it('SPEC-R13 Heap pops mixed keys in order', () => {
    const keys = mixedKeys()
    const heap = new Heap<unknown>([...keys].reverse())
    const popped: unknown[] = []
    while (heap.size > 0) popped.push(heap.pop())
    expect(popped).toEqual(sorted(keys))
  })

  it('SPEC-R13 currency-r5 probe keys all reachable in BTree and SortedMap', () => {
    const keys: unknown[] = []
    for (let i = 0; i < 60; i++) {
      keys.push(
        i % 3 === 0
          ? new Currency(i, 'USD', 'en-US')
          : i % 3 === 1
            ? decimal(i)
            : new Currency(i, 'JPY', 'en-US')
      )
    }
    const tree = new BTree<unknown, number>()
    const map = new SortedMap<unknown, number>()
    keys.forEach((k, i) => {
      tree.set(k, i)
      map.set(k, i)
    })
    expect(tree.size).toBe(60)
    expect(map.size).toBe(60)
    expect(keys.filter((k) => !tree.has(k))).toEqual([])
    expect(keys.filter((k) => map.get(k) === undefined)).toEqual([])
  })

  it('SPEC-R13 NaN comparisons stay undefined at the protocol level', () => {
    const usd5 = new Currency(5, 'USD', 'en-US')
    expect(usd5.protocolCompare(Number.NaN)).toBeUndefined()
    expect(decimal(5).protocolCompare(Number.NaN)).toBeUndefined()
  })
})

describe('operators refuse mixed currencies', () => {
  const usd = new Currency(10, 'USD', 'en-US')
  const jpy = new Currency(1000, 'JPY', 'en-US')
  const msg = /currency mismatch: USD vs JPY/

  it('SPEC-R13 lt/lte/gt/gte throw ValueError on different codes', () => {
    for (const op of [lt, lte, gt, gte]) {
      expect(() => op(usd, jpy)).toThrow(ValueError)
      expect(() => op(usd, jpy)).toThrow(msg)
    }
    expect(() => lt(jpy, usd)).toThrow(/currency mismatch: JPY vs USD/)
    expect(() => usd.lt(jpy)).toThrow(ValueError)
    expect(() => usd.compare(jpy)).toThrow(ValueError)
  })

  it('SPEC-R13 same currency and non-currency operands still order', () => {
    const usd20 = new Currency(20, 'USD', 'en-US')
    expect(lt(usd, usd20)).toBe(true)
    expect(lte(usd, usd)).toBe(true)
    expect(gt(usd20, usd)).toBe(true)
    expect(gte(usd, usd20)).toBe(false)
    expect(lt(5, usd)).toBe(true)
    expect(gt(usd, 5)).toBe(true)
    expect(lt(decimal(1), usd)).toBe(true)
  })

  it('SPEC-R13 math min/max throw on mixed currencies and work on one currency', () => {
    expect(() => min([usd, jpy])).toThrow(ValueError)
    expect(() => max([usd, jpy])).toThrow(/currency mismatch: JPY vs USD/)
    const usd20 = new Currency(20, 'USD', 'en-US')
    expect(min([usd20, usd])).toBe(usd)
    expect(max([usd, usd20])).toBe(usd20)
  })

  it('SPEC-R13 compare and sorted never throw; eq is false across currencies', () => {
    expect(compare(usd, jpy)).toBe(-1)
    expect(compare(jpy, usd)).toBe(1)
    expect(sorted([usd, jpy])).toEqual([usd, jpy])
    expect(eq(usd, jpy)).toBe(false)
    expect(eq(usd, new Currency(10, 'JPY', 'en-US'))).toBe(false)
  })
})

describe('methods agree with operators on a random matrix', () => {
  it('SPEC-R13 2000 random pairs: eq/lt/lte/gt/gte/compare (throws included)', () => {
    const rand = mulberry32(0xdecaf)
    const rel = [
      ['lt', lt, (x: Decimal, y: never) => x.lt(y)] as const,
      ['lte', lte, (x: Decimal, y: never) => x.lte(y)] as const,
      ['gt', gt, (x: Decimal, y: never) => x.gt(y)] as const,
      ['gte', gte, (x: Decimal, y: never) => x.gte(y)] as const
    ]
    for (let i = 0; i < 2000; i++) {
      const a = randomRank1(rand)
      const b = randomRank1(rand)
      const mismatch =
        unitOfSample(a) !== '' && unitOfSample(b) !== '' && unitOfSample(a) !== unitOfSample(b)

      if (mismatch) {
        for (const [, op] of rel) {
          expect(() => op(a, b)).toThrow(ValueError)
        }
        expect(compare(a, b)).toBeGreaterThanOrEqual(-1)
        expect(eq(a, b)).toBe(false)
        if (a instanceof Currency) {
          for (const [, , method] of rel) {
            expect(() => method(a, b as never)).toThrow(ValueError)
          }
          expect(() => a.compare(b as never)).toThrow(ValueError)
          expect(a.eq(b as never)).toBe(false)
        }
        continue
      }

      if (
        a instanceof Decimal &&
        (typeof b === 'number' || typeof b === 'bigint' || b instanceof Decimal)
      ) {
        expect(a.eq(b as never)).toBe(eq(a, b))
        expect(a.compare(b as never)).toBe(compare(a, b))
        for (const [, op, method] of rel) {
          expect(method(a, b as never)).toBe(op(a, b))
        }
      }
      if (b instanceof Decimal && (typeof a === 'number' || typeof a === 'bigint')) {
        expect(b.eq(a as never)).toBe(eq(b, a))
        expect(b.compare(a as never)).toBe(compare(b, a))
        for (const [, op, method] of rel) {
          expect(method(b, a as never)).toBe(op(b, a))
        }
      }
    }
  })
})

describe('Currency.format keeps the instance currency', () => {
  const usd = new Currency(1234.5, 'USD', 'en-US')

  it('D4 opts.currency cannot replace the instance currency', () => {
    expect(usd.format({ currency: 'EUR' })).toBe('$1,234.50')
    expect(usd.format({ currency: 'EUR' })).toBe(usd.format())
  })

  it('D4 other overrides still apply and every entry point keeps USD', () => {
    expect(usd.format({ currencyDisplay: 'code', currency: 'EUR' })).toContain('USD')
    expect(usd.displayName()).toContain('US dollars')
    expect(usd.accounting()).toBe('$1,234.50')
    expect(usd.precision(0)).toBe('$1,235')
    expect(usd.format({ minimumFractionDigits: 3, currency: 'JPY' }, 'en-US')).toBe('$1,234.500')
  })
})
