import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { debounce } from '../src/function/index.ts'

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
})
