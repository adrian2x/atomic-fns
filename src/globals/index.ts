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
export { isDate, isError, isMap, isRegExp, isSet, isWeakMap, isWeakSet } from './brand.js'

import { assertNotHugeSparse, isCanonicalArrayIndex } from '../internal/arrayKeys.js'
import { parsePath } from '../internal/path.js'
import { hasMethod, protocol } from '../operators/protocol.js'
import type { AnyFunction } from '../types.js'
import { isDate, isError, isMap, isSet, unbox } from './brand.js'
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
 * `Object`, `Promise`, `Symbol`, and `NaN`. Primitives, `null`, arrays, errors and plain objects
 * are lowercase (`'error'` from any realm); other objects report their object tag (`'Date'`,
 * `'Map'`, or a class's own `Symbol.toStringTag`, whose getter runs). A throwing tag getter or a
 * revoked proxy reports `'object'`.
 * @param value
 * @returns The value type.
 */
export function type(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value !== 'object') return typeof value
  try {
    if (Array.isArray(value)) return 'array'
    if (isError(value)) return 'error'
    const tag = Object.prototype.toString.call(value)
    return tag === '[object Object]' ? 'object' : tag.slice(8, -1)
  } catch {
    return 'object'
  }
}

/**
 * Returns a string representing the object.
 * @param obj
 * @returns `obj.toString()`, `''` if `obj` is `null` or `undefined`, or the object tag when
 * `toString` is not callable (null-prototype objects, parsed JSON with a `toString` key).
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString | Object.toString }
 */
export function str(obj: unknown): string {
  if (obj == null) return ''
  return typeof (obj as { toString?: unknown }).toString === 'function'
    ? (obj as { toString(): string }).toString()
    : Object.prototype.toString.call(obj)
}

/** Check if value is a boolean type. */
export function isBool(x: unknown): x is boolean {
  return type(x) === 'boolean'
}

/** Check if value is an iterable type. */
export function isIterable(x: unknown): x is Iterable<unknown> {
  if (x == null) return false
  return typeof (x as Iterable<unknown>)[Symbol.iterator] === 'function'
}

/** True when the `Symbol.toStringTag` that `x` shows was set by user code, not a builtin. */
function hasUserTag(x: object): boolean {
  for (let owner: object | null = x; owner; owner = Object.getPrototypeOf(owner) as object | null) {
    if (Object.hasOwn(owner, Symbol.toStringTag)) return !isIntrinsicPrototype(owner)
  }
  return false
}

/**
 * True for any non-null, non-array object, including class instances (tagged ones too) and
 * null-prototype objects. Arrays, errors, functions, Dates, Maps, and other builtin instances are
 * false. Unlike Lodash, which is true for arrays and functions.
 */
export function isObject(x: unknown): x is Record<PropertyKey, unknown> {
  const kind = type(x)
  if (kind === 'object') return true
  return (
    typeof x === 'object' && x !== null && kind !== 'array' && kind !== 'error' && hasUserTag(x)
  )
}

/** Check if value is a string type. */
export function isString(x: unknown): x is string {
  return type(x) === 'string'
}

/**
 * Check if value is Array-like.
 * A value is array-like if it is an array, or a non-null, non-function, non-string
 * value whose `.length` is a non-negative safe integer. Strings return `false`.
 */
export function isArrayLike(x: unknown): boolean {
  if (Array.isArray(x)) return true
  if (x == null || typeof x === 'function' || typeof x === 'string') return false
  const { length } = x as { length?: unknown }
  return Number.isSafeInteger(length) && (length as number) >= 0
}

/**
 * Check if value is a number type (not NaN). Returns a plain `boolean`: a type guard would tell
 * TypeScript that a `false` result cannot be a number, which NaN is.
 */
export function isNumber(x: unknown): boolean {
  return type(x) === 'number'
}

/** Check if value is a bigint type. */
export function isBigint(x: unknown): x is bigint {
  return type(x) === 'bigint'
}

/** Check if value is a Promise, from any realm. A tag alone is not enough: it must have `then`. */
export function isPromise(x: unknown): x is Promise<unknown> {
  return type(x) === 'Promise' && typeof (x as { then?: unknown }).then === 'function'
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

/** Check if value is a generator object. A tag alone is not enough: it must have `next`. */
export function isGenerator(x: unknown): x is Generator {
  return type(x) === 'Generator' && typeof (x as { next?: unknown }).next === 'function'
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
 * Element count under the rules `len` and `isEmpty` share, or `undefined` for a value without one
 * (primitives other than strings, Dates).
 */
function countOf(x: unknown): number | undefined {
  if (typeof x === 'string') return x.length
  if (typeof x === 'function') return Object.keys(x).length
  if (typeof x !== 'object' || x === null || isDate(x)) return undefined
  if (Array.isArray(x)) return x.length
  if (ArrayBuffer.isView(x)) return (x as { length?: number }).length ?? x.byteLength
  if (isMap(x) || isSet(x)) return x.size
  const kind = type(x)
  if (kind === 'ArrayBuffer' || kind === 'SharedArrayBuffer') return (x as ArrayBuffer).byteLength
  const { length, splice } = x as { length?: unknown; splice?: unknown }
  if (typeof length === 'number' && (kind === 'Arguments' || typeof splice === 'function')) {
    return length
  }
  if (!Object.hasOwn(x, 'size')) {
    const { size } = x as { size?: unknown }
    if (typeof size === 'number') return size
    if (typeof size === 'function') return (x as { size(): number }).size()
  }
  return Object.keys(x).length
}

/**
 * Returns `true` for empty collections or falsy values. A `protocol.bool` hook decides when
 * present. Wrapper objects count as their primitive. Length is consulted only for arrays,
 * strings, arguments objects, typed arrays / Buffers, and objects with a callable `splice`; byte
 * length for ArrayBuffers and DataViews. Size is consulted only for Map, Set, and a `size` a class
 * defines on its prototype. Objects that merely own a `length` or `size` key count own enumerable
 * string keys (Lodash-aligned). Functions are empty unless they have own enumerable properties
 * (arity is irrelevant). Dates and non-zero numbers are not empty.
 */
export function isEmpty(x: unknown): boolean {
  if (hasMethod(x, protocol.bool)) return !x[protocol.bool]()
  const value = unbox(x)
  if (value == null) return true
  if (typeof value === 'boolean') return !value
  if (typeof value === 'number') return value === 0 || Number.isNaN(value)
  if (typeof value === 'bigint') return value === 0n
  return countOf(value) === 0
}

/** Check if value is a `Symbol` type */
export function isSymbol(x: unknown): x is symbol {
  return type(x) === 'symbol'
}

/**
 * Returns the number of elements in a collection type, by the rules {@link isEmpty} uses: `length`
 * of arrays, strings and array-likes with `splice`, typed-array `length`, byte length of buffers,
 * `size` of Map, Set and classes that define it on their prototype (property or method), else the
 * number of own enumerable keys. Unlike Lodash `size`, a plain `{ length: 5 }` counts its keys.
 * @param value
 * @returns The number of elements, or `undefined` for `null`, `undefined`, Dates, and primitives
 * other than strings.
 */
export function len(value: unknown): number | undefined {
  return countOf(unbox(value))
}

let idCounter = 1

/**
 * Generates a unique ID. If a prefix is given, it is prepended to the counter.
 * @param prefix The id prefix; `null` and `undefined` mean none.
 * @returns {string} The unique id string.
 * @example
```js
uniqueId('user_').startsWith('user_')
// true

typeof uniqueId()
// 'string'
```
 */
export function uniqueId(prefix?: string | null): string {
  return (prefix ?? '') + String(idCounter++)
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

/** Convert number to unicode character. Throws `RangeError` where Python `chr` raises. */
export function chr(x: number): string {
  return String.fromCodePoint(x)
}

/**
 * Convert character to Unicode code point. Reads the first code point of a longer string and
 * returns `NaN` for `''`, where Python `ord` raises `TypeError`.
 */
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

function isPlainObjectOrArray(base: object): boolean {
  if (Array.isArray(base)) return true
  const proto: unknown = Object.getPrototypeOf(base)
  return proto === Object.prototype || proto === null
}

function isOwnDataProperty(base: object, key: PropertyKey): boolean {
  const desc = Object.getOwnPropertyDescriptor(base, key)
  return desc !== undefined && Object.hasOwn(desc, 'value')
}

/**
 * Standard constructors looked up by name on `globalThis` (never enumerated).
 * Missing or non-function bindings are skipped via per-name try/catch.
 */
const INTRINSIC_CTOR_NAMES: ReadonlySet<string> = new Set([
  'Object',
  'Function',
  'Array',
  'String',
  'Number',
  'Boolean',
  'BigInt',
  'Symbol',
  'RegExp',
  'Date',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'WeakRef',
  'FinalizationRegistry',
  'Promise',
  'Error',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
  'AggregateError',
  'ArrayBuffer',
  'SharedArrayBuffer',
  'DataView',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float16Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
  'Iterator',
  'Buffer',
  'URL',
  'URLSearchParams',
  'Blob',
  'File',
  'FormData',
  'Headers',
  'Request',
  'Response',
  'AbortController',
  'AbortSignal',
  'Event',
  'EventTarget',
  'TextDecoder',
  'TextEncoder',
  'ReadableStream',
  'WritableStream',
  'TransformStream'
])

/**
 * Intrinsic prototypes whose function-valued members are treated as missing when inherited.
 * Built from an explicit constructor list - no `globalThis` enumeration and no
 * `Function.prototype.toString` sniffing on the hot path - on first use, because reading some
 * platform globals loads their implementation and importing this module should not pay for that.
 */
function collectIntrinsicPrototypes(): WeakSet<object> {
  const set = new WeakSet<object>()
  const add = (p: unknown): void => {
    if (typeof p === 'object' && p !== null) set.add(p)
    else if (typeof p === 'function') set.add(p)
  }
  const addCtor = (ctor: unknown): void => {
    if (typeof ctor === 'function') {
      add((ctor as { prototype?: unknown }).prototype)
    }
  }
  const lookupGlobalCtor = (name: string): void => {
    try {
      const ctor = (globalThis as Record<string, unknown>)[name]
      if (typeof ctor === 'function') addCtor(ctor)
    } catch {
      // Throwing getters (e.g. sandboxed iframe localStorage) must not abort import.
    }
  }

  for (const name of INTRINSIC_CTOR_NAMES) {
    lookupGlobalCtor(name)
  }

  for (const namespace of ['Intl', 'Temporal']) {
    try {
      const members = (globalThis as Record<string, unknown>)[namespace]
      if (typeof members !== 'object' || members === null) continue
      for (const key of Object.getOwnPropertyNames(members)) {
        try {
          addCtor((members as Record<string, unknown>)[key])
        } catch {
          // Skip throwing namespace accessors.
        }
      }
    } catch {
      // Namespace unavailable.
    }
  }

  add(Object.prototype)
  add(Function.prototype)
  add(Object.getPrototypeOf(Uint8Array.prototype))

  const asyncFn = async function intrinsicAsync() {
    await Promise.resolve()
  }
  const genFn = function* intrinsicGen() {
    yield 0
  }
  const asyncGenFn = async function* intrinsicAsyncGen() {
    await Promise.resolve()
    yield 0
  }
  addCtor(asyncFn.constructor)
  addCtor(genFn.constructor)
  addCtor(asyncGenFn.constructor)
  // Instance prototypes (%AsyncFunctionPrototype%, %GeneratorPrototype%, ...).
  add(Object.getPrototypeOf(asyncFn))
  add(Object.getPrototypeOf(genFn()))
  add(Object.getPrototypeOf(Object.getPrototypeOf(genFn())))
  add(Object.getPrototypeOf(asyncGenFn()))
  add(Object.getPrototypeOf(Object.getPrototypeOf(asyncGenFn())))

  const arrayIter = [][Symbol.iterator]()
  const mapIter = new Map()[Symbol.iterator]()
  const setIter = new Set()[Symbol.iterator]()
  const stringIter = ''[Symbol.iterator]()
  const regexpIter = /a/[Symbol.matchAll]('')
  add(Object.getPrototypeOf(arrayIter))
  add(Object.getPrototypeOf(mapIter))
  add(Object.getPrototypeOf(setIter))
  add(Object.getPrototypeOf(stringIter))
  add(Object.getPrototypeOf(regexpIter))
  add(Object.getPrototypeOf(Object.getPrototypeOf(arrayIter)))

  return set
}

let intrinsicPrototypes: WeakSet<object> | undefined

/** True for a prototype of another realm whose constructor bears an intrinsic's name. */
function isForeignIntrinsic(proto: object): boolean {
  let root = proto
  let parent = Object.getPrototypeOf(root) as object | null
  while (parent !== null) {
    root = parent
    parent = Object.getPrototypeOf(root) as object | null
  }
  if (root === Object.prototype) return false
  const ctor: unknown = Object.getOwnPropertyDescriptor(proto, 'constructor')?.value
  return typeof ctor === 'function' && INTRINSIC_CTOR_NAMES.has(ctor.name)
}

function isIntrinsicPrototype(proto: object): boolean {
  intrinsicPrototypes ??= collectIntrinsicPrototypes()
  return intrinsicPrototypes.has(proto) || isForeignIntrinsic(proto)
}

/**
 * True when `key` must be treated as missing on `base`: a dangerous segment that is not own data
 * of a non-function object; other members found only on Object.prototype / Function.prototype;
 * inherited (non-own) function-valued members whose owning prototype is an intrinsic of any realm.
 * User-class methods and getters stay readable.
 */
function isForbiddenPathSegment(base: object, key: PropertyKey): boolean {
  if (Object.hasOwn(base, key)) {
    if (DANGEROUS_SEGMENTS.has(key)) {
      return typeof base === 'function' || !isOwnDataProperty(base, key)
    }
    return false
  }
  if (DANGEROUS_SEGMENTS.has(key)) return true

  let proto: object | null = Object.getPrototypeOf(base) as object | null
  while (proto) {
    if (Object.hasOwn(proto, key)) {
      if (proto === Object.prototype || proto === Function.prototype) return true
      const desc = Object.getOwnPropertyDescriptor(proto, key)
      return typeof desc?.value === 'function' && isIntrinsicPrototype(proto)
    }
    proto = Object.getPrototypeOf(proto) as object | null
  }
  return false
}

/** Writes cross a dangerous segment only as own data of a plain object or array. */
function isUnsafeWriteSegment(base: object, key: PropertyKey): boolean {
  return (
    DANGEROUS_SEGMENTS.has(key) && !(isPlainObjectOrArray(base) && isOwnDataProperty(base, key))
  )
}

function writeRefusal(key: PropertyKey): TypeError {
  return new TypeError(`refusing to write through "${String(key)}"`)
}

function isContainer(v: unknown): v is object {
  return (typeof v === 'object' && v !== null) || typeof v === 'function'
}

/** True when `key` is present on `base` only via the prototype chain (not own). */
function isInheritedKey(base: object, key: PropertyKey): boolean {
  return !Object.hasOwn(base, key) && Reflect.has(base, key)
}

/**
 * Check if a given property or path is present in a given object.
 *
 * Takes the object first, like Lodash. {@link get}, {@link set} and {@link del} take the key first.
 *
 * String paths split on `.` and numeric brackets as in {@link get}; pass an array for a literal key
 * (`['a.b']`). Own properties and user-class prototype members count; `Object.prototype` /
 * `Function.prototype` members, prototype-reaching `__proto__`/`constructor`/`prototype` segments
 * (unless own data of a non-function object), and inherited functions whose owning prototype is an
 * intrinsic of any realm do not. An empty path names nothing, so it is `false`.
 * @param obj The object to check.
 * @param attr A property key, dotted string path, or array of path segments.
 * @returns `true` if every segment of the path is present.
 * @throws {TypeError} for a segment that is not a string, number or symbol, even on `null`.
 * @throws {RangeError} for a string path over 2^20 characters or a huge sparse array path.
 * @example
```js
has({ a: { b: 1 } }, 'a.b') // true
has({ a: [1] }, 'a[0]') // true
has({ 'a.b': 1 }, ['a.b']) // true
```
 */
export function has(obj: unknown, attr: PropertyKey | readonly unknown[]): boolean {
  const paths = parsePath(attr)
  if (obj == null || paths.length === 0) return false
  let cur: unknown = obj
  for (const [i, k] of paths.entries()) {
    if (cur == null) return false
    const t = typeof cur
    if (t !== 'object' && t !== 'function' && t !== 'string') return false
    const base = Object(cur) as object
    if (isForbiddenPathSegment(base, k)) return false
    if (!Reflect.has(base, k)) return false
    if (i < paths.length - 1) cur = (cur as Record<PropertyKey, unknown>)[k]
  }
  return true
}

/**
 * Check if the attribute is present in the object or return a default value instead.
 *
 * Takes the key first, unlike Lodash `_.get(obj, path, dflt)`.
 *
 * String paths split on `.`, and a segment's trailing numeric brackets walk indexes (`a[0][1].b`).
 * Quoted and other brackets stay literal, and so does a key with a dot; use the array form for
 * those (`['a.b']`). Path segments that would reach a built-in prototype via `__proto__`,
 * `constructor`, or `prototype` (unless that segment is own data of a non-function object), or that
 * resolve only to `Object.prototype` / `Function.prototype` members, or to inherited functions
 * whose owning prototype is an intrinsic of any realm, are treated as missing (return `value`).
 * Own properties and user-class prototype members (getters, methods) still resolve, and errors
 * from getters propagate. Array / string `length` and non-function accessors such as
 * `Map.prototype.size` remain readable. An empty path returns `value`.
 * @param key
 * @param obj
 * @param value
 * @return The property value or default value.
 * @throws {TypeError} for a segment that is not a string, number or symbol, even on `null`.
 * @throws {RangeError} for a string path over 2^20 characters or a huge sparse array path.
 */
export function get<T = unknown, D = T>(
  key: PropertyKey | readonly unknown[],
  obj: unknown,
  value?: D
): NoInfer<T> | D {
  const paths = parsePath(key)
  if (obj == null || paths.length === 0) return value as D

  let result: unknown = obj
  for (const k of paths) {
    if (result == null) return value as D
    const t = typeof result
    if (t !== 'object' && t !== 'function' && t !== 'string') return value as D
    const base = Object(result) as object
    if (isForbiddenPathSegment(base, k)) return value as D
    result = (result as Record<PropertyKey, unknown>)[k]
  }
  return (result === undefined ? value : result) as T | D
}

/**
 * Deletes a property at a path.
 *
 * Takes the key first, like {@link get} and unlike {@link has}.
 *
 * Paths walk like {@link get}. A `__proto__`, `constructor`, or `prototype` segment that is not an
 * own data property of a plain object or array is a no-op (the object is returned unchanged).
 * Descending through an inherited (non-own) property, or into a builtin prototype such as
 * `Object.prototype`, is also a no-op.
 * @param attr The property name or path.
 * @param x The given object.
 * @returns The modified object.
 * @throws {TypeError} for a segment that is not a string, number or symbol, even on `null`.
 * @throws {RangeError} for a string path over 2^20 characters or a huge sparse array path.
 */
export function del<T extends object | null | undefined>(
  attr: PropertyKey | readonly unknown[],
  x: T
): T {
  const paths = parsePath(attr)
  if (x == null || paths.length === 0) return x
  let cur: unknown = x
  for (let i = 0; i < paths.length - 1; i++) {
    const seg = paths[i]
    if (!isContainer(cur)) return x
    if (isForbiddenPathSegment(cur, seg) || isUnsafeWriteSegment(cur, seg)) return x
    if (isInheritedKey(cur, seg)) return x
    cur = (cur as Record<PropertyKey, unknown>)[seg]
    if (isContainer(cur) && isIntrinsicPrototype(cur)) return x
  }
  const last = paths[paths.length - 1]
  if (!isContainer(cur) || isUnsafeWriteSegment(cur, last)) return x
  Reflect.deleteProperty(cur, last)
  return x
}

function isIndexSegment(key: PropertyKey): key is string {
  return typeof key === 'string' && isCanonicalArrayIndex(key)
}

function growsArray(target: unknown[], key: PropertyKey, value: unknown): boolean {
  // Coercing an object to a length could run its valueOf or join a huge array, so objects are out.
  if (key === 'length') return Object(value) === value || Number(value) > target.length
  return isIndexSegment(key) && Number(key) > target.length
}

/** Assigns `key`, so setters run, unless a flag asks for `defineProperty`. */
function writeSegment(
  target: object,
  key: PropertyKey,
  value: unknown,
  writable?: boolean,
  enumerable?: boolean
): void {
  if (isUnsafeWriteSegment(target, key)) throw writeRefusal(key)
  if (Array.isArray(target) && growsArray(target, key, value)) {
    throw new RangeError('array index beyond length')
  }
  if (writable === undefined && enumerable === undefined) {
    ;(target as Record<PropertyKey, unknown>)[key] = value
    return
  }
  Object.defineProperty(target, key, {
    value,
    writable: writable ?? true,
    enumerable: enumerable ?? true,
    configurable: true
  })
}

/**
 * Sets the value at a path, like Lodash `_.set`.
 *
 * Takes the key first, unlike Lodash `_.set(obj, path, value)`.
 *
 * Paths walk like {@link get}. Missing and primitive intermediates are replaced by own plain
 * containers: an array when the next segment is an index, else an object. The last segment is
 * assigned, so setters run and an existing key stays enumerable and writable. Passing `writable`
 * or `enumerable` defines the last segment with `defineProperty` instead (the other flag defaults
 * to `true`, `configurable` is always `true`).
 *
 * Writing to or through a `__proto__`, `constructor`, or `prototype` segment that is not an own
 * data property of a plain object or array throws
 * `TypeError('refusing to write through "<segment>"')`, and so does a segment that reaches a
 * builtin prototype such as `Object.prototype`. Descending through an inherited (non-own) property
 * throws `TypeError('refusing to write through inherited "<segment>"')`. An array index past the
 * end, or a `length` that would grow the array, throws
 * `RangeError('array index beyond length')`. None of these leave a partial write behind.
 * @param attr The name, Symbol, or path of the property to be defined or modified.
 * @param obj The container object. A `null`, `undefined` or primitive root is returned as is.
 * @param value The value associated with the property
 * @param writable When given, whether the value may be changed later.
 * @param enumerable When given, whether this property shows up during enumeration.
 * @returns The object.
 * @throws {TypeError} for a segment that is not a string, number or symbol, even on `null`.
 * @throws {RangeError} for a string path over 2^20 characters or a huge sparse array path.
 */
export function set<T extends object | null | undefined>(
  attr: PropertyKey | readonly unknown[],
  obj: T,
  value: unknown,
  writable?: boolean,
  enumerable?: boolean
): T {
  const paths = parsePath(attr)
  if (!isContainer(obj) || paths.length === 0) return obj
  const last = paths.length - 1
  let cur: object = obj
  let depth = 0
  for (; depth < last; depth++) {
    const seg = paths[depth]
    if (isUnsafeWriteSegment(cur, seg)) throw writeRefusal(seg)
    if (isInheritedKey(cur, seg)) {
      throw new TypeError(`refusing to write through inherited "${String(seg)}"`)
    }
    const next = (cur as Record<PropertyKey, unknown>)[seg]
    if (!isContainer(next)) break
    if (isIntrinsicPrototype(next)) throw writeRefusal(seg)
    cur = next
  }

  const write = (target: object, i: number, v: unknown): void => {
    if (i === last) writeSegment(target, paths[i], v, writable, enumerable)
    else writeSegment(target, paths[i], v)
  }
  let tail = value
  for (let i = last; i > depth; i--) {
    const fresh = isIndexSegment(paths[i]) ? [] : {}
    write(fresh, i, tail)
    tail = fresh
  }
  write(cur, depth, tail)
  return obj
}

/**
 * Converts a number to a binary string, with no `0b` prefix (Python `bin` has one).
 * @param n The given number.
 * @returns The binary string representation of `n`.
 */
export function bin(n: number): string {
  return n.toString(2)
}

/**
 * Converts a number to a hexadecimal string, with no `0x` prefix (Python `hex` has one).
 * @param n The given number.
 * @returns The hexadecimal string representation of `n`.
 */
export function hex(n: number): string {
  return n.toString(16)
}

/**
 * Converts a number to an octal string, with no `0o` prefix (Python `oct` has one).
 * @param n The given number.
 * @returns The octal string representation of `n`.
 */
export function oct(n: number): string {
  return n.toString(8)
}

/**
 * Returns a floating point number constructed from a number or string `x`. Reads a leading number
 * like `parseFloat`, so `float('1.5x')` is `1.5` where Python `float` raises `ValueError`.
 * @param x The number or string.
 * @returns A floating point number parsed from the given value or `NaN`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseFloat parseFloat}
 */
export function float(x: string): number {
  return parseFloat(x)
}

/**
 * Returns an integer number constructed from a number or string `x`. Reads a leading integer like
 * `parseInt`, so `int('12abc')` is `12` where Python `int` raises `ValueError`.
 * @param x The number or string.
 * @param base Radix for string parsing (default 10). Ignored when `x` is a number.
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
  if (Array.isArray(value)) {
    assertNotHugeSparse(value)
    return (value as T[]).slice()
  }
  const out: T[] = []
  for (const x of value) out.push(x)
  return out
}

/**
 * Retrieve the next item from the iterator by calling its `next()` method.
 * When the iterator is done, returns `dflt` (the iterator return value is ignored).
 * @param it The iterator.
 * @param dflt Default when done.
 * @returns The next value from the iterator, or `dflt`.
 */
export function next<T, D = undefined>(it: Iterator<T>, dflt?: D): T | D {
  const r = it.next()
  if (r.done) return dflt as D
  return r.value
}
