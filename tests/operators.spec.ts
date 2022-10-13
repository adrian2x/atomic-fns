import assert from 'assert'
import { bool, id, isinstance, not } from '../src/operators.js'

function cb() {}

describe('operators', () => {
  it('id', () => {
    assert(id(1) === 1)
  })

  it('bool', () => {
    assert(bool(1))
    assert(bool(true))
    assert(bool(false) === false)
    assert(not(false))
    assert(not(''))
  })

  it('isinstance', () => {
    assert(isinstance([], Array))
    assert(isinstance(Array(), Array))
    assert(isinstance(Object(), Object))
    assert(isinstance(new Set(), Set))
    assert(isinstance(new Map(), Map))
  })
})
