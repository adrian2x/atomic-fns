import assert from 'assert'
import { max, min, round, sum } from '../core/math/index.js'

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

  it('sum', () => {
    assert(sum([]) === 0)
    assert(sum([1, 2, 3, 4]) === 10)
  })
})
