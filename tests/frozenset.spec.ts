import assert from 'node:assert'
import { FrozenSet } from '../src/collections/frozenset.js'

describe('FrozenSet', () => {
  it('holds the items it was built from', () => {
    let set = new FrozenSet([1, 2, 2, 3])
    assert(set.size === 3)
    assert(set.has(2))
    assert.deepEqual([...set], [1, 2, 3])
  })

  it('accepts any iterable', () => {
    let items = new Set(['a', 'b'])
    assert.deepEqual([...new FrozenSet(items)], ['a', 'b'])
    assert.deepEqual([...new FrozenSet(items.values())], ['a', 'b'])
  })

  it('is empty without an iterable', () => {
    assert(new FrozenSet(undefined).size === 0)
    assert(new FrozenSet(null).size === 0)
  })

  it('cannot be changed', () => {
    let set = new FrozenSet([1, 2])
    set.add()
    set.delete()
    set.clear()
    assert.deepEqual([...set], [1, 2])
    assert(Object.isFrozen(set))
  })
})
