/**
 * This module includes functions that promote a more functional programming style.
 *
 * @module functools
 */

import type { AnyFunction } from '../types.js'

type Invokable<T = unknown> = (...args: unknown[]) => T

/**
 * A loosely typed callable used for curry/flow/partial return values.
 * Recursive so arity-splitting calls type-check; the final application is a value at runtime.
 */
export type LooseFunction = (...args: unknown[]) => LooseFunction

/**
 * Creates a function that accepts arguments of `func` and either invokes `func` returning its result, if at least `func.length` arguments have been provided, or returns a function that accepts the remaining `func` arguments, and so on.
 * @param func The function to curry.
 * @returns The new curried function.
 */
export function curry(func: AnyFunction): LooseFunction {
  const callable = func as Invokable
  const curried: LooseFunction = function (this: unknown, ...args: unknown[]) {
    if (args.length >= callable.length) {
      return callable.apply(this, args) as LooseFunction
    }

    return (...args2: unknown[]) => {
      return curried.apply(this, args.concat(args2))
    }
  }
  return curried
}

/**
 * Creates a function that invokes `fn` with partials prepended to the arguments it receives.
 * The given function will have `this` bound to `undefined`.
 * @param fn The function to partially apply.
 * @param args The arguments to apply to `fn`.
 * @returns The new partially applied function.
 */
export function partial(fn: AnyFunction, ...args: unknown[]): LooseFunction {
  return (fn as Invokable).bind(undefined, ...args) as LooseFunction
}

/**
 * Creates a function composition from a given set of functions that will be each applied on the result of the previous one from left to right.
 * @param args The set of functions to apply.
 * @returns A new function that applies each given function on the result of the previous one.
 */
export function flow(...args: AnyFunction[]): LooseFunction {
  return ((x: unknown) => {
    for (const fn of args) {
      x = (fn as Invokable)(x)
    }
    return x
  }) as LooseFunction
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
export function compose(...args: AnyFunction[]): LooseFunction {
  return flow(...args.slice().reverse())
}

/**
 * Creates a function that memoizes the result of `fn`. If `resolver` is provided, it determines the cache key from the arguments. By default the first argument is the key. Uses `Map.has`, so `undefined` results are cached. Invokes `fn` with the caller's `this`.
 * @param fn The function to have its output memoized.
 * @param resolver The function to resolve the cache key.
 * @returns The new memoized function.
 */
export function memoize<F extends AnyFunction>(
  fn: F,
  resolver?: (...args: Parameters<F>) => unknown
): F {
  const store = new Map<unknown, ReturnType<F>>()
  const memoized = function (this: unknown, ...args: Parameters<F>): ReturnType<F> {
    const key = resolver ? resolver(...args) : args[0]
    if (store.has(key)) {
      return store.get(key) as ReturnType<F>
    }
    const value = fn.apply(this, args) as ReturnType<F>
    store.set(key, value)
    return value
  }
  return memoized as F
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

/**
 * Creates a debounced function that delays invoking `fn` until after `wait` milliseconds have elapsed since the last call. Trailing invocations use the latest arguments. When `maxWait` elapses since the first pending call, `fn` is invoked with the latest arguments and later calls start a new window. Returns the last result. `wait < 0` is treated as 0; `maxWait < wait` is raised to `wait`.
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
  if (wait < 0) wait = 0
  let maxWait = options?.maxWait
  if (maxWait !== undefined && maxWait < wait) maxWait = wait

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
      timer = undefined
      if (maxTimer !== undefined) {
        clearTimeout(maxTimer)
        maxTimer = undefined
      }
      invoke()
    }, wait)

    if (maxWait !== undefined && maxTimer === undefined) {
      maxTimer = setTimeout(() => {
        maxTimer = undefined
        if (timer !== undefined) {
          clearTimeout(timer)
          timer = undefined
        }
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
 * Creates a throttled function that invokes `fn` at most once per `wait` milliseconds on the leading edge. Calls within `wait` return the last result without invoking.
 * @param fn The function to throttle.
 * @param wait The number of milliseconds to throttle invocations to.
 * @returns The new throttled function.
 */
export function throttle<F extends AnyFunction>(
  fn: F,
  wait: number
): (...args: Parameters<F>) => ReturnType<F> | undefined {
  let cooling = false
  let lastResult: ReturnType<F> | undefined
  return function (this: unknown, ...args: Parameters<F>): ReturnType<F> | undefined {
    if (cooling) return lastResult
    lastResult = fn.apply(this, args) as ReturnType<F>
    cooling = true
    setTimeout(() => {
      cooling = false
    }, wait)
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
export function once<T>(fn: AnyFunction<T>): AnyFunction<T> {
  let result: T
  let isCalled = false
  const callable = fn as Invokable<T>
  return function (this: unknown, ...args: unknown[]) {
    if (!isCalled) {
      result = callable.apply(this, args)
      isCalled = true
    }
    return result
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
export function result<T = unknown, E = unknown>(fn: AnyFunction<T>): AnyFunction<Result<T, E>> {
  const callable = fn as Invokable<T>
  return function (this: unknown, ...args: unknown[]): Result<T, E> {
    let value: Maybe<T>
    let err: Maybe<E>
    try {
      value = callable.apply(this, args)
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
export function resultAsync<T = unknown, E = unknown>(
  fn: AnyFunction<Promise<T>>
): AnyFunction<Promise<Result<T, E>>> {
  const callable = fn as Invokable<Promise<T>>
  return async function (this: unknown, ...args: unknown[]): Promise<Result<T, E>> {
    let value: Maybe<T>
    let err: Maybe<E>
    try {
      value = await callable.apply(this, args)
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
export function promisify<T>(fun: AnyFunction, thisArg?: unknown): AnyFunction<Promise<T>> {
  const callable = fun as Invokable
  const original = thisArg !== undefined && thisArg !== null ? callable.bind(thisArg) : callable
  return (...args: unknown[]) =>
    new Promise<T>((resolve, reject) => {
      original(...args, (err: Error | null | undefined, resultValue: T) => {
        if (err) {
          reject(err)
          return
        }
        resolve(resultValue)
      })
    })
}
