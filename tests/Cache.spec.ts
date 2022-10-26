import assert from 'assert'
import { Cache, LRUCache } from '../core/collections/LRUCache.js'

describe('Cache', () => {
  it('empty', () => {
    let cache = new Cache()
    assert(cache.size === 0)
  })

  it('contains', () => {
    let cache = new Cache(2)
    assert(cache.capacity === 2)
    assert(!cache.contains(1))
    cache.set(1, 'foo')
    cache.set(2, 'bar')
    assert(cache.contains(1))
    assert(cache.contains(2))
  })

  it('evicts LRU keys', () => {
    let cache = new Cache(2)
    assert(cache.capacity === 2)
    cache.set(1, 'foo')
    cache.set(2, 'bar')
    assert(cache.get(1) === 'foo')
    cache.set(3, 'other')
    assert(cache.get(2) === undefined)
    assert.deepEqual([...cache.keys()], [3, 1])
  })

  it('keys', () => {
    let cache = new Cache(5)
    for (const value of [1, 2, 3, 4, 5]) {
      cache.set(value, value)
    }
    assert.deepEqual([...cache.keys()], [5, 4, 3, 2, 1])
  })

  it('values', () => {
    let cache = new Cache(5)
    for (const value of [1, 2, 3, 4, 5]) {
      cache.set(value, value)
    }
    assert.deepEqual([...cache.keys()], [5, 4, 3, 2, 1])
  })

  it('entries', () => {
    let cache = new Cache(3)
    for (const value of [1, 2, 3]) {
      cache.set(value, 0)
    }
    assert.deepEqual(
      [...cache.entries()],
      [
        [3, 0],
        [2, 0],
        [1, 0]
      ]
    )
  })

  it('iterator', () => {
    let cache = new Cache(3)
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
    assert.deepEqual([...cache.keys()], [3, 1])
  })

  it('keys', () => {
    let cache = new LRUCache(5)
    for (const value of [1, 2, 3, 4, 5]) {
      cache.set(value, value)
    }
    assert.deepEqual([...cache.keys()], [5, 4, 3, 2, 1])
  })

  it('values', () => {
    let cache = new LRUCache(5)
    for (const value of [1, 2, 3, 4, 5]) {
      cache.set(value, value)
    }
    assert.deepEqual([...cache.keys()], [5, 4, 3, 2, 1])
  })

  it('entries', () => {
    let cache = new LRUCache(3)
    for (const value of [1, 2, 3]) {
      cache.set(value, 0)
    }
    assert.deepEqual(
      [...cache.entries()],
      [
        [3, 0],
        [2, 0],
        [1, 0]
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
})
