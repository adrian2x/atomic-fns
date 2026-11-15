import { describe, expect, it } from 'vitest'
import { SortedSet } from '../../src/collections/index.ts'
import { checkSortedMap } from '../../src/collections/internal/invariants.ts'
import { createSetMap, insertIfAbsent } from '../../src/collections/sorted-map.ts'

describe('SortedSet', () => {
  it('empty size and iteration', () => {
    const s = new SortedSet<number>()
    expect(s.size).toBe(0)
    expect([...s]).toEqual([])
    expect(s.first()).toBeUndefined()
    expect(s.last()).toBeUndefined()
  })

  it('rejects length-driven array-likes before allocating', () => {
    const evil = JSON.parse('{"length":4294967295}') as never
    expect(() => new SortedSet(evil)).toThrow(TypeError)
  })

  it('initialized values stay ordered', () => {
    const s = new SortedSet([5, 4, 3, 1, 2])
    expect(s.size).toBe(5)
    expect([...s.values()]).toEqual([1, 2, 3, 4, 5])
  })

  it('add has delete clear first last', () => {
    const s = new SortedSet<number>()
    for (let i = 10; i > 0; i--) {
      expect(s.add(i)).toBe(s)
      expect(s.has(i)).toBe(true)
    }
    expect(s.size).toBe(10)
    expect(s.first()).toBe(1)
    expect(s.last()).toBe(10)
    expect(s.delete(5)).toBe(true)
    expect(s.has(5)).toBe(false)
    expect(s.delete(5)).toBe(false)
    s.clear()
    expect(s.size).toBe(0)
    expect(s.has(1)).toBe(false)
  })

  it('custom comparator delete', () => {
    interface V {
      id: number
    }
    const cmp = (a: V, b: V) => a.id - b.id
    const s = new SortedSet([{ id: 1 }, { id: 2 }, { id: 3 }], cmp)
    expect(s.delete({ id: 2 })).toBe(true)
    expect(s.size).toBe(2)
    expect(s.has({ id: 2 })).toBe(false)
    expect(s.delete({ id: 9 })).toBe(false)
    expect([...s].map((x) => x.id)).toEqual([1, 3])
  })

  it('Set.union interoperates with SortedSet', () => {
    const out = new Set([1]).union(new SortedSet([2]))
    expect([...out].sort()).toEqual([1, 2])
  })

  it('valuesDescending yields the values largest first', () => {
    const s = new SortedSet([3, 1, 2])
    expect([...s.valuesDescending()]).toEqual([3, 2, 1])
    expect([...new SortedSet<number>().valuesDescending()]).toEqual([])
  })

  it('the default comparator rejects null and NaN', () => {
    expect(() => new SortedSet<number | null>([1, null])).toThrow(TypeError)
    expect(() => new SortedSet([1, Number.NaN])).toThrow(RangeError)
  })

  it('an undefined value needs a comparator that orders it', () => {
    expect(() => new SortedSet<number | undefined>([1, undefined])).toThrow(/pass a comparator/)
    const undefinedLast = (a: number | undefined, b: number | undefined): number =>
      a === undefined ? (b === undefined ? 0 : 1) : b === undefined ? -1 : a - b
    const s = new SortedSet<number | undefined>([1, undefined, 0], undefinedLast)
    expect([...s]).toEqual([0, 1, undefined])
    expect([...s.valuesDescending()]).toEqual([undefined, 1, 0])
  })

  it('stores -0 as +0, as native Set does', () => {
    const viaConstructor = new SortedSet([-0, 0])
    const viaAdd = new SortedSet<number>().add(-0)

    for (const s of [viaConstructor, viaAdd]) {
      expect(Object.is(s.at(0), 0)).toBe(true)
      expect(s.size).toBe(1)
      expect(s.has(-0)).toBe(true)
    }
  })

  it('treats only null and undefined as no values, as native Set does', () => {
    expect(new SortedSet<number>(null).size).toBe(0)
    expect(new SortedSet('').size).toBe(0)
    for (const notIterable of [0, false, 1]) {
      expect(() => new SortedSet(notIterable as never)).toThrow('expected an iterable')
    }
  })

  it('refuses a huge sparse array before walking its holes', () => {
    let compares = 0
    const counting = () => {
      if (++compares > 1000) throw new Error('walked the holes')
      return 0
    }

    expect(() => new SortedSet(new Array<number>(2 ** 32 - 1), counting)).toThrow(
      'sparse array too large'
    )
  })

  it('answers order and position queries', () => {
    const s = new SortedSet([10, 20, 30, 40])
    expect([s.lower(20), s.higher(20), s.floor(25), s.ceiling(25)]).toEqual([10, 30, 20, 30])
    expect([s.floor(20), s.ceiling(20)]).toEqual([20, 20])
    expect([s.lower(10), s.higher(40)]).toEqual([undefined, undefined])
    expect([s.at(0), s.at(-1), s.at(9)]).toEqual([10, 40, undefined])
    expect([s.rank(10), s.rank(25), s.rank(99)]).toEqual([0, 2, 4])
    expect(s.valuesBetween(20, 40)).toEqual([20, 30])
    expect(s.valuesBetween(20, 40, { inclusiveEnd: true })).toEqual([20, 30, 40])
    expect(s.valuesBetween(20, 40, { limit: 1 })).toEqual([20])
    expect(() => s.valuesBetween(20, 40, { limit: '1' as never })).toThrow(TypeError)
    expect(() => s.valuesBetween(20, 40, { limit: -1 })).toThrow(RangeError)
  })

  it('keeps the first of two values the comparator calls equal', () => {
    const byId = (a: { id: number }, b: { id: number }): number => a.id - b.id
    const first = { id: 1, tag: 'first' }
    const s = new SortedSet([first, { id: 1, tag: 'second' }], byId)
    expect(s.first()).toBe(first)
    expect(s.add({ id: 1, tag: 'third' })).toBe(s)
    expect(s.first()).toBe(first)
    expect(s.add(first)).toBe(s)
    expect(s.size).toBe(1)
    expect(s.first()).toBe(first)
    expect(s.has({ id: 1, tag: 'other' })).toBe(true)
    expect(() => new SortedSet([{ id: 2 }, { id: 1 }])).toThrow(/pass a comparator/)
  })

  it('adds a missing value with one search', () => {
    let comparisons = 0
    const s = new SortedSet(
      Array.from({ length: 512 }, (_, i) => i * 2),
      (a, b) => {
        comparisons++
        return a - b
      }
    )
    comparisons = 0
    expect(s.has(513)).toBe(false)
    const searchComparisons = comparisons
    comparisons = 0

    expect(s.add(513)).toBe(s)

    expect(comparisons).toBe(searchComparisons + 1)
    expect(s.size).toBe(513)
    expect(s.at(257)).toBe(513)
  })

  it.each(['search', 'self'] as const)(
    'keeps its values when the %s comparison throws',
    (stage) => {
      let fail = false
      const values = Array.from({ length: 512 }, (_, i) => i * 2)
      const s = new SortedSet(values, (a, b) => {
        if (fail && (stage === 'self' ? a === b : a !== b)) throw new Error('cannot compare')
        return a - b
      })
      fail = true

      expect(() => s.add(513)).toThrow('cannot compare')

      expect(s.size).toBe(512)
      expect([...s]).toEqual(values)
    }
  )

  it('key-only clones stay independent through splits and merges', () => {
    const n = 8192
    let comparisons = 0
    const values = Array.from({ length: n }, (_, i) => i)
    const map = createSetMap(values, (a, b) => {
      comparisons++
      return a - b
    })
    comparisons = 0
    const copy = map.clone()
    expect(comparisons).toBe(0)

    for (let i = n; i < n + 128; i++) expect(insertIfAbsent(map, i, true)).toBe(true)
    for (let i = -128; i < 0; i++) expect(insertIfAbsent(copy, i, true)).toBe(true)
    expect(insertIfAbsent(copy, 0, true)).toBe(false)
    checkSortedMap(map)
    checkSortedMap(copy)
    expect(map.has(-1)).toBe(false)
    expect(copy.has(n)).toBe(false)
    for (let i = 0; i < n + 127; i++) map.delete(i)
    for (let i = n - 1; i >= 0; i--) copy.delete(i)

    expect([...map.keys()]).toEqual([n + 127])
    expect([...copy.keys()]).toEqual(Array.from({ length: 128 }, (_, i) => i - 128))
    checkSortedMap(map)
    checkSortedMap(copy)
    copy.clear()
    insertIfAbsent(copy, 9, true)
    expect([...copy]).toEqual([[9, true]])
    checkSortedMap(copy)
  })

  it('iterates like a Set, in order', () => {
    const s = new SortedSet(['b', 'a'])
    expect([...s.keys()]).toEqual(['a', 'b'])
    expect([...s.entries()]).toEqual([
      ['a', 'a'],
      ['b', 'b']
    ])
    const seen: unknown[] = []
    s.forEach(function (this: unknown, value, key, set) {
      seen.push([value, key, set === s, this])
    }, 'ctx')
    expect(seen).toEqual([
      ['a', 'a', true, 'ctx'],
      ['b', 'b', true, 'ctx']
    ])
    expect(new Set(s)).toEqual(new Set(['a', 'b']))
    expect(Object.prototype.toString.call(s)).toBe('[object SortedSet]')
    expect(Reflect.ownKeys(s)).toEqual([])
  })

  it('reads an array through its own Symbol.iterator', () => {
    const custom = Object.defineProperty([3, 1], Symbol.iterator, {
      value: function* () {
        yield 9
        yield 2
      }
    })
    expect([...new SortedSet(custom)]).toEqual([2, 9])
  })
})
