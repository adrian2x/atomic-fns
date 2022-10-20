/**
 * This module includes functions that deal with or produce iterators.
 *
 * @module Iterators
 */
import { Comp, Function, Predicate } from '../globals/index.js';
import { add } from '../operators/index.js';
/**
 * Make an iterator that returns accumulated sums, or accumulated results of other binary functions (specified via the optional `func` argument).
 * @param iterable The iterable to accumulate
 * @param func The accumulator function (default `add`).
 * @param initial Optional initial value (defaults to the first element in iterable)
 * @returns A sequence of accumulated values
 */
export declare function accumulate<T>(iterable: Iterable<T>, func?: typeof add, initial?: any): Generator<any, void, unknown>;
/**
 * Returns `true` when all of the items in iterable are truthy. An optional predicate function can be used to define what truthiness means for this specific collection.
 * @param iterable
 * @param fn
 * @returns `True` if all elements pass the test or are truthy else `false`.
 * @example
```js
all([0])
// => true

all([1, 2, 3])
// => true

all([2, 4, 6] => (n) => n > 1)
// => true
```
@see {@link any}
 */
export declare const all: <T>(iterable: Iterable<T>, fn?: Predicate<T>) => boolean;
/**
 * Returns true when any of the items in iterable are truthy. An optional predicate function can be used to define what truthiness means for this specific collection.
 * @param iterable
 * @param fn
 * @returns `True` if any element passes the test or is truthy else `false`.
 * @example
```js
any([0])
// => false

any([0, 1, null, undefined])
// => true

any([1, 4, 5] => (n) => n % 2 === 0)
// => true
```
@see {@link all}
 */
export declare const any: <T>(iterable: Iterable<T>, fn?: Predicate<T>) => boolean;
export declare function chain<T>(...iterables: Array<Iterable<T>>): Generator<T, void, unknown>;
/**
 * Checks if the `value` is in `collection`.
 * @param collection The collection to inspect.
 * @param value The value to search for.
 * @returns Returns `true` if value is found, else `false`.
 * @example
```js
contains([1, 2, 3], 1)
// => true

contains([1, 2, 3], 1, 2)
// => false

contains({ 'a': 1, 'b': 2 }, 1)
// => true

contains('abcd', 'bc')
// => true
```
 *
 * @see {@link collections.find}
 */
export declare function contains(collection: Iterable<any>, value: any): any;
/**
 * Returns a generator that drops elements from the iterable as long as the predicate is `true`; afterwards, returns every remaining element. Note, the generator does not produce any output until the predicate first becomes `false`.
 * @param iterable The iterable to inspect.
 * @param predicate A function invoked per element to check if it should be dropped.
 * @returns Elements
 */
export declare function dropWhile<T>(iterable: Iterable<T>, predicate: Predicate): Generator<unknown, any, unknown>;
/**
 * Yields elements like `[index, item]` from an iterable. Index starts at zero by default.
 * @template T
 * @param iterable The iterable to inspect.
 * @param start The starting index.
 * @returns A generator with tuples like `[index, item]`.
 * @example
```js
console.log([...enumerate(['hello', 'world'])])
// => [[0, 'hello'], [1, 'world']]

// Start with index `1`
console.log([...enumerate(['hello', 'world'], 1)])
// => [[1, 'hello'], [2, 'world']]
```
 */
export declare function enumerate<T = any>(iterable: Iterable<T>, start?: number): Generator<(number | T)[], void, unknown>;
/**
 * Returns the first element in an iterable.
 * @param iterable The iterable to inspect.
 * @returns The first element found or undefined if iterable is empty.
 */
export declare function first<T>(iterable: Iterable<T>): any;
/**
 * Creates a new generator that filters all `falsey` and empty values from iterable.
 * @param arr The array to compact
 * @returns A new array with the filtered values.
 * @example
```js
compact([0, 1, false, 2, '', 3])
// => [1, 2, 3]
```
 */
export declare function icompact<T>(iterable: Iterable<T>): Generator<T, void, unknown>;
/**
 * Iterates over elements of collection, producing only those elements where predicate returns a `truthy` value.
 */
export declare function ifilter<T>(iterable: Iterable<T>, predicate: Predicate): Generator<T, void, unknown>;
export declare function imap<T>(iterable: Iterable<T>, mapFn: (x: T) => any): Generator<any, void, unknown>;
/**
 * Returns a generator flattening one level of nesting in a list of lists.
 * @param iterables The iterable to flatten
 * @example
```js
[...iflatten([[0, 1], [2, 3]])]
// => [0, 1, 2, 3]
```
 */
export declare function iflatten<T = any>(iterables: Iterable<Iterable<T>>): Generator<T, void, unknown>;
export declare function flatMap<T>(iterable: Iterable<T>, mapFn?: (x: T) => any): Generator<T, void, unknown>;
export declare function islice<T>(iterable: Iterable<T>, start: number, stop?: number, step?: number): Generator<number | T, number | T | undefined, unknown>;
export declare function itake<T>(n: number, iterable: Iterable<T>): Generator<unknown, void, unknown>;
/**
 * Returns an Iterator from the elements of a collection or the object keys.
 * @param obj The given collection to iterate over.
 * @returns An Iterator type.
 */
export declare function iter<T>(obj: any): Iterator<T>;
export declare function partition<T>(iterable: Iterable<T>, predicate: Predicate<T>): T[][];
/**
 * Returns the smallest element in an iterable. The optional `key` argument specifies a transform on the elements before comparing them. If the elements in the iterable are objects that implement a custom `le` method, this will be called to compare.
 * @param iterable The iterable to inspect.
 * @param key Optional key function to transform the elements (default `id`).
 * @returns The smallest element in the iterable.
 */
export declare function min<T>(iterable: Iterable<T>, key?: (x: any) => any): any;
/**
 * Returns the largest element in an iterable. The optional `key` argument specifies a transform on the elements before comparing them. If the elements in the iterable are objects that implement a custom `gt` method, this will be called to compare.
 * @param iterable The iterable to inspect.
 * @param key Optional key function to transform the elements (default `id`).
 * @returns The largest element in the iterable.
 */
export declare function max<T>(iterable: Iterable<T>, key?: (x: any) => any): any;
/**
 * Returns a generator for a sequence of numbers in the given range, starting from `start` (default 0) to `stop` (not-inclusive) in increments of `step` (default 1).
 *
 * `range(x)` is a shorthand for `range(0, x, 1)`.
 * @param args When called with a single argument, it is assigned to `stop` param. If two arguments are given, it will assign them to `(start, stop)`. When three arguments, it means `(start, stop, step)`.
 * @example
```js
range(5)
// => [0, 1, 2, 3, 4]

range(2, 5)
// => [2, 3, 4]

range(0, 5, 2)
// => [0, 2, 4]

range(5, 0, -1)
// => [5, 4, 3, 2, 1]

range(-3)
// => []
```
 */
export declare function range(...args: number[]): Generator<number, void, unknown>;
/**
 * Applies a `reducer` function on each element of the iterable, in order, passing the return value from the operation on the previous element. The final result of running the reducer across all elements of the iterable is a single value.
 * @param iterable The collection to reduce.
 * @param reducer A reducer function that will be called per item.
 * @param initial Optional initial value (defaults to the first element in the iterable).
 * @returns The result of calling reducer on each item.
 * @example
```js
reduce([1, 2, 3, 4, 5], (x, y) => x + y, 0)
// => 15
```
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce Array.reduce()}
 */
export declare function reduce<T>(iterable: Iterable<T>, reducer: (prev: T, value: T, index: any) => T, initial?: any): any;
/**
 * Creates a new array with the elements from the iterable in reverse order.
 * @param iterable The iterable to inspect.
 * @returns A new array with the elements reversed.
 */
export declare function reversed<T>(iterable: Iterable<T>): T[];
export declare function sorted(args: any[]): any[];
export declare function sorted(args: any[], reverse: boolean): any[];
export declare function sorted(args: any[], reverse: boolean, comp: Comp): any[];
export declare function sorted(args: any[], key: Function): any[];
export declare function sorted(args: any[], key: Function, reverse: boolean): any[];
export declare function sort(args: any[]): any[];
export declare function sort(args: any[], reverse: boolean): any[];
export declare function sort(args: any[], compareFn: Comp): any[];
export declare function sort(args: any[], reverse: boolean, compareFn: Comp): any[];
/**
 * Sums `initial` and the items of an iterable and returns the total.
 * @param args The elements to add to `initial`.
 * @param initial The initial value to add to (default `0`).
 * @returns The total sum of initial and iterable elements.
 * @example
```js
sum([1, 2, 3, 4])
// => 10

sum([1, 2, 3, 4], 5)
// => 15
```
 */
export declare function sum(args: Iterable<number>, initial?: number): number;
export declare function take<T>(n: number, iterable: Iterable<T>): unknown[];
/**
 * Returns a generator that takes elements from the iterable as long as the predicate is `true`.
 * @param iterable The iterable to inspect.
 * @param predicate A function invoked per element to check if it should be taken.
 * @returns Elements
 */
export declare function takeWhile<T>(iterable: Iterable<T>, predicate: Predicate): Generator<T, void, unknown>;
/** Returns a generator that calls `fn(index)` for each index < n */
/**
 * Returns a generator that produces `fn(index)` for each `index < n`.
 * @param n The number of times to invoke `fn`.
 * @param fn A function used to produce the results.
 */
export declare function times(n: number, fn: (index: number) => any): Generator<any, void, unknown>;
/**
 * Returns a generator that aggregates elements from the iterables producing tuples with the next element from each one.
 * @param args The iterables to zip
 * @returns Tuples with elements from each iterator
 * @example
```js
for item of zip([1, 2, 3], ['sugar', 'spice', 'nice'])
  console.log(item)
// => [1, 'sugar']
// => [2, 'spice']
// => [3, 'nice']
```
 */
export declare function zip(...args: Array<Iterable<any>>): Generator<any[], void, unknown>;
