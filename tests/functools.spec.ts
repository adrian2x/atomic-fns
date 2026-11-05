import assert from 'assert'
import { memoize, once } from '../src/functools/index.js'

describe('functools', () => {
  it('memoize caches an undefined result', () => {
    let calls = 0
    const memoized = memoize(() => {
      calls++
    })
    assert(memoized('key') === undefined)
    assert(memoized('key') === undefined)
    assert(calls === 1)
  })

  it('memoize keeps this', () => {
    const counter = {
      step: 2,
      times: memoize(
        function (n) {
          return this.step * n
        },
        function (n) {
          return `${this.step}:${n}`
        }
      )
    }
    assert(counter.times(3) === 6)
    assert(counter.times(3) === 6)
  })

  it('once keeps this', () => {
    const counter = {
      step: 2,
      first: once(function () {
        return this.step
      })
    }
    assert(counter.first() === 2)
    assert(counter.first() === 2)
  })
})
