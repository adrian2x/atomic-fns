import { assertFunction } from '../function/shared.ts'
import { timerWait } from '../internal/timer.ts'
import { sleep } from './sleep.ts'

/** Options for {@link retry}. */
export interface RetryOptions {
  /** Retries after the first attempt (default 3); `Infinity` retries until success or abort. */
  retries?: number
  /** Delay before the first retry, in milliseconds (default 100). */
  minDelay?: number
  /** Longest delay between attempts, in milliseconds (default 10000, or `minDelay` when larger). */
  maxDelay?: number
  /** Growth of the delay per retry (default 2). */
  factor?: number
  /** Scale each delay by a random factor in [0.5, 1) so callers spread out (default `true`). */
  jitter?: boolean
  /**
   * Stops retrying and rejects with the signal's `reason` when it aborts. A running attempt is
   * not interrupted, so pass the same signal to the work in `fn` to stop it too.
   */
  signal?: AbortSignal
  /** Decides whether an error is worth another attempt (default: every error is). */
  shouldRetry?: (error: unknown, attempt: number) => boolean | PromiseLike<boolean>
}

/**
 * Calls `fn` until it succeeds, waiting between attempts with exponential backoff:
 * `min(maxDelay, minDelay * factor ** (retry - 1))`, scaled into [0.5, 1) of that when `jitter`
 * is on. `fn` receives the attempt number, from 1. After the last retry, or when `shouldRetry`
 * returns `false`, the promise rejects with the error `fn` threw. An aborted `signal` rejects with
 * its `reason` once the running attempt settles, before `shouldRetry` and the next attempt, or
 * during a wait. Delays are checked as in {@link sleep}: negative ones clamp to 0.
 * @param fn The work to try; may return a value or a promise.
 * @param options Backoff, `signal` and `shouldRetry`.
 * @returns A promise for the first successful result.
 * @throws {TypeError} when `fn` is not a function, or a delay is not a number.
 * @throws {RangeError} when an option is out of range, or `maxDelay` is below `minDelay`.
 * @example
 * ```ts
 * const data = await retry(() => fetch('/api').then((r) => r.json()), { retries: 5 })
 * ```
 */
export function retry<T>(
  fn: (attempt: number) => T | PromiseLike<T>,
  options: RetryOptions = {}
): Promise<T> {
  assertFunction(fn, 'fn')
  const retries = options.retries ?? 3
  if (!(Number.isInteger(retries) || retries === Number.POSITIVE_INFINITY) || retries < 0) {
    throw new RangeError('retries must be a non-negative integer or Infinity')
  }
  const minDelay = timerWait(options.minDelay ?? 100, 'minDelay')
  const maxDelay =
    options.maxDelay == null ? Math.max(10_000, minDelay) : timerWait(options.maxDelay, 'maxDelay')
  if (maxDelay < minDelay) throw new RangeError('maxDelay must be >= minDelay')
  const factor = options.factor ?? 2
  if (typeof factor !== 'number' || !(factor >= 1 && Number.isFinite(factor))) {
    throw new RangeError('factor must be a finite number >= 1')
  }
  const jitter = options.jitter ?? true
  const { signal, shouldRetry } = options

  return (async () => {
    let backoff = minDelay
    for (let attempt = 1; ; attempt++) {
      signal?.throwIfAborted()
      try {
        return await fn(attempt)
      } catch (error) {
        signal?.throwIfAborted()
        if (attempt > retries) throw error
        if (shouldRetry && !(await shouldRetry(error, attempt))) throw error
        await sleep(jitter ? backoff * (0.5 + Math.random() / 2) : backoff, { signal })
        // Grown one step at a time, so it stays capped instead of overflowing to Infinity or NaN.
        backoff = Math.min(maxDelay, backoff * factor)
      }
    }
  })()
}
