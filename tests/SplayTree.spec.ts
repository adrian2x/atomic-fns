import assert from 'assert'
import { SplayTree } from '../src/collections/SplayTree.js'

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

  it('iterates 1e5 sorted keys', () => {
    let tree = new SplayTree()
    let expected: number[] = []
    for (let i = 0; i < 1e5; i++) {
      tree.set(i, i)
      expected.push(i)
    }
    assert.deepEqual([...tree.keys()], expected)
    assert.deepEqual([...tree.values()], expected)
    assert(tree.size === [...tree.entries()].length)
  })

  it('iteration visits each key once when the loop reads the tree', () => {
    let tree = new SplayTree(undefined, 1)
    for (const key of [3, 1, 2, 5, 4]) {
      tree.set(key, key)
    }
    let seen: any[] = []
    for (const key of tree.keys()) {
      seen.push(key)
      if (seen.length > 5) break
      tree.get(key)
    }
    assert.deepEqual(seen, [1, 2, 3, 4, 5])
  })

  it('iteration visits each key once when the loop removes it', () => {
    let tree = new SplayTree()
    for (const key of [3, 1, 2, 5, 4]) {
      tree.set(key, key)
    }
    let seen: any[] = []
    for (const key of tree.keys()) {
      seen.push(key)
      if (seen.length > 5) break
      tree.remove(key)
    }
    assert.deepEqual(seen, [1, 2, 3, 4, 5])
    assert(tree.empty())
  })

  it('height of a chain of 1e5 keys', () => {
    let tree = new SplayTree()
    for (let i = 0; i < 1e5; i++) {
      tree.set(i, i)
    }
    assert(tree.height === 1e5 - 1)
  })

  it('height counts edges', () => {
    let tree = new SplayTree()
    assert(tree.height === 0)
    tree.set(2, 2)
    assert(tree.height === 0)
    tree.set(1, 1)
    assert(tree.height === 1)
    tree.set(3, 3)
    assert(tree.height === 2)
  })

  it('add splays the key, as set does', () => {
    let tree = new SplayTree(undefined, 0)
    tree.set(1, 1)
    tree.set(2, 2)
    tree.add(1)
    assert(tree.top() === 1)
  })

  it('add keeps the value of an existing key', () => {
    let tree = new SplayTree()
    tree.set(1, 'a')
    tree.add(1)
    assert(tree.get(1) === 'a')
    assert(tree.size === 1)
    tree.add(2)
    assert(tree.get(2) === null)
  })

  it('remove uses the comparator', () => {
    let tree = new SplayTree((x, y) => x.id - y.id)
    tree.set({ id: 1 }, 'a')
    tree.set({ id: 2 }, 'b')
    assert(tree.remove({ id: 1 }) === 'a')
    assert(tree.size === 1)
    assert(!tree.contains({ id: 1 }))
    assert(tree.contains({ id: 2 }))
  })

  it('remove treats 0 and -0 as one key', () => {
    let tree = new SplayTree()
    tree.set(0, 'a')
    assert(tree.get(-0) === 'a')
    assert(tree.remove(-0) === 'a')
    assert(tree.empty())
  })

  it('contains a key whose value is undefined', () => {
    for (const p of [0, 1]) {
      let tree = new SplayTree(undefined, p)
      tree.set(1, undefined)
      tree.set(2, undefined)
      assert(tree.contains(1))
      assert(tree.contains(2))
      assert(!tree.contains(3))
    }
  })

  it('contains leaves the tree alone when p is 0', () => {
    let tree = new SplayTree(undefined, 0)
    tree.set(1, 1)
    tree.set(2, 2)
    assert(tree.contains(1))
    assert(tree.top() === 2)
  })
})
