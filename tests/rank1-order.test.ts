import { describe, expect, it } from 'vitest'
import { BTree } from '../src/collections/BTree.js'
import { Heap } from '../src/collections/Heap.js'
import { SortedMap } from '../src/collections/SortedMap.js'
import { decimal } from '../src/decimal/index.js'
import { ValueError } from '../src/globals/errors.js'
import { Currency } from '../src/i18n/index.js'
import { sorted } from '../src/itertools/index.js'
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

const CODES = ['EUR', 'JPY', 'USD']

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

describe('rank-1 total order across numbers and Currencies', () => {
  it('D1 the reported cycle is gone', () => {
    const usd1 = new Currency(1, 'USD', 'en-US')
    const jpy1000 = new Currency(1000, 'JPY', 'en-US')
    expect(compare(usd1, 5)).toBe(1)
    expect(compare(5, usd1)).toBe(-1)
    expect(compare(5, jpy1000)).toBe(-1)
    expect(compare(jpy1000, usd1)).toBe(-1)
    expect(sorted([usd1, jpy1000, 5])).toEqual([5, jpy1000, usd1])
  })

  it('D1 plain numbers sort before every Currency, then code, then amount', () => {
    const eur9 = new Currency(9, 'EUR', 'en-US')
    const usd1 = new Currency(1, 'USD', 'en-US')
    const usd2 = new Currency(2, 'USD', 'en-US')
    expect(sorted([usd2, 1e300, eur9, usd1, 5n, decimal(7)])).toEqual([
      5n,
      decimal(7),
      1e300,
      eur9,
      usd1,
      usd2
    ])
  })

  it('D1 Decimal.compare(number) and Currency.compare(number) stay numeric', () => {
    expect(new Currency(1, 'USD', 'en-US').compare(5)).toBe(-1)
    expect(decimal(1).compare(5)).toBe(-1)
  })

  it('D1 5000 random triples are antisymmetric and transitive', () => {
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

  it('D1 60 mixed keys are all reachable in BTree and SortedMap', () => {
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

  it('D1 Heap pops mixed keys in order', () => {
    const keys = mixedKeys()
    const heap = new Heap<unknown>([...keys].reverse())
    const popped: unknown[] = []
    while (heap.size > 0) popped.push(heap.pop())
    expect(popped).toEqual(sorted(keys))
  })

  it('D1 Currency is not equal to a plain number with the same amount', () => {
    const usd5 = new Currency(5, 'USD', 'en-US')
    expect(compare(usd5, 5)).toBe(1)
    expect(eq(usd5, 5)).toBe(false)
    expect(eq(5, usd5)).toBe(false)
    expect(usd5.eq(5)).toBe(true)
    expect(eq(usd5, new Currency(5, 'USD', 'de-DE'))).toBe(true)
  })

  it('D1 NaN comparisons stay undefined at the protocol level', () => {
    const usd5 = new Currency(5, 'USD', 'en-US')
    expect(usd5.protocolCompare(Number.NaN)).toBeUndefined()
    expect(decimal(5).protocolCompare(Number.NaN)).toBeUndefined()
  })
})

describe('operators refuse mixed currencies', () => {
  const usd = new Currency(10, 'USD', 'en-US')
  const jpy = new Currency(1000, 'JPY', 'en-US')
  const msg = /currency mismatch: USD vs JPY/

  it('D2 lt/lte/gt/gte throw ValueError on different codes', () => {
    for (const op of [lt, lte, gt, gte]) {
      expect(() => op(usd, jpy)).toThrow(ValueError)
      expect(() => op(usd, jpy)).toThrow(msg)
    }
    expect(() => lt(jpy, usd)).toThrow(/currency mismatch: JPY vs USD/)
  })

  it('D2 same currency and non-currency operands still order', () => {
    const usd20 = new Currency(20, 'USD', 'en-US')
    expect(lt(usd, usd20)).toBe(true)
    expect(lte(usd, usd)).toBe(true)
    expect(gt(usd20, usd)).toBe(true)
    expect(gte(usd, usd20)).toBe(false)
    expect(lt(5, usd)).toBe(true)
    expect(gt(usd, 5)).toBe(true)
    expect(lt(decimal(1), usd)).toBe(true)
  })

  it('D2 math min/max throw on mixed currencies and work on one currency', () => {
    expect(() => min([usd, jpy])).toThrow(ValueError)
    expect(() => max([usd, jpy])).toThrow(/currency mismatch: JPY vs USD/)
    const usd20 = new Currency(20, 'USD', 'en-US')
    expect(min([usd20, usd])).toBe(usd)
    expect(max([usd, usd20])).toBe(usd20)
  })

  it('D2 compare and sorted never throw; eq is false across currencies', () => {
    expect(compare(usd, jpy)).toBe(1)
    expect(compare(jpy, usd)).toBe(-1)
    expect(sorted([usd, jpy])).toEqual([jpy, usd])
    expect(eq(usd, jpy)).toBe(false)
    expect(eq(usd, new Currency(10, 'JPY', 'en-US'))).toBe(false)
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
