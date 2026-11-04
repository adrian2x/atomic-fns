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
import { IntlDate } from '../src/i18n/date/index.js'
import { walkSession } from '../src/internal/nesting.js'
import {
  createDeepEqualSession,
  deepEqualInSession,
  type DeepEqualSession
} from '../src/operators/equality.js'
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
    expect(deepEqual(new Heap([np1]), new Heap([{ a: 1 }]))).toBe(false)

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

/** How many pairs of `left` x `right` a memo holds, in either order. */
function storedPairs(
  memo: DeepEqualSession['proven'] | undefined,
  left: object[],
  right: object[]
): number {
  return left.flatMap((a) => right.filter((b) => memo?.has(a, b) === true)).length
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
    const session = walkSession(createDeepEqualSession)
    session.failureRoom = 100

    const equal = deepEqual(new Heap(numbers, tied), new Heap(decimals, tied))

    expect(equal).toBe(true)
    expect(storedPairs(session.disproven, numbers, decimals)).toBeLessThanOrEqual(100)
    // the first failure is still held at the end
    expect(storedPairs(session.disproven, numbers.slice(0, 1), decimals.slice(0, 1))).toBe(1)
  })

  it(
    'failed candidates leave proofs the room that keeps shared references linear',
    DOS_TIMEOUT,
    () => {
      const { numbers, decimals } = wideCrossKindItems()
      const level = (x: unknown): unknown => new Deque([x, x])
      const left = [new Heap(numbers, tied), stack(level, LEVELS)]
      const right = [new Heap(decimals, tied), stack(level, LEVELS)]
      const session = walkSession(createDeepEqualSession)
      session.failureRoom = 100
      session.proofRoom = 2000
      const calls = hookCalls(Deque.prototype, protocol.equals)

      expect(deepEqual(left, right)).toBe(true)

      expect(calls.mock.calls.length).toBe(LEVELS)
    }
  )

  it('a wide cyclic Heap stops remembering proofs at the bound', () => {
    const items = (): Deque<unknown>[] => Array.from({ length: 40 }, () => containsItself(1))
    const left = items()
    const right = items()
    const session = walkSession(createDeepEqualSession)
    session.proofRoom = 10

    const equal = deepEqual(new Heap(left, tied), new Heap(right, tied))

    expect(equal).toBe(true)
    expect(storedPairs(session.proven, left, right)).toBeLessThanOrEqual(10)
  })

  it('a retracted proof frees its room', () => {
    const session = walkSession(createDeepEqualSession)
    const room = session.proofRoom

    deepEqual(loop(1).outer, loop(2).outer)

    expect(session.proofRoom).toBe(room)
  })

  it('a proof that found no room frees none when it fails', () => {
    const session = walkSession(createDeepEqualSession)
    session.proofRoom = 0

    deepEqual(loop(1).outer, loop(2).outer)

    expect(session.proofRoom).toBe(0)
  })

  it('a session bounds what it stores by default', () => {
    expect(createDeepEqualSession()).toMatchObject({ proofRoom: 2 ** 21, failureRoom: 2 ** 20 })
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
    const probe = {
      [protocol.equals](): boolean {
        gc()
        held = process.memoryUsage().heapUsed - before
        return true
      }
    }

    expect(deepEqual([...left, probe], [...right, probe])).toBe(true)

    expect(held).toBeLessThan(64 * 1024 * 1024)
  })

  it('an acyclic walk logs no proofs', () => {
    const session = createDeepEqualSession()

    deepEqualInSession([{ n: 1 }], [{ n: 1 }], session)

    expect(session.provenLog).toEqual([])
  })

  it('a scalar with an equals hook leaves no entry', () => {
    const session = createDeepEqualSession()
    const left = decimal(1)
    const right = decimal(1)

    deepEqualInSession(left, right, session)

    expect(session.proven.has(left, right)).toBe(false)
  })

  it('a shallow failure leaves no entry, so a wide Heap stores none', () => {
    const session = createDeepEqualSession()
    const left = { n: 1 }
    const right = { n: 2 }

    deepEqualInSession(left, right, session)

    expect(session.disproven?.has(left, right)).toBeFalsy()
  })

  it('a failure that walked far is remembered', () => {
    const session = createDeepEqualSession()
    const rows = (last: number): object[] => [...Array.from({ length: 40 }, () => ({})), { last }]
    const left = rows(1)
    const right = rows(2)

    deepEqualInSession(left, right, session)

    expect(session.disproven?.has(left, right)).toBe(true)
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

      expect(calls.mock.calls.length).toBeLessThanOrEqual(TOWER_LEVELS * TOWER_LEVELS)
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

      expect(calls.mock.calls.length).toBeLessThanOrEqual(TOWER_LEVELS * TOWER_LEVELS)
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

  it('throws once a walk that can remember nothing passes its visit limit', () => {
    const session = createDeepEqualSession()
    session.proofRoom = 0
    session.failureRoom = 0
    session.visitRoom = 10_000
    expect(() => deepEqualInSession(tower(40), tower(40), session)).toThrow(
      new RangeError('deepEqual exceeded 33554432 comparisons')
    )
  })

  it('counts hook classes that are not iterable', () => {
    class Node {
      constructor(readonly next: Node | null) {}
      [protocol.equals](other: unknown): boolean {
        const peer = (other as Node).next
        return deepEqual(this.next, peer) && deepEqual(this.next, peer)
      }
    }
    let a: Node | null = null
    let b: Node | null = null
    for (let i = 0; i < 40; i++) {
      a = new Node(a)
      b = new Node(b)
    }
    const session = walkSession(createDeepEqualSession)
    session.visitRoom = 10_000
    expect(() => deepEqualInSession(a, b, session)).toThrow(
      new RangeError('deepEqual exceeded 33554432 comparisons')
    )
  })

  it('leaves ordinary comparisons alone', () => {
    expect(deepEqual(tower(40), tower(40))).toBe(true)
  })
})
