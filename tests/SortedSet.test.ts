import { describe, expect, it } from 'vitest'
import { SortedSet } from '../src/collections/SortedSet.js'
import { decimal } from '../src/decimal/index.js'

describe('SortedSet', () => {
  it('SPEC-R78 empty size and iteration', () => {
    const s = new SortedSet<number>()
    expect(s.size).toBe(0)
    expect([...s]).toEqual([])
    expect(s.min()).toBeUndefined()
    expect(s.max()).toBeUndefined()
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
    type V = { id: number; tag: string }
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
    type V = { id: number }
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
})
