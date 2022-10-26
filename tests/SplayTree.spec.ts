import assert from 'assert'
import { SplayTree } from '../core/collections/SplayTree.js'

describe('SplayTree', () => {
  it('empty', () => {
    let tree = new SplayTree()
    assert(tree.empty())
    assert(tree.size === 0)
    for (const value of tree.values()) {
      assert(!value)
    }
  })

  it('set', () => {
    let tree = new SplayTree()
    for (let i = 10; i > 0; i--) {
      tree.set(i, i)
      assert(tree.contains(i))
    }
    assert(tree.size === 10)
  })

  it('get', () => {
    let tree = new SplayTree()
    for (let i = 100; i > 0; i--) {
      tree.set(i, i)
      assert(tree.get(i) === i)
    }
    assert(tree.size === 100)
  })

  it('splay', () => {
    let tree = new SplayTree()
    for (let i = 100; i > 0; i--) {
      tree.add(i)
      assert(tree.contains(i))
    }
    tree.splay(42)
    assert(tree.top() === 42)
  })

  it('lowerBound', () => {
    let tree = new SplayTree()
    for (let i = 20; i > 0; i -= 2) {
      tree.set(i, i)
    }
    assert(tree.lowerBound(12) === 10)
  })

  it('min', () => {
    let tree = new SplayTree()
    for (let i = 10; i > 0; i--) {
      tree.set(i, i)
    }
    assert(tree.min() === 1)
  })

  it('max', () => {
    let tree = new SplayTree()
    for (let i = 10; i > 0; i--) {
      tree.set(i, i)
    }
    assert(tree.max() === 10)
  })

  it('remove', () => {
    let tree = new SplayTree()
    tree.set(42, 42)
    assert(tree.contains(42))
    assert(tree.remove(42) === 42)
    assert(!tree.contains(42))
    assert(tree.remove(42) === undefined)
  })

  it('clear', () => {
    let tree = new SplayTree()
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
    let tree = new SplayTree()
    for (let i = 1; i <= 5; i++) {
      tree.set(i, i)
    }
    assert.deepEqual([...tree.keys()], [1, 2, 3, 4, 5])
  })

  it('values', () => {
    let tree = new SplayTree()
    for (let i = 1; i <= 5; i++) {
      tree.set(i, i * 2)
    }
    assert.deepEqual([...tree.values()], [2, 4, 6, 8, 10])
  })

  it('entries', () => {
    let tree = new SplayTree()
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
