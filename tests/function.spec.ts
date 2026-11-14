import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import {
  compose,
  type Curried,
  curry,
  debounce,
  flow,
  type LooseFunction,
  memoize,
  once
} from '../src/function/index.ts'
import { throttle } from '../src/function/index.ts'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const recorder = <T>(): { seen: T[]; fn: (x: T) => T } => {
  const seen: T[] = []
  return {
    seen,
    fn: (x) => {
      seen.push(x)
      return x
    }
  }
}

function windowTests(wrap: typeof debounce) {
  it('cancel inside fn lets a reentrant call start fresh', () => {
    const seen: number[] = []
    const wrapped = wrap(
      (value: number) => {
        seen.push(value)
        if (value === 1) {
          wrapped.cancel()
          wrapped(2)
        }
      },
      50,
      { leading: true }
    )

    wrapped(1)

    expect(seen).toStrictEqual([1, 2])
    expect(wrapped.pending()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([false, true])(
    'a reentrant call waits even when fn blocks the loop: trailing %s',
    async (trailing) => {
      vi.useRealTimers()
      const seen: number[] = []
      const { promise: invoked, resolve: finish } = Promise.withResolvers<void>()
      const wrapped = wrap(
        (value: number) => {
          seen.push(value)
          if (value === 1) {
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30)
            wrapped(2)
          } else finish()
        },
        10,
        { leading: true, trailing }
      )

      try {
        wrapped(1)
        expect(seen).toStrictEqual([1])
        expect(wrapped.pending()).toBe(trailing)
        if (trailing) await invoked

        expect(seen).toStrictEqual(trailing ? [1, 2] : [1])
        expect(wrapped.pending()).toBe(false)
      } finally {
        wrapped.cancel()
      }
    }
  )

  it.each([false, true])(
    'an idle call after a blocked loop opens a new window: trailing %s',
    (trailing) => {
      vi.useRealTimers()
      const { seen, fn } = recorder<number>()
      const wrapped = wrap(fn, 10, { leading: true, trailing })

      try {
        wrapped(1)
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30)
        wrapped(2)

        expect(seen).toStrictEqual([1, 2])
      } finally {
        wrapped.cancel()
      }
    }
  )

  it('a held call keeps timer semantics through a blocked loop', async () => {
    vi.useRealTimers()
    const { seen, fn } = recorder<number>()
    const { promise: invoked, resolve: finish } = Promise.withResolvers<void>()
    const wrapped = wrap(
      (value: number) => {
        fn(value)
        if (value === 3) finish()
      },
      10,
      { leading: true }
    )

    try {
      wrapped(1)
      wrapped(2)
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30)
      wrapped(3)
      expect(seen).toStrictEqual([1])
      expect(wrapped.pending()).toBe(true)
      await invoked

      expect(seen).toStrictEqual([1, 3])
      expect(wrapped.pending()).toBe(false)
    } finally {
      wrapped.cancel()
    }
  })

  it.each([
    { leading: false, trailing: false },
    { leading: false, trailing: true },
    { leading: true, trailing: false },
    { leading: true, trailing: true }
  ])('preserves both edges across zero and positive waits: %o', (options) => {
    for (const wait of [0, 50]) {
      const { seen, fn } = recorder<number>()
      const wrapped = wrap(fn, wait, options)

      wrapped(1)
      wrapped(2)
      expect(seen).toStrictEqual(options.leading ? [1] : [])
      expect(wrapped.pending()).toBe(options.trailing)
      expect(vi.getTimerCount()).toBe(wait === 0 || options.trailing ? 1 : 0)
      vi.advanceTimersByTime(wait)
      expect(seen).toStrictEqual([
        ...(options.leading ? [1] : []),
        ...(options.trailing ? [2] : [])
      ])
      expect(wrapped.pending()).toBe(false)
      wrapped.cancel()
    }
  })

  it('a leading throw suppresses calls until the window expires', () => {
    const seen: number[] = []
    const wrapped = wrap(
      (value: number) => {
        seen.push(value)
        if (value === 1) throw new Error('boom')
        return value
      },
      50,
      { leading: true, trailing: false }
    )

    expect(() => wrapped(1)).toThrowError(new Error('boom'))
    vi.advanceTimersByTime(25)
    expect(wrapped(2)).toBeUndefined()
    expect(seen).toStrictEqual([1])
    vi.advanceTimersByTime(50)

    expect(wrapped(3)).toBe(3)
    expect(seen).toStrictEqual([1, 3])
  })
}

describe('debounce windows', () => windowTests(debounce))
describe('throttle windows', () => windowTests(throttle))

describe('debounce', () => {
  it.each([
    { leading: true, trailing: false },
    { leading: true, trailing: true },
    { leading: true, trailing: true, maxWait: 100 }
  ])('an idle window holds no timer: %o', (options) => {
    const { seen, fn } = recorder<number>()
    const wrapped = debounce(fn, 50, options)

    wrapped(1)
    expect(vi.getTimerCount()).toBe(0)
    wrapped(2)
    if (options.trailing) vi.advanceTimersByTime(50)

    expect(seen).toStrictEqual(options.trailing ? [1, 2] : [1])
    expect(wrapped.pending()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([0, 50])('a leading throw leaves the debounce window open at wait %i', (wait) => {
    const seen: number[] = []
    const d = debounce(
      (value: number) => {
        seen.push(value)
        throw new Error('boom')
      },
      wait,
      { leading: true, trailing: false }
    )

    expect(() => d(1)).toThrowError(new Error('boom'))
    d(2)
    expect(seen).toStrictEqual([1])
    expect(vi.getTimerCount()).toBe(wait === 0 ? 1 : 0)
    d.cancel()
    expect(() => d(3)).toThrowError(new Error('boom'))
    expect(seen).toStrictEqual([1, 3])
    d.cancel()
  })

  it.each([0, 50])('a reentrant leading debounce call waits at wait %i', (wait) => {
    const seen: number[] = []
    const d = debounce(
      (value: number) => {
        seen.push(value)
        if (value === 1) d(2)
      },
      wait,
      { leading: true, maxWait: 100 }
    )

    d(1)
    expect(seen).toStrictEqual([1])
    expect(d.pending()).toBe(true)
    vi.advanceTimersByTime(wait)

    expect(seen).toStrictEqual([1, 2])
    expect(d.pending()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('debounce trailing uses latest args', () => {
    const { seen, fn } = recorder<string>()
    const d = debounce(fn, 50)
    d('a')
    vi.advanceTimersByTime(10)
    d('b')
    vi.advanceTimersByTime(50)
    expect(seen).toEqual(['b'])
  })

  it('debounce maxWait fires once with the latest args', () => {
    const { seen, fn } = recorder<string>()
    const d = debounce(fn, 50, { maxWait: 60 })
    d('a')
    vi.advanceTimersByTime(40)
    d('b')
    vi.advanceTimersByTime(19)
    expect(seen).toEqual([])
    vi.advanceTimersByTime(1)
    expect(seen).toEqual(['b'])
    expect(d.pending()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(100)
    expect(seen).toStrictEqual(['b'])
  })

  it('debounce maxWait window restarts after the trailing call', () => {
    const { seen, fn } = recorder<number>()
    const d = debounce(fn, 50, { maxWait: 100 })
    d(0)
    vi.advanceTimersByTime(50)
    expect(seen).toEqual([0])
    vi.advanceTimersByTime(10)
    for (const t of [60, 90, 120, 150]) {
      d(t)
      vi.advanceTimersByTime(t === 150 ? 9 : 30)
    }
    expect(seen).toEqual([0])
    vi.advanceTimersByTime(1)
    expect(seen).toEqual([0, 150])
  })

  it('debounce maxWait below wait is raised to wait', () => {
    const { seen, fn } = recorder<string>()
    const d = debounce(fn, 50, { maxWait: 10 })
    d('a')
    d('b')
    vi.advanceTimersByTime(10)
    expect(seen).toEqual([])
    vi.advanceTimersByTime(40)
    expect(seen).toEqual(['b'])
  })

  it('debounce cancel prevents the pending call', () => {
    const { seen, fn } = recorder<number>()
    const d = debounce(fn, 50)
    d(1)
    d.cancel()
    expect(d.pending()).toBe(false)
    vi.advanceTimersByTime(100)
    expect(seen).toEqual([])
  })

  it('debounce flush invokes pending now', () => {
    const seen: number[] = []
    const d = debounce((x: number) => {
      seen.push(x)
      return x * 2
    }, 50)
    d(3)
    expect(d.flush()).toBe(6)
    expect(vi.getTimerCount()).toBe(0)
    expect(seen).toEqual([3])
    vi.advanceTimersByTime(100)
    expect(seen).toEqual([3])
  })

  it('debounce flush ends the burst', () => {
    const { seen, fn } = recorder<number>()
    const d = debounce(fn, 50, { leading: true })
    d(1)
    d(2)
    expect(d.flush()).toBe(2)
    expect(d(3)).toBe(3)
    expect(seen).toEqual([1, 2, 3])
  })

  it('debounce flush with nothing pending returns last result', () => {
    const d = debounce((x: number) => x * 2, 50)
    d(4)
    vi.advanceTimersByTime(50)
    expect(d.flush()).toBe(8)
    expect(d.flush()).toBe(8)
  })

  it('debounce returns last result on intermediate calls', () => {
    const d = debounce((x: number) => x + 1, 50)
    expect(d(1)).toBeUndefined()
    vi.advanceTimersByTime(50)
    expect(d(2)).toBe(2)
    vi.advanceTimersByTime(50)
    expect(d(3)).toBe(3)
  })

  it('debounce leading fires on the first call of a burst', () => {
    const { seen, fn } = recorder<number>()
    const d = debounce(fn, 50, { leading: true })
    expect(d(1)).toBe(1)
    expect(seen).toEqual([1])
    vi.advanceTimersByTime(50)
    expect(seen).toEqual([1])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('debounce leading with trailing also fires on the last call of a burst', () => {
    const { seen, fn } = recorder<number>()
    const d = debounce(fn, 50, { leading: true })
    d(1)
    d(2)
    d(3)
    vi.advanceTimersByTime(50)
    expect(seen).toEqual([1, 3])
  })

  it('debounce trailing false drops the rest of the burst', () => {
    const { seen, fn } = recorder<number>()
    const d = debounce(fn, 50, { leading: true, trailing: false })
    d(1)
    d(2)
    expect(d.pending()).toBe(false)
    vi.advanceTimersByTime(50)
    expect(seen).toEqual([1])
    expect(d.flush()).toBe(1)
    d(3)
    expect(seen).toEqual([1, 3])
  })

  it('debounce flush does not run a call that trailing false drops', () => {
    const { seen, fn } = recorder<number>()
    const leadingOnly = debounce(fn, 50, { leading: true, trailing: false })
    leadingOnly(1)
    leadingOnly(2)
    expect(leadingOnly.flush()).toBe(1)
    expect(seen).toEqual([1])
    const neither = debounce(fn, 50, { leading: false, trailing: false })
    neither(3)
    expect(neither.flush()).toBeUndefined()
    vi.advanceTimersByTime(100)
    expect(seen).toEqual([1])
  })

  it('debounce with neither edge never invokes', () => {
    const { seen, fn } = recorder<number>()
    const d = debounce(fn, 50, { leading: false, trailing: false })
    d(1)
    vi.advanceTimersByTime(100)
    expect(seen).toEqual([])
  })

  it('debounce leading does not fire again when maxWait starts a new window', () => {
    const seen: number[][] = []
    const d = debounce((value: number) => seen.push([value, performance.now()]), 30, {
      leading: true,
      maxWait: 50
    })
    for (let t = 0; t < 100; t += 10) {
      d(t)
      vi.advanceTimersByTime(t === 0 ? 10.5 : t === 10 ? 9.5 : 10)
    }
    expect(seen).toStrictEqual([
      [0, 0],
      [40, 50],
      [90, 100]
    ])
  })

  it('debounce maxWait has no effect when trailing is false', () => {
    const { seen, fn } = recorder<number>()
    const d = debounce(fn, 30, { trailing: false, maxWait: 50 })
    d(1)
    vi.advanceTimersByTime(25)
    d(2)
    expect(d.pending()).toBe(false)
    vi.advanceTimersByTime(100)
    expect(seen).toEqual([])
    const leadingOnly = debounce(fn, 30, { leading: true, trailing: false, maxWait: 50 })
    for (let t = 0; t < 100; t += 10) {
      leadingOnly(t)
      expect(leadingOnly.pending()).toBe(false)
      vi.advanceTimersByTime(10)
    }
    vi.advanceTimersByTime(100)
    expect(seen).toEqual([0])
  })

  it('debounce pending is true while a call is held and false once it runs', () => {
    const { fn } = recorder<number>()
    const d = debounce(fn, 50)
    expect(d.pending()).toBe(false)
    d(1)
    expect(d.pending()).toBe(true)
    vi.advanceTimersByTime(50)
    expect(d.pending()).toBe(false)
  })

  it('debounce holds a call made from inside fn for the next burst', () => {
    const seen: number[] = []
    const d = debounce((x: number) => {
      seen.push(x)
      if (x === 1) d(2)
    }, 50)
    d(1)
    vi.advanceTimersByTime(50)
    expect(seen).toEqual([1])
    expect(d.pending()).toBe(true)
    vi.advanceTimersByTime(50)
    expect(seen).toEqual([1, 2])
  })

  it('debounce does not run a call again after fn throws', () => {
    let calls = 0
    const d = debounce(() => {
      calls++
      throw new Error('boom')
    }, 50)
    d()
    expect(() => d.flush()).toThrow('boom')
    expect(d.pending()).toBe(false)
    expect(d.flush()).toBeUndefined()
    expect(calls).toBe(1)
  })

  it('debounce rejects a non-number wait or maxWait with TypeError', () => {
    const { fn } = recorder<number>()
    expect(() => debounce(fn, '100' as never)).toThrow(
      new TypeError('wait must be a number, got string')
    )
    expect(() => debounce(fn, 10, { maxWait: '50' as never })).toThrow(
      new TypeError('maxWait must be a number, got string')
    )
  })

  it('debounce rejects NaN, infinite and oversized waits with RangeError', () => {
    const { fn } = recorder<number>()
    for (const wait of [2 ** 31, 1e10, Infinity, -Infinity, NaN]) {
      expect(() => debounce(fn, wait)).toThrow(
        new RangeError('wait must be between 0 and 2147483647 ms')
      )
    }
    for (const maxWait of [Infinity, NaN]) {
      expect(() => debounce(fn, 10, { maxWait })).toThrow(
        new RangeError('maxWait must be between 0 and 2147483647 ms')
      )
    }
  })

  it.each([0, 2147483647])('debounce invokes at the accepted wait boundary %i', (wait) => {
    const { seen, fn } = recorder<number>()
    const d = debounce(fn, wait)
    d(1)
    if (wait > 0) vi.advanceTimersByTime(wait - 1)
    expect(seen).toStrictEqual([])
    vi.advanceTimersByTime(wait > 0 ? 1 : 0)
    expect(seen).toStrictEqual([1])
  })

  it('debounce invokes at the largest accepted maxWait boundary', () => {
    const { seen, fn } = recorder<number>()
    const d = debounce(fn, 2147483647, { maxWait: 2147483647 })
    d(1)
    vi.advanceTimersByTime(1)
    d(2)
    vi.advanceTimersByTime(2147483645)
    expect(seen).toStrictEqual([])
    vi.advanceTimersByTime(1)
    expect(seen).toStrictEqual([2])
    vi.advanceTimersByTime(1)
    expect(seen).toStrictEqual([2])
  })

  it('debounce clamps a negative wait to 0', () => {
    const { seen, fn } = recorder<string>()
    expect(() => debounce(fn, 10, { maxWait: -5 })).not.toThrow()
    const d = debounce(fn, -1)
    d('a')
    vi.advanceTimersByTime(0)
    expect(seen).toEqual(['a'])
  })

  it('debounce treats a null maxWait as absent', () => {
    const { seen, fn } = recorder<string>()
    const d = debounce(fn, 50, { maxWait: null })
    d('a')
    vi.advanceTimersByTime(40)
    d('b')
    vi.advanceTimersByTime(10)
    expect(seen).toStrictEqual([])
    vi.advanceTimersByTime(39)
    expect(seen).toStrictEqual([])
    vi.advanceTimersByTime(1)
    expect(seen).toStrictEqual(['b'])
  })

  it('debounce keeps this', () => {
    const seen: number[] = []
    const counter = {
      step: 2,
      save: debounce(function (this: { step: number }) {
        seen.push(this.step)
      }, 100)
    }
    counter.save()
    vi.advanceTimersByTime(100)
    expect(seen).toEqual([2])
  })

  it('debounce with maxWait passes the latest this', () => {
    const seen: string[] = []
    const save = debounce(
      function (this: { name: string }) {
        seen.push(this.name)
      },
      100,
      { maxWait: 150 }
    )
    const first = { name: 'first', save }
    const second = { name: 'second', save }
    first.save()
    vi.advanceTimersByTime(90)
    second.save()
    vi.advanceTimersByTime(60)
    expect(seen).toEqual(['second'])
  })

  it('debounce types this from fn', () => {
    const step = debounce(function (this: { step: number }) {
      return this.step
    }, 100)
    // @ts-expect-error fn needs a `this` of type { step: number }
    step()
    step.cancel()
  })

  it('debounce defaults the wait to 0 and reads null as absent', () => {
    const { seen, fn } = recorder<number>()
    debounce(fn)(1)
    debounce(fn, null)(2)
    expect(seen).toStrictEqual([])
    vi.advanceTimersByTime(0)
    expect(seen).toStrictEqual([1, 2])
  })
})

describe('throttle', () => {
  it.each([
    { leading: true, trailing: false },
    { leading: true, trailing: true }
  ])('an idle window holds no timer: %o', (options) => {
    const { seen, fn } = recorder<number>()
    const wrapped = throttle(fn, 50, options)

    wrapped(1)
    expect(vi.getTimerCount()).toBe(0)
    wrapped(2)
    if (options.trailing) vi.advanceTimersByTime(50)

    expect(seen).toStrictEqual(options.trailing ? [1, 2] : [1])
    expect(wrapped.pending()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('throttle checks its wait', () => {
    const nop = (): undefined => undefined
    expect(() => throttle(nop, NaN)).toThrowError(
      new RangeError('wait must be between 0 and 2147483647 ms')
    )
  })

  it('throttle leading and trailing with latest args', () => {
    const seen: number[] = []
    const t = throttle((x: number) => {
      seen.push(x)
      return x * 10
    }, 40)
    expect(t(1)).toBe(10)
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(10.5)
    expect(t(2)).toBe(10)
    expect(t(3)).toBe(10)
    vi.advanceTimersByTime(28.5)
    expect(seen).toStrictEqual([1])
    vi.advanceTimersByTime(1)
    expect(seen).toStrictEqual([1, 3])
  })

  it('throttle wait 0: leading plus one trailing per macrotask', () => {
    const { seen, fn } = recorder()
    const t = throttle(fn, 0)
    t(1)
    t(2)
    t(3)
    expect(seen).toEqual([1])
    vi.advanceTimersByTime(0)
    expect(seen).toEqual([1, 3])
  })

  it('throttle cancel drops the trailing call and ends the window', () => {
    const { seen, fn } = recorder()
    const t = throttle(fn, 40)
    t(1)
    t(2)
    expect(seen).toEqual([1])
    t.cancel()
    t(3)
    expect(t.pending()).toBe(false)
    expect(seen).toEqual([1, 3])
    vi.advanceTimersByTime(100)
    expect(seen).toEqual([1, 3])
  })

  it('throttle flush invokes pending trailing once', () => {
    const seen: number[] = []
    const t = throttle((x: number) => {
      seen.push(x)
      return x * 10
    }, 40)
    expect(t(1)).toBe(10)
    t(2)
    t(3)
    expect(seen).toEqual([1])
    expect(t.flush()).toBe(30)
    expect(vi.getTimerCount()).toBe(0)
    expect(seen).toEqual([1, 3])
    expect(t.flush()).toBe(30)
    vi.advanceTimersByTime(100)
    expect(seen).toEqual([1, 3])
  })

  it.each([undefined, null])('throttle treats wait %s as 0', (wait) => {
    const { seen, fn } = recorder()
    const t = wait === undefined ? throttle(fn) : throttle(fn, wait)
    t(1)
    t(2)
    vi.advanceTimersByTime(0)
    expect(seen).toEqual([1, 2])
  })

  it('a reentrant throttled call waits for the window', () => {
    const seen: number[] = []
    const t = throttle((x: number): void => {
      seen.push(x)
      if (x < 3) t(x + 1)
    }, 100)
    t(1)
    expect(seen).toEqual([1])
    vi.advanceTimersByTime(100)
    expect(seen).toEqual([1, 2])
    vi.advanceTimersByTime(100)
    expect(seen).toEqual([1, 2, 3])
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
    expect(seen).toEqual([1, 2])
    vi.advanceTimersByTime(100)
    expect(seen).toEqual([1, 2, 2])
  })

  it('throttle stays throttled when fn throws', () => {
    let calls = 0
    const t = throttle(() => {
      calls++
      throw new Error('boom')
    }, 100)
    expect(t).toThrow(/boom/)
    t()
    t()
    expect(calls).toBe(1)
    t.cancel()
  })

  it('a call right after throttle flush waits for the window', () => {
    const { seen, fn } = recorder()
    const t = throttle(fn, 100)
    t(1)
    t(2)
    expect(t.flush()).toBe(2)
    t(3)
    t(4)
    expect(seen).toEqual([1, 2])
    vi.advanceTimersByTime(100)
    expect(seen).toEqual([1, 2, 4])
  })

  it('throttle flush restarts the window from the flush', () => {
    const { seen, fn } = recorder()
    const t = throttle(fn, 100)
    t(1)
    vi.advanceTimersByTime(60)
    t(2)
    t.flush()
    vi.advanceTimersByTime(50)
    t(3)
    expect(seen).toEqual([1, 2])
    vi.advanceTimersByTime(60)
    expect(seen).toEqual([1, 2, 3])
  })

  it('throttle trailing false drops calls inside the window', () => {
    const { seen, fn } = recorder()
    const t = throttle(fn, 100, { trailing: false })
    t(1)
    t(2)
    vi.advanceTimersByTime(300)
    expect(seen).toEqual([1])
    t(3)
    expect(seen).toEqual([1, 3])
  })

  it('throttle leading false waits for the end of the window', () => {
    const { seen, fn } = recorder()
    const t = throttle(fn, 100, { leading: false })
    expect(t(1)).toBeUndefined()
    t(2)
    expect(seen).toEqual([])
    vi.advanceTimersByTime(100)
    expect(seen).toEqual([2])
  })

  it('throttle keeps this', () => {
    const seen: number[] = []
    const counter = {
      step: 2,
      save: throttle(function (this: { step: number }) {
        seen.push(this.step)
      }, 100)
    }
    counter.save()
    expect(seen).toEqual([2])
  })

  it('throttle types this from fn', () => {
    const step = throttle(
      function (this: { step: number }) {
        return this.step
      },
      100,
      { leading: false }
    )
    // @ts-expect-error fn needs a `this` of type { step: number }
    step()
    step.cancel()
  })

  it('throttle pending reports a trailing call', () => {
    const { seen, fn } = recorder()
    const t = throttle(fn, 100)
    t(1)
    expect(t.pending()).toBe(false)
    t(2)
    expect(t.pending()).toBe(true)
    vi.advanceTimersByTime(100)
    expect(t.pending()).toBe(false)
    expect(seen).toEqual([1, 2])
  })
})

describe('curry', () => {
  it('curry accumulates until arity then applies', () => {
    const add = (a: number, b: number, c: number) => a + b + c
    const curried = curry(add)
    expect(curried(1)(2)(3)).toBe(6)
    expect(curried(1, 2)(3)).toBe(6)
    expect(curried(1)(2, 3)).toBe(6)
    expect(curried(1, 2, 3)).toBe(6)
  })

  it('curry types each partial application and the result', () => {
    const curried = curry((a: number, b: string, c: boolean) => `${a}${b}${c}`)
    expectTypeOf(curried).toEqualTypeOf<Curried<[a: number, b: string, c: boolean], string>>()
    expectTypeOf(curried(1)('x')(true)).toEqualTypeOf<string>()
    expectTypeOf(curried(1, 'x')(true)).toEqualTypeOf<string>()
    expectTypeOf(curried(1, 'x', true)).toEqualTypeOf<string>()
    expectTypeOf(curried(1)).toEqualTypeOf<Curried<[b: string, c: boolean], string>>()
    expectTypeOf(curry((a: number, b?: number) => a + (b ?? 0))(1)).toEqualTypeOf<number>()
    expectTypeOf(curry(() => 1)()).toEqualTypeOf<number>()
    const misuses = [
      // @ts-expect-error a wrong argument type is rejected
      () => curried('1', 'x', true),
      // @ts-expect-error the result is not callable once every parameter is given
      () => curried(1)('x')(true)(0)
    ]
    expectTypeOf(misuses).toBeArray()
  })

  it('curry partial applications can be reused', () => {
    const curried = curry((a: number, b: number, c: number) => a + b + c)
    const inc = curried(1)
    expect(inc(2)(3)).toBe(6)
    expect(inc(10)(20)).toBe(31)
    const incTwice = inc(2)
    expect(incTwice(3)).toBe(6)
    expect(incTwice(4)).toBe(7)
  })

  it('curry uses the latest this and an explicit arity', () => {
    const curried = curry(function (this: { n: number } | undefined, a: number, b: number) {
      return [this?.n, a, b]
    })
    const host = { n: 1, finish: curried(2) }
    expect(host.finish(3)).toEqual([1, 2, 3])
    const variadic = curry((...args: number[]) => args, 2)
    expectTypeOf(variadic).toEqualTypeOf<LooseFunction>()
    expect(variadic(1)(2)).toEqual([1, 2])
    expect(curry((a: number) => a, 0)()).toBeUndefined()
  })
})

describe('flow and compose', () => {
  it('flow applies left to right', () => {
    const add1 = (x: number) => x + 1
    const mul2 = (x: number) => x * 2
    expect(flow(add1, mul2)(3)).toBe(8)
    expect(flow(mul2, add1)(3)).toBe(7)
  })

  it('flow forwards all arguments to the first function', () => {
    expect(
      flow(
        (a: number, b: number) => a + b,
        (x: number) => x * 2
      )(1, 2)
    ).toBe(6)
  })

  it('flow forwards this to the first function', () => {
    const obj = { n: 10 }
    function add(this: { n: number }, a: number) {
      return this.n + a
    }
    expect(flow(add, (x: number) => x * 2).call(obj, 3)).toBe(26)
  })

  it('flow and compose run every function with the caller this', () => {
    const obj = { a: 1, b: 10 }
    function first(this: typeof obj) {
      return this.a
    }
    function second(this: typeof obj, x: number) {
      return x + this.b
    }
    expect(flow(first, second).call(obj)).toBe(11)
    expect(compose(second, first).call(obj)).toBe(11)
  })

  it('flow chains argument and return types', () => {
    expectTypeOf(
      flow(
        (a: number, b: string) => a + b.length,
        (n: number) => String(n)
      )
    ).toEqualTypeOf<(a: number, b: string) => string>()
  })

  it('compose applies right to left', () => {
    const add1 = (x: number) => x + 1
    const mul2 = (x: number) => x * 2
    expect(compose(add1, mul2)(3)).toBe(7)
    expect(compose(mul2, add1)(3)).toBe(8)
  })

  it('compose does not reverse an array passed to it', () => {
    const add1 = (x: number) => x + 1
    const mul2 = (x: number) => x * 2
    const fns = [add1, mul2]
    expect(compose(fns)(3)).toBe(7)
    expect(fns).toEqual([add1, mul2])
  })

  it('compose chains argument and return types', () => {
    expectTypeOf(
      compose(
        (n: number) => String(n),
        (a: number, b: string) => a + b.length
      )
    ).toEqualTypeOf<(a: number, b: string) => string>()
    expectTypeOf(
      compose(
        (n: number) => n * 2,
        (s: string) => s.length
      )
    ).toEqualTypeOf<(s: string) => number>()
  })

  it('flow and compose return the first argument when empty', () => {
    expect(flow()(1)).toBe(1)
    expect(compose()(1)).toBe(1)
  })

  it('flow and compose flatten arrays one level', () => {
    const add1 = (x: number) => x + 1
    const mul2 = (x: number) => x * 2
    expect(flow([add1, mul2])(1)).toBe(4)
    expect(compose([add1, mul2])(1)).toBe(3)
    expect(compose([add1], mul2)(1)).toBe(3)
  })

  it('flow and compose refuse holes in a nested array', () => {
    const add1 = (x: number) => x + 1
    const sparse = new Array<(x: number) => number>(3)
    sparse[0] = add1
    sparse[2] = add1
    expect(() => flow(sparse)).toThrow(TypeError)
    expect(() => compose(sparse)).toThrow(TypeError)
    expect(() => flow(new Array<(x: number) => number>(2))).toThrow(TypeError)
  })

  it('flow chains any number of functions of one type', () => {
    const steps = [(x: number) => x + 1, (x: number) => x * 2, (x: number) => x - 3]
    expect(flow(...steps)(2)).toBe(3)
  })
})

describe('memoize', () => {
  it('memoize caches undefined results via Map.has', () => {
    let calls = 0
    const fn = memoize((x: number): number | undefined => {
      calls++
      return x < 0 ? x : undefined
    })
    expect(fn(1)).toBeUndefined()
    expect(fn(1)).toBeUndefined()
    expect(fn(1)).toBeUndefined()
    expect(calls).toBe(1)
    expect(fn(2)).toBeUndefined()
    expect(calls).toBe(2)
  })

  it('memoize uses resolver and caller this', () => {
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
    expect(mem.call(obj, 1, 2)).toBe(13)
    expect(mem.call(obj, 1, 2)).toBe(13)
    expect(calls).toBe(1)
    expect(mem.call(obj, 1, 3)).toBe(14)
    expect(calls).toBe(2)
  })

  it('memoize resolver throwing propagates and caches nothing', () => {
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
    expect(() => fn(1)).toThrow(/bad key/)
    expect(calls).toBe(0)
    expect(() => fn(1)).toThrow(/bad key/)
    expect(calls).toBe(0)
  })

  it('memoize exposes its cache', () => {
    let calls = 0
    const fn = memoize((x: number) => {
      calls++
      return x * 2
    })
    expect(fn(1)).toBe(2)
    expect(fn.cache.get(1)).toBe(2)
    fn.cache.clear()
    expect(fn.cache.size).toBe(0)
    expect(fn(1)).toBe(2)
    expect(calls).toBe(2)
  })

  it('memoize calls resolver with this', () => {
    const memoized = memoize(
      (x: number) => x,
      function (this: { id: number }) {
        return this.id
      }
    )
    expect(memoized.call({ id: 1 }, 2)).toBe(2)
    expect(memoized.cache.has(1)).toBe(true)
  })

  it('memoize reads through memoized.cache', () => {
    const memoized = memoize((x: number) => x + 1)
    memoized(1)
    memoized.cache = new Map([[1, 100]])
    expect(memoized(1)).toBe(100)
    expect(memoized(2)).toBe(3)
    expect(memoized.cache.size).toBe(2)
    memoized.cache.clear()
    expect(memoized.cache.size).toBe(0)
  })

  it('memoize still surfaces other store failures', () => {
    const memoized = memoize((x: number) => x + 1)
    memoized.cache = new (class extends Map<unknown, number> {
      override set(): never {
        throw new TypeError('bad store')
      }
    })()
    expect(() => memoized(1)).toThrow(/bad store/)
  })

  it('memoize surfaces a RangeError from a store that is not a Map', () => {
    const memoized = memoize((x: number) => x + 1)
    const store = new Map<unknown, number>()
    memoized.cache = {
      get: (key) => store.get(key),
      set: () => {
        throw new RangeError('store full')
      },
      has: (key) => store.has(key),
      delete: (key) => store.delete(key),
      clear: () => store.clear(),
      get size() {
        return store.size
      }
    }
    expect(() => memoized(1)).toThrow(RangeError)
  })

  it('memoize takes any store with the Map interface', () => {
    const seen: unknown[] = []
    const memoized = memoize((x: number) => x * 2)
    const store = new Map<unknown, number>()
    memoized.cache = {
      get: (key) => store.get(key),
      set: (key, value) => {
        seen.push(key)
        return store.set(key, value)
      },
      has: (key) => store.has(key),
      delete: (key) => store.delete(key),
      clear: () => store.clear(),
      get size() {
        return store.size
      }
    }
    expect(memoized(2)).toBe(4)
    expect(memoized(2)).toBe(4)
    expect(seen).toEqual([2])
  })
})

describe('once', () => {
  it('once invokes only on the first call', () => {
    let calls = 0
    const f = once((x: number) => {
      calls++
      return x
    })
    expect(f(1)).toBe(1)
    expect(f(2)).toBe(1)
    expect(f(3)).toBe(1)
    expect(calls).toBe(1)
  })

  it('once blocks a reentrant call', () => {
    let calls = 0
    const reentrant: () => unknown = once(() => {
      calls++
      return reentrant()
    })
    expect(reentrant()).toBeUndefined()
    expect(calls).toBe(1)
  })

  it('once does not retry after a throw', () => {
    let throws = 0
    const failing = once(() => {
      throws++
      throw new Error('boom')
    })
    expect(failing).toThrow(/boom/)
    expect(failing()).toBeUndefined()
    expect(throws).toBe(1)
  })

  it('once types the result as possibly undefined', () => {
    expectTypeOf(once((x: number) => x)).toEqualTypeOf<(x: number) => number | undefined>()
  })

  it('once keeps this', () => {
    const counter = {
      step: 2,
      first: once(function (this: { step: number }) {
        return this.step
      })
    }
    expect(counter.first()).toBe(2)
    expect(counter.first()).toBe(2)
  })
})

describe('wrappers', () => {
  it('reject a non-function at creation', () => {
    const notFunction = undefined as never
    const cases: [wrap: () => unknown, message: string][] = [
      [() => curry(notFunction), 'fn must be a function'],
      [() => memoize(notFunction), 'fn must be a function'],
      [() => memoize((x: number) => x, 1 as never), 'resolver must be a function'],
      [() => debounce(notFunction, 10), 'fn must be a function'],
      [() => debounce('x' as never), 'fn must be a function'],
      [() => throttle(notFunction, 10), 'fn must be a function'],
      [() => throttle('x' as never), 'fn must be a function'],
      [() => once(notFunction), 'fn must be a function'],
      [() => flow(notFunction), 'each argument must be a function'],
      [() => flow([notFunction]), 'each argument must be a function'],
      [() => compose(notFunction), 'each argument must be a function']
    ]
    for (const [wrap, message] of cases) {
      expect(wrap).toThrow(new TypeError(message))
    }
  })

  it('curry rejects an arity that is not a non-negative safe integer', () => {
    const add = (a: number, b: number) => a + b
    for (const arity of [Number.NaN, Number.POSITIVE_INFINITY, 1.5, -1, 2 ** 53]) {
      expect(() => curry(add, arity)).toThrow(RangeError)
    }
  })
})
