import { describe, it } from 'vitest'
import assert from 'assert'
import { Heap } from '../src/collections/Heap.js'
import { sorted } from '../src/itertools/index.js'

describe('Heap', () => {
  it('empty', () => {
    const h = new Heap()
    assert(h.empty())
  })

  it('heapifies array', () => {
    const arr = [7, 9, 3, 5, 8, 1, 2, 6, 4]
    const h = new Heap(arr)
    assert.deepEqual([...h.values()], arr)
    for (const x of sorted(arr)) {
      assert(h.contains(x))
      assert(h.pop() === x)
    }
  })

  it('max heapifies', () => {
    const arr = [7, 9, 3, 5, 8, 1, 2, 6, 4]
    const h = new Heap(arr, (x, y) => {
      if (x > y) return -1
      if (x < y) return 1
      return 0
    })
    assert.deepEqual([...h.values()], arr)
    for (const x of sorted(arr, true)) {
      assert(h.contains(x))
      assert(h.pop() === x)
    }
  })

  it('add', () => {
    const h = new Heap()
    const arr = [7, 9, 3, 5, 8, 1, 2, 6, 4]
    for (const value of arr) {
      h.add(value)
      assert(h.contains(value))
    }
    assert(h.size === arr.length)
  })

  it('pop', () => {
    const h = new Heap()
    const arr = [7, 9, 3, 5, 8, 1, 2, 6, 4]
    for (const value of arr) {
      h.add(value)
    }
    assert(h.pop() === 1)
    assert(h.size === arr.length - 1)
    assert(h.pop() === 2)
  })

  it('remove', () => {
    const h = new Heap()
    const arr = [7, 9, 3, 5, 8, 1, 2, 6, 4]
    for (const value of arr) {
      h.add(value)
    }
    assert(h.pop() === 1)
    assert(h.size === arr.length - 1)
    assert(h.pop() === 2)
  })
})
