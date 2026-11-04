import { describe, expect, it } from 'vitest'
import { SplayTree } from '../src/collections/SplayTree.js'
import { expectFast } from './helpers/perf.js'

describe('SplayTree', () => {
  it('SPEC-R77 empty tree size height and iteration', () => {
    const tree = new SplayTree<number, number>()
    expect(tree.size).toBe(0)
    expect(tree.height).toBe(0)
    expect([...tree.values()]).toEqual([])
    expect(tree.min()).toBeUndefined()
    expect(tree.max()).toBeUndefined()
    expect(tree.has(1)).toBe(false)
    expect(tree.get(1)).toBeUndefined()
  })

  it('SPEC-R77 set get has clear', () => {
    const tree = new SplayTree<number, number>()
    for (let i = 10; i > 0; i--) {
      tree.set(i, i)
      expect(tree.has(i)).toBe(true)
      expect(tree.get(i)).toBe(i)
    }
    expect(tree.size).toBe(10)
    tree.clear()
    expect(tree.size).toBe(0)
    for (let i = 1; i <= 10; i++) {
      expect(tree.has(i)).toBe(false)
    }
  })

  it('SPEC-R77 set returns this and replaces value', () => {
    const tree = new SplayTree<number, string>()
    expect(tree.set(1, 'a')).toBe(tree)
    tree.set(1, 'b')
    expect(tree.get(1)).toBe('b')
    expect(tree.size).toBe(1)
  })

  it('SPEC-R77 has finds key with undefined value', () => {
    const tree = new SplayTree<number, number | undefined>()
    tree.set(1, undefined)
    expect(tree.has(1)).toBe(true)
    expect(tree.get(1)).toBeUndefined()
  })

  it('SPEC-R77 splay keeps key reachable and ordered', () => {
    const tree = new SplayTree<number, number>()
    for (let i = 100; i > 0; i--) {
      tree.set(i, i)
    }
    tree.splay(42)
    expect(tree.has(42)).toBe(true)
    expect(tree.get(42)).toBe(42)
    expect([...tree.keys()]).toEqual(Array.from({ length: 100 }, (_, i) => i + 1))
  })

  it('SPEC-R77 lower and higher on both splay branches', () => {
    const tree = new SplayTree<number, number>(undefined, 1)
    for (let i = 20; i > 0; i -= 2) {
      tree.set(i, i)
    }
    expect(tree.lower(12)).toBe(10)
    expect(tree.higher(12)).toBe(14)
    expect(tree.lower(2)).toBeUndefined()
    expect(tree.higher(20)).toBeUndefined()
    expect(tree.lower(7)).toBe(6)
    expect(tree.higher(7)).toBe(8)
    tree.splay(4)
    expect(tree.lower(10)).toBe(8)
    tree.splay(18)
    expect(tree.higher(10)).toBe(12)
  })

  it('SPEC-R77 min and max', () => {
    const tree = new SplayTree<number, number>()
    for (let i = 10; i > 0; i--) {
      tree.set(i, i)
    }
    expect(tree.min()).toBe(1)
    expect(tree.max()).toBe(10)
    expect(new SplayTree().height).toBe(0)
    const one = new SplayTree<number, number>()
    one.set(1, 1)
    expect(one.height).toBe(0)
  })

  it('F-067 min and max splay drop degenerate height', () => {
    const tree = new SplayTree<number, number>()
    for (let i = 0; i < 1000; i++) tree.set(i, i)
    const before = tree.height
    expect(before).toBeGreaterThan(100)
    tree.min()
    const afterMin = tree.height
    expect(afterMin).toBeLessThan(before)
    tree.max()
    expect(tree.height).toBeLessThanOrEqual(afterMin + 1)
    expect(tree.min()).toBe(0)
    expect(tree.max()).toBe(999)
  })

  it('SPEC-R77 delete present and missing', () => {
    const tree = new SplayTree<number, number>()
    tree.set(42, 42)
    expect(tree.delete(42)).toBe(true)
    expect(tree.has(42)).toBe(false)
    expect(tree.delete(42)).toBe(false)
    expect(tree.size).toBe(0)
  })

  it('SPEC-R77 custom comparator delete', () => {
    interface Id {
      id: number
    }
    const tree = new SplayTree<Id, string>((a, b) => a.id - b.id)
    tree.set({ id: 1 }, 'a')
    tree.set({ id: 2 }, 'b')
    expect(tree.delete({ id: 1 })).toBe(true)
    expect(tree.size).toBe(1)
    expect(tree.has({ id: 1 })).toBe(false)
    expect(tree.get({ id: 2 })).toBe('b')
    expect(tree.delete({ id: 99 })).toBe(false)
  })

  it('SPEC-R77 keys values entries ordered', () => {
    const tree = new SplayTree<number, number>()
    for (let i = 1; i <= 5; i++) {
      tree.set(i, i * 2)
    }
    expect([...tree.keys()]).toEqual([1, 2, 3, 4, 5])
    expect([...tree.values()]).toEqual([2, 4, 6, 8, 10])
    expect([...tree.entries()]).toEqual([
      [1, 2],
      [2, 4],
      [3, 6],
      [4, 8],
      [5, 10]
    ])
  })

  it('SPEC-R77 10000 ascending inserts then iterate and height', () => {
    const tree = new SplayTree<number, number>()
    for (let i = 0; i < 10_000; i++) {
      tree.set(i, i)
    }
    expect(tree.size).toBe(10_000)
    expect(() => [...tree.keys()]).not.toThrow()
    const keys = [...tree.keys()]
    expect(keys[0]).toBe(0)
    expect(keys[keys.length - 1]).toBe(9999)
    expect(tree.height).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(tree.height)).toBe(true)
  })

  it('SPEC-R77 iterate 4000 ascending keys within budget', () => {
    // Pre-fix: O(n^2) re-splay per step. Hang-floor budget. Revert of 6da2abc fails this.
    const tree = new SplayTree<number, number>()
    for (let i = 0; i < 4000; i++) {
      tree.set(i, i)
    }
    expectFast(() => {
      const keys = [...tree.keys()]
      expect(keys.length).toBe(4000)
      expect(keys[0]).toBe(0)
      expect(keys[3999]).toBe(3999)
    }, 1000)
  })

  it('SPEC-R77 reads during for-of visit each key once across 50 trials', () => {
    for (let trial = 0; trial < 50; trial++) {
      const tree = new SplayTree<number, number>()
      const n = 40 + (trial % 20)
      for (let i = 0; i < n; i++) tree.set(i, i)
      const seen = new Set<number>()
      for (const v of tree.values()) {
        expect(tree.has(v)).toBe(true)
        expect(tree.get(v)).toBe(v)
        expect(tree.min()).toBe(0)
        expect(tree.max()).toBe(n - 1)
        if (v > 0) expect(tree.lower(v)).toBe(v - 1)
        else expect(tree.lower(v)).toBeUndefined()
        if (v < n - 1) expect(tree.higher(v)).toBe(v + 1)
        else expect(tree.higher(v)).toBeUndefined()
        seen.add(v)
      }
      expect(seen.size).toBe(n)
    }
  })

  it('SPEC-R77 constructor p kept and out of range throws', () => {
    expect(() => new SplayTree(undefined, -0.1)).toThrow(RangeError)
    expect(() => new SplayTree(undefined, -0.1)).toThrow('p must be in [0, 1]')
    expect(() => new SplayTree(undefined, 1.1)).toThrow(RangeError)
    expect(() => new SplayTree(undefined, NaN)).toThrow(RangeError)
    const tree = new SplayTree<number, number>(undefined, 0)
    tree.set(1, 1)
    tree.set(2, 2)
    expect(tree.get(1)).toBe(1)
    expect(tree.has(2)).toBe(true)
    const always = new SplayTree<number, number>(undefined, 1)
    always.set(1, 1)
    expect(always.get(1)).toBe(1)
  })

  it('SPEC-R77 delete during iteration does not throw', () => {
    const tree = new SplayTree<number, number>()
    for (let i = 0; i < 20; i++) tree.set(i, i)
    expect(() => {
      for (const k of tree.keys()) {
        if (k === 10) tree.delete(10)
      }
    }).not.toThrow()
  })

  it('SPEC-R77 lower higher during open iterator use plain walk', () => {
    const tree = new SplayTree<number, number>(undefined, 1)
    for (let i = 1; i <= 9; i++) tree.set(i, i)
    const keys: number[] = []
    for (const k of tree.keys()) {
      keys.push(k)
      expect(tree.lower(5)).toBe(4)
      expect(tree.higher(5)).toBe(6)
    }
    expect(keys).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('C4-2 abandoned iterator does not disable splaying; deepEqual closes iterators', async () => {
    const { deepEqual } = await import('../src/operators/index.js')
    let compares = 0
    const cmp = (x: number, y: number) => {
      compares++
      return x - y
    }
    const mk = () => {
      const t = new SplayTree<number, number>(cmp, 1)
      for (let i = 1; i <= 64; i++) t.set(i, i)
      return t
    }
    const a = mk()
    const b = mk()
    b.set(65, 65)
    expect(deepEqual(a, b)).toBe(false)
    // After unequal deepEqual, splaying still runs: get(1) stays near-root (few compares).
    compares = 0
    a.get(1)
    compares = 0
    a.get(1)
    expect(compares).toBeLessThan(8)

    const t = mk()
    t.keys().next()
    compares = 0
    t.get(1)
    compares = 0
    t.get(1)
    expect(compares).toBeLessThan(8)

    const live = mk()
    const seen: number[] = []
    for (const k of live.keys()) {
      seen.push(k)
      live.get(32)
    }
    expect(seen).toEqual(Array.from({ length: 64 }, (_, i) => i + 1))
  })

  it('R10-D3 iterate while get re-seeks in O(log n) comparator calls', () => {
    const n = 20_000
    let calls = 0
    const tree = new SplayTree<number, number>((a, b) => {
      calls++
      return a < b ? -1 : a > b ? 1 : 0
    }, 1)
    for (let i = 0; i < n; i++) tree.set(i, i)
    calls = 0
    const seen: number[] = []
    for (const k of tree.keys()) {
      seen.push(k)
      tree.get(k)
    }
    expect(seen).toHaveLength(n)
    expect(seen).toEqual(Array.from({ length: n }, (_, i) => i))
    expect(calls).toBeLessThan(40 * n * Math.log2(n))
  })

  it('R10-D3 iterator survives inserts and deletes between yields', () => {
    const tree = new SplayTree<number, number>(undefined, 1)
    for (const k of [10, 20, 30, 40]) tree.set(k, k)
    const seen: number[] = []
    for (const k of tree.keys()) {
      seen.push(k)
      if (k === 20) {
        tree.delete(20)
        tree.set(25, 25)
        tree.set(5, 5)
      }
    }
    expect(seen).toEqual([10, 20, 25, 30, 40])
  })

  it('R10-D3 iterator started on an empty tree sees later keys', () => {
    const tree = new SplayTree<number, number>()
    const it = tree.keys()
    tree.set(1, 1)
    expect([...it]).toEqual([1])
  })

  it('R10-D3 undefined keys do not confuse the re-seek', () => {
    const tree = new SplayTree<number | undefined, number>(
      (a, b) => (a === b ? 0 : a === undefined ? 1 : b === undefined ? -1 : a < b ? -1 : 1),
      1
    )
    for (const k of [1, 2, undefined]) tree.set(k, 0)
    const seen: (number | undefined)[] = []
    for (const k of tree.keys()) {
      seen.push(k)
      tree.get(2)
    }
    expect(seen).toEqual([1, 2, undefined])
  })
})
