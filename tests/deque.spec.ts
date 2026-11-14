import assert from 'node:assert'
import { Deque } from '../src/collections/deque.js'
import { KeyError } from '../src/globals/index.js'

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

  it('set after popleft and wrap-around', () => {
    let deque = new Deque([1, 2, 3])
    deque.popleft()
    deque.set(0, 9)
    assert.deepEqual(deque.toArray(), [9, 3])
    deque.set(-1, 8)
    assert.deepEqual(deque.toArray(), [9, 8])

    let ring = new Deque([], 4)
    for (const value of [1, 2, 3, 4, 5, 6]) {
      ring.append(value)
    }
    ring.set(0, 9)
    ring.set(3, 8)
    assert.deepEqual(ring.toArray(), [9, 4, 5, 8])
  })

  it('set rejects an index out of range', () => {
    let deque = new Deque([1, 2, 3])
    assert.throws(() => deque.set(3, 9), KeyError)
    assert.throws(() => deque.set(-4, 9), KeyError)
    assert.throws(() => new Deque().set(0, 9), KeyError)
    assert.deepEqual(deque.toArray(), [1, 2, 3])
  })

  it('typed arrays keep appended values', () => {
    let deque = new Deque(new Int32Array([1, 2, 3]))
    deque.append(4)
    deque.appendleft(0)
    assert(deque.size === 5)
    assert.deepEqual(Array.from(deque.toArray()), [0, 1, 2, 3, 4])
    assert(deque.first() === 0)
    assert(deque.pop() === 4)
  })

  it('typed arrays keep their capacity', () => {
    let deque = new Deque(new Int32Array([1, 2, 3]), 4)
    deque.append(4)
    deque.append(5)
    assert.deepEqual(Array.from(deque.toArray()), [2, 3, 4, 5])
    assert.deepEqual(Array.from(new Deque(new Int32Array([1, 2, 3]), 2).toArray()), [2, 3])
  })

  it('get across the end of the buffer', () => {
    let deque = new Deque([], 4)
    for (const value of [1, 2, 3, 4, 5, 6]) {
      deque.append(value)
    }
    assert.deepEqual(
      [0, 1, 2, 3].map((i) => deque.get(i)),
      [3, 4, 5, 6]
    )
    assert.deepEqual(
      [-1, -2, -3, -4].map((i) => deque.get(i)),
      [6, 5, 4, 3]
    )
  })

  it('get with a negative index after popleft', () => {
    let deque = new Deque([1, 2, 3, 4])
    deque.popleft()
    deque.popleft()
    assert(deque.get(-1) === 4)
    assert(deque.get(-2) === 3)
  })

  it('get out of range', () => {
    let deque = new Deque([1, 2, 3])
    deque.pop()
    assert(deque.get(2) === undefined)
    assert(deque.get(-3) === undefined)
    deque.popleft()
    assert(deque.get(1) === undefined)
    assert(deque.get(-2) === undefined)
  })
})
