import { describe, expect, it } from 'vitest'
import { SortedMap } from '../../src/collections/index.ts'
import { checkSortedMap } from '../../src/collections/internal/invariants.ts'

const ENTRY_ERROR = 'entries must be [key, value] pairs'
const SELF_COMPARE_ERROR = 'comparator must return 0 for a key compared with itself'
const FINITE_ERROR = 'comparator must return a finite number'

const neverEqual = (a: number, b: number) => (a < b ? -1 : 1)
const selfLess = (a: number, b: number) => (a <= b ? -1 : 1)

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed >>> 8
  }
}

const undefinedLast = (a: number | undefined, b: number | undefined): number =>
  a === undefined ? (b === undefined ? 0 : 1) : b === undefined ? -1 : a - b

describe('SortedMap', () => {
  it('get and has find each key set, and size counts them', () => {
    const tree = new SortedMap<number, number>()
    for (let i = 100; i > 0; i--) {
      tree.set(i, i * 2)
      expect(tree.get(i)).toBe(i * 2)
      expect(tree.has(i)).toBe(true)
    }
    expect(tree.size).toBe(100)
    checkSortedMap(tree)
  })

  it('clear removes every entry', () => {
    const tree = new SortedMap<number, number>()
    for (let i = 100; i > 0; i--) tree.set(i, i * 2)
    tree.clear()
    expect(tree.size).toBe(0)
    expect(tree.has(100)).toBe(false)
    expect([...tree]).toEqual([])
    checkSortedMap(tree)
  })

  it('set returns this and replaces value', () => {
    const tree = new SortedMap<number, string>()
    expect(tree.set(1, 'a')).toBe(tree)
    tree.set(1, 'b')
    expect(tree.get(1)).toBe('b')
    expect(tree.size).toBe(1)
  })

  it('has finds a key whose value is undefined', () => {
    const tree = new SortedMap<number, number | undefined>()
    tree.set(1, undefined)
    expect(tree.has(1)).toBe(true)
    expect(tree.get(1)).toBeUndefined()
    expect(tree.delete(1)).toBe(true)
    expect(tree.has(1)).toBe(false)
    const multiLevel = new SortedMap<number, undefined>()
    for (let i = 0; i < 80; i++) multiLevel.set(i, undefined)
    expect(multiLevel.has(5)).toBe(true)
    expect(multiLevel.has(5.5)).toBe(false)
    expect(multiLevel.has(99)).toBe(false)
  })

  it('get finds keys and misses before the first and past the last on a multi-level tree', () => {
    const tree = new SortedMap<number, string>()
    for (let i = 0; i < 80; i++) tree.set(i, String(i))
    for (let i = 0; i < 80; i++) expect(tree.get(i)).toBe(String(i))
    expect(tree.get(100)).toBeUndefined()
    expect(tree.get(-1)).toBeUndefined()
    expect(tree.has(99)).toBe(false)
    checkSortedMap(tree)
  })

  it('higher lower floor ceiling on 1..9', () => {
    const tree = new SortedMap<number, number>()
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

  it('iterates in order and reversed', () => {
    const tree = new SortedMap<number, number>()
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

  it('firstKey lastKey clone', () => {
    const tree = new SortedMap<number, number>()
    for (let i = 10; i >= 0; i--) tree.set(i, i * 2)
    expect(tree.firstKey()).toBe(0)
    expect(tree.lastKey()).toBe(10)
    const t2 = tree.clone()
    expect([...t2.entriesDescending()]).toEqual([...tree.entriesDescending()])
    t2.set(100, 100)
    expect(tree.has(100)).toBe(false)
  })

  it('comparator NaN result throws TypeError and leaves the tree unchanged', () => {
    const tree = new SortedMap<number, number>(undefined, (a, b) => a - b)
    tree.set(1, 1)
    expect(() => tree.set(Number.NaN, 2)).toThrowError(new TypeError(FINITE_ERROR))
    expect(tree.size).toBe(1)
    expect([...tree]).toEqual([[1, 1]])
    checkSortedMap(tree)
  })

  it('rejects a comparator that is not a function', () => {
    const numberComparator = () => new SortedMap(null, 5 as never)
    expect(numberComparator).toThrowError(new TypeError('comparator must be a function'))
  })

  it('undefined is the only key', () => {
    const t = new SortedMap<number | undefined, number>(undefined, undefinedLast)
    t.set(undefined, 1)
    expect([...t]).toEqual([[undefined, 1]])
    expect([...t.entriesDescending()]).toEqual([[undefined, 1]])
    expect(t.higher(undefined)).toBeUndefined()
    expect(t.lower(undefined)).toBeUndefined()
  })

  it('iteration terminates when mutated during iteration', () => {
    const t = new SortedMap<number, number>()
    for (let i = 0; i < 200; i++) t.set(i, i)
    let visited = 0
    for (const [k] of t.entries()) {
      visited++
      t.delete(k + 1)
      if (k < 200 && k % 3 === 0) t.set(k + 1000, 0)
      t.set(k, k)
      expect(visited).toBeLessThan(10_000)
    }
    checkSortedMap(t)
    let reversed = 0
    for (const [k] of t.entriesDescending()) {
      reversed++
      t.delete(k - 1)
      if (k > 0 && k % 5 === 0) t.set(k - 1000, 0)
      expect(reversed).toBeLessThan(10_000)
    }
    checkSortedMap(t)
    for (const k of t.keys()) t.delete(k)
    expect(t.size).toBe(0)
    expect([...t.entries()]).toEqual([])
  })

  it('clear during iteration ends iteration', () => {
    const t = new SortedMap<number, number>([
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
    t.set(1, 1)
    t.set(2, 2)
    for (const [k] of t.entriesDescending()) {
      back.push(k)
      t.clear()
    }
    expect(back).toEqual([2])
  })

  it('borrow and merge keep keys aligned with undefined values', () => {
    const t = new SortedMap<number, string | undefined>()
    const model = new Map<number, string | undefined>()
    const sync = () => {
      expect([...t]).toStrictEqual([...model.entries()].sort((a, b) => a[0] - b[0]))
      checkSortedMap(t)
    }
    for (let k = 0; k < 66; k++) {
      const value = k < 33 ? undefined : `v${k}`
      t.set(k, value)
      model.set(k, value)
      sync()
    }
    for (const k of [0, 1, 2]) {
      t.delete(k)
      model.delete(k)
      sync()
    }
  })

  it('neighbors around key 0, on one leaf and on a multi-level tree', () => {
    const t = new SortedMap<number, number>([
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
    for (let k = -10; k <= 300; k++) {
      expect(t.ceiling(k)?.[0]).toBe(k)
      expect(t.floor(k)?.[0]).toBe(k)
      expect(t.higher(k)?.[0]).toBe(k === 300 ? undefined : k + 1)
      expect(t.lower(k)?.[0]).toBe(k === -10 ? undefined : k - 1)
      expect(t.ceiling(k - 0.5)?.[0]).toBe(k)
      expect(t.floor(k + 0.5)?.[0]).toBe(k)
    }
    const empty = new SortedMap<number, number>()
    expect(empty.lower(0)).toBeUndefined()
    expect(empty.higher(0)).toBeUndefined()
    expect(empty.floor(0)).toBeUndefined()
    expect(empty.ceiling(0)).toBeUndefined()
  })

  it('entries and entriesDescending start at, around and past the given key', () => {
    const t = new SortedMap<number, number>(undefined, (a, b) => a - b)
    t.set(10, 10)
    t.set(20, 20)
    t.set(30, 30)
    expect([...t.entriesDescending(40)].map(([k]) => k)).toEqual([30, 20, 10])
    expect([...t.entriesDescending(25)].map(([k]) => k)).toEqual([20, 10])
    expect([...t.entriesDescending(5)].map(([k]) => k)).toEqual([])
    expect([...t.entries(25)].map(([k]) => k)).toEqual([30])
    expect([...t.entries(40)].map(([k]) => k)).toEqual([])
    expect([...t.entries(20)]).toEqual([
      [20, 20],
      [30, 30]
    ])
    expect([...t.entriesDescending(20)]).toEqual([
      [20, 20],
      [10, 10]
    ])
    const big = new SortedMap<number, number>(undefined, (a, b) => a - b)
    for (let k = 0; k <= 498; k += 2) big.set(k, k)
    expect([...big.entriesDescending(1001)].map(([k]) => k).slice(0, 3)).toEqual([498, 496, 494])
    const mid = [...big.entriesDescending(251)].map(([k]) => k)
    expect(mid).toHaveLength(126)
    expect(mid[0]).toBe(250)
    expect([...big.entriesDescending(-1)]).toEqual([])
    // Every key, so the starts include each leaf's first and last key.
    for (let k = 0; k <= 498; k += 2) {
      expect(big.entries(k).next().value).toEqual([k, k])
      expect(big.entriesDescending(k).next().value).toEqual([k, k])
      expect(big.entries(k - 1).next().value).toEqual([k, k])
      expect(big.entriesDescending(k + 1).next().value).toEqual([k, k])
    }
  })

  it('clones stay isolated from their source and from each other', () => {
    const t = new SortedMap<number, number>()
    for (let i = 0; i < 512; i++) t.set(i, i)
    for (let i = 0; i < 512; i++) if (i % 4 !== 0) t.delete(i)
    const snapA = [...t]
    const A = t.clone()
    const B = A.clone()
    for (let i = 0; i < 512; i++) if (i % 16 !== 0) t.delete(i)
    for (let i = 0; i < 512; i++) t.set(i, 7)
    expect([...A]).toEqual(snapA)
    expect([...B]).toEqual(snapA)
    for (const k of [...B.keys()]) B.delete(k)
    expect(B.size).toBe(0)
    expect([...A]).toEqual(snapA)
    const empty = new SortedMap<number, number>()
    const c = empty.clone()
    empty.set(1, 1)
    c.set(2, 2)
    expect([...empty]).toEqual([[1, 1]])
    expect([...c]).toEqual([[2, 2]])
  })

  it('interleaved inserts and deletes keep the tree valid', () => {
    const t = new SortedMap<number, number>()
    for (let i = 0; i < 4000; i++) {
      t.set(i, i)
      if (t.size > 100 && i % 2 === 0) {
        t.delete(i / 2)
        expect(t.size).toBe(i / 2 + 50)
      }
      if (i % 500 === 0) checkSortedMap(t)
    }
    checkSortedMap(t)
  })

  it('orders string keys as the default comparator does', () => {
    const t = new SortedMap<string, number>()
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
    expect([...t.keys()]).toEqual(keys.toSorted())
    checkSortedMap(t)
  })

  it('the default comparator orders numbers and bigints together and asks for a comparator otherwise', () => {
    const numeric = new SortedMap<number | bigint, string>([
      [2n, 'two'],
      [1.5, 'one and a half'],
      [-Infinity, 'low'],
      [2 ** 53, 'big'],
      [2n ** 53n + 1n, 'bigger']
    ])
    expect([...numeric.keys()]).toEqual([-Infinity, 1.5, 2n, 2 ** 53, 2n ** 53n + 1n])
    numeric.set(2, 'number two')
    expect(numeric.size).toBe(5)
    expect(numeric.get(2n)).toBe('number two')
    const before = [...numeric]
    for (const key of ['1', {}, null, undefined, true, Symbol('s'), new Date(0)]) {
      expect(() => numeric.set(key as never, 'x')).toThrow(TypeError)
    }
    expect(() => numeric.set(Number.NaN, 'x')).toThrow(RangeError)
    expect([...numeric]).toEqual(before)
    checkSortedMap(numeric)
  })

  it('stores a -0 key as +0, as Map does', () => {
    const m = new SortedMap([[-0, 'a']])
    expect(Object.is(m.firstKey(), 0)).toBe(true)
    m.set(-0, 'b')
    expect(Object.is([...m.keys()][0], 0)).toBe(true)
    expect(m.get(0)).toBe('b')
    expect(m.size).toBe(1)
  })

  it('at answers by position with Array.prototype.at rules', () => {
    const t = new SortedMap<number, number>()
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
    expect(new SortedMap().at(0)).toBeUndefined()
    const sm = new SortedMap([
      [2, 'b'],
      [1, 'a']
    ])
    expect(sm.at(0)).toEqual([1, 'a'])
  })

  it('bulk load compares sorted input in linear time, and the last duplicate wins', () => {
    let calls = 0
    const cmp = (a: number, b: number) => {
      calls++
      return a - b
    }
    const sorted = Array.from({ length: 10_000 }, (_, i) => [i, i] as [number, number])
    calls = 0
    const t = new SortedMap(sorted, cmp)
    // one self-compare per key, one compare per adjacent pair
    expect(calls).toBe(19_999)
    checkSortedMap(t)
    const u = new SortedMap([
      [2, 'a'],
      [1, 'x'],
      [2, 'b']
    ])
    expect([...u]).toEqual([
      [1, 'x'],
      [2, 'b']
    ])
    const adjacentDuplicates = new SortedMap([
      [1, 'a'],
      [1, 'b']
    ])
    expect([...adjacentDuplicates]).toEqual([[1, 'b']])
    const nothing = new SortedMap<number, string>([])
    nothing.set(1, 'a')
    expect([...nothing]).toEqual([[1, 'a']])
  })

  it.each([false, true])('iteration under mutation fuzz (reverse: %s)', (reverse) => {
    const rnd = seededRandom(7)
    const t = new SortedMap<number, number>()
    const model = new Map<number, number>()
    for (let i = 0; i < 100; i++) {
      t.set(i, i)
      model.set(i, i)
    }
    const counts = { insert: 0, delete: 0, hit: 0, miss: 0, clear: 0 }
    let last: number | undefined
    const iter = reverse ? t.entriesDescending() : t.entries()
    for (let step = 0; step < 200; step++) {
      const ordered = [...model].sort((a, b) => (reverse ? b[0] - a[0] : a[0] - b[0]))
      const expected = ordered.find(
        ([key]) => last === undefined || (reverse ? key < last : key > last)
      )
      const next = iter.next()
      expect(next.value).toStrictEqual(expected)
      expect(next.done).toBe(expected === undefined)
      if (next.done) break
      last = next.value[0]
      const op = rnd() % 5
      const key = (rnd() % 200) - 50
      if (op === 0) {
        if (!model.has(key)) counts.insert++
        t.set(key, step)
        model.set(key, step)
      } else if (op === 1) {
        const victim = ordered[rnd() % ordered.length][0]
        expect(t.delete(victim)).toBe(model.delete(victim))
        counts.delete++
      } else if (op === 2) {
        counts[model.has(key) ? 'hit' : 'miss']++
        expect(t.get(key)).toBe(model.get(key))
      } else if (
        op === 3 &&
        step > 20 &&
        counts.insert &&
        counts.delete &&
        counts.hit &&
        counts.miss
      ) {
        t.clear()
        model.clear()
        counts.clear++
      }
      expect([...t]).toStrictEqual([...model].sort((a, b) => a[0] - b[0]))
    }
    for (const [kind, count] of Object.entries(counts)) expect(count, kind).toBeGreaterThan(0)
    expect([...t]).toStrictEqual([...model].sort((a, b) => a[0] - b[0]))
    checkSortedMap(t)
  })

  it('key-object replacement refreshes separators', () => {
    interface K {
      id: number
      tag?: string
    }
    const t = new SortedMap<K, string>(undefined, (a, b) => a.id - b.id)
    for (let id = 0; id < 132; id++) t.set({ id }, 'v')
    for (const id of [31, 32, 131]) {
      t.set({ id, tag: 'new' }, 'x')
      checkSortedMap(t)
      expect([...t.keys()][id]?.tag).toBe('new')
    }
  })

  it('rejects a comparator that does not return 0 for a key against itself', () => {
    for (const cmp of [neverEqual, selfLess]) {
      expect(() => new SortedMap([[1, 'a']], cmp)).toThrow(SELF_COMPARE_ERROR)
      const t = new SortedMap<number, string>(undefined, cmp)
      expect(() => t.set(1, 'a')).toThrow(SELF_COMPARE_ERROR)
      expect(t.size).toBe(0)
    }
  })

  it('rejects a key the comparator cannot order before it enters an empty tree', () => {
    const subtract = (a: unknown, b: unknown) => Number(a) - Number(b)
    const t = new SortedMap<unknown, number>(undefined, subtract)

    for (const bad of [Number.NaN, Infinity, undefined]) {
      expect(() => t.set(bad, 1)).toThrow(FINITE_ERROR)
      expect(() => new SortedMap([[bad, 1]], subtract)).toThrow(FINITE_ERROR)
    }

    expect(t.size).toBe(0)
    t.set(1, 1)
    expect([...t]).toEqual([[1, 1]])
  })

  it('rejects items that are not entries, as native Map does', () => {
    expect(() => new SortedMap(JSON.parse('[1,2,3]') as never)).toThrow(ENTRY_ERROR)
    expect(() => new SortedMap(JSON.parse('["ab","cd"]') as never)).toThrow(ENTRY_ERROR)
    expect(() => new SortedMap('hey' as never)).toThrow(ENTRY_ERROR)
    expect(() => new SortedMap([null] as never)).toThrow(ENTRY_ERROR)
    expect([...new SortedMap([[1]] as never)]).toEqual([[1, undefined]])
  })

  it('treats null entries as none, as native Map does', () => {
    expect(new SortedMap(null).size).toBe(0)
  })

  it('shallow clones keep the subclass and comparator', () => {
    class Tree extends SortedMap<number, string> {}
    const pairs = Array.from({ length: 128 }, (_, i) => [i, String(i)] as [number, string])
    const t = new Tree(pairs, (a, b) => b - a)

    const copy = t.clone()
    expect(copy).toBeInstanceOf(Tree)
    checkSortedMap(copy)
    expect([...copy]).toEqual([...t])
    for (let i = 128; i < 192; i++) copy.set(i, String(i))
    checkSortedMap(copy)
    expect([...copy.keys()].slice(0, 3)).toEqual([191, 190, 189])
    expect(t.size).toBe(128)
  })

  it('clone throws TypeError when a subclass constructor does not pass its arguments on', () => {
    class Reordered extends SortedMap<number, number> {
      constructor(
        entries?: Iterable<readonly [number, number]> | null,
        options?: { compare?: (a: number, b: number) => number }
      ) {
        super(entries, options?.compare)
      }
    }
    const pairs = Array.from({ length: 100 }, (_, i) => [i, i] as [number, number])
    const source = new Reordered(pairs, { compare: (a, b) => b - a })
    expect(() => source.clone()).toThrow(TypeError)
    expect(source.get(5)).toBe(5)
    checkSortedMap(source)
  })

  it('iteration sees a value replaced in a leaf shared with a clone', () => {
    const map = new SortedMap([
      [1, 'old'],
      [2, 'old'],
      [3, 'old']
    ])
    map.clone()
    const seen: [number, string][] = []
    for (const [k, v] of map) {
      seen.push([k, v])
      if (k === 1) map.set(2, 'new')
    }
    expect(seen).toEqual([
      [1, 'old'],
      [2, 'new'],
      [3, 'old']
    ])
  })

  it('at and clone do not compare keys', () => {
    let compares = 0
    const t = new SortedMap<number, number>(
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

    t.at(1)
    t.clone()

    expect(compares).toBe(0)
  })

  it('an explicit undefined start means omitted, even with an undefined key', () => {
    const numbers = new SortedMap([
      [1, 'a'],
      [2, 'b']
    ])
    const walk = (from?: number) => numbers.entries(from)
    const undefinedFirst = new SortedMap<number | undefined, string>(
      [
        [1, 'a'],
        [undefined, 'u']
      ],
      (a, b) => (a ?? -1) - (b ?? -1)
    )
    const withUndefinedLast = new SortedMap<number | undefined, string>(
      [
        [1, 'a'],
        [undefined, 'u']
      ],
      undefinedLast
    )

    expect([...walk()]).toEqual([...numbers])
    expect([...withUndefinedLast.entries(undefined)]).toEqual([
      [1, 'a'],
      [undefined, 'u']
    ])
    expect([...undefinedFirst.entriesDescending(undefined)]).toEqual([
      [1, 'a'],
      [undefined, 'u']
    ])
  })

  it('keeps values aligned when a leaf of undefined values merges with its sibling', () => {
    const tree = new SortedMap<number, string | undefined>()
    for (let i = 0; i < 64; i++) {
      tree.set(i, undefined)
    }
    tree.set(64, 'last')
    tree.delete(0)
    tree.delete(1)
    expect([...tree]).toStrictEqual([
      ...Array.from({ length: 62 }, (_, i) => [i + 2, undefined]),
      [64, 'last']
    ])
    checkSortedMap(tree)
  })

  it('iterates an undefined key in comparator order', () => {
    const tree = new SortedMap<number | undefined, string>(
      undefined,
      (x, y) => (x ?? -1) - (y ?? -1)
    )
    tree.set(1, 'one')
    tree.set(undefined, 'none')
    expect([...tree]).toStrictEqual([
      [undefined, 'none'],
      [1, 'one']
    ])
    expect([...new SortedMap([[undefined, 'only']], () => 0)]).toStrictEqual([[undefined, 'only']])
  })

  it('entriesDescending starts at the last key when that key is undefined', () => {
    const tree = new SortedMap<number | undefined, number | undefined>(
      undefined,
      (x, y) => (x ?? 1000) - (y ?? 1000)
    )
    const keys = [...Array(160).keys(), undefined]
    for (const key of keys) {
      tree.set(key, key)
    }
    expect([...tree.entriesDescending()].map(([key]) => key)).toStrictEqual(keys.toReversed())
    expect([...new SortedMap([[undefined, 'only']], () => 0).entriesDescending()]).toStrictEqual([
      [undefined, 'only']
    ])
    expect([...new SortedMap().entriesDescending()]).toStrictEqual([])
  })

  it('lastKey returns the key object set last', () => {
    const tree = new SortedMap<{ id: number }, number | string>(undefined, (x, y) => x.id - y.id)
    for (let id = 0; id < 160; id++) {
      tree.set({ id }, id)
    }
    const replacement = { id: 159 }
    tree.set(replacement, 'new')
    expect(tree.lastKey()).toBe(replacement)
  })

  it('rank counts the keys before a key, present or not', () => {
    const tree = new SortedMap<number, number>()
    const keys: number[] = []
    for (let k = 0; k < 600; k += 3) {
      tree.set(k, k)
      keys.push(k)
    }
    for (let probe = -2; probe < 605; probe++) {
      const expected = keys.filter((k) => k < probe).length
      expect(tree.rank(probe)).toBe(expected)
      if (tree.has(probe)) expect(tree.at(tree.rank(probe))?.[0]).toBe(probe)
    }
    expect(new SortedMap().rank(1)).toBe(0)
    const copy = tree.clone()
    copy.delete(0)
    expect(copy.rank(3)).toBe(0)
    expect(tree.rank(3)).toBe(1)
  })

  it('iterates like a Map, in key order', () => {
    const map = new SortedMap([
      ['b', 2],
      ['a', 1]
    ])
    expect([...map]).toEqual([
      ['a', 1],
      ['b', 2]
    ])
    const seen: unknown[] = []
    map.forEach(function (this: unknown, value, key, m) {
      seen.push([value, key, m === map, this])
    }, 'ctx')
    expect(seen).toEqual([
      [1, 'a', true, 'ctx'],
      [2, 'b', true, 'ctx']
    ])
    expect(new Map(map)).toEqual(
      new Map([
        ['a', 1],
        ['b', 2]
      ])
    )
    expect(Object.prototype.toString.call(map)).toBe('[object SortedMap]')
    expect(Reflect.ownKeys(map)).toEqual([])
  })

  it('accepts readonly entries, as Map does', () => {
    const entries: ReadonlyArray<readonly [number, string]> = [[1, 'a']]
    expect([...new SortedMap(entries)]).toEqual([[1, 'a']])
  })
})
