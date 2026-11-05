import assert from 'assert'
import { divmod, max, min, round, sum } from '../src/math/index.js'

describe('math', () => {
  it('min', () => {
    assert(min([5, 4, 3, 1, 2]) === 1)
  })

  it('max', () => {
    assert(max([7, 9, 3, 11]) === 11)
  })

  it('round', () => {
    assert(round(0.5) === 1)
    assert(round(-0.5) === 0)
    assert(round(1.5) === 2)
    assert(round(1.54, 2) === 1.54)
    assert(round(1.545, 3) === 1.545)
  })

  it('round leaves a number alone once scaling overflows', () => {
    assert(round(1e300, 10) === 1e300)
    assert(round(-1e300, 10) === -1e300)
    assert(round(1.5, 400) === 1.5)
    assert(round(0, 400) === 0)
    assert(round(Infinity, 400) === Infinity)
    assert(Number.isNaN(round(NaN, 2)))
  })

  it('divmod', () => {
    assert.deepEqual(divmod(7, 2), [3, 1])
    assert.deepEqual(divmod(-7, -2), [3, -1])
    assert.deepEqual(divmod(2, 4), [0, 2])
    assert.deepEqual(divmod(-6, 2), [-3, 0])
    assert.deepEqual(divmod(5, 0), [Infinity, NaN])
  })

  it('divmod quotient and remainder add back up to x', () => {
    assert.deepEqual(divmod(-7, 2), [-4, 1])
    assert.deepEqual(divmod(7, -2), [-4, -1])
    assert.deepEqual(divmod(-2, 4), [-1, 2])
    assert.deepEqual(divmod(1, 0.1), [9, 0.09999999999999995])
    assert.deepEqual(divmod(3, 0.2), [14, 0.19999999999999984])
    assert.deepEqual(divmod(-5, Infinity), [-1, Infinity])
  })

  it('sum', () => {
    assert(sum([]) === 0)
    assert(sum([1, 2, 3, 4]) === 10)
  })
})
