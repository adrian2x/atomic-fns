import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SplayTree } from '../../src/collections/index.ts'

function probed(): { tree: SplayTree<number, number>; depth: (key: number) => number } {
  let calls = 0
  const tree = new SplayTree<number, number>(undefined, (a, b) => {
    calls++
    return a - b
  })
  const depth = (key: number): number => {
    calls = 0
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.75)
    expect(tree.has(key)).toBe(true)
    return calls - 1
  }
  return { tree, depth }
}

/** The deepest key's depth, read through `depth` for every key in `0..n-1`. */
function heightOf(depth: (key: number) => number, n: number): number {
  let height = 0
  for (let key = 0; key < n; key++) height = Math.max(height, depth(key))
  return height
}

describe('SplayTree', () => {
  beforeEach(() => {
    let seed = 7
    vi.spyOn(Math, 'random').mockImplementation(() => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 2 ** 32
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('empty tree size and iteration', () => {
    const tree = new SplayTree<number, number>()
    expect(tree.size).toBe(0)
    expect([...tree.values()]).toEqual([])
    expect(tree.firstKey()).toBeUndefined()
    expect(tree.lastKey()).toBeUndefined()
    expect(tree.has(1)).toBe(false)
    expect(tree.get(1)).toBeUndefined()
  })

  it('set get has clear', () => {
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

  it('set returns this and replaces value', () => {
    const tree = new SplayTree<number, string>()
    expect(tree.set(1, 'a')).toBe(tree)
    tree.set(1, 'b')
    expect(tree.get(1)).toBe('b')
    expect(tree.size).toBe(1)
  })

  it('splay keeps key reachable and ordered', () => {
    const tree = new SplayTree<number, number>()
    for (let i = 100; i > 0; i--) {
      tree.set(i, i)
    }
    tree.splay(42)
    expect(tree.has(42)).toBe(true)
    expect(tree.get(42)).toBe(42)
    expect([...tree.keys()]).toEqual(Array.from({ length: 100 }, (_, i) => i + 1))
  })

  it('lower and higher on both splay branches', () => {
    const tree = new SplayTree<number, number>()
    for (let i = 20; i > 0; i -= 2) {
      tree.set(i, i)
    }
    expect(tree.lower(12)?.[0]).toBe(10)
    expect(tree.higher(12)?.[0]).toBe(14)
    expect(tree.lower(2)).toBeUndefined()
    expect(tree.higher(20)).toBeUndefined()
    expect(tree.lower(7)?.[0]).toBe(6)
    expect(tree.higher(7)?.[0]).toBe(8)
    tree.splay(4)
    expect(tree.lower(10)?.[0]).toBe(8)
    tree.splay(18)
    expect(tree.higher(10)?.[0]).toBe(12)
  })

  it('firstKey and lastKey shorten a degenerate tree', () => {
    const n = 1000
    const { tree, depth } = probed()
    for (let i = 0; i < n; i++) tree.set(i, i)
    expect(depth(0)).toBe(n - 1)
    const before = heightOf(depth, n)
    expect(before).toBe(n - 1)
    expect(tree.firstKey()).toBe(0)
    expect(depth(0)).toBe(0)
    const afterMin = heightOf(depth, n)
    expect(afterMin).toBeLessThan(before)
    expect(tree.lastKey()).toBe(n - 1)
    expect(depth(n - 1)).toBe(0)
    expect(heightOf(depth, n)).toBeLessThanOrEqual(afterMin + 1)
  })

  it('delete present and missing', () => {
    const tree = new SplayTree<number, number>()
    tree.set(42, 42)
    expect(tree.delete(42)).toBe(true)
    expect(tree.has(42)).toBe(false)
    expect(tree.delete(42)).toBe(false)
    expect(tree.size).toBe(0)
  })

  it('custom comparator delete', () => {
    interface Id {
      id: number
    }
    const tree = new SplayTree<Id, string>(undefined, (a, b) => a.id - b.id)
    tree.set({ id: 1 }, 'a')
    tree.set({ id: 2 }, 'b')
    expect(tree.delete({ id: 1 })).toBe(true)
    expect(tree.size).toBe(1)
    expect(tree.has({ id: 1 })).toBe(false)
    expect(tree.get({ id: 2 })).toBe('b')
    expect(tree.delete({ id: 99 })).toBe(false)
  })

  it('keys values entries ordered', () => {
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

  it('reads during for-of visit each key once across 50 trials', () => {
    for (let trial = 0; trial < 50; trial++) {
      const tree = new SplayTree<number, number>()
      const n = 40 + (trial % 20)
      for (let i = 0; i < n; i++) tree.set(i, i)
      const seen: number[] = []
      for (const v of tree.values()) {
        seen.push(v)
        if (seen.length > n) throw new Error('the iterator visited too many keys')
        expect(tree.has(v)).toBe(true)
        expect(tree.get(v)).toBe(v)
        expect(tree.firstKey()).toBe(0)
        expect(tree.lastKey()).toBe(n - 1)
        if (v > 0) expect(tree.lower(v)?.[0]).toBe(v - 1)
        else expect(tree.lower(v)).toBeUndefined()
        if (v < n - 1) expect(tree.higher(v)?.[0]).toBe(v + 1)
        else expect(tree.higher(v)).toBeUndefined()
      }
      expect(seen).toStrictEqual(Array.from({ length: n }, (_, i) => i))
    }
  })

  it('lower and higher during an open iterator keep it on track', () => {
    const tree = new SplayTree<number, number>()
    for (let i = 1; i <= 9; i++) tree.set(i, i)
    const keys: number[] = []
    for (const k of tree.keys()) {
      keys.push(k)
      expect(tree.lower(5)?.[0]).toBe(4)
      expect(tree.higher(5)?.[0]).toBe(6)
    }
    expect(keys).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('an abandoned iterator does not disable splaying', () => {
    let compares = 0
    const cmp = (x: number, y: number) => {
      compares++
      return x - y
    }
    const mk = () => {
      const t = new SplayTree<number, number>(undefined, cmp)
      for (let i = 1; i <= 64; i++) t.set(i, i)
      return t
    }
    const t = mk()
    t.keys().next()
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

  it('iterate while get re-seeks in O(log n) comparator calls', () => {
    const n = 20_000
    let calls = 0
    const tree = new SplayTree<number, number>(undefined, (a, b) => {
      calls++
      return a < b ? -1 : a > b ? 1 : 0
    })
    for (let i = 0; i < n; i++) tree.set(i, i)
    calls = 0
    const seen: number[] = []
    for (const k of tree.keys()) {
      seen.push(k)
      tree.get(k)
    }
    expect(seen).toEqual(Array.from({ length: n }, (_, i) => i))
    expect(calls).toBeLessThan(40 * n * Math.log2(n))
  })

  it('a comparator that throws in the middle of a splay loses no entry', () => {
    const keys = Array.from({ length: 20 }, (_, i) => i)
    for (let failAt = 0; failAt < 12; failAt++) {
      let room = Infinity
      const tree = new SplayTree<number, number>(undefined, (a, b) => {
        if (room-- <= 0) throw new Error('boom')
        return a - b
      })
      for (const key of keys) tree.set(key, key)
      room = failAt
      expect(() => tree.splay(0)).toThrow('boom')
      room = Infinity
      expect([...tree.keys()]).toEqual(keys)
      expect(tree.size).toBe(keys.length)
      expect(tree.get(3)).toBe(3)
    }
  })

  it('a comparator that throws in the middle of a delete loses no entry', () => {
    const keys = Array.from({ length: 20 }, (_, i) => i)
    const outcomes = new Set<string>()
    for (let failAt = 0; failAt < 20; failAt++) {
      let room = Infinity
      const failure = new Error('boom')
      const tree = new SplayTree<number, number>(undefined, (a, b) => {
        if (room-- <= 0) throw failure
        return a - b
      })
      for (const key of keys) tree.set(key, key)
      tree.splay(10)
      room = failAt
      let deleted: boolean | undefined
      let threw = false
      try {
        deleted = tree.delete(10)
      } catch (error) {
        expect(error).toBe(failure)
        threw = true
        outcomes.add('threw')
      }
      room = Infinity
      if (!threw) {
        expect(deleted).toBe(true)
        outcomes.add('deleted')
      }
      const expected = threw ? keys : keys.filter((key) => key !== 10)
      expect([...tree.keys()]).toStrictEqual(expected)
      expect(tree.size).toBe(expected.length)
    }
    expect([...outcomes]).toStrictEqual(['threw', 'deleted'])
  })

  it('reading a hot key while iterating a sequential tree stays near log n per step', () => {
    const n = 4000
    let calls = 0
    const tree = new SplayTree<number, number>(undefined, (a, b) => {
      calls++
      return a - b
    })
    for (let i = 0; i < n; i++) tree.set(i, i)
    calls = 0

    let steps = 0
    for (const _ of tree.keys()) {
      steps++
      tree.has(n - 1)
    }

    expect(steps).toBe(n)
    expect(calls).toBeLessThan(n * 64)
  })

  it('lower and higher splay the neighbor they walk to', () => {
    const n = 1000
    const ascending = probed()
    for (let i = 0; i < n; i++) ascending.tree.set(i, i)
    expect(ascending.tree.higher(0)?.[0]).toBe(1)
    expect(ascending.depth(1)).toBe(0)
    expect(heightOf(ascending.depth, n)).toBeLessThan(n / 3)

    const descending = probed()
    for (let i = n - 1; i >= 0; i--) descending.tree.set(i, i)
    expect(descending.tree.lower(n - 1)?.[0]).toBe(n - 2)
    expect(descending.depth(n - 2)).toBe(0)
    expect(heightOf(descending.depth, n)).toBeLessThan(n / 3)
  })

  it('iterator survives inserts and deletes between yields', () => {
    const tree = new SplayTree<number, number>()
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

  it('iterator started on an empty tree sees later keys', () => {
    const tree = new SplayTree<number, number>()
    const it = tree.keys()
    tree.set(1, 1)
    expect([...it]).toEqual([1])
  })

  it('undefined keys do not confuse the re-seek', () => {
    const tree = new SplayTree<number | undefined, number>(undefined, (a, b) =>
      a === b ? 0 : a === undefined ? 1 : b === undefined ? -1 : a < b ? -1 : 1
    )
    for (const k of [1, 2, undefined]) tree.set(k, 0)
    const seen: (number | undefined)[] = []
    for (const k of tree.keys()) {
      seen.push(k)
      tree.get(2)
    }
    expect(seen).toEqual([1, 2, undefined])
  })

  it('iterates 1e5 sorted keys', () => {
    const tree = new SplayTree<number, number>()
    const expected: number[] = []
    for (let i = 0; i < 1e5; i++) {
      tree.set(i, i)
      expected.push(i)
    }
    expect([...tree.keys()]).toEqual(expected)
    expect([...tree.values()]).toEqual(expected)
    expect([...tree.entries()]).toHaveLength(tree.size)
  })

  it('iteration visits each key once when the loop deletes it', () => {
    const tree = new SplayTree<number, number>()
    for (const key of [3, 1, 2, 5, 4]) {
      tree.set(key, key)
    }
    const seen: number[] = []
    for (const key of tree.keys()) {
      seen.push(key)
      if (seen.length > 5) break
      tree.delete(key)
    }
    expect(seen).toEqual([1, 2, 3, 4, 5])
    expect(tree.size).toBe(0)
  })

  it('clear ends an open iterator', () => {
    const tree = new SplayTree<number, number>([
      [1, 1],
      [2, 2],
      [3, 3]
    ])
    const seen: number[] = []
    for (const key of tree.keys()) {
      seen.push(key)
      tree.clear()
    }
    expect(seen).toEqual([1])
  })

  it('delete treats 0 and -0 as one key', () => {
    const tree = new SplayTree<number, string>()
    tree.set(0, 'a')
    expect(tree.get(-0)).toBe('a')
    expect(tree.delete(-0)).toBe(true)
    expect(tree.size).toBe(0)
  })

  it('has a key whose value is undefined', () => {
    const tree = new SplayTree<number, undefined>()
    tree.set(1, undefined)
    tree.set(2, undefined)
    expect(tree.has(1)).toBe(true)
    expect(tree.has(2)).toBe(true)
    expect(tree.has(3)).toBe(false)
  })

  it('builds from entries, as Map does, and iterates them in key order', () => {
    const tree = new SplayTree([
      [3, 'c'],
      [1, 'a'],
      [2, 'b']
    ])
    expect([...tree]).toEqual([
      [1, 'a'],
      [2, 'b'],
      [3, 'c']
    ])
    expect(tree.lower(2)).toEqual([1, 'a'])
    expect(tree.higher(2)).toEqual([3, 'c'])
    const seen: unknown[] = []
    const context = {}
    tree.forEach(function (this: unknown, value, key, t) {
      seen.push([key, value, t === tree, this === context])
    }, context)
    expect(seen).toEqual([
      [1, 'a', true, true],
      [2, 'b', true, true],
      [3, 'c', true, true]
    ])
    expect(new SplayTree(null).size).toBe(0)
    expect(() => new SplayTree([1] as never)).toThrow(TypeError)
  })

  it('asks for a comparator for keys outside the primitive order', () => {
    const tree = new SplayTree<object, number>()
    expect(() => tree.set({}, 1)).toThrow(/pass a comparator/)
    expect(tree.size).toBe(0)
    expect(() => new SplayTree().set(Number.NaN, 1)).toThrow(RangeError)
    expect(() => new SplayTree([[Number.NaN, 1]])).toThrow(RangeError)
    expect(() => new SplayTree().set(null, 1)).toThrow(TypeError)
    const numbers = new SplayTree<number | null | undefined, number>([[1, 1]])
    expect(() => numbers.set(null, 2)).toThrow(TypeError)
    expect(() => numbers.set(undefined, 2)).toThrow(TypeError)
    expect(() => numbers.set(Number.NaN, 2)).toThrow(RangeError)
    expect([...numbers]).toEqual([[1, 1]])
    expect(Object.prototype.toString.call(tree)).toBe('[object SplayTree]')
    expect(Reflect.ownKeys(tree)).toEqual([])
  })

  it('a comparator that returns a non-finite number throws TypeError and stores nothing', () => {
    interface Rec {
      s?: number
    }
    const tree = new SplayTree<Rec, number>(
      [
        [{ s: 1 }, 1],
        [{ s: 2 }, 2],
        [{ s: 3 }, 3]
      ],
      (a, b) => (a.s as number) - (b.s as number)
    )
    expect(() => tree.set({}, 0)).toThrowError(
      new TypeError('comparator must return a finite number')
    )
    expect(tree.size).toBe(3)
    expect(() =>
      new SplayTree<Rec, number>(null, (a, b) => (a.s as number) - (b.s as number)).set({}, 0)
    ).toThrow(TypeError)
    tree.set({ s: 2 }, 99)
    expect([...tree.values()]).toEqual([1, 99, 3])
  })
})
