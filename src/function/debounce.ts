import { assertFunction, timerWait } from './shared.ts'

/** A debounced function with `cancel`, `flush` and `pending`. */
export interface Debounced<F extends (...args: never[]) => unknown> {
  /** Schedules a call and returns the result of the last invocation, if any. */
  (this: ThisParameterType<F>, ...args: Parameters<F>): ReturnType<F> | undefined
  /** Drops the pending call. */
  cancel(): void
  /** Runs the pending call now and returns its result, or the last result when none is pending. */
  flush(): ReturnType<F> | undefined
  /** Whether a call is waiting to run. */
  pending(): boolean
}

/** Options for {@link debounce}. */
export interface DebounceOptions {
  /** Invoke on the first call of a burst (default `false`). */
  leading?: boolean
  /** Invoke after the last call of a burst (default `true`). When `false`, held calls never run. */
  trailing?: boolean
  /**
   * Longest time the trailing call may be held, counted from the first call of the burst or the
   * first call after `maxWait` last ran it. Has no effect when `trailing` is `false`.
   */
  maxWait?: number | null
}

/** A call held back for later: its `this` and arguments. */
interface HeldCall<F extends (...args: never[]) => unknown> {
  thisArg: unknown
  args: Parameters<F>
}

/**
 * Creates a function that delays invoking `fn` until `wait` milliseconds have passed since the
 * last call, with the latest arguments and `this`. With `maxWait`, a burst of calls also runs `fn`
 * at least once per `maxWait`. `wait` defaults to 0; negative waits clamp to 0, and NaN, infinite
 * or past-2147483647 waits throw `RangeError`, and a non-number wait throws `TypeError`. A
 * `maxWait` below `wait` is raised to `wait`. Idle windows use `performance.now()` (faked by
 * default in Vitest 5 and Jest) and hold no timer when `wait > 0`. Held trailing calls use timers;
 * `wait === 0` keeps a timer until the next macrotask.
 * @param fn The function to debounce.
 * @param wait Milliseconds to wait after the last call.
 * @param options `leading`, `trailing` and `maxWait`.
 * @returns The debounced function with `cancel`, `flush` and `pending`.
 * @example
 * ```ts
 * const save = debounce((text: string) => console.log(text), 100)
 * save('h')
 * save('hi') // logs 'hi' once, 100 ms later
 * ```
 */
export function debounce<F extends (...args: never[]) => unknown>(
  fn: F,
  wait?: number | null,
  options?: DebounceOptions
): Debounced<F> {
  assertFunction(fn, 'fn')
  const delay = timerWait(wait ?? 0, 'wait')
  const leading = options?.leading ?? false
  const trailing = options?.trailing ?? true
  const maxWait =
    options?.maxWait == null ? undefined : Math.max(timerWait(options.maxWait, 'maxWait'), delay)
  // Only timers run the held call, and only with `trailing`: without it maxWait bounds nothing.
  const maxDelay = trailing ? maxWait : undefined

  let timer: ReturnType<typeof setTimeout> | undefined
  let maxTimer: ReturnType<typeof setTimeout> | undefined
  let deadline = -Infinity
  let maxDeadline: number | undefined
  let activeCalls = 0
  let lastCall: HeldCall<F> | undefined
  let lastResult: ReturnType<F> | undefined

  function invokeLastCall(): ReturnType<F> | undefined {
    if (lastCall === undefined) return lastResult
    const call = lastCall
    lastCall = undefined
    activeCalls++
    try {
      lastResult = fn.apply(call.thisArg, call.args) as ReturnType<F>
      return lastResult
    } finally {
      activeCalls--
    }
  }

  function clearTimers(): void {
    clearTimeout(timer)
    clearTimeout(maxTimer)
    timer = maxTimer = undefined
  }

  /** Whether the held call will run: both timers that run it need `trailing`. */
  function willRun(): boolean {
    return trailing && lastCall !== undefined
  }

  function debounced(this: unknown, ...args: Parameters<F>): ReturnType<F> | undefined {
    const now = performance.now()
    const startsBurst =
      timer === undefined && (deadline === -Infinity || (activeCalls === 0 && now >= deadline))
    const invokeLeading = leading && startsBurst
    if (startsBurst) maxDeadline = undefined
    deadline = now + delay
    lastCall = trailing || invokeLeading ? { thisArg: this, args } : undefined

    clearTimeout(timer)
    timer = undefined
    const needsTimer = delay === 0 || (trailing && !invokeLeading)
    if (needsTimer) {
      timer = setTimeout(() => {
        clearTimers()
        deadline = -Infinity
        maxDeadline = undefined
        if (trailing) invokeLastCall()
        else lastCall = undefined
      }, delay)
    }

    if (maxDelay !== undefined) {
      maxDeadline ??= now + maxDelay
      if (needsTimer && maxTimer === undefined) {
        maxTimer = setTimeout(
          () => {
            maxTimer = undefined
            maxDeadline = undefined
            if (delay > 0) clearTimers()
            invokeLastCall()
          },
          Math.max(0, Math.min(maxDelay, Math.ceil(maxDeadline - now)))
        )
      }
    }

    return invokeLeading ? invokeLastCall() : lastResult
  }

  debounced.cancel = (): void => {
    clearTimers()
    deadline = -Infinity
    maxDeadline = undefined
    lastCall = undefined
  }

  debounced.flush = (): ReturnType<F> | undefined => {
    if (!willRun()) return lastResult
    clearTimers()
    deadline = -Infinity
    maxDeadline = undefined
    return invokeLastCall()
  }

  debounced.pending = willRun

  return debounced
}
