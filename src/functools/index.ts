/**
 * This module includes functions that promote a more functional programming style.
 *
 * @module functools
 */

import type { AnyFunction } from '../types.js'

/**
 * A loosely typed callable used for curry return values.
 * Recursive so arity-splitting calls type-check; the final application is a value at runtime.
 */
export type LooseFunction = (...args: unknown[]) => LooseFunction

/**
 * Creates a function that accepts arguments of `func` and either invokes `func` returning its result, if at least `func.length` arguments have been provided, or returns a function that accepts the remaining `func` arguments, and so on.
 * @param func The function to curry.
 * @returns The new curried function.
 */
export function curry<A extends unknown[], R>(
  func: (...args: A) => R
): LooseFunction & ((...args: A) => R) {
  const curried = function (this: unknown, ...args: unknown[]): unknown {
    if (args.length >= func.length) {
      return Reflect.apply(func, this, args)
    }

    return (...args2: unknown[]) => {
      return curried.apply(this, args.concat(args2))
    }
  }
  // TypeScript cannot express finite variadic curry arity on a recursive helper
  return curried as LooseFunction & ((...args: A) => R)
}

/**
 * Creates a function that invokes `fn` with partials prepended to the arguments it receives.
 * The given function will have `this` bound to `undefined`.
 * @param fn The function to partially apply.
 * @param args The arguments to apply to `fn`.
 * @returns The new partially applied function.
 */
export function partial<A extends unknown[], R>(
  fn: (...args: A) => R,
  ...args: Partial<A>
): (...rest: unknown[]) => R {
  return (...rest: unknown[]) => fn(...([...args, ...rest] as A))
}

function pipeThrough(
  thisArg: unknown,
  fns: readonly ((...a: never[]) => unknown)[],
  args: ArrayLike<unknown>
): unknown {
  let result: unknown
  let first = true
  for (const fn of fns) {
    if (first) {
      result = Reflect.apply(fn, thisArg, args)
      first = false
    } else {
      result = Reflect.apply(fn, undefined, [result])
    }
  }
  return result
}

/**
 * Creates a function composition from a given set of functions that will be each applied on the result of the previous one from left to right.
 * The first function receives all call arguments (and `this`); each later function receives the previous result.
 * @param fns The set of functions to apply.
 * @returns A new function that applies each given function on the result of the previous one.
 */
export function flow<A extends unknown[], R>(fn: (...a: A) => R): (...a: A) => R
export function flow<A extends unknown[], B, C>(f1: (...a: A) => B, f2: (b: B) => C): (...a: A) => C
export function flow<A extends unknown[], B, C, D>(
  f1: (...a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D
): (...a: A) => D
export function flow<A extends unknown[], B, C, D, E>(
  f1: (...a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E
): (...a: A) => E
export function flow<A extends unknown[], B, C, D, E, F>(
  f1: (...a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => F
): (...a: A) => F
export function flow<A extends unknown[], B, C, D, E, F, G>(
  f1: (...a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => F,
  f6: (f: F) => G
): (...a: A) => G
export function flow(...fns: ((...a: never[]) => unknown)[]): (...a: never[]) => unknown {
  return function (this: unknown, ...args: never[]): unknown {
    return pipeThrough(this, fns, args)
  }
}

/**
 * Alias for {@link flow}.
 * @see {@link flow}
 */
export const pipe = flow

/**
 * Creates a function composition from a given set of functions applied right to left.
 * Does not mutate the argument list.
 * @param args The set of functions to apply.
 * @returns A new function that applies each given function on the result of the previous step.
 */
export function compose<A extends unknown[]>(
  ...args: ((...args: A) => unknown)[]
): (...args: A) => unknown {
  const reversed: ((...a: never[]) => unknown)[] = args.slice().reverse()
  return function (this: unknown, ...callArgs: A): unknown {
    return pipeThrough(this, reversed, callArgs)
  }
}

/**
 * A memoized function with its cache `Map` and a `clear` helper.
 */
export type Memoized<F extends AnyFunction> = F & {
  cache: Map<unknown, ReturnType<F>>
  clear(): void
}

/**
 * Creates a function that memoizes the result of `fn`. If `resolver` is provided, it determines the cache key from the arguments. By default the first argument is the key. Uses `Map.has`, so `undefined` results are cached. Invokes `fn` with the caller's `this`. Exposes `memoized.cache` and `memoized.clear()`.
 * @param fn The function to have its output memoized.
 * @param resolver The function to resolve the cache key.
 * @returns The new memoized function.
 */
export function memoize<F extends AnyFunction>(
  fn: F,
  resolver?: (...args: Parameters<F>) => unknown
): Memoized<F> {
  const store = new Map<unknown, ReturnType<F>>()
  const memoized = function (this: unknown, ...args: Parameters<F>): ReturnType<F> {
    const key = resolver ? resolver(...args) : args[0]
    if (store.has(key)) {
      return store.get(key) as ReturnType<F>
    }
    const value = fn.apply(this, args) as ReturnType<F>
    store.set(key, value)
    return value
  } as Memoized<F>
  memoized.cache = store
  memoized.clear = (): void => {
    store.clear()
  }
  return memoized
}

/**
 * TC39 method decorator that memoizes per instance (`WeakMap` of `Map`s), keyed by the first argument.
 * @param value The method to wrap.
 * @param context The decorator context (unused; required by the TC39 signature).
 * @returns A per-instance memoized method.
 */
export function cache<This extends object, Args extends unknown[], R>(
  value: (this: This, ...args: Args) => R,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => R>
): (this: This, ...args: Args) => R
export function cache<This extends object, Args extends unknown[], R>(
  value: (this: This, ...args: Args) => R
): (this: This, ...args: Args) => R {
  const byInstance = new WeakMap<This, Map<unknown, R>>()
  return function (this: This, ...args: Args): R {
    let store = byInstance.get(this)
    if (!store) {
      store = new Map()
      byInstance.set(this, store)
    }
    const key = args[0]
    if (store.has(key)) {
      return store.get(key) as R
    }
    const result = value.apply(this, args)
    store.set(key, result)
    return result
  }
}

/**
 * A debounced function with `cancel` and `flush`.
 */
export interface Debounced<F extends AnyFunction> {
  (...args: Parameters<F>): ReturnType<F> | undefined
  cancel(): void
  flush(): ReturnType<F> | undefined
}

/** Inclusive max for `setTimeout` / `setInterval` delays (signed 32-bit). */
const MAX_TIMER_WAIT_MS = 2_147_483_647

function assertTimerWait(wait: number): void {
  if (!Number.isFinite(wait) || wait < 0 || wait > MAX_TIMER_WAIT_MS) {
    throw new RangeError('wait must be between 0 and 2147483647 ms')
  }
}

/**
 * Creates a debounced function that delays invoking `fn` until after `wait` milliseconds have elapsed since the last call. Trailing invocations use the latest arguments. When `maxWait` elapses since the first pending call, `fn` is invoked with the latest arguments and later calls start a new window. Returns the last result. `wait` and `maxWait` must be finite numbers in `[0, 2147483647]`; `maxWait < wait` is raised to `wait`.
 * @param fn The function to debounce.
 * @param wait The number of milliseconds to delay.
 * @param options Optional `maxWait` ceiling.
 * @returns The new debounced function with `cancel` and `flush`.
 */
export function debounce<F extends AnyFunction>(
  fn: F,
  wait: number,
  options?: { maxWait?: number }
): Debounced<F> {
  assertTimerWait(wait)
  let maxWait = options?.maxWait
  if (maxWait !== undefined) {
    assertTimerWait(maxWait)
    if (maxWait < wait) maxWait = wait
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  let maxTimer: ReturnType<typeof setTimeout> | undefined
  let lastCall: { thisArg: unknown; args: Parameters<F> } | undefined
  let lastResult: ReturnType<F> | undefined
  let pending = false

  function invoke(): ReturnType<F> {
    pending = false
    const call = lastCall as { thisArg: unknown; args: Parameters<F> }
    lastCall = undefined
    const value = fn.apply(call.thisArg, call.args) as ReturnType<F>
    lastResult = value
    return value
  }

  function clearTimers(): void {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    if (maxTimer !== undefined) {
      clearTimeout(maxTimer)
      maxTimer = undefined
    }
  }

  function debounced(this: unknown, ...args: Parameters<F>): ReturnType<F> | undefined {
    lastCall = { thisArg: this, args }
    pending = true

    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      clearTimers()
      invoke()
    }, wait)

    if (maxWait !== undefined && maxTimer === undefined) {
      maxTimer = setTimeout(() => {
        clearTimers()
        invoke()
      }, maxWait)
    }

    return lastResult
  }

  debounced.cancel = (): void => {
    clearTimers()
    lastCall = undefined
    pending = false
  }

  debounced.flush = (): ReturnType<F> | undefined => {
    if (!pending) return lastResult
    clearTimers()
    return invoke()
  }

  return debounced
}

/**
 * Creates a throttled function that invokes `fn` at most once per `wait` milliseconds on the
 * leading edge, and once more on the trailing edge with the latest arguments when calls arrived
 * during the window (Lodash defaults: leading + trailing). `wait` of 0 still batches via
 * `setTimeout(0)`: one leading invoke plus at most one trailing per macrotask. `wait` must be a
 * finite number in `[0, 2147483647]`.
 * @param fn The function to throttle.
 * @param wait The number of milliseconds to throttle invocations to.
 * @returns The new throttled function.
 */
export function throttle<F extends AnyFunction>(
  fn: F,
  wait: number
): (...args: Parameters<F>) => ReturnType<F> | undefined {
  assertTimerWait(wait)
  let cooling = false
  let lastResult: ReturnType<F> | undefined
  let pending: { thisArg: unknown; args: Parameters<F> } | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  function schedule(): void {
    timer = setTimeout(() => {
      timer = undefined
      cooling = false
      if (!pending) return
      const call = pending
      pending = undefined
      lastResult = fn.apply(call.thisArg, call.args) as ReturnType<F>
      cooling = true
      schedule()
    }, wait)
  }

  return function (this: unknown, ...args: Parameters<F>): ReturnType<F> | undefined {
    if (!cooling) {
      lastResult = fn.apply(this, args) as ReturnType<F>
      cooling = true
      pending = undefined
      if (timer !== undefined) clearTimeout(timer)
      schedule()
      return lastResult
    }
    pending = { thisArg: this, args }
    return lastResult
  }
}

/**
 * Creates a function that is restricted to invoking `fn` once. Repeat calls return the value of the first invocation.
 * @param fn The function to restrict.
 * @returns The new restricted function.
 * @example
```js
const func = x => x
const single = once(func)
single(1) // 1
single(2) // 1
single(3) // 1
```
 */
export function once<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let value!: R
  let isCalled = false
  return function (this: unknown, ...args: A): R {
    if (!isCalled) {
      value = fn.apply(this, args)
      isCalled = true
    }
    return value
  }
}

/**
 * A value that may be undefined.
 */
export type Maybe<T> = T | undefined

/**
 * A `[value, error]` tuple from {@link result} / {@link resultAsync}.
 */
export type Result<T, E = unknown> = [Maybe<T>, Maybe<E>]

/**
 * Alias for {@link Maybe}.
 */
export type Optional<T> = Maybe<T>

/**
 * Wraps a function to catch exceptions and return a {@link Result} tuple.
 * @param fn The function to wrap.
 * @returns A new function that wraps `fn` and returns the result tuple.
 */
export function result<A extends unknown[], T, E = unknown>(
  fn: (...args: A) => T
): (...args: A) => Result<T, E> {
  return function (this: unknown, ...args: A): Result<T, E> {
    let value: Maybe<T>
    let err: Maybe<E>
    try {
      value = fn.apply(this, args)
    } catch (error) {
      err = error as E
    }
    return [value, err]
  }
}

/**
 * Wraps an async function to catch exceptions and return a {@link Result} tuple.
 * @param fn The async function to await.
 * @returns A new function that awaits the given function and returns the result tuple.
 */
export function resultAsync<A extends unknown[], T, E = unknown>(
  fn: (...args: A) => Promise<T>
): (...args: A) => Promise<Result<T, E>> {
  return async function (this: unknown, ...args: A): Promise<Result<T, E>> {
    let value: Maybe<T>
    let err: Maybe<E>
    try {
      value = await fn.apply(this, args)
    } catch (error) {
      err = error as E
    }
    return [value, err]
  }
}

/**
 * Converts a function that expects a node-style callback `(err, result)` to return a `Promise`.
 * @param fun The function to convert from callback style to `Promise`.
 * @param thisArg Optional `this` binding.
 * @returns A function that wraps `fun` and returns a `Promise`.
 */
export function promisify<A extends unknown[], T>(
  fun: (...args: [...A, (err: Error | null | undefined, result: T) => void]) => void,
  thisArg?: unknown
): (...args: A) => Promise<T> {
  return (...args: A) =>
    new Promise<T>((resolve, reject) => {
      const cb = (err: Error | null | undefined, resultValue: T) => {
        if (err !== undefined && err !== null) {
          reject(err)
          return
        }
        resolve(resultValue)
      }
      if (thisArg !== undefined && thisArg !== null) {
        fun.call(thisArg, ...args, cb)
      } else {
        fun(...args, cb)
      }
    })
}
