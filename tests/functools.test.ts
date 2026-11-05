import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from 'vitest'
import assert from 'node:assert/strict'
import {
  curry,
  partial,
  flow,
  pipe,
  compose,
  memoize,
  cache,
  debounce,
  throttle,
  once,
  result,
  resultAsync,
  promisify
} from '../src/functools/index.js'

describe('functools', () => {
  describe('curry / partial / flow / pipe / compose', () => {
    it('curry accumulates until arity then applies', () => {
      const add = (a: number, b: number, c: number) => a + b + c
      const curried = curry(add)
      assert.equal(curried(1)(2)(3), 6)
      assert.equal(curried(1, 2)(3), 6)
      assert.equal(curried(1)(2, 3), 6)
      assert.equal(curried(1, 2, 3), 6)
    })

    it('partial prepends arguments', () => {
      const add = (a: number, b: number) => a + b
      assert.equal(partial(add, 2)(3), 5)
      assert.equal(partial(add, 2, 3)(), 5)
    })

    it('flow and pipe apply left to right', () => {
      const add1 = (x: number) => x + 1
      const mul2 = (x: number) => x * 2
      assert.equal(flow(add1, mul2)(3), 8)
      assert.equal(pipe(mul2, add1)(3), 7)
    })

    it('flow forwards all arguments to the first function', () => {
      assert.equal(
        flow(
          (a: number, b: number) => a + b,
          (x: number) => x * 2
        )(1, 2),
        6
      )
    })

    it('flow forwards this to the first function', () => {
      const obj = { n: 10 }
      function add(this: { n: number }, a: number) {
        return this.n + a
      }
      assert.equal(flow(add, (x: number) => x * 2).call(obj, 3), 26)
    })

    it('flow chains argument and return types', () => {
      expectTypeOf(
        flow(
          (a: number, b: string) => a + b.length,
          (n: number) => String(n)
        )
      ).toEqualTypeOf<(a: number, b: string) => string>()
    })

    it('SPEC-R58 compose applies right to left and does not mutate the argument list', () => {
      const add1 = (x: number) => x + 1
      const mul2 = (x: number) => x * 2
      const fns = [add1, mul2]
      assert.equal(compose(...fns)(3), 7)
      assert.equal(fns[0], add1)
      assert.equal(fns[1], mul2)
      assert.equal(compose(add1, mul2)(3), 7)
    })
  })

  describe('memoize / cache', () => {
    it('SPEC-R55 memoize caches undefined results via Map.has', () => {
      let calls = 0
      const fn = memoize((x: number): number | undefined => {
        calls++
        return x < 0 ? x : undefined
      })
      assert.equal(fn(1), undefined)
      assert.equal(fn(1), undefined)
      assert.equal(fn(1), undefined)
      assert.equal(calls, 1)
      assert.equal(fn(2), undefined)
      assert.equal(calls, 2)
    })

    it('SPEC-R55 memoize uses resolver and caller this', () => {
      const obj = {
        n: 10,
        add(a: number, b: number) {
          return this.n + a + b
        }
      }
      let calls = 0
      const mem = memoize(
        function (this: typeof obj, a: number, b: number) {
          calls++
          return this.add(a, b)
        },
        (a, b) => `${String(a)}:${String(b)}`
      )
      assert.equal(mem.call(obj, 1, 2), 13)
      assert.equal(mem.call(obj, 1, 2), 13)
      assert.equal(calls, 1)
    })

    it('SPEC-R55 memoize resolver throwing propagates and caches nothing', () => {
      let calls = 0
      const fn = memoize(
        (x: number) => {
          calls++
          return x * 2
        },
        () => {
          throw new Error('bad key')
        }
      )
      assert.throws(() => fn(1), /bad key/)
      assert.equal(calls, 0)
      assert.throws(() => fn(1), /bad key/)
      assert.equal(calls, 0)
    })

    it('memoize exposes cache and clear', () => {
      let calls = 0
      const fn = memoize((x: number) => {
        calls++
        return x * 2
      })
      assert.equal(fn(1), 2)
      assert.equal(fn.cache.get(1), 2)
      fn.clear()
      assert.equal(fn.cache.size, 0)
      assert.equal(fn(1), 2)
      assert.equal(calls, 2)
    })

    it('SPEC-R55 cache decorator memoizes per instance with this', () => {
      class Counter {
        base: number
        constructor(base: number) {
          this.base = base
        }
        add(x: number) {
          return this.base + x
        }
      }
      const ctx = {
        kind: 'method',
        name: 'add',
        static: false,
        private: false,
        addInitializer() {
          return undefined
        }
      } as unknown as ClassMethodDecoratorContext<Counter, (this: Counter, x: number) => number>
      const original = Reflect.get(Counter.prototype, 'add')
      Counter.prototype.add = cache(original, ctx)
      const a = new Counter(10)
      const b = new Counter(100)
      assert.equal(a.add(1), 11)
      assert.equal(a.add(1), 11)
      a.base = 999
      assert.equal(a.add(1), 11)
      assert.equal(b.add(1), 101)
      assert.equal(b.add(1), 101)
      b.base = 0
      assert.equal(b.add(1), 101)
      assert.equal(a.add(2), 1001)
    })
  })

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('SPEC-R56 debounce trailing uses latest args', () => {
      const seen: string[] = []
      const d = debounce((x: string) => {
        seen.push(x)
        return x
      }, 50)
      d('a')
      vi.advanceTimersByTime(10)
      d('b')
      vi.advanceTimersByTime(50)
      assert.deepEqual(seen, ['b'])
    })

    it('SPEC-R56 debounce maxWait fires once with latest args and clears trailing', () => {
      const seen: string[] = []
      const d = debounce(
        (x: string) => {
          seen.push(x)
          return x
        },
        50,
        { maxWait: 60 }
      )
      d('a')
      vi.advanceTimersByTime(40)
      d('b')
      vi.advanceTimersByTime(20)
      assert.deepEqual(seen, ['b'])
      vi.advanceTimersByTime(100)
      assert.deepEqual(seen, ['b'])
    })

    it('SPEC-R56 debounce cancel prevents the pending call', () => {
      const seen: number[] = []
      const d = debounce((x: number) => {
        seen.push(x)
      }, 50)
      d(1)
      d.cancel()
      vi.advanceTimersByTime(100)
      assert.deepEqual(seen, [])
    })

    it('SPEC-R56 debounce flush invokes pending now', () => {
      const seen: number[] = []
      const d = debounce((x: number) => {
        seen.push(x)
        return x * 2
      }, 50)
      d(3)
      assert.equal(d.flush(), 6)
      assert.deepEqual(seen, [3])
      vi.advanceTimersByTime(100)
      assert.deepEqual(seen, [3])
    })

    it('SPEC-R56 debounce flush with nothing pending returns last result', () => {
      const d = debounce((x: number) => x * 2, 50)
      d(4)
      vi.advanceTimersByTime(50)
      assert.equal(d.flush(), 8)
      assert.equal(d.flush(), 8)
    })

    it('SPEC-R56 debounce maxWait < wait raised to wait', () => {
      const seen: string[] = []
      const d = debounce(
        (x: string) => {
          seen.push(x)
          return x
        },
        50,
        { maxWait: 10 }
      )
      d('a')
      d('b')
      vi.advanceTimersByTime(50)
      assert.deepEqual(seen, ['b'])
    })

    it('SPEC-R56 debounce clamps negative wait; rejects NaN and oversized', () => {
      const nop = (): undefined => undefined
      for (const wait of [2 ** 31, 1e10, Infinity, NaN]) {
        expect(() => debounce(nop, wait)).toThrow(RangeError)
        expect(() => debounce(nop, wait)).toThrow('wait must be between 0 and 2147483647 ms')
      }
      expect(() => debounce(nop, -1)).not.toThrow()
      expect(() => debounce(nop, 0)).not.toThrow()
      expect(() => debounce(nop, 2147483647)).not.toThrow()
      expect(() => debounce(nop, 10, { maxWait: Infinity })).toThrow(RangeError)
      expect(() => debounce(nop, 10, { maxWait: -5 })).not.toThrow()
      const seen: string[] = []
      const d = debounce((x: string) => {
        seen.push(x)
        return x
      }, -1)
      d('a')
      vi.advanceTimersByTime(0)
      assert.deepEqual(seen, ['a'])
    })

    it('SPEC-R56 debounce returns last result on intermediate calls', () => {
      const d = debounce((x: number) => x + 1, 50)
      assert.equal(d(1), undefined)
      vi.advanceTimersByTime(50)
      assert.equal(d(2), 2)
      vi.advanceTimersByTime(50)
      assert.equal(d(3), 3)
    })
  })

  describe('throttle', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('SPEC-R56 throttle clamps negative wait; rejects NaN and oversized', () => {
      const nop = (): undefined => undefined
      for (const wait of [2 ** 31, 1e10, Infinity, NaN]) {
        expect(() => throttle(nop, wait)).toThrow(RangeError)
        expect(() => throttle(nop, wait)).toThrow('wait must be between 0 and 2147483647 ms')
      }
      expect(() => throttle(nop, -1)).not.toThrow()
      expect(() => throttle(nop, 0)).not.toThrow()
      expect(() => throttle(nop, 2147483647)).not.toThrow()
      const seen: number[] = []
      const t = throttle((x: number) => {
        seen.push(x)
        return x
      }, -1)
      t(1)
      assert.deepEqual(seen, [1])
    })

    it('SPEC-R57 throttle leading and trailing with latest args', () => {
      const seen: number[] = []
      const t = throttle((x: number) => {
        seen.push(x)
        return x * 10
      }, 40)
      assert.equal(t(1), 10)
      assert.equal(t(2), 10)
      assert.equal(t(3), 10)
      assert.deepEqual(seen, [1])
      vi.advanceTimersByTime(100)
      assert.deepEqual(seen, [1, 3])
    })

    it('throttle wait 0: leading plus one trailing per macrotask', () => {
      const seen: number[] = []
      const t = throttle((x: number) => {
        seen.push(x)
        return x
      }, 0)
      t(1)
      t(2)
      t(3)
      assert.deepEqual(seen, [1])
      vi.advanceTimersByTime(0)
      assert.deepEqual(seen, [1, 3])
    })

    it('R15-E3: throttle cancel clears pending trailing call', () => {
      const seen: number[] = []
      const t = throttle((x: number) => {
        seen.push(x)
        return x
      }, 40)
      t(1)
      t(2)
      assert.deepEqual(seen, [1])
      t.cancel()
      vi.advanceTimersByTime(100)
      assert.deepEqual(seen, [1])
      t(3)
      assert.deepEqual(seen, [1, 3])
    })

    it('R15-E3: throttle flush invokes pending trailing once', () => {
      const seen: number[] = []
      const t = throttle((x: number) => {
        seen.push(x)
        return x * 10
      }, 40)
      assert.equal(t(1), 10)
      t(2)
      t(3)
      assert.deepEqual(seen, [1])
      assert.equal(t.flush(), 30)
      assert.deepEqual(seen, [1, 3])
      assert.equal(t.flush(), 30)
      vi.advanceTimersByTime(100)
      assert.deepEqual(seen, [1, 3])
    })
  })

  describe('once / result / resultAsync / promisify', () => {
    it('once invokes only on the first call', () => {
      let calls = 0
      const f = once((x: number) => {
        calls++
        return x
      })
      assert.equal(f(1), 1)
      assert.equal(f(2), 1)
      assert.equal(f(3), 1)
      assert.equal(calls, 1)
    })

    it('result returns [value, undefined] or [undefined, error]', () => {
      const ok = result((x: number) => x + 1)
      assert.deepEqual(ok(2), [3, undefined])
      const bad = result(() => {
        throw new Error('nope')
      })
      const [value, err] = bad()
      assert.equal(value, undefined)
      assert.ok(err instanceof Error)
      assert.equal(err.message, 'nope')
    })

    it('resultAsync awaits and catches', async () => {
      const ok = resultAsync((x: number) => Promise.resolve(x + 1))
      assert.deepEqual(await ok(2), [3, undefined])
      const bad = resultAsync(() => Promise.reject(new Error('async nope')))
      const [value, err] = await bad()
      assert.equal(value, undefined)
      assert.equal((err as Error).message, 'async nope')
    })

    it('promisify wraps node-style callbacks', async () => {
      const read = (path: string, cb: (err: Error | null, data: string) => void) => {
        if (path === 'bad') cb(new Error('fail'), '')
        else cb(null, `data:${path}`)
      }
      const readP = promisify(read)
      assert.equal(await readP('ok'), 'data:ok')
      await expect(readP('bad')).rejects.toThrow('fail')
    })

    it('promisify binds thisArg', async () => {
      const obj = { prefix: 'p' }
      function go(this: { prefix: string }, cb: (err: null, v: string) => void) {
        cb(null, this.prefix)
      }
      const goP = promisify(go, obj)
      assert.equal(await goP(), 'p')
    })
  })
})

describe('function wrappers', () => {
  it('reject a non-function at creation', () => {
    const notFunction = undefined as never
    const expected = new TypeError('Expected a function')
    for (const wrap of [
      () => curry(notFunction),
      () => partial(notFunction),
      () => memoize(notFunction),
      () => memoize((x: number) => x, 1 as never),
      () => cache(notFunction, {} as never),
      () => debounce(notFunction, 10),
      () => throttle(notFunction, 10),
      () => once(notFunction),
      () => result(notFunction),
      () => resultAsync(notFunction),
      () => promisify(notFunction),
      () => flow(notFunction),
      () => flow([notFunction]),
      () => compose(notFunction)
    ]) {
      expect(wrap).toThrow(expected)
    }
  })

  it('curry uses the latest this and an explicit arity', () => {
    const curried = curry(function (this: { n: number } | undefined, a: number, b: number) {
      return [this?.n, a, b]
    })
    const host = { n: 1, finish: curried(2) }
    assert.deepEqual(host.finish(3), [1, 2, 3])
    const variadic = curry((...args: number[]) => args, 2)
    assert.deepEqual(variadic(1)(2), [1, 2])
  })

  it('flow and compose return the first argument when empty', () => {
    assert.equal(flow()(1), 1)
    assert.equal(pipe()(1), 1)
    assert.equal(compose()(1), 1)
  })

  it('flow and compose flatten arrays one level', () => {
    const add1 = (x: number) => x + 1
    const mul2 = (x: number) => x * 2
    assert.equal(flow([add1, mul2])(1), 4)
    assert.equal(compose([add1, mul2])(1), 3)
    assert.equal(compose([add1], mul2)(1), 3)
  })

  it('once blocks reentrant calls and does not retry after a throw', () => {
    let calls = 0
    const reentrant: () => unknown = once(() => {
      calls++
      return reentrant()
    })
    assert.equal(reentrant(), undefined)
    assert.equal(calls, 1)

    let throws = 0
    const failing = once(() => {
      throws++
      throw new Error('boom')
    })
    assert.throws(failing, /boom/)
    assert.equal(failing(), undefined)
    assert.equal(throws, 1)
  })

  it('result and resultAsync replace a thrown undefined with an Error', async () => {
    const thrown = result(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw undefined
    })()
    assert.ok(thrown[1] instanceof Error)
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const rejected = await resultAsync(() => Promise.reject())()
    assert.ok(rejected[1] instanceof Error)
    assert.deepEqual(result(() => 0)(), [0, undefined])
  })

  it('promisify treats a falsy error as success and forwards this', async () => {
    type Callback = (err: Error | null | undefined, value: string) => void
    const falsyError = (err: unknown) => (cb: Callback) => {
      cb(err as Error, 'value')
    }
    assert.equal(await promisify(falsyError(0))(), 'value')
    assert.equal(await promisify(falsyError(''))(), 'value')
    const host = {
      prefix: 'p',
      read: promisify(function (this: { prefix: string }, cb: Callback) {
        cb(null, this.prefix)
      })
    }
    assert.equal(await host.read(), 'p')
  })
})

describe('memoize and cache stores', () => {
  const withFullMaps = (run: () => void): void => {
    const set = vi.spyOn(Map.prototype, 'set').mockImplementation(() => {
      throw new RangeError('Map maximum size exceeded')
    })
    try {
      run()
    } finally {
      set.mockRestore()
    }
  }

  it('memoize calls resolver with this', () => {
    const memoized = memoize(
      (x: number) => x,
      function (this: { id: number }) {
        return this.id
      }
    )
    assert.equal(memoized.call({ id: 1 }, 2), 2)
    assert.equal(memoized.cache.has(1), true)
  })

  it('memoize reads through memoized.cache', () => {
    const memoized = memoize((x: number) => x + 1)
    memoized(1)
    memoized.cache = new Map([[1, 100]])
    assert.equal(memoized(1), 100)
    assert.equal(memoized(2), 3)
    assert.equal(memoized.cache.size, 2)
    memoized.clear()
    assert.equal(memoized.cache.size, 0)
  })

  it('memoize returns the value when the store is full', () => {
    const memoized = memoize((x: number) => x + 1)
    withFullMaps(() => {
      assert.equal(memoized(1), 2)
    })
    assert.equal(memoized.cache.size, 0)
  })

  it('memoize still surfaces other store failures', () => {
    const memoized = memoize((x: number) => x + 1)
    memoized.cache = new (class extends Map<unknown, number> {
      override set(): never {
        throw new TypeError('bad store')
      }
    })()
    assert.throws(() => memoized(1), /bad store/)
  })

  it('cache returns the value when the store is full', () => {
    const method = cache(function (this: object, x: number) {
      return x + 1
    }, {} as never)
    withFullMaps(() => {
      assert.equal(method.call({}, 1), 2)
    })
  })

  it('cache calls the function uncached on a non-object this', () => {
    let calls = 0
    const method = cache(function (this: object, x: number) {
      calls++
      return x + 1
    }, {} as never)
    assert.equal(Reflect.apply(method, undefined, [1]), 2)
    assert.equal(Reflect.apply(method, undefined, [1]), 2)
    assert.equal(Reflect.apply(method, 5, [1]), 2)
    assert.equal(calls, 3)
  })
})

describe('debounce and throttle edges', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const recorder = (): { seen: number[]; fn: (x: number) => number } => {
    const seen: number[] = []
    return {
      seen,
      fn: (x) => {
        seen.push(x)
        return x
      }
    }
  }

  it('debounce leading fires on the first call and trailing on the last of a burst', () => {
    const { seen, fn } = recorder()
    const d = debounce(fn, 50, { leading: true })
    assert.equal(d(1), 1)
    vi.advanceTimersByTime(50)
    assert.deepEqual(seen, [1])
    d(2)
    d(3)
    vi.advanceTimersByTime(50)
    assert.deepEqual(seen, [1, 2, 3])
  })

  it('debounce trailing false drops the rest of the burst', () => {
    const { seen, fn } = recorder()
    const d = debounce(fn, 50, { leading: true, trailing: false })
    d(1)
    d(2)
    vi.advanceTimersByTime(50)
    assert.deepEqual(seen, [1])
    assert.equal(d.flush(), 1)
    d(3)
    assert.deepEqual(seen, [1, 3])
  })

  it('debounce with neither edge never invokes', () => {
    const { seen, fn } = recorder()
    const d = debounce(fn, 50, { leading: false, trailing: false })
    d(1)
    vi.advanceTimersByTime(100)
    assert.deepEqual(seen, [])
  })

  it('debounce leading does not fire again when maxWait starts a new window', () => {
    const { seen, fn } = recorder()
    const d = debounce(fn, 30, { leading: true, maxWait: 50 })
    for (let t = 0; t < 100; t += 10) {
      d(t)
      vi.advanceTimersByTime(10)
    }
    assert.deepEqual(seen, [0, 40, 90])
  })

  it('debounce and throttle default wait to 0 and read null as absent', () => {
    const { seen, fn } = recorder()
    const d = debounce(fn)
    d(1)
    vi.advanceTimersByTime(0)
    assert.deepEqual(seen, [1])
    expect(() => debounce(fn, null)).not.toThrow()
    expect(() => debounce(fn, 10, { maxWait: null })).not.toThrow()
    expect(() => throttle(fn)).not.toThrow()
    expect(() => throttle(fn, null)).not.toThrow()
  })

  it('a bad maxWait is named in the error', () => {
    const { fn } = recorder()
    expect(() => debounce(fn, 10, { maxWait: NaN })).toThrow(
      new RangeError('maxWait must be between 0 and 2147483647 ms')
    )
  })

  it('a reentrant throttled call waits for the window', () => {
    const seen: number[] = []
    const t = throttle((x: number): void => {
      seen.push(x)
      if (x < 3) t(x + 1)
    }, 100)
    t(1)
    assert.deepEqual(seen, [1])
    vi.advanceTimersByTime(100)
    assert.deepEqual(seen, [1, 2])
    vi.advanceTimersByTime(100)
    assert.deepEqual(seen, [1, 2, 3])
  })

  it('a reentrant call from the trailing edge waits too', () => {
    const seen: number[] = []
    const t = throttle((x: number): void => {
      seen.push(x)
      if (x === 2 && seen.length < 4) t(2)
    }, 100)
    t(1)
    t(2)
    vi.advanceTimersByTime(100)
    assert.deepEqual(seen, [1, 2])
    vi.advanceTimersByTime(100)
    assert.deepEqual(seen, [1, 2, 2])
  })

  it('throttle stays throttled when fn throws', () => {
    let calls = 0
    const t = throttle(() => {
      calls++
      throw new Error('boom')
    }, 100)
    assert.throws(t, /boom/)
    t()
    t()
    assert.equal(calls, 1)
    t.cancel()
  })

  it('a call right after throttle flush waits for the window', () => {
    const { seen, fn } = recorder()
    const t = throttle(fn, 100)
    t(1)
    t(2)
    assert.equal(t.flush(), 2)
    t(3)
    t(4)
    assert.deepEqual(seen, [1, 2])
    vi.advanceTimersByTime(100)
    assert.deepEqual(seen, [1, 2, 4])
  })

  it('throttle trailing false drops calls inside the window', () => {
    const { seen, fn } = recorder()
    const t = throttle(fn, 100, { trailing: false })
    t(1)
    t(2)
    vi.advanceTimersByTime(300)
    assert.deepEqual(seen, [1])
    t(3)
    assert.deepEqual(seen, [1, 3])
  })

  it('throttle leading false waits for the end of the window', () => {
    const { seen, fn } = recorder()
    const t = throttle(fn, 100, { leading: false })
    assert.equal(t(1), undefined)
    t(2)
    assert.deepEqual(seen, [])
    vi.advanceTimersByTime(100)
    assert.deepEqual(seen, [2])
  })
})
