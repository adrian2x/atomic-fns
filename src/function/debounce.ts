import { timerWait } from '../internal/timer.ts'
import { assertFunction } from './shared.ts'

/** A debounced or throttled function with `cancel`, `flush` and `pending`. */
export interface Debounced<F extends (...args: never[]) => unknown> {
  /** Schedules a call and returns the result of the last invocation, if any. */
  (this: ThisParameterType<F>, ...args: Parameters<F>): ReturnType<F> | undefined
  /** Drops the pending call and ends the current wait, so the next call starts fresh. */
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

/** Options for {@link throttle}. */
export interface ThrottleOptions {
  /** Invoke when a window opens (default `true`). */
  leading?: boolean
  /** Invoke at the end of a window with the latest arguments (default `true`). */
  trailing?: boolean
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

/**
 * Creates a function that invokes `fn` at most once per `wait` milliseconds: on the leading edge,
 * and once more at the end of the window with the latest arguments when calls arrived during it
 * (Lodash's leading and trailing defaults). The window opens before `fn` runs, so a reentrant
 * call or a throw from `fn` stays throttled. Idle windows use `performance.now()` (faked by
 * default in Vitest 5 and Jest) and hold no timer when `wait > 0`. Held trailing calls use timers;
 * `wait === 0` keeps one trailing invocation per macrotask. Waits are checked as in {@link debounce}.
 * @param fn The function to throttle.
 * @param wait Milliseconds per window.
 * @param options `leading` and `trailing`.
 * @returns The throttled function with `cancel`, `flush` and `pending`.
 * @example
 * ```ts
 * const onScroll = throttle(() => console.log(window.scrollY), 100)
 * addEventListener('scroll', onScroll)
 * ```
 */
export function throttle<F extends (...args: never[]) => unknown>(
  fn: F,
  wait?: number | null,
  options?: ThrottleOptions
): Debounced<F> {
  assertFunction(fn, 'fn')
  const delay = timerWait(wait ?? 0, 'wait')
  const leading = options?.leading ?? true
  const trailing = options?.trailing ?? true
  let lastResult: ReturnType<F> | undefined
  let trailingCall: HeldCall<F> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let deadline = -Infinity
  let activeCalls = 0

  function scheduleWindowEnd(ms: number): void {
    timer = setTimeout(() => {
      timer = undefined
      deadline = -Infinity
      const call = trailingCall
      trailingCall = undefined
      if (call) invoke(call)
    }, ms)
  }

  function startWindow(): void {
    deadline = performance.now() + delay
    if (delay === 0) scheduleWindowEnd(delay)
  }

  function invoke(call: HeldCall<F>): ReturnType<F> {
    startWindow()
    activeCalls++
    try {
      lastResult = fn.apply(call.thisArg, call.args) as ReturnType<F>
      return lastResult
    } finally {
      activeCalls--
    }
  }

  function clearWindow(): void {
    deadline = -Infinity
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  function throttled(this: unknown, ...args: Parameters<F>): ReturnType<F> | undefined {
    const call = { thisArg: this, args }
    if (
      timer === undefined &&
      (deadline === -Infinity || (activeCalls === 0 && performance.now() >= deadline))
    ) {
      if (leading) return invoke(call)
      startWindow()
    }
    if (trailing) {
      trailingCall = call
      if (timer === undefined) {
        scheduleWindowEnd(Math.max(0, Math.min(delay, Math.ceil(deadline - performance.now()))))
      }
    }
    return lastResult
  }

  throttled.cancel = (): void => {
    clearWindow()
    trailingCall = undefined
  }

  throttled.flush = (): ReturnType<F> | undefined => {
    if (trailingCall === undefined) return lastResult
    const call = trailingCall
    trailingCall = undefined
    clearWindow()
    return invoke(call)
  }

  throttled.pending = (): boolean => trailingCall !== undefined

  return throttled
}
