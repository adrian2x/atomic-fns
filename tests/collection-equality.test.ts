import { describe, it, expect } from 'vitest'
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
    }, 250)

    const dated = Array.from({ length: 2000 }, (_, i) => ({ p: 0, at: new Date(i) }))
    const hd1 = new Heap(dated)
    const hd2 = new Heap(dated.slice().reverse())
    expectFast(() => {
      expect(deepEqual(hd1, hd2)).toBe(true)
    }, 250)

    const h3 = new Heap(keyed)
    h3.pop()
    h3.push({ i: -1 })
    expectFast(() => {
      expect(deepEqual(h1, h3)).toBe(false)
    }, 250)

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
    }, 250)
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
      }, 250)

      const different = new Heap(
        Array.from({ length: count }, (_, i) => [xB, i === 7 ? count + 1 : i])
      )
      expectFast(() => {
        expect(deepEqual(left, different)).toBe(false)
      }, 250)
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
      }, 250)

      const different = new Heap(
        Array.from({ length: count }, (_, i) => ({ s: sB, id: i === 11 ? -1 : i }))
      )
      expectFast(() => {
        expect(deepEqual(left, different)).toBe(false)
      }, 250)
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
    }, 250)
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

function cmpA(x: { a: number }, y: { a: number }): number {
  return x.a - y.a
}
