import assert from 'node:assert'
import { LRUCache } from '../src/collections/LRUCache.js'
import { deepEqual } from '../src/operators/index.js'

declare const gc: () => void

describe('Cache', () => {
  it('empty', () => {
    let cache = new LRUCache()
    assert(cache.size === 0)
  })

  it('contains', () => {
    let cache = new LRUCache(2)
    assert(cache.capacity === 2)
    assert(!cache.contains(1))
    cache.set(1, 'foo')
    cache.set(2, 'bar')
    assert(cache.contains(1))
    assert(cache.contains(2))
  })

  it('evicts LRU keys', () => {
    let cache = new LRUCache(2)
    assert(cache.capacity === 2)
    cache.set(1, 'foo')
    cache.set(2, 'bar')
    assert(cache.get(1) === 'foo')
    cache.set(3, 'other')
    assert(cache.get(2) === undefined)
    assert.deepEqual([...cache.keys()], [1, 3])
  })

  it('keys', () => {
    let cache = new LRUCache(5)
    for (const value of [1, 2, 3, 4, 5]) {
      cache.set(value, value)
    }
    assert.deepEqual([...cache.keys()], [1, 2, 3, 4, 5])
  })

  it('values', () => {
    let cache = new LRUCache(5)
    for (const value of [1, 2, 3, 4, 5]) {
      cache.set(value, value)
    }
    assert.deepEqual([...cache.keys()], [1, 2, 3, 4, 5])
  })

  it('entries', () => {
    let cache = new LRUCache(3)
    for (const value of [1, 2, 3]) {
      cache.set(value, 0)
    }
    assert.deepEqual(
      [...cache.entries()],
      [
        [1, 0],
        [2, 0],
        [3, 0]
      ]
    )
  })

  it('iterator', () => {
    let cache = new LRUCache(3)
    for (const value of [1, 2, 3]) {
      cache.set(value, 0)
    }
    let values = [...cache]
    assert.deepEqual(values, [...cache.entries()])
  })
})

describe('LRUCache', () => {
  it('empty', () => {
    let cache = new LRUCache()
    assert(cache.size === 0)
  })

  it('contains', () => {
    let cache = new LRUCache(2)
    assert(cache.capacity === 2)
    assert(!cache.contains(1))
    cache.set(1, 'foo')
    cache.set(2, 'bar')
    assert(cache.contains(1))
    assert(cache.contains(2))
  })

  it('evicts LRU keys', () => {
    let cache = new LRUCache(2)
    assert(cache.capacity === 2)
    cache.set(1, 'foo')
    cache.set(2, 'bar')
    assert(cache.get(1) === 'foo')
    cache.set(3, 'other')
    assert(cache.get(2) === undefined)
    assert.deepEqual([...cache.keys()], [1, 3])
  })

  it('keys', () => {
    let cache = new LRUCache(5)
    for (const value of [1, 2, 3, 4, 5]) {
      cache.set(value, value)
    }
    assert.deepEqual([...cache.keys()], [1, 2, 3, 4, 5])
  })

  it('values', () => {
    let cache = new LRUCache(5)
    for (const value of [1, 2, 3, 4, 5]) {
      cache.set(value, value)
    }
    assert.deepEqual([...cache.keys()], [1, 2, 3, 4, 5])
  })

  it('entries', () => {
    let cache = new LRUCache(3)
    for (const value of [1, 2, 3]) {
      cache.set(value, 0)
    }
    assert.deepEqual(
      [...cache.entries()],
      [
        [1, 0],
        [2, 0],
        [3, 0]
      ]
    )
  })

  it('iterator', () => {
    let cache = new LRUCache(3)
    for (const value of [1, 2, 3]) {
      cache.set(value, 0)
    }
    let values = [...cache]
    assert.deepEqual(values, [...cache.entries()])
  })

  it('delete', () => {
    let cache = new LRUCache()
    for (const value of [1, 2, 3]) {
      cache.set(value, 0)
    }
    assert(cache.contains(1))
    assert(cache.delete(1) === true)
    assert(!cache.contains(1))
    // try deleting again
    assert(cache.delete(1) === false)
  })

  it('remove', () => {
    let cache = new LRUCache()
    for (const value of [1, 2, 3]) {
      cache.set(value, 0)
    }
    assert(cache.contains(1))
    assert(cache.remove(1) === 0)
    assert(!cache.contains(1))
    assert(cache.delete(2))
  })

  it('iteration ends when the loop calls get or set', () => {
    let cache = new LRUCache(3)
    for (const value of [1, 2, 3]) {
      cache.set(value, value)
    }

    let keys: any[] = []
    for (const key of cache.keys()) {
      keys.push(key)
      if (keys.length > 3) break
      cache.get(key)
    }
    assert.deepEqual(keys, [1, 2, 3])

    let values: any[] = []
    for (const value of cache.values()) {
      values.push(value)
      if (values.length > 3) break
      cache.set(value, value)
    }
    assert.deepEqual(values, [1, 2, 3])

    let entries: any[] = []
    for (const entry of cache) {
      entries.push(entry)
      if (entries.length > 3) break
      cache.get(entry[0])
    }
    assert.deepEqual(entries, [
      [1, 1],
      [2, 2],
      [3, 3]
    ])
  })

  it('overwriting a key at capacity evicts nothing', () => {
    let cache = new LRUCache(2)
    cache.set(1, 'foo')
    cache.set(2, 'bar')
    cache.set(2, 'baz')
    assert(cache.size === 2)
    assert.deepEqual(
      [...cache.entries()],
      [
        [1, 'foo'],
        [2, 'baz']
      ]
    )
    cache.set(1, 'qux')
    assert.deepEqual(
      [...cache.entries()],
      [
        [2, 'baz'],
        [1, 'qux']
      ]
    )
  })

  it('never holds more than its capacity', () => {
    for (const capacity of [0, -1, 2.5]) {
      let cache = new LRUCache(capacity)
      for (let i = 0; i < 100; i++) {
        cache.set(i, i)
        assert(cache.size <= Math.max(capacity, 0))
      }
    }
    assert(new LRUCache(0).set(1, 1).get(1) === undefined)
    assert.deepEqual([...new LRUCache(2.5).set(1, 1).set(2, 2).set(3, 3).keys()], [2, 3])
  })

  it('evicts in LRU order across get, remove and clear', () => {
    let cache = new LRUCache(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a')
    cache.set('c', 3)
    assert.deepEqual([...cache.keys()], ['a', 'c'])
    cache.remove('a')
    cache.set('d', 4)
    cache.set('e', 5)
    assert.deepEqual([...cache.keys()], ['d', 'e'])
    cache.clear()
    cache.set('f', 6)
    cache.set('g', 7)
    cache.set('h', 8)
    assert.deepEqual([...cache.keys()], ['g', 'h'])
  })

  it('evicts in constant time on a large cache', () => {
    let cache = new LRUCache(50_000)
    const start = performance.now()
    for (let i = 0; i < 300_000; i++) cache.set(i, i)
    // a rescanning eviction takes over 3 seconds here, this one about 30 ms
    assert(performance.now() - start < 1500)
    assert(cache.size === 50_000)
  })

  it('keeps no old hash tables alive when it never evicts', () => {
    for (const capacity of [1024, Infinity]) {
      let cache = new LRUCache(capacity)
      for (let i = 0; i < 100; i++) cache.set(i, i)
      const heapAfter = (touch: (key: number) => void, times: number) => {
        for (let n = 0; n < times; n++) touch(n % 100)
        gc()
        gc()
        return process.memoryUsage().heapUsed
      }
      const read = (key: number) => cache.get(key)
      const write = (key: number) => cache.set(key, key)
      const before = heapAfter(read, 1000)
      assert(heapAfter(read, 2_000_000) - before < 16 * 1024 * 1024)
      assert(heapAfter(write, 2_000_000) - before < 16 * 1024 * 1024)
    }
  })

  it('works through a Proxy', () => {
    let cache = new Proxy(new LRUCache(2), {})
    assert(cache.set(1, 'a').get(1) === 'a')
  })

  it('compares by content', () => {
    assert(deepEqual(new LRUCache(2).set(1, 1), new LRUCache(2).set(1, 1)))
    assert(!deepEqual(new LRUCache(2).set(1, 1), new LRUCache(2).set(1, 2)))
  })
})
