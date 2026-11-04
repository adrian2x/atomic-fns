import { runInNewContext } from 'node:vm'
import { afterEach, describe, it, expect, vi } from 'vitest'
import {
  BTree,
  Deque,
  FrozenSet,
  Heap,
  LRUCache,
  SortedMap,
  SortedSet,
  SplayTree,
  Trie,
  clone
} from '../src/collections/index.js'
import { decimal } from '../src/decimal/index.js'
import { Currency } from '../src/i18n/currency.js'
import { IntlDate } from '../src/i18n/date/index.js'
import { DeepEqualSession, deepEqualInSession } from '../src/operators/equality.js'
import { deepEqual, eq, protocol } from '../src/operators/index.js'
import { expectFast } from './helpers/perf.js'

describe('SPEC-R75 collection equality and clone protocol', () => {
  it('SortedSet equals by content', () => {
    expect(deepEqual(new SortedSet([1]), new SortedSet([2]))).toBe(false)
    expect(deepEqual(new SortedSet([1, 2]), new SortedSet([1]))).toBe(false)
    expect(deepEqual(new SortedSet([1, 2]), new SortedSet([2, 1]))).toBe(true)
    expect(eq(new SortedSet([1]), new SortedSet([1]))).toBe(true)
  })

  it('collections compare entries deeply', () => {
    expect(deepEqual(new SortedSet([{ a: 1 }], cmpA), new SortedSet([{ a: 1 }], cmpA))).toBe(true)
    expect(deepEqual(new SortedSet([{ a: 1 }], cmpA), new SortedSet([{ a: 2 }], cmpA))).toBe(false)
  })

  it('different constructors are never equal', () => {
    expect(deepEqual(new SortedSet([1]), new Heap([1]))).toBe(false)
    expect(deepEqual(new SortedMap([[1, 1]]), new BTree([[1, 1]]))).toBe(false)
    expect(deepEqual(new SortedSet([1]), new Set([1]))).toBe(false)
    expect(new SortedSet([1])[protocol.equals](null)).toBe(false)
    expect(new SortedSet([1])[protocol.equals](1)).toBe(false)
  })

  it('SortedMap', () => {
    expect(deepEqual(new SortedMap([[1, 'a']]), new SortedMap([[1, 'b']]))).toBe(false)
    expect(deepEqual(new SortedMap([[1, 'a']]), new SortedMap([[2, 'a']]))).toBe(false)
    expect(deepEqual(new SortedMap([[1, 'a']]), new SortedMap([[1, 'a']]))).toBe(true)
    expect(deepEqual(new SortedMap([[1, 'a']]), new SortedMap())).toBe(false)
  })

  it('BTree', () => {
    expect(deepEqual(new BTree([[1, 'a']]), new BTree([[1, 'b']]))).toBe(false)
    expect(deepEqual(new BTree([[1, 'a']]), new BTree([[1, 'a']]))).toBe(true)
  })

  it('SplayTree', () => {
    const a = new SplayTree<number, string>().set(1, 'a')
    expect(deepEqual(a, new SplayTree<number, string>().set(1, 'b'))).toBe(false)
    expect(deepEqual(a, new SplayTree<number, string>().set(1, 'a'))).toBe(true)
    const ka = { n: 1 }
    const kb = { n: 1 }
    const cmp = (x: { n: number }, y: { n: number }) => x.n - y.n
    const left = new SplayTree<{ n: number }, string>(cmp).set(ka, 'a')
    const right = new SplayTree<{ n: number }, string>(cmp).set(kb, 'a')
    expect(deepEqual(left, right)).toBe(true)
  })

  it('Deque', () => {
    expect(deepEqual(new Deque([1, 2]), new Deque([1, 3]))).toBe(false)
    expect(deepEqual(new Deque([1, 2]), new Deque([2, 1]))).toBe(false)
    expect(deepEqual(new Deque([1, 2]), new Deque([1, 2]))).toBe(true)
  })

  it('Heap', () => {
    expect(deepEqual(new Heap([1, 2]), new Heap([1, 3]))).toBe(false)
    expect(deepEqual(new Heap([1, 2]), new Heap([1, 2]))).toBe(true)

    // Default comparator: object / nested-array items equal as a multiset
    expect(deepEqual(new Heap([{ a: 1 }]), new Heap([{ a: 1 }]))).toBe(true)
    expect(deepEqual(new Heap([[1]]), new Heap([[1]]))).toBe(true)

    // -0 / 0 and null-proto twins equal in either insertion order
    expect(deepEqual(new Heap([-0, 0]), new Heap([0, -0]))).toBe(true)
    const np1: Record<string, number> = Object.create(null) as Record<string, number>
    np1.a = 1
    const np2: Record<string, number> = Object.create(null) as Record<string, number>
    np2.a = 1
    expect(deepEqual(new Heap([np1, { a: 1 }]), new Heap([{ a: 1 }, np2]))).toBe(true)
    expect(deepEqual(new Heap([np1]), new Heap([{ a: 1 }]))).toBe(true)

    const n = 10_000
    const keyed = Array.from({ length: n }, (_, i) => ({ i }))
    const h1 = new Heap(keyed)
    const h2 = new Heap(keyed.slice().reverse())
    // Pre-fix: quadratic Heap equality. Revert of 2443b9e fails these.
    expectFast(() => {
      expect(deepEqual(h1, h2)).toBe(true)
    }, 1000)

    const dated = Array.from({ length: 2000 }, (_, i) => ({ p: 0, at: new Date(i) }))
    const hd1 = new Heap(dated)
    const hd2 = new Heap(dated.slice().reverse())
    expectFast(() => {
      expect(deepEqual(hd1, hd2)).toBe(true)
    }, 1000)

    const h3 = new Heap(keyed)
    h3.pop()
    h3.push({ i: -1 })
    expectFast(() => {
      expect(deepEqual(h1, h3)).toBe(false)
    }, 1000)

    interface Item {
      p: number
      id: string
    }
    const byP = (x: Item, y: Item) => x.p - y.p
    expect(
      deepEqual(
        new Heap(
          [
            { p: 1, id: 'a' },
            { p: 1, id: 'b' }
          ],
          byP
        ),
        new Heap(
          [
            { p: 1, id: 'b' },
            { p: 1, id: 'a' }
          ],
          byP
        )
      )
    ).toBe(true)
    expect(
      deepEqual(
        new Heap(
          [
            { p: 1, id: 'a' },
            { p: 1, id: 'b' }
          ],
          byP
        ),
        new Heap(
          [
            { p: 1, id: 'a' },
            { p: 1, id: 'c' }
          ],
          byP
        )
      )
    ).toBe(false)

    // Cross-kind deepEqual items (keyed vs unkeyed leftovers)
    expect(deepEqual(new Heap([{ v: decimal(1) }]), new Heap([{ v: 1 }]))).toBe(true)
    const ms = 1_700_000_000_000
    expect(deepEqual(new Heap([new IntlDate(ms)]), new Heap([new Date(ms)]))).toBe(true)
    expect(deepEqual(new Heap([new Number(-0)]), new Heap([new Number(0)]))).toBe(false)

    const nJson = 5_000
    const jsonA = Array.from({ length: nJson }, (_, i) =>
      i % 3 === 0 ? i : i % 3 === 1 ? `s${String(i)}` : { n: i }
    )
    const jsonB = Array.from({ length: nJson }, (_, i) =>
      i % 3 === 0 ? i + nJson : i % 3 === 1 ? `t${String(i)}` : { n: i + nJson }
    )
    expectFast(() => {
      expect(deepEqual(new Heap(jsonA), new Heap(jsonB))).toBe(false)
    }, 1000)
  })

  it('Trie', () => {
    expect(deepEqual(new Trie(['ab']), new Trie(['ac']))).toBe(false)
    expect(deepEqual(new Trie(['ab']), new Trie(['ab']))).toBe(true)
  })

  it('LRUCache compares entries by key and value', () => {
    const a = new LRUCache<string, number>(2).set('a', 1).set('b', 2)
    const b = new LRUCache<string, number>(2).set('a', 1).set('b', 3)
    expect(deepEqual(a, b)).toBe(false)
    expect(deepEqual(a, new LRUCache<string, number>(2).set('a', 1).set('b', 2))).toBe(true)
  })

  it('deep clone of map-like collections keeps keys by reference', () => {
    const k = {}
    const v = { n: 1 }
    const copied = clone(new LRUCache<object, { n: number }>(2).set(k, v), true)
    expect(copied.get(k)).toEqual({ n: 1 })
    expect(copied.get(k)).not.toBe(v)
  })

  it('FrozenSet', () => {
    expect(deepEqual(new FrozenSet([1]), new FrozenSet([2]))).toBe(false)
    expect(deepEqual(new FrozenSet([1]), new FrozenSet([1]))).toBe(true)
    expect(deepEqual(new FrozenSet([1]), new Set([1]))).toBe(false)
  })

  it('a collection that contains itself terminates', () => {
    const a = new Deque<unknown>()
    a.push(a)
    const b = new Deque<unknown>()
    b.push(b)
    expect(deepEqual(a, b)).toBe(true)
    expect(deepEqual(b, a)).toBe(true)
  })

  it('nested collections compare structurally', () => {
    expect(deepEqual({ s: new SortedSet([1]) }, { s: new SortedSet([2]) })).toBe(false)
    expect(deepEqual([new SortedSet([1])], [new SortedSet([1])])).toBe(true)
  })
})

describe('SPEC-R37 collection clone', () => {
  it('SortedSet keeps its comparator', () => {
    const s = new SortedSet([1, 3, 2], (x: number, y: number) => y - x)
    const c = clone(s)
    expect(c).not.toBe(s)
    expect(c).toBeInstanceOf(SortedSet)
    expect([...c]).toEqual([3, 2, 1])
    expect(deepEqual(c, s)).toBe(true)
    c.add(4)
    expect([...c]).toEqual([4, 3, 2, 1])
    expect([...s]).toEqual([3, 2, 1])
  })

  it('clone(sortedMap, true) returns a distinct equal instance with its comparator', () => {
    const m = new SortedMap(
      [
        [1, 'a'],
        [2, 'b']
      ],
      (x: number, y: number) => y - x
    )
    const c = clone(m, true)
    expect(c).not.toBe(m)
    expect(c).toBeInstanceOf(SortedMap)
    expect(deepEqual(c, m)).toBe(true)
    expect([...c.keys()]).toEqual([2, 1])
    c.set(3, 'c')
    expect(m.has(3)).toBe(false)
    expect([...c.keys()]).toEqual([3, 2, 1])
  })

  it('BTree keeps comparator and node size', () => {
    const t = new BTree(
      [
        [1, 'a'],
        [2, 'b'],
        [3, 'c']
      ],
      (x: number, y: number) => y - x,
      { nodeCapacity: 8 }
    )
    const c = clone(t)
    expect(c).not.toBe(t)
    expect(deepEqual(c, t)).toBe(true)
    expect([...c.keys()]).toEqual([3, 2, 1])
    c.set(0, 'z')
    expect(t.size).toBe(3)
  })

  it('Deque keeps maxlen and content order', () => {
    const d = new Deque([1, 2, 3], { maxlen: 3 })
    const c = clone(d)
    expect(c).not.toBe(d)
    expect(c.maxlen).toBe(3)
    expect([...c]).toEqual([1, 2, 3])
    c.push(4)
    expect([...c]).toEqual([2, 3, 4])
    expect([...d]).toEqual([1, 2, 3])
  })

  it('Heap keeps its comparator', () => {
    const h = new Heap([1, 5, 3], (x: number, y: number) => y - x)
    const c = clone(h)
    expect(c).not.toBe(h)
    expect(c.pop()).toBe(5)
    expect(h.size).toBe(3)
    expect(h.peek()).toBe(5)
  })

  it('Trie', () => {
    const t = new Trie(['ab', 'ac'])
    const c = clone(t)
    expect(c).not.toBe(t)
    expect(deepEqual(c, t)).toBe(true)
    c.add('zz')
    expect(t.has('zz')).toBe(false)
  })

  it('LRUCache keeps capacity and recency order', () => {
    const l = new LRUCache<string, number>(2).set('a', 1).set('b', 2)
    const c = clone(l)
    expect(c).not.toBe(l)
    expect(c.capacity).toBe(2)
    expect([...c.keys()]).toEqual(['a', 'b'])
    c.set('c', 3)
    expect([...c.keys()]).toEqual(['b', 'c'])
    expect([...l.keys()]).toEqual(['a', 'b'])
  })

  it('SplayTree keeps its comparator', () => {
    const s = new SplayTree<number, string>((x, y) => y - x).set(1, 'a').set(2, 'b')
    const c = clone(s)
    expect(c).not.toBe(s)
    expect([...c.keys()]).toEqual([2, 1])
    expect(deepEqual(c, s)).toBe(true)
  })

  it('FrozenSet clone is a distinct, equal, still-frozen FrozenSet', () => {
    const f = new FrozenSet([1, 2])
    const c = clone(f)
    expect(c).not.toBe(f)
    expect(c).toBeInstanceOf(FrozenSet)
    expect(deepEqual(c, f)).toBe(true)
    expect(() => c.add(3)).toThrow(TypeError)
  })

  it('empty collections clone to empty equal instances', () => {
    expect(deepEqual(clone(new SortedSet()), new SortedSet())).toBe(true)
    expect(clone(new Deque()).size).toBe(0)
  })
})

/**
 * Shared-reference DAG: 13 levels of `{ l: x, r: x }` (exact key > 64 KB), wrapped `chain` times.
 * Each call builds an independent structure, so two calls are equal but never `===`.
 */
function dagChain(chain: number, levels = 13): object {
  let x: object = { v: 1 }
  for (let i = 0; i < levels; i++) x = { l: x, r: x }
  for (let i = 0; i < chain; i++) x = { n: x }
  return x
}

describe('Heap equality with oversized (hashed) keys', () => {
  const count = 3000

  describe.each([0, 100, 300, 500])('dos-20 chain length %i', (chain) => {
    it('[S, id] items sharing one S per side: true / false, < 200 ms', () => {
      const xA = dagChain(chain)
      const xB = dagChain(chain)
      const left = new Heap(Array.from({ length: count }, (_, i) => [xA, i]))
      const reversed = new Heap(Array.from({ length: count }, (_, i) => [xB, count - 1 - i]))
      expectFast(() => {
        expect(deepEqual(left, reversed)).toBe(true)
      }, 1000)

      const different = new Heap(
        Array.from({ length: count }, (_, i) => [xB, i === 7 ? count + 1 : i])
      )
      expectFast(() => {
        expect(deepEqual(left, different)).toBe(false)
      }, 1000)
    })

    it('{ s, id } items sharing one S per side: true / false, < 200 ms', () => {
      const sA = dagChain(chain)
      const sB = dagChain(chain)
      const left = new Heap(Array.from({ length: count }, (_, i) => ({ s: sA, id: i })))
      const reversed = new Heap(
        Array.from({ length: count }, (_, i) => ({ s: sB, id: count - 1 - i }))
      )
      expectFast(() => {
        expect(deepEqual(left, reversed)).toBe(true)
      }, 1000)

      const different = new Heap(
        Array.from({ length: count }, (_, i) => ({ s: sB, id: i === 11 ? -1 : i }))
      )
      expectFast(() => {
        expect(deepEqual(left, different)).toBe(false)
      }, 1000)
    })
  })

  it('false when the oversized subtree differs deep inside', () => {
    const a = new Heap([{ s: dagChain(10), id: 1 }])
    const bSub = dagChain(10)
    let leaf: { l?: unknown; r?: unknown; v?: number; n?: unknown } = bSub
    while (leaf.n !== undefined) leaf = leaf.n as typeof leaf
    while (leaf.l !== undefined) leaf = leaf.l as typeof leaf
    leaf.v = 2
    expect(deepEqual(a, new Heap([{ s: bSub, id: 1 }]))).toBe(false)
  })

  it('dos-21 wide shape: 12,000 refs to a ~45 KB-key subtree compares within budget', () => {
    const wide = (): unknown[] => {
      const sub = dagChain(0, 11)
      return Array.from({ length: 12_000 }, () => sub)
    }
    const left = new Heap([wide()])
    const right = new Heap([wide()])
    expectFast(() => {
      expect(deepEqual(left, right)).toBe(true)
    }, 1000)
  })

  it('hashed items still match cross-kind unkeyed items (Decimal vs number)', () => {
    const withDecimal = (): object => ({ s: dagChain(0), d: decimal(1) })
    const withNumber = (): object => ({ s: dagChain(0), d: 1 })
    expect(deepEqual(new Heap([withDecimal()]), new Heap([withNumber()]))).toBe(true)
    expect(deepEqual(new Heap([withNumber()]), new Heap([withDecimal()]))).toBe(true)
    expect(deepEqual(new Heap([withDecimal()]), new Heap([{ s: dagChain(0), d: 2 }]))).toBe(false)
  })

  it('duplicate hashed items match as a multiset', () => {
    const items = (ids: number[]): object[] => ids.map((id) => ({ s: dagChain(0), id }))
    expect(deepEqual(new Heap(items([1, 1, 2])), new Heap(items([2, 1, 1])))).toBe(true)
    expect(deepEqual(new Heap(items([1, 1, 2])), new Heap(items([1, 2, 2])))).toBe(false)
  })
})

const tied = (): number => 0
const byIdentity = (x: unknown, y: unknown): number => (x === y ? 0 : 1)
const twoEntries = (x: unknown): [number, unknown][] => [
  [0, x],
  [1, x]
]

type Level = [name: string, prototype: object, level: (x: unknown) => unknown]

/** Each level holds the level below twice, so a walk without a shared memo doubles per level. */
const structuralLevels: Level[] = [
  ['Deque', Deque.prototype, (x) => new Deque([x, x])],
  ['Heap', Heap.prototype, (x) => new Heap([x, x], tied)],
  ['SortedSet', SortedSet.prototype, (x) => new SortedSet<unknown>([[x], [x]], byIdentity)],
  ['SortedMap', SortedMap.prototype, (x) => new SortedMap(twoEntries(x))],
  ['BTree', BTree.prototype, (x) => new BTree(twoEntries(x))],
  ['SplayTree', SplayTree.prototype, (x) => new SplayTree<number, unknown>().set(0, x).set(1, x)],
  ['LRUCache', LRUCache.prototype, (x) => new LRUCache<number, unknown>(4).set(0, x).set(1, x)]
]
const cloneLevels: Level[] = [
  ...structuralLevels,
  ['FrozenSet', FrozenSet.prototype, (x) => new FrozenSet([[x], [x]])]
]

const LEVELS = 16
const DOS_TIMEOUT = { timeout: 5000 }

function stack(level: (x: unknown) => unknown, levels: number, leaf: unknown = 0): unknown {
  let x = leaf
  for (let i = 0; i < levels; i++) x = level(x)
  return x
}

function hookCalls(
  prototype: object,
  hook: typeof protocol.clone | typeof protocol.equals
): { mock: { calls: unknown[] } } {
  return vi.spyOn(prototype as Record<symbol, () => unknown>, hook)
}

describe('shared references across collection hooks', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each(cloneLevels)(
    '%s: deep clone copies each collection once',
    DOS_TIMEOUT,
    (_, proto, level) => {
      const source = stack(level, LEVELS)
      const calls = hookCalls(proto, protocol.clone)

      clone(source, true)

      expect(calls.mock.calls.length).toBe(LEVELS)
    }
  )

  it.each(structuralLevels)(
    '%s: deepEqual compares each pair once',
    DOS_TIMEOUT,
    (_, proto, level) => {
      const left = stack(level, LEVELS)
      const right = stack(level, LEVELS)
      const calls = hookCalls(proto, protocol.equals)

      expect(deepEqual(left, right)).toBe(true)

      expect(calls.mock.calls.length).toBe(LEVELS)
    }
  )

  it('a difference under shared Heaps is found once', DOS_TIMEOUT, () => {
    const level = (x: unknown): unknown => new Heap([x, x], tied)
    const left = stack(level, LEVELS)
    const right = stack(level, LEVELS, 1)
    const calls = hookCalls(Heap.prototype, protocol.equals)

    expect(deepEqual(left, right)).toBe(false)

    expect(calls.mock.calls.length).toBeLessThanOrEqual(8 * LEVELS)
  })

  it('Heaps reached through different hops share one session', DOS_TIMEOUT, () => {
    const level = (x: unknown): unknown =>
      new Heap([new Heap([x], tied), new Heap([[x]], tied)], tied)
    const left = stack(level, LEVELS)
    const right = stack(level, LEVELS)
    const calls = hookCalls(Heap.prototype, protocol.equals)

    expect(deepEqual(left, right)).toBe(true)

    expect(calls.mock.calls.length).toBe(3 * LEVELS)
  })

  it('a row shared by a Deque stays one object in the deep clone', () => {
    const row = { id: 1 }

    const copy = clone(new Deque([row, row]), true)

    expect(copy.at(0)).not.toBe(row)
    expect(copy.at(0)).toBe(copy.at(1))
  })

  it('a row shared through distinct wrappers stays one object, as in an array', () => {
    const row = { id: 1 }

    const copy = clone(new Deque([[row], [row]]), true)

    expect(copy.at(0)?.[0]).toBe(copy.at(1)?.[0])
  })

  it('a collection shared by a plain array stays one object in the deep clone', () => {
    const shared = new Deque([1])

    const copy = clone([shared, shared], true)

    expect(copy[0]).not.toBe(shared)
    expect(copy[0]).toBe(copy[1])
  })

  it('a direct deep clone hook call keeps rows shared across its elements', () => {
    const row = { id: 1 }

    const copy = new Deque([[row], [row]])[protocol.clone](true)

    expect(copy.at(0)?.[0]).toBe(copy.at(1)?.[0])
  })

  it('a shallow clone inside a deep walk leaves the memo alone', () => {
    const row = { id: 1 }
    class ShallowCopier {
      [protocol.clone](): object {
        return { shallow: clone(row), deep: clone(row, true) }
      }
    }

    const copy = clone<unknown[]>([new ShallowCopier(), row], true) as [
      { shallow: object; deep: object },
      object
    ]

    expect(copy[0].shallow).not.toBe(copy[1])
    expect(copy[0].deep).toBe(copy[1])
  })
})

function containsItself(tail: unknown): Deque<unknown> {
  const self = new Deque<unknown>()
  self.push(self, tail)
  return self
}

/** `outer` holds `inner` holds `outer`, so a walk from `outer` assumes it before reaching `tail`. */
function loop(tail: unknown): { outer: Deque<unknown>; inner: Deque<unknown> } {
  const inner = new Deque<unknown>()
  const outer = new Deque<unknown>([inner, tail])
  inner.push(outer)
  return { outer, inner }
}

/** How many pairs of `left` x `right` a session remembers as unequal. */
function storedPairs(session: DeepEqualSession, left: object[], right: object[]): number {
  return left.flatMap((a) => right.filter((b) => session.enter(a, b) === false)).length
}

describe('session memory', () => {
  /** Equal Heaps whose items only match across kinds, in opposite order. */
  function wideCrossKindItems(): { numbers: object[]; decimals: object[] } {
    const width = 30
    const chain = (leaf: unknown): object => stack((x) => ({ x }), 40, leaf) as object
    return {
      numbers: Array.from({ length: width }, (_, i) => chain(i)),
      decimals: Array.from({ length: width }, (_, i) => chain(decimal(width - 1 - i)))
    }
  }

  it('a wide Heap of deep items fills the failure memo up to the bound and no further', () => {
    const { numbers, decimals } = wideCrossKindItems()
    const session = new DeepEqualSession()
    session.failureRoom = 100

    const equal = deepEqualInSession(new Heap(numbers, tied), new Heap(decimals, tied), session)

    expect(equal).toBe(true)
    expect(storedPairs(session, numbers, decimals)).toBeLessThanOrEqual(100)
    // the first failure is still held at the end
    expect(storedPairs(session, numbers.slice(0, 1), decimals.slice(0, 1))).toBe(1)
  })

  it('failed candidates leave shared references linear', DOS_TIMEOUT, () => {
    const { numbers, decimals } = wideCrossKindItems()
    const level = (x: unknown): unknown => new Deque([x, x])
    const left = [new Heap(numbers, tied), stack(level, LEVELS)]
    const right = [new Heap(decimals, tied), stack(level, LEVELS)]
    const session = new DeepEqualSession()
    session.failureRoom = 100
    const calls = hookCalls(Deque.prototype, protocol.equals)

    expect(deepEqualInSession(left, right, session)).toBe(true)

    expect(calls.mock.calls.length).toBe(LEVELS)
  })

  it('objects past the tracking bound are compared, not taken for equal', () => {
    const rows = (last: number): object[] => [{ a: 1 }, { a: 2 }, { a: last }]

    const tight = (): DeepEqualSession => Object.assign(new DeepEqualSession(), { trackingRoom: 2 })
    expect(deepEqualInSession(rows(3), rows(3), tight())).toBe(true)
    expect(deepEqualInSession(rows(3), rows(4), tight())).toBe(false)
  })

  it('a failed comparison rolls back all it assumed', () => {
    const session = new DeepEqualSession()

    expect(deepEqualInSession(loop(1).outer, loop(2).outer, session)).toBe(false)

    expect(session.mark()).toBe(0)
  })

  it('a failed candidate keeps what the walk assumed before it', () => {
    const session = new DeepEqualSession()
    const left = [{ a: 1 }, new Heap([{ b: 1 }, { b: 2 }], tied)]
    const right = [{ a: 1 }, new Heap([{ b: 2 }, { b: 1 }], tied)]

    expect(deepEqualInSession(left, right, session)).toBe(true)

    expect(session.mark()).toBeGreaterThanOrEqual(3)
  })

  it('a session bounds its failures by default', () => {
    expect(new DeepEqualSession().failureRoom).toBe(2 ** 20)
  })

  it('a walk over distinct rows holds a small fraction of what per-pair sets would', () => {
    const rows = (): unknown[] => Array.from({ length: 200_000 }, (_, i) => [i, { i }])
    const { gc } = globalThis
    if (gc === undefined) throw new Error('tests need --expose-gc')
    const left = rows()
    const right = rows()
    gc()
    const before = process.memoryUsage().heapUsed
    let held = Infinity
    const probe = (): object => ({
      [protocol.equals](): boolean {
        gc()
        held = process.memoryUsage().heapUsed - before
        return true
      }
    })

    expect(deepEqual([...left, probe()], [...right, probe()])).toBe(true)

    expect(held).toBeLessThan(64 * 1024 * 1024)
  })

  it('a scalar with an equals hook leaves no entry', () => {
    const session = new DeepEqualSession()
    const left = decimal(1)
    const right = decimal(1)

    deepEqualInSession(left, right, session)

    expect(session.mark()).toBe(0)
  })

  it('a shallow failure leaves no entry, so a wide Heap stores none', () => {
    const session = new DeepEqualSession()
    const left = { n: 1 }
    const right = { n: 2 }

    deepEqualInSession(left, right, session)

    expect(session.enter(left, right)).not.toBe(false)
  })

  it('a failure that walked far is remembered', () => {
    const session = new DeepEqualSession()
    const rows = (last: number): object[] => [...Array.from({ length: 40 }, () => ({})), { last }]
    const left = rows(1)
    const right = rows(2)

    deepEqualInSession(left, right, session)

    expect(session.enter(left, right)).toBe(false)
  })
})

describe('comparisons that fail inside a Heap', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('a pair assumed equal on its own path is not reused after it fails', () => {
    const one = containsItself(1)
    const two = containsItself(2)
    const otherOne = containsItself(1)

    const matched = deepEqual(new Heap([one, one], tied), new Heap([two, otherOne], tied))

    expect(matched).toBe(false)
  })

  it('a pair proven under a failed assumption is not reused', () => {
    const [one, otherOne] = [loop(1), loop(1)]
    const [two, otherTwo] = [loop(2), loop(2)]
    const left = [one.outer, otherTwo.outer, one.inner]
    const right = [two.outer, otherOne.outer, two.inner]

    const twoOnes = new Heap([...left, one.inner], tied)
    const oneOfEach = new Heap([...right, otherOne.inner], tied)

    expect(deepEqual(twoOnes, oneOfEach)).toBe(false)
  })

  it('a pair that failed does not hide a later true match', () => {
    const [one, otherOne] = [loop(1), loop(1)]
    const [two, otherTwo] = [loop(2), loop(2)]

    const left = new Heap([one.outer, otherTwo.outer, one.inner, otherTwo.inner], tied)
    const right = new Heap([two.outer, otherOne.outer, two.inner, otherOne.inner], tied)

    expect(deepEqual(left, right)).toBe(true)
  })

  it('a match that holds only by assumption does not spend a partner another item needs', () => {
    const pad = (): unknown => new Deque(Array.from({ length: 40 }, () => ({})))
    function second(items: (heaps: Heap<unknown>[]) => unknown[][]): Heap<unknown> {
      const heaps = Array.from({ length: 3 }, () => new Heap<unknown>([pad()], tied))
      items(heaps).forEach((own, i) => {
        for (const item of own) heaps[i].push(item)
      })
      return heaps[1]
    }

    const left = second(([a, b, c]) => [
      [a, 0, c],
      [b, a, a],
      [a, 0, 1]
    ])
    const right = second(([a, b, c]) => [
      [0, c, a],
      [a, b, a],
      [0, a, 1]
    ])

    expect(deepEqual(left, right)).toBe(true)
  })

  it('a failed match over one class of self-containing items costs one comparison each', () => {
    const width = 40
    const items = (odd: number): Deque<unknown>[] => [
      ...Array.from({ length: width }, () => containsItself(1)),
      containsItself(odd)
    ]
    const left = new Heap(items(2), tied)
    const right = new Heap(items(3), tied)
    const calls = hookCalls(Deque.prototype, protocol.equals)

    expect(deepEqual(left, right)).toBe(false)

    expect(calls.mock.calls.length).toBeLessThanOrEqual(5 * width)
  })

  it('a failed match that assumed nothing runs one pass over the candidates', () => {
    const width = 40
    const values = Array.from({ length: width }, (_, i) => i + 2)
    const deques = (list: number[]): Deque<number>[] => list.map((value) => new Deque([value]))
    const left = new Heap(deques([...values, 1]), tied)
    const right = new Heap(deques([...values.toReversed(), 0]), tied)
    const calls = hookCalls(Deque.prototype, protocol.equals)

    expect(deepEqual(left, right)).toBe(false)

    expect(calls.mock.calls.length).toBeLessThanOrEqual(width * width)
  })

  it('a Heap that contains itself terminates', () => {
    const left = new Heap<unknown>([], tied)
    left.push(left)
    const right = new Heap<unknown>([], tied)
    right.push(right)

    expect(deepEqual(left, right)).toBe(true)
  })

  /** A failed candidate costs a re-walk of what it retracted, never a multiple per level. */
  const TOWER_LEVELS = 10
  const retried: [string, (x: unknown, tail: number) => unknown][] = [
    ['plain wrappers', (x, tail) => [x, tail]],
    ['collection wrappers', (x, tail) => new Deque([x, tail])]
  ]

  describe.each(retried)('failed candidates with %s', (_, wrap) => {
    const level =
      (order: [number, number]) =>
      (x: unknown): unknown =>
        new Heap([wrap(x, order[0]), wrap(x, order[1])], tied)

    function tower(order: [number, number], leaf: unknown): unknown {
      return stack(level(order), TOWER_LEVELS, leaf)
    }

    it('over a self-containing leaf stay polynomial', DOS_TIMEOUT, () => {
      const left = tower([2, 1], containsItself(1))
      const right = tower([1, 2], containsItself(1))
      const calls = hookCalls(Heap.prototype, protocol.equals)

      expect(deepEqual(left, right)).toBe(true)

      expect(calls.mock.calls.length).toBeLessThanOrEqual(2 * TOWER_LEVELS * TOWER_LEVELS)
    })

    it('under a pair assumed at the root stay polynomial', DOS_TIMEOUT, () => {
      function rooted(order: [number, number]): Deque<unknown> {
        const root = new Deque<unknown>()
        root.push(tower(order, new Deque([root])))
        return root
      }
      const left = rooted([2, 1])
      const right = rooted([1, 2])
      const calls = hookCalls(Heap.prototype, protocol.equals)

      expect(deepEqual(left, right)).toBe(true)

      expect(calls.mock.calls.length).toBeLessThanOrEqual(2 * TOWER_LEVELS * TOWER_LEVELS)
    })

    it('that end in a difference stay polynomial', DOS_TIMEOUT, () => {
      const left = tower([2, 1], containsItself(1))
      const right = tower([1, 2], containsItself(2))
      const calls = hookCalls(Heap.prototype, protocol.equals)

      expect(deepEqual(left, right)).toBe(false)

      expect(calls.mock.calls.length).toBeLessThanOrEqual(TOWER_LEVELS * TOWER_LEVELS)
    })
  })
})

function cmpA(x: { a: number }, y: { a: number }): number {
  return x.a - y.a
}

describe('deepEqual work limit', () => {
  /** Two sides that double the work per level once nothing can be remembered. */
  function tower(levels: number): unknown {
    let node: unknown = { leaf: 1 }
    for (let i = 0; i < levels; i++) node = [node, node]
    return node
  }

  it('throws once a walk passes its visit limit', () => {
    const session = new DeepEqualSession()
    session.visitRoom = 10
    expect(() => deepEqualInSession(tower(40), tower(40), session)).toThrow(
      new RangeError('deepEqual exceeded 33554432 comparisons')
    )
  })

  it('leaves ordinary comparisons alone', () => {
    expect(deepEqual(tower(40), tower(40))).toBe(true)
  })
})

describe('clones keep their subclass', () => {
  class SubDeque extends Deque<number> {}
  class SubHeap extends Heap<number> {}
  class SubSplayTree extends SplayTree<number, number> {}
  class SubLRUCache extends LRUCache<number, number> {}
  class SubFrozenSet extends FrozenSet<number> {}
  class SubTrie extends Trie {}

  it.each([
    ['Deque', new SubDeque([1], { maxlen: 3 })],
    ['Heap', new SubHeap([1])],
    ['SplayTree', new SubSplayTree().set(1, 1)],
    ['LRUCache', new SubLRUCache(3).set(1, 1)],
    ['FrozenSet', new SubFrozenSet([1])],
    ['Trie', new SubTrie(['a'])]
  ])('%s', (_, source) => {
    for (const deep of [false, true]) {
      const copy = clone(source, deep)
      expect(copy.constructor).toBe(source.constructor)
      expect(deepEqual(copy, source)).toBe(true)
    }
  })
})

describe('deep multiset equality', () => {
  const usd = (): Currency => new Currency(5, 'USD')
  const jpy = (): Currency => new Currency(5, 'JPY')
  const five = (): unknown => decimal(5)

  it('a boxed subclass is not its base class', () => {
    class Boxed extends Number {}
    class BoxedText extends String {}
    class BoxedFlag extends Boolean {}
    expect(deepEqual(new Heap([new Boxed(1)]), new Heap([new Number(1)]))).toBe(false)
    expect(deepEqual(new Heap([new BoxedText('a')]), new Heap([new String('a')]))).toBe(false)
    expect(deepEqual(new Heap([new BoxedFlag(true)]), new Heap([new Boolean(true)]))).toBe(false)
    expect(deepEqual(new Heap([new Boxed(1)]), new Heap([new Boxed(1)]))).toBe(true)
  })

  it('agrees with deepEqual on every pair of a mixed pool', () => {
    class Point {
      constructor(readonly x: number) {}
    }
    class Ranked {
      constructor(
        readonly rank: number,
        readonly note: string
      ) {}
      [protocol.compare](other: unknown): number | undefined {
        return other instanceof Ranked ? this.rank - other.rank : undefined
      }
    }
    const pool: unknown[] = [
      0,
      -0,
      1,
      1n,
      '1',
      NaN,
      null,
      undefined,
      true,
      '',
      new Number(1),
      new Number(-0),
      new String('1'),
      Object.assign(new String('1'), { extra: 1 }),
      new Date(0),
      new Date(0),
      new Date(NaN),
      /a/g,
      /a/i,
      new Uint8Array([1]),
      new Int8Array([1]),
      new Uint8Array([1]).buffer,
      [],
      {},
      Object.create(null),
      [1],
      [0],
      [-0],
      { 0: 1 },
      new Array(1),
      [undefined],
      { a: undefined },
      { a: 1, b: 2 },
      { b: 2, a: 1 },
      { a: { b: [1, { c: 2 }] } },
      { a: { b: [1, { c: 3 }] } },
      Object.assign([1], { extra: 1 }),
      new Map([[1, 2]]),
      new Map([[1, 3]]),
      new Map([
        [1, 2],
        [3, 4]
      ]),
      new Map([
        [3, 4],
        [1, 2]
      ]),
      new Map([[{ k: 1 }, 2]]),
      new Map([[{ k: 1 }, 2]]),
      new Set([1, 2]),
      new Set([2, 1]),
      new Set([{ m: 1 }]),
      new Set([{ m: 1 }]),
      new Set([{ m: 2 }]),
      new Point(1),
      new Point(1),
      new Point(2),
      new Ranked(1, 'a'),
      new Ranked(1, 'b'),
      new Ranked(2, 'a'),
      decimal(1),
      decimal('1.0'),
      decimal(2),
      [decimal(1)],
      { v: decimal(1) },
      { v: 1 },
      new Set([decimal(1)]),
      new Set([1]),
      new Map([['v', decimal(1)]]),
      new Map([['v', 1]]),
      new Heap([1]),
      new Deque([1]),
      new FrozenSet([{ m: 1 }]),
      new Trie(['a']),
      Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${String(i)}`, i])),
      Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${String(39 - i)}`, 39 - i])),
      Array.from({ length: 40 }, (_, i) => i),
      'x'.repeat(40) + 'y'.repeat(40) + 'z',
      'x'.repeat(40) + 'w'.repeat(40) + 'z'
    ]
    for (const x of pool) {
      for (const y of pool) {
        const expected = deepEqual(x, y)
        expect(deepEqual(new Heap([x], tied), new Heap([y], tied))).toBe(expected)
        expect(deepEqual(new Heap([x, 1], tied), new Heap([1, y], tied))).toBe(expected)
      }
    }
  })

  it('numeric members match across kinds, in any container', () => {
    const heap = (items: unknown[]): Heap<unknown> => new Heap(items, tied)
    expect(deepEqual(heap([1, 2n, decimal(3)]), heap([3n, decimal(2), 1]))).toBe(true)
    expect(deepEqual(new Set([1, 2]), new Set([2n, 1n]))).toBe(true)
    expect(deepEqual(new Map([[1, 'x']]), new Map([[1n, 'x']]))).toBe(true)
    expect(
      deepEqual(
        new Map<unknown, string>([
          [1, 'x'],
          [1n, 'y']
        ]),
        new Map<unknown, string>([
          [1n, 'x'],
          [1, 'y']
        ])
      )
    ).toBe(true)
    expect(deepEqual(new Map([[1, 'x']]), new Map([[1n, 'y']]))).toBe(false)
  })

  it('a unit never matches a unit-less member or another unit', () => {
    const heap = (items: unknown[]): Heap<unknown> => new Heap(items, tied)
    expect(deepEqual(heap([usd(), 5]), heap([5, jpy()]))).toBe(false)
    expect(deepEqual(heap([five(), usd()]), heap([usd(), jpy()]))).toBe(false)
    expect(deepEqual(heap([usd(), 5]), heap([5, usd()]))).toBe(true)
    expect(deepEqual(new Set([usd()]), new Set([jpy()]))).toBe(false)
    expect(deepEqual(new Set([usd()]), new Set([usd()]))).toBe(true)
  })

  it('compares Set members deeply, as a multiset', () => {
    expect(deepEqual(new Set([{ a: 1 }]), new Set([{ a: 1 }]))).toBe(true)
    expect(deepEqual(new Set([{ a: 1 }]), new Set([{ a: 2 }]))).toBe(false)
    expect(deepEqual(new Set([{ a: 1 }, { a: 1 }]), new Set([{ a: 1 }, { a: 2 }]))).toBe(false)
    expect(deepEqual(new Set([1, { a: 1 }]), new Set([{ a: 1 }, 1]))).toBe(true)
    expect(deepEqual(new Set([1, 2]), new Set([1, 3]))).toBe(false)
    expect(deepEqual(new Set([[new Set([1])]]), new Set([[new Set([1])]]))).toBe(true)
    expect(deepEqual(new Set([decimal(1)]), new Set([1]))).toBe(true)
    const rows = new Set([{ a: 1 }, new Map([[1, 2]])])
    expect(deepEqual(rows, clone(rows, true))).toBe(true)
  })

  it('compares Map entries with object keys deeply, as a multiset', () => {
    const map = (...entries: [unknown, unknown][]): Map<unknown, unknown> => new Map(entries)
    expect(deepEqual(map([{ k: 1 }, 'x']), map([{ k: 1 }, 'x']))).toBe(true)
    expect(deepEqual(map([{ k: 1 }, 'x']), map([{ k: 1 }, 'y']))).toBe(false)
    expect(deepEqual(map([{ k: 1 }, 'x']), map([{ k: 2 }, 'x']))).toBe(false)
    expect(deepEqual(map([{ k: 1 }, 'x'], ['p', 1]), map(['p', 1], [{ k: 1 }, 'x']))).toBe(true)
    const [left, right] = [{ k: 1 }, { k: 1 }]
    const swapped = deepEqual(map([left, 1], [right, 2]), map([left, 2], [right, 1]))
    expect(swapped).toBe(true)
    expect(deepEqual(map([decimal(1), 'x']), map([1, 'x']))).toBe(true)
    const lru = (key: object): LRUCache => new LRUCache().set(key, 1)
    expect(deepEqual(lru({ k: 1 }), lru({ k: 1 }))).toBe(true)
  })

  it('nested members stop at the nesting error, not at the native stack', () => {
    const nest = (wrap: (x: unknown) => unknown, levels: number): unknown => {
      let x: unknown = {}
      for (let i = 0; i < levels; i++) x = wrap(x)
      return x
    }
    const inSet = (x: unknown): unknown => new Set([x])
    const inMapKey = (x: unknown): unknown => new Map([[x, 1]])
    const inFrozenSet = (x: unknown): unknown => new FrozenSet([x])
    expect(deepEqual(nest(inSet, 190), nest(inSet, 190))).toBe(true)
    expect(deepEqual(nest(inMapKey, 160), nest(inMapKey, 160))).toBe(true)
    expect(deepEqual(nest(inFrozenSet, 120), nest(inFrozenSet, 120))).toBe(true)
    const tooDeep: [(x: unknown) => unknown, number][] = [
      [inSet, 300],
      [inMapKey, 200],
      [inFrozenSet, 130]
    ]
    for (const [wrap, levels] of tooDeep) {
      let failure: unknown
      try {
        deepEqual(nest(wrap, levels), nest(wrap, levels))
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(RangeError)
      expect((failure as Error).message).toBe('nesting deeper than 1000 levels')
      expect((failure as Error).cause).toBeUndefined()
    }
  })

  it('a Map with primitive keys or an equal Set never pairs members', () => {
    const calls = vi.spyOn(Deque.prototype, protocol.equals)
    const row = new Deque([1])
    const fresh = (): Map<string, unknown> => new Map([['a', new Deque([1])]])
    expect(deepEqual(new Set([row, 2]), new Set([2, row]))).toBe(true)
    expect(calls.mock.calls.length).toBe(0)
    expect(deepEqual(fresh(), fresh())).toBe(true)
    expect(calls.mock.calls.length).toBe(1)
    vi.restoreAllMocks()
  })

  it('identical references cancel without a comparison, in any order', () => {
    const rows = Array.from({ length: 2000 }, (_, i) => new Deque([i]))
    const calls = vi.spyOn(Deque.prototype, protocol.equals)
    expect(deepEqual(new Heap(rows, tied), new Heap(rows.toReversed(), tied))).toBe(true)
    expect(calls.mock.calls.length).toBe(0)
    vi.restoreAllMocks()
  })

  it('hook items in the same order cost one comparison each', () => {
    const rows = (): Deque<number>[] => Array.from({ length: 2000 }, (_, i) => new Deque([i]))
    const calls = vi.spyOn(Deque.prototype, protocol.equals)
    expect(deepEqual(new Heap(rows(), tied), new Heap(rows(), tied))).toBe(true)
    expect(calls.mock.calls.length).toBe(2000)
    vi.restoreAllMocks()
  })

  it('shuffled ordered hook items align without pairing each against all', () => {
    const count = 20_000
    const values = Array.from({ length: count }, (_, i) => (i * 7919) % count)
    const left = new Heap(values.map((value) => decimal(value)))
    const right = new Heap(values.toReversed().map((value) => decimal(value)))
    const session = new DeepEqualSession()
    session.visitRoom = 8 * count

    expect(deepEqualInSession(left, right, session)).toBe(true)
  })

  it('one unequal ordered hook item does not shift the rest out of alignment', () => {
    const count = 20_000
    const left = new Heap(Array.from({ length: count }, (_, i) => decimal(i)))
    const right = new Heap(Array.from({ length: count }, (_, i) => decimal(i + 1)))
    const session = new DeepEqualSession()
    session.visitRoom = 8 * count

    expect(deepEqualInSession(left, right, session)).toBe(false)
  })

  it('items no hash can tell apart stop at the comparison limit', () => {
    const buried = (n: number): unknown => ({ a: { b: { c: { d: { e: { f: n } } } } } })
    const ids = Array.from({ length: 200 }, (_, i) => i)
    const left = new Heap(ids.map(buried), tied)
    const right = new Heap(ids.toReversed().map(buried), tied)
    const session = new DeepEqualSession()
    session.visitRoom = 100

    expect(() => deepEqualInSession(left, right, session)).toThrow(
      new RangeError('deepEqual exceeded 33554432 comparisons')
    )
  })

  it('candidates that fail before any walk still count', () => {
    const count = 400
    const protos = Array.from({ length: count }, () => ({}))
    const items = (order: object[]): object[] =>
      order.map((proto) => Object.create(proto) as object)
    const left = new Heap(items(protos), tied)
    const right = new Heap(items(protos.toReversed()), tied)
    const session = new DeepEqualSession()
    session.visitRoom = 4 * count

    expect(() => deepEqualInSession(left, right, session)).toThrow(
      new RangeError('deepEqual exceeded 33554432 comparisons')
    )
  })

  /** Most heap bytes held whenever the comparison reads a property of the probe items. */
  function heldDuring(build: (probe: () => object) => [Heap<unknown>, Heap<unknown>]): number {
    const { gc } = globalThis
    if (gc === undefined) throw new Error('tests need --expose-gc')
    let held = 0
    let before = 0
    const probe = (): object => ({
      get bytes(): number {
        gc()
        held = Math.max(held, process.memoryUsage().heapUsed - before)
        return 0
      }
    })
    const [left, right] = build(probe)
    gc()
    before = process.memoryUsage().heapUsed
    expect(deepEqual(left, right)).toBe(true)
    return held
  }

  it('strings repeated by reference hold no copies', () => {
    const text = 'x'.repeat(2 ** 20)
    const held = heldDuring((probe) => [
      new Heap([...Array<unknown>(200).fill(text), probe()], tied),
      new Heap([...Array<unknown>(200).fill(text), probe()], tied)
    ])
    expect(held).toBeLessThan(32 * 1024 * 1024)
  })

  it('deep JSON items hold no key per node', () => {
    const item = (i: number): string =>
      '['.repeat(950) + JSON.stringify(String(i).repeat(60_000)) + ',0]' + ',0]'.repeat(949)
    const text = `[${[0, 1, 2, 3].map(item).join()}]`
    const held = heldDuring((probe) => [
      new Heap([...(JSON.parse(text) as unknown[]), probe()], tied),
      new Heap([...(JSON.parse(text) as unknown[]), probe()], tied)
    ])
    expect(held).toBeLessThan(32 * 1024 * 1024)
  })

  describe('against the greatest bisimulation', () => {
    type Kind = 'array' | 'heap' | 'set' | 'map'
    type Slot = { leaf: number } | { node: number }
    interface Graph {
      kinds: Kind[]
      slots: Slot[][]
    }

    function randomGraph(next: (n: number) => number): Graph {
      const size = 2 + next(6)
      const kinds = Array.from({ length: size }, () => {
        const kinds: Kind[] = ['array', 'heap', 'heap', 'set', 'map']
        return kinds[next(kinds.length)]
      })
      const slots = kinds.map(() =>
        Array.from({ length: next(4) }, (): Slot => {
          return next(3) === 0 ? { leaf: next(2) } : { node: next(size) }
        })
      )
      return { kinds, slots }
    }

    function build({ kinds, slots }: Graph): unknown[] {
      const nodes = kinds.map((kind): unknown => {
        if (kind === 'array') return []
        if (kind === 'heap') return new Heap<unknown>([], tied)
        return kind === 'set' ? new Set() : new Map()
      })
      const value = (slot: Slot): unknown => ('leaf' in slot ? slot.leaf : nodes[slot.node])
      nodes.forEach((node, i) => {
        for (const slot of slots[i]) {
          if (node instanceof Set) node.add(value(slot))
          else if (node instanceof Map) node.set(value(slot), 0)
          else (node as unknown[] | Heap<unknown>).push(value(slot))
        }
      })
      return nodes
    }

    /** Members after Set and Map dedupe them by reference and value. */
    function members({ kinds, slots }: Graph, i: number): Slot[] {
      if (kinds[i] === 'array' || kinds[i] === 'heap') return slots[i]
      const seen = new Set<string>()
      return slots[i].filter((slot) => {
        const id = JSON.stringify(slot)
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
    }

    function hasPerfectMatch(
      a: Slot[],
      b: Slot[],
      related: (x: Slot, y: Slot) => boolean
    ): boolean {
      const owner = new Array<number>(b.length).fill(-1)
      const claim = (i: number, tried: boolean[]): boolean =>
        b.some((slot, j) => {
          if (tried[j] || !related(a[i], slot)) return false
          tried[j] = true
          if (owner[j] !== -1 && !claim(owner[j], tried)) return false
          owner[j] = i
          return true
        })
      return a.every((_, i) => claim(i, new Array<boolean>(b.length).fill(false)))
    }

    function bisimulation(graph: Graph): boolean[][] {
      const { kinds } = graph
      const related = kinds.map((kind) => kinds.map((other) => kind === other))
      const slotsRelated = (x: Slot, y: Slot): boolean => {
        if ('leaf' in x || 'leaf' in y) {
          return 'leaf' in x && 'leaf' in y && x.leaf === y.leaf
        }
        return related[x.node][y.node]
      }
      for (let changed = true; changed;) {
        changed = false
        kinds.forEach((kind, i) => {
          kinds.forEach((_, j) => {
            if (!related[i][j]) return
            const [a, b] = [members(graph, i), members(graph, j)]
            const holds =
              a.length === b.length &&
              (kind === 'array'
                ? a.every((slot, k) => slotsRelated(slot, b[k]))
                : hasPerfectMatch(a, b, slotsRelated))
            if (!holds) {
              related[i][j] = false
              changed = true
            }
          })
        })
      }
      return related
    }

    it('matches on seeded cyclic graphs of arrays, Heaps, Sets and Maps', () => {
      let seed = 2024
      const next = (n: number): number => {
        seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff
        return (seed >>> 8) % n
      }
      for (let round = 0; round < 3000; round++) {
        const graph = randomGraph(next)
        const nodes = build(graph)
        const expected = bisimulation(graph)
        nodes.forEach((a, i) => {
          nodes.forEach((b, j) => {
            expect([round, i, j, deepEqual(a, b)]).toEqual([round, i, j, expected[i][j]])
          })
        })
      }
    })
  })
})

describe('equivalence classes', () => {
  function ring(size: number): object {
    const first: { next?: object } = {}
    let node = first
    for (let i = 1; i < size; i++) node = { next: node }
    first.next = node
    return first
  }

  it('rings of coprime sizes are equal, in about as many steps as they have nodes', () => {
    const session = new DeepEqualSession()
    const room = session.visitRoom

    expect(deepEqualInSession(ring(31), ring(37), session)).toBe(true)

    expect(room - session.visitRoom).toBeLessThanOrEqual(31 + 37)
  })

  it('rings with a difference stay different', () => {
    const marked = (size: number, index: number): object => {
      const nodes = Array.from({ length: size }, (_, i): Record<string, unknown> => {
        return { mark: i === index }
      })
      nodes.forEach((node, i) => (node.next = nodes[(i + 1) % size]))
      return nodes[0]
    }
    expect(deepEqual(marked(6, 0), marked(3, 0))).toBe(false)
    expect(deepEqual(marked(6, 0), marked(6, 3))).toBe(false)
    expect(deepEqual(marked(6, 2), marked(6, 2))).toBe(true)
  })

  it('a shared child stops doubling under a hook that is not iterable', () => {
    class Link {
      constructor(readonly next: Link | null) {}
      [protocol.equals](other: unknown): boolean {
        const peer = (other as Link).next
        return deepEqual(this.next, peer) && deepEqual(this.next, peer)
      }
    }
    const chain = (): Link | null => {
      let link: Link | null = null
      for (let i = 0; i < 40; i++) link = new Link(link)
      return link
    }
    const session = new DeepEqualSession()
    session.visitRoom = 1000

    expect(deepEqualInSession(chain(), chain(), session)).toBe(true)
  })

  it('a hook runs once per pair', () => {
    let calls = 0
    class Counted {
      [protocol.equals](): boolean {
        calls++
        return true
      }
    }
    const row = (): Counted[] => Array.from({ length: 100 }, () => new Counted())

    expect(deepEqual(row(), row())).toBe(true)

    expect(calls).toBe(100)
  })

  it('shuffled rows that carry a Decimal bucket by value', () => {
    const count = 20_000
    const values = Array.from({ length: count }, (_, i) => (i * 7919) % count)
    const rows = (order: number[]): object[] => order.map((value) => ({ p: decimal(value) }))
    const session = new DeepEqualSession()
    session.visitRoom = 8 * count

    const left = new Heap(rows(values), tied)
    const right = new Heap(rows(values.toReversed()), tied)
    expect(deepEqualInSession(left, right, session)).toBe(true)
  })

  it('shuffled date-like hooks bucket by time', () => {
    const count = 20_000
    const values = Array.from({ length: count }, (_, i) => (i * 7919) % count)
    const dates = (order: number[]): IntlDate[] => order.map((value) => new IntlDate(value))
    const session = new DeepEqualSession()
    session.visitRoom = 8 * count

    const left = new Heap(dates(values), tied)
    const right = new Heap(dates(values.toReversed()), tied)
    expect(deepEqualInSession(left, right, session)).toBe(true)
  })

  it('a foreign Date lands in the bucket of its local twin', () => {
    const foreign = runInNewContext('new Date(7)') as Date
    expect(deepEqual(new Heap([foreign], tied), new Heap([new Date(7)], tied))).toBe(true)
    expect(deepEqual(new Set([{ at: foreign }]), new Set([{ at: new Date(7) }]))).toBe(true)
  })
})

describe('session lifetime', () => {
  it('a deepEqual inside a clone starts its own session', () => {
    let result: boolean | undefined
    clone(
      {
        get g(): number {
          const a = { x: 1 }
          const b = { x: 1 }
          deepEqual(a, b)
          b.x = 2
          result = deepEqual(a, b)
          return 1
        }
      },
      true
    )
    expect(result).toBe(false)
  })

  it('a deepEqual in a getter of a running walk starts its own session', () => {
    let result: boolean | undefined
    const a = { x: 1 }
    const b = { x: 1 }
    const reader = {
      get g(): number {
        deepEqual(a, b)
        b.x = 2
        result = deepEqual(a, b)
        return 1
      }
    }
    expect(deepEqual([reader], [{ g: 1 }])).toBe(true)
    expect(result).toBe(false)
  })

  it('a deepEqual in a getter under a hook starts its own session too', () => {
    let result: boolean | undefined
    const a = { x: 1 }
    const b = { x: 1 }
    const reader = {
      get g(): number {
        deepEqual(a, b)
        b.x = 2
        result = deepEqual(a, b)
        return 1
      }
    }
    class Wrapper {
      constructor(readonly inner: unknown) {}
      [protocol.equals](other: unknown): boolean {
        return deepEqual(this.inner, (other as Wrapper).inner)
      }
    }
    expect(deepEqual(new Wrapper([reader]), new Wrapper([{ g: 1 }]))).toBe(true)
    expect(result).toBe(false)
  })

  it('a hook that walks back to its owner shares the session of that walk', () => {
    class Back {
      constructor(readonly owner: { back?: Back }) {}
      [protocol.equals](other: unknown): boolean {
        return deepEqual(this.owner, (other as Back).owner)
      }
    }
    const owner = (): object => {
      const node: { back?: Back } = {}
      node.back = new Back(node)
      return node
    }
    expect(deepEqual(owner(), owner())).toBe(true)
  })
})
