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

/**
 * True for any non-null, non-array object (`type(x) === 'object'`), including class instances
 * and null-prototype objects. Arrays, Dates, Maps, and other tagged builtins are false.
 */
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
  if (typeof x !== 'function') return false
  // A function with a null prototype has no inherited `constructor`.
  const ctor = (x as { constructor?: { name?: string } }).constructor
  return ctor?.name === 'AsyncFunction'
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

/**
 * Returns `true` for empty collections or falsy values. Length is consulted only for arrays,
 * strings, arguments objects, typed arrays / Buffers, and objects with a callable `splice`.
 * Size is consulted only for Map, Set, and non-plain library collections. Plain objects that
 * merely own a `length` or `size` key count own enumerable string keys (Lodash-aligned).
 * Functions are empty unless they have own enumerable properties (arity is irrelevant).
 * Dates and non-zero numbers are not empty.
 */
export function isEmpty(x: unknown): boolean {
  if (x == null) return true
  if (typeof x === 'boolean') return !x
  if (typeof x === 'number') return x === 0 || Number.isNaN(x)
  if (typeof x === 'bigint') return x === 0n
  if (typeof x === 'string') return x.length === 0
  if (typeof x === 'symbol') return false
  if (typeof x === 'function') return Object.keys(x).length === 0
  if (typeof x !== 'object') return !x

  if (x instanceof Date) return false
  if (Array.isArray(x)) return x.length === 0
  if (ArrayBuffer.isView(x)) return x.byteLength === 0
  if (Object.prototype.toString.call(x) === '[object Arguments]') {
    return (x as { length: number }).length === 0
  }
  if (
    typeof (x as { length?: unknown }).length === 'number' &&
    typeof (x as { splice?: unknown }).splice === 'function'
  ) {
    return (x as { length: number }).length === 0
  }
  if (x instanceof Map || x instanceof Set) return x.size === 0
  const proto: unknown = Object.getPrototypeOf(x)
  const plain = proto === Object.prototype || proto === null
  if (!plain && typeof (x as { size?: unknown }).size === 'number') {
    return (x as { size: number }).size === 0
  }
  return Object.keys(x).length === 0
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
uniqueId('user_').startsWith('user_')
// true

typeof uniqueId()
// 'string'
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
/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid())
// true
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
    return out.replace(/^(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-')
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

const DANGEROUS_SEGMENTS = new Set<PropertyKey>(['__proto__', 'constructor', 'prototype'])

/** Prototypes whose inherited function-valued members are treated as missing (R5-4). */
const BUILTIN_METHOD_PROTOS: Set<object> = (() => {
  const protos: object[] = [
    Object.prototype,
    Function.prototype,
    Array.prototype,
    String.prototype,
    Number.prototype,
    Boolean.prototype,
    BigInt.prototype,
    Symbol.prototype,
    RegExp.prototype,
    Date.prototype,
    Map.prototype,
    Set.prototype,
    WeakMap.prototype,
    WeakSet.prototype,
    Promise.prototype,
    Error.prototype,
    ArrayBuffer.prototype,
    DataView.prototype,
    Int8Array.prototype,
    Uint8Array.prototype,
    Uint8ClampedArray.prototype,
    Int16Array.prototype,
    Uint16Array.prototype,
    Int32Array.prototype,
    Uint32Array.prototype,
    Float32Array.prototype,
    Float64Array.prototype,
    BigInt64Array.prototype,
    BigUint64Array.prototype
  ]
  const asyncFnProto: unknown = Object.getPrototypeOf(async function sampleAsync() {
    return await Promise.resolve(0)
  })
  const genFnProto: unknown = Object.getPrototypeOf(function* sampleGen() {
    yield 0
  })
  const asyncGenFnProto: unknown = Object.getPrototypeOf(async function* sampleAsyncGen() {
    yield await Promise.resolve(0)
  })
  if (asyncFnProto !== null && typeof asyncFnProto === 'object') protos.push(asyncFnProto)
  if (genFnProto !== null && typeof genFnProto === 'object') protos.push(genFnProto)
  if (asyncGenFnProto !== null && typeof asyncGenFnProto === 'object') protos.push(asyncGenFnProto)
  const IteratorCtor = (globalThis as { Iterator?: { prototype: object } }).Iterator
  if (IteratorCtor) protos.push(IteratorCtor.prototype)
  return new Set(protos)
})()

function pathSegments(key: PropertyKey | PropertyKey[]): PropertyKey[] {
  if (typeof key === 'string') return key.split('.')
  if (Array.isArray(key)) return key
  return [key]
}

function isPlainObjectOrArray(base: object): boolean {
  if (Array.isArray(base)) return true
  const proto: unknown = Object.getPrototypeOf(base)
  return proto === Object.prototype || proto === null
}

function isOwnDataProperty(base: object, key: PropertyKey): boolean {
  const desc = Object.getOwnPropertyDescriptor(base, key)
  return (
    desc !== undefined &&
    desc.get === undefined &&
    desc.set === undefined &&
    Object.prototype.hasOwnProperty.call(desc, 'value')
  )
}

/**
 * True when `key` must be treated as missing on `base`: dangerous segments that are not an own
 * data property of a plain object or array; other members found only on Object.prototype /
 * Function.prototype; inherited function-valued members of other built-in prototypes.
 */
function isForbiddenPathSegment(base: object, key: PropertyKey): boolean {
  if (Object.hasOwn(base, key)) {
    if (DANGEROUS_SEGMENTS.has(key)) {
      return !(isPlainObjectOrArray(base) && isOwnDataProperty(base, key))
    }
    return false
  }
  if (DANGEROUS_SEGMENTS.has(key)) return true

  let proto: object | null = Object.getPrototypeOf(base) as object | null
  while (proto) {
    if (Object.hasOwn(proto, key)) {
      if (proto === Object.prototype || proto === Function.prototype) return true
      if (BUILTIN_METHOD_PROTOS.has(proto)) {
        const desc = Object.getOwnPropertyDescriptor(proto, key)
        if (
          desc &&
          desc.get === undefined &&
          desc.set === undefined &&
          typeof desc.value === 'function'
        ) {
          return true
        }
        return false
      }
      return false
    }
    proto = Object.getPrototypeOf(proto) as object | null
  }
  return false
}

/**
 * Check if a given property is present in a given object.
 * Own properties and user-class prototype members count; `Object.prototype` /
 * `Function.prototype` members, prototype-reaching `__proto__`/`constructor`/`prototype`
 * segments (unless own data on a plain object or array), and inherited function-valued
 * members of other built-in prototypes do not.
 * @param obj The object to check.
 * @param attr A property key name.
 * @returns `true` if the object has the property name.
 */
export function has(obj: unknown, attr: PropertyKey): boolean {
  if (obj == null) return false
  const base = Object(obj) as object
  if (isForbiddenPathSegment(base, attr)) return false
  return Reflect.has(base, attr)
}

/**
 * Check if the attribute is present in the object or return a default value instead.
 * Path segments that would reach a built-in prototype via `__proto__`, `constructor`, or
 * `prototype` (unless that segment is an own data property of a plain object or array), or that
 * resolve only to `Object.prototype` / `Function.prototype` members, or to inherited
 * function-valued members of other built-in prototypes, are treated as missing (return `value`).
 * Own properties and user-class prototype members (getters, methods) still resolve. Array /
 * string `length` and non-function accessors such as `Map.prototype.size` remain readable.
 * @param key
 * @param obj
 * @param value
 * @return The property value or default value.
 */
export function get<V = unknown>(key: PropertyKey | PropertyKey[], obj: unknown, value?: V): V {
  if (obj == null) return value as V

  const paths = pathSegments(key)

  try {
    let result: unknown = obj
    for (const k of paths) {
      if (result == null) return value as V
      const t = typeof result
      if (t !== 'object' && t !== 'function' && t !== 'string') return value as V
      const base = Object(result) as object
      if (isForbiddenPathSegment(base, k)) return value as V
      result = (result as Record<PropertyKey, unknown>)[k]
    }
    return (result === undefined ? value : result) as V
  } catch {
    return value as V
  }
}

/**
 * Deletes a property at a path. Dot-separated strings and key arrays walk like {@link get}.
 * A `__proto__`, `constructor`, or `prototype` segment that is not an own data property of a
 * plain object or array is a no-op (the object is returned unchanged).
 * @param attr The property name or path.
 * @param x The given object.
 * @returns The modified object.
 */
export function del<T extends object | null | undefined>(
  attr: PropertyKey | PropertyKey[],
  x: T
): T {
  if (x == null) return x
  const paths = pathSegments(attr)
  if (paths.length === 0) return x
  let cur: unknown = x
  for (let i = 0; i < paths.length - 1; i++) {
    const seg = paths[i]
    if (cur == null) return x
    const t = typeof cur
    if (t !== 'object' && t !== 'function') return x
    const base = Object(cur) as object
    if (isForbiddenPathSegment(base, seg)) return x
    cur = (cur as Record<PropertyKey, unknown>)[seg]
  }
  const last = paths[paths.length - 1]
  if (cur == null || (typeof cur !== 'object' && typeof cur !== 'function')) return x
  const parent = Object(cur) as object
  if (isForbiddenPathSegment(parent, last) && !Object.hasOwn(parent, last)) return x
  if (
    DANGEROUS_SEGMENTS.has(last) &&
    !(isPlainObjectOrArray(parent) && Object.hasOwn(parent, last))
  ) {
    return x
  }
  Reflect.deleteProperty(parent, last)
  return x
}

/**
 * Adds a property to an object, or modifies the existing value. Dot-separated strings and key
 * arrays walk like {@link get}. Writing through a `__proto__`, `constructor`, or `prototype`
 * segment that is not an own data property of a plain object or array throws
 * `TypeError('refusing to write through "<segment>"')`. Always sets `configurable: true` so a
 * second call on the same key replaces it.
 * @param attr The name, Symbol, or path of the property to be defined or modified.
 * @param obj The container object.
 * @param value The value associated with the property
 * @param {boolean} [writable=false] If `true` the value may be changed later. Defaults to `false`.
 * @param {boolean} [enumerable=false] If `true` this property shows up during enumeration of the properties in the object. Defaults to `false`.
 * @returns The object.
 */
export function set<T extends object>(
  attr: PropertyKey | PropertyKey[],
  obj: T,
  value: unknown,
  writable = false,
  enumerable = false
): T {
  const paths = pathSegments(attr)
  if (paths.length === 0) return obj
  let cur: object = obj
  for (let i = 0; i < paths.length - 1; i++) {
    const seg = paths[i]
    if (
      DANGEROUS_SEGMENTS.has(seg) &&
      !(isPlainObjectOrArray(cur) && isOwnDataProperty(cur, seg))
    ) {
      throw new TypeError(`refusing to write through "${String(seg)}"`)
    }
    if (isForbiddenPathSegment(cur, seg)) {
      throw new TypeError(`refusing to write through "${String(seg)}"`)
    }
    const next = (cur as Record<PropertyKey, unknown>)[seg]
    if (next === null || (typeof next !== 'object' && typeof next !== 'function')) {
      throw new TypeError(`refusing to write through "${String(seg)}"`)
    }
    cur = next
  }
  const last = paths[paths.length - 1]
  if (DANGEROUS_SEGMENTS.has(last) && !isPlainObjectOrArray(cur)) {
    throw new TypeError(`refusing to write through "${String(last)}"`)
  }
  Object.defineProperty(cur, last, {
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
 * Converts an iterable to an array. Non-iterables (including array-likes with only `length`)
 * throw `TypeError('expected an iterable')` before allocating. Pass `null`/`undefined` for `[]`.
 * @param value Iterable source.
 * @returns A new array value.
 */
export function list<T>(value?: Iterable<T> | null): T[] {
  if (value == null) return []
  if (!isIterable(value)) throw new TypeError('expected an iterable')
  const out: T[] = []
  for (const x of value) out.push(x)
  return out
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
