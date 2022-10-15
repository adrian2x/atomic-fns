import { Function } from './globals.js';
export declare const bind: (fn: any, self: any, ...args: any[]) => any;
export declare const partial: (fn: any, ...args: any[]) => any;
export declare const flow: (...args: any[]) => (x: any) => any;
export declare const pipe: (...args: any[]) => (x: any) => any;
export declare const compose: (...args: any[]) => (x: any) => any;
/**
 * Creates a function that memoizes the result of `func`. If `resolver` is provided, it determines the cache key for storing the result based on the arguments provided to the memoized function. By default, the first argument provided to the memoized function is used as the map cache key.
 *
 *
 * @param {Function} func The function to have its output memoized.
 * @param {Function} [resolver] The function to resolve the cache key.
 * @return {Function} Returns the new memoized function.
 */
export declare function memoize(func: Function, resolver?: Function): Function;
/**
 * Creates a debounced function that delays invoking `func` until after `wait` milliseconds have elapsed since the last time the debounced function was invoked. Subsequent calls to the debounced function return the result of the last successful invocation. Provide options to set the `maxWait` milliseconds, regardless of when the function was last invoked.
 *
 *
 * @param {Function} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay.
 * @param {{ maxWait: number }} { maxWait } The maximum time `func` is allowed to be delayed before it's invoked.
 * @return {Function} Returns the new debounced function.
 */
export declare function debounce(func: Function, wait: number, { maxWait }: {
    maxWait: number;
}): Function;
/**
 * Creates a throttled function that only invokes `func` at most once per every `wait` milliseconds. Subsequent calls to the throttled function return the result of the last successful invocation.
 *
 *
 * @param {Function} func The function to throttle.
 * @param {number} time The number of milliseconds to throttle invocations to.
 * @return {Function} Returns the new throttled function.
 */
export declare function throttle(func: Function, time: number): Function;
