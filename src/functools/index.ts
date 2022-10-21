/**
 * This module includes functions that promote a more functional programming style.
 *
 * @module Functions
 */

import { Function, isPromise } from '../globals/index.js'

/**
 * Creates a function that invokes `fn` with the this binding of `thisArg` and `partials` as partially applied arguments.
 * @param {Function} fn The function to bind.
 * @param {*} thisArg The `this` value of `fn`.
 * @param {...*} [partials] The arguments to prepend to `fn`.
 * @returns {Function} Returns the new bound function.
 * @see {@link partial}
 */
export const bind = (fn: Function, thisArg, ...partials) => fn.bind(thisArg, ...partials)

/**
 * Creates a function that accepts arguments of `func` and either invokes `func` returning its result, if at least arity number of arguments have been provided, or returns a function that accepts the remaining `func` arguments, and so on. The arity of `func` may be specified if `func.length` is not sufficient.
 * @param {Function} func The function to curry.
 * @param {number} [arity=func.length]
 * @returns Returns the new curried function.
 */
export const curry = (func: Function, arity?: number) => {
  if (typeof func !== 'function' || func.length < 2) return func
  if (typeof arity !== 'number') arity = func.length
  switch (arity) {
    case 2:
      return (arg0) => (arg1) => func(arg0, arg1)
    case 3:
      return (arg0) => (arg1) => (arg2) => func(arg0, arg1, arg2)
    case 4:
      return (arg0) => (arg1) => (arg2) => (arg3) => func(arg0, arg1, arg2, arg3)
    case 5:
      return (arg0) => (arg1) => (arg2) => (arg3) => (arg4) => func(arg0, arg1, arg2, arg3, arg4)
    case 6:
      return (arg0) => (arg1) => (arg2) => (arg3) => (arg4) => (arg5) =>
        func(arg0, arg1, arg2, arg3, arg4, arg5)
    case 7:
      return (arg0) => (arg1) => (arg2) => (arg3) => (arg4) => (arg5) => (arg6) =>
        func(arg0, arg1, arg2, arg3, arg4, arg5, arg6)
    case 8:
      return (arg0) => (arg1) => (arg2) => (arg3) => (arg4) => (arg5) => (arg6) => (arg7) =>
        func(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7)
    case 9:
      return (arg0) =>
        (arg1) =>
        (arg2) =>
        (arg3) =>
        (arg4) =>
        (arg5) =>
        (arg6) =>
        (arg7) =>
        (arg8) =>
          func(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8)

    default:
      throw Error('The specified function uses too many arguments. Consider refactoring it.')
  }
}

/**
 * Creates a function that invokes `fn` with partials prepended to the arguments it receives.
 * **Note:** The given function will have `this` bound to `undefined`. If using `this` inside `fn`, consider {@link bind} instead.
 * @param {Function} fn The function to bind.
 * @param {...*} [args] The arguments to apply to `fn`.
 * @returns {Function} Returns the new partially applied function
 */
export const partial = (fn, ...args) => bind(fn, undefined, ...args)

/**
 * Creates a function composition from a given set of functions that will be each applied on the result of the previous one from left to right.
 * @param {...*} [args] The set of functions to apply.
 * @returns {Function} A new function that applies each given function on the result of the previous one.
 */
export const flow =
  (...args) =>
  (x) => {
    for (const fn of args) {
      x = fn(x)
    }
    return x
  }

/**
 * This is just an alias for the {@link flow} function.
 * @see {@link flow}
 */
export const pipe = flow

export const compose = (...args) => flow(args.reverse())

/**
 * Creates a function that memoizes the result of `func`. If `resolver` is provided, it determines the cache key for storing the result based on the arguments provided to the memoized function. By default, the first argument provided to the memoized function is used as the map cache key.
 *
 * @param {Function} func The function to have its output memoized.
 * @param {Function} [resolver] The function to resolve the cache key.
 * @return {Function} Returns the new memoized function.
 */
export function memoize(func: Function, resolver?: Function): Function {
  const cache = new Map()
  return (...args) => {
    const key = resolver ? resolver(...args) : args[0]
    const prev = cache.get(key)
    if (prev !== undefined) return prev
    const value = func(...args)
    cache.set(key, value)
    return value
  }
}

// TODO: also sized lru_cache
export function cache(target, name, descriptor) {
  const original = descriptor.value
  if (typeof original === 'function') {
    descriptor.value = memoize(original)
  }
  return descriptor
}

/**
 * Creates a debounced function that delays invoking `func` until after `wait` milliseconds have elapsed since the last time the debounced function was invoked. Subsequent calls to the debounced function return the result of the last successful invocation. Provide options to set the `maxWait` milliseconds, regardless of when the function was last invoked.
 *
 * @param {Function} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay.
 * @param {{ maxWait: number }} [opts] The maximum time `func` is allowed to be delayed before it's invoked.
 * @returns Returns the new debounced function.
 */
export function debounce(
  func: Function,
  wait: number,
  { maxWait }: { maxWait?: number } = {}
): Function {
  let timer, maxTimer, lastResult
  return (...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      clearTimeout(maxTimer)
      maxTimer = null
      lastResult = func(...args)
    }, wait)

    if (maxWait && !maxTimer) {
      maxTimer = setTimeout(() => {
        clearTimeout(timer)
        maxTimer = null
        lastResult = func(...args)
      }, maxWait)
    }

    return lastResult
  }
}

/**
 * Creates a throttled function that only invokes `func` at most once per every `wait` milliseconds. Subsequent calls to the throttled function return the result of the last successful invocation.
 *
 * @param {Function} func The function to throttle.
 * @param {number} wait The number of milliseconds to throttle invocations to.
 * @return {Function} Returns the new throttled function.
 */
export function throttle(func: Function, wait: number): Function {
  let pending = false
  return (...args) => {
    if (pending) return
    func(...args)
    pending = true
    setTimeout(() => {
      pending = false
    }, wait)
  }
}

/**
 * Creates a function that is restricted to invoking `func` once. Repeat calls to the function return the value of the first invocation. The `func` is invoked with the arguments of the created function.
 *
 * @param {Function} func The function to restrict
 * @returns {Function} Returns the new restricted function.
 * @example
```js
let func = x => x
let single = once(func)
single(1) // => 1
single(2) // => 1
single(3) // => 1
// ...
// => `func` is invoked only once.
```
 */
export function once(func: Function) {
  let result, isCalled
  return (...args) => {
    if (!isCalled) {
      result = func(...args)
      isCalled = true
    }
    return result
  }
}

export type Maybe<T> = T | undefined

export type Result<T, E = any> = [Maybe<T>, Maybe<E>]

/**
 * Wraps a function to catch any exceptions inside and return a `go` style error-return type.
 *
 * @param {Function} fun The function to wrap and catch if it throws.
 * @param {?function(err: E, res: T): *} [onFinally] Optional callback that will be called on the `finally` clause if given.
 * @returns {Function} A new function that wraps `fun`.
 * @template T,E
 */
export function result<T = any, E = unknown>(
  fun: Function<T>,
  onFinally?: (err: E, res: T) => any
) {
  return (...args): Result<T, E> => {
    let value, err
    try {
      value = fun(...args)
    } catch (error) {
      err = error
    } finally {
      onFinally?.(err, value)
    }
    return [value as T, err]
  }
}

/**
 * Wraps a function or promise to catch any exceptions inside and return a `go` style error-return type. This is like {@link result} but it deals with async functions or promises.
 *
 * @param {Function|Promise} awaitable The function or promise to await.
 * @param {?function(err: E, res: T): *} [onFinally] Optional callback that will be called on the `finally` clause if given.
 * @returns {Function} A new function that awaits the `awaitable` param and returns a return type.
 * @template T,E
 */
export function resultAsync<T = any, E = unknown>(
  awaitable: Promise<T> | Function<Promise<T>>,
  onFinally?: (err: E, res: T) => any
) {
  return async (...args): Promise<Result<T, E>> => {
    let value, err
    try {
      const promise = isPromise(awaitable) ? awaitable : awaitable(...args)
      value = await promise
    } catch (error) {
      err = error
    } finally {
      onFinally?.(err, value)
    }
    return [value as T, err]
  }
}
