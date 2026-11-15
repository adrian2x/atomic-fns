import { getEventListeners } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { retry, sleep, timeout } from '../src/async/index.ts'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const settled = async <T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> => {
  try {
    return { value: await promise }
  } catch (error) {
    return { error }
  }
}

describe('sleep', () => {
  it.each([false, true])('resolves after the wait with signal=%s', async (withSignal) => {
    const { signal } = new AbortController()
    let done = false
    const nap = sleep(100, withSignal ? { signal } : undefined).then((value) => {
      expect(value).toBeUndefined()
      done = true
    })
    await vi.advanceTimersByTimeAsync(99)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await nap
    expect(done).toBe(true)
    expect(getEventListeners(signal, 'abort')).toStrictEqual([])
  })

  it('rejects with the reason of a signal that aborts during the wait', async () => {
    const controller = new AbortController()
    const reason = new Error('stop')
    const nap = settled(sleep(1000, { signal: controller.signal }))
    await vi.advanceTimersByTimeAsync(10)
    controller.abort(reason)
    expect((await nap).error).toBe(reason)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects at once with the reason of an aborted signal', async () => {
    const reason = new Error('gone')
    const { error } = await settled(sleep(1000, { signal: AbortSignal.abort(reason) }))
    expect(error).toBe(reason)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clamps negative waits', async () => {
    const nap = sleep(-5)
    await vi.advanceTimersByTimeAsync(0)
    await expect(nap).resolves.toBeUndefined()
  })

  it('rejects waits setTimeout cannot hold', async () => {
    for (const ms of [Number.NaN, Number.POSITIVE_INFINITY, 2 ** 31]) {
      await expect(sleep(ms)).rejects.toThrow(
        new RangeError('ms must be between 0 and 2147483647 ms')
      )
    }
  })
})

describe('timeout', () => {
  it.each([false, true])(
    'settles with the promise when it wins with signal=%s',
    async (withSignal) => {
      const { signal } = new AbortController()
      const work = sleep(10).then(() => 'done')
      const result = timeout(work, 100, withSignal ? { signal } : undefined)
      await vi.advanceTimersByTimeAsync(10)
      await expect(result).resolves.toBe('done')
      expect(vi.getTimerCount()).toBe(0)
      expect(getEventListeners(signal, 'abort')).toStrictEqual([])
    }
  )

  it('passes a rejection through', async () => {
    const { error } = await settled(timeout(Promise.reject(new Error('boom')), 100))
    expect(error).toEqual(new Error('boom'))
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([false, true])(
    'rejects with a TimeoutError DOMException when the time runs out with signal=%s',
    async (withSignal) => {
      const { signal } = new AbortController()
      let done = false
      const result = settled(
        timeout(new Promise(() => {}), 100, withSignal ? { signal } : undefined)
      ).then((outcome) => {
        done = true
        return outcome
      })
      await vi.advanceTimersByTimeAsync(99)
      expect(done).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      const { error } = await result
      expect(error).toBeInstanceOf(DOMException)
      expect((error as DOMException).name).toBe('TimeoutError')
      expect(getEventListeners(signal, 'abort')).toStrictEqual([])
    }
  )

  it('rejects with the reason of an aborting signal', async () => {
    const controller = new AbortController()
    const reason = new Error('cancelled')
    const result = settled(timeout(new Promise(() => {}), 100, { signal: controller.signal }))
    controller.abort(reason)
    expect((await result).error).toBe(reason)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects at once with the reason of an aborted signal', async () => {
    const { error } = await settled(timeout(1, 100, { signal: AbortSignal.abort('gone') }))
    expect(error).toBe('gone')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('handles a later rejection of the promise when the signal is already aborted', async () => {
    const work = Promise.reject(new Error('late'))
    const result = timeout(work, 100, { signal: AbortSignal.abort('gone') })
    await expect(result).rejects.toBe('gone')
  })

  it('accepts plain values', async () => {
    await expect(timeout(1, 100)).resolves.toBe(1)
  })

  it('checks its wait as sleep does', async () => {
    await expect(timeout(Promise.resolve(), Number.NaN)).rejects.toThrow(RangeError)
  })

  it('handles a later rejection of the promise when its wait is refused', async () => {
    const work = Promise.reject(new Error('late'))
    await expect(timeout(work, Number.NaN)).rejects.toThrow(RangeError)
  })
})

describe('retry', () => {
  const flaky = (failures: number) => {
    const attempts: number[] = []
    const fn = (attempt: number) => {
      attempts.push(attempt)
      if (attempts.length <= failures) throw new Error(`fail ${attempt}`)
      return `ok ${attempt}`
    }
    return { attempts, fn }
  }

  it('returns the first success, backing off exponentially between attempts', async () => {
    const { attempts, fn } = flaky(3)
    const result = retry(fn, { jitter: false })
    await vi.advanceTimersByTimeAsync(0)
    expect(attempts).toEqual([1])
    await vi.advanceTimersByTimeAsync(100)
    expect(attempts).toEqual([1, 2])
    await vi.advanceTimersByTimeAsync(199)
    expect(attempts).toEqual([1, 2])
    await vi.advanceTimersByTimeAsync(1)
    expect(attempts).toEqual([1, 2, 3])
    await vi.advanceTimersByTimeAsync(400)
    await expect(result).resolves.toBe('ok 4')
  })

  it('rejects with the last error once the retries run out', async () => {
    const { attempts, fn } = flaky(Number.POSITIVE_INFINITY)
    const result = settled(retry(fn, { retries: 2, minDelay: 10, jitter: false }))
    await vi.advanceTimersByTimeAsync(100)
    expect((await result).error).toEqual(new Error('fail 3'))
    expect(attempts).toEqual([1, 2, 3])
  })

  it('makes 4 attempts by default', async () => {
    const { attempts, fn } = flaky(Number.POSITIVE_INFINITY)
    const result = settled(retry(fn))
    await vi.advanceTimersByTimeAsync(60_000)
    expect((await result).error).toEqual(new Error('fail 4'))
    expect(attempts).toEqual([1, 2, 3, 4])
  })

  it('caps the delay at maxDelay', async () => {
    const { attempts, fn } = flaky(3)
    const result = retry(fn, { minDelay: 10, maxDelay: 15, factor: 10, jitter: false })
    await vi.advanceTimersByTimeAsync(10 + 15 + 14)
    expect(attempts).toEqual([1, 2, 3])
    await vi.advanceTimersByTimeAsync(1)
    await expect(result).resolves.toBe('ok 4')
  })

  it('caps the delay at 10 s by default', async () => {
    const { attempts, fn } = flaky(8)
    const result = retry(fn, { retries: 8, jitter: false })
    await vi.advanceTimersByTimeAsync(100 + 200 + 400 + 800 + 1600 + 3200 + 6400)
    expect(attempts).toHaveLength(8)
    await vi.advanceTimersByTimeAsync(9999)
    expect(attempts).toHaveLength(8)
    await vi.advanceTimersByTimeAsync(1)
    await expect(result).resolves.toBe('ok 9')
  })

  it('raises the default maxDelay to a larger minDelay', async () => {
    const { attempts, fn } = flaky(1)
    const result = retry(fn, { minDelay: 30_000, jitter: false })
    await vi.advanceTimersByTimeAsync(29_999)
    expect(attempts).toEqual([1])
    await vi.advanceTimersByTimeAsync(1)
    await expect(result).resolves.toBe('ok 2')
  })

  it('keeps a zero delay at zero across exponent overflow', async () => {
    const start = Date.now()
    const { attempts, fn } = flaky(3)
    const result = retry(fn, { retries: 3, minDelay: 0, factor: 1e200, jitter: false })
    await vi.runAllTimersAsync()
    await expect(result).resolves.toBe('ok 4')
    expect(attempts).toStrictEqual([1, 2, 3, 4])
    expect(Date.now()).toBe(start)
  })

  it('awaits async work', async () => {
    let calls = 0
    const result = retry(
      async () => {
        calls++
        if (calls < 2) throw new Error('again')
        return calls
      },
      { minDelay: 10, jitter: false }
    )
    await vi.advanceTimersByTimeAsync(10)
    await expect(result).resolves.toBe(2)
  })

  it.each([
    [0, 49],
    [0.5, 74]
  ])('scales delay by 0.5 + random / 2 with random %s', async (random, before) => {
    vi.spyOn(Math, 'random').mockReturnValue(random)
    const { attempts, fn } = flaky(1)
    const result = retry(fn, { minDelay: 100 })
    await vi.advanceTimersByTimeAsync(before)
    expect(attempts).toStrictEqual([1])
    await vi.advanceTimersByTimeAsync(1)
    await expect(result).resolves.toBe('ok 2')
  })

  it('stops when shouldRetry says no', async () => {
    const seen: [string, number][] = []
    const { attempts, fn } = flaky(5)
    const result = settled(
      retry(fn, {
        jitter: false,
        shouldRetry: async (error, attempt) => {
          seen.push([(error as Error).message, attempt])
          return attempt < 2
        }
      })
    )
    await vi.advanceTimersByTimeAsync(1000)
    expect((await result).error).toEqual(new Error('fail 2'))
    expect(attempts).toEqual([1, 2])
    expect(seen).toEqual([
      ['fail 1', 1],
      ['fail 2', 2]
    ])
  })

  it('rejects with the abort reason during a wait', async () => {
    const controller = new AbortController()
    const { attempts, fn } = flaky(5)
    const result = settled(retry(fn, { signal: controller.signal, jitter: false }))
    await vi.advanceTimersByTimeAsync(50)
    controller.abort(new Error('stop'))
    expect((await result).error).toEqual(new Error('stop'))
    expect(attempts).toEqual([1])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects with the abort reason before the first attempt', async () => {
    const never = vi.fn()
    const aborted = await settled(retry(never, { signal: AbortSignal.abort('gone') }))
    expect(aborted.error).toBe('gone')
    expect(never).not.toHaveBeenCalled()
  })

  it('rejects with the abort reason without asking shouldRetry when it aborts mid-attempt', async () => {
    const controller = new AbortController()
    const shouldRetry = vi.fn(() => true)
    const result = settled(
      retry(
        async () => {
          controller.abort('mid-attempt')
          throw new Error('fail')
        },
        { signal: controller.signal, shouldRetry }
      )
    )
    expect((await result).error).toBe('mid-attempt')
    expect(shouldRetry).not.toHaveBeenCalled()
  })

  it('clamps a negative delay to 0', async () => {
    const { attempts, fn } = flaky(1)
    const result = retry(fn, { minDelay: -5, jitter: false })
    await vi.advanceTimersByTimeAsync(0)
    await expect(result).resolves.toBe('ok 2')
    expect(attempts).toEqual([1, 2])
  })

  it('retries without end with retries: Infinity', async () => {
    const { attempts, fn } = flaky(20)
    const result = retry(fn, { retries: Number.POSITIVE_INFINITY, minDelay: 1, maxDelay: 1 })
    await vi.advanceTimersByTimeAsync(20)
    await expect(result).resolves.toBe('ok 21')
    expect(attempts).toHaveLength(21)
  })

  it('throws on options out of range or of the wrong type before the first attempt', () => {
    const fn = vi.fn()
    for (const options of [
      { retries: -1 },
      { retries: 1.5 },
      { minDelay: Number.NaN },
      { maxDelay: 2 ** 31 },
      { minDelay: 200, maxDelay: 100 },
      { factor: 0.5 },
      { factor: Number.NaN },
      { factor: Number.POSITIVE_INFINITY }
    ]) {
      expect(() => retry(fn, options)).toThrow(RangeError)
    }
    expect(() => retry(fn, { minDelay: '5' as unknown as number })).toThrow(
      new TypeError('minDelay must be a number, got string')
    )
    expect(fn).not.toHaveBeenCalled()
    expect(() => retry(1 as never)).toThrow(new TypeError('fn must be a function'))
  })
})
