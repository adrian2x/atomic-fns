import { describe, expect, it } from 'vitest'
import { BTree } from '../src/collections/BTree.js'
import { SortedMap } from '../src/collections/SortedMap.js'
import { SortedSet } from '../src/collections/SortedSet.js'

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

  it('SPEC-R79 comparator NaN result throws TypeError and leaves the tree unchanged', () => {
    const tree = new BTree<number, number>(undefined, (a, b) => a - b)
    tree.set(1, 1)
    expect(() => tree.set(Number.NaN, 2)).toThrow(TypeError)
    expect(() => tree.set(Number.NaN, 2)).toThrow('comparator must return a finite number')
    expect(tree.size).toBe(1)
    expect(tree.toArray()).toEqual([[1, 1]])
    tree.__checkValid()
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

  it('F-080 borrow and merge keep keys aligned with undefined values', () => {
    const t = new BTree<number, string | undefined>(undefined, undefined, 4)
    const model = new Map<number, string | undefined>()
    const sync = () => {
      expect(t.toArray()).toEqual([...model.entries()].sort((a, b) => a[0] - b[0]))
      t.__checkValid()
    }
    for (const k of [1, 2, 3, 4]) {
      t.set(k, undefined)
      model.set(k, undefined)
    }
    sync()
    t.set(5, 'v5')
    model.set(5, 'v5')
    sync()
    t.set(6, 'v6')
    model.set(6, 'v6')
    sync()
    for (const k of [6, 5, 4, 1]) {
      t.delete(k)
      model.delete(k)
      sync()
    }
  })

  it('A1 neighbors around key 0', () => {
    const t = new BTree<number, number>([
      [-2, 123],
      [0, 1234],
      [2, 12345]
    ])
    expect(t.lower(0)).toEqual([-2, 123])
    expect(t.higher(0)).toEqual([2, 12345])
    expect(t.lower(-2)).toBeUndefined()
    expect(t.higher(2)).toBeUndefined()
    for (let k = -10; k <= 300; k++) t.set(k, 2 * k)
    expect(t.lower(0)).toEqual([-1, -2])
    expect(t.higher(0)).toEqual([1, 2])
    expect(t.lower(1000)).toEqual([300, 600])
    expect(t.higher(-1000)).toEqual([-10, -20])
    const empty = new BTree<number, number>()
    expect(empty.lower(0)).toBeUndefined()
    expect(empty.higher(0)).toBeUndefined()
    expect(empty.floor(0)).toBeUndefined()
    expect(empty.ceiling(0)).toBeUndefined()
  })

  it('A2 reverse start above max', () => {
    const t = new BTree<number, number>(undefined, (a, b) => a - b)
    t.set(10, 10).set(20, 20).set(30, 30)
    expect([...t.entriesReversed(40)].map(([k]) => k)).toEqual([30, 20, 10])
    expect([...t.entriesReversed(25)].map(([k]) => k)).toEqual([20, 10])
    expect([...t.entriesReversed(5)].map(([k]) => k)).toEqual([])
    expect([...t.entries(25)].map(([k]) => k)).toEqual([30])
    expect([...t.entries(40)].map(([k]) => k)).toEqual([])
    const big = new BTree<number, number>(undefined, (a, b) => a - b, 4)
    for (let k = 0; k <= 498; k += 2) big.set(k, k)
    expect([...big.entriesReversed(1001)].map(([k]) => k).slice(0, 3)).toEqual([498, 496, 494])
    const mid = [...big.entriesReversed(251)].map(([k]) => k)
    expect(mid).toHaveLength(126)
    expect(mid[0]).toBe(250)
    expect([...big.entriesReversed(-1)]).toEqual([])
  })

  it('A3 clone after the original loses two levels', () => {
    // Bulk-load packs to height 2; ascending per-key inserts with left-heavy
    // splits grow a right spine to height 3 for the same 64 keys.
    const t = new BTree<number, number>(
      Array.from({ length: 64 }, (_, i) => [i, 0] as [number, number]),
      undefined,
      4
    )
    expect(t.height).toBe(2)
    t.deleteRange(1, 16, false)
    const c = t.clone()
    t.deleteRange(4, Infinity, false)
    expect(t.height).toBe(0)
    t.set(0, 1)
    expect(c.get(0)).toBe(0)
    expect(c.size).toBe(49)
    t.__checkValid()
    c.__checkValid()
  })

  it('A4 clone isolation', () => {
    const t = new BTree<number, number>(undefined, undefined, 4)
    for (let i = 0; i < 64; i++) t.set(i, i)
    for (let i = 0; i < 64; i++) if (i % 4 !== 0) t.delete(i)
    const snapA = t.toArray()
    const A = t.clone()
    const B = A.clone()
    for (let i = 0; i < 64; i++) if (i % 16 !== 0) t.delete(i)
    for (let i = 0; i < 64; i++) t.set(i, 7)
    expect(A.toArray()).toEqual(snapA)
    expect(B.toArray()).toEqual(snapA)
    for (const k of [...B.keys()]) B.delete(k)
    expect(B.size).toBe(0)
    expect(A.toArray()).toEqual(snapA)
    const empty = new BTree<number, number>()
    const c = empty.clone()
    empty.set(1, 1)
    c.set(2, 2)
    expect(empty.toArray()).toEqual([[1, 1]])
    expect(c.toArray()).toEqual([[2, 2]])
    const frozen = new BTree<number, number>([[1, 1]])
    frozen.freeze()
    const fc = frozen.clone()
    fc.set(9, 9)
    expect(frozen.has(9)).toBe(false)
  })

  it('A5 interleaved deletes', () => {
    for (const fanout of [4, 5, 8, 32]) {
      const t = new BTree<number, number>(undefined, undefined, fanout)
      for (let i = 0; i < 4000; i++) {
        t.set(i, i)
        if (t.size > 100 && i % 2 === 0) {
          t.delete(i / 2)
          expect(t.size).toBe(i / 2 + 50)
        }
        if (i % 500 === 0) t.__checkValid()
      }
      t.__checkValid()
    }
  })

  it('A6 total order', () => {
    const t = new BTree<string, number>(undefined, undefined, 4)
    const keys = [
      '24e26f0b-3c1a-47f8-a7a1-e8461ddb69ce6',
      '0',
      '1',
      '2',
      '3',
      '4',
      'Cheese',
      '10',
      '11',
      '12',
      '13',
      '15',
      '16'
    ]
    for (const k of keys) {
      t.set(k, 1)
      expect(t.has(keys[0])).toBe(true)
    }
    const d1 = new Date(0)
    const d1copy = new Date(0)
    const d2 = new Date(1)
    const mixed = new BTree<unknown, number>()
    const values: unknown[] = [
      d1,
      d1copy,
      d2,
      d1.valueOf(),
      '24x',
      '0',
      '1',
      '3',
      'String',
      '10',
      0,
      'NaN',
      Number.NaN,
      Infinity,
      -0,
      -Infinity,
      1,
      10,
      2,
      [],
      '[]',
      [1],
      ['1'],
      null,
      undefined,
      1n,
      true,
      Symbol('s')
    ]
    for (const v of values) mixed.set(v, 1)
    for (const v of values) expect(mixed.has(v)).toBe(true)
    expect(mixed.has(0)).toBe(true)
    expect(mixed.has(-0)).toBe(true)
    mixed.__checkValid()
  })

  it('A7 model fuzz with clones', () => {
    for (const fanout of [4, 6, 16]) {
      interface Snap {
        tree: BTree<number, number>
        map: Map<number, number>
      }
      const snaps: Snap[] = []
      let cur = new BTree<number, number>(undefined, undefined, fanout)
      let model = new Map<number, number>()
      let seed = fanout * 999 + 13
      const rnd = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0
        return seed
      }
      for (let op = 0; op < 20_000; op++) {
        const kind = rnd() % 6
        const k = rnd() % 600
        if (kind === 0) {
          const v = rnd() % 1000
          cur.set(k, v)
          model.set(k, v)
        } else if (kind === 1) {
          expect(cur.delete(k)).toBe(model.delete(k))
        } else if (kind === 2) {
          const lo = rnd() % 600
          const hi = lo + (rnd() % 40)
          const incl = rnd() % 2 === 0
          cur.deleteRange(lo, hi, incl)
          for (const key of [...model.keys()]) {
            const inRange = incl ? key >= lo && key <= hi : key >= lo && key < hi
            if (inRange) model.delete(key)
          }
        } else if (kind === 3) {
          const lo = rnd() % 600
          const hi = lo + (rnd() % 40)
          const incl = rnd() % 2 === 0
          const fromTree = cur.getRange(lo, hi, incl)
          const fromMap = [...model.entries()]
            .filter(([key]) => (incl ? key >= lo && key <= hi : key >= lo && key < hi))
            .sort((a, b) => a[0] - b[0])
          expect(fromTree).toEqual(fromMap)
        } else if (kind === 4) {
          snaps.push({ tree: cur.clone(), map: new Map(model) })
          const pick = snaps[rnd() % snaps.length]
          cur = pick.tree
          model = pick.map
        } else {
          expect(cur.get(k)).toBe(model.get(k))
        }
        if (op % 500 === 0) cur.__checkValid()
      }
      for (const s of snaps) {
        expect(s.tree.toArray()).toEqual([...s.map.entries()].sort((a, b) => a[0] - b[0]))
        s.tree.__checkValid()
      }
    }
  })

  it('A10 at index', () => {
    const t = new BTree<number, number>(undefined, undefined, 4)
    for (let k = 0; k <= 998; k += 2) t.set(k, k)
    expect(t.at(0)?.[0]).toBe(0)
    expect(t.at(499)?.[0]).toBe(998)
    expect(t.at(500)).toBeUndefined()
    expect(t.at(-1)?.[0]).toBe(998)
    expect(t.at(-500)?.[0]).toBe(0)
    expect(t.at(-501)).toBeUndefined()
    expect(t.at(1.9)?.[0]).toBe(2)
    expect(t.at(Number.NaN)?.[0]).toBe(0)
    t.delete(0)
    expect(t.at(0)?.[0]).toBe(2)
    const c = t.clone()
    t.delete(2)
    expect(c.at(0)?.[0]).toBe(2)
    expect(new BTree().at(0)).toBeUndefined()
    let calls = 0
    const spy = new BTree<number, number>(
      [
        [1, 1],
        [2, 2]
      ],
      (a, b) => {
        calls++
        return a - b
      }
    )
    calls = 0
    spy.at(1)
    expect(calls).toBe(0)
    const sm = new SortedMap([
      [2, 'b'],
      [1, 'a']
    ])
    expect(sm.at(0)).toEqual([1, 'a'])
    expect(new SortedSet([3, 1, 2]).at(-1)).toBe(3)
    let seed = 42
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed
    }
    const fuzz = new BTree<number, number>(undefined, undefined, 4)
    for (let op = 0; op < 2000; op++) {
      const k = rnd() % 200
      if (rnd() % 2 === 0) {
        fuzz.set(k, k)
      } else {
        fuzz.delete(k)
      }
      const i = (rnd() % (fuzz.size + 3)) - 1
      expect(fuzz.at(i)).toEqual(fuzz.toArray().at(i))
    }
  })

  it('A11 atomic batches', () => {
    const cmp = (a: number, b: number) => {
      if (a === 13 || b === 13) return Number.NaN
      return a - b
    }
    const t = new BTree<number, number>([[1, 1]], cmp)
    const before = t.toArray()
    expect(() =>
      t.setPairs([
        [1, 1],
        [13, 13]
      ])
    ).toThrow(TypeError)
    expect(t.size).toBe(1)
    expect(t.toArray()).toEqual(before)
    expect(() => t.deleteKeys([1, 13])).toThrow(TypeError)
    expect(t.toArray()).toEqual(before)
    for (let i = 0; i < 10; i++) t.set(i, i)
    const snap = t.toArray()
    expect(() =>
      t.editRange(0, 100, true, (k) => {
        if (k === 5) throw new Error('x')
        return { value: 0 }
      })
    ).toThrow('x')
    expect(t.toArray()).toEqual(snap)
    expect(() => new SortedSet([1, Number.NaN], (a, b) => a - b)).toThrow(TypeError)
  })

  it('E2 bulk load', () => {
    let calls = 0
    const cmp = (a: number, b: number) => {
      calls++
      return a - b
    }
    const sorted = Array.from({ length: 10_000 }, (_, i) => [i, i] as [number, number])
    calls = 0
    const t = new BTree(sorted, cmp)
    expect(calls).toBe(9_999)
    t.__checkValid()
    expect(t.height).toBe(2)
    const u = new BTree([
      [2, 'a'],
      [1, 'x'],
      [2, 'b']
    ])
    expect(u.toArray()).toEqual([
      [1, 'x'],
      [2, 'b']
    ])
    const empty = new BTree<number, string>()
    expect(
      empty.setPairs([
        [2, 'a'],
        [1, 'x'],
        [2, 'b']
      ])
    ).toBe(2)
    interface Row {
      id: number
      tag: string
    }
    const s = new SortedSet<Row>(
      [
        { id: 1, tag: 'a' },
        { id: 1, tag: 'b' }
      ],
      (a, b) => a.id - b.id
    )
    expect([...s][0]?.tag).toBe('a')
  })

  it('iteration under mutation fuzz', () => {
    let seed = 7
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed
    }
    for (const reverse of [false, true]) {
      const t = new BTree<number, number>(undefined, undefined, 4)
      for (let i = 0; i < 100; i++) t.set(i, i)
      const seen = new Set<number>()
      let last: number | undefined
      const iter = reverse ? t.entriesReversed() : t.entries()
      for (const [k] of iter) {
        expect(seen.has(k)).toBe(false)
        seen.add(k)
        if (last !== undefined) {
          if (reverse) expect(k).toBeLessThan(last)
          else expect(k).toBeGreaterThan(last)
        }
        last = k
        const op = rnd() % 4
        if (op === 0) t.set(rnd() % 200, 0)
        else if (op === 1) t.delete(rnd() % 200)
        else if (op === 2) t.clear()
      }
      t.__checkValid()
    }
  })

  it('frozen reads still work', () => {
    const t = new BTree<number, number>([
      [1, 1],
      [2, 2],
      [3, 3]
    ])
    t.freeze()
    expect(t.forRange(1, 3, true)).toBe(3)
    expect([...t.entries()].map(([k]) => k)).toEqual([1, 2, 3])
    expect(t.at(1)).toEqual([2, 2])
    expect(t.getRange(1, 3, true)).toEqual([
      [1, 1],
      [2, 2],
      [3, 3]
    ])
  })

  it('key-object replacement refreshes separators', () => {
    interface K {
      id: number
      tag?: string
    }
    const t = new BTree<K, string>(undefined, (a, b) => a.id - b.id, 4)
    for (let id = 0; id < 20; id++) t.set({ id }, 'v')
    t.set({ id: 3, tag: 'new' }, 'x')
    t.__checkValid()
    expect([...t.keys()][3]?.tag).toBe('new')
  })
})
