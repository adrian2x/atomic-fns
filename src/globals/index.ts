/**
 * This module includes global functions and constants.
 *
 * @module globals
 */

export type { AnyFunction } from '../types.js'
export {
  CustomError,
  IndexError,
  IOError,
  KeyError,
  NotImplementedError,
  ValueError,
  ZeroDivisionError
} from './errors.js'
export { hash, hashCode } from './hash.js'

import type { AnyFunction } from '../types.js'
import { NotImplementedError } from './errors.js'

/** This is just a noop function. */
export function noop(): void {
  return undefined
}

/** A function that always returns `true`. */
export const True = () => true

/** A function that always returns `false`. */
export const False = () => false

/**
 * Returns the true type of any value with correct detection for `null`, `Array`,
 * `Object`, `Promise`, `Symbol`, and `NaN`. Uses `typeof`, `Array.isArray`,
 * `instanceof Error`, and `Object.prototype.toString` only - never user methods.
 * @param value
 * @returns The value type.
 */
export function type(value: unknown): string {
  const t = typeof value
  if (value === null) return 'null'
  if (t === 'undefined') return 'undefined'
  if (t === 'boolean') return 'boolean'
  if (t === 'number') return Number.isNaN(value) ? 'NaN' : 'number'
  if (t === 'bigint') return 'bigint'
  if (t === 'string') return 'string'
  if (t === 'symbol') return 'symbol'
  if (t === 'function') return 'function'
  if (Array.isArray(value)) return 'array'
  if (value instanceof Error) return 'error'
  const tag = Object.prototype.toString.call(value)
  if (tag === '[object Object]') return 'object'
  return tag.slice(8, -1)
}

/**
 * Returns a string representing the object.
 * @param obj
 * @returns `obj.toString()` or `''` if `obj` is `null` or `undefined`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString | Object.toString }
 */
export function str(obj: unknown): string {
  if (obj == null) return ''
  return (obj as { toString(): string }).toString()
}

/** Check if value is a boolean type. */
export function isBool(x: unknown): x is boolean {
  return type(x) === 'boolean'
}

/** Check if value is an `Error` type. */
export function isError(x: unknown): x is Error {
  return x instanceof Error
}

/** Check if value is an iterable type. */
export function isIterable(x: unknown): x is Iterable<unknown> {
  if (x == null) return false
  return typeof (x as Iterable<unknown>)[Symbol.iterator] === 'function'
}

/** Check if value is a native `Date` type. */
export function isDate(x: unknown): x is Date {
  return x instanceof Date
}

/** Check if value is a plain object type (`type(x) === 'object'`). */
export function isObject(x: unknown): x is Record<PropertyKey, unknown> {
  return type(x) === 'object'
}

/** Check if value is a string type. */
export function isString(x: unknown): x is string {
  return type(x) === 'string'
}

/**
 * Check if value is Array-like.
 * A value is array-like if it is an array, or a non-null, non-function, non-string
 * value with a numeric `.length`. Strings return `false`.
 */
export function isArrayLike(x: unknown): boolean {
  if (Array.isArray(x)) return true
  if (x == null || typeof x === 'function' || typeof x === 'string') return false
  return typeof (x as { length?: unknown }).length === 'number'
}

/** Check if value is a number type (not NaN). */
export function isNumber(x: unknown): x is number {
  return type(x) === 'number'
}

/** Check if value is a bigint type. */
export function isBigint(x: unknown): x is bigint {
  return type(x) === 'bigint'
}

/** Check if value is a Promise type. */
export function isPromise(x: unknown): x is Promise<unknown> {
  return type(x) === 'Promise'
}

/** Check if value is a function type. */
export function isFunction(x: unknown): x is AnyFunction {
  return typeof x === 'function'
}

/** Check if value is an async function. */
export function isAsyncFunction(x: unknown): x is (...args: never[]) => Promise<unknown> {
  return typeof x === 'function' && x.constructor.name === 'AsyncFunction'
}

/** Check if value is a generator object. */
export function isGenerator(x: unknown): x is Generator {
  return Object.prototype.toString.call(x) === '[object Generator]'
}

/** Check if value is `null` or `undefined`. */
export function isNull(x: unknown): x is null | undefined {
  return x == null
}

/** Check if value === `undefined`. */
export function isUndefined(x: unknown): x is undefined {
  return x === undefined
}

/** Check if value is not `null` or `undefined`. */
export function notNull(x: unknown): boolean {
  return x != null
}

/** Returns `true` for objects without length or falsy values. */
export function isEmpty(x: unknown): boolean {
  return len(x) === 0 ? true : !x
}

/** Check if value is a `RegExp` type */
export function isRegExp(x: unknown): x is RegExp {
  return x instanceof RegExp
}

/** Check if value is a `Symbol` type */
export function isSymbol(x: unknown): x is symbol {
  return type(x) === 'symbol'
}

/** Check if value is a `Set` type. */
export function isSet<T>(x: unknown): x is Set<T> {
  return x instanceof Set
}

/** Check if value is a `Map` type. */
export function isMap<K, V>(x: unknown): x is Map<K, V> {
  return x instanceof Map
}

/** Check if value is a `WeakSet` type. */
export function isWeakSet<T extends object>(x: unknown): x is WeakSet<T> {
  return x instanceof WeakSet
}

/** Check if value is a `WeakMap` type. */
export function isWeakMap<K extends object, V>(x: unknown): x is WeakMap<K, V> {
  return x instanceof WeakMap
}

/**
 * Returns the number of elements in a collection type.
 *
 * If `value.length` or `value.size()` is defined, this will be returned.
 * If `value` is an `Object`, it returns the number of keys.
 * @param value
 * @returns The number of elements in the collection or `undefined`.
 */
export function len(value: unknown): number | undefined {
  if (value == null) return undefined
  const v = value as { length?: unknown; size?: unknown }
  if (isNumber(v.length)) {
    return v.length
  }
  if (isNumber(v.size)) {
    return v.size
  }
  if (isFunction(v.size)) {
    return (v.size as () => number)()
  }
  if (isObject(value)) {
    return Object.keys(value).length
  }
  return undefined
}

let idCounter = 1

/**
 * Generates a unique ID. If a prefix is given, it is prepended to the counter.
 * @param {string} [prefix=''] The id prefix.
 * @returns {string} The unique id string.
 * @example
```js
uniqueId()
// '1'

uniqueId('user_')
// 'user_2'
```
 */
export function uniqueId(prefix = ''): string {
  return prefix + String(idCounter++)
}

/**
 * Random v4 UUID (RFC 9562). Not sortable.
 * Uses `crypto.randomUUID` when available, else `crypto.getRandomValues`.
 * @returns A GUID formatted string.
 * @example
```js
uuid()
// '183f8ef3-b8f0-4000-81f5-89234c836d00'
```
 */
export function uuid(): string {
  const c = globalThis.crypto as Partial<typeof globalThis.crypto> | undefined
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID()
  }
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    c.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    let out = ''
    for (const byte of bytes) {
      out += byte.toString(16).padStart(2, '0')
    }
    return (
      out.slice(0, 8) +
      '-' +
      out.slice(8, 12) +
      '-' +
      out.slice(12, 16) +
      '-' +
      out.slice(16, 20) +
      '-' +
      out.slice(20)
    )
  }
  throw new NotImplementedError('crypto.getRandomValues unavailable')
}

/**
 * Checks if `obj[key]` is a function, and calls it with any given `args`.
 * Reads the property once with no path parsing.
 * @param obj
 * @param key
 * @param args
 * @return The method result or `undefined`.
 */
export function call(obj: unknown, key: PropertyKey, ...args: unknown[]): unknown {
  const fn = (obj as Record<PropertyKey, unknown> | null | undefined)?.[key]
  if (typeof fn === 'function') {
    return (fn as (...a: unknown[]) => unknown).apply(obj, args)
  }
  return undefined
}

/** Convert number to unicode character */
export function chr(x: number): string {
  return String.fromCodePoint(x)
}

/** Convert character to Unicode code point */
export function ord(s: string): number {
  return s.codePointAt(0) ?? Number.NaN
}

/**
 * Returns an array of the own enumerable property names of `object`.
 * @param object The given object.
 * @returns The array of object keys.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys Object.keys()}
 */
export function keys<T extends object>(object: T): (keyof T & string)[] {
  return Object.keys(object) as (keyof T & string)[]
}

/**
 * Check if a given property is present in a given object.
 * @param obj The object to check.
 * @param attr A property key name.
 * @returns `true` if the object has the property name.
 */
export function has(obj: unknown, attr: PropertyKey): boolean {
  return obj != null && Reflect.has(Object(obj) as object, attr)
}

/**
 * Check if the attribute is present in the object or return a default value instead.
 * @param key
 * @param obj
 * @param value
 * @return The property value or default value.
 */
export function get<V = unknown>(key: PropertyKey | PropertyKey[], obj: unknown, value?: V): V {
  if (obj == null) return value as V

  let paths: PropertyKey[] = Array.isArray(key) ? key : [key]
  if (typeof key === 'string') {
    paths = key.split('.')
  }

  try {
    let result: unknown = obj
    for (const k of paths) {
      result = (result as Record<PropertyKey, unknown>)[k]
    }
    return (result === undefined ? value : result) as V
  } catch {
    return value as V
  }
}

/**
 * Deletes a given property key from an object.
 * @param attr The property name.
 * @param x The given object.
 * @returns The modified object.
 */
export function del<T extends object | null | undefined>(attr: PropertyKey, x: T): T {
  if (x != null) Reflect.deleteProperty(x, attr)
  return x
}

/**
 * Adds a property to an object, or modifies the existing value.
 * Always sets `configurable: true` so a second call on the same key replaces it.
 * @param attr The name or Symbol of the property to be defined or modified.
 * @param obj The container object.
 * @param value The value associated with the property
 * @param {boolean} [writable=false] If `true` the value may be changed later. Defaults to `false`.
 * @param {boolean} [enumerable=false] If `true` this property shows up during enumeration of the properties in the object. Defaults to `false`.
 * @returns The object.
 */
export function set<T extends object>(
  attr: PropertyKey,
  obj: T,
  value: unknown,
  writable = false,
  enumerable = false
): T {
  Object.defineProperty(obj, attr, {
    value,
    enumerable,
    writable,
    configurable: true
  })
  return obj
}

/**
 * Converts a number to a binary string.
 * @param n The given number.
 * @returns The binary string representation of `n`.
 */
export function bin(n: number): string {
  return n.toString(2)
}

/**
 * Converts a number to a hexadecimal string.
 * @param n The given number.
 * @returns The hexadecimal string representation of `n`.
 */
export function hex(n: number): string {
  return n.toString(16)
}

/**
 * Converts a number to an octal string.
 * @param n The given number.
 * @returns The octal string representation of `n`.
 */
export function oct(n: number): string {
  return n.toString(8)
}

/**
 * Returns a floating point number constructed from a number or string `x`.
 * @param x The number or string.
 * @returns A floating point number parsed from the given value or `NaN`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseFloat parseFloat}
 */
export function float(x: string): number {
  return parseFloat(x)
}

/**
 * Returns an integer number constructed from a number or string `x`.
 * @param x The number or string.
 * @param base Radix for string parsing (default 10).
 * @returns An integer number parsed from the given value or `NaN`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt parseInt}
 */
export function int(x: string | number, base = 10): number {
  if (typeof x === 'number') return Math.trunc(x)
  return parseInt(x, base)
}

/**
 * Converts the value to an array using `Array.from()`.
 * @param value
 * @returns A new array value.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from Array.from()}
 */
export function list<T>(value?: Iterable<T> | ArrayLike<T>): T[] {
  if (value != null) return Array.from(value)
  return []
}

/**
 * Retrieve the next item from the iterator by calling its `next()` method.
 * When the iterator is done, returns `dflt` (the iterator return value is ignored).
 * @param iter The iterator.
 * @param dflt Default when done.
 * @returns The next value from the iterator, or `dflt`.
 */
export function next<T, D = undefined>(it: Iterator<T>, dflt?: D): T | D {
  const r = it.next()
  if (r.done) return dflt as D
  return r.value
}
