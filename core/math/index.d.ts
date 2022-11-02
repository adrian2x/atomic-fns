/**
 * Math and algebraic operations.
 *
 * @module Math
 */
import { Predicate } from '../globals/index.js';
/**
 * Returns the absolute value of a number. The argument may be a number or an object implementing the `abs()`.
 * @param x The value.
 * @returns The absolute value.
 */
export declare function abs(x: any): number;
/**
 * Round `x` to the number of digits after the decimal point. If `digits` is
 * omitted, it returns the nearest integer to x.
 *
 * @param {number} x
 * @param {number} [digits=0]
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round Math.round()}
 */
export declare function round(x: number, digits?: number): number;
/**
 * Rounds down and returns the largest integer less than or equal to a given number.
 * @param x A number.
 * @returns Nearest integer less than or equal to number.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/floor Math.floor()}
 */
export declare const floor: (x: number) => number;
/**
 * Rounds up and returns the largest integer greater than or equal to a given number.
 * @param x A number.
 * @returns Nearest integer greater than or equal to number.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/ceil Math.ceil()}
 */
export declare const ceil: (x: number) => number;
/**
 * Returns a tuple like `[x / y, x % y]`.
 *
 * @param x
 * @param y
 * @returns
 */
export declare function divmod(x: number, y: number): number[];
export declare function log2(x: any): number;
export declare function logBase(x: any, y: any): number;
/**
 * Returns the smallest element in an iterable. The optional `key` argument specifies a transform on the elements before comparing them. If the elements in the iterable are objects that implement a custom `lt` method, this will be called to compare.
 * @param iterable The iterable to inspect.
 * @param key Optional key function to transform the elements (default `id`).
 * @returns The smallest element in the iterable.
 */
export declare function min(iterable: number[]): number;
export declare function min<T>(iterable: Iterable<T>, key?: Predicate<T>): T;
/**
 * Returns the largest element in an iterable. The optional `key` argument specifies a transform on the elements before comparing them. If the elements in the iterable are objects that implement a custom `gt` method, this will be called to compare.
 * @param iterable The iterable to inspect.
 * @param key Optional key function to transform the elements (default `id`).
 * @returns The largest element in the iterable.
 */
export declare function max(iterable: number[]): number;
export declare function max<T>(iterable: Iterable<T>, key?: Predicate<T>): T;
/**
 * Computes the mean of the values in `iterable` and accepts an optional `key` function which is invoked for each element to generate the values to be averaged.
 * @param {Array<number>|Iterable<T>} iterable
 * @param {Function} [key] Optional iteratee invoked per element.
 * @returns Returns the mean value or `false` if no elements.
 * @template T
 * @example
```js
let objects = [{ 'n': 4 }, { 'n': 2 }, { 'n': 8 }, { 'n': 6 }]

mean(objects, (o) => o.n)
// 5
```
 */
export declare function mean(iterable: number[]): false | number;
export declare function mean<T>(iterable: Iterable<T>, key?: Predicate<T>): false | number;
/**
 * Sums `initial` and the items of an iterable and returns the total.
 * @param args The elements to add to `initial`.
 * @param initial The initial value to add to (default `0`).
 * @returns The total sum of initial and iterable elements.
 * @example
```js
sum([1, 2, 3, 4])
// 10

sum([1, 2, 3, 4], 5)
// 15
```
 */
export declare function sum(iterable: number[]): number;
export declare function sum<T>(iterable: Iterable<T>, key?: Predicate<T>): T;
export declare function sum<T>(iterable: Iterable<T>, key?: Predicate<T>): T;
