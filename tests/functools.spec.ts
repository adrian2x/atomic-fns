import assert from 'assert'
import { memoize } from '../src/functools/index.js'

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
})
