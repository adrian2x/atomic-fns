import { describe, expect, it } from 'vitest'
import { FrozenSet } from '../src/collections/frozenset.js'
import { clone } from '../src/collections/index.js'
import { deepEqual } from '../src/operators/index.js'

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
    expect(() => {
      fs.clear()
    }).toThrow(TypeError)
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

  it('compares object members deeply, so a deep clone equals its source', () => {
    const rows = new FrozenSet([{ a: 1 }, { a: 2 }])
    expect(deepEqual(rows, clone(rows, true))).toBe(true)
    expect(deepEqual(rows, new FrozenSet([{ a: 2 }, { a: 1 }]))).toBe(true)
    expect(deepEqual(rows, new FrozenSet([{ a: 1 }, { a: 3 }]))).toBe(false)
    const nested = (): FrozenSet => new FrozenSet([new FrozenSet([1])])
    expect(deepEqual(nested(), nested())).toBe(true)
  })

  it('honors a custom array iterator, as new Set does', () => {
    class Custom extends Array<number> {
      override *[Symbol.iterator](): ArrayIterator<number> {
        yield 9
      }
    }
    const custom = Custom.from([1, 2])
    expect([...new FrozenSet(custom)]).toEqual([...new Set(custom)])
  })

  it('walks holes of a huge sparse array once', () => {
    expect(new FrozenSet(new Array(2 ** 32 - 1)).size).toBe(1)
  })
})
