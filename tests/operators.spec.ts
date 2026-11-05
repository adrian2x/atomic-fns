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

  it('Dates and RegExps compare by value', () => {
    assert(!deepEqual(new Date(1), new Date(2)))
    assert(deepEqual(new Date(1), new Date(1)))
    assert(deepEqual(new Date(NaN), new Date(NaN)))
    assert(!deepEqual(/a/, /b/))
    assert(!deepEqual(/a/g, /a/i))
    assert(deepEqual(/a/g, /a/g))
    assert(deepEqual({ at: new Date(1) }, { at: new Date(1) }))

    assert(!shallowEqual(new Date(1), new Date(2)))
    assert(shallowEqual(new Date(1), new Date(1)))
    assert(!shallowEqual(/a/, /b/))
  })

  it('deepEqual keeps shared references equal and survives cycles', () => {
    const left = { x: 1 }
    const right = { x: 1 }
    assert(deepEqual({ a: left, b: left }, { a: right, b: right }))
    assert(deepEqual([left, left], [right, right]))

    const a: any[] = [1]
    a.push(a)
    const b: any[] = [1]
    b.push(b)
    assert(deepEqual(a, b))

    const c: any = { n: 1 }
    c.self = c
    const d: any = { n: 2 }
    d.self = d
    assert(!deepEqual(c, d))

    let wideLeft: any = { leaf: true }
    let wideRight: any = { leaf: true }
    for (let i = 0; i < 40; i++) {
      wideLeft = { a: wideLeft, b: wideLeft }
      wideRight = { a: wideRight, b: wideRight }
    }
    assert(deepEqual(wideLeft, wideRight))
  })
  it('deepEqual accepts a WeakSet as seen', () => {
    assert(deepEqual({ a: 1 }, { a: 1 }, eq, new WeakSet()))
  })
})
