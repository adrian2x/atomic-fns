/**
 * Collection classes and helpers (arrays, objects, sets, maps, trees).
 *
 * @module collections
 */

import {
  get,
  isBool,
  isEmpty,
  isIterable,
  isNull,
  isNumber,
  isObject,
  isString,
  keys,
  ValueError
} from '../globals/index.js'
import { enumerate } from '../itertools/index.js'
import { compare, eq, identity } from '../operators/index.js'
import type { Iteratee } from '../types.js'
import { isPlainObject } from './object.js'

export { SetCollection, ValueCollection, MapCollection } from './abc.js'
export * from './BTree.js'
export * from './deque.js'
export * from './frozenset.js'
export * from './Heap.js'
export * from './LRUCache.js'
export * from './SortedMap.js'
export * from './SortedSet.js'
export * from './SplayTree.js'

export * from './Trie.js'
export {
  defineData,
  isPlainObject,
  merge,
  pick,
  omit,
  clone,
  cloneArray,
  cloneTypedArray
} from './object.js'
export { bisect, bisectLeft, binarySearch, insort, insortLeft } from './bisect.js'

/** Predicate for remove/reject: function, plain-object shape, or property path. */
export type Predicate<T> =
  ((value: T, index: number, coll: unknown) => unknown) | Partial<T> | string

function resolvePredicate<T>(
  predicate: Predicate<T>
): (value: T, index: number, coll: unknown) => unknown {
  if (typeof predicate === 'function') return predicate
  if (typeof predicate === 'string') return (obj) => get(predicate, obj)
  return matches(predicate)
}

function toIteratee<T>(fn: Iteratee<T> | object | PropertyKey): Iteratee<T> {
  if (typeof fn === 'function') return fn as Iteratee<T>
  if (isObject(fn)) return matches(fn)
  return (obj) => get(fn as PropertyKey, obj)
}

/**
 * Creates a new array with all falsy and empty values removed.
 * @param arr The array to compact
 * @example
```js
compact([0, 1, false, 2, '', 3])
// [1, 2, 3]
```
 * @returns A new array with the filtered values
 */
export function compact<T>(arr: T[]): T[]
export function compact<T>(arr: T): Partial<T>
export function compact<T>(arr: T | T[]): T[] | Partial<T> {
  if (!arr) return Array.isArray(arr) ? [] : {}
  if (Array.isArray(arr)) return arr.filter((x) => !isEmpty(x))
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(arr)) {
    if (!isEmpty((arr as Record<string, unknown>)[key])) {
      result[key] = (arr as Record<string, unknown>)[key]
    }
  }
  return result as Partial<T>
}

/**
 * Creates an object composed of keys from the results of running elements of `collection` thru `iteratee`. The corresponding value of each key is the number of times the key was returned by `iteratee`.
 * @param iterable
 * @param func
 * @returns {Object} Returns an Object with the frequency values
 * @example
```js
count([6.1, 4.2, 6.3], Math.floor);
// { '4': 1, '6': 2 }

// property iteratee shorthand.
count(['one', 'two', 'three'], x => x.length);
// { '3': 2, '5': 1 }
```
 */
export function count<T>(obj: T[] | object, func: Iteratee<T>): Record<string, number> {
  const counters = Object.create(null) as Record<string, number>
  forEach(obj, (value, key) => {
    const result = String(func(value, key))
    counters[result] = (counters[result] ?? 0) + 1
  })
  return counters
}

/**
 * Iterates over elements of collection, returning an array of all elements where predicate returns truthy value.
 *
 * The predicate is invoked with three arguments: `(value, index|key, arr)`.
 *
 * @example
```js
let users = [
  { 'user': 'barney', 'age': 36, 'active': true },
  { 'user': 'fred',   'age': 40, 'active': false }
]

filter(users, o => !o.active)
 // objects for ['fred']

// The shape iteratee shorthand.
filter(users, { age: 36, active: true })
// objects for ['barney']

// The property iteratee shorthand.
filter(users, 'active')
// objects for ['barney']
```
 * @param {Array} arr The collection to iterate over
 * @param {Function} fn The predicate function invoked for each item
 * @returns {Array} The new filtered array
 */
export function filter<T>(
  arr: T[] | object | null | undefined,
  fn: Iteratee<T> | object | PropertyKey = identity
): T[] {
  if (!arr) return []
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
let users = [
  { 'user': 'barney',  'age': 36, 'active': true },
  { 'user': 'fred',    'age': 40, 'active': false },
  { 'user': 'pebbles', 'age': 1,  'active': true }
]

find(users, o => o.age < 40)
// object for 'barney'

// The shape iteratee shorthand.
find(users, { 'age': 1, 'active': true })
// object for 'pebbles'

// The `property` iteratee shorthand.
find(users, 'active')
// object for 'barney'
```
 * @param {Array} arr The collection to iterate over.
 * @param {Function} fn The function invoked per iteration.
 * @returns {*} The matched element, else `undefined`.
 * @see {@link findLast}
 */
export function find<T>(arr: T[] | object, fn: Iteratee<T> | object | PropertyKey): T | undefined {
  const it = toIteratee<T>(fn)
  if (Array.isArray(arr)) {
    return (arr as T[]).find(it)
  } else if (isObject(arr)) {
    const record = arr as Record<string, T>
    for (const key of Object.keys(record)) {
      if (it(record[key], key, arr)) {
        return record[key]
      }
    }
  }
}

/**
 * Performs an efficient array insert operation in the given array. If the index or the array is invalid, it just returns the given array.
 *
 * **Note:** Uses the same behavior as `Array.splice`.
 *
 * @param {Array<*>} arr The given array to insert into
 * @param {number} index The index of the array insert operation.
 * @param {*} value The value to insert in the array at the given `index`.
 * @returns {Array<*>} The given array.
 */
export function insert<T, A extends T[] | null | undefined>(arr: A, index: number, value: T): A {
  if (!arr || index < 0) return arr
  arr.splice(index, 0, value)
  return arr
}

/**
 * Creates a function that performs a partial deep comparison between a given object and `shape`, returning `true` if the given object has equivalent property values, else `false`.
 * @example
```js
let objects = [
  { a: 1, b: 2, c: 3 },
  { a: 4, b: 5, c: 6 }
]

filter(objects, matches({ a: 4, c: 6 }))
// [{ a: 4, b: 5, c: 6 }]
```
 * @param shape
 * @returns
 */
export function matches(shape: unknown): (obj: unknown) => boolean {
  if (shape === null || typeof shape !== 'object') {
    return () => false
  }
  return function (obj) {
    return matchDeep(shape, obj)
  }
}

function matchDeep(shape: unknown, obj: unknown): boolean {
  if (shape === null || typeof shape !== 'object') return eq(obj, shape)
  if (obj === null || typeof obj !== 'object') return false
  if (Array.isArray(shape)) {
    if (!Array.isArray(obj)) return false
    for (let i = 0; i < shape.length; i++) {
      if (!matchDeep(shape[i], obj[i])) return false
    }
    return true
  }
  if (isPlainObject(shape)) {
    for (const key of Object.keys(shape)) {
      if (!matchDeep(shape[key], (obj as Record<string, unknown>)[key])) {
        return false
      }
    }
    return true
  }
  return eq(obj, shape)
}

/**
 * Iterates over elements of collection and invokes `iteratee` for each element. The iteratee is invoked with three arguments: `(value, index|key, collection)`. Iteratee functions may exit iteration early by explicitly returning `false`.
 * @example
```js
forEach([1, 2], (value) => {
  console.log(value)
})
// 1
// 2

forEach({ 'a': 1, 'b': 2 }, (value, key) => {
  console.log(key)
})
// 'a'
// 'b'
```
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Iteratee} fn The function invoked per iteration.
 * @returns {*} Returns `collection`.
 * @see {@link forEachRight}
 * @see {@link filter}
 * @see {@link map}
 */
export function forEach<T>(
  collection: Iterable<T> | object | null | undefined,
  fn: Iteratee<T>
): void {
  if (collection == null) return
  if (Array.isArray(collection)) {
    for (const [i, value] of (collection as T[]).entries()) {
      const res = fn(value, i, collection)
      if (res === false) return
    }
  } else if (isIterable(collection)) {
    for (const [index, value] of enumerate(collection)) {
      const res = fn(value as T, index, collection)
      if (res === false) return
    }
  } else {
    const obj = collection as Record<PropertyKey, T>
    for (const key of keys(obj)) {
      const res = fn(obj[key], key, collection)
      if (res === false) return
    }
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
 * @param {Function} fn The function invoked per iteration.
 * @returns {*} The matched element, else `undefined`.
 * @see {@link find}
 */
export function findLast<T>(arr: Iterable<T> | object, fn: Iteratee<T> | object): T | undefined {
  let result: T | undefined
  const it: Iteratee<T> = typeof fn === 'function' ? (fn as Iteratee<T>) : matches(fn)
  forEachRight<T>(arr, (val, key) => {
    if (it(val, key, arr)) {
      result = val
      return false
    }
  })
  return result
}

/**
 * This method is like {@link forEach} except that it iterates over the collection from right to left.

 * @example
```js
forEachRight([1, 2], console.log)
// 2
// 1
```
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Iteratee} fn The function invoked per iteration.
 * @returns {*} Returns `collection`.
 * @see {@link forEach}
 * @see {@link filter}
 * @see {@link map}
 */
export function forEachRight<T>(
  collection: Iterable<T> | object | null | undefined,
  fn: Iteratee<T>
): void {
  if (collection == null) return
  if (Array.isArray(collection)) {
    const items = collection as T[]
    for (let i = items.length - 1; i >= 0; i--) {
      const res = fn(items[i], i, collection)
      if (res === false) return
    }
  } else if (isIterable(collection)) {
    const items = Array.from(collection as Iterable<T>)
    for (let i = items.length - 1; i >= 0; i--) {
      const res = fn(items[i], i, collection)
      if (res === false) return
    }
  } else if (isObject(collection)) {
    const obj = collection as Record<PropertyKey, T>
    const ks = Object.keys(obj)
    for (let i = ks.length - 1; i >= 0; i--) {
      const key = ks[i]
      const value = obj[key]
      const res = fn(value, key, collection)
      if (res === false) return
    }
  }
}

/**
 * Flattens an array or object. Arrays will be flattened recursively up to `depth` times. Objects will be flattened recursively.
 * @example
```js
flatten([1, [2, [3, [4]], 5]])
// [1, 2, [3, [4]], 5]

flatten({
  dates: {
    expiry_date: '30 sep 2018',
    available: '30 sep 2017',
    min_contract_period: [
      {
        id: 1,
        name: '1 month'
      }
    ]
  },
  price: {
    currency: 'RM',
    value: 1500
  }
})
// {
  'dates.expiry_date': '30 sep 2018',
  'dates.available': '30 sep 2017',
  'dates.min_contract_period[0].id': 1,
  'dates.min_contract_period[0].name': '1 month',
  'price.currency': 'RM',
  'price.value': 1500
}
```
 * @param {Array|Object} arr The array or object to flatten.
 * @param {number} [depth=1] The max recursion depth.
 * @returns {*} The new flattened array or object.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat Array.flat()}
 */
export function flatten<T>(arr: T[], depth?: boolean | number): T[]
export function flatten(arr: object, depth?: boolean | number): object
export function flatten<T>(arr: T[] | object, depth: boolean | number = 1): T[] | object {
  if (Array.isArray(arr)) {
    const items = arr as T[]
    const d = depth === true ? Infinity : Number(depth)
    if (!(d > 0)) return items.slice()
    return flattenArray(items, d)
  }
  if (isObject(arr)) return flattenObj(arr)
  return arr
}

function flattenArray<T>(arr: T[], depth: number): T[] {
  const result: T[] = []
  for (let i = 0; i < arr.length; i++) {
    if (!(i in arr)) {
      result.length++
      continue
    }
    const value = arr[i]
    if (depth > 0 && Array.isArray(value)) {
      const nested = flattenArray(value as T[], depth - 1)
      for (let j = 0; j < nested.length; j++) {
        if (j in nested) result.push(nested[j])
        else result.length++
      }
    } else {
      result.push(value)
    }
  }
  return result
}

function flattenObj(
  obj: unknown,
  prefix = '',
  result: Record<string, unknown> = {},
  seen = new WeakSet<object>()
): Record<string, unknown> {
  if (isString(obj) || isNumber(obj) || isBool(obj) || isNull(obj)) {
    if (prefix) result[prefix] = obj
    return result
  }

  if (typeof obj === 'object') {
    if (seen.has(obj)) throw new ValueError('cyclic structure')
    if (!isPlainObject(obj) && !Array.isArray(obj)) {
      if (prefix) result[prefix] = obj
      return result
    }
    seen.add(obj)
    for (const i of Object.keys(obj)) {
      let pref = prefix
      if (Array.isArray(obj)) {
        pref = `${pref}[${i}]`
      } else if (prefix) {
        pref = `${prefix}.${i}`
      } else {
        pref = i
      }
      flattenObj((obj as Record<string, unknown>)[i], pref, result, seen)
    }
    seen.delete(obj)
    return result
  }

  if (prefix) result[prefix] = obj
  return result
}

/**
 * Creates an array of values by running each element in collection thru iteratee. The iteratee is invoked with three arguments: `(value, index|key, collection)`.
 * @example
```js
function square(n) {
  return n * n
}

map([4, 8], square)
// [16, 64]

map({ a: 4, b: 8 }, square)
// [16, 64] (iteration order is not guaranteed)

let users = [
  { user: 'barney' },
  { user: 'fred' }
]

// The `property` iteratee shorthand.
map(users, 'user')
// ['barney', 'fred']
```
 * @param {Array|Object} arr The collection to iterate over.
 * @param {Iteratee} fn The function invoked per iteration.
 * @returns Returns the new mapped array.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map Array.map()}
 */
export function map<T, TResult>(
  arr: T[] | object,
  fn: Iteratee<T, PropertyKey, TResult> | PropertyKey
): TResult[] {
  const it: Iteratee<T, PropertyKey, TResult> =
    typeof fn === 'function' ? fn : (obj) => get<TResult>(fn, obj)
  if (Array.isArray(arr)) {
    return (arr as T[]).map((x, i) => it(x, i, arr))
  }
  if (isObject(arr)) {
    const obj = arr as Record<PropertyKey, T>
    return Object.keys(obj).map((key) => it(obj[key], key, arr))
  }
  return []
}

/**
 * This method is like {@link find} except that it returns the index of the first element `predicate` returns truthy for instead of the element itself.
 * @param {Array} obj The array to inspect.
 * @param {string|Object|Iteratee} fn The predicate function
 * @param {number} [start=0] The index to search from.
 * @returns {number} The index of the found value, else -1
 * @example
```js
let users = [
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
  obj: T[] | null | undefined,
  fn: Iteratee<T> | object | PropertyKey,
  start = 0
): number {
  if (!obj) return -1
  const length = obj.length
  if (length && start < 0) {
    start = Math.max(start + length, 0)
  }
  if (!length || start >= length) return -1
  const it = toIteratee<T>(fn)
  for (; start < length; start++) {
    if (it(obj[start], start, obj)) return start
  }
  return -1
}

/**
 * This method is like {@link findIndex} except that it searches for a given value directly, instead of using a predicate function.
 * @param {Array} obj The array to inspect.
 * @param {*} value The value to find
 * @param {number} [start=0] The index to search from.
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
export function indexOf<T>(obj: T[] | null | undefined, value: T, start = 0): number {
  if (!obj) return -1
  const length = obj.length
  if (length && start < 0) {
    start = Math.max(start + length, 0)
  }
  if (!length || start >= length) return -1
  for (; start < length; start++) {
    if (eq(value, obj[start])) return start
  }
  return -1
}

/**
 * This method is like {@link findIndex} except that it iterates the collection from right to left.
 * @param {Array} arr The array to inspect.
 * @param {string|Iteratee|Object} fn The function invoked per iteration.
 * @param {number} [start] The index to search from.
 * @returns {number} The index of the found value, else -1
 * @example
```js
let users = [
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
  arr: T[] | null | undefined,
  fn: Iteratee<T> | object | PropertyKey,
  start?: number
): number {
  if (arr == null) return -1
  const length = arr.length
  start ??= length - 1
  if (!length || start < 0) return -1
  const it = toIteratee<T>(fn)
  for (; start >= 0; start--) {
    if (it(arr[start], start, arr)) return start
  }
  return -1
}

/**
 * This method is like {@link indexOf} except that it iterates the collection from right to left.
 * @param {Array} obj The array to inspect.
 * @param {*} value The value to find
 * @param {number} [start] The index to search from.
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
export function lastIndexOf<T>(obj: T[] | null | undefined, value: T, start?: number): number {
  if (obj == null) return -1
  const length = obj.length
  start ??= length - 1
  if (!length || start < 0) return -1
  if (start >= length) start = length - 1
  for (; start >= 0; start--) {
    if (eq(value, obj[start])) return start
  }
  return -1
}

/**
 * Creates a duplicate-free version of an array, using SameValueZero equality on `iteratee` keys, keeping the first element for each key.
 * @param arr The array containing duplicated elements
 * @param fn The iteratee invoked per element.
 * @returns Returns the new duplicate free array.
 * @example
```js
uniq([2, 1, 2])
// [2, 1]

uniq([2.1, 1.2, 2.3], Math.floor)
// [2.1, 1.2]
```
 *
 * @see {@link sortedUniq}
 */
export function uniq<T>(arr: Iterable<T>, fn: Iteratee<T> | PropertyKey = identity): T[] {
  const seen = new Set<unknown>()
  const result: T[] = []
  const it: Iteratee<T> = typeof fn === 'function' ? fn : (x) => get(fn, x)
  for (const x of arr) {
    const key = it(x)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(x)
  }
  return result
}

/**
 * This method is like {@link uniq} except that it sorts the results in ascending order
 * @param arr The array containing duplicated elements
 * @param fn The iteratee invoked per element.
 * @returns Returns the new duplicate free array
 * @example
```js
uniq([2, 1, 2])
// [1, 2]
```
 * @see {@link uniq}
 */
export function sortedUniq<T>(arr: Iterable<T>, fn: Iteratee<T> | PropertyKey = identity): T[] {
  const values = uniq(arr, fn)
  values.sort(compare)
  return values
}

/**
 * Assigns own and inherited enumerable string keyed properties of source objects to the destination object for all destination properties that resolve to `undefined`. Source objects are applied from left to right. Once a property is set, additional values of the same property are ignored.
 * **Note:** This method mutates `object`.

 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @returns Returns `object`.
 * @example
```js
defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 })
// { 'a': 1, 'b': 2 }
```
 */
export function defaults<T extends object>(object: T, ...sources: object[]): T {
  const target = object as Record<string, unknown>
  for (const source of sources) {
    for (const key of Object.keys(source)) {
      if (target[key] === undefined) {
        target[key] = (source as Record<string, unknown>)[key]
      }
    }
  }
  return object
}

/**
 * Yield elements of `first` not present in any of `rest` (SameValueZero), in first-occurrence order.
 * @param first Source iterable.
 * @param rest Exclusion iterables.
 * @see {@link union}
 * @see {@link intersection}
 */
export function difference<T>(first: Iterable<T>, ...rest: Iterable<T>[]): IteratorObject<T> {
  let result = new Set(first)
  for (const r of rest) {
    result = result.difference(new Set(r))
  }
  return result.values()
}

/**
 * Yield elements present in exactly one of `a` or `b` (SameValueZero).
 * @param a First iterable.
 * @param b Second iterable.
 */
export function symmetricDifference<T>(a: Iterable<T>, b: Iterable<T>): IteratorObject<T> {
  return new Set(a).symmetricDifference(new Set(b)).values()
}

/**
 * Yield elements present in every input iterable (SameValueZero), in first-seen order of the first.
 * @param its Input iterables (at least one).
 * @see {@link difference}
 * @see {@link union}
 */
export function intersection<T>(...its: Iterable<T>[]): IteratorObject<T> {
  if (its.length === 0) return new Set<T>().values()
  let result = new Set(its[0])
  for (let i = 1; i < its.length; i++) {
    result = result.intersection(new Set(its[i]))
  }
  return result.values()
}

/**
 * Yield all distinct elements from the inputs in first-seen order (SameValueZero).
 * @param its Input iterables.
 * @see {@link difference}
 * @see {@link intersection}
 */
export function union<T>(...its: Iterable<T>[]): IteratorObject<T> {
  let result = new Set<T>()
  for (const it of its) {
    result = result.union(new Set(it))
  }
  return result.values()
}

/**
 * Creates an object composed of keys generated from the results of running each element of `arr` thru `func`. The order of grouped values is determined by the order they occur in `arr`. The corresponding value of each key is an array of elements responsible for generating the key.
 *
 * @param arr The collection to iterate over.
 * @param [func=identity] The iteratee to transform keys.
 * @returns Returns the aggregated object.
 *
 * @example
```js
groupBy([6.1, 4.2, 6.3], Math.floor)
// { '4': [4.2], '6': [6.1, 6.3] }

// The `property` iteratee shorthand.
groupBy(['one', 'two', 'three'], 'length')
// { '3': ['one', 'two'], '5': ['three'] }
```
 */
export function groupBy<T, K extends PropertyKey>(
  coll: Iterable<T> | Record<string, T>,
  fn: ((v: T) => K) | string
): Partial<Record<K, T[]>> {
  const values = toValues(coll)
  const keyFn = typeof fn === 'function' ? fn : (v: T) => get<K>(fn, v)
  return Object.groupBy<K, T>(values, (v) => keyFn(v))
}

/**
 * Similar to {@link groupBy} but it returns a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map Map} object with the results.
 *
 * @param arr The collection to iterate over.
 * @param {Function | PropertyKey} [func=identity] The iteratee to transform keys.
 * @returns {Map} Returns the aggregated map object.
 * @template K, V
 *
 * @example
```js
groupByMap([6.1, 4.2, 6.3], Math.floor)
// Map { 4: [4.2], 6: [6.1, 6.3] }

// The `property` iteratee shorthand.
groupByMap(['one', 'two', 'three'], 'length')
// Map { 3: ['one', 'two'], 5: ['three'] }
```
 */
export function groupByMap<T, K>(
  coll: Iterable<T> | Record<string, T>,
  fn: ((v: T) => K) | string
): Map<K, T[]> {
  const values = toValues(coll)
  const keyFn = typeof fn === 'function' ? fn : (v: T) => get<K>(fn, v)
  return Map.groupBy(values, (v) => keyFn(v))
}

function toValues<T>(coll: Iterable<T> | Record<string, T> | null | undefined): T[] {
  if (coll == null) return []
  if (isPlainObject(coll)) return Object.values(coll)
  if (isIterable(coll)) return Array.from(coll)
  return Object.values(coll)
}

/**
 * Remove every element for which `predicate` is truthy from `arr` in place; return the removed elements in original order.
 * @param arr Array to mutate.
 * @param predicate Function, plain-object shape, or property path.
 */
export function remove<T>(arr: T[], predicate: Predicate<T>): T[] {
  if (!Array.isArray(arr)) throw new TypeError('remove expects an array')
  const pred = resolvePredicate(predicate)
  const removed: T[] = []
  let write = 0
  for (let read = 0; read < arr.length; read++) {
    if (pred(arr[read], read, arr)) {
      removed.push(arr[read])
    } else {
      arr[write++] = arr[read]
    }
  }
  arr.length = write
  return removed
}

/**
 * Return a new array of elements for which `predicate` is falsy; does not mutate.
 * @param collection Iterable or plain object.
 * @param predicate Function, plain-object shape, or property path.
 */
export function reject<T>(
  collection: Iterable<T> | Record<string, T>,
  predicate: Predicate<T>
): T[] {
  const pred = resolvePredicate(predicate)
  const result: T[] = []
  let index = 0
  forEach(collection as Iterable<T> | object, (value: T) => {
    if (!pred(value, index, collection)) result.push(value)
    index++
  })
  return result
}

/**
 * Return a new array excluding every element SameValueZero-equal to one of `values`.
 * @param array Source array (not mutated).
 * @param values Values to exclude.
 */
export function without<T>(array: readonly T[], ...values: T[]): T[] {
  const exclude = new Set(values)
  return array.filter((x) => !exclude.has(x))
}
