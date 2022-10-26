import assert from 'assert'
import { Deque } from '../core/collections/deque.js'

describe('deque', () => {
  const print = (x) => console.log(x.toArray())

  it('empty', () => {
    let deque = new Deque()
    assert(deque.size === 0)
  })

  it('iterable', () => {
    let values = [1, 2, 3, 4]
    let deque = new Deque(values)
    let elements = [] as any[]
    for (const value of deque.values()) {
      elements.push(value)
    }
    assert.deepEqual(values, elements)
  })

  it('append', () => {
    let values = [1, 2, 3, 4]
    let deque = new Deque(values)
    assert(deque.size === values.length)
    assert.deepEqual(deque.toArray(), values)
    deque.append(5)
    assert(deque.size === 5)
    assert.deepEqual(deque.toArray(), [1, 2, 3, 4, 5])
  })

  it('appendleft', () => {
    let values = [1, 2, 3, 4]
    let deque = new Deque(values)
    deque.appendleft(0)
    deque.appendleft(1)
    deque.appendleft(1)
    deque.appendleft(0)
    assert.deepEqual(deque.toArray(), [0, 1, 1, 0, 1, 2, 3, 4])
    assert(deque.size === 8)
  })

  it('pop', () => {
    let values = [1, 2, 3, 4]
    let deque = new Deque(values)
    assert(deque.pop() === 4)
    assert(deque.pop() === 3)
    assert(deque.pop() === 2)
    assert(deque.pop() === 1)
    assert(deque.size === 0)
    assert.deepEqual(deque.toArray(), [])
    // assert.throws(() => deque.pop())
  })

  it('popleft', () => {
    let values = [1, 2, 3, 4]
    let deque = new Deque(values)
    assert(deque.popleft() === 1)
    assert(deque.popleft() === 2)
    assert(deque.popleft() === 3)
    assert(deque.popleft() === 4)
    assert(deque.size === 0)
    assert.deepEqual(deque.toArray(), [])
    // assert.throws(() => deque.popleft())
  })

  it('contains', () => {
    let values = [1, 2, 3, 4]
    let deque = new Deque(values)
    for (const val of values) {
      assert(deque.contains(val))
    }
  })

  it('get', () => {
    let values = [1, 2, 3, 4]
    let deque = new Deque(values)
    for (let i = 0; i < values.length; i++) {
      assert(deque.get(i) === values[i])
    }
    assert(deque.get(-1) === 4)
    assert(deque.get(-2) === 3)
  })

  it('clear', () => {
    let values = [1, 2, 3, 4]
    let deque = new Deque(values)
    deque.clear()
    assert(deque.size === 0)
    assert.deepEqual(deque.toArray(), [])
  })

  it('reversed', () => {
    let values = [4, 3, 2, 0, 1]
    let deque = new Deque(values)
    values.reverse()
    let arr = deque.reversed()
    assert.deepEqual(arr, values)
  })

  it('toArray', () => {
    let values = [1, 2, 3, 4]
    let deque = new Deque(values)
    assert(deque.size === values.length)
    assert.deepEqual(deque.toArray(), values)
  })
})
