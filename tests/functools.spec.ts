import assert from 'assert'
import { debounce, memoize, once, result, resultAsync, throttle } from '../src/functools/index.js'

describe('functools', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

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

  it('debounce keeps this', () => {
    const seen = []
    const counter = {
      step: 2,
      save: debounce(function () {
        seen.push(this.step)
      }, 100)
    }
    counter.save()
    vi.advanceTimersByTime(100)
    assert.deepEqual(seen, [2])
  })

  it('debounce with maxWait keeps this', () => {
    const seen = []
    const counter = {
      step: 2,
      save: debounce(
        function () {
          seen.push(this.step)
        },
        100,
        { maxWait: 150 }
      )
    }
    counter.save()
    vi.advanceTimersByTime(90)
    counter.save()
    vi.advanceTimersByTime(60)
    assert.deepEqual(seen, [2])
  })
  it('throttle keeps this', () => {
    const seen = []
    const counter = {
      step: 2,
      save: throttle(function () {
        seen.push(this.step)
      }, 100)
    }
    counter.save()
    assert.deepEqual(seen, [2])
  })
  it('result keeps this', () => {
    const counter = {
      step: 2,
      read: result(function () {
        return this.step
      })
    }
    assert.deepEqual(counter.read(), [2, undefined])
  })

  it('resultAsync keeps this', async () => {
    const counter = {
      step: 2,
      read: resultAsync(async function () {
        return this.step
      })
    }
    assert.deepEqual(await counter.read(), [2, undefined])
  })
})
