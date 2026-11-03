/**
 * Collection classes and helpers (arrays, objects, sets, maps, trees).
 *
 * @module collections
 */

import { get, isIterable, isObject, keys, ValueError } from '../globals/index.js'
import {
  assertNotHugeSparse,
  arrayOwnIndices,
  isCanonicalArrayIndex,
  isHugeSparse,
  walkArray,
  type ArrayWalkEvent
} from '../internal/arrayKeys.js'
import { isCompactEmpty } from '../internal/compactEmpty.js'
import { arrayElements, arrayFromIterable, setFromIterable } from '../internal/iterable.js'
import {
  assertNestingDepth,
  enterNesting,
  exitNesting,
  guardFlattenSharedRevisits,
  guardNesting,
  noteExpanded
} from '../internal/nesting.js'
import { truncateForError } from '../internal/truncate.js'
import { enumerate } from '../itertools/index.js'
import { compare, deepEqual, eq, identity } from '../operators/index.js'
import type { Iteratee } from '../types.js'
import { defineData, isPlainObject } from './object.js'

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
export { defineData, isPlainObject, merge, pick, omit, clone } from './object.js'
export { bisect, bisectLeft, binarySearch, insort, insortLeft } from './bisect.js'

function toIteratee<T>(fn: Iteratee<T> | object | PropertyKey): Iteratee<T> {
  if (typeof fn === 'function') return fn as Iteratee<T>
  if (isObject(fn)) return matches(fn)
  return (obj) => get(fn as PropertyKey, obj)
}

/**
 * Creates a new array with all falsy and empty values removed (SPEC-R40).
 * Shares `isCompactEmpty` with `icompact`; does not change `isEmpty`.
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
  if (!arr) return {}
  if (Array.isArray(arr)) {
    const out: T[] = []
    walkArray(arr, (ev) => {
      if (ev.kind === 'holeRun') return
      if (!isCompactEmpty(ev.value)) out.push(ev.value as T)
    })
    return out
  }
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(arr)) {
    const v = (arr as Record<string, unknown>)[key]
    if (!isCompactEmpty(v)) {
      defineData(result, key, v)
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
count([6.1, 4.2, 6.3], Math.floor)
// { '4': 1, '6': 2 }

count(['one', 'two', 'three'], x => x.length)
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
  if (Array.isArray(arr)) {
    // Native filter skips holes; only own elements are candidates.
    walkArray(arr, (ev) => {
      if (ev.kind !== 'value') return
      if (predicate(ev.value as T, ev.index, arr)) results.push(ev.value as T)
    })
    return results
  }
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
 * @param {Function} fn The function invoked per iteration.
 * @returns {*} The matched element, else `undefined`.
 * @see {@link findLast}
 */
export function find<T>(arr: T[] | object, fn: Iteratee<T> | object | PropertyKey): T | undefined {
  const it = toIteratee<T>(fn)
  if (Array.isArray(arr)) {
    const state: { hit: boolean; result: T | undefined } = { hit: false, result: undefined }
    walkArray(arr, (ev) => {
      if (ev.kind === 'value') {
        if (it(ev.value as T, ev.index, arr)) {
          state.result = ev.value as T
          state.hit = true
          return false
        }
        return
      }
      if (it(undefined as T, ev.start, arr)) {
        state.result = undefined
        state.hit = true
        return false
      }
    })
    if (state.hit) return state.result
    return undefined
  }
  if (isIterable(arr)) {
    let i = 0
    for (const value of arr as Iterable<T>) {
      if (it(value, i, arr)) return value
      i++
    }
    return undefined
  }
  if (isObject(arr)) {
    const record = arr as Record<string, T>
    for (const key of Object.keys(record)) {
      if (it(record[key], key, arr)) {
        return record[key]
      }
    }
  }
}

/**
 * Inserts `value` at `index` via `Array.splice`. Returns `arr` unchanged when `arr` is nullish or `index < 0`.
 * An index past the end appends; a non-integer index follows `splice` coercion (for example `NaN` inserts at 0).
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
 * Creates a function that performs a Lodash-style partial deep comparison (`isMatch`) between a
 * given value and `shape`. A top-level empty plain object or empty array matches any value; a
 * nested empty `{}` matches only a non-null non-array object, and a nested empty `[]` matches only
 * an array (primitives, missing keys, and null never match). Arrays in the shape match as subsets
 * (each shape element must match some target element). Shape keys whose value is `undefined`
 * require that own key on the target. Non-plain shape values (Date, RegExp, Map, Set, typed arrays)
 * compare with {@link deepEqual}. Nesting deeper than 1000 levels throws `RangeError`.
 * Array subset matching costs O(shape size x value size); untrusted shapes should be
 * size-limited by the caller.
 * @example
```js
const objects = [
  { a: 1, b: 2, c: 3 },
  { a: 4, b: 5, c: 6 }
]

filter(objects, matches({ a: 4, c: 6 }))
// [{ a: 4, b: 5, c: 6 }]

matches({ tags: ['b'] })({ tags: ['a', 'b'] })
// true

matches({ a: undefined })({})
// false
```
 * @param shape Partial shape to match against.
 * @returns Predicate that returns true when its argument matches `shape`.
 */
/** Pairs `(shape, value)` already proven to match within one matches call. */
type MatchProven = WeakMap<object, WeakSet<object>>

/** Pairs on the active match path (cycle handling). */
type MatchPending = WeakMap<object, Set<object>>

function rememberMatch(proven: MatchProven, shape: object, obj: object): void {
  let set = proven.get(shape)
  if (set === undefined) {
    set = new WeakSet()
    proven.set(shape, set)
  }
  set.add(obj)
}

function isMatchProven(proven: MatchProven, shape: object, obj: object): boolean {
  return proven.get(shape)?.has(obj) === true
}

export function matches(shape: unknown): (obj: unknown) => boolean {
  if (shape === null || typeof shape !== 'object') {
    return () => false
  }
  return function (obj) {
    return guardNesting(() => matchDeep(shape, obj, true, 1, new WeakMap(), new WeakMap()))
  }
}

function matchDeep(
  shape: unknown,
  obj: unknown,
  top: boolean,
  depth: number,
  pending: MatchPending,
  proven: MatchProven
): boolean {
  if (shape === null || typeof shape !== 'object') return eq(obj, shape)
  enterNesting()
  let partners: Set<object> | undefined
  try {
    assertNestingDepth(depth)
    if (obj !== null && typeof obj === 'object') {
      if (isMatchProven(proven, shape, obj)) return true
      partners = pending.get(shape)
      if (partners?.has(obj)) return true
      if (partners === undefined) {
        partners = new Set()
        pending.set(shape, partners)
      }
      partners.add(obj)
    }
    let ok = false
    if (Array.isArray(shape)) {
      if (shape.length === 0) {
        ok = top || Array.isArray(obj)
      } else if (!Array.isArray(obj)) {
        ok = false
      } else {
        ok = true
        walkArray(shape, (sev) => {
          const item = sev.kind === 'value' ? sev.value : undefined
          const state = { found: false }
          walkArray(obj, (ev) => {
            const candidate = ev.kind === 'value' ? ev.value : undefined
            if (matchDeep(item, candidate, false, depth + 1, pending, proven)) {
              state.found = true
              return false
            }
          })
          if (!state.found) {
            ok = false
            return false
          }
        })
      }
    } else if (isPlainObject(shape)) {
      const shapeKeys = Object.keys(shape)
      if (shapeKeys.length === 0) {
        ok = top || (obj !== null && typeof obj === 'object' && !Array.isArray(obj))
      } else if (obj === null || typeof obj !== 'object') {
        ok = false
      } else {
        const record = obj as Record<string, unknown>
        ok = true
        for (const key of shapeKeys) {
          const expected = shape[key]
          if (expected === undefined) {
            if (!Object.hasOwn(obj, key)) {
              ok = false
              break
            }
          }
          if (!matchDeep(expected, record[key], false, depth + 1, pending, proven)) {
            ok = false
            break
          }
        }
      }
    } else {
      ok = deepEqual(shape, obj)
    }
    if (ok && obj !== null && typeof obj === 'object') {
      rememberMatch(proven, shape, obj)
    }
    return ok
  } finally {
    if (partners !== undefined && obj !== null && typeof obj === 'object') {
      partners.delete(obj)
    }
    exitNesting()
  }
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
  fn: Iteratee<T>
): void {
  if (collection == null) return
  // Arrays: own indices only (holes skipped).
  if (Array.isArray(collection)) {
    walkArray(collection, (ev) => {
      if (ev.kind !== 'value') return
      if (fn(ev.value as T, ev.index, collection) === false) return false
    })
    return
  }
  if (isIterable(collection)) {
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
export function findLast<T>(
  arr: Iterable<T> | object,
  fn: Iteratee<T> | object | PropertyKey
): T | undefined {
  let result: T | undefined
  const it = toIteratee<T>(fn)
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
  fn: Iteratee<T>
): void {
  if (collection == null) return
  if (Array.isArray(collection)) {
    const idxs: number[] = []
    walkArray(collection, (ev) => {
      if (ev.kind === 'value') idxs.push(ev.index)
    })
    for (let i = idxs.length - 1; i >= 0; i--) {
      const idx = idxs[i]
      const res = fn(collection[idx] as T, idx, collection)
      if (res === false) return
    }
    return
  }
  if (isIterable(collection)) {
    const items = arrayFromIterable<T>(collection)
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
 * Structural nesting deeper than 1000 levels throws `RangeError`.
 * @example
```js
flatten([1, [2, [3, [4]], 5]])
// [1, 2, [3, [4]], 5]

flatten({
  dates: {
    expiry_date: '30 sep 2018',
    available: '30 sep 2017',
    min_contract_period: [{ id: 1, name: '1 month' }]
  },
  price: { currency: 'RM', value: 1500 }
})
// {
//   'dates.expiry_date': '30 sep 2018',
//   'dates.available': '30 sep 2017',
//   'dates.min_contract_period[0].id': 1,
//   'dates.min_contract_period[0].name': '1 month',
//   'price.currency': 'RM',
//   'price.value': 1500
// }
```
 * @param {Array|Object} arr The array or object to flatten.
 * @param {number} [depth=1] The max recursion depth.
 * @returns {*} The new flattened array or object.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat Array.flat()}
 */
export function flatten<T>(arr: T[], depth?: boolean | number): T[]
export function flatten(arr: object, depth?: boolean | number): object
export function flatten<T>(arr: T[] | object, depth: boolean | number = 1): T[] | object {
  return guardFlattenSharedRevisits(() =>
    guardNesting(() => {
      if (Array.isArray(arr)) {
        const items = arr as T[]
        const d = depth === true ? Infinity : Number(depth)
        if (!(d > 0)) return items.slice()
        return flattenArray(items, d)
      }
      if (isObject(arr)) return flattenObj(arr)
      return arr
    })
  )
}

function flattenArray<T>(arr: T[], depth: number): T[] {
  assertNestingDepth(1)
  noteExpanded(arr)
  interface Frame {
    items: T[]
    depthLeft: number
    nesting: number
    index: number
    sparseKeys: string[] | null
  }
  const stack: Frame[] = [
    {
      items: arr,
      depthLeft: depth,
      nesting: 1,
      index: 0,
      sparseKeys: isHugeSparse(arr) ? arrayOwnIndices(arr) : null
    }
  ]
  const result: T[] = []
  while (stack.length > 0) {
    const frame = stack[stack.length - 1]
    const limit = frame.sparseKeys !== null ? frame.sparseKeys.length : frame.items.length
    if (frame.index >= limit) {
      stack.pop()
      continue
    }
    const i = frame.sparseKeys !== null ? Number(frame.sparseKeys[frame.index++]) : frame.index++
    if (frame.sparseKeys === null && !(i in frame.items)) {
      result.push(undefined as T)
      continue
    }
    const value = frame.items[i]
    if (frame.depthLeft > 0 && Array.isArray(value)) {
      assertNestingDepth(frame.nesting + 1)
      noteExpanded(value)
      stack.push({
        items: value as T[],
        depthLeft: frame.depthLeft - 1,
        nesting: frame.nesting + 1,
        index: 0,
        sparseKeys: isHugeSparse(value) ? arrayOwnIndices(value) : null
      })
    } else {
      result.push(value)
    }
  }
  return result
}

function assertFlattenableKey(key: string): void {
  if (key === '' || key.includes('.') || key.includes('[') || key.includes(']')) {
    throw new TypeError(`flatten cannot represent key ${truncateForError(key)}`)
  }
}

function setFlatKey(result: Record<string, unknown>, key: string, value: unknown): void {
  if (Object.hasOwn(result, key)) {
    throw new TypeError(`flatten produced duplicate key ${truncateForError(key)}`)
  }
  result[key] = value
}

function flattenObj(root: unknown): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (root === null || typeof root !== 'object') return result
  interface Frame {
    obj: object
    prefix: string
    nesting: number
    keys: string[]
    index: number
  }
  const path: object[] = []
  const onPath = new Set<object>()
  const stack: Frame[] = []

  const pushContainer = (obj: object, prefix: string, nesting: number): void => {
    assertNestingDepth(nesting)
    if (onPath.has(obj)) throw new ValueError('cyclic structure')
    if (!isPlainObject(obj) && !Array.isArray(obj)) {
      if (prefix) setFlatKey(result, prefix, obj)
      return
    }
    // Count before Object.keys so a budget throw skips key alloc.
    noteExpanded(obj)
    const keys = Object.keys(obj)
    onPath.add(obj)
    path.push(obj)
    stack.push({ obj, prefix, nesting, keys, index: 0 })
  }

  pushContainer(root, '', 1)

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]
    if (frame.index >= frame.keys.length) {
      stack.pop()
      onPath.delete(path.pop() as object)
      continue
    }
    const key = frame.keys[frame.index++]
    assertFlattenableKey(key)
    const child = (frame.obj as Record<string, unknown>)[key]
    const pref = Array.isArray(frame.obj)
      ? `${frame.prefix}[${key}]`
      : frame.prefix
        ? `${frame.prefix}.${key}`
        : key
    if (child !== null && typeof child === 'object') {
      pushContainer(child, pref, frame.nesting + 1)
    } else if (pref) {
      setFlatKey(result, pref, child)
    }
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
 * @param {Iteratee} fn The function invoked per iteration.
 * @returns Returns the new mapped array.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map Array.map()}
 */
export function map<T, TResult>(
  arr: T[] | object,
  fn: Iteratee<T, PropertyKey, TResult> | object | PropertyKey
): TResult[] {
  const it = toIteratee(fn) as Iteratee<T, PropertyKey, TResult>
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
  obj: T[] | Iterable<T> | null | undefined,
  fn: Iteratee<T> | object | PropertyKey,
  start = 0
): number {
  if (obj == null) return -1
  if (!Array.isArray(obj) && !isIterable(obj)) {
    throw new TypeError('expected an iterable')
  }
  const arr: T[] = Array.isArray(obj) ? obj : arrayFromIterable<T>(obj)
  const length = arr.length
  if (length && start < 0) {
    start = Math.max(start + length, 0)
  }
  if (!length || start >= length) return -1
  const it = toIteratee<T>(fn)
  let found = -1
  walkArray(arr, (ev) => {
    if (ev.kind === 'value') {
      if (ev.index < start) return
      if (it(ev.value as T, ev.index, arr)) {
        found = ev.index
        return false
      }
      return
    }
    if (ev.end <= start) return
    const idx = Math.max(ev.start, start)
    if (idx < ev.end && it(undefined as T, idx, arr)) {
      found = idx
      return false
    }
  })
  return found
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
export function indexOf<T>(obj: T[] | Iterable<T> | null | undefined, value: T, start = 0): number {
  // Native indexOf skips holes (unlike findIndex, which sees them as undefined).
  if (obj == null) return -1
  if (!Array.isArray(obj) && !isIterable(obj)) {
    throw new TypeError('expected an iterable')
  }
  const arr: T[] = Array.isArray(obj) ? obj : arrayFromIterable<T>(obj)
  const length = arr.length
  if (length && start < 0) start = Math.max(start + length, 0)
  if (!length || start >= length) return -1
  let found = -1
  walkArray(arr, (ev) => {
    if (ev.kind !== 'value') return
    if (ev.index < start) return
    if (eq(value, ev.value)) {
      found = ev.index
      return false
    }
  })
  return found
}

/**
 * This method is like {@link findIndex} except that it iterates the collection from right to left.
 * @param {Array} arr The array to inspect.
 * @param {string|Iteratee|Object} fn The function invoked per iteration.
 * @param {number} [start] The index to search from.
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
  arr: T[] | Iterable<T> | null | undefined,
  fn: Iteratee<T> | object | PropertyKey,
  start?: number
): number {
  if (arr == null) return -1
  if (!Array.isArray(arr) && !isIterable(arr)) {
    throw new TypeError('expected an iterable')
  }
  const list: T[] = Array.isArray(arr) ? arr : arrayFromIterable<T>(arr)
  const length = list.length
  start ??= length - 1
  if (!length || start < 0) return -1
  if (start >= length) start = length - 1
  const it = toIteratee<T>(fn)
  const events: ArrayWalkEvent[] = []
  walkArray(list, (ev) => {
    events.push(ev)
  })
  for (let e = events.length - 1; e >= 0; e--) {
    const ev = events[e]
    if (ev.kind === 'value') {
      if (ev.index > start) continue
      if (it(ev.value as T, ev.index, list)) return ev.index
    } else {
      if (ev.start > start) continue
      const idx = Math.min(ev.end - 1, start)
      if (idx >= ev.start && it(undefined as T, idx, list)) return idx
    }
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
export function lastIndexOf<T>(
  obj: T[] | Iterable<T> | null | undefined,
  value: T,
  start?: number
): number {
  // Native lastIndexOf skips holes (unlike findLastIndex, which sees them as undefined).
  if (obj == null) return -1
  if (!Array.isArray(obj) && !isIterable(obj)) {
    throw new TypeError('expected an iterable')
  }
  const list: T[] = Array.isArray(obj) ? obj : arrayFromIterable<T>(obj)
  const length = list.length
  let from = start ?? length - 1
  if (!length || from < 0) return -1
  if (from >= length) from = length - 1
  const events: ArrayWalkEvent[] = []
  walkArray(list, (ev) => {
    if (ev.kind === 'value') events.push(ev)
  })
  for (let e = events.length - 1; e >= 0; e--) {
    const ev = events[e]
    if (ev.kind !== 'value' || ev.index > from) continue
    if (eq(value, ev.value)) return ev.index
  }
  return -1
}

/** Normalize `-0` to `+0` (native Set / Lodash semantics). */
function normalizeZero<T>(x: T): T {
  return Object.is(x, -0) ? (0 as T) : x
}

/**
 * Creates a duplicate-free version of an array, using SameValueZero equality on `iteratee` keys, keeping the first element for each key.
 * Results normalize `-0` to `+0`.
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
export function uniq<T>(arr: Iterable<T>, fn: Iteratee<T> | object | PropertyKey = identity): T[] {
  const seen = new Set<unknown>()
  const result: T[] = []
  const it = toIteratee<T>(fn)
  const add = (x: T): void => {
    const key = it(x)
    if (seen.has(key)) return
    seen.add(key)
    result.push(normalizeZero(x))
  }
  if (Array.isArray(arr)) {
    // Own elements only (holes skipped), matching filter/map native hole rules.
    walkArray(arr, (ev) => {
      if (ev.kind === 'value') add(ev.value as T)
    })
    return result
  }
  for (const x of arr) add(x)
  return result
}

/**
 * This method is like {@link uniq} except that it sorts the results in ascending order
 * @param arr The array containing duplicated elements
 * @param fn The iteratee invoked per element.
 * @returns Returns the new duplicate free array
 * @example
```js
sortedUniq([2, 1, 2])
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
 * Assigns own enumerable string keyed properties of source objects onto the destination for keys
 * whose own value is `undefined`, or that are missing as own properties and whose current value
 * is exactly `Object.prototype[key]` (fills names like `toString` that are only inherited from
 * Object.prototype). Inherited getters and methods from a class prototype are never overridden.
 * `__proto__` is never filled on an ordinary target (its value is the prototype, not
 * `Object.prototype.__proto__`). Writes use plain assignment so inherited setters run, except
 * `__proto__` which is defined as an own data property (reachable only on null-prototype targets).
 * Source objects are applied from left to right. Once a property is set, additional values of
 * the same property are ignored.
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
function propertyDescriptorAlongChain(object: object, key: string): PropertyDescriptor | undefined {
  let cur: object | null = object
  while (cur) {
    const desc = Object.getOwnPropertyDescriptor(cur, key)
    if (desc) return desc
    cur = Object.getPrototypeOf(cur) as object | null
  }
  return undefined
}

export function defaults<T extends object>(object: T, ...sources: object[]): T {
  const target = object as Record<string, unknown>
  for (const source of sources) {
    for (const key of Object.keys(source)) {
      if (Array.isArray(object) && isCanonicalArrayIndex(key)) {
        const idx = Number(key)
        if (idx > object.length) throw new RangeError('array index beyond length')
      }
      const value = target[key]
      const fill =
        value === undefined ||
        (!Object.hasOwn(object, key) &&
          value === (Object.prototype as Record<string, unknown>)[key])
      if (!fill) continue
      const desc = propertyDescriptorAlongChain(object, key)
      if (desc && 'get' in desc && desc.set === undefined) continue
      const srcVal = (source as Record<string, unknown>)[key]
      if (key === '__proto__') {
        defineData(target, key, srcVal)
      } else {
        target[key] = srcVal
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
  let result = setFromIterable(first)
  for (const r of rest) {
    result = result.difference(setFromIterable(r))
  }
  return result.values()
}

/**
 * Yield elements present in exactly one of `a` or `b` (SameValueZero).
 * @param a First iterable.
 * @param b Second iterable.
 */
export function symmetricDifference<T>(a: Iterable<T>, b: Iterable<T>): IteratorObject<T> {
  return setFromIterable(a).symmetricDifference(setFromIterable(b)).values()
}

/**
 * Yield elements present in every input iterable (SameValueZero), in first-seen order of the first.
 * @param its Input iterables (at least one).
 * @see {@link difference}
 * @see {@link union}
 */
export function intersection<T>(...its: Iterable<T>[]): IteratorObject<T> {
  if (its.length === 0) return new Set<T>().values()
  const rest = its.slice(1).map((it) => setFromIterable(it))
  return (function* () {
    const seen = new Set<T>()
    const first: Iterable<T> = Array.isArray(its[0]) ? arrayElements(its[0]) : its[0]
    for (const value of first) {
      if (seen.has(value)) continue
      if (rest.every((s) => s.has(value))) {
        seen.add(value)
        yield value
      }
    }
  })()
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
    result = result.union(setFromIterable(it))
  }
  return result.values()
}

/**
 * Creates an object composed of keys generated from the results of running each element of `arr` thru `func`. The order of grouped values is determined by the order they occur in `arr`. The corresponding value of each key is an array of elements responsible for generating the key.
 *
 * @param arr The collection to iterate over.
 * @param fn The iteratee to transform keys (required).
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
 * @param fn The iteratee to transform keys (required).
 * @returns {Map} Returns the aggregated map object.
 * @template K, V
 *
 * @example
```js
[...groupByMap([6.1, 4.2, 6.3], Math.floor)]
// [[6, [6.1, 6.3]], [4, [4.2]]]

[...groupByMap(['one', 'two', 'three'], 'length')]
// [[3, ['one', 'two']], [5, ['three']]]
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
  if (isIterable(coll)) return arrayFromIterable<T>(coll)
  return Object.values(coll)
}

/**
 * Remove every element for which `predicate` is truthy from `arr` in place; return the removed elements in original order.
 * @param arr Array to mutate.
 * @param predicate Function, plain-object shape, or property path.
 */
export function remove<T>(
  arr: T[],
  predicate: ((value: T, index: number, coll: unknown) => unknown) | object | PropertyKey
): T[] {
  if (!Array.isArray(arr)) throw new TypeError('remove expects an array')
  const pred = toIteratee<T>(predicate)
  const drop = new Set<number>()
  walkArray(arr, (ev) => {
    if (ev.kind === 'value') {
      if (pred(ev.value as T, ev.index, arr)) drop.add(ev.index)
      return
    }
    if (pred(undefined as T, ev.start, arr)) drop.add(ev.start)
  })
  const removed: T[] = []
  let write = 0
  const own: number[] = []
  walkArray(arr, (ev) => {
    if (ev.kind === 'value') own.push(ev.index)
  })
  for (const read of own) {
    if (drop.has(read)) {
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
  predicate: ((value: T, index: number, coll: unknown) => unknown) | object | PropertyKey
): T[] {
  const pred = toIteratee<T>(predicate)
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
 * Results normalize `-0` to `+0`.
 * @param array Source array (not mutated).
 * @param values Values to exclude.
 */
export function without<T>(array: readonly T[], ...values: T[]): T[] {
  const exclude = new Set(values)
  if (!Array.isArray(array)) {
    return [...array].filter((x) => !exclude.has(x)).map(normalizeZero)
  }
  const out: T[] = []
  walkArray(array as unknown[], (ev) => {
    if (ev.kind !== 'value') return
    if (!exclude.has(ev.value as T)) out.push(normalizeZero(ev.value as T))
  })
  return out
}
