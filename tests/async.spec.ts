import { getEventListeners } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sleep, timeout } from '../src/async/index.ts'

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
