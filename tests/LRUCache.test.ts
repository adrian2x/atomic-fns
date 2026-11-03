import { describe, expect, it } from 'vitest'
import { LRUCache } from '../src/collections/LRUCache.js'

describe('LRUCache', () => {
  it('SPEC-R82 empty cache', () => {
    const cache = new LRUCache()
    expect(cache.size).toBe(0)
    expect(cache.capacity).toBe(1024)
  })

  it('SPEC-R82 has tracks presence without refreshing', () => {
    const cache = new LRUCache(2)
    expect(cache.capacity).toBe(2)
    expect(cache.has(1)).toBe(false)
    cache.set(1, 'foo')
    cache.set(2, 'bar')
    expect(cache.has(1)).toBe(true)
    expect(cache.has(2)).toBe(true)
    expect([...cache.keys()]).toEqual([1, 2])
  })

  it('SPEC-R82 get refreshes recency so has does not', () => {
    const cache = new LRUCache(2)
    cache.set(1, 'foo')
    cache.set(2, 'bar')
    expect(cache.has(1)).toBe(true)
    expect([...cache.keys()]).toEqual([1, 2])
    expect(cache.get(1)).toBe('foo')
    expect([...cache.keys()]).toEqual([2, 1])
    cache.set(3, 'other')
    expect(cache.get(2)).toBeUndefined()
    expect([...cache.keys()]).toEqual([1, 3])
  })

  it('SPEC-R82 updating an existing key at capacity does not evict', () => {
    const cache = new LRUCache(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('b', 3)
    expect([...cache.keys()]).toEqual(['a', 'b'])
    expect(cache.get('b')).toBe(3)
    expect(cache.size).toBe(2)
  })

  it('SPEC-R82 keys values entries iterator', () => {
    const cache = new LRUCache(5)
    for (const value of [1, 2, 3, 4, 5]) cache.set(value, value)
    expect([...cache.keys()]).toEqual([1, 2, 3, 4, 5])
    expect([...cache.values()]).toEqual([1, 2, 3, 4, 5])
    const cache2 = new LRUCache(3)
    for (const value of [1, 2, 3]) cache2.set(value, 0)
    expect([...cache2.entries()]).toEqual([
      [1, 0],
      [2, 0],
      [3, 0]
    ])
    expect([...cache2]).toEqual([...cache2.entries()])
  })

  it('SPEC-R82 delete missing returns false', () => {
    const cache = new LRUCache()
    for (const value of [1, 2, 3]) cache.set(value, 0)
    expect(cache.has(1)).toBe(true)
    expect(cache.delete(1)).toBe(true)
    expect(cache.has(1)).toBe(false)
    expect(cache.delete(1)).toBe(false)
  })

  it('SPEC-R82 capacity 0 -1 1.5 NaN throw RangeError', () => {
    expect(() => new LRUCache(0)).toThrow(RangeError)
    expect(() => new LRUCache(-1)).toThrow(RangeError)
    expect(() => new LRUCache(1.5)).toThrow(RangeError)
    expect(() => new LRUCache(NaN)).toThrow(RangeError)
  })

  it('SPEC-R82 clear empties', () => {
    const cache = new LRUCache(2)
    cache.set(1, 1)
    cache.clear()
    expect(cache.size).toBe(0)
  })

  it('SPEC-R82 set returns this', () => {
    const cache = new LRUCache(2)
    expect(cache.set(1, 'a')).toBe(cache)
  })

  it('SPEC-R82 toStringTag is LRUCache', () => {
    expect(Object.prototype.toString.call(new LRUCache(1))).toBe('[object LRUCache]')
  })
})
