import { describe, it } from 'vitest'
import assert from 'assert'
import { BTree } from '../src/collections/BTree.js'
import { times } from '../src/itertools/index.js'

describe('BTree', () => {
  it('get', () => {
    const tree = new BTree()

    for (let i = 100; i > 0; i--) {
      tree.set(i, i * 2)
      assert(tree.get(i) == i * 2)
    }
  })

  it('add', () => {
    const tree = new BTree()

    for (let i = 100; i > 0; i--) {
      tree.add(i)
      assert(tree.contains(i))
      assert(tree.get(i) === null)
    }
  })

  it('set', () => {
    const tree = new BTree()

    for (let i = 100; i > 0; i--) {
      tree.set(i, i)
      assert(tree.contains(i))
    }

    assert(tree.size === 100)
  })

  it('remove', () => {
    const tree = new BTree()
    for (let i = 100; i > 0; i--) {
      tree.set(i, i)
    }
    assert(tree.contains(100))
    tree.remove(100)
    assert(tree.contains(100) === false)
  })

  it('clear', () => {
    const tree = new BTree()
    for (let i = 100; i > 0; i--) {
      tree.set(i, i)
    }
    tree.clear()
    assert(tree.size === 0)
    assert(tree.contains(100) === false)
  })

  it('iterates in order', () => {
    const tree = new BTree()
    const entries: any[] = []
    for (let i = 9; i >= 0; i--) {
      tree.set(i, i * 2)
      entries.push([i, i * 2])
    }
    entries.sort((x, y) => x[0] - y[0])
    assert.deepEqual([...tree], entries)
  })

  it('minKey', () => {
    const tree = new BTree()
    const keys: number[] = []
    for (let i = 10; i >= 0; i--) {
      keys.push(i)
      tree.set(i, i * 2)
    }
    keys.sort(tree._compare)
    assert(tree.minKey() === keys[0])
  })

  it('maxKey', () => {
    const tree = new BTree()
    const keys: number[] = []
    for (let i = 10; i >= 0; i--) {
      keys.push(i)
      tree.set(i, i * 2)
    }
    keys.sort(tree._compare)
    assert(tree.maxKey() === keys[keys.length - 1])
  })

  it('clone', () => {
    const tree = new BTree()
    const entries: any[] = []
    for (let i = 100; i > 0; i--) {
      tree.set(i, i)
      entries.push([i, i])
    }
    const t2 = tree.clone()
    assert.deepEqual([...t2.reversed()], entries)
  })

  it('freeze', () => {
    const tree = new BTree()
    for (let i = 10; i > 0; i--) {
      tree.set(i, i)
    }
    tree.freeze()
    assert.throws(tree.clear)
    assert.throws(() => tree.add(11))
  })

  it('reversed', () => {
    const tree = new BTree()
    const entries: any[] = []
    for (let i = 100; i > 0; i--) {
      tree.set(i, i)
      entries.push([i, i])
    }
    assert.deepEqual([...tree.reversed()], entries)
  })

  it('keys', () => {
    const tree = new BTree()
    for (let i = 9; i >= 0; i--) {
      tree.set(i, i)
    }
    assert.deepEqual([...tree.keys()], [...times(10, (i) => i)])
  })

  it('values', () => {
    const tree = new BTree()
    for (let i = 9; i >= 0; i--) {
      tree.set(i, i * 2)
    }
    assert.deepEqual([...tree.values()], [...times(10, (i) => i * 2)])
  })

  it('entries', () => {
    const tree = new BTree()
    for (let i = 9; i >= 0; i--) {
      tree.set(i, i * 2)
    }
    assert.deepEqual([...tree.entries()], [...times(10, (i) => [i, i * 2])])
  })
})
