/**
 * Collections
 * @module
 */
import {
  call,
  get,
  isArray,
  isArrayLike,
  isBool,
  isEmpty,
  isFunc,
  isNull,
  isNumber,
  isObject,
  isString,
  keys,
  NotImplementedError,
  set
} from './globals.js'
import { comp, eq, id } from './operators.js'
/**
 * A Collection is an iterable container type.
 * This is an abstract base class for user-defined collection types.
 *
 *
 * @abstract
 * @class Collection
 * @implements {Container}
 */
export class Collection {
  /**
   * Returns an iterator for the container items
   * @return {Iterator}
   */
  [Symbol.iterator]() {
    return this
  }

  /**
   * Implements the iterator protocol and returns the next item in the iterable.
   */
  next() {}
  /**
   * Adds a new item to the container.
   * @param item
   */
  add(item) {}
  /**
   * Checks if item is present in the container.
   * @param item
   */
  contains(item) {
    return false
  }

  /**
   * Returns the total number of elements in the container.
   */
  size() {
    throw new NotImplementedError()
  }

  /**
   * Remove the first item from the container where `item == x`
   * @raises ValueError when x is not found
   */
  remove(x) {}
  /**
   * Retrieve and remove the item at index `i`.
   * @returns the item or undefined if not found.
   */
  pop(i) {}
  /**
   * Remove all items from the container
   */
  clear() {}
}
/**
 * A sequence is an iterable type with efficient index-based access.
 *
 *
 * @abstract
 * @class Sequence
 * @extends {Collection}
 * @template T
 */
export class Sequence extends Collection {
  /**
   * Return the item at the given key or index
   * @param {*} key
   * @memberof Sequence
   */
  get(key) {
    throw new NotImplementedError()
  }

  /**
   * Set a new value at the given key or index
   *
   * @param {*} key
   * @param {T} val
   * @memberof Sequence
   */
  set(key, val) {
    throw new NotImplementedError()
  }

  /**
   * Deletes the given key or index, and its value.
   * Raises ValueError if not key is found.
   *
   * @param {*} key
   * @memberof Sequence
   */
  delete(key) {
    throw new NotImplementedError()
  }

  /**
   * Adds a new item to the end of the sequence.
   *
   * @param {T} x
   * @memberof Sequence
   */
  append(x) {}
  /**
   * Append all the items to the sequence.
   *
   * @param {Iterable<T>} iter
   * @memberof Sequence
   */
  extend(iter) {}
  /**
   * Return the index of x in the sequence, or undefined if not found.
   *
   * @param {T} item
   * @return {(number | undefined)}
   * @memberof Sequence
   */
  indexOf(item) {
    throw new NotImplementedError()
  }

  size() {
    return 0
  }

  reversed() {
    throw new NotImplementedError()
  }
}
/**
 * Returns a new immutable Set object with elements from `iterable`. Its contents cannot be altered after it's created.
 *
 *
 * @class FrozenSet
 * @extends {Set<T>}
 * @template T
 */
export class FrozenSet extends Set {
  constructor(iterable) {
    super(iterable)
    return this.freeze()
  }

  add() {
    throw TypeError('FrozenSet cannot be modified.')
        return this; // eslint-disable-line
  }

  delete() {
    throw TypeError('FrozenSet cannot be modified.')
        return false; // eslint-disable-line
  }

  clear() {
    throw TypeError('FrozenSet cannot be modified.')
        return this; // eslint-disable-line
  }

  freeze() {
    return Object.freeze(this)
  }
}
export const compact = (...arr) => arr.filter((x) => !isEmpty(x))
/**
 * Creates a function that can be used to create named tuple-like objects.
 * @example
 * ```
 * let Point = namedtuple('x', 'y', 'z')
 * let userObj = User(0, 0, 0)
 * // -> {x: 0, y: 0, z: 0}
 * ```
 *
 *
 * @param {...string[]} fields
 * @return
 */
export function namedtuple(...fields) {
  return (...args) => fields.reduce((prev, f, i) => set(prev, f, args[i], false, true), {})
}
export function filter(arr, fn = isNull) {
  if (Array.isArray(arr)) {
    // @ts-expect-error function is not compatible?
    if (typeof fn === 'function') return arr.filter(fn)
    if (typeof fn === 'string') return arr.filter((x) => get(x, fn))
    if (isObject(fn)) return arr.filter(matches(fn))
  }
}
export function find(arr, fn) {
  if (Array.isArray(arr)) {
    if (typeof fn === 'function') return arr.find(fn)
    if (typeof fn === 'string') return arr.find((x) => x?.[fn])
    if (isObject(fn)) return arr.find(matches(fn))
  }
}
export function findRight(arr, fn) {
  if (Array.isArray(arr)) {
    for (let i = arr.length - 1; i >= 0; i--) {
      const x = arr[i]
      if (typeof fn === 'function') {
        if (fn(x)) return x
      } else if (typeof fn === 'string') {
        if (x?.[fn]) return x
      } else if (isObject(fn)) {
        if (matches(fn)(x)) return x
      }
    }
  }
}
export const matches = (o) => (x) => {
  if (!o || !x) return false
  for (const key in o) {
    if (!eq(x[key], o[key])) return false
  }
  return true
}
export function forEach(arr, fn) {
  if (Array.isArray(arr)) return arr.forEach(fn)
  if (isObject(arr)) {
    return Object.keys(arr).forEach((key) => fn(get(arr, key), key, arr))
  }
}
export function flatten(arr, depth = 1) {
  if (!depth) return arr
  if (Array.isArray(arr)) return flattenArray(arr, depth, [])
  if (isObject(arr)) return flattenObj(arr)
  return arr
}
export function flattenArray(arr, depth = 1, result = []) {
  for (const value of arr) {
    if (depth && Array.isArray(value)) {
      flattenArray(value, typeof depth === 'number' ? depth - 1 : depth, result)
    } else {
      result.push(value)
    }
  }
  return result
}
export function flattenObj(o, prefix = '', result = {}, keepNull = false) {
  if (isString(o) || isNumber(o) || isBool(o) || (keepNull && isNull(o))) {
    result[prefix] = o
    return result
  }
  if (isArray(o) || isObject(o)) {
    for (const i in o) {
      let pref = prefix
      if (isArray(o)) {
        pref = pref + `[${i}]`
      } else {
        if (isEmpty(prefix)) {
          pref = i
        } else {
          pref = prefix + '.' + i
        }
      }
      flattenObj(o[i], pref, result, keepNull)
    }
    return result
  }
  return result
}
export const map = (arr, fn) => {
  if (Array.isArray(arr)) {
    return arr.map((x, i) => {
      if (typeof fn === 'string') return x[fn]
      return fn(x, i, arr)
    })
  }
  if (isObject(arr)) {
    return Object.keys(arr).map((key) => {
      if (typeof fn === 'string') return get(arr[key], fn)
      return fn(arr[key], key, arr)
    })
  }
}
export function pick(obj, paths) {
  if (obj == null) {
    return {}
  }
  const result = {}
  if (Array.isArray(paths)) {
    for (const key of paths) {
      result[key] = obj[key]
    }
    return result
  } else if (typeof paths === 'function') {
    for (const key in obj) {
      const value = obj[key]
      if (paths(value, key)) result[key] = value
    }
  }
  return result
}
export function omit(obj, paths) {
  const result = {}
  for (const key in obj) {
    const value = obj[key]
    if (Array.isArray(paths) && !paths.includes(key)) {
      result[key] = value
    } else if (typeof paths === 'function' && !paths(value, key)) {
      result[key] = value
    }
  }
  return result
}
export function contains(arr, y) {
  const op = call(arr, 'contains', y)
  if (op != null) return op
  return indexOf(arr, y) >= 0
}
export function indexOf(obj, x, start = 0) {
  if (obj == null) return
  const op = call(obj, 'indexOf', x, start)
  if (op != null) return op
  const length = obj.length
  if (length && start < 0) {
    start = Math.max(start + length, 0)
  }
  if (!length || start >= length) return -1
  for (; start < length; start++) {
    if (eq(x, obj[start])) return start
  }
  return -1
}
export function lastIndexOf(obj, x, start) {
  if (obj == null) return
  const op = call(obj, 'lastIndexOf', x, start)
  if (op != null) return op
  const length = obj.length
  if (start == null) start = length - 1
  if (!length || start < 0) return -1
  for (; start >= 0; start--) {
    if (eq(x, obj[start])) return start
  }
  return -1
}
/**
 * Creates a clone of the given `obj`. If `deep` is `true` it will clone it recursively.
 *
 *
 * @param {*} obj
 * @param {boolean} [deep=false]
 * @return The clone value
 */
export function clone(obj, deep = false) {
  if (ArrayBuffer.isView(obj)) {
    return cloneTypedArray(obj, deep)
  }
  if (isArray(obj) || isArrayLike(obj)) {
    return cloneArray(obj, deep)
  }
  if (isObject(obj)) {
    if (isFunc(obj.clone)) {
      return obj.clone()
    }
    const copy = {}
    for (const key of keys(obj)) {
      if (deep) {
        copy[key] = clone(obj[key], deep)
      } else {
        copy[key] = obj[key]
      }
    }
    return copy
  }
  return obj
}
export function cloneArray(arr, deep = false) {
  if (!deep) return Array.from(arr)
  return arr.map((item) => clone(item, deep))
}
export function cloneArrayBuffer(arrayBuffer) {
  const result = new arrayBuffer.constructor(arrayBuffer.byteLength)
  new Uint8Array(result).set(new Uint8Array(arrayBuffer))
  return result
}
export function cloneTypedArray(typedArray, isDeep) {
  const buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer
  return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length)
}
export function uniq(arr, fn = id) {
  const keys = new Set()
  for (const x of arr) {
    if (typeof fn === 'function') {
      keys.add(fn(x))
    } else {
      keys.add(get(x, fn))
    }
  }
  return Array.from(keys.values())
}
export function sortedUniq(arr, fn = id) {
  const lst = uniq(arr, fn)
  lst.sort(comp)
  return lst
}
function baseMergeDeep(obj, source, key, stack) {
  const objValue = obj[key]
  const srcValue = source[key]
  const stacked = stack.get(srcValue)
  if (stacked && (objValue !== stacked || !(key in obj))) {
    obj[key] = stacked
    return
  }
  let newValue
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
function baseMerge(obj, source, stack) {
  if (obj === source) return obj
  for (const key in source) {
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
 * Note: this method mutates `obj`
 *
 *
 * @param {Object} obj
 * @param {...Object} sources
 * @return {Object} The destination object.
 */
export function merge(obj, ...sources) {
  for (const source of sources) {
    baseMerge(obj, source)
  }
  return obj
}
export function* difference(...args) {
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
export function* intersection(...args) {
  const sets = args.map((arr) => new Set(arr))
  // build a counter map to find items in all
  const results = new Map()
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
export function* union(...args) {
  const results = new Set()
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
 *
 * @param {(any[] | Object)} arr The collection to iterate over.
 * @param {(Iteratee | PropertyKey)} [func=id] The iteratee to transform keys.
 * @return {Object} Returns the composed aggregate object.
 */
export function groupBy(arr, func = id) {
  const results = {}
  if (Array.isArray(arr)) {
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i]
      const groupKey = typeof func === 'function' ? func(item, i) : get(item, func)
      const values = results[groupKey] || []
      values.push(item)
      results[groupKey] = values
    }
  } else {
    for (const k in arr) {
      const item = arr[k]
      const groupKey = typeof func === 'function' ? func(item, k) : get(item, func)
      const values = results[groupKey]
      values.push(item)
      results[groupKey] = values
    }
  }
  return results
}
