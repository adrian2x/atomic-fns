import { describe, expect, it } from 'vitest'
import { SortedMap } from '../src/collections/SortedMap.js'
import { decimal } from '../src/decimal/index.js'
import { compare } from '../src/operators/index.js'

describe('SortedMap', () => {
  it('SPEC-R78 empty size and iteration', () => {
    const m = new SortedMap<number, number>()
    expect(m.size).toBe(0)
    expect([...m]).toEqual([])
    expect(m.min()).toBeUndefined()
    expect(m.max()).toBeUndefined()
  })

  it('SPEC-R78 initialized entries stay ordered', () => {
    const entries: [number, number][] = [
      [5, 5],
      [4, 4],
      [3, 3],
      [1, 1],
      [2, 2]
    ]
    const m = new SortedMap(entries)
    expect(m.size).toBe(5)
    expect([...m.keys()]).toEqual([1, 2, 3, 4, 5])
    expect([...m.values()]).toEqual([1, 2, 3, 4, 5])
  })

  it('SPEC-R78 set returns this and replaces value', () => {
    const m = new SortedMap([[1, 'a']])
    expect(m.set(1, 'b')).toBe(m)
    expect(m.get(1)).toBe('b')
    expect(m.size).toBe(1)
  })

  it('SPEC-R78 set replaces stored key object', () => {
    interface K {
      id: number
      tag: string
    }
    const cmp = (a: K, b: K) => a.id - b.id
    const m = new SortedMap<K, string>(undefined, cmp)
    const a = { id: 1, tag: 'a' }
    const b = { id: 1, tag: 'b' }
    m.set(a, 'first')
    m.set(b, 'second')
    expect(m.size).toBe(1)
    expect(m.get(a)).toBe('second')
    expect([...m.keys()][0]).toBe(b)
    expect([...m.keys()][0].tag).toBe('b')
  })

  it('SPEC-R78 Decimal keys stay distinct from numbers', () => {
    const m = new SortedMap()
    m.set(decimal(1), 'd')
    m.set(1, 'n')
    expect(m.size).toBe(2)
    expect(m.get(decimal(1))).toBe('d')
    expect(m.get(1)).toBe('n')
    expect(m.has(decimal(1))).toBe(true)
    expect(m.has(1)).toBe(true)
  })

  it('SPEC-R78 has get delete clear min max keys values entries', () => {
    const m = new SortedMap<number, number>()
    for (let i = 10; i > 0; i--) {
      m.set(i, i * 2)
      expect(m.get(i)).toBe(i * 2)
      expect(m.has(i)).toBe(true)
    }
    expect(m.size).toBe(10)
    expect(m.min()).toBe(1)
    expect(m.max()).toBe(10)
    expect([...m.keys()]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect([...m.values()]).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20])
    expect([...m.entries()]).toEqual([
      [1, 2],
      [2, 4],
      [3, 6],
      [4, 8],
      [5, 10],
      [6, 12],
      [7, 14],
      [8, 16],
      [9, 18],
      [10, 20]
    ])
    expect(m.delete(5)).toBe(true)
    expect(m.has(5)).toBe(false)
    expect(m.delete(5)).toBe(false)
    m.clear()
    expect(m.size).toBe(0)
    expect(m.has(1)).toBe(false)
  })

  it('SPEC-R78 entriesReversed yields descending keys', () => {
    const m = new SortedMap<number, number>()
    const expected: [number, number][] = []
    for (let i = 100; i > 0; i--) {
      m.set(i, i)
      expected.push([i, i])
    }
    expect([...m.entriesReversed()]).toEqual(expected)
  })

  it('SPEC-R78 freeze blocks mutators and unfreeze restores', () => {
    const m = new SortedMap<number, number>()
    for (let i = 10; i > 0; i--) m.set(i, i)
    m.freeze()
    expect(() => m.set(11, 11)).toThrow(TypeError)
    expect(() => m.set(11, 11)).toThrow('BTree is frozen')
    expect(() => m.delete(1)).toThrow('BTree is frozen')
    expect(() => {
      m.clear()
    }).toThrow('BTree is frozen')
    expect(m.has(1)).toBe(true)
    expect(m.get(1)).toBe(1)
    m.unfreeze()
    m.set(11, 11)
    expect(m.get(11)).toBe(11)
    expect(m.size).toBe(11)
  })

  it('SPEC-R78 freeze without prior sets still blocks set', () => {
    const m = new SortedMap<number, string>()
    m.freeze()
    expect(() => m.set(1, 'a')).toThrow('BTree is frozen')
    m.unfreeze()
    m.set(1, 'a')
    expect(m.get(1)).toBe('a')
  })

  it('SPEC-R78 differential vs Map + sort over 20000 ops', () => {
    const sorted = new SortedMap<number, number>()
    const ref = new Map<number, number>()
    let seed = 1
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) >>> 0
      return seed
    }
    for (let op = 0; op < 20_000; op++) {
      const kind = rnd() % 4
      const key = rnd() % 500
      if (kind === 0) {
        const val = rnd() % 1000
        sorted.set(key, val)
        ref.set(key, val)
      } else if (kind === 1) {
        expect(sorted.delete(key)).toBe(ref.delete(key))
      } else if (kind === 2) {
        expect(sorted.has(key)).toBe(ref.has(key))
        expect(sorted.get(key)).toBe(ref.get(key))
      } else {
        const fromMap = [...ref.entries()].sort((a, b) => compare(a[0], b[0]))
        expect([...sorted.entries()]).toEqual(fromMap)
        expect(sorted.size).toBe(ref.size)
        if (ref.size > 0) {
          const keys = fromMap.map((e) => e[0])
          expect(sorted.min()).toBe(keys[0])
          expect(sorted.max()).toBe(keys[keys.length - 1])
        } else {
          expect(sorted.min()).toBeUndefined()
          expect(sorted.max()).toBeUndefined()
        }
      }
    }
    const final = [...ref.entries()].sort((a, b) => compare(a[0], b[0]))
    expect([...sorted.entries()]).toEqual(final)
    expect(sorted.size).toBe(ref.size)
  })

  it('SPEC-R78 undefined key appears in entriesReversed and toArray-style iteration', () => {
    const m = new SortedMap<number | undefined, string>()
    m.set(1, 'a').set(undefined, 'u').set(0, 'z')
    const forward = [...m.entries()]
    expect(forward).toHaveLength(3)
    expect([...m.entriesReversed()]).toEqual([...forward].reverse())
    expect([...m.entriesReversed()].some(([k, v]) => k === undefined && v === 'u')).toBe(true)
    expect(m.has(undefined)).toBe(true)
    expect(m.get(undefined)).toBe('u')
    expect(m.max()).toBeUndefined()
    expect(m.size).toBe(3)
  })
})
