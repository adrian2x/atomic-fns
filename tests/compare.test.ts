import { describe, it, expect } from 'vitest'
import { compare, eq, adaptProtocol, protocol } from '../src/operators/index.js'
import { sorted } from '../src/itertools/index.js'
import { decimal } from '../src/decimal/index.js'

describe('SPEC-R14 rank/kind table', () => {
  it('SPEC-R14 sorted corpus order', () => {
    const sym = Symbol('a')
    const d = new Date(0)
    const o = {}
    const input = [undefined, NaN, null, o, d, sym, true, 'a', 1n, 1, -0]
    const out = sorted([...input])
    expect(out[0]).toBe(-0)
    expect(out[1]).toBe(1)
    expect(out[2]).toBe(1n)
    expect(out[3]).toBe('a')
    expect(out[4]).toBe(true)
    expect(out[5]).toBe(sym)
    expect(out[6]).toBe(d)
    expect(out[7]).toBe(o)
    expect(out[8]).toBe(null)
    expect(Number.isNaN(out[9] as number)).toBe(true)
    expect(out[10]).toBe(undefined)
  })

  it('SPEC-R14 zero equals minus zero; number before equal bigint', () => {
    expect(compare(0, -0)).toBe(0)
    expect(compare(1, 1n)).toBe(-1)
    expect(compare(NaN, NaN)).toBe(0)
  })

  it('SPEC-R14 distinct Dates with equal time are non-zero and stable', () => {
    const a = new Date(5)
    const b = new Date(5)
    const r = compare(a, b)
    expect(r).not.toBe(0)
    expect(compare(a, b)).toBe(r)
    expect(compare(b, a)).toBe(-r as -1 | 0 | 1)
  })

  it('SPEC-R14 invalid Date after valid', () => {
    expect(compare(new Date(NaN), new Date(0))).toBe(1)
  })

  it('SPEC-R14 registered symbols by key; unregistered stable', () => {
    expect(compare(Symbol.for('a'), Symbol.for('a'))).toBe(0)
    const a = Symbol('a')
    const b = Symbol('a')
    expect(compare(a, b)).not.toBe(0)
    expect(compare(a, b)).toBe(compare(a, b))
  })
})

describe('SPEC-R13 compare dispatch', () => {
  it('SPEC-R13 Decimal vs Decimal and reflection with number', () => {
    expect(compare(decimal(3), decimal(1))).toBe(1)
    expect(compare(5, decimal(10))).toBe(-1)
    expect(compare(decimal(10), 5)).toBe(1)
  })

  it('SPEC-R13 equal value different kind: compare vs eq', () => {
    expect(compare(decimal(1), 1)).toBe(1)
    expect(eq(decimal(1), 1)).toBe(true)
    expect(compare(decimal(1), decimal('1.0'))).toBe(0)
  })

  it('SPEC-R13 rank beats value across types', () => {
    expect(compare(decimal(1), 'abc')).toBe(-1)
    expect(compare('abc', decimal(1))).toBe(1)
  })

  it('SPEC-R13 non-number protocol result throws TypeError', () => {
    const other = { [protocol.rank]: 6 as const }
    const bad = {
      [protocol.rank]: 6 as const,
      [protocol.compare]() {
        return '1'
      }
    }
    expect(() => compare(bad, other)).toThrow(TypeError)
    expect(() => compare(bad, other)).toThrow(/finite number or undefined/)
  })

  it('SPEC-R13 declining protocol uses kind tie-break', () => {
    class Decliner {
      [protocol.compare]() {
        return undefined
      }
    }
    const a = new Decliner()
    const b = new Decliner()
    const r = compare(a, b)
    expect(r === -compare(b, a)).toBe(true)
    expect([-1, 0, 1]).toContain(r)
  })

  it('SPEC-R13 protocol throw propagates', () => {
    const other = { [protocol.rank]: 6 as const }
    const boom = {
      [protocol.rank]: 6 as const,
      [protocol.compare]() {
        throw new RangeError('nope')
      }
    }
    expect(() => compare(boom, other)).toThrow(RangeError)
  })
})

describe('SPEC-R13 antisymmetry and transitivity', () => {
  class Adapted {
    constructor(readonly n: number) {}
    compare(o: unknown) {
      if (!(o instanceof Adapted)) return undefined
      return this.n - o.n
    }
  }
  adaptProtocol(Adapted)

  const corpus: unknown[] = [
    0,
    -0,
    1,
    5,
    -1.5,
    2 ** 60,
    Infinity,
    -Infinity,
    NaN,
    1n,
    2n ** 60n,
    '',
    'a',
    'b',
    false,
    true,
    Symbol.for('k'),
    Symbol('d'),
    new Date(0),
    new Date(NaN),
    {},
    [],
    () => 0,
    null,
    undefined,
    decimal(1),
    decimal('1152921504606846990'),
    new Adapted(1)
  ]

  function pick(rng: () => number): unknown {
    return corpus[Math.floor(rng() * corpus.length)]!
  }

  // deterministic LCG
  let seed = 0xc0ffee
  function rng() {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0x100000000
  }

  it('SPEC-R13 antisymmetry over 10000 random pairs', () => {
    for (let i = 0; i < 10000; i++) {
      const a = pick(rng)
      const b = pick(rng)
      expect(compare(a, b) === -compare(b, a)).toBe(true)
    }
  })

  it('SPEC-R13 transitivity over 10000 random triples', () => {
    for (let i = 0; i < 10000; i++) {
      const a = pick(rng)
      const b = pick(rng)
      const c = pick(rng)
      if (compare(a, b) <= 0 && compare(b, c) <= 0) {
        expect(compare(a, c)).toBeLessThanOrEqual(0)
      }
    }
  })
})

describe('SPEC-R70 exact-binary Decimal compare', () => {
  it('SPEC-R70 eq with exact and inexact floats', () => {
    expect(eq(decimal('0.1'), 0.1)).toBe(false)
    expect(eq(decimal(0.5), 0.5)).toBe(true)
    expect(compare(decimal(1), Infinity)).toBe(-1)
  })
})
