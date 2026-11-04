import { describe, it, expect } from 'vitest'
import vm from 'node:vm'
import { compare, eq, adaptProtocol, protocol } from '../src/operators/index.js'
import { compareSlow } from '../src/operators/order.js'
import { sorted } from '../src/itertools/index.js'
import { decimal } from '../src/decimal/index.js'
import { SortedSet } from '../src/collections/SortedSet.js'
import { IntlDate } from '../src/i18n/index.js'

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

  it('SPEC-R14 equal-time Dates compare 0 in both Date and IntlDate paths', () => {
    expect(compare(new Date(5), new Date(5))).toBe(0)
    expect(compare(new IntlDate(5), new IntlDate(5))).toBe(0)
    expect(compare(new IntlDate(5), new Date(5))).toBe(0)
    expect(compare(new Date(5), new IntlDate(5))).toBe(0)
    expect(compare(new Date(4), new IntlDate(5))).toBe(-1)
  })

  it('SPEC-R14 equal-time Dates keep sorted stable and dedupe in a SortedSet', () => {
    const a = new Date(5)
    const b = new Date(5)
    expect(sorted([b, a])[0]).toBe(b)
    expect(sorted([a, b])[0]).toBe(a)
    expect(new SortedSet([a, b]).size).toBe(1)
  })

  it('SPEC-R14 invalid Date after valid; invalid Dates tie', () => {
    expect(compare(new Date(NaN), new Date(0))).toBe(1)
    expect(compare(new Date(0), new Date(NaN))).toBe(-1)
    expect(compare(new Date(NaN), new Date(NaN))).toBe(0)
  })

  it('SPEC-R14 a Date is what has the internal slot, not a tag', () => {
    class Fake {
      readonly [Symbol.toStringTag] = 'Date'
    }
    const fake = new Fake()
    expect(compare(fake, fake)).toBe(0)
    expect(compare(fake, new Date(0))).toBe(1)
    expect(compare(new Date(0), fake)).toBe(-1)
    expect(sorted([fake, new Date(0)])[1]).toBe(fake)

    const shadowed = Object.assign(new Date(1), { getTime: 'not a function' })
    expect(compare(shadowed, new Date(0))).toBe(1)
    expect(compare(vm.runInNewContext('new Date(1)'), new Date(2))).toBe(-1)
  })

  it('SPEC-R14 registered symbols by key; unregistered stable', () => {
    expect(compare(Symbol.for('a'), Symbol.for('a'))).toBe(0)
    const a = Symbol('a')
    const b = Symbol('a')
    expect(compare(a, b)).not.toBe(0)
    expect(compare(a, b)).toBe(compare(a, b))
  })
})

describe('SPEC-R14 arrays order by content', () => {
  const zeros = (length: number) => new Array<number>(length).fill(0)

  it('orders lexicographically, then by length', () => {
    expect(compare([1, 2], [1, 3])).toBe(-1)
    expect(compare([2], [1, 9])).toBe(1)
    expect(compare([1], [1, 0])).toBe(-1)
    expect(compare([], [0])).toBe(-1)
    expect(compare(['a'], [1])).toBe(1)
    expect(sorted([[3], [1], [2]])).toEqual([[1], [2], [3]])
    expect(sorted([[1, 2], [1], [0, 9]])).toEqual([[0, 9], [1], [1, 2]])
  })

  it('reads two levels; deeper arrays tie', () => {
    expect(compare([[1]], [[2]])).toBe(-1)
    expect(compare([[1], 3], [[1], 2])).toBe(1)
    const deepA = [[[2]], 'a']
    const deepB = [[[1]], 'b']
    expect(compare(deepA, deepB)).toBe(-1)
  })

  it('reads the first 32 elements, then the length', () => {
    const atLastRead = zeros(33)
    atLastRead[31] = 1
    expect(compare(atLastRead, zeros(33))).toBe(1)
    expect(compare(zeros(34), zeros(33))).toBe(1)

    const pastLastRead = zeros(33)
    pastLastRead[32] = 1
    // Identity, first compared first: index 32 would have said 1.
    expect(compare(pastLastRead, zeros(33))).toBe(-1)
  })

  it('breaks a content tie by identity, so distinct arrays stay distinct', () => {
    const a = [1]
    const b = [1]
    const order = compare(a, b)
    expect(order).not.toBe(0)
    expect(compare(a, b)).toBe(order)
    expect(compare(b, a)).toBe(-order)
    expect(compare(a, a)).toBe(0)
    expect(eq(a, b)).toBe(false)
  })

  it('stays bounded on cycles and huge sparse arrays', () => {
    const a: unknown[] = []
    a.push(a)
    const b: unknown[] = []
    b.push(b)
    expect(compare(a, b)).not.toBe(0)
    expect(compare(new Array(2 ** 32 - 1), new Array(2 ** 32 - 2))).toBe(1)
  })

  it('arrays sort before other objects; typed arrays stay identity', () => {
    expect(compare([], {})).toBe(-1)
    expect(compare({}, [])).toBe(1)
    const x = new Uint8Array([2])
    const y = new Uint8Array([1])
    const order = compare(x, y)
    expect(order).toBe(-compare(y, x))
    expect(compare(new Uint8Array([1]), new Uint8Array([1]))).not.toBe(0)
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

  it.each([null, true, '1', NaN, Infinity, {}])(
    'SPEC-R13 invalid protocol result %j throws in both argument orders',
    (value) => {
      const other = { [protocol.rank]: 6 as const }
      const bad = {
        [protocol.rank]: 6 as const,
        [protocol.compare]() {
          return value
        }
      }
      // forward: bad is x; reflected: bad is y and the result is validated before negation
      expect(() => compare(bad, other)).toThrow(TypeError)
      expect(() => compare(other, bad)).toThrow(TypeError)
      expect(() => compare(other, bad)).toThrow(/finite number or undefined/)
    }
  )

  it('SPEC-R13 reflected finite result is negated', () => {
    const other = { [protocol.rank]: 6 as const }
    const pos = {
      [protocol.rank]: 6 as const,
      [protocol.compare]() {
        return 5
      }
    }
    expect(compare(pos, other)).toBe(1)
    expect(compare(other, pos)).toBe(-1)
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
    new Date(0),
    new Date(NaN),
    new IntlDate(0),
    new IntlDate(1),
    {},
    [],
    [1],
    [1],
    [1, 2],
    [[1]],
    [[[1]]],
    [[[2]]],
    ['a'],
    [NaN],
    [{}],
    new Uint8Array(1),
    () => 0,
    null,
    undefined,
    decimal(1),
    decimal('1152921504606846990'),
    new Adapted(1)
  ]

  function pick(rng: () => number): unknown {
    return corpus.at(Math.floor(rng() * corpus.length))
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

  it('number/string fast path agrees with slow path on randomized corpus', () => {
    const values: unknown[] = [
      0,
      -0,
      1,
      -1,
      2,
      1e9,
      -1e9,
      Math.PI,
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
      Infinity,
      -Infinity,
      NaN,
      '',
      'a',
      'b',
      'aa',
      'A',
      '0',
      '10',
      ' ',
      '\u0000'
    ]
    for (let i = 0; i < 5000; i++) {
      const a = values[Math.floor(rng() * values.length)]
      const b = values[Math.floor(rng() * values.length)]
      expect(compare(a, b)).toBe(compareSlow(a, b))
    }
    for (let i = 0; i < 2000; i++) {
      const a = pick(rng)
      const b = pick(rng)
      expect(compare(a, b)).toBe(compareSlow(a, b))
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
