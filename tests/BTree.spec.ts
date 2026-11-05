import assert from 'assert'
import { BTree } from '../src/collections/BTree.js'
import { times } from '../src/itertools/index.js'

describe('BTree', () => {
  it('get', () => {
    let tree = new BTree()

    for (let i = 100; i > 0; i--) {
      tree.set(i, i * 2)
      assert(tree.get(i) == i * 2)
    }
  })

  it('add', () => {
    let tree = new BTree()

    for (let i = 100; i > 0; i--) {
      tree.add(i)
      assert(tree.contains(i))
      assert(tree.get(i) === null)
    }
  })

  it('set', () => {
    let tree = new BTree()

    for (let i = 100; i > 0; i--) {
      tree.set(i, i)
      assert(tree.contains(i))
    }

    assert(tree.size === 100)
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

  it('clear', () => {
    let tree = new BTree()
    for (let i = 100; i > 0; i--) {
      tree.set(i, i)
    }
    tree.clear()
    assert(tree.size === 0)
    assert(tree.contains(100) === false)
  })

  it('iterates in order', () => {
    let tree = new BTree()
    let entries: any[] = []
    for (let i = 9; i >= 0; i--) {
      tree.set(i, i * 2)
      entries.push([i, i * 2])
    }
    entries.sort((x, y) => x[0] - y[0])
    assert.deepEqual([...tree], entries)
  })

  it('minKey', () => {
    let tree = new BTree()
    let keys: number[] = []
    for (let i = 10; i >= 0; i--) {
      keys.push(i)
      tree.set(i, i * 2)
    }
    keys.sort(tree._compare)
    assert(tree.minKey() === keys[0])
  })

  it('maxKey', () => {
    let tree = new BTree()
    let keys: number[] = []
    for (let i = 10; i >= 0; i--) {
      keys.push(i)
      tree.set(i, i * 2)
    }
    keys.sort(tree._compare)
    assert(tree.maxKey() === keys[keys.length - 1])
  })

  it('clone', () => {
    let tree = new BTree()
    let entries: any[] = []
    for (let i = 100; i > 0; i--) {
      tree.set(i, i)
      entries.push([i, i])
    }
    let t2 = tree.clone()
    assert.deepEqual([...t2.reversed()], entries)
  })

  it('freeze', () => {
    let tree = new BTree()
    for (let i = 10; i > 0; i--) {
      tree.set(i, i)
    }
    tree.freeze()
    assert.throws(tree.clear)
    assert.throws(() => tree.add(11))
  })

  it('reversed', () => {
    let tree = new BTree()
    let entries: any[] = []
    for (let i = 100; i > 0; i--) {
      tree.set(i, i)
      entries.push([i, i])
    }
    assert.deepEqual([...tree.reversed()], entries)
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

  it('keeps values aligned when a leaf of undefined values merges with its sibling', () => {
    const tree = new BTree(undefined, undefined, 4)
    for (let i = 0; i < 4; i++) {
      tree.set(i, undefined)
    }
    tree.set(4, 'four')
    tree.remove(0)
    assert(tree.get(4) === 'four')
    assert.deepStrictEqual([...tree.values()], [undefined, undefined, undefined, 'four'])
  })

  it('rangeUpdate gives a value to one key without changing other trees', () => {
    const tree = new BTree()
    tree.set(1, undefined)
    tree.rangeUpdate(1, 1, true, () => ({ value: 'changed' }))
    assert(tree.get(1) === 'changed')

    const other = new BTree()
    other.set(7, undefined)
    assert(other.get(7) === undefined)
  })

  it('entries survives keys removed while it runs', () => {
    const tree = new BTree(undefined, undefined, 4)
    for (let i = 0; i < 80; i++) {
      tree.set(i, i)
    }
    const entries = tree.entries(33)
    entries.next()
    tree.removeRange(0, 15, true)
    tree.removeRange(0, 80, true)
    assert.doesNotThrow(() => [...entries])
  })

  it('reversed survives keys removed while it runs', () => {
    for (const reusedArray of [undefined, []]) {
      const lower = new BTree(undefined, undefined, 4)
      for (let i = 0; i < 12; i++) {
        lower.set(i, i)
      }
      const lowerSeen: number[] = []
      for (const [key] of lower.reversed(undefined, reusedArray)) {
        lowerSeen.push(key)
        lower.removeRange(0, key, true)
      }
      assert.deepEqual(lowerSeen, [11])

      const next = new BTree([
        [1, 'a'],
        [2, 'b'],
        [3, 'c'],
        [4, 'd']
      ])
      const nextSeen: number[] = []
      for (const [key] of next.reversed(undefined, reusedArray)) {
        nextSeen.push(key)
        next.remove(key)
        next.remove(key - 1)
      }
      assert.deepEqual(nextSeen, [4, 2])
    }
  })

  it('keeps its size when the comparator cannot order a key', () => {
    const tree = new BTree(undefined, (x, y) => x - y)
    tree.set(Number.NaN, 'nan')
    assert(tree.set(1, 'one') === true)
    assert(tree.size === 2)
    assert(tree.get(0, 'none') === 'none')
    assert(tree.remove(0) === false)
    assert(tree.size === 2)
  })
})
