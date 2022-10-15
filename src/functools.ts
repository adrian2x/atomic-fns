/**
 * FP
 * @module
 */
import { Function } from './globals.js'

export const bind = (fn, self, ...args) => fn.bind(self, ...args)

export const partial = (fn, ...args) => bind(fn, {}, ...args)

export const flow =
  (...args) =>
  (x: any) => {
    for (const fn of args) {
      x = fn(x)
    }
    return x
  }

export const pipe = flow

export const compose = (...args) => flow(args.reverse())

/**
 * Creates a function that memoizes the result of `func`. If `resolver` is provided, it determines the cache key for storing the result based on the arguments provided to the memoized function. By default, the first argument provided to the memoized function is used as the map cache key.
 *
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

/**
 * Creates a debounced function that delays invoking `func` until after `wait` milliseconds have elapsed since the last time the debounced function was invoked. Subsequent calls to the debounced function return the result of the last successful invocation. Provide options to set the `maxWait` milliseconds, regardless of when the function was last invoked.
 *
 *
 * @param {Function} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay.
 * @param {{ maxWait: number }} { maxWait } The maximum time `func` is allowed to be delayed before it's invoked.
 * @return {Function} Returns the new debounced function.
 */
export function debounce(func: Function, wait: number, { maxWait }: { maxWait: number }): Function {
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
 *
 * @param {Function} func The function to throttle.
 * @param {number} time The number of milliseconds to throttle invocations to.
 * @return {Function} Returns the new throttled function.
 */
export function throttle(func: Function, time: number): Function {
  let pending = false
  return (...args) => {
    if (pending) return
    func(...args)
    pending = true
    setTimeout(() => {
      pending = false
    }, time)
  }
}
