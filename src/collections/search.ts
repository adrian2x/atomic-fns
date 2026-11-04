/**
 * Index searches: `findIndex`, `indexOf` and their right-to-left forms.
 */

import { eq } from '../operators/index.js'
import type { Iteratee } from '../types.js'
import { toIteratee } from './iteratee.js'
import { backwardStart, forwardStart, scan, toList } from './lists.js'

/**
 * This method is like {@link find} except that it returns the index of the first element `predicate` returns truthy for instead of the element itself.
 * @param {Array} obj The array to inspect: an iterable or array-like. Anything else finds nothing.
 * @param {string|Object|Iteratee} fn The predicate function
 * @param {number} [start=0] The index to search from. A negative one counts from the end.
 * @returns {number} The index of the found value, else -1
 * @example
```js
const users = [
  { 'user': 'barney',  'active': false },
  { 'user': 'fred',    'active': false },
  { 'user': 'pebbles', 'active': true }
]

findIndex(users, o => o.user == 'barney')
// 0

// The `shape` iteratee shorthand.
findIndex(users, { 'user': 'fred', 'active': false })
// 1

// The `property` iteratee shorthand.
findIndex(users, 'active')
// 2
```
 * @see {@link indexOf}
 * @see {@link findLastIndex}
 *
 */
export function findIndex<T>(
  obj: Iterable<T> | ArrayLike<T> | null | undefined,
  fn?: Iteratee<T> | object | PropertyKey | null,
  start = 0
): number {
  const list = toList<T>(obj)
  const it = toIteratee<T>(fn)
  return scan(list, forwardStart(start, list.length), 1, (value, i) => it(value, i, list))
}

/**
 * This method is like {@link findIndex} except that it searches for a given value directly, instead of using a predicate function. Like native `indexOf` it never matches a hole.
 * @param {Array} obj The array to inspect: an iterable or array-like. Anything else finds nothing.
 * @param {*} value The value to find
 * @param {number} [start=0] The index to search from. A negative one counts from the end.
 * @returns {number} The index of the found value, else -1
 * @example
```js
indexOf([1, 2, 1, 2], 2)
// 1

// Search from a `start` index.
indexOf([1, 2, 1, 2], 2, 2)
// 3
```
 * @see {@link findIndex}
 * @see {@link lastIndexOf}
 */
export function indexOf<T>(
  obj: Iterable<T> | ArrayLike<T> | null | undefined,
  value: T,
  start = 0
): number {
  const list = toList<T>(obj)
  return scan(list, forwardStart(start, list.length), 1, (x, i) => eq(value, x) && i in list)
}

/**
 * This method is like {@link findIndex} except that it iterates the collection from right to left.
 * @param {Array} arr The array to inspect: an iterable or array-like. Anything else finds nothing.
 * @param {string|Iteratee|Object} fn The function invoked per iteration.
 * @param {number} [start] The index to search from. A negative one counts from the end.
 * @returns {number} The index of the found value, else -1
 * @example
```js
const users = [
  { 'user': 'barney',  'active': true },
  { 'user': 'fred',    'active': false },
  { 'user': 'pebbles', 'active': false }
]

findLastIndex(users, o => o.user == 'pebbles')
// 2

// The `shape` iteratee shorthand.
findLastIndex(users, { 'user': 'barney', 'active': true })
// 0

// The `property` iteratee shorthand.
findLastIndex(users, 'active')
// 0
```
 * @see {@link findIndex}
 * @see {@link lastIndexOf}
 */
export function findLastIndex<T>(
  arr: Iterable<T> | ArrayLike<T> | null | undefined,
  fn?: Iteratee<T> | object | PropertyKey | null,
  start?: number
): number {
  const list = toList<T>(arr)
  const it = toIteratee<T>(fn)
  return scan(list, backwardStart(start, list.length), -1, (value, i) => it(value, i, list))
}

/**
 * This method is like {@link indexOf} except that it iterates the collection from right to left.
 * @param {Array} obj The array to inspect: an iterable or array-like. Anything else finds nothing.
 * @param {*} value The value to find
 * @param {number} [start] The index to search from. A negative one counts from the end.
 * @returns {number} The index of the found value, else -1
 * @example
```js
lastIndexOf([1, 2, 1, 2], 2)
// 3

// Search from the `fromIndex`.
lastIndexOf([1, 2, 1, 2], 2, 2)
// 1
```
 * @see {@link findLastIndex}
 * @see {@link indexOf}
 */
export function lastIndexOf<T>(
  obj: Iterable<T> | ArrayLike<T> | null | undefined,
  value: T,
  start?: number
): number {
  const list = toList<T>(obj)
  return scan(list, backwardStart(start, list.length), -1, (x, i) => eq(value, x) && i in list)
}
