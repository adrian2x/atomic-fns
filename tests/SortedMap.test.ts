import { describe, it } from 'vitest'
import assert from 'assert'
import { SortedMap } from '../src/collections/SortedMap.js'

describe('SortedMap', () => {
  it('empty', () => {
    const tree = new SortedMap()
    assert(tree.empty())
    assert(tree.size === 0)
  })

  it('initialized', () => {
    const entries: Array<[number, number]> = [
      [5, 5],
      [4, 4],
      [3, 3],
      [1, 1],
      [2, 2]
    ]
    const tree = new SortedMap(entries)
    assert(!tree.empty())
    assert(tree.size === 5)
    entries.sort((x, y) => x[0] - y[0])
    assert.deepEqual(
      [...tree.keys()],
      entries.map((x) => x[0])
    )
  })

  it('add', () => {
    const tree = new SortedMap()
    for (let i = 10; i > 0; i--) {
      tree.add(i)
      assert(tree.get(i) === null)
      assert(tree.contains(i))
    }
    assert(tree.size === 10)
  })

  it('set', () => {
    const tree = new SortedMap()
    for (let i = 10; i > 0; i--) {
      tree.set(i, i)
      assert(tree.get(i) === i)
      assert(tree.contains(i))
    }
    // update a key
    tree.set(1, 42)
    assert(tree.get(1) === 42)
    // adds if not exists
    tree.set(0, 42)
    assert(tree.size === 11)
  })

  it('get', () => {
    const tree = new SortedMap()
    for (let i = 10; i > 0; i--) {
      tree.set(i, i)
      assert(tree.get(i) === i)
      assert(tree.contains(i))
    }
    assert(tree.size === 10)
  })

  it('has', () => {
    const tree = new SortedMap()
    for (let i = 100; i > 0; i--) {
      tree.add(i)
      assert(tree.has(i))
    }
    assert(tree.size === 100)
  })

  it('min', () => {
    const tree = new SortedMap()
    for (let i = 10; i > 0; i--) {
      tree.add(i)
    }
    assert(tree.min() === 1)
  })

  it('max', () => {
    const tree = new SortedMap()
    for (let i = 10; i > 0; i--) {
      tree.add(i)
    }
    assert(tree.max() === 10)
  })

  it('delete', () => {
    const tree = new SortedMap()
    tree.add(42)
    assert(tree.contains(42))
    assert(tree.delete(42) === true)
    assert(!tree.contains(42))
    assert(tree.delete(42) === false)
  })

  it('clear', () => {
    const tree = new SortedMap()
    for (let i = 1; i <= 5; i++) {
      tree.add(i)
      assert(tree.contains(i))
    }
    tree.clear()
    assert(tree.empty())
    assert(tree.size === 0)
    for (let i = 1; i <= 5; i++) {
      assert(!tree.contains(i))
    }
  })

  it('keys', () => {
    const tree = new SortedMap()
    for (let i = 1; i <= 5; i++) {
      tree.set(i, i * 2)
    }
    assert.deepEqual([...tree.keys()], [1, 2, 3, 4, 5])
  })

  it('values', () => {
    const tree = new SortedMap()
    for (let i = 1; i <= 5; i++) {
      tree.set(i, i * 2)
    }
    assert.deepEqual([...tree.values()], [2, 4, 6, 8, 10])
  })

  it('entries', () => {
    const tree = new SortedMap()
    for (let i = 1; i <= 5; i++) {
      tree.set(i, i * 2)
    }
    assert.deepEqual(
      [...tree.entries()],
      [
        [1, 2],
        [2, 4],
        [3, 6],
        [4, 8],
        [5, 10]
      ]
    )
  })
})
