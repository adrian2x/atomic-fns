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

function assertFunction(fn: unknown): void {
  if (typeof fn !== 'function') throw new TypeError('Expected a function')
}

/**
 * Creates a function that accepts arguments of `func` and either invokes `func` returning its result, if at least `arity` arguments have been provided, or returns a function that accepts the remaining `func` arguments, and so on. `func` runs with the `this` of the latest call.
 * @param func The function to curry.
 * @param arity The number of arguments to wait for (default `func.length`).
 * @returns The new curried function.
 */
export function curry<A extends unknown[], R>(
  func: (...args: A) => R,
  arity?: number
): LooseFunction & ((...args: A) => R) {
  assertFunction(func)
  const required = arity ?? func.length
  const curried = function (this: unknown, ...args: unknown[]): unknown {
    if (args.length >= required) {
      return Reflect.apply(func, this, args)
    }

    return function (this: unknown, ...args2: unknown[]): unknown {
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
  assertFunction(fn)
  return (...rest: unknown[]) => fn(...([...args, ...rest] as A))
}

/** Flattens one level, as Lodash `flow` does, and refuses anything but functions. */
function pipelineOf<F extends AnyFunction>(fns: readonly (F | readonly F[])[]): F[] {
  const pipeline = fns.flat() as F[]
  pipeline.forEach(assertFunction)
  return pipeline
}

function pipeThrough(
  thisArg: unknown,
  fns: readonly ((...a: never[]) => unknown)[],
  args: ArrayLike<unknown>
): unknown {
  if (fns.length === 0) return args[0]
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
 * With no functions it returns its first argument. Arrays of functions flatten one level, as in Lodash; anything else throws `TypeError('Expected a function')`.
 * @returns A new function that applies each given function on the result of the previous one.
 */
export function flow(): <T>(value: T) => T
export function flow<T>(fns: readonly ((value: T) => T)[]): (value: T) => T
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
/** @param fns The set of functions to apply. */
export function flow(...fns: (AnyFunction | readonly AnyFunction[])[]): (...a: never[]) => unknown {
  const pipeline = pipelineOf(fns)
  return function (this: unknown, ...args: never[]): unknown {
    return pipeThrough(this, pipeline, args)
  }
}

/**
 * Alias for {@link flow}.
 * @see {@link flow}
 */
export const pipe = flow

/**
 * Creates a function composition from a given set of functions applied right to left.
 * Does not mutate the argument list. Empty and array arguments behave as in {@link flow}.
 * @param args The set of functions to apply.
 * @returns A new function that applies each given function on the result of the previous step.
 */
export function compose<A extends unknown[]>(
  ...args: (((...args: A) => unknown) | readonly ((...args: A) => unknown)[])[]
): (...args: A) => unknown {
  const reversed: ((...a: never[]) => unknown)[] = pipelineOf(args).reverse()
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

/** A Map at the engine's size limit throws; the value is still good, it just goes unremembered. */
function remember<V>(store: Map<unknown, V>, key: unknown, value: V): void {
  try {
    store.set(key, value)
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
  }
}

/**
 * Creates a function that memoizes the result of `fn`. If `resolver` is provided, it determines the cache key from the arguments. By default the first argument is the key. Uses `Map.has`, so `undefined` results are cached. Invokes `fn` and `resolver` with the caller's `this`. Exposes `memoized.cache`, which lookups read and may be replaced, and `memoized.clear()`.
 *
 * The cache grows with every distinct key and never evicts: call `clear()`, or size-limit keys from untrusted input. Past the engine's `Map` limit, new results are returned but not remembered.
 * @param fn The function to have its output memoized.
 * @param resolver The function to resolve the cache key.
 * @returns The new memoized function.
 */
export function memoize<F extends AnyFunction>(
  fn: F,
  resolver?: (...args: Parameters<F>) => unknown
): Memoized<F> {
  assertFunction(fn)
  if (resolver != null) assertFunction(resolver)
  const memoized = function (this: unknown, ...args: Parameters<F>): ReturnType<F> {
    const key = resolver ? resolver.apply(this, args) : args[0]
    const store = memoized.cache
    if (store.has(key)) {
      return store.get(key) as ReturnType<F>
    }
    const value = fn.apply(this, args) as ReturnType<F>
    remember(store, key, value)
    return value
  } as Memoized<F>
  memoized.cache = new Map()
  memoized.clear = (): void => {
    memoized.cache.clear()
  }
  return memoized
}

/**
 * TC39 method decorator that memoizes per instance (`WeakMap` of `Map`s), keyed by the first argument. A call on a non-object `this` runs uncached. Each store grows like {@link memoize}'s.
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
  assertFunction(value)
  const byInstance = new WeakMap<This, Map<unknown, R>>()
  return function (this: This, ...args: Args): R {
    if (Object(this) !== this) return value.apply(this, args)
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
    remember(store, key, result)
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

/** Clamp negative finite waits to 0; throw on NaN or values above {@link MAX_TIMER_WAIT_MS}. */
function assertTimerWait(wait: number, name: string): number {
  if (Number.isFinite(wait) && wait < 0) return 0
  if (!Number.isFinite(wait) || wait > MAX_TIMER_WAIT_MS) {
    throw new RangeError(`${name} must be between 0 and 2147483647 ms`)
  }
  return wait
}

/** A call held back for later: its `this` and arguments. */
interface HeldCall<F extends AnyFunction> {
  thisArg: unknown
  args: Parameters<F>
}

/**
 * Creates a debounced function that delays invoking `fn` until after `wait` milliseconds have elapsed since the last call. Trailing invocations use the latest arguments. When `maxWait` elapses since the first pending call, `fn` is invoked with the latest arguments and later calls start a new window. Returns the last result. `wait` defaults to 0. Negative finite `wait` / `maxWait` clamp to 0; NaN and values above 2147483647 throw `RangeError`. `maxWait < wait` is raised to `wait`, and a null `maxWait` is absent.
 * @param fn The function to debounce.
 * @param wait The number of milliseconds to delay.
 * @param options `leading` invokes on the first call of a burst (default false), `trailing` on the last (default true), and `maxWait` is the longest delay.
 * @returns The new debounced function with `cancel` and `flush`.
 */
export function debounce<F extends AnyFunction>(
  fn: F,
  wait?: number | null,
  options?: { leading?: boolean; trailing?: boolean; maxWait?: number | null }
): Debounced<F> {
  assertFunction(fn)
  const delay = assertTimerWait(wait ?? 0, 'wait')
  const leading = options?.leading ?? false
  const trailing = options?.trailing ?? true
  const maxDelay =
    options?.maxWait == null
      ? undefined
      : Math.max(assertTimerWait(options.maxWait, 'maxWait'), delay)

  let timer: ReturnType<typeof setTimeout> | undefined
  let maxTimer: ReturnType<typeof setTimeout> | undefined
  let lastCall: HeldCall<F> | undefined
  let lastResult: ReturnType<F> | undefined

  function invokeLastCall(): ReturnType<F> | undefined {
    if (lastCall === undefined) return lastResult
    const call = lastCall
    lastCall = undefined
    lastResult = fn.apply(call.thisArg, call.args) as ReturnType<F>
    return lastResult
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
    const startsBurst = timer === undefined
    lastCall = { thisArg: this, args }

    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      clearTimers()
      if (trailing) invokeLastCall()
      else lastCall = undefined
    }, delay)

    if (maxDelay !== undefined && maxTimer === undefined) {
      maxTimer = setTimeout(() => {
        maxTimer = undefined
        invokeLastCall()
      }, maxDelay)
    }

    return leading && startsBurst ? invokeLastCall() : lastResult
  }

  debounced.cancel = (): void => {
    clearTimers()
    lastCall = undefined
  }

  debounced.flush = (): ReturnType<F> | undefined => {
    if (lastCall !== undefined) clearTimers()
    return invokeLastCall()
  }

  return debounced
}

/**
 * A throttled function with `cancel` and `flush` (same shape as {@link Debounced}).
 */
export type Throttled<F extends AnyFunction> = Debounced<F>

/**
 * Creates a throttled function that invokes `fn` at most once per `wait` milliseconds on the
 * leading edge, and once more on the trailing edge with the latest arguments when calls arrived
 * during the window (Lodash defaults: leading + trailing). `wait` defaults to 0 and still batches
 * via `setTimeout(0)`: one leading invoke plus at most one trailing per macrotask. Negative finite
 * `wait` clamps to 0; NaN and values above 2147483647 throw `RangeError`. `cancel` clears a
 * pending trailing timer; `flush` invokes the pending trailing call once and starts a new window.
 * A window opens before `fn` runs, so a reentrant call or a throw from `fn` stays throttled.
 * @param fn The function to throttle.
 * @param wait The number of milliseconds to throttle invocations to.
 * @param options `leading` and `trailing` choose the edges that invoke (both default true).
 * @returns The new throttled function with `cancel` and `flush`.
 */
export function throttle<F extends AnyFunction>(
  fn: F,
  wait?: number | null,
  options?: { leading?: boolean; trailing?: boolean }
): Throttled<F> {
  assertFunction(fn)
  const delay = assertTimerWait(wait ?? 0, 'wait')
  const leading = options?.leading ?? true
  const trailing = options?.trailing ?? true
  let lastResult: ReturnType<F> | undefined
  let pending: HeldCall<F> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  function startWindow(): void {
    timer = setTimeout(() => {
      timer = undefined
      const call = pending
      pending = undefined
      if (call) invoke(call)
    }, delay)
  }

  function invoke(call: HeldCall<F>): ReturnType<F> {
    startWindow()
    lastResult = fn.apply(call.thisArg, call.args) as ReturnType<F>
    return lastResult
  }

  function clearWindow(): void {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  function throttled(this: unknown, ...args: Parameters<F>): ReturnType<F> | undefined {
    const call = { thisArg: this, args }
    if (timer === undefined) {
      if (leading) return invoke(call)
      startWindow()
    }
    if (trailing) pending = call
    return lastResult
  }

  throttled.cancel = (): void => {
    clearWindow()
    pending = undefined
  }

  throttled.flush = (): ReturnType<F> | undefined => {
    if (pending === undefined) return lastResult
    const call = pending
    pending = undefined
    clearWindow()
    return invoke(call)
  }

  return throttled
}

/**
 * Creates a function that is restricted to invoking `fn` once. Repeat calls return the value of the first invocation, or `undefined` when it is still running or threw.
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
  assertFunction(fn)
  let value!: R
  let isCalled = false
  return function (this: unknown, ...args: A): R {
    if (!isCalled) {
      isCalled = true
      value = fn.apply(this, args)
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

/** A thrown `undefined` would read as success in the tuple. */
function caught(error: unknown): unknown {
  return error === undefined ? new Error('undefined was thrown') : error
}

/**
 * Wraps a function to catch exceptions and return a {@link Result} tuple. A thrown `undefined` becomes an `Error`, so the error slot always tells failure from success.
 * @param fn The function to wrap.
 * @returns A new function that wraps `fn` and returns the result tuple.
 */
export function result<A extends unknown[], T, E = unknown>(
  fn: (...args: A) => T
): (...args: A) => Result<T, E> {
  assertFunction(fn)
  return function (this: unknown, ...args: A): Result<T, E> {
    let value: Maybe<T>
    let err: Maybe<E>
    try {
      value = fn.apply(this, args)
    } catch (error) {
      err = caught(error) as E
    }
    return [value, err]
  }
}

/**
 * Wraps an async function to catch exceptions and return a {@link Result} tuple, as {@link result} does.
 * @param fn The async function to await.
 * @returns A new function that awaits the given function and returns the result tuple.
 */
export function resultAsync<A extends unknown[], T, E = unknown>(
  fn: (...args: A) => Promise<T>
): (...args: A) => Promise<Result<T, E>> {
  assertFunction(fn)
  return async function (this: unknown, ...args: A): Promise<Result<T, E>> {
    let value: Maybe<T>
    let err: Maybe<E>
    try {
      value = await fn.apply(this, args)
    } catch (error) {
      err = caught(error) as E
    }
    return [value, err]
  }
}

/**
 * Converts a function that expects a node-style callback `(err, result)` to return a `Promise`. As in `util.promisify`, a falsy `err` is success.
 * @param fun The function to convert from callback style to `Promise`.
 * @param thisArg Optional `this` binding (default the caller's `this`).
 * @returns A function that wraps `fun` and returns a `Promise`.
 */
export function promisify<A extends unknown[], T>(
  fun: (...args: [...A, (err: Error | null | undefined, result: T) => void]) => void,
  thisArg?: unknown
): (...args: A) => Promise<T> {
  assertFunction(fun)
  return function (this: unknown, ...args: A): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const cb = (err: Error | null | undefined, resultValue: T) => {
        if (err) {
          reject(err)
          return
        }
        resolve(resultValue)
      }
      Reflect.apply(fun, thisArg ?? this, [...args, cb])
    })
  }
}
