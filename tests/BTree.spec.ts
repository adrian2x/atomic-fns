import assert from 'assert'
import { BTree } from '../src/collections/BTree.js'
import { times } from '../src/itertools/index.js'

describe('BTree', () => {
  it('set', () => {
    let tree = new BTree()

    for (let i = 100; i > 0; i--) {
      tree.set(i, i)
      assert(tree.contains(i))
    }

    assert(tree.size() === 100)
  })

  it('get', () => {
    let tree = new BTree()

    for (let i = 100; i > 0; i--) {
      tree.set(i, i * 2)
      assert(tree.get(i) == i * 2)
    }
  })

  it('remove', () => {
    let tree = new BTree()
    for (let i = 100; i > 0; i--) {
      tree.set(i, i)
    }
    assert(tree.contains(100))
    tree.remove(100)
    assert(tree.contains(100) === false)
  })

  it('keys', () => {
    let tree = new BTree()
    for (let i = 9; i >= 0; i--) {
      tree.set(i, i)
    }
    assert.deepEqual([...tree.keys()], [...times(10, (i) => i)])
  })

  it('values', () => {
    let tree = new BTree()
    for (let i = 9; i >= 0; i--) {
      tree.set(i, i * 2)
    }
    assert.deepEqual([...tree.values()], [...times(10, (i) => i * 2)])
  })

  it('entries', () => {
    let tree = new BTree()
    for (let i = 9; i >= 0; i--) {
      tree.set(i, i * 2)
    }
    assert.deepEqual([...tree.entries()], [...times(10, (i) => [i, i * 2])])
  })

  it('iterates', () => {
    let tree = new BTree()
    for (let i = 9; i >= 0; i--) {
      tree.set(i, i * 2)
    }
    assert.deepEqual([...tree], [...times(10, (i) => [i, i * 2])])
  })

  it('reversed', () => {
    let tree = new BTree()
    for (let i = 9; i >= 0; i--) {
      tree.set(i, i * 2)
    }
    let entries = [...times(10, (i) => [i, i * 2])]
    entries.reverse()
    assert.deepEqual([...tree.reversed()], entries)
  })

  it('minKey', () => {
    let tree = new BTree()
    for (let i = 10; i >= 0; i--) {
      tree.set(i, i * 2)
    }
    assert(tree.minKey() === 0)
  })

  it('maxKey', () => {
    let tree = new BTree()
    for (let i = 10; i >= 0; i--) {
      tree.set(i, i * 2)
    }
    assert(tree.maxKey() === 10)
  })
})
