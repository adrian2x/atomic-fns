import { describe, expect, it } from 'vitest'
import { LRUCache } from '../../src/collections/index.ts'

describe('LRUCache', () => {
  it('empty cache', () => {
    const cache = new LRUCache()
    expect(cache.size).toBe(0)
    expect(cache.capacity).toBe(1024)
  })

  it('has leaves order unchanged', () => {
    const cache = new LRUCache(2)
    expect(cache.capacity).toBe(2)
    expect(cache.has(1)).toBe(false)
    expect(cache.set(1, 'foo')).toBe(cache)
    cache.set(2, 'bar')
    expect(cache.has(1)).toBe(true)
    expect([...cache.keys()]).toEqual([1, 2])
  })

  it('get marks a key most recent', () => {
    const cache = new LRUCache(2)
    cache.set(1, 'foo')
    cache.set(2, 'bar')
    expect(cache.get(1)).toBe('foo')
    expect([...cache.keys()]).toEqual([2, 1])
    cache.set(3, 'other')
    expect(cache.get(2)).toBeUndefined()
    expect([...cache.keys()]).toEqual([1, 3])
  })

  it('keys values entries iterator', () => {
    const entries: [number, string][] = [
      [1, 'a'],
      [2, 'b'],
      [3, 'c']
    ]
    const cache = new LRUCache<number, string>(3)
    for (const [key, value] of entries) cache.set(key, value)
    expect([...cache.keys()]).toStrictEqual([1, 2, 3])
    expect([...cache.values()]).toStrictEqual(['a', 'b', 'c'])
    expect([...cache.entries()]).toStrictEqual(entries)
    expect([...cache]).toStrictEqual(entries)
  })

  it('delete missing returns false', () => {
    const cache = new LRUCache()
    for (const value of [1, 2, 3]) cache.set(value, 0)
    expect(cache.has(1)).toBe(true)
    expect(cache.delete(1)).toBe(true)
    expect(cache.has(1)).toBe(false)
    expect(cache.delete(1)).toBe(false)
  })

  it('capacity 0 -1 1.5 NaN throw RangeError', () => {
    expect(() => new LRUCache(0)).toThrow(RangeError)
    expect(() => new LRUCache(-1)).toThrow(RangeError)
    expect(() => new LRUCache(1.5)).toThrow(RangeError)
    expect(() => new LRUCache(NaN)).toThrow(RangeError)
  })

  it('a capacity that is not a number throws TypeError', () => {
    for (const capacity of ['3', 3n, true, null, {}, [3]]) {
      expect(() => new LRUCache(capacity as never)).toThrow(
        new TypeError('capacity must be a number')
      )
    }
  })

  it('clear empties', () => {
    const cache = new LRUCache(2)
    cache.set(1, 1)
    cache.clear()
    expect(cache.size).toBe(0)
  })

  it('toStringTag is LRUCache', () => {
    const cache = new LRUCache(1)
    expect(Object.prototype.toString.call(cache)).toBe('[object LRUCache]')
    expect(Object.getOwnPropertySymbols(cache)).toEqual([])
  })

  function visits(loop: (step: (key: string) => void) => void): string[] {
    const keys: string[] = []
    loop((key) => {
      keys.push(key)
      if (keys.length > 3) throw new Error('the loop visited too many entries')
    })
    return keys
  }

  it('get and set inside a loop end after one visit per entry', () => {
    const cache = new LRUCache<string, number>(8).set('a', 1).set('b', 2).set('c', 3)
    const byKeys = visits((step) => {
      for (const key of cache.keys()) {
        step(key)
        cache.get(key)
      }
    })
    const byEntries = visits((step) => {
      for (const [key, value] of cache) {
        step(key)
        cache.set(key, value + 1)
      }
    })
    const byForEach = visits((step) => {
      cache.forEach((_, key) => {
        step(key)
        cache.get(key)
      })
    })
    expect([byKeys, byEntries, byForEach]).toStrictEqual([
      ['a', 'b', 'c'],
      ['a', 'b', 'c'],
      ['a', 'b', 'c']
    ])
    expect([...cache]).toStrictEqual([
      ['a', 2],
      ['b', 3],
      ['c', 4]
    ])
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

  it('evicts in recency order after repeated hits and insertions', () => {
    const cache = new LRUCache<number, number>(3)
    for (let i = 0; i < 3; i++) cache.set(i, i)
    for (let i = 0; i < 3; i++) cache.get(0)
    cache.set(3, 3)
    expect([...cache.keys()]).toStrictEqual([2, 0, 3])
    for (let i = 4; i < 7; i++) cache.set(i, i)
    expect([...cache.keys()]).toStrictEqual([4, 5, 6])
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
      for (let step = 0; step < 1000; step++) {
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

  it('overwriting a key at capacity evicts nothing and makes it most recent', () => {
    const cache = new LRUCache(2)
    cache.set(1, 'foo')
    cache.set(2, 'bar')
    cache.set(2, 'baz')
    expect(cache.size).toBe(2)
    expect([...cache.entries()]).toEqual([
      [1, 'foo'],
      [2, 'baz']
    ])
    cache.set(1, 'qux')
    expect([...cache.entries()]).toEqual([
      [2, 'baz'],
      [1, 'qux']
    ])
  })

  it('works through a Proxy', () => {
    const cache = new Proxy(new LRUCache(2), {})
    expect(cache.set(1, 'a').set(2, 'b').set(3, 'c').get(3)).toBe('c')
    expect([cache.has(2), cache.has(1)]).toEqual([true, false])
    expect(cache.delete(2)).toBe(true)
    expect([...cache]).toEqual([[3, 'c']])
    cache.clear()
    expect(cache.size).toBe(0)
  })

  it('keeps its state out of Object.keys and JSON.stringify', () => {
    const cache = new LRUCache(2).set(1, 'a').set(2, 'b')
    expect(Object.keys(cache)).toEqual([])
    expect(JSON.stringify(cache)).toBe('{}')
  })

  it('forEach passes value, key and the cache, oldest first', () => {
    const cache = new LRUCache<string, number>(3).set('a', 1).set('b', 2)
    cache.get('a')
    const seen: unknown[] = []
    cache.forEach(function (this: unknown, value, key, c) {
      seen.push([value, key, c === cache, this])
    }, 'ctx')
    expect(seen).toEqual([
      [2, 'b', true, 'ctx'],
      [1, 'a', true, 'ctx']
    ])
  })

  it('compares keys with SameValueZero, as Map does', () => {
    const cache = new LRUCache<number, string>(2).set(NaN, 'nan').set(0, 'zero')
    expect(cache.get(NaN)).toBe('nan')
    expect(cache.get(-0)).toBe('zero')
  })
})
