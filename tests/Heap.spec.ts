import assert from 'assert'
import { Heap } from '../src/collections/Heap.js'
import { sorted } from '../src/itertools/index.js'

describe('Heap', () => {
  it('empty', () => {
    let h = new Heap()
    assert(h.empty())
  })

  it('heapifies array', () => {
    let arr = [7, 9, 3, 5, 8, 1, 2, 6, 4]
    let h = new Heap(arr)
    assert.deepEqual([...h.values()], arr)
    for (const x of sorted(arr)) {
      assert(h.contains(x))
      assert(h.pop() === x)
    }
  })

  it('max heapifies', () => {
    let arr = [7, 9, 3, 5, 8, 1, 2, 6, 4]
    let h = new Heap(arr, (x, y) => {
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
    let h = new Heap()
    let arr = [7, 9, 3, 5, 8, 1, 2, 6, 4]
    for (const value of arr) {
      h.add(value)
      assert(h.contains(value))
    }
    assert(h.size() === arr.length)
  })

  it('pop', () => {
    let h = new Heap()
    let arr = [7, 9, 3, 5, 8, 1, 2, 6, 4]
    for (const value of arr) {
      h.add(value)
    }
    assert(h.pop() === 1)
    assert(h.size() === arr.length - 1)
    assert(h.pop() === 2)
  })

  it('remove', () => {
    let h = new Heap()
    let arr = [7, 9, 3, 5, 8, 1, 2, 6, 4]
    for (const value of arr) {
      h.add(value)
    }
    assert(h.pop() === 1)
    assert(h.size() === arr.length - 1)
    assert(h.pop() === 2)
  })
})
