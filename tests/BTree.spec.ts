import assert from 'node:assert'
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

  it('freeze blocks every mutator', () => {
    const tree = new BTree()
    for (let i = 10; i > 0; i--) {
      tree.set(i, i)
    }
    tree.freeze()
    assert.throws(() => tree.remove(1), TypeError)
    assert.throws(() => tree.removeRange(1, 5, true), TypeError)
    assert.throws(() => tree.removeKeys([1, 2]), TypeError)
    assert.throws(() => tree.rangeUpdate(1, 5, true, () => ({ value: 0 })), TypeError)
    assert.throws(() => tree.extend([[11, 11]]), TypeError)
    assert(tree.size === 10)
    assert(tree.get(1) === 1)
  })

  it('removes a NaN key that the comparator orders', () => {
    const nanFirst = (x: number, y: number) => {
      if (Number.isNaN(x)) return Number.isNaN(y) ? 0 : -1
      return Number.isNaN(y) ? 1 : x - y
    }
    const tree = new BTree(undefined, nanFirst)
    tree.set(Number.NaN, 'nan')
    tree.set(1, 'one')
    assert(tree.remove(Number.NaN) === true)
    assert(tree.size === 1)
    assert.deepEqual([...tree.keys()], [1])

    tree.set(Number.NaN, 'nan')
    assert(tree.removeRange(Number.NaN, 5, true) === 2)
    assert(tree.size === 0)
  })

  it('get returns the default past the last key', () => {
    const tree = new BTree(undefined, undefined, 4)
    for (let i = 0; i < 10; i++) {
      tree.set(i, i)
    }
    assert(tree.height > 0)
    assert(tree.get(-1, 'none') === 'none')
    assert(tree.get(99, 'none') === 'none')
  })

  it('contains finds a key whose value is undefined', () => {
    const tree = new BTree(undefined, undefined, 4)
    for (let i = 0; i < 10; i++) {
      tree.set(i, undefined)
    }
    assert(tree.contains(5) === true)
    assert(tree.contains(5.5) === false)
    assert(tree.contains(99) === false)
  })

  it('rangeUpdate stores falsy values', () => {
    for (const value of [0, '', false, null, undefined]) {
      const tree = new BTree([[1, 'old']])
      tree.rangeUpdate(1, 1, true, () => ({ value }))
      assert(tree.get(1) === value)
    }
  })

  it('rangeUpdate ignores a primitive result', () => {
    const tree = new BTree([[1, 'old']])
    assert(tree.rangeUpdate(1, 1, true, () => 1) === 1)
    assert(tree.get(1) === 'old')
  })

  it('a range callback that returns null changes nothing', () => {
    const tree = new BTree([
      [1, 'one'],
      [2, 'two']
    ])
    assert(tree.rangeForEach(1, 2, true, () => null) === 2)
    assert(tree.rangeUpdate(1, 2, true, () => null) === 2)
    assert(tree.get(1) === 'one')
    assert(tree.size === 2)
  })

  it('keysRange stops at maxLength', () => {
    const tree = new BTree(undefined, undefined, 4)
    for (let i = 0; i < 10; i++) {
      tree.set(i, i)
    }
    assert.deepEqual(
      tree.keysRange(0, 9, true, 3).map(([key]) => key),
      [0, 1, 2]
    )
    assert.deepEqual(tree.keysRange(0, 9, true, 0), [])
    assert(tree.keysRange(0, 9, true, 10).length === 10)
    assert(tree.keysRange(0, 9, true, 100).length === 10)
  })

  it('extend counts only new keys', () => {
    const tree = new BTree([[0, 'zero']])
    assert(
      tree.extend([
        [0, 'a'],
        [1, 'b'],
        [1, 'c']
      ]) === 1
    )
    assert(tree.get(0) === 'a')
    assert(tree.get(1) === 'c')
    assert(tree.size === 2)
  })

  it('rangeForEach counts nothing when low is above high', () => {
    const tree = new BTree()
    for (let i = 0; i < 10; i++) {
      tree.set(i, i)
    }
    assert(tree.rangeForEach(5, 2, true) === 0)
    assert(tree.rangeForEach(5, 2, true, undefined, 3) === 3)
  })

  it('toArray includes an undefined key', () => {
    const tree = new BTree(undefined, (x, y) => (x ?? -1) - (y ?? -1))
    tree.set(1, 'one')
    tree.set(undefined, 'none')
    assert.deepStrictEqual(tree.toArray(), [
      [undefined, 'none'],
      [1, 'one']
    ])
    assert.deepStrictEqual(new BTree([[undefined, 'only']]).toArray(), [[undefined, 'only']])
  })

  it('reversed starts at the last key when that key is undefined', () => {
    const tree = new BTree(undefined, (x, y) => (x ?? 1000) - (y ?? 1000), 4)
    const keys = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, undefined]
    for (const key of keys) {
      tree.set(key, key)
    }
    assert.deepStrictEqual(
      [...tree.reversed()].map(([key]) => key),
      keys.toReversed()
    )
    assert.deepStrictEqual([...new BTree([[undefined, 'only']]).reversed()], [[undefined, 'only']])
    assert.deepStrictEqual([...new BTree().reversed()], [])
  })

  it('maxKey returns the key object set last', () => {
    const tree = new BTree(undefined, (x, y) => x.id - y.id, 4)
    for (let id = 0; id < 10; id++) {
      tree.set({ id }, id)
    }
    const replacement = { id: 9 }
    tree.set(replacement, 'new')
    assert(tree.maxKey() === replacement)
  })

  it('add keeps the value of an existing key', () => {
    const tree = new BTree(undefined, undefined, 4)
    for (let i = 0; i < 10; i++) {
      tree.set(i, i * 2)
    }
    assert(tree.add(9) === false)
    assert(tree.get(9) === 18)
    assert(tree.add(100) === true)
    assert(tree.get(100) === null)
    assert(tree.size === 11)
  })
})
