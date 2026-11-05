import assert from 'assert'
import {
  bool,
  identity,
  isinstance,
  not,
  compare,
  shallowEqual,
  eq,
  gt,
  lt,
  gte,
  deepEqual
} from '../src/operators/index.js'

describe('operators', () => {
  it('identity', () => {
    assert(identity(true) === true)
    assert(identity(false) === false)
    assert(identity(3.0) === 3.0)
    assert(identity('') === '')
    assert(identity(Object) === Object)
  })

  it('bool', () => {
    assert(bool(1))
    assert(bool(true))
    assert(bool(false) === false)
    assert(not(false))
    assert(not(''))
  })

  it('compare', () => {
    assert(compare(1, 1) === 0)
    assert(compare(2, 3) === -1)
    assert(compare(4, 3) === 1)
  })

  it('isinstance', () => {
    assert(isinstance([], Array))
    assert(isinstance(Array(), Array))
    assert(isinstance(Object(), Object))
    assert(isinstance(new Set(), Set))
    assert(isinstance(new Map(), Map))
  })

  it('shallowEqual', () => {
    assert(shallowEqual({}, {}))
    assert(shallowEqual([], []))
    assert(shallowEqual({ test: true }, { test: true }))
  })

  it('eq honors a hook that answers false', () => {
    const one = { eq: (other) => other === 1 }
    assert(eq(one, 1))
    assert(!eq(one, 2))
    assert(compare(one, 2) !== 0)
  })

  it('lt and gt honor a hook and return booleans', () => {
    const two = { lt: (other) => other > 2, gt: (other) => other < 2 }
    assert(lt(two, 3) === true)
    assert(lt(two, 1) === false)
    assert(gt(two, 1) === true)
    assert(gt(two, 3) === false)
    assert(gt(1, 2) === false)
  })

  it('gte compares with >=', () => {
    assert(gte(2, 1))
    assert(gte(2, 2))
    assert(!gte(1, 2))
  })

  it('shallowEqual tells kinds apart', () => {
    assert(!shallowEqual({}, []))
    assert(!shallowEqual({}, 5))
    assert(!shallowEqual([1], { 0: 1, length: 1 }))
    assert(!shallowEqual({}, new Date(0)))
    class Point {}
    assert(!shallowEqual(new Point(), {}))
    assert(shallowEqual(Object.create(null), {}))
  })

  it('deepEqual tells kinds apart', () => {
    assert(!deepEqual({}, []))
    assert(!deepEqual({}, new Date(0)))
    class Point {
      x = 1
    }
    assert(!deepEqual(new Point(), { x: 1 }))
    assert(deepEqual(new Point(), new Point()))
    assert(deepEqual(Object.create(null), {}))
  })
  it('a forged class name is not a built-in', () => {
    const date = JSON.parse('{"constructor":{"name":"Date"}}')
    assert(!deepEqual(new Date(0), date))
    assert(!deepEqual(date, new Date(0)))
    assert(!shallowEqual(new Date(0), date))
    assert(!deepEqual(/a/, JSON.parse('{"constructor":{"name":"RegExp"},"toString":1}')))
    const bytes = JSON.parse('{"constructor":{"name":"Uint8Array"},"length":1,"0":1}')
    assert(!deepEqual(new Uint8Array([1]), bytes))
  })
})
