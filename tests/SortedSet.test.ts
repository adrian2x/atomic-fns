import { describe, expect, it } from 'vitest'
import { clone } from '../src/collections/object.js'
import { SortedSet } from '../src/collections/SortedSet.js'
import { decimal } from '../src/decimal/index.js'
import { deepEqual } from '../src/operators/index.js'
import { expectFast } from './helpers/perf.js'

describe('SortedSet', () => {
  it('SPEC-R78 empty size and iteration', () => {
    const s = new SortedSet<number>()
    expect(s.size).toBe(0)
    expect([...s]).toEqual([])
    expect(s.min()).toBeUndefined()
    expect(s.max()).toBeUndefined()
  })

  it('rejects length-driven array-likes before allocating', () => {
    const evil = JSON.parse('{"length":4294967295}') as never
    expectFast(() => {
      expect(() => new SortedSet(evil)).toThrow(TypeError)
    }, 1000)
  })

  it('SPEC-R78 initialized values stay ordered', () => {
    const s = new SortedSet([5, 4, 3, 1, 2])
    expect(s.size).toBe(5)
    expect([...s.values()]).toEqual([1, 2, 3, 4, 5])
  })

  it('SPEC-R78 Decimal values size and order', () => {
    const s = new SortedSet([decimal(3), decimal(1)])
    expect(s.size).toBe(2)
    expect([...s].map(String)).toEqual(['1', '3'])
  })

  it('SPEC-R78 Decimal distinct from number (D12)', () => {
    const s = new SortedSet<unknown>([decimal(1)])
    expect(s.has(decimal(1))).toBe(true)
    expect(s.has(1)).toBe(false)
    s.add(1)
    expect(s.size).toBe(2)
  })

  it('SPEC-R78 add of existing value is a no-op', () => {
    interface V {
      id: number
      tag: string
    }
    const cmp = (a: V, b: V) => a.id - b.id
    const s = new SortedSet<V>(undefined, cmp)
    const a = { id: 1, tag: 'a' }
    const b = { id: 1, tag: 'b' }
    s.add(a)
    s.add(b)
    expect(s.size).toBe(1)
    expect([...s.values()][0]).toBe(a)
    expect([...s.values()][0].tag).toBe('a')
  })

  it('SPEC-R78 add has delete clear min max', () => {
    const s = new SortedSet<number>()
    for (let i = 10; i > 0; i--) {
      s.add(i)
      expect(s.has(i)).toBe(true)
    }
    expect(s.size).toBe(10)
    expect(s.min()).toBe(1)
    expect(s.max()).toBe(10)
    expect(s.delete(5)).toBe(true)
    expect(s.has(5)).toBe(false)
    expect(s.delete(5)).toBe(false)
    s.clear()
    expect(s.size).toBe(0)
    expect(s.has(1)).toBe(false)
  })

  it('SPEC-R78 custom comparator delete', () => {
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

  it('SPEC-R78 Set.union interoperates with SortedSet', () => {
    const out = new Set([1]).union(new SortedSet([2]))
    expect([...out].sort()).toEqual([1, 2])
  })

  it('SPEC-R78 values yields ascending order', () => {
    const s = new SortedSet<number>()
    for (let i = 1; i <= 5; i++) s.add(i * 2)
    expect([...s.values()]).toEqual([2, 4, 6, 8, 10])
  })

  it('SPEC-R78 entriesDescending yields descending [value, value] pairs', () => {
    const s = new SortedSet([3, 1, 2])
    expect([...s.entriesDescending()]).toEqual([
      [3, 3],
      [2, 2],
      [1, 1]
    ])
    expect([...new SortedSet<number>().entriesDescending()]).toEqual([])
  })

  it('SPEC-R78 entriesDescending includes an undefined value', () => {
    const s = new SortedSet<number | undefined>([1, undefined, 0])
    expect([...s.entriesDescending()]).toEqual([...s.entries()].reverse())
    expect([...s.entriesDescending()].some(([v]) => v === undefined)).toBe(true)
  })

  it('SPEC-R78 freeze rejects mutators permanently', () => {
    const s = new SortedSet([1, 2])
    expect(s.freeze()).toBe(s)
    expect(() => s.add(3)).toThrow('SortedSet is frozen')
    expect(() => s.add(2)).toThrow('SortedSet is frozen')
    expect(() => s.delete(1)).toThrow('SortedSet is frozen')
    expect(() => {
      s.clear()
    }).toThrow('SortedSet is frozen')
    expect([...s]).toEqual([1, 2])
    expect(s.has(1)).toBe(true)
    expect(s.isFrozen).toBe(true)
    expect(new SortedSet().isFrozen).toBe(false)
  })

  it('keeps identity-ordered values in first-seen order, as add does', () => {
    const [a, b] = [{ n: 1 }, { n: 2 }]
    const added = new SortedSet<{ n: number }>()
    added.add({ n: 1 })
    added.add({ n: 2 })

    expect([...new SortedSet([a, b])]).toEqual([a, b])
    expect([...added]).toEqual([a, b])
  })

  it('a deep clone keeps the sequence of identity-ordered values', () => {
    const s = new SortedSet([{ a: 1 }, { a: 2 }, { a: 3 }])
    const nested = new SortedSet([[1], [2]])

    expect([...clone(s, true)]).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }])
    expect(deepEqual(s, clone(s, true))).toBe(true)
    expect(deepEqual(nested, clone(nested, true))).toBe(true)
  })

  it('clones keep the subclass and comparator', () => {
    class Reversed extends SortedSet<number> {}
    const s = new Reversed([1, 2], (a, b) => b - a)

    for (const copy of [clone(s), clone(s, true)]) {
      expect(copy).toBeInstanceOf(Reversed)
      expect(deepEqual(s, copy)).toBe(true)
      expect([...copy.add(3)]).toEqual([3, 2, 1])
    }
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
})
