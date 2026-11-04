/**
 * Iteration helpers: `forEach`, `map`, `filter`, the `find` family, `compact`, `insert`.
 * Array holes follow the native method each helper is named after.
 */

import { isIterable } from '../globals/index.js'
import { assertNotHugeSparse, walkArray } from '../internal/arrayKeys.js'
import { isCompactEmpty } from '../internal/compactEmpty.js'
import { arrayFromIterable } from '../internal/iterable.js'
import { identity } from '../operators/index.js'
import type { Iteratee } from '../types.js'
import { toIteratee } from './iteratee.js'
import { backwardStart, forwardStart, listOf, scan, toInteger, toList } from './lists.js'
import { assignData, isPlainObject } from './object.js'

/**
 * Creates a new array with all falsy and empty values removed (SPEC-R40).
 * Shares `isCompactEmpty` with `icompact`; does not change `isEmpty`.
 * Nullish and scalar input gives `[]`, and strings, iterables and array-likes give an array. A
 * plain object, or any other object, compacts its own enumerable string keys into a new plain
 * object instead, so a class instance comes back as a plain object.
 * @param arr The array to compact
 * @example
```js
compact([0, 1, false, 2, '', 3])
// [1, 2, 3]
```
 * @returns A new array with the filtered values, or a new plain object for the object form.
 */
export function compact<T>(arr: T[]): T[]
export function compact(arr: null | undefined): []
export function compact<T>(arr: T): Partial<T>
export function compact<T>(arr: T | T[]): T[] | Partial<T> {
  const list = isPlainObject(arr) ? undefined : listOf(arr)
  if (list !== undefined) {
    const out: T[] = []
    walkArray(list, (ev) => {
      if (ev.kind === 'value' && !isCompactEmpty(ev.value)) out.push(ev.value as T)
    })
    return out
  }
  if (Object(arr) !== arr) return []
  const source = arr as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(source)) {
    if (!isCompactEmpty(source[key])) assignData(result, key, source[key])
  }
  return result as Partial<T>
}

/**
 * Iterates over elements of collection, returning an array of all elements where predicate returns truthy value.
 *
 * The predicate is invoked with three arguments: `(value, index|key, arr)`.
 *
 * @example
```js
const users = [
  { 'user': 'barney', 'age': 36, 'active': true },
  { 'user': 'fred',   'age': 40, 'active': false }
]

filter(users, o => !o.active).map(u => u.user)
// ['fred']

filter(users, { age: 36, active: true }).map(u => u.user)
// ['barney']

filter(users, 'active').map(u => u.user)
// ['barney']
```
 * @param {Array} arr The collection to iterate over
 * @param {Function} fn The predicate function invoked for each item. Defaults to identity.
 * @returns {Array} The new filtered array
 */
export function filter<T>(
  arr: T[] | object | null | undefined,
  fn?: Iteratee<T> | object | PropertyKey | null
): T[] {
  const predicate = toIteratee<T>(fn)
  const results: T[] = []
  forEach<T>(arr, (value, key) => {
    if (predicate(value, key, arr)) results.push(value)
  })
  return results
}

/**
 * Iterates over elements of collection, returning the first element where predicate returns truthy value. The predicate is invoked with three arguments: `(value, index|key, collection)`.
 * @example
```js
const users = [
  { 'user': 'barney',  'age': 36, 'active': true },
  { 'user': 'fred',    'age': 40, 'active': false },
  { 'user': 'pebbles', 'age': 1,  'active': true }
]

find(users, o => o.age < 40).user
// 'barney'

find(users, { 'age': 1, 'active': true }).user
// 'pebbles'

find(users, 'active').user
// 'barney'
```
 * @param {Array} arr The collection to iterate over.
 * @param {Function} fn The function invoked per iteration. Defaults to identity.
 * @param {number} [fromIndex=0] The index to search from. A negative one counts from the end.
 * @returns {*} The matched element, else `undefined`.
 * @see {@link findLast}
 */
export function find<T>(
  arr: T[] | object | null | undefined,
  fn?: Iteratee<T> | object | PropertyKey | null,
  fromIndex = 0
): T | undefined {
  const it = toIteratee<T>(fn)
  const inList = (list: T[]): T | undefined => {
    const hit = scan(list, forwardStart(fromIndex, list.length), 1, (v, i) => it(v, i, arr))
    return hit < 0 ? undefined : list[hit]
  }
  if (arr == null) return undefined
  if (Array.isArray(arr)) return inList(arr)
  if (isIterable(arr)) {
    const from = toInteger(fromIndex)
    if (from < 0) return inList(arrayFromIterable<T>(arr))
    let i = 0
    for (const value of arr as Iterable<T>) {
      if (i >= from && it(value, i, arr)) return value
      i++
    }
    return undefined
  }
  const record = arr as Record<string, T>
  const keys = Object.keys(record)
  const hit = scan(keys, forwardStart(fromIndex, keys.length), 1, (k) => it(record[k], k, arr))
  return hit < 0 ? undefined : record[keys[hit]]
}

/**
 * Inserts `value` at `index` via `Array.splice`. Returns `arr` unchanged when `arr` is nullish or `index < 0`.
 * An index past the end appends; a non-integer index follows `splice` coercion (for example `NaN` inserts at 0).
 * A huge sparse array throws `RangeError('sparse array too large')`.
 *
 * @param {Array<*>} arr The given array to insert into
 * @param {number} index The index of the array insert operation.
 * @param {*} value The value to insert in the array at the given `index`.
 * @returns {Array<*>} The given array.
 */
export function insert<T, A extends T[] | null | undefined>(arr: A, index: number, value: T): A {
  if (!arr || index < 0) return arr
  assertNotHugeSparse(arr)
  arr.splice(index, 0, value)
  return arr
}

/**
 * Iterates over elements of collection and invokes `iteratee` for each element. The iteratee is invoked with three arguments: `(value, index|key, collection)`. Iteratee functions may exit iteration early by explicitly returning `false`.
 * @example
```js
const out = []
forEach([1, 2], (value) => { out.push(value) })
out
// [1, 2]

const keysOut = []
forEach({ 'a': 1, 'b': 2 }, (value, key) => { keysOut.push(key) })
keysOut
// ['a', 'b']
```
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Iteratee} fn The function invoked per iteration.
 * @returns {void}
 * @see {@link forEachRight}
 * @see {@link filter}
 * @see {@link map}
 */
export function forEach<T>(
  collection: Iterable<T> | object | null | undefined,
  fn: Iteratee<T> = identity
): void {
  if (collection == null) return
  if (Array.isArray(collection)) {
    walkArray(collection, (ev) => {
      if (ev.kind === 'value' && fn(ev.value as T, ev.index, collection) === false) return false
    })
    return
  }
  if (isIterable(collection)) {
    let index = 0
    for (const value of collection) {
      if (fn(value as T, index++, collection) === false) return
    }
    return
  }
  const obj = collection as Record<string, T>
  for (const key of Object.keys(obj)) {
    if (fn(obj[key], key, collection) === false) return
  }
}

/**
 * This method is like {@link find} except that it iterates from right to left.
 * @example
```js
findLast([1, 2, 3, 4], n => n % 2 === 1)
//  3
```
 * @param {Array} arr The collection to iterate over.
 * @param {Function} fn The function invoked per iteration. Defaults to identity.
 * @param {number} [fromIndex] The index to search from. A negative one counts from the end.
 * @returns {*} The matched element, else `undefined`.
 * @see {@link find}
 */
export function findLast<T>(
  arr: Iterable<T> | object | null | undefined,
  fn?: Iteratee<T> | object | PropertyKey | null,
  fromIndex?: number
): T | undefined {
  const it = toIteratee<T>(fn)
  if (arr == null) return undefined
  if (Array.isArray(arr) || isIterable(arr)) {
    const list = toList<T>(arr)
    const hit = scan(list, backwardStart(fromIndex, list.length), -1, (v, i) => it(v, i, arr))
    return hit < 0 ? undefined : list[hit]
  }
  const record = arr as Record<string, T>
  const keys = Object.keys(record)
  const hit = scan(keys, backwardStart(fromIndex, keys.length), -1, (k) => it(record[k], k, arr))
  return hit < 0 ? undefined : record[keys[hit]]
}

/**
 * This method is like {@link forEach} except that it iterates over the collection from right to left.

 * @example
```js
const out = []
forEachRight([1, 2], (value) => { out.push(value) })
out
// [2, 1]
```
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Iteratee} fn The function invoked per iteration.
 * @returns {void}
 * @see {@link forEach}
 * @see {@link filter}
 * @see {@link map}
 */
export function forEachRight<T>(
  collection: Iterable<T> | object | null | undefined,
  fn: Iteratee<T> = identity
): void {
  if (collection == null) return
  if (Array.isArray(collection)) {
    const idxs: number[] = []
    walkArray(collection, (ev) => {
      if (ev.kind === 'value') idxs.push(ev.index)
    })
    for (let i = idxs.length - 1; i >= 0; i--) {
      const idx = idxs[i]
      if (fn(collection[idx] as T, idx, collection) === false) return
    }
    return
  }
  if (isIterable(collection)) {
    const items = arrayFromIterable<T>(collection)
    for (let i = items.length - 1; i >= 0; i--) {
      if (fn(items[i], i, collection) === false) return
    }
    return
  }
  const obj = collection as Record<string, T>
  const keys = Object.keys(obj)
  for (let i = keys.length - 1; i >= 0; i--) {
    if (fn(obj[keys[i]], keys[i], collection) === false) return
  }
}

/**
 * Creates an array of values by running each element in collection thru iteratee. The iteratee is invoked with three arguments: `(value, index|key, collection)`.
 * A huge sparse array throws `RangeError('sparse array too large')`.
 * @example
```js
function square(n) {
  return n * n
}

map([4, 8], square)
// [16, 64]

map({ a: 4, b: 8 }, square)
// [16, 64]

const users = [
  { user: 'barney' },
  { user: 'fred' }
]

// The `property` iteratee shorthand.
map(users, 'user')
// ['barney', 'fred']
```
 * @param {Array|Object} arr The collection to iterate over.
 * @param {Iteratee} fn The function invoked per iteration. Defaults to identity.
 * @returns Returns the new mapped array.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map Array.map()}
 */
export function map<T, TResult = T>(
  arr: T[] | object | null | undefined,
  fn?: Iteratee<T, PropertyKey, TResult> | object | PropertyKey | null
): TResult[] {
  const it = toIteratee(fn) as Iteratee<T, PropertyKey, TResult>
  if (arr == null) return []
  if (Array.isArray(arr)) {
    assertNotHugeSparse(arr)
    return (arr as T[]).map((x, i) => it(x, i, arr))
  }
  if (isIterable(arr)) {
    const out: TResult[] = []
    let i = 0
    for (const x of arr as Iterable<T>) {
      out.push(it(x, i, arr))
      i++
    }
    return out
  }
  const obj = arr as Record<PropertyKey, T>
  return Object.keys(obj).map((key) => it(obj[key], key, arr))
}
