import { describe, expect, it } from 'vitest'
import { SplayTree } from '../src/collections/SplayTree.js'

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

  it('SPEC-R77 iterate 4000 ascending keys under 20ms', () => {
    const tree = new SplayTree<number, number>()
    for (let i = 0; i < 4000; i++) {
      tree.set(i, i)
    }
    const t0 = performance.now()
    const keys = [...tree.keys()]
    const elapsed = performance.now() - t0
    expect(keys.length).toBe(4000)
    expect(keys[0]).toBe(0)
    expect(keys[3999]).toBe(3999)
    expect(elapsed).toBeLessThan(20)
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
})
