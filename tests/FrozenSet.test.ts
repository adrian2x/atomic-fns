import { describe, expect, it } from 'vitest'
import { FrozenSet } from '../src/collections/frozenset.js'

describe('FrozenSet', () => {
  it('SPEC-R76 constructor order populates via super.add then freezes', () => {
    const fs = new FrozenSet([1, 2, 3])
    expect(fs.size).toBe(3)
    expect(fs.has(1)).toBe(true)
    expect(fs.has(2)).toBe(true)
    expect(fs.has(3)).toBe(true)
    expect(fs instanceof Set).toBe(true)
  })

  it('SPEC-R76 nullish iterable yields empty', () => {
    expect(new FrozenSet().size).toBe(0)
    expect(new FrozenSet(null).size).toBe(0)
  })

  it('SPEC-R76 mutators throw TypeError', () => {
    const fs = new FrozenSet([1, 2, 3])
    expect(() => fs.add(4)).toThrow(TypeError)
    expect(() => fs.add(4)).toThrow('FrozenSet is immutable')
    expect(() => fs.delete(1)).toThrow(TypeError)
    expect(() => fs.clear()).toThrow(TypeError)
    expect(fs.size).toBe(3)
    expect(fs.has(1)).toBe(true)
  })

  it('SPEC-R76 union inherits ES2025 Set methods', () => {
    const fs = new FrozenSet([1, 2, 3])
    const u = fs.union(new Set([4]))
    expect(u).toBeInstanceOf(Set)
    expect(u).not.toBeInstanceOf(FrozenSet)
    expect(u.size).toBe(4)
    expect([...u].sort()).toEqual([1, 2, 3, 4])
  })

  it('SPEC-R76 Set.prototype.add.call still mutates (documented limit)', () => {
    const fs = new FrozenSet([1])
    Set.prototype.add.call(fs, 2)
    expect(fs.has(2)).toBe(true)
    expect(fs.size).toBe(2)
  })

  it('SPEC-R76 toStringTag is FrozenSet', () => {
    expect(Object.prototype.toString.call(new FrozenSet())).toBe('[object FrozenSet]')
  })
})
