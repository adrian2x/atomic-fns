/**
 * Reading and writing by path: `get`, `set`, `has`, `unset`.
 */

import { isCanonicalArrayIndex } from '../internal/sparse.ts'
import { isPlainObject } from '../is/isPlainObject.ts'
import { DANGEROUS_KEYS, type Path, parsePath, writeKey } from './parsePath.ts'

function isContainer(x: unknown): x is object {
  return (typeof x === 'object' && x !== null) || typeof x === 'function'
}

function isOwnData(base: object, key: PropertyKey): boolean {
  const desc = Object.getOwnPropertyDescriptor(base, key)
  return desc !== undefined && 'value' in desc
}

/**
 * True when `key` would lead from `base` to a prototype: `__proto__`, `constructor` or
 * `prototype`, unless it is an own data property of an object that is not a function.
 */
export function reachesPrototype(base: object, key: PropertyKey): boolean {
  return DANGEROUS_KEYS.has(key) && (typeof base === 'function' || !isOwnData(base, key))
}

function unsafeWrite(base: object, key: PropertyKey): boolean {
  if (!DANGEROUS_KEYS.has(key)) return false
  return !((Array.isArray(base) || isPlainObject(base)) && isOwnData(base, key))
}

function refuse(key: PropertyKey): TypeError {
  return new TypeError(`refusing to write through "${String(key)}"`)
}

/**
 * The value at `path` in `obj`, or `defaultValue` when the path is missing or the value is
 * `undefined`. Every segment reads a property as `obj[key]` does, own or inherited, and a string
 * reads as its boxed form, so `get('abc', 'length')` is 3. A `__proto__`, `constructor` or
 * `prototype` segment that is not own data of a non-function object reads as missing, so a path
 * cannot reach a prototype. An empty path names no property and reads as missing.
 * @param obj The object to read.
 * @param path A dotted string with `[0]` and `['key']` segments, or an array of keys.
 * @param defaultValue Returned when nothing is found.
 * @returns The value found, or `defaultValue`.
 * @throws {TypeError} for a malformed path.
 * @example
 * ```ts
 * get({ a: [{ b: 1 }] }, 'a[0].b') // 1
 * get({ 'a.b': 1 }, "['a.b']") // 1
 * get({ 'a.b': 1 }, ['a.b']) // 1
 * get({}, 'a.b', 'none') // 'none'
 * ```
 */
export function get(obj: unknown, path: Path, defaultValue?: unknown): unknown {
  const segments = parsePath(path)
  if (segments.length === 0) return defaultValue
  let cur: unknown = obj
  for (const key of segments) {
    if (cur === null || cur === undefined) return defaultValue
    const base = Object(cur) as object
    if (reachesPrototype(base, key)) return defaultValue
    cur = (base as Record<PropertyKey, unknown>)[key]
  }
  return cur === undefined ? defaultValue : cur
}

/**
 * True when every segment of `path` is an own property along the way, as lodash's `has` checks.
 * A `__proto__`, `constructor` or `prototype` segment that is not own data of a non-function
 * object does not count. The terminal value is not read. An empty path names no property, so it
 * is never present.
 * @param obj The object to test.
 * @param path A dotted string with `[0]` and `['key']` segments, or an array of keys.
 * @returns Whether the path is present.
 * @throws {TypeError} for a malformed path.
 * @example
 * ```ts
 * has({ a: { b: undefined } }, 'a.b') // true
 * has({ a: [1] }, ['a', 0]) // true
 * has(Object.create({ a: 1 }), 'a') // false: inherited
 * ```
 */
export function has(obj: unknown, path: Path): boolean {
  const segments = parsePath(path)
  if (segments.length === 0) return false
  let cur: unknown = obj
  for (let i = 0; i < segments.length; i++) {
    const key = segments[i]
    if (cur === null || cur === undefined) return false
    const base = Object(cur) as object
    if (reachesPrototype(base, key) || !Object.hasOwn(base, key)) return false
    if (i < segments.length - 1) cur = (base as Record<PropertyKey, unknown>)[key]
  }
  return true
}

function growsArray(target: unknown[], key: PropertyKey, value: unknown): boolean {
  if (key === 'length') return Object(value) === value || Number(value) > target.length
  return typeof key === 'string' && isCanonicalArrayIndex(key) && Number(key) > target.length
}

function write(target: object, key: PropertyKey, value: unknown, terminal: boolean): void {
  if (terminal && (key === 'constructor' || key === 'prototype')) {
    const desc = Object.getOwnPropertyDescriptor(target, key)
    if (desc && (!('value' in desc) || !desc.writable)) throw refuse(key)
    if (desc === undefined) {
      writeKey(target, key, value)
      return
    }
  } else if (unsafeWrite(target, key)) throw refuse(key)
  if (Array.isArray(target) && growsArray(target, key, value)) {
    throw new RangeError(
      key === 'length'
        ? 'array length can only shrink, to a primitive number'
        : `array index ${String(key)} is past the end`
    )
  }
  ;(target as Record<PropertyKey, unknown>)[key] = value
}

/**
 * Set the value at `path` in `obj` and return `obj`, as lodash's `set` does. A missing or
 * primitive step is replaced by a new array when the next segment is an index, and by a plain
 * object otherwise. The last segment is assigned, so setters run, except a terminal
 * `constructor` or `prototype` is written as own data. An empty path names no property, so `obj`
 * is returned unchanged.
 * @param obj The object to change. A `null`, `undefined` or primitive `obj` is returned as it is.
 * @param path A dotted string with `[0]` and `['key']` segments, or an array of keys.
 * @param value The value to store.
 * @returns `obj`.
 * @throws {TypeError} when a `__proto__` or non-terminal `constructor` or `prototype` segment is
 * not own data of a plain object or array; a terminal `constructor` or `prototype` is an own
 * accessor or non-writable property; or a step is inherited.
 * @throws {RangeError} for an array index past the end, or a `length` that would grow an array,
 * so a short path cannot allocate a huge array.
 * @example
 * ```ts
 * set({}, 'a.b', 1) // { a: { b: 1 } }
 * set({}, ['list', '0'], 'x') // { list: ['x'] }
 * ```
 */
export function set<T>(obj: T, path: Path, value: unknown): T {
  const segments = parsePath(path)
  if (!isContainer(obj) || segments.length === 0) return obj
  const last = segments.length - 1
  let cur: object = obj
  let depth = 0
  for (; depth < last; depth++) {
    const key = segments[depth]
    if (unsafeWrite(cur, key)) throw refuse(key)
    if (!Object.hasOwn(cur, key) && key in cur) {
      throw new TypeError(`refusing to write through inherited "${String(key)}"`)
    }
    const next = (cur as Record<PropertyKey, unknown>)[key]
    if (!isContainer(next)) break
    cur = next
  }
  let tail = value
  for (let i = last; i > depth; i--) {
    const key = segments[i]
    const fresh = typeof key === 'string' && isCanonicalArrayIndex(key) ? [] : {}
    write(fresh, key, tail, i === last)
    tail = fresh
  }
  write(cur, segments[depth], tail, depth === last)
  return obj
}

/**
 * Delete the property at `path` in `obj`, as lodash's `unset` does.
 * @param obj The object to change.
 * @param path A dotted string with `[0]` and `['key']` segments, or an array of keys.
 * @returns `true` when the property is gone (or was never there), `false` when it could not be
 * deleted or the path crosses a `__proto__`, `constructor` or `prototype` segment that is not own
 * data of a plain object or array, or an inherited step. An empty path names no property, so
 * nothing is deleted and the result is `true`.
 * @throws {TypeError} for a malformed path.
 * @example
 * ```ts
 * const obj = { a: { b: 1, c: 2 } }
 * unset(obj, 'a.b') // true
 * obj // { a: { c: 2 } }
 * ```
 */
export function unset(obj: unknown, path: Path): boolean {
  const segments = parsePath(path)
  if (segments.length === 0) return true
  let cur: unknown = obj
  for (let i = 0; i < segments.length - 1; i++) {
    if (!isContainer(cur)) return true
    const key = segments[i]
    if (unsafeWrite(cur, key)) return false
    if (!Object.hasOwn(cur, key)) return !(key in cur)
    cur = (cur as Record<PropertyKey, unknown>)[key]
  }
  if (!isContainer(cur)) return true
  const key = segments[segments.length - 1]
  if (unsafeWrite(cur, key)) return false
  return Reflect.deleteProperty(cur, key)
}
