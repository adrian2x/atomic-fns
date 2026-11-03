import { describe, it, expect } from 'vitest'
import {
  bool,
  identity,
  isinstance,
  not,
  compare,
  eq,
  lt,
  lte,
  gt,
  gte,
  add,
  shallowEqual,
  deepEqual,
  adaptProtocol,
  protocol
} from '../src/operators/index.js'
import { sorted } from '../src/itertools/index.js'
import { decimal } from '../src/decimal/index.js'

describe('SPEC-R11 identity, bool, not', () => {
  it('SPEC-R11 identity returns the same value including NaN', () => {
    expect(Object.is(identity(NaN), NaN)).toBe(true)
    expect(identity(3)).toBe(3)
  })

  it('SPEC-R11 bool uses protocol.bool when present', () => {
    const o = {
      [protocol.bool]() {
        return 0
      }
    }
    expect(bool(o)).toBe(false)
    expect(bool(1)).toBe(true)
    expect(bool(false)).toBe(false)
    expect(not(false)).toBe(true)
    expect(not('')).toBe(true)
  })

  it('SPEC-R11 id is not exported', async () => {
    const mod = await import('../src/operators/index.js')
    expect('id' in mod).toBe(false)
  })
})

describe('SPEC-R12 eq', () => {
  it('SPEC-R12 Decimal and SameValueZero cases', () => {
    expect(eq(decimal(1), 2)).toBe(false)
    expect(eq(1, decimal(1))).toBe(true)
    expect(eq(decimal(1), 1)).toBe(true)
    expect(eq(NaN, NaN)).toBe(true)
    expect(eq(0, -0)).toBe(true)
    expect(eq({}, {})).toBe(false)
  })
})

describe('SPEC-R15 lt lte gt gte', () => {
  it('SPEC-R15 gte and Decimal ordering', () => {
    expect(gte(1, 2)).toBe(false)
    expect(gte(2, 2)).toBe(true)
    expect(lt(decimal('10'), decimal('9'))).toBe(false)
    expect(typeof gt(1, 2)).toBe('boolean')
    expect(lte(1, 1)).toBe(true)
    expect(gt(2, 1)).toBe(true)
  })
})

describe('SPEC-R16 arithmetic operators', () => {
  it('SPEC-R16 add on Set does not mutate; protocol.add dispatches', () => {
    const s = new Set()
    const r = add(s, 5)
    expect(r).toBe('[object Set]5')
    expect(s.size).toBe(0)
    const o = {
      [protocol.add]() {
        return 42
      }
    }
    expect(add(o, 1)).toBe(42)
    expect(add(1, 2)).toBe(3)
  })
})

describe('SPEC-R10 adaptProtocol', () => {
  it('SPEC-R10 compare-only class wires protocol.compare', () => {
    class V {
      constructor(readonly n: number) {}
      compare(o: V) {
        return this.n - o.n
      }
    }
    adaptProtocol(V)
    expect(compare(new V(2), new V(1))).toBe(1)
    expect(sorted([new V(2), new V(1)]).map((v) => v.n)).toEqual([1, 2])
  })

  it('SPEC-R10 lt/eq-only class: sorted orders by lt', () => {
    class W {
      constructor(readonly n: number) {}
      lt(o: W) {
        return this.n < o.n
      }
      eq(o: W) {
        return this.n === o.n
      }
    }
    adaptProtocol(W)
    expect(sorted([new W(3), new W(1), new W(2)]).map((w) => w.n)).toEqual([1, 2, 3])
  })

  it('SPEC-R10 lt-only class: equal values compare 0', () => {
    class L {
      constructor(readonly n: number) {}
      lt(o: L) {
        return this.n < o.n
      }
    }
    adaptProtocol(L)
    expect(compare(new L(2), new L(2))).toBe(0)
  })

  it('SPEC-R10 lt+eq with NaN fields stays antisymmetric', () => {
    class N {
      constructor(readonly n: number) {}
      lt(o: N) {
        return this.n < o.n
      }
      eq(o: N) {
        return this.n === o.n
      }
    }
    adaptProtocol(N)
    const a = new N(NaN)
    const b = new N(NaN)
    expect(compare(a, b)).toBe(-compare(b, a) as -1 | 0 | 1)
  })
})

describe('SPEC-R17 deepEqual', () => {
  it('SPEC-R17 arrays vs objects, Dates, typed arrays', () => {
    expect(deepEqual({}, [])).toBe(false)
    expect(deepEqual(new Date(1), new Date(2))).toBe(false)
    expect(deepEqual(new Uint8Array([1]), new Uint8Array([1]))).toBe(true)
  })

  it('SPEC-R17 shared structure and cycles', () => {
    const s = { a: 1 }
    const t = { a: 1 }
    expect(deepEqual({ x: s, y: s }, { x: t, y: t })).toBe(true)
    const a: unknown[] = []
    a.push(a)
    const b: unknown[] = []
    b.push(b)
    expect(deepEqual(a, b)).toBe(true)
  })

  it('SPEC-R17 NaN and signed zero', () => {
    expect(deepEqual(NaN, NaN)).toBe(true)
    expect(deepEqual(0, -0)).toBe(true)
  })
})

describe('SPEC-R18 shallowEqual', () => {
  it('SPEC-R18 object vs array is false; matching keys true', () => {
    expect(shallowEqual({}, [])).toBe(false)
    expect(shallowEqual({ a: 1 }, { a: 1 })).toBe(true)
    expect(shallowEqual([], [])).toBe(true)
  })
})

describe('isinstance', () => {
  it('isinstance checks constructors', () => {
    expect(isinstance([], Array)).toBe(true)
    expect(isinstance(new Set(), Set)).toBe(true)
  })
})
