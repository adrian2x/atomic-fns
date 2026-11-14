import { describe, expect, it } from 'vitest'
import { FrozenSet } from '../../src/collections/index.ts'

describe('FrozenSet', () => {
  it('holds the distinct items it was built from and is a Set', () => {
    const fs = new FrozenSet([1, 2, 2, 3])
    expect(fs.size).toBe(3)
    expect([...fs]).toEqual([1, 2, 3])
    expect(fs instanceof Set).toBe(true)
  })

  it('toStringTag is FrozenSet and lives on the prototype', () => {
    const fs = new FrozenSet([1])
    expect(Object.prototype.toString.call(fs)).toBe('[object FrozenSet]')
    expect(Object.prototype.toString.call(new FrozenSet())).toBe('[object FrozenSet]')
    expect(Reflect.ownKeys(fs)).toEqual([])
  })

  it('nullish iterable yields empty', () => {
    expect(new FrozenSet().size).toBe(0)
    expect(new FrozenSet(null).size).toBe(0)
  })

  it('rejects a non-iterable with TypeError', () => {
    expect(() => new FrozenSet(1 as never)).toThrow(TypeError)
    expect(() => new FrozenSet(JSON.parse('{"length":4294967295}') as never)).toThrow(TypeError)
  })

  it('mutators throw TypeError', () => {
    const fs = new FrozenSet([1, 2, 3])
    expect(() => fs.add(4)).toThrow(new TypeError('FrozenSet is immutable'))
    expect(() => fs.delete(1)).toThrow(TypeError)
    expect(() => {
      fs.clear()
    }).toThrow(TypeError)
    expect([...fs]).toEqual([1, 2, 3])
  })

  it('union returns a plain mutable Set', () => {
    const fs = new FrozenSet([1, 2, 3])
    const u = fs.union(new Set([4]))
    expect(u).toBeInstanceOf(Set)
    expect(u).not.toBeInstanceOf(FrozenSet)
    expect(u.size).toBe(4)
    expect([...u].sort()).toEqual([1, 2, 3, 4])
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

  it('builds a 2^32-1-length hole array as one undefined', () => {
    expect([...new FrozenSet(new Array(2 ** 32 - 1))]).toEqual([undefined])
  })

  it('builds a sparse array as new Set does', () => {
    const shortGap: number[] = [1]
    shortGap[2] = 3
    expect([...new FrozenSet(shortGap)]).toEqual([...new Set(shortGap)])

    const longGap: number[] = [1]
    longGap[300] = 2
    longGap[302] = 3
    expect([...new FrozenSet(longGap)]).toEqual([...new Set(longGap)])
  })

  it('accepts any iterable', () => {
    const items = new Set(['a', 'b'])
    expect([...new FrozenSet(items)]).toEqual(['a', 'b'])
    expect([...new FrozenSet(items.values())]).toEqual(['a', 'b'])
  })

  it('membership is SameValueZero', () => {
    const fs = new FrozenSet([NaN, -0])
    expect(fs.has(NaN)).toBe(true)
    expect(fs.has(0)).toBe(true)
    expect(fs.size).toBe(2)
  })
})
