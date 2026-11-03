import { describe, expect, it } from 'vitest'
import { BTree } from '../src/collections/BTree.js'

describe('BTree', () => {
  it('SPEC-R79 set get has clear and size', () => {
    const tree = new BTree<number, number>()
    for (let i = 100; i > 0; i--) {
      tree.set(i, i * 2)
      expect(tree.get(i)).toBe(i * 2)
      expect(tree.has(i)).toBe(true)
    }
    expect(tree.size).toBe(100)
    tree.clear()
    expect(tree.size).toBe(0)
    expect(tree.has(100)).toBe(false)
  })

  it('SPEC-R79 set returns this and replaces value', () => {
    const tree = new BTree<number, string>()
    expect(tree.set(1, 'a')).toBe(tree)
    tree.set(1, 'b')
    expect(tree.get(1)).toBe('b')
    expect(tree.size).toBe(1)
  })

  it('SPEC-R79 has finds key with undefined value', () => {
    const tree = new BTree<number, number | undefined>()
    tree.set(1, undefined)
    expect(tree.has(1)).toBe(true)
    expect(tree.get(1)).toBeUndefined()
    expect(tree.delete(1)).toBe(true)
    expect(tree.has(1)).toBe(false)
  })

  it('SPEC-R79 undefined-value isolation across trees', () => {
    const a = new BTree<number, string | undefined>()
    const b = new BTree<number, string | undefined>()
    for (let i = 0; i < 200; i++) {
      a.set(i, undefined)
      b.set(i, undefined)
    }
    a.editRange(0, 199, true, () => ({ value: 'LEAK' }))
    for (let i = 0; i < 200; i++) {
      expect(b.get(i)).toBeUndefined()
      expect(a.get(i)).toBe('LEAK')
    }
  })

  it('SPEC-R79 editRange applies {value:0}', () => {
    const tree = new BTree<number, number>()
    tree.set(1, 5)
    tree.editRange(1, 1, true, () => ({ value: 0 }))
    expect(tree.get(1)).toBe(0)
  })

  it('SPEC-R79 multi-level get default with maxNodeSize 4', () => {
    const tree = new BTree<number, string>(undefined, undefined, 4)
    for (let i = 0; i < 20; i++) tree.set(i, String(i))
    expect(tree.height).toBeGreaterThan(0)
    expect(tree.get(100, 'd')).toBe('d')
    expect(tree.get(5, 'd')).toBe('5')
  })

  it('SPEC-R79 frozen mutators throw and unfreeze restores', () => {
    const tree = new BTree<number, number>()
    for (let i = 10; i > 0; i--) tree.set(i, i)
    tree.freeze()
    expect(tree.isFrozen).toBe(true)
    expect(() => tree.set(11, 11)).toThrow(TypeError)
    expect(() => tree.set(11, 11)).toThrow('BTree is frozen')
    expect(() => tree.delete(1)).toThrow('BTree is frozen')
    expect(() => {
      tree.clear()
    }).toThrow('BTree is frozen')
    expect(() => tree.deleteRange(1, 3, true)).toThrow('BTree is frozen')
    expect(() => tree.deleteKeys([1])).toThrow('BTree is frozen')
    expect(() => tree.editRange(1, 1, true, () => ({ value: 9 }))).toThrow('BTree is frozen')
    expect(() => tree.setPairs([[12, 12]])).toThrow('BTree is frozen')
    expect(tree.has(1)).toBe(true)
    tree.unfreeze()
    expect(tree.isFrozen).toBe(false)
    tree.set(11, 11)
    expect(tree.get(11)).toBe(11)
  })

  it('SPEC-R79 getRange respects maxLength', () => {
    const tree = new BTree<number, number>()
    for (let i = 0; i < 10; i++) tree.set(i, i)
    expect(tree.getRange(0, 9, true, 2)).toEqual([
      [0, 0],
      [1, 1]
    ])
    expect(tree.getRange(0, 9, true, 0)).toEqual([])
    expect(tree.getRange(0, 9, true, -1)).toEqual([])
  })

  it('SPEC-R79 setPairs counts only new keys', () => {
    const tree = new BTree<number, number>()
    expect(tree.setPairs([[0, 1]])).toBe(1)
    expect(tree.setPairs([[0, 7]])).toBe(0)
    expect(
      tree.setPairs([
        [0, 1],
        [0, 7]
      ])
    ).toBe(0)
    expect(tree.get(0)).toBe(7)
    expect(
      tree.setPairs([
        [0, 1],
        [1, 2]
      ])
    ).toBe(1)
    expect(tree.size).toBe(2)
  })

  it('SPEC-R79 higher lower floor ceiling on 1..9', () => {
    const tree = new BTree<number, number>()
    for (let i = 1; i <= 9; i++) tree.set(i, i)
    expect(tree.higher(5)?.[0]).toBe(6)
    expect(tree.lower(5)?.[0]).toBe(4)
    expect(tree.floor(5)?.[0]).toBe(5)
    expect(tree.ceiling(5)?.[0]).toBe(5)
    expect(tree.higher(9)).toBeUndefined()
    expect(tree.lower(1)).toBeUndefined()
    expect(tree.floor(0)).toBeUndefined()
    expect(tree.ceiling(10)).toBeUndefined()
  })

  it('SPEC-R79 iterates in order and reversed', () => {
    const tree = new BTree<number, number>()
    const entries: [number, number][] = []
    for (let i = 9; i >= 0; i--) {
      tree.set(i, i * 2)
      entries.push([i, i * 2])
    }
    entries.sort((x, y) => x[0] - y[0])
    expect([...tree]).toEqual(entries)
    expect([...tree.entriesReversed()]).toEqual([...entries].reverse())
    expect([...tree.keys()]).toEqual(entries.map((e) => e[0]))
    expect([...tree.values()]).toEqual(entries.map((e) => e[1]))
  })

  it('SPEC-R79 minKey maxKey clone', () => {
    const tree = new BTree<number, number>()
    for (let i = 10; i >= 0; i--) tree.set(i, i * 2)
    expect(tree.minKey()).toBe(0)
    expect(tree.maxKey()).toBe(10)
    const t2 = tree.clone()
    expect([...t2.entriesReversed()]).toEqual([...tree.entriesReversed()])
    t2.set(100, 100)
    expect(tree.has(100)).toBe(false)
  })

  it('SPEC-R79 maxNodeSize clamped to 4..256', () => {
    const small = new BTree<number, number>(undefined, undefined, 2)
    expect(small.maxNodeSize).toBe(64)
    const big = new BTree<number, number>(undefined, undefined, 1000)
    expect(big.maxNodeSize).toBe(256)
    const exact = new BTree<number, number>(undefined, undefined, 4)
    expect(exact.maxNodeSize).toBe(4)
  })

  it('SPEC-R79 comparator NaN key throws KeyError', () => {
    const tree = new BTree<number, number>(undefined, (a, b) => a - b)
    tree.set(1, 1)
    expect(() => tree.set(Number.NaN, 2)).toThrow(/invalid key/)
  })

  it('SPEC-R79 differential fuzz vs Map', () => {
    const sizes = [4, 5, 8, 32]
    for (const maxNodeSize of sizes) {
      const tree = new BTree<number, number>(undefined, undefined, maxNodeSize)
      const map = new Map<number, number>()
      let seed = maxNodeSize * 1000 + 7
      const rnd = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0
        return seed
      }
      for (let op = 0; op < 20_000; op++) {
        const k = rnd() % 500
        const kind = rnd() % 5
        if (kind === 0) {
          const v = rnd() % 1000
          tree.set(k, v)
          map.set(k, v)
        } else if (kind === 1) {
          expect(tree.delete(k)).toBe(map.delete(k))
        } else if (kind === 2) {
          expect(tree.has(k)).toBe(map.has(k))
          expect(tree.get(k)).toBe(map.get(k))
        } else if (kind === 3) {
          expect([...tree.keys()]).toEqual([...map.keys()].sort((a, b) => a - b))
        } else {
          const lo = rnd() % 500
          const hi = lo + (rnd() % 50)
          const fromTree = tree.getRange(lo, hi, true)
          const fromMap = [...map.entries()]
            .filter(([key]) => key >= lo && key <= hi)
            .sort((a, b) => a[0] - b[0])
          expect(fromTree).toEqual(fromMap)
        }
        if (op % 500 === 0) tree.__checkValid()
      }
      expect(tree.size).toBe(map.size)
      expect([...tree.entries()]).toEqual([...map.entries()].sort((a, b) => a[0] - b[0]))
      tree.__checkValid()
    }
  })

  it('SPEC-R79 internals are private: assigned count and compare do not affect the tree', () => {
    const t = new BTree<number, number>([
      [1, 1],
      [2, 2]
    ])
    const internals = t as unknown as Record<string, unknown>
    internals.count = 99
    internals._compare = () => 1
    internals._maxNodeSize = 1
    expect(t.size).toBe(2)
    expect(t.maxNodeSize).toBe(64)
    expect(t.get(2)).toBe(2)
    expect(t.has(1)).toBe(true)
    t.set(3, 3)
    expect(t.size).toBe(3)
    t.__checkValid()
  })

  it('SPEC-R79 undefined is a valid key in iteration, ranges and lookups', () => {
    const t = new BTree<number | undefined, string>()
    t.set(2, 'b').set(undefined, 'u').set(1, 'a')
    const forward = [...t.entries()]
    expect(forward).toHaveLength(3)
    expect(t.toArray()).toEqual(forward)
    expect([...t.entriesReversed()]).toEqual([...forward].reverse())
    expect([...t.keys()]).toContain(undefined)
    expect(t.has(undefined)).toBe(true)
    expect(t.get(undefined)).toBe('u')
    expect([...t.entries(undefined)]).toEqual([[undefined, 'u']])
    expect([...t.entriesReversed(undefined)]).toEqual([...forward].reverse().slice(0))
    expect(t.delete(undefined)).toBe(true)
    expect(t.size).toBe(2)
    expect(t.has(undefined)).toBe(false)
  })

  it('SPEC-R79 undefined is the only key', () => {
    const t = new BTree<undefined, number>()
    t.set(undefined, 1)
    expect(t.toArray()).toEqual([[undefined, 1]])
    expect([...t.entriesReversed()]).toEqual([[undefined, 1]])
    expect(t.higher(undefined)).toBeUndefined()
    expect(t.lower(undefined)).toBeUndefined()
  })

  it('SPEC-R79 iteration terminates when mutated during iteration', () => {
    const t = new BTree<number, number>(undefined, undefined, 4)
    for (let i = 0; i < 200; i++) t.set(i, i)
    let visited = 0
    for (const [k] of t.entries()) {
      visited++
      t.delete(k + 1)
      if (k < 200 && k % 3 === 0) t.set(k + 1000, 0)
      t.set(k, k)
      expect(visited).toBeLessThan(10_000)
    }
    t.__checkValid()
    let reversed = 0
    for (const [k] of t.entriesReversed()) {
      reversed++
      t.delete(k - 1)
      if (k > 0 && k % 5 === 0) t.set(k - 1000, 0)
      expect(reversed).toBeLessThan(10_000)
    }
    t.__checkValid()
    for (const k of t.keys()) t.delete(k)
    expect(t.size).toBe(0)
    expect([...t.entries()]).toEqual([])
  })

  it('SPEC-R79 clear during iteration ends iteration', () => {
    const t = new BTree<number, number>([
      [1, 1],
      [2, 2],
      [3, 3]
    ])
    const seen: number[] = []
    for (const [k] of t.entries()) {
      seen.push(k)
      t.clear()
    }
    expect(seen).toEqual([1])
    const back: number[] = []
    t.set(1, 1).set(2, 2)
    for (const [k] of t.entriesReversed()) {
      back.push(k)
      t.clear()
    }
    expect(back).toEqual([2])
  })

  it('F-080 takeFromLeft keeps keys aligned with values including undefined', () => {
    const t = new BTree<number, string | undefined>(undefined, undefined, 4)
    for (const k of [1, 2, 3, 4]) t.set(k, undefined)
    for (const k of [5, 6]) t.set(k, `v${String(k)}`)
    const root = (t as unknown as { root: { children: LeafLike[] } }).root
    const [left, right] = root.children
    right.takeFromLeft(left)
    expect(right.keys.length).toBe(right.values.length)
    expect(left.keys.length).toBe(left.values.length)
    expect(right.keys).toEqual([2, 3, 4, 5, 6])
    expect(right.values).toEqual([undefined, undefined, undefined, 'v5', 'v6'])
    expect(left.keys).toEqual([1])
    expect(left.values).toEqual([undefined])
  })
})

interface LeafLike {
  keys: number[]
  values: (string | undefined)[]
  takeFromLeft(lhs: LeafLike): void
}
