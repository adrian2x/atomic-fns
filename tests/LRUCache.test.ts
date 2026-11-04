import { afterEach, describe, expect, it, vi } from 'vitest'
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

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** Counts loop bodies and stops a loop that would never end. */
  function visits(loop: (step: () => void) => void): number {
    let count = 0
    loop(() => {
      count++
      if (count > 100) throw new Error('the loop did not end')
    })
    return count
  }

  it('get and set inside a loop end after one visit per entry', () => {
    const cache = new LRUCache<string, number>(8).set('a', 1).set('b', 2).set('c', 3)
    const byKeys = visits((step) => {
      for (const key of cache.keys()) {
        step()
        cache.get(key)
      }
    })
    const byEntries = visits((step) => {
      for (const [key, value] of cache) {
        step()
        cache.set(key, value + 1)
      }
    })
    const byForEach = visits((step) => {
      cache.forEach((_, key) => {
        step()
        cache.get(key)
      })
    })
    expect([byKeys, byEntries, byForEach]).toEqual([3, 3, 3])
    expect(cache.get('a')).toBe(2)
  })

  it('an iterator keeps the entries it started with', () => {
    const cache = new LRUCache<string, number>(2).set('a', 1).set('b', 2)
    const iterator = cache.entries()
    cache.set('c', 3)
    expect([...iterator]).toEqual([
      ['a', 1],
      ['b', 2]
    ])
  })

  it('neither hits nor evictions touch the order of the backing Map', () => {
    const cache = new LRUCache<number, number>(64)
    for (let i = 0; i < 64; i++) cache.set(i, i)
    const keys = vi.spyOn(Map.prototype, 'keys')
    const writes = vi.spyOn(Map.prototype, 'set')

    for (let i = 0; i < 1000; i++) cache.get(5)
    expect(writes.mock.calls.length).toBe(0)

    for (let i = 64; i < 1064; i++) cache.set(i, i)
    expect(keys.mock.calls.length).toBe(0)
    expect(writes.mock.calls.length).toBe(1000)

    vi.restoreAllMocks()
    expect([...cache.keys()]).toEqual(Array.from({ length: 64 }, (_, i) => 1000 + i))
  })

  it('eviction order matches a model across gets, deletes and clears', () => {
    let seed = 7
    const next = (n: number): number => {
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff
      return (seed >>> 8) % n
    }
    for (const capacity of [1, 2, 3, 8]) {
      const cache = new LRUCache<number, number>(capacity)
      let model: [number, number][] = []
      const remove = (key: number): [number, number] | undefined => {
        const at = model.findIndex(([k]) => k === key)
        return at < 0 ? undefined : model.splice(at, 1)[0]
      }
      for (let step = 0; step < 20_000; step++) {
        const key = next(capacity * 2)
        const op = next(40)
        if (op === 0) {
          cache.clear()
          model = []
        } else if (op < 8) {
          cache.delete(key)
          remove(key)
        } else if (op < 24) {
          cache.set(key, step)
          if (remove(key) === undefined && model.length === capacity) model.shift()
          model.push([key, step])
        } else {
          const hit = remove(key)
          if (hit !== undefined) model.push(hit)
          expect(cache.get(key)).toBe(hit?.[1])
        }
        expect([...cache]).toEqual(model)
      }
    }
  })
})
