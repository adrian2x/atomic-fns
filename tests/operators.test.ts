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
  div,
  mod,
  mul,
  pow,
  sub,
  shallowEqual,
  deepEqual,
  adaptProtocol,
  protocol,
  unitOf
} from '../src/operators/index.js'
import { sorted } from '../src/itertools/index.js'
import { abs } from '../src/math/index.js'
import { decimal } from '../src/decimal/index.js'
import { Deque } from '../src/collections/deque.js'
import { Currency, IntlDate } from '../src/i18n/index.js'
import { guardNesting } from '../src/internal/nesting.js'

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

describe('relational checks use content, never identity', () => {
  const relations = (x: unknown, y: unknown) => [lt(x, y), lte(x, y), gt(x, y), gte(x, y)]
  const EQUAL = [false, true, false, true]
  const LESS = [true, true, false, false]
  const GREATER = [false, false, true, true]
  const UNRELATED = [false, false, false, false]

  it('equal-time Dates are equal', () => {
    expect(relations(new Date(5), new Date(5))).toEqual(EQUAL)
    expect(relations(new Date(1), new Date(2))).toEqual(LESS)
    expect(relations(new IntlDate(5), new Date(5))).toEqual(EQUAL)
    expect(relations(new Date(5), new IntlDate(6))).toEqual(LESS)
  })

  it('NaN and Invalid Dates make all four false', () => {
    expect(relations(NaN, 1)).toEqual(UNRELATED)
    expect(relations(1, NaN)).toEqual(UNRELATED)
    expect(relations(NaN, NaN)).toEqual(UNRELATED)
    expect(relations(Infinity, NaN)).toEqual(UNRELATED)
    expect(relations(new Number(NaN), 1)).toEqual(UNRELATED)
    expect(relations(new Date(NaN), new Date(0))).toEqual(UNRELATED)
    expect(relations(new Date(NaN), new Date(NaN))).toEqual(UNRELATED)
  })

  it('a value relates to itself even when its content cannot', () => {
    const invalid = new Date(NaN)
    const holdsNaN = [NaN]
    expect(relations(invalid, invalid)).toEqual(EQUAL)
    expect(relations(holdsNaN, holdsNaN)).toEqual(EQUAL)
    expect(relations([holdsNaN], [holdsNaN])).toEqual(EQUAL)
  })

  it('operands of different kinds are incomparable', () => {
    expect(relations(1, undefined)).toEqual(UNRELATED)
    expect(relations(undefined, 1)).toEqual(UNRELATED)
    expect(relations(null, 1)).toEqual(UNRELATED)
    expect(relations(null, undefined)).toEqual(UNRELATED)
    expect(relations('2', 10)).toEqual(UNRELATED)
    expect(relations('a', 1)).toEqual(UNRELATED)
    expect(relations(true, 1)).toEqual(UNRELATED)
    expect(relations(new Date(5), 10)).toEqual(UNRELATED)
    expect(relations([1], 1)).toEqual(UNRELATED)
  })

  it('values with no order relate only through eq', () => {
    const o = {}
    const f = () => 0
    expect(relations({}, {})).toEqual(UNRELATED)
    expect(relations(o, o)).toEqual(EQUAL)
    expect(relations(/a/, /a/)).toEqual(UNRELATED)
    expect(relations(f, () => 0)).toEqual(UNRELATED)
    expect(relations(f, f)).toEqual(EQUAL)
    expect(relations(null, null)).toEqual(EQUAL)
    expect(relations(undefined, undefined)).toEqual(EQUAL)
    expect(relations(new Uint8Array([1]), new Uint8Array([2]))).toEqual(UNRELATED)
  })

  it('eq implies lte and gte for hooks with no order of their own', () => {
    const a = new Deque([1])
    const b = new Deque([1])
    expect(eq(a, b)).toBe(true)
    expect(relations(a, b)).toEqual(EQUAL)
    expect(relations(new Deque([1]), new Deque([2]))).toEqual(UNRELATED)
  })

  it('primitives of one kind keep their native order', () => {
    expect(relations('a', 'b')).toEqual(LESS)
    expect(relations('a', 'a')).toEqual(EQUAL)
    expect(relations(false, true)).toEqual(LESS)
    expect(relations(Symbol.for('a'), Symbol.for('b'))).toEqual(LESS)
    expect(relations(Symbol('a'), Symbol('a'))).toEqual(UNRELATED)
    const s = Symbol('s')
    expect(relations(s, s)).toEqual(EQUAL)
  })

  it('boxed numbers unbox', () => {
    expect(relations(new Number(1), 2)).toEqual(LESS)
    expect(relations(2, new Number(1))).toEqual(GREATER)
    expect(relations(new Number(1), new Number(1))).toEqual(EQUAL)
    expect(relations(new Number(1), 1n)).toEqual(EQUAL)
    expect(relations(new Number(1), decimal(2))).toEqual(LESS)
  })

  it('arrays compare by content with no tie-break', () => {
    expect(relations([1], [1])).toEqual(EQUAL)
    expect(relations([1], [2])).toEqual(LESS)
    expect(relations([2], [1])).toEqual(GREATER)
    expect(relations([1], [1, 0])).toEqual(LESS)
    expect(relations([[1], 2], [[1], 3])).toEqual(LESS)
    expect(relations([new Date(5)], [new Date(5)])).toEqual(EQUAL)
    expect(relations([1], ['a'])).toEqual(UNRELATED)
    expect(relations([NaN], [1])).toEqual(UNRELATED)
    expect(relations([{}], [{}])).toEqual(UNRELATED)
    expect(relations([[[1]]], [[[2]]])).toEqual(UNRELATED)
  })

  it('a hook decides, and undefined from it means incomparable', () => {
    class Version {
      constructor(readonly n: number) {}
      [protocol.compare](o: unknown) {
        return o instanceof Version ? this.n - o.n : undefined
      }
    }
    expect(relations(new Version(1), new Version(2))).toEqual(LESS)
    expect(relations(new Version(1), new Version(1))).toEqual(EQUAL)
    expect(relations(new Version(1), {})).toEqual(UNRELATED)
    expect(relations({}, new Version(1))).toEqual(UNRELATED)
  })
})

describe('arithmetic with a hook on the right', () => {
  const recorder = (key: symbol) => {
    const calls: unknown[][] = []
    const hook = {
      [key](...args: unknown[]) {
        calls.push(args)
        return 'hooked'
      }
    }
    return { calls, hook }
  }

  it.each([
    ['add', add, protocol.add],
    ['sub', sub, protocol.sub],
    ['mul', mul, protocol.mul],
    ['div', div, protocol.div],
    ['mod', mod, protocol.mod],
    ['pow', pow, protocol.pow]
  ] as const)('%s calls the right hook with reflected = true', (_name, op, key) => {
    const { calls, hook } = recorder(key)
    expect(op(1, hook)).toBe('hooked')
    expect(calls).toEqual([[1, true]])
  })

  it('a left hook wins and sees no reflected flag', () => {
    const left = recorder(protocol.add)
    const right = recorder(protocol.add)
    expect(add(left.hook, right.hook)).toBe('hooked')
    expect(left.calls).toEqual([[right.hook]])
    expect(right.calls).toEqual([])
  })

  it('Decimal keeps the operand order', () => {
    expect(String(add(1, decimal('2')))).toBe('3')
    expect(String(sub(1, decimal('3')))).toBe('-2')
    expect(String(mul(2, decimal('3')))).toBe('6')
    expect(String(div(1, decimal('4')))).toBe('0.25')
    expect(String(sub(decimal('3'), 1))).toBe('2')
    expect(String(div(decimal('4'), 1))).toBe('4')
  })

  it('Currency keeps its unit when subtracted from a number', () => {
    const difference = sub(10, new Currency(3, 'USD', 'en-US'))
    expect(difference).toBeInstanceOf(Currency)
    expect(String(difference)).toBe(String(new Currency(7, 'USD', 'en-US')))
  })

  it('Decimal has no mod or pow hook', () => {
    expect(() => mod(decimal('7'), 2)).toThrow(TypeError)
    expect(() => pow(decimal('2'), 3)).toThrow(TypeError)
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

  it('SPEC-R17 shared sub-object pairs with different partners in both orders', () => {
    const s = { a: 1 }
    const t1 = { a: 1 }
    const t2 = { a: 1 }
    expect(deepEqual({ x: s, y: s }, { x: t1, y: t2 })).toBe(true)
    expect(deepEqual({ x: t1, y: t2 }, { x: s, y: s })).toBe(true)
  })

  it('SPEC-R17 shared sub-object against unequal partners is false in both orders', () => {
    const s = { a: 1 }
    const t1 = { a: 1 }
    const t2 = { a: 2 }
    expect(deepEqual({ x: s, y: s }, { x: t1, y: t2 })).toBe(false)
    expect(deepEqual({ x: t1, y: t2 }, { x: s, y: s })).toBe(false)
  })

  it('SPEC-R17 shared arrays and Maps pair with different partners', () => {
    const s = [1, [2]]
    expect(
      deepEqual(
        [s, s],
        [
          [1, [2]],
          [1, [2]]
        ]
      )
    ).toBe(true)
    expect(
      deepEqual(
        [
          [1, [2]],
          [1, [2]]
        ],
        [s, s]
      )
    ).toBe(true)
    const m = new Map([['k', { a: 1 }]])
    expect(deepEqual({ p: m, q: m }, { p: new Map(m), q: new Map([['k', { a: 1 }]]) })).toBe(true)
  })

  it('SPEC-R17 cycles still terminate, including mutual and unequal ones', () => {
    const a1: Record<string, unknown> = {}
    const a2: Record<string, unknown> = { prev: a1 }
    a1.next = a2
    const b1: Record<string, unknown> = {}
    const b2: Record<string, unknown> = { prev: b1 }
    b1.next = b2
    expect(deepEqual(a1, b1)).toBe(true)
    expect(deepEqual(b1, a1)).toBe(true)

    const c: Record<string, unknown> = { v: 1 }
    c.self = c
    const d: Record<string, unknown> = { v: 2 }
    d.self = d
    expect(deepEqual(c, d)).toBe(false)
    expect(deepEqual(d, c)).toBe(false)
  })

  it('SPEC-R17 dispatches to protocol.equals when either side has it', () => {
    expect(deepEqual(decimal(1), decimal(2))).toBe(false)
    expect(deepEqual(decimal(1), decimal('1.0'))).toBe(true)
    expect(deepEqual(decimal(1), 1)).toBe(true)
    expect(deepEqual(1, decimal(1))).toBe(true)
    expect(deepEqual(decimal(1), 2)).toBe(false)
    expect(deepEqual([decimal(1)], [decimal(2)])).toBe(false)
    expect(deepEqual({ d: decimal(3) }, { d: decimal('3.0') })).toBe(true)
  })

  it('SPEC-R17 protocol.equals decides even when structure would match', () => {
    class AlwaysDifferent {
      [protocol.equals](): boolean {
        return false
      }
    }
    class AlwaysSame {
      [protocol.equals](): boolean {
        return true
      }
      readonly tag: string
      constructor(tag: string) {
        this.tag = tag
      }
    }
    expect(deepEqual(new AlwaysDifferent(), new AlwaysDifferent())).toBe(false)
    expect(deepEqual(new AlwaysSame('a'), new AlwaysSame('b'))).toBe(true)
  })

  it('SPEC-R17 boxed primitives compare by value', () => {
    expect(deepEqual(new Number(1), new Number(2))).toBe(false)
    expect(deepEqual(new Number(1), new Number(1))).toBe(true)
    expect(deepEqual(new Number(NaN), new Number(NaN))).toBe(true)
    expect(deepEqual(new Number(0), new Number(-0))).toBe(false)
    expect(deepEqual(new String('a'), new String('b'))).toBe(false)
    expect(deepEqual(new String('a'), new String('a'))).toBe(true)
    expect(deepEqual(new Boolean(true), new Boolean(false))).toBe(false)
    expect(deepEqual(new Boolean(false), new Boolean(false))).toBe(true)
    expect(deepEqual(Object(1n), Object(2n))).toBe(false)
    expect(deepEqual(Object(1n), Object(1n))).toBe(true)
    const sym = Symbol('s')
    expect(deepEqual(Object(sym), Object(Symbol('s')))).toBe(false)
    expect(deepEqual(Object(sym), Object(sym))).toBe(true)
  })

  it('SPEC-R17 boxed primitive differs from other kinds', () => {
    expect(deepEqual(new Number(1), new String('1'))).toBe(false)
    expect(deepEqual(new Number(1), 1)).toBe(false)
    expect(deepEqual(new Number(1), {})).toBe(false)
  })

  it('SPEC-R17 impostor tagged object is not unboxed', () => {
    const fake = Object.create(Number.prototype) as object
    expect(deepEqual(fake, Object.create(Number.prototype) as object)).toBe(true)
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

describe('SPEC-R16 arithmetic operators coverage', () => {
  it('SPEC-R16 sub mul div mod pow numeric and protocol paths', () => {
    expect(sub(5, 2)).toBe(3)
    expect(mul(3, 4)).toBe(12)
    expect(div(10, 2)).toBe(5)
    expect(mod(7, 3)).toBe(1)
    expect(pow(2, 3)).toBe(8)
    const o = {
      [protocol.sub](y: unknown) {
        return Number(y) + 1
      },
      [protocol.mul](y: unknown) {
        return Number(y) + 2
      },
      [protocol.div](y: unknown) {
        return Number(y) + 3
      },
      [protocol.mod](y: unknown) {
        return Number(y) + 4
      },
      [protocol.pow](y: unknown) {
        return Number(y) + 5
      },
      [protocol.add](y: unknown) {
        return Number(y) + 6
      },
      [protocol.abs]() {
        return 99
      }
    }
    expect(sub(o, 1)).toBe(2)
    expect(mul(o, 1)).toBe(3)
    expect(div(o, 1)).toBe(4)
    expect(mod(o, 1)).toBe(5)
    expect(pow(o, 1)).toBe(6)
    expect(add(o, 1)).toBe(7)
    expect(abs(o)).toBe(99)
  })
})

describe('SPEC-R17 deepEqual branch coverage', () => {
  it('SPEC-R17 RegExp ArrayBuffer Map Set mismatch and nested failure', () => {
    expect(deepEqual(/a/g, /a/i)).toBe(false)
    expect(deepEqual(/a/g, /a/g)).toBe(true)
    expect(deepEqual(new ArrayBuffer(2), new ArrayBuffer(3))).toBe(false)
    const a = new ArrayBuffer(2)
    const b = new ArrayBuffer(2)
    new Uint8Array(a)[0] = 1
    new Uint8Array(b)[0] = 2
    expect(deepEqual(a, b)).toBe(false)
    expect(deepEqual(new ArrayBuffer(1), new ArrayBuffer(1))).toBe(true)
    expect(deepEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false)
    expect(deepEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false)
    expect(deepEqual(new Map([[1, 2]]), new Map([[1, 3]]))).toBe(false)
    expect(deepEqual(new Map([[1, 2]]), new Map([[2, 2]]))).toBe(false)
    expect(
      deepEqual(
        new Map([[1, 2]]),
        new Map([
          [1, 2],
          [3, 4]
        ])
      )
    ).toBe(false)
    expect(deepEqual(new Map([[1, 2]]), new Map([[1, 2]]))).toBe(true)
    expect(deepEqual(new Set([1]), new Set([2]))).toBe(false)
    expect(deepEqual(new Set([1, 2]), new Set([1]))).toBe(false)
    expect(deepEqual(new Set([1]), new Set([1]))).toBe(true)
    expect(deepEqual([1, 2], [1])).toBe(false)
    expect(deepEqual([1, 2], [1, 3])).toBe(false)
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false)
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(deepEqual(null, {})).toBe(false)
    expect(deepEqual(1, 2)).toBe(false)
  })

  it('SPEC-R18 shallowEqual mismatch branches', () => {
    expect(shallowEqual({ a: 1 }, { a: 1 })).toBe(true)
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(shallowEqual({ a: 1 }, { b: 1 })).toBe(false)
    expect(shallowEqual(null, {})).toBe(false)
    expect(shallowEqual(1, 1)).toBe(true)
    expect(shallowEqual(Object.create(null), {})).toBe(false)
  })
})

describe('adaptProtocol reads descriptors, not values', () => {
  it('wires a unit inherited from a parent class', () => {
    class Base {
      readonly code = 'USD'
      get unit() {
        return this.code
      }
    }
    class Child extends Base {}
    adaptProtocol(Child)
    expect(unitOf(new Child())).toBe('USD')
  })

  it('leaves accessors on the prototype unread', () => {
    class Vector {
      #x = 1
      get abs() {
        return this.#x
      }
      get lt() {
        return this.#x
      }
    }
    expect(() => adaptProtocol(Vector)).not.toThrow()
    expect(new Vector().abs).toBe(1)
  })

  it('does not run a private unit getter on an adapted parent', () => {
    class Base {
      #unit = 'USD'
      get unit() {
        return this.#unit
      }
    }
    class Child extends Base {}
    adaptProtocol(Base)
    expect(() => adaptProtocol(Child)).not.toThrow()
    expect(unitOf(new Child())).toBe('USD')
  })
})

describe('guardNesting on engines with other overflow errors', () => {
  it('rethrows a SpiderMonkey stack overflow as the nesting error', () => {
    const overflow = Object.assign(new Error('too much recursion'), { name: 'InternalError' })
    expect(() =>
      guardNesting(() => {
        throw overflow
      })
    ).toThrow(new RangeError('nesting deeper than 1000 levels', { cause: overflow }))
  })

  it('leaves another InternalError alone', () => {
    const other = Object.assign(new Error('out of range'), { name: 'InternalError' })
    expect(() =>
      guardNesting(() => {
        throw other
      })
    ).toThrow(other)
  })
})

describe('SPEC-R10 adaptProtocol gt-only ordering', () => {
  it('SPEC-R10 gt-only class derives compare', () => {
    class G {
      constructor(readonly n: number) {}
      gt(o: G) {
        return this.n > o.n
      }
    }
    adaptProtocol(G)
    expect(compare(new G(2), new G(1))).toBe(1)
    expect(compare(new G(1), new G(2))).toBe(-1)
    expect(compare(new G(1), new G(1))).toBe(0)
  })

  it('SPEC-R10 gt+eq class declines incomparable', () => {
    class GE {
      constructor(readonly n: number) {}
      gt(o: GE) {
        return this.n > o.n
      }
      eq(o: GE) {
        return this.n === o.n
      }
    }
    adaptProtocol(GE)
    const a = new GE(NaN)
    const b = new GE(NaN)
    expect(compare(a, b)).toBe(-compare(b, a))
  })
})
