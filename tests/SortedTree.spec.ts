import assert from 'assert'
import { SortedTree } from '../src/collections/SortedTree.js'

describe('SortedTree', () => {
  it('empty', () => {
    let tree = new SortedTree()
    assert(tree.empty())
    assert(tree.size === 0)
  })

  it('initialized', () => {
    let entries: Array<[number, number]> = [
      [5, 5],
      [4, 4],
      [3, 3],
      [1, 1],
      [2, 2]
    ]
    let tree = new SortedTree(entries)
    assert(!tree.empty())
    assert(tree.size === 5)
    entries.sort((x, y) => x[0] - y[0])
    assert.deepEqual(
      [...tree.keys()],
      entries.map((x) => x[0])
    )
  })

  it('add', () => {
    let tree = new SortedTree()
    for (let i = 10; i > 0; i--) {
      tree.add(i)
      assert(tree.get(i) === null)
      assert(tree.contains(i))
    }
    assert(tree.size === 10)
  })

  it('get', () => {
    let tree = new SortedTree()
    for (let i = 10; i > 0; i--) {
      tree.set(i, i)
      assert(tree.get(i) === i)
      assert(tree.contains(i))
    }
    assert(tree.size === 10)
  })

  it('set', () => {
    let tree = new SortedTree()
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

  it('has', () => {
    let tree = new SortedTree()
    for (let i = 100; i > 0; i--) {
      tree.add(i)
      assert(tree.has(i))
    }
    assert(tree.size === 100)
  })

  it('min', () => {
    let tree = new SortedTree()
    for (let i = 10; i > 0; i--) {
      tree.add(i)
    }
    assert(tree.min() === 1)
  })

  it('max', () => {
    let tree = new SortedTree()
    for (let i = 10; i > 0; i--) {
      tree.add(i)
    }
    assert(tree.max() === 10)
  })

  it('delete', () => {
    let tree = new SortedTree()
    tree.add(42)
    assert(tree.contains(42))
    assert(tree.delete(42) === true)
    assert(!tree.contains(42))
    assert(tree.delete(42) === false)
  })

  it('clear', () => {
    let tree = new SortedTree()
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

  it('freeze', () => {
    let tree = new SortedTree()
    for (let i = 10; i > 0; i--) {
      tree.set(i, i)
    }
    tree.freeze()
    assert.throws(tree.clear)
    assert.throws(() => tree.add(11))
  })

  it('reversed', () => {
    let tree = new SortedTree()
    let entries: any[] = []
    for (let i = 100; i > 0; i--) {
      tree.set(i, i)
      entries.push([i, i])
    }
    assert.deepEqual([...tree.reversed()], entries)
  })

  it('keys', () => {
    let tree = new SortedTree()
    for (let i = 1; i <= 5; i++) {
      tree.set(i, i * 2)
    }
    assert.deepEqual([...tree.keys()], [1, 2, 3, 4, 5])
  })

  it('values', () => {
    let tree = new SortedTree()
    for (let i = 1; i <= 5; i++) {
      tree.set(i, i * 2)
    }
    assert.deepEqual([...tree.values()], [2, 4, 6, 8, 10])
  })

  it('entries', () => {
    let tree = new SortedTree()
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
