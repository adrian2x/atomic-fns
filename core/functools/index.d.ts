/**
 * This module includes functions that promote a more functional programming style.
 *
 * @module Functions
 */
import { Function } from '../globals/index.js';
/**
 * Creates a function that invokes `fn` with the this binding of `thisArg` and `partials` as partially applied arguments.
 * @param {Function} fn The function to bind.
 * @param {*} thisArg The `this` value of `fn`.
 * @param {...*} [partials] The arguments to prepend to `fn`.
 * @returns {Function} Returns the new bound function.
 * @see {@link partial}
 */
export declare const bind: (fn: Function, thisArg: any, ...partials: any[]) => (...args: any[]) => any;
/**
 * Creates a function that accepts arguments of `func` and either invokes `func` returning its result, if at least arity number of arguments have been provided, or returns a function that accepts the remaining `func` arguments, and so on. The arity of `func` may be specified if `func.length` is not sufficient.
 * @param {Function} func The function to curry.
 * @param {number} [arity=func.length]
 * @returns Returns the new curried function.
 */
export declare const curry: (func: Function, arity?: number) => Function<any>;
/**
 * Creates a function that invokes `fn` with partials prepended to the arguments it receives.
 * **Note:** The given function will have `this` bound to `undefined`. If using `this` inside `fn`, consider {@link bind} instead.
 * @param {Function} fn The function to bind.
 * @param {...*} [args] The arguments to apply to `fn`.
 * @returns {Function} Returns the new partially applied function
 */
export declare const partial: (fn: any, ...args: any[]) => (...args: any[]) => any;
/**
 * Creates a function composition from a given set of functions that will be each applied on the result of the previous one from left to right.
 * @param {...*} [args] The set of functions to apply.
 * @returns {Function} A new function that applies each given function on the result of the previous one.
 */
export declare const flow: (...args: any[]) => (x: any) => any;
/**
 * This is just an alias for the {@link flow} function.
 * @see {@link flow}
 */
export declare const pipe: (...args: any[]) => (x: any) => any;
export declare const compose: (...args: any[]) => (x: any) => any;
/**
 * Creates a function that memoizes the result of `func`. If `resolver` is provided, it determines the cache key for storing the result based on the arguments provided to the memoized function. By default, the first argument provided to the memoized function is used as the map cache key.
 *
 * @param {Function} func The function to have its output memoized.
 * @param {Function} [resolver] The function to resolve the cache key.
 * @return {Function} Returns the new memoized function.
 */
export declare function memoize<T>(func: Function<T>, resolver?: Function): Function<ReturnType<typeof func>>;
export declare function cache(target: any, name: any, descriptor: any): any;
/**
 * Creates a debounced function that delays invoking `func` until after `wait` milliseconds have elapsed since the last time the debounced function was invoked. Subsequent calls to the debounced function return the result of the last successful invocation. Provide options to set the `maxWait` milliseconds, regardless of when the function was last invoked.
 *
 * @param {Function} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay.
 * @param {{ maxWait: number }} [opts] The maximum time `func` is allowed to be delayed before it's invoked.
 * @returns Returns the new debounced function.
 */
export declare function debounce(func: Function, wait: number, { maxWait }?: {
    maxWait?: number;
}): Function;
/**
 * Creates a throttled function that only invokes `func` at most once per every `wait` milliseconds. Subsequent calls to the throttled function return the result of the last successful invocation.
 *
 * @param {Function} func The function to throttle.
 * @param {number} wait The number of milliseconds to throttle invocations to.
 * @return {Function} Returns the new throttled function.
 */
export declare function throttle(func: Function, wait: number): Function;
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
export declare function once<T>(func: Function<T>): (...args: any[]) => T;
export declare type Maybe<T> = T | undefined;
export declare type Result<T, E = any> = [Maybe<T>, Maybe<E>];
export declare type Optional<T> = Maybe<T>;
/**
 * Wraps a function to catch any exceptions inside and return a `go` style error-return type {@link Result}.
 *
 * @param {Function} fun The function to wrap and catch if it throws.
 * @param {?function(err: E, res: T): *} [onFinally] Optional callback that will be called on the `finally` clause if given.
 * @returns {Function} A new function that wraps `fun`.
 * @template T,E
 */
export declare function result<T = any, E = unknown>(fun: Function<T>, onFinally?: (err: E, res: T) => any): (...args: any[]) => Result<T, E>;
/**
 * Wraps a function or promise to catch any exceptions inside and return a `go` style error-return type. This is like {@link result} but it deals with async functions or promises.
 *
 * @param {Function|Promise} awaitable The function or promise to await.
 * @param {?function(err: E, res: T): *} [onFinally] Optional callback that will be called on the `finally` clause if given.
 * @returns {Function} A new function that awaits the `awaitable` param and returns a {@link Result} type.
 * @template T,E
 */
export declare function resultAsync<T = any, E = unknown>(awaitable: Promise<T> | Function<Promise<T>>, onFinally?: (err: E, res: T) => any): (...args: any[]) => Promise<Result<T, E>>;
