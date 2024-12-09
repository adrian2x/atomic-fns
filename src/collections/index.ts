/**
 * This module includes classes and functions to work with Container types.
 *
 * @module collections
 */

import {
  call,
  get,
  isArray,
  isArrayLike,
  isBool,
  isEmpty,
  isFunction,
  isIterable,
  isNull,
  isNumber,
  isObject,
  isString,
  keys,
  set
} from '../globals/index.js'
import { enumerate } from '../itertools/index.js'
import { compare, eq, id } from '../operators/index.js'
import { Iteratee } from '../types'

export * from './abc.js'
export * from './BTree.js'
export * from './deque.js'
export * from './frozenset.js'
export * from './Heap.js'
export * from './LRUCache.js'
export * from './SortedMap.js'
export * from './SortedSet.js'
export * from './SortedTree.js'
export * from './SplayTree.js'
export * from './Trie.js'

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
  if (!arr) return
  if (Array.isArray(arr)) return arr.filter((x) => !isEmpty(x))
  const result = {}
  for (const key of Object.keys(arr)) {
    if (!isEmpty(arr[key])) {
      result[key] = arr[key]
    }
  }
  return result
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
export function count<T>(obj: T[], fn: Iteratee<T>): Record<string, number>
export function count<T>(obj: Object, fn: Iteratee<T>): Record<string, number>
export function count<T>(obj: T[] | Object, func: Iteratee<T>): Record<string, number> {
  const counters = {}
  forEach(obj, (value, key) => {
    const result = func(value as T, key)
    counters[result] = get(result, counters, 0) + 1
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
export function filter<T>(arr: T[], fn?: Iteratee<T>): T[]
export function filter<T>(arr: T[], fn?: Object): T[]
export function filter<T>(arr: Object, fn?: Iteratee<T>): T[]
export function filter<T>(arr: Object, fn?: Object): T[]
export function filter<T>(arr: T[] | Object, fn: Iteratee<T> | Object = isNull): T[] {
  if (!arr) return
  const predicate = isFunction(fn) ? fn : isObject(fn) ? matches(fn) : (obj) => get(fn, obj)
  const results: T[] = []
  forEach(arr, (value: T, key) => {
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

find(users, (o) => o.age < 40)
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
export function find<T>(arr: T[], fn: Iteratee<T>): T | undefined
export function find<T>(arr: T[], fn: Object): T | undefined
export function find<T>(arr: T[], fn: PropertyKey): T | undefined
export function find<T>(arr: Object, fn: Iteratee<T>): T | undefined
export function find<T>(arr: Object, fn: Object): T | undefined
export function find<T>(arr: Object, fn: PropertyKey): T | undefined
export function find<T>(arr: T[] | Object, fn: Iteratee<T> | Object | PropertyKey): T | undefined {
  const it = isFunction(fn) ? fn : isObject(fn) ? matches(fn) : (obj) => get(fn, obj)
  if (Array.isArray(arr)) {
    return arr.find(it)
  } else if (isObject(arr)) {
    for (const key of Object.keys(arr)) {
      if (it(arr[key], key, arr)) {
        return arr[key]
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
export function insert<T>(arr: T[], index: number, value: T): T[] {
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
export function matches(shape) {
  return function (obj) {
    if (!shape || !obj) return false
    for (const key in shape) {
      if (obj[key] !== shape[key]) return false
    }
    return true
  }
}

/**
 * Iterates over elements of collection and invokes `iteratee` for each element. The iteratee is invoked with three arguments: `(value, index|key, collection)`. Iteratee functions may exit iteration early by explicitly returning `false`.
 * @example
```js
forEach([1, 2], (value) => {
  console.log(value)
})
// Logs `1` then `2`.

forEach({ 'a': 1, 'b': 2 }, (value, key) => {
  console.log(key)
})
// Logs 'a' then 'b' (iteration order is not guaranteed).
```
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Iteratee} fn The function invoked per iteration.
 * @returns {*} Returns `collection`.
 * @see {@link forEachRight}
 * @see {@link filter}
 * @see {@link map}
 */
export function forEach<T>(collection: Iterable<T>, fn: Iteratee<T>): void
export function forEach<T>(collection: Object, fn: Iteratee<T>): void
export function forEach<T>(collection: Iterable<T> | Object, fn: Iteratee<T>): void {
  if (Array.isArray(collection)) {
    for (let i = 0; i < collection.length; i++) {
      const res = fn(collection[i], i, collection)
      if (res === false) return
    }
  } else if (isIterable(collection)) {
    for (const [index, value] of enumerate(collection)) {
      const res = fn(value as T, index, collection)
      if (res === false) return
    }
  } else {
    for (const key of keys(collection)) {
      const res = fn(collection[key], key, collection)
      if (res === false) return
    }
  }
}

/**
 * This method is like {@link find} except that it iterates from right to left.
 * @example
```js
findLast([1, 2, 3, 4], (n) => n % 2 === 1)
//  => 3
```
 * @param {Array} arr The collection to iterate over.
 * @param {Function} fn The function invoked per iteration.
 * @returns {*} The matched element, else `undefined`.
 * @see {@link find}
 */
export function findLast<T>(arr: Iterable<T>, fn: Iteratee<T>): T | undefined
export function findLast<T>(arr: Iterable<T>, fn: Object): T | undefined
export function findLast<T>(arr: Object, fn: Iteratee<T>): T | undefined
export function findLast<T>(arr: Object, fn: Object): T | undefined
export function findLast<T>(arr: Iterable<T> | Object, fn: Iteratee<T> | Object): T | undefined {
  let result
  const it = isFunction(fn) ? fn : matches(fn)
  forEachRight(arr, (val, key) => {
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
forEachRight([1, 2], (value) => {
  console.log(value)
})
// Logs `2` then `1`.
```
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Iteratee} fn The function invoked per iteration.
 * @returns {*} Returns `collection`.
 * @see {@link forEach}
 * @see {@link filter}
 * @see {@link map}
 */
export function forEachRight<T>(collection: T[], fn: Iteratee<T>): void
export function forEachRight<T>(collection: Object, fn: Iteratee<T>): void
export function forEachRight<T>(collection: T[] | Object, fn: Iteratee<T>): void {
  if (Array.isArray(collection)) {
    for (let i = collection.length - 1; i >= 0; i--) {
      const value = collection[i]
      const res = fn(value, i, collection)
      if (res === false) return
    }
  } else if (isObject(collection)) {
    const keys = Object.keys(collection)
    for (let i = keys.length - 1; i >= 0; i--) {
      const key = keys[i]
      const value = collection[key]
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
export function flatten<T>(arr: Object, depth?: boolean | number): Object
export function flatten<T>(arr: T[] | Object, depth = 1): T[] | Object {
  if (!depth) return arr
  if (Array.isArray(arr)) return flattenArray(arr, depth, []) as T[]
  if (isObject(arr)) return flattenObj(arr)
  return arr
}

function flattenArray(arr: any[], depth: boolean | number = 1, result: any[] = []) {
  for (const value of arr) {
    if (depth && Array.isArray(value)) {
      flattenArray(value, typeof depth === 'number' ? depth - 1 : depth, result)
    } else {
      result.push(value)
    }
  }
  return result
}

function flattenObj(obj, prefix = '', result = {}, keepNull = false) {
  if (isString(obj) || isNumber(obj) || isBool(obj) || (keepNull && isNull(obj))) {
    result[prefix] = obj
    return result
  }

  if (isArray(obj) || isObject(obj)) {
    for (const i of Object.keys(obj)) {
      let pref = prefix
      if (isArray(obj)) {
        pref = `${pref}[${i}]`
      } else {
        if (prefix) {
          pref = `${prefix}.${i}`
        } else {
          pref = i
        }
      }
      flattenObj(obj[i], pref, result, keepNull)
    }
    return result
  }

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
export function map<T, TResult>(arr: T[], fn: Iteratee<T, PropertyKey, TResult>): TResult[]
export function map<T, TResult>(arr: T[], fn: PropertyKey): TResult[]
export function map<T, TResult>(arr: Object, fn: Iteratee<T, PropertyKey, TResult>): TResult[]
export function map<T, TResult>(arr: Object, fn: PropertyKey): TResult[]
export function map<T, TResult>(
  arr: T[] | Object,
  fn: Iteratee<T, PropertyKey, TResult> | PropertyKey
): TResult[] {
  const it = isFunction(fn) ? fn : (obj) => get(fn, obj)
  if (Array.isArray(arr)) {
    return arr.map((x, i) => it(x, i, arr))
  }
  if (isObject(arr)) {
    return Object.keys(arr).map((key) => it(arr[key], key, arr))
  }
}

/**
 * Creates an object composed of the picked object properties.
 * @param {Object} obj The source object.
 * @param {Iteratee|PropertyKey[]} paths The properties to pick. If `paths` is a function, it will be invoked per property with two values `(value, key)`.
 * @returns A new object with the properties.
 * @example
```js
let object = { a: 1, b: '2', c: 3 }

pick(object, ['a', 'c'])
// { a: 1, c: 3 }

pick(object, (x) => isNumber(x))
// { a: 1, c: 3 }
```
 *
 * @see {@link omit}
 */
export function pick<T>(obj: T, paths: Iteratee): Partial<T>
export function pick<T>(obj: T, paths: PropertyKey[]): Partial<T>
export function pick<T>(obj: T, paths: Iteratee | PropertyKey[]): Partial<T> {
  if (!obj) return {}

  const result: Partial<T> = {}

  if (isFunction(paths)) {
    for (const key of Object.keys(obj)) {
      if (paths(obj[key], key)) {
        result[key] = obj[key]
      }
    }
    return result
  }

  for (const key of paths) {
    result[key] = get(key, obj)
  }
  return result
}

/**
 * The opposite of {@link pick} - this method creates an object composed of the own and inherited enumerable property paths of `object` that are not omitted.
 * @example
```js
let object = { 'a': 1, 'b': '2', 'c': 3 }

omit(object, ['a', 'c'])
// { 'b': '2' }

omit(object, (x) => isNumber(x))
// { 'b': '2' }
```
 * @param {Object} obj The source object.
 * @param {Iteratee|PropertyKey[]} paths The property paths to omit.
 * @returns {Object} Returns the new object.
 * @see {@link pick}
 */
export function omit<T>(obj: T, paths: Iteratee): Partial<T>
export function omit<T>(obj: T, paths: PropertyKey[]): Partial<T>
export function omit<T>(obj: T, paths: Iteratee | PropertyKey[]): Partial<T> {
  if (!obj) return {}

  const result: Partial<T> = {}

  if (isFunction(paths)) {
    for (const key of Object.keys(obj)) {
      if (!paths(obj[key], key)) {
        result[key] = obj[key]
      }
    }
    return result
  }

  Object.assign(result, obj)
  for (const key of paths) {
    delete result[key]
  }
  return result
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

findIndex(users, (o) => o.user == 'barney')
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
export function findIndex<T>(obj: T[], fn: Iteratee<T>, start?: number): number
export function findIndex<T>(obj: T[], fn: Object, start?: number): number
export function findIndex<T>(obj: T[], fn: PropertyKey, start?: number): number
export function findIndex<T>(obj: T[], fn: Iteratee<T> | Object | PropertyKey, start = 0): number {
  if (!obj) return -1
  const length = obj.length
  if (length && start < 0) {
    start = Math.max(start + length, 0)
  }
  if (!length || start >= length) return -1
  const it = isFunction(fn) ? fn : isObject(fn) ? matches(fn) : (obj) => get(fn, obj)
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
export function indexOf<T>(obj: T[], value: T, start = 0): number {
  if (!obj) return -1
  const op = call(obj, 'indexOf', value, start)
  if (op != null) return op
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

findLastIndex(users, (o) => o.user == 'pebbles')
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
export function findLastIndex<T>(arr: T[], fn: Iteratee<T>, start?: number): number
export function findLastIndex<T>(arr: T[], fn: Object, start?: number): number
export function findLastIndex<T>(arr: T[], fn: PropertyKey, start?: number): number
export function findLastIndex<T>(
  arr: T[],
  fn: Iteratee<T> | Object | PropertyKey,
  start?: number
): number {
  if (arr == null) return -1
  const length = arr.length
  if (start == null) start = length - 1
  if (!length || start < 0) return -1
  const it = isFunction(fn) ? fn : isObject(fn) ? matches(fn) : (obj) => get(fn, obj)
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
export function lastIndexOf<T>(obj: T[], value: T, start?: number): number {
  if (obj == null) return -1
  const op = call(obj, 'lastIndexOf', value, start)
  if (op != null) return op
  const length = obj.length
  if (start == null) start = length - 1
  if (!length || start < 0) return -1
  for (; start >= 0; start--) {
    if (eq(value, obj[start])) return start
  }
  return -1
}

/**
 * Creates a shallow clone of `value`. If `deep` is `true` it will clone it recursively.
 * @param {*} value
 * @param {boolean} [deep=false]
 * @return The clone value
 * @see {@link cloneArray}
 * @see {@link cloneTypedArray}
 */
export function clone<T>(value: T, deep?: boolean): T
export function clone<T>(value: T[], deep?: boolean): T[]
export function clone(value, deep = false) {
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    return cloneTypedArray(value, deep)
  }
  if (isArray(value) || isArrayLike(value)) {
    return cloneArray(value, deep)
  }
  if (isObject(value)) {
    if (isFunction(value.clone)) {
      return value.clone()
    }
    const copy = {}
    for (const key in value) {
      if (deep) {
        copy[key] = clone(value[key], deep)
      } else {
        copy[key] = value[key]
      }
    }
    return copy
  }
  return value
}

/**
 * Clones an array. If `deep` is `false` (default) the clone will be shallow. Otherwise {@link https://developer.mozilla.org/en-US/docs/Web/API/structuredClone structuredClone} is used.
 * @param arr The array to clone
 * @param [deep=false] Creates a deep clone using `structuredClone` if true.
 * @returns The new array
 * @see {@link clone}
 */
export function cloneArray<T>(arr: T[], deep = false): T[] {
  if (!deep) return Array.from(arr)
  return structuredClone(arr)
}

/**
 * Clones a typed array. If `deep` is `false` (default) the clone will be shallow. Otherwise {@link https://developer.mozilla.org/en-US/docs/Web/API/structuredClone structuredClone} is used.
 * @param arr The array to clone
 * @param [deep=false] Creates a deep clone using `structuredClone` if true.
 * @returns The new array
 * @see {@link clone}
 */
export function cloneTypedArray(typedArray, isDeep = false) {
  const buffer = isDeep ? structuredClone(typedArray) : typedArray.buffer
  return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length)
}

/**
 * Creates a duplicate-free version of an array, using a `Set` for equality comparisons, in which only the first occurrence of each element is kept. The order of result values is not guaranteed.
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
export function uniq<T>(arr: Iterable<T>, fn?: Iteratee<T>): T[]
export function uniq<T>(arr: Iterable<T>, fn?: PropertyKey): T[]
export function uniq<T>(arr: Iterable<T>, fn: Iteratee<T> | PropertyKey = id): T[] {
  const keys = new Set<T>()
  const it = isFunction(fn) ? fn : (x) => get(fn, x)
  for (const x of arr) {
    keys.add(it(x))
  }
  return Array.from(keys.values())
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
export function sortedUniq<T>(arr: Iterable<T>, fn?: Iteratee<T>): T[]
export function sortedUniq<T>(arr: Iterable<T>, fn?: PropertyKey): T[]
export function sortedUniq<T>(arr: Iterable<T>, fn: Iteratee<T> | PropertyKey = id): T[] {
  const values = uniq(arr, fn as Iteratee<T>)
  values.sort(compare)
  return values
}

function baseMergeDeep(obj, source, key, stack) {
  const objValue = obj[key]
  const srcValue = source[key]
  const stacked = stack.get(srcValue)
  if (stacked && (objValue !== stacked || !(key in obj))) {
    obj[key] = stacked
    return
  }

  let newValue: any
  let isCommon = newValue === undefined
  const isArray = Array.isArray(srcValue)
  const isTyped = ArrayBuffer.isView(srcValue)

  if (isArray || isTyped) {
    if (Array.isArray(objValue)) {
      newValue = objValue
    } else if (isArrayLike(objValue)) {
      newValue = Array.from(objValue)
    } else if (isTyped) {
      isCommon = false
      newValue = cloneTypedArray(srcValue, true)
    } else {
      newValue = []
    }
  } else if (isObject(srcValue)) {
    newValue = objValue
    if (!isObject(objValue)) {
      newValue = srcValue
    }
  } else {
    isCommon = false
  }
  if (isCommon) {
    stack.set(srcValue, newValue)
    baseMerge(newValue, srcValue, stack)
    stack.delete(srcValue)
  }
  obj[key] = newValue
}

function baseMerge(obj, source, stack?) {
  if (obj === source) return obj
  for (const key of Object.keys(source)) {
    const srcValue = source[key]
    const objValue = obj[key]
    if (typeof srcValue === 'object' && srcValue !== null) {
      baseMergeDeep(obj, source, key, stack || new WeakMap())
    } else {
      if (objValue !== srcValue) {
        obj[key] = srcValue
      }
    }
  }
}

/**
 * Recursively merges own and inherited enumerable string keyed properties of source objects into the destination object. Source properties that resolve to `undefined` are skipped if a destination value exists. Array and plain object properties are merged recursively. Other objects and value types are overridden by assignment. Source objects are applied from left to right. Subsequent sources overwrite property assignments of previous sources.
 *
 * Note: this method mutates `object`
 *
 *
 * @param {Object} object The destination object.
 * @param {...Object} sources The source objects.
 * @returns Returns `object`.
 *
 * @example
```js
let object = {
  'a': [{ 'b': 2 }, { 'd': 4 }]
}

let other = {
  'a': [{ 'c': 3 }, { 'e': 5 }]
}

merge(object, other)
// { 'a': [{ 'b': 2, 'c': 3 }, { 'd': 4, 'e': 5 }] }
```
 */
export function merge(object: Object, ...sources: Object[]): Object {
  for (const source of sources) {
    baseMerge(object, source)
  }
  return object
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
export function defaults(object: Object, ...sources: Object[]) {
  for (const source of sources) {
    for (const key in source) {
      if (object[key] === undefined) {
        object[key] = source[key]
      }
    }
  }
  return object
}

/**
 * Returns a generator of array values not included in the other given arrays using a `Set` for equality comparisons. The order and references of result values are not guaranteed.
 * @param args The initial arrays
 * @example
```js
[...difference([2, 1], [2, 3])]
// [1]
```
 * @see {@link union}
 * @see {@link intersection}
 */
export function* difference<T>(...args: Array<Iterable<T>>) {
  const sets = args.map((arr) => new Set(arr))
  const setA = sets[0]

  for (let i = 1; i < sets.length; i++) {
    for (const x of sets[i].values()) {
      if (!setA.delete(x)) setA.add(x)
    }
  }

  for (const x of setA.values()) {
    yield x
  }
}

/**
 * Creates a generator of unique values that are included in all given arrays.
 * @param args The arrays to inspect
 * @example
```js
[...intersection([2, 1], [2, 3])]
// [2]
```
* @see {@link difference}
 * @see {@link union}
 */
export function* intersection<T>(...args: Array<Iterable<T>>) {
  const sets = args.map((arr) => new Set(arr))
  // build a counter map to find items in all
  const results = new Map<T, number>()
  const total = sets.length

  for (let i = 0; i < total; i++) {
    for (const x of sets[i].values()) {
      const count = results.get(x) || 0
      results.set(x, count + 1)
    }
  }

  for (const [key, value] of results.entries()) {
    if (value === total) yield key
  }
}

/**
 * Creates a generator of unique values from all given arrays using `Set` for equality comparisons.
 * @param args The arrays to perform union on.
 * @example
```js
[...union([2], [1, 2])]
// [2, 1]
```
 * @see {@link difference}
 * @see {@link intersection}
 */
export function* union<T>(...args: Array<Iterable<T>>) {
  const results = new Set<T>()
  for (const arr of args) {
    for (const item of arr) {
      results.add(item)
    }
  }
  for (const item of results.values()) {
    yield item
  }
}

/**
 * Creates an object composed of keys generated from the results of running each element of `arr` thru `func`. The order of grouped values is determined by the order they occur in `arr`. The corresponding value of each key is an array of elements responsible for generating the key.
 *
 * @param arr The collection to iterate over.
 * @param [func=id] The iteratee to transform keys.
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
export function groupBy<T>(arr: Iterable<T>, fn: Iteratee<T>): Record<PropertyKey, T[]>
export function groupBy<T>(arr: Iterable<T>, fn: PropertyKey): Record<PropertyKey, T[]>
export function groupBy<T>(arr: Object, fn: Iteratee<T>): Record<PropertyKey, T[]>
export function groupBy<T>(arr: Object, fn: PropertyKey): Record<PropertyKey, T[]>
export function groupBy<T>(
  arr: Iterable<T> | Object,
  func: Iteratee<T> | PropertyKey = id
): Record<PropertyKey, T[]> {
  const useKey = isFunction(func) ? func : (obj) => get(func, obj)
  const results: Record<PropertyKey, T[]> = {}
  forEach(arr, (value: T) => {
    const groupKey = useKey(value)
    const values = results[groupKey] || []
    values.push(value)
    results[groupKey] = values
  })
  return results
}

/**
 * Similar to {@link groupBy} but it returns a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map Map} object with the results.
 *
 * @param arr The collection to iterate over.
 * @param {Function | PropertyKey} [func=id] The iteratee to transform keys.
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
export function groupByMap<V>(arr: Iterable<V>, fn: Iteratee<V>): Map<any, V[]>
export function groupByMap<V>(arr: Iterable<V>, fn: PropertyKey): Map<any, V[]>
export function groupByMap<V>(arr: Object, fn: Iteratee<V>): Map<any, V[]>
export function groupByMap<V>(arr: Object, fn: PropertyKey): Map<any, V[]>
export function groupByMap<V = any>(
  arr: Iterable<V> | Object,
  func: Iteratee | PropertyKey = id
): Map<any, V[]> {
  const results = new Map<any, V[]>()
  const useKey = isFunction(func) ? func : (obj) => get(func, obj)
  forEach(arr, (value: V) => {
    const groupKey = useKey(value)
    const values = results.get(groupKey) || []
    values.push(value)
    results.set(groupKey, values)
  })
  return results
}

/**
 * Removes all elements from array that `func` returns truthy for and returns an array of the removed elements.
 * @param arr The array to remove from.
 * @param func The function invoked per iteration or value(s) or value to remove.
 * @returns
 */
export function remove<T>(arr: T[], func: T): T[]
export function remove<T>(arr: T[], func: T[]): T[]
export function remove<T>(arr: T[], func: Iteratee<T>): T[]
export function remove<T>(arr: T[], func: T | T[] | Iteratee<T>): T[] {
  const it = isFunction(func) ? func : isArray(func) ? (x) => func.includes(x) : (x) => func === x
  return arr.filter((x, i) => !it(x, i, arr))
}

/**
 * Returns the index of `x` in a **sorted** array if found, in `O(log n)` using binary search.
 * If the element is not found, returns a negative integer.
 * @param arr The array to sort
 * @param x The element to find
 * @param lo The starting index
 * @param hi The end index to search within
 * @param comp The compare function to check for `x`
 * @returns {number} The index if the element is found or a negative integer.
 */
export function binarySearch(arr: any[], x: any, lo = 0, hi?, comp = compare): number {
  hi = hi ?? arr.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    const check = comp(x, arr[mid])
    if (check === 0) return mid
    if (check > 0) lo = mid + 1
    else hi = mid - 1
  }
  if (comp(x, arr[lo]) === 0) return lo
  // Returns (-lo - 1) where n is the insertion point for new element in the range
  return -lo - 1
}

/**
 * Returns an insertion index which comes after any existing entries of `x` in a **sorted** array, using binary search.
 * @param arr The array to sort
 * @param x The element to find
 * @param lo The starting index
 * @param hi The end index to search within
 * @param comp The compare function to check for `x`
 * @returns {number}
 */
export function bisect(arr: any[], x: any, lo = 0, hi?, comp = compare): number {
  hi = hi ?? arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    const check = comp(x, arr[mid])
    if (check >= 0) lo = mid + 1
    else hi = mid - 1
  }
  return lo
}

/**
 * Returns an insertion index which comes before any existing entries of `x` in a **sorted** array, using binary search.
 * @param arr The array to sort
 * @param x The element to find
 * @param lo The starting index
 * @param hi The end index to search within
 * @param comp The compare function to check for `x`
 * @returns {number}
 */
export function bisectLeft(arr: any[], x: any, lo = 0, hi?, comp = compare): number {
  hi = hi ?? arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    const check = comp(x, arr[mid])
    if (check <= 0) hi = mid - 1
    else lo = mid + 1
  }
  return lo
}

/**
 * Runs {@link bisect} first to locate an insertion point, and inserts the value `x` in the sorted array after any existing entries of `x` to maintain sort order.
 * Please note this method is `O(n)` because insertion resizes the array.
 * @param arr The array to insert into
 * @param x The element to insert
 * @param lo The starting index
 * @param hi The end index to search within
 * @param comp The compare function to check for `x`
 * @returns {Array}
 */
export function insort<T>(arr: T[], x: any, lo = 0, hi?, comp = compare): T[] {
  const index = bisect(arr, x, lo, hi, comp)
  return insert(arr, index, x)
}

/**
 * Runs {@link bisectLeft} first to locate an insertion point, and inserts the value `x` in the sorted array before any existing entries of `x` to maintain sort order.
 * Please note this method is `O(n)` because insertion resizes the array.
 * @param arr The array to insert into
 * @param x The element to insert
 * @param lo The starting index
 * @param hi The end index to search within
 * @param comp The compare function to check for `x`
 * @returns {Array}
 */
export function insortLeft<T>(arr: T[], x: any, lo = 0, hi?, comp = compare): T[] {
  const index = bisectLeft(arr, x, lo, hi, comp)
  return insert(arr, index, x)
}
