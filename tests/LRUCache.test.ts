import { describe, it } from 'vitest'
import assert from 'assert'
import { LRUCache } from '../src/collections/LRUCache.js'

describe('LRUCache', () => {
  it('empty', () => {
    const cache = new LRUCache()
    assert(cache.size === 0)
  })

  it('contains', () => {
    const cache = new LRUCache(2)
    assert(cache.capacity === 2)
    assert(!cache.contains(1))
    cache.set(1, 'foo')
    cache.set(2, 'bar')
    assert(cache.contains(1))
    assert(cache.contains(2))
  })

  it('evicts LRU keys', () => {
    const cache = new LRUCache(2)
    assert(cache.capacity === 2)
    cache.set(1, 'foo')
    cache.set(2, 'bar')
    assert(cache.get(1) === 'foo')
    cache.set(3, 'other')
    assert(cache.get(2) === undefined)
    assert.deepEqual([...cache.keys()], [1, 3])
  })

  it('keys', () => {
    const cache = new LRUCache(5)
    for (const value of [1, 2, 3, 4, 5]) {
      cache.set(value, value)
    }
    assert.deepEqual([...cache.keys()], [1, 2, 3, 4, 5])
  })

  it('values', () => {
    const cache = new LRUCache(5)
    for (const value of [1, 2, 3, 4, 5]) {
      cache.set(value, value)
    }
    assert.deepEqual([...cache.keys()], [1, 2, 3, 4, 5])
  })

  it('entries', () => {
    const cache = new LRUCache(3)
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
    const cache = new LRUCache(3)
    for (const value of [1, 2, 3]) {
      cache.set(value, 0)
    }
    const values = [...cache]
    assert.deepEqual(values, [...cache.entries()])
  })

  it('delete', () => {
    const cache = new LRUCache()
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
    const cache = new LRUCache()
    for (const value of [1, 2, 3]) {
      cache.set(value, 0)
    }
    assert(cache.contains(1))
    assert(cache.remove(1) === 0)
    assert(!cache.contains(1))
    assert(cache.delete(2))
  })
})
