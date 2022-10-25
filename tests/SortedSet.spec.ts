import assert from 'assert'
import { SortedSet } from '../src/collections/SortedSet.js'

describe('SortedSet', () => {
  it('empty', () => {
    let tree = new SortedSet()
    assert(tree.empty())
    assert(tree.size === 0)
  })

  it('initialized', () => {
    let entries: number[] = [5, 4, 3, 1, 2]
    let tree = new SortedSet(entries)
    assert(!tree.empty())
    assert(tree.size === 5)
    entries.sort()
    assert.deepEqual([...tree.values()], entries)
  })

  it('add', () => {
    let tree = new SortedSet()
    for (let i = 10; i > 0; i--) {
      tree.add(i)
      assert(tree.contains(i))
    }
    assert(tree.size === 10)
  })

  it('has', () => {
    let tree = new SortedSet()
    for (let i = 100; i > 0; i--) {
      tree.add(i)
      assert(tree.has(i))
    }
    assert(tree.size === 100)
  })

  it('min', () => {
    let tree = new SortedSet()
    for (let i = 10; i > 0; i--) {
      tree.add(i)
    }
    assert(tree.min() === 1)
  })

  it('max', () => {
    let tree = new SortedSet()
    for (let i = 10; i > 0; i--) {
      tree.add(i)
    }
    assert(tree.max() === 10)
  })

  it('delete', () => {
    let tree = new SortedSet()
    tree.add(42)
    assert(tree.contains(42))
    assert(tree.delete(42) === true)
    assert(!tree.contains(42))
    assert(tree.delete(42) === false)
  })

  it('clear', () => {
    let tree = new SortedSet()
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

  it('values', () => {
    let tree = new SortedSet()
    for (let i = 1; i <= 5; i++) {
      tree.add(i * 2)
    }
    assert.deepEqual([...tree.values()], [2, 4, 6, 8, 10])
  })
})
