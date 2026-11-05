import assert from 'assert'
import { bool, identity, isinstance, not, compare, shallowEqual } from '../src/operators/index.js'

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
})
