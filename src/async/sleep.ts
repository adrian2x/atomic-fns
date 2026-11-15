import { timerWait } from '../internal/timer.ts'

/** Options for {@link sleep}. */
export interface SleepOptions {
  /** Rejects the wait with the signal's `reason` when it aborts. */
  signal?: AbortSignal
}

/** Options for {@link timeout}. */
export interface TimeoutOptions {
  /** Rejects with the signal's `reason` when it aborts before the promise settles. */
  signal?: AbortSignal
}

/**
 * Resolves after `ms` milliseconds. An aborted `signal` rejects with its `reason`, at once when it
 * is already aborted. Negative waits clamp to 0; NaN, infinite or past-2147483647 waits reject with
 * `RangeError`.
 * @param ms Milliseconds to wait.
 * @param options `signal` to cancel the wait.
 * @returns A promise that resolves to `undefined`.
 * @example
 * ```ts
 * await sleep(100)
 * const controller = new AbortController()
 * const nap = sleep(1000, { signal: controller.signal })
 * controller.abort()
 * await nap.catch((reason) => console.log(reason)) // the abort reason
 * ```
 */
export function sleep(ms: number, options?: SleepOptions): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const delay = timerWait(ms, 'ms')
    const signal = options?.signal
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, delay)
  })
}

/**
 * Settles as `promise` does, or rejects with a `DOMException` named `TimeoutError` when `ms`
 * milliseconds pass first, as `AbortSignal.timeout` does. An aborted `signal` rejects with its
 * `reason`. The timer and the abort listener are removed once the result is known; `promise`
 * itself keeps running, so pass the same `signal` to the work to stop it too.
 * @param promise The promise to wait for.
 * @param ms Milliseconds before it times out; checked as in {@link sleep}.
 * @param options `signal` to cancel the wait.
 * @returns A promise that settles with `promise`, or rejects on timeout or abort.
 * @example
 * ```ts
 * const response = await timeout(fetch('/api'), 5000)
 * ```
 */
export function timeout<T>(
  promise: PromiseLike<T> | T,
  ms: number,
  options?: TimeoutOptions
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const signal = options?.signal
    let timer: ReturnType<typeof setTimeout> | undefined
    const settle = (): void => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = (): void => {
      settle()
      reject(signal?.reason)
    }
    // Subscribe before any early exit so a later rejection of `promise` is always handled.
    Promise.resolve(promise).finally(settle).then(resolve, reject)
    const delay = timerWait(ms, 'ms')
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    timer = setTimeout(() => {
      settle()
      reject(new DOMException('The operation timed out.', 'TimeoutError'))
    }, delay)
  })
}
