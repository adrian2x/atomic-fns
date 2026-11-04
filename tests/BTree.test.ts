import { describe, expect, it } from 'vitest'
import { BTree } from '../src/collections/BTree.js'
import { checkInvariants } from '../src/collections/internal.js'
import { clone } from '../src/collections/object.js'
import { SortedMap } from '../src/collections/SortedMap.js'
import { SortedSet } from '../src/collections/SortedSet.js'
import { deepEqual } from '../src/operators/index.js'

const ENTRY_ERROR = 'entries must be [key, value] pairs'
const SELF_COMPARE_ERROR = 'comparator must return 0 for a key compared with itself'
const FINITE_ERROR = 'comparator must return a finite number'

const neverEqual = (a: number, b: number) => (a < b ? -1 : 1)
const selfLess = (a: number, b: number) => (a <= b ? -1 : 1)

/** Live heap growth at the first comparator call, after collecting garbage. */
function heapHeldAtFirstCompare(load: (cmp: (a: number, b: number) => number) => void): number {
  const { gc } = globalThis
  if (gc === undefined) throw new Error('tests need --expose-gc')
  gc()
  const before = process.memoryUsage().heapUsed
  let held = Infinity
  let compared = false
  load((a, b) => {
    if (!compared) {
      compared = true
      gc()
      held = process.memoryUsage().heapUsed - before
    }
    return a - b
  })
  return held
}

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
    a.updateRange(0, 199, () => ({ replace: 'LEAK' }), { inclusiveEnd: true })
    for (let i = 0; i < 200; i++) {
      expect(b.get(i)).toBeUndefined()
      expect(a.get(i)).toBe('LEAK')
    }
  })

  it('SPEC-R79 updateRange applies {replace:0}', () => {
    const tree = new BTree<number, number>()
    tree.set(1, 5)
    tree.updateRange(1, 1, () => ({ replace: 0 }), { inclusiveEnd: true })
    expect(tree.get(1)).toBe(0)
  })

  it('SPEC-R79 multi-level get default with nodeCapacity 8', () => {
    const tree = new BTree<number, string>(undefined, undefined, { nodeCapacity: 8 })
    for (let i = 0; i < 20; i++) tree.set(i, String(i))
    expect(tree.height).toBeGreaterThan(0)
    expect(tree.get(100, 'd')).toBe('d')
    expect(tree.get(5, 'd')).toBe('5')
  })

  it('SPEC-R79 frozen mutators throw and freeze is one-way', () => {
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
    expect(() => tree.removeRange(1, 3, { inclusiveEnd: true })).toThrow('BTree is frozen')
    expect(() => tree.removeAll([1])).toThrow('BTree is frozen')
    expect(() => tree.updateRange(1, 1, () => ({ replace: 9 }), { inclusiveEnd: true })).toThrow(
      'BTree is frozen'
    )
    expect(() => tree.setAll([[12, 12]])).toThrow('BTree is frozen')
    expect(tree.has(1)).toBe(true)
    expect(tree.isFrozen).toBe(true)
    expect(() => tree.set(11, 11)).toThrow('BTree is frozen')
  })

  it('SPEC-R79 entriesBetween respects limit', () => {
    const tree = new BTree<number, number>()
    for (let i = 0; i < 10; i++) tree.set(i, i)
    expect(tree.entriesBetween(0, 9, { inclusiveEnd: true, limit: 2 })).toEqual([
      [0, 0],
      [1, 1]
    ])
    expect(tree.entriesBetween(0, 9, { inclusiveEnd: true, limit: 0 })).toEqual([])
    expect(() => tree.entriesBetween(0, 9, { inclusiveEnd: true, limit: -1 })).toThrow(RangeError)
  })

  it('SPEC-R79 setAll counts only new keys', () => {
    const tree = new BTree<number, number>()
    expect(tree.setAll([[0, 1]])).toBe(1)
    expect(tree.setAll([[0, 7]])).toBe(0)
    expect(
      tree.setAll([
        [0, 1],
        [0, 7]
      ])
    ).toBe(0)
    expect(tree.get(0)).toBe(7)
    expect(
      tree.setAll([
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
    expect([...tree.entriesDescending()]).toEqual([...entries].reverse())
    expect([...tree.keys()]).toEqual(entries.map((e) => e[0]))
    expect([...tree.values()]).toEqual(entries.map((e) => e[1]))
  })

  it('SPEC-R79 firstKey lastKey clone', () => {
    const tree = new BTree<number, number>()
    for (let i = 10; i >= 0; i--) tree.set(i, i * 2)
    expect(tree.firstKey()).toBe(0)
    expect(tree.lastKey()).toBe(10)
    const t2 = tree.clone()
    expect([...t2.entriesDescending()]).toEqual([...tree.entriesDescending()])
    t2.set(100, 100)
    expect(tree.has(100)).toBe(false)
  })

  it('SPEC-R79 nodeCapacity must be an integer from 8 to 1024', () => {
    expect(() => new BTree<number, number>(undefined, undefined, { nodeCapacity: 2 })).toThrow(
      RangeError
    )
    expect(() => new BTree<number, number>(undefined, undefined, { nodeCapacity: 2 })).toThrow(
      'nodeCapacity must be an integer from 8 to 1024'
    )
    expect(() => new BTree<number, number>(undefined, undefined, { nodeCapacity: 2048 })).toThrow(
      RangeError
    )
    expect(() => new BTree<number, number>(undefined, undefined, { nodeCapacity: 8.5 })).toThrow(
      RangeError
    )
    expect(
      () => new BTree<number, number>(undefined, undefined, { nodeCapacity: Number.NaN })
    ).toThrow(RangeError)
    const exact = new BTree<number, number>(undefined, undefined, { nodeCapacity: 8 })
    expect(exact.nodeCapacity).toBe(8)
    const big = new BTree<number, number>(undefined, undefined, { nodeCapacity: 1024 })
    expect(big.nodeCapacity).toBe(1024)
    const def = new BTree<number, number>()
    expect(def.nodeCapacity).toBe(64)
  })

  it('SPEC-R79 comparator NaN result throws TypeError and leaves the tree unchanged', () => {
    const tree = new BTree<number, number>(undefined, (a, b) => a - b)
    tree.set(1, 1)
    expect(() => tree.set(Number.NaN, 2)).toThrow(TypeError)
    expect(() => tree.set(Number.NaN, 2)).toThrow('comparator must return a finite number')
    expect(tree.size).toBe(1)
    expect(tree.toArray()).toEqual([[1, 1]])
    tree[checkInvariants]()
  })

  it('SPEC-R79 differential fuzz vs Map', { timeout: 60_000 }, () => {
    const sizes = [8, 9, 16, 32]
    for (const nodeCapacity of sizes) {
      const tree = new BTree<number, number>(undefined, undefined, { nodeCapacity: nodeCapacity })
      const map = new Map<number, number>()
      let seed = nodeCapacity * 1000 + 7
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
          const fromTree = tree.entriesBetween(lo, hi, { inclusiveEnd: true })
          const fromMap = [...map.entries()]
            .filter(([key]) => key >= lo && key <= hi)
            .sort((a, b) => a[0] - b[0])
          expect(fromTree).toEqual(fromMap)
        }
        if (op % 500 === 0) tree[checkInvariants]()
      }
      expect(tree.size).toBe(map.size)
      expect([...tree.entries()]).toEqual([...map.entries()].sort((a, b) => a[0] - b[0]))
      tree[checkInvariants]()
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
    internals._nodeCapacity = 1
    expect(t.size).toBe(2)
    expect(t.nodeCapacity).toBe(64)
    expect(t.get(2)).toBe(2)
    expect(t.has(1)).toBe(true)
    t.set(3, 3)
    expect(t.size).toBe(3)
    t[checkInvariants]()
  })

  it('SPEC-R79 undefined is a valid key in iteration, ranges and lookups', () => {
    const t = new BTree<number | undefined, string>()
    t.set(2, 'b').set(undefined, 'u').set(1, 'a')
    const forward = [...t.entries()]
    expect(forward).toHaveLength(3)
    expect(t.toArray()).toEqual(forward)
    expect([...t.entriesDescending()]).toEqual([...forward].reverse())
    expect([...t.keys()]).toContain(undefined)
    expect(t.has(undefined)).toBe(true)
    expect(t.get(undefined)).toBe('u')
    expect(t.entriesBetween(2, undefined)).toEqual([[2, 'b']])
    expect(t.entriesBetween(2, undefined, { inclusiveEnd: true })).toEqual([
      [2, 'b'],
      [undefined, 'u']
    ])
    expect(t.delete(undefined)).toBe(true)
    expect(t.size).toBe(2)
    expect(t.has(undefined)).toBe(false)
  })

  it('SPEC-R79 undefined is the only key', () => {
    const t = new BTree<undefined, number>()
    t.set(undefined, 1)
    expect(t.toArray()).toEqual([[undefined, 1]])
    expect([...t.entriesDescending()]).toEqual([[undefined, 1]])
    expect(t.higher(undefined)).toBeUndefined()
    expect(t.lower(undefined)).toBeUndefined()
  })

  it('SPEC-R79 iteration terminates when mutated during iteration', () => {
    const t = new BTree<number, number>(undefined, undefined, { nodeCapacity: 8 })
    for (let i = 0; i < 200; i++) t.set(i, i)
    let visited = 0
    for (const [k] of t.entries()) {
      visited++
      t.delete(k + 1)
      if (k < 200 && k % 3 === 0) t.set(k + 1000, 0)
      t.set(k, k)
      expect(visited).toBeLessThan(10_000)
    }
    t[checkInvariants]()
    let reversed = 0
    for (const [k] of t.entriesDescending()) {
      reversed++
      t.delete(k - 1)
      if (k > 0 && k % 5 === 0) t.set(k - 1000, 0)
      expect(reversed).toBeLessThan(10_000)
    }
    t[checkInvariants]()
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
    for (const [k] of t.entriesDescending()) {
      back.push(k)
      t.clear()
    }
    expect(back).toEqual([2])
  })

  it('F-080 borrow and merge keep keys aligned with undefined values', () => {
    const t = new BTree<number, string | undefined>(undefined, undefined, { nodeCapacity: 8 })
    const model = new Map<number, string | undefined>()
    const sync = () => {
      expect(t.toArray()).toEqual([...model.entries()].sort((a, b) => a[0] - b[0]))
      t[checkInvariants]()
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
    expect([...t.entriesDescending(40)].map(([k]) => k)).toEqual([30, 20, 10])
    expect([...t.entriesDescending(25)].map(([k]) => k)).toEqual([20, 10])
    expect([...t.entriesDescending(5)].map(([k]) => k)).toEqual([])
    expect([...t.entries(25)].map(([k]) => k)).toEqual([30])
    expect([...t.entries(40)].map(([k]) => k)).toEqual([])
    const big = new BTree<number, number>(undefined, (a, b) => a - b, { nodeCapacity: 8 })
    for (let k = 0; k <= 498; k += 2) big.set(k, k)
    expect([...big.entriesDescending(1001)].map(([k]) => k).slice(0, 3)).toEqual([498, 496, 494])
    const mid = [...big.entriesDescending(251)].map(([k]) => k)
    expect(mid).toHaveLength(126)
    expect(mid[0]).toBe(250)
    expect([...big.entriesDescending(-1)]).toEqual([])
  })

  it('A3 clone after the original loses two levels', () => {
    // Bulk-load packs to height 2 at nodeCapacity 8 with 512 keys.
    const t = new BTree<number, number>(
      Array.from({ length: 512 }, (_, i) => [i, 0] as [number, number]),
      undefined,
      { nodeCapacity: 8 }
    )
    expect(t.height).toBe(2)
    t.removeRange(1, 16)
    const c = t.clone()
    t.removeRange(4, Infinity)
    expect(t.height).toBe(0)
    t.set(0, 1)
    expect(c.get(0)).toBe(0)
    expect(c.size).toBe(497)
    t[checkInvariants]()
    c[checkInvariants]()
  })

  it('A4 clone isolation', () => {
    const t = new BTree<number, number>(undefined, undefined, { nodeCapacity: 8 })
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
    for (const fanout of [8, 9, 16, 32]) {
      const t = new BTree<number, number>(undefined, undefined, { nodeCapacity: fanout })
      for (let i = 0; i < 4000; i++) {
        t.set(i, i)
        if (t.size > 100 && i % 2 === 0) {
          t.delete(i / 2)
          expect(t.size).toBe(i / 2 + 50)
        }
        if (i % 500 === 0) t[checkInvariants]()
      }
      t[checkInvariants]()
    }
  })

  it('A6 total order', () => {
    const t = new BTree<string, number>(undefined, undefined, { nodeCapacity: 8 })
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
    mixed[checkInvariants]()
  })

  it('A7 model fuzz with clones', () => {
    for (const fanout of [8, 16, 32]) {
      interface Snap {
        tree: BTree<number, number>
        map: Map<number, number>
      }
      const snaps: Snap[] = []
      let cur = new BTree<number, number>(undefined, undefined, { nodeCapacity: fanout })
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
          cur.removeRange(lo, hi, { inclusiveEnd: incl })
          for (const key of [...model.keys()]) {
            const inRange = incl ? key >= lo && key <= hi : key >= lo && key < hi
            if (inRange) model.delete(key)
          }
        } else if (kind === 3) {
          const lo = rnd() % 600
          const hi = lo + (rnd() % 40)
          const incl = rnd() % 2 === 0
          const fromTree = cur.entriesBetween(lo, hi, { inclusiveEnd: incl })
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
        if (op % 500 === 0) cur[checkInvariants]()
      }
      for (const s of snaps) {
        expect(s.tree.toArray()).toEqual([...s.map.entries()].sort((a, b) => a[0] - b[0]))
        s.tree[checkInvariants]()
      }
    }
  })

  it('A10 at index', () => {
    const t = new BTree<number, number>(undefined, undefined, { nodeCapacity: 8 })
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
    const fuzz = new BTree<number, number>(undefined, undefined, { nodeCapacity: 8 })
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
      t.setAll([
        [1, 1],
        [13, 13]
      ])
    ).toThrow(TypeError)
    expect(t.size).toBe(1)
    expect(t.toArray()).toEqual(before)
    expect(() => t.removeAll([1, 13])).toThrow(TypeError)
    expect(t.toArray()).toEqual(before)
    for (let i = 0; i < 10; i++) t.set(i, i)
    const snap = t.toArray()
    expect(() =>
      t.updateRange(
        0,
        100,
        (k) => {
          if (k === 5) throw new Error('x')
          return { replace: 0 }
        },
        { inclusiveEnd: true }
      )
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
    // one self-compare per key, one compare per adjacent pair
    expect(calls).toBe(19_999)
    t[checkInvariants]()
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
    const adjacentDuplicates = new BTree([
      [1, 'a'],
      [1, 'b']
    ])
    expect(adjacentDuplicates.toArray()).toEqual([[1, 'b']])
    const nothing = new BTree<number, string>([])
    expect(nothing.setAll([])).toBe(0)
    expect(nothing.set(1, 'a').toArray()).toEqual([[1, 'a']])
    const empty = new BTree<number, string>()
    expect(
      empty.setAll([
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
      const t = new BTree<number, number>(undefined, undefined, { nodeCapacity: 8 })
      for (let i = 0; i < 100; i++) t.set(i, i)
      const seen = new Set<number>()
      let last: number | undefined
      const iter = reverse ? t.entriesDescending() : t.entries()
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
      t[checkInvariants]()
    }
  })

  it('frozen reads still work', () => {
    const t = new BTree<number, number>([
      [1, 1],
      [2, 2],
      [3, 3]
    ])
    t.freeze()
    expect(t.visitRange(1, 3, () => undefined, { inclusiveEnd: true })).toBe(3)
    expect([...t.entries()].map(([k]) => k)).toEqual([1, 2, 3])
    expect(t.at(1)).toEqual([2, 2])
    expect(t.entriesBetween(1, 3, { inclusiveEnd: true })).toEqual([
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
    const t = new BTree<K, string>(undefined, (a, b) => a.id - b.id, { nodeCapacity: 8 })
    for (let id = 0; id < 20; id++) t.set({ id }, 'v')
    t.set({ id: 3, tag: 'new' }, 'x')
    t[checkInvariants]()
    expect([...t.keys()][3]?.tag).toBe('new')
  })

  it('rejects a comparator that does not return 0 for a key against itself', () => {
    for (const cmp of [neverEqual, selfLess]) {
      expect(() => new BTree([[1, 'a']], cmp)).toThrow(SELF_COMPARE_ERROR)
      const t = new BTree<number, string>(undefined, cmp)
      expect(() => t.set(1, 'a')).toThrow(SELF_COMPARE_ERROR)
      expect(() => t.setAll([[1, 'a']])).toThrow(SELF_COMPARE_ERROR)
      expect(t.size).toBe(0)
    }
  })

  it('stops walks that a never-equal comparator would feed forever', () => {
    const pairs: [number, string][] = [
      [1, 'a'],
      [2, 'b'],
      [3, 'c']
    ]
    let steps = 0
    const step = () => {
      if (++steps > 1000) throw new Error('walk never ended')
    }

    expect(() => {
      const t = new BTree(pairs, neverEqual)
      t.updateRange(1, 4, () => {
        step()
        return { replace: 'x' }
      })
    }).toThrow(SELF_COMPARE_ERROR)
    expect(() => {
      const t = new BTree(pairs, neverEqual)
      for (const [k] of t) {
        step()
        t.set(k, 'x')
      }
    }).toThrow(SELF_COMPARE_ERROR)
    expect(() => {
      const t = new BTree(pairs, selfLess)
      for (const [k] of t.entriesDescending()) {
        step()
        t.set(k, 'x')
      }
    }).toThrow(SELF_COMPARE_ERROR)
  })

  it('rejects a key the comparator cannot order before it enters an empty tree', () => {
    const subtract = (a: unknown, b: unknown) => Number(a) - Number(b)
    const t = new BTree<unknown, number>(undefined, subtract)

    for (const bad of [Number.NaN, Infinity, undefined]) {
      expect(() => t.set(bad, 1)).toThrow(FINITE_ERROR)
      expect(() => new BTree([[bad, 1]], subtract)).toThrow(FINITE_ERROR)
    }

    expect(t.size).toBe(0)
    expect(t.set(1, 1).toArray()).toEqual([[1, 1]])
  })

  it('rejects a non-function comparator at construction', () => {
    expect(() => new BTree([[1, 1]], 'x' as never)).toThrow('comparator must be a function')
    expect(() => new SortedMap(undefined, 1 as never)).toThrow('comparator must be a function')
    expect(() => new SortedSet(undefined, {} as never)).toThrow('comparator must be a function')
  })

  it('removeAll refuses a huge sparse array', () => {
    const t = new BTree([[1, 1]])

    expect(() => t.removeAll(new Array<number>(2 ** 24 + 1))).toThrow('sparse array too large')

    expect(t.size).toBe(1)
  })

  it('bulk loads hold no per-item boxes', () => {
    const n = 200_000
    function* pairs(): Generator<[number, number]> {
      for (let i = 0; i < n; i++) yield [i, i]
    }
    const values = Array.from({ length: n }, (_, i) => i)

    const tree = heapHeldAtFirstCompare((cmp) => new BTree(pairs(), cmp))
    const map = heapHeldAtFirstCompare((cmp) => new SortedMap(pairs(), cmp))
    const set = heapHeldAtFirstCompare((cmp) => new SortedSet(values, cmp))

    // a boxed [k, v] pair alone costs over 60 bytes
    expect(tree).toBeLessThan(40 * n)
    expect(map).toBeLessThan(40 * n)
    expect(set).toBeLessThan(40 * n)
  })

  it('rejects items that are not entries, as native Map does', () => {
    expect(() => new BTree(JSON.parse('[1,2,3]') as never)).toThrow(ENTRY_ERROR)
    expect(() => new BTree(JSON.parse('["ab","cd"]') as never)).toThrow(ENTRY_ERROR)
    expect(() => new BTree('hey' as never)).toThrow(ENTRY_ERROR)
    expect(() => new BTree([null] as never)).toThrow(ENTRY_ERROR)
    expect(() => new BTree<number, number>().setAll([1, 2] as never)).toThrow(ENTRY_ERROR)
    const t = new BTree<number, number>([[1, 1]])
    expect(() => t.setAll([[2, 2], 3] as never)).toThrow(ENTRY_ERROR)

    expect(t.toArray()).toEqual([[1, 1]])
    expect([...new BTree([[1]] as never)]).toEqual([[1, undefined]])
  })

  it('treats null entries as none, as native Map does', () => {
    expect(new BTree(null).size).toBe(0)
  })

  it('shallow clones keep the subclass, comparator and capacity', () => {
    class Tree extends BTree<number, string> {}
    const t = new Tree(
      [
        [1, 'a'],
        [2, 'b']
      ],
      (a, b) => b - a,
      { nodeCapacity: 9 }
    )

    const copies = [t.clone(), clone(t)]

    for (const copy of copies) {
      expect(copy).toBeInstanceOf(Tree)
      expect(deepEqual(t, copy)).toBe(true)
      expect(copy.nodeCapacity).toBe(9)
      expect([...copy.set(3, 'c').keys()]).toEqual([3, 2, 1])
    }
    expect(t.size).toBe(2)
  })

  it('a shallow clone shares structure without comparing a key', () => {
    let compares = 0
    const t = new BTree<number, number>(
      [
        [1, 1],
        [2, 2]
      ],
      (a, b) => {
        compares++
        return a - b
      }
    )
    compares = 0

    clone(t)

    expect(compares).toBe(0)
  })

  it('self-nested trees reach the documented 125 levels', () => {
    const nest = (depth: number) => {
      let t = new BTree<number, unknown>([[0, 0]])
      for (let i = 1; i < depth; i++) t = new BTree([[0, t]])
      return t
    }

    expect(deepEqual(nest(125), nest(125))).toBe(true)
    expect(() => deepEqual(nest(126), nest(126))).toThrow('nesting deeper than 1000 levels')
  })

  it('updateRange acts on a truthy remove only', () => {
    const t = new BTree<number, number>([
      [0, 0],
      [1, 1],
      [2, 2]
    ])

    t.updateRange(0, 3, (k) => (k === 1 ? ({ remove: false } as never) : undefined))
    expect([...t.keys()]).toEqual([0, 1, 2])

    t.updateRange(0, 3, () => ({ replace: 9, remove: false }) as never)
    expect([...t.values()]).toEqual([9, 9, 9])

    expect(() => t.updateRange(0, 3, () => ({ replace: 1, remove: true }) as never)).toThrow(
      'RangeUpdate cannot both replace and remove'
    )
    expect([...t.values()]).toEqual([9, 9, 9])
  })

  it('updateRange leaves an entry alone on null and names the contract on a primitive', () => {
    const t = new BTree<number, number>([[0, 0]])

    expect(t.updateRange(0, 1, () => null)).toBe(1)
    expect(t.toArray()).toEqual([[0, 0]])

    for (const primitive of [0, 'x', true]) {
      expect(() => t.updateRange(0, 1, () => primitive as never)).toThrow(
        'update must return a RangeUpdate, null or undefined'
      )
    }
  })

  it('rejects non-object options instead of ignoring 1.x positional arguments', () => {
    const t = new BTree([
      [1, 1],
      [2, 2],
      [3, 3]
    ])
    const error = 'options must be an object'

    expect(() => t.entriesBetween(1, 3, true as never)).toThrow(error)
    expect(() => t.removeRange(1, 3, true as never)).toThrow(error)
    expect(() => t.visitRange(1, 3, () => undefined, true as never)).toThrow(error)
    expect(() => t.updateRange(1, 3, () => undefined, true as never)).toThrow(error)
    expect(() => new BTree(undefined, undefined, 32 as never)).toThrow(error)
    expect(() => new BTree(undefined, undefined, null as never)).toThrow(error)

    expect(t.size).toBe(3)
  })

  it('an explicit undefined start means omitted, even with an undefined key', () => {
    const numbers = new BTree([
      [1, 'a'],
      [2, 'b']
    ])
    const walk = (from?: number) => numbers.entries(from)
    const undefinedFirst = new BTree<number | undefined, string>(
      [
        [1, 'a'],
        [undefined, 'u']
      ],
      (a, b) => (a ?? -1) - (b ?? -1)
    )
    const undefinedLast = new BTree<number | undefined, string>([
      [1, 'a'],
      [undefined, 'u']
    ])

    expect([...walk()]).toEqual([...numbers])
    expect([...undefinedLast.entries(undefined)]).toEqual([
      [1, 'a'],
      [undefined, 'u']
    ])
    expect([...undefinedFirst.entriesDescending(undefined)]).toEqual([
      [1, 'a'],
      [undefined, 'u']
    ])
  })

  it('setAll reads its whole input before it writes', () => {
    const empty = new BTree<string, number>()
    function* writingToEmpty(): Generator<[string, number]> {
      empty.set('side', 1)
      yield ['a', 1]
    }
    const filled = new BTree<string, number>([['z', 0]])
    function* writingToFilled(): Generator<[string, number]> {
      filled.set('side', 1)
      yield ['a', 1]
    }

    expect(empty.setAll(writingToEmpty())).toBe(1)
    expect(filled.setAll(writingToFilled())).toBe(1)

    expect([...empty.keys()]).toEqual(['a', 'side'])
    expect([...filled.keys()]).toEqual(['a', 'side', 'z'])
  })

  it('freeze during an atomic update throws, so a frozen tree never rolls back', () => {
    const error = 'BTree cannot freeze during an atomic update'
    function* freezing(tree: BTree<number, number>): Generator<[number, number]> {
      tree.freeze()
      yield [2, 2]
    }
    const empty = new BTree<number, number>()
    const t = new BTree<number, number>([[1, 1]])

    expect(() => empty.setAll(freezing(empty))).toThrow(error)
    expect(() => t.setAll(freezing(t))).toThrow(error)
    expect(() =>
      t.updateRange(1, 2, () => {
        t.set(100, 1)
        t.freeze()
        return undefined
      })
    ).toThrow(error)

    expect(empty.size).toBe(0)
    expect(t.toArray()).toEqual([[1, 1]])
    expect(t.isFrozen).toBe(false)
    expect(t.freeze().isFrozen).toBe(true)
  })
})
