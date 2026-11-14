/**
 * New objects from old ones: `flattenObject`, `invert`, `mapKeys`, `mapValues`.
 */

import { isPlainObject } from '../is/isPlainObject.ts'
import { isCanonicalArrayIndex } from '../internal/sparse.ts'
import { truncateForError } from '../internal/truncate.ts'
import { Ancestors, guardDepth, RevisitBudget } from '../internal/walk.ts'
import { writeKey } from './parsePath.ts'

const FLATTEN_BUDGET = 250_000
const MAX_KEY_CHARS = 2 ** 27

/** Options of {@link flattenObject}. */
export interface FlattenOptions {
  /** What joins the keys of nested objects; `'.'` by default. Array indices are written `[0]`. */
  delimiter?: string
}

interface Frame {
  readonly obj: object
  readonly prefix: string
  readonly keys: string[]
  index: number
}

/**
 * A one-level object whose keys are the paths to the leaves of `obj`: nested plain-object keys
 * joined by `delimiter`, array elements as `[index]`, so with the default delimiter every key is a
 * path {@link get} reads. An own key of an array that is not an index (the `index` of a RegExp
 * match) is joined by `delimiter` like an object key. A leaf is any value that is not a plain object
 * or array (`null`, a `Date` and class instances included); empty containers give no key.
 * @param obj A plain object or array.
 * @param options `delimiter`, `'.'` by default.
 * @returns A new plain object.
 * @throws {TypeError} when `delimiter` is not a non-empty string, or `obj` is not a plain object or
 * array; for a cycle; for a key that is empty or holds the delimiter, `[` or `]`, since its path
 * would read as another one; and when two paths flatten to the same key (a delimiter of several
 * characters can join different keys alike), which is the same unrepresentable-key case.
 * @throws {RangeError} past 1000 levels of nesting, when shared objects repeat past 250000 units
 * of work, or for output keys over 2^27 characters in all.
 * @example
 * ```ts
 * flattenObject({ a: { b: 1, c: [2, { d: 3 }] } }) // { 'a.b': 1, 'a.c[0]': 2, 'a.c[1].d': 3 }
 * flattenObject({ a: { b: 1 } }, { delimiter: '/' }) // { 'a/b': 1 }
 * ```
 */
export function flattenObject(obj: object, options: FlattenOptions = {}): Record<string, unknown> {
  const delimiter = options.delimiter ?? '.'
  if (typeof delimiter !== 'string' || delimiter === '') {
    throw new TypeError('delimiter must be a non-empty string')
  }
  if (!Array.isArray(obj) && !isPlainObject(obj)) {
    throw new TypeError('flattenObject takes a plain object or array')
  }
  return guardDepth(() => {
    const out: Record<string, unknown> = {}
    const ancestors = new Ancestors()
    const budget = new RevisitBudget(
      FLATTEN_BUDGET,
      `input repeats shared objects beyond ${String(FLATTEN_BUDGET)} containers`
    )
    const stack: Frame[] = []
    let chars = 0
    const emit = (key: string, value: unknown): void => {
      chars += key.length
      if (chars > MAX_KEY_CHARS)
        throw new RangeError(`output keys exceed ${String(MAX_KEY_CHARS)} characters`)
      if (Object.hasOwn(out, key))
        throw new TypeError(`two paths flatten to ${truncateForError(key)}`)
      writeKey(out, key, value)
    }
    const open = (container: object, prefix: string): void => {
      if (ancestors.has(container)) throw new TypeError(`cycle at ${truncateForError(prefix)}`)
      const keys = Object.keys(container)
      budget.note(container, keys.length)
      ancestors.enter(container)
      stack.push({ obj: container, prefix, keys, index: 0 })
    }
    try {
      open(obj, '')
      while (stack.length > 0) {
        const frame = stack[stack.length - 1]
        if (frame.index >= frame.keys.length) {
          stack.pop()
          ancestors.leave(frame.obj)
          continue
        }
        const key = frame.keys[frame.index++]
        const isIndex = Array.isArray(frame.obj) && isCanonicalArrayIndex(key)
        if (
          !isIndex &&
          (key === '' || key.includes(delimiter) || key.includes('[') || key.includes(']'))
        ) {
          throw new TypeError(`flattenObject cannot represent the key ${truncateForError(key)}`)
        }
        const path = isIndex
          ? `${frame.prefix}[${key}]`
          : frame.prefix
            ? frame.prefix + delimiter + key
            : key
        const child = (frame.obj as Record<string, unknown>)[key]
        if (Array.isArray(child) || isPlainObject(child)) open(child, path)
        else emit(path, child)
      }
      return out
    } finally {
      // A throw leaves frames open; leave them so a walk this one runs inside keeps its depth count.
      for (let i = stack.length - 1; i >= 0; i--) ancestors.leave(stack[i].obj)
    }
  })
}

/**
 * A new object whose keys are the values of `obj` and whose values are its keys, as lodash's
 * `invert` builds it; a later key wins when two values are the same. A primitive value becomes a
 * key as property keys do, so `1` and `'1'` are one key, and a symbol stays a symbol key.
 * @param obj The object to read; its own enumerable string keys. `null` and `undefined` give `{}`.
 * @returns A new plain object.
 * @throws {TypeError} for a value that is an object or a function, since turning it into a key
 * would call its own `toString`.
 * @example
 * ```ts
 * invert({ a: 'x', b: 'y' }) // { x: 'a', y: 'b' }
 * ```
 */
export function invert(obj: object | null | undefined): Record<PropertyKey, string> {
  const out: Record<PropertyKey, string> = {}
  if (obj === null || obj === undefined) return out
  for (const [key, value] of Object.entries(obj)) {
    if ((typeof value === 'object' && value !== null) || typeof value === 'function') {
      throw new TypeError(`invert cannot make a key of the value at ${truncateForError(key)}`)
    }
    writeKey(out, typeof value === 'symbol' ? value : String(value), key)
  }
  return out
}

/**
 * A new object with the values of `obj` under the keys `keyOf` returns.
 * @param obj The object to read; its own enumerable string keys. `null` and `undefined` give `{}`.
 * @param keyOf Called with `(value, key, obj)`; returns the new key.
 * @returns A new plain object; a later entry wins when two keys are the same.
 * @example
 * ```ts
 * mapKeys({ a: 1, b: 2 }, (_value, key) => key.toUpperCase()) // { A: 1, B: 2 }
 * ```
 */
export function mapKeys<V, K extends PropertyKey>(
  obj: readonly V[] | null | undefined,
  keyOf: (value: V, key: string, obj: readonly V[]) => K
): Record<K, V>
/** {@link mapKeys} for an object: `keyOf` gets each own enumerable string key and its value. */
export function mapKeys<T extends object, K extends PropertyKey>(
  obj: T | null | undefined,
  keyOf: (value: T[keyof T], key: keyof T & string, obj: T) => K
): Record<K, T[keyof T]>
export function mapKeys(
  obj: object | null | undefined,
  keyOf: (value: never, key: never, obj: never) => PropertyKey
): Record<PropertyKey, unknown> {
  const out: Record<PropertyKey, unknown> = {}
  if (obj === null || obj === undefined) return out
  const keyOfEntry = keyOf as (value: unknown, key: string, obj: object) => PropertyKey
  const record = obj as Record<string, unknown>
  for (const key of Object.keys(record)) {
    const value = record[key]
    writeKey(out, keyOfEntry(value, key, obj), value)
  }
  return out
}

/**
 * A new object with the keys of `obj` and the values `valueOf` returns, as lodash's `mapValues`
 * builds it. For an array the result is a plain object keyed by index, not an array.
 * @param obj The object to read; its own enumerable string keys. `null` and `undefined` give `{}`.
 * @param valueOf Called with `(value, key, obj)`; returns the new value.
 * @returns A new plain object.
 * @example
 * ```ts
 * mapValues({ a: 1, b: 2 }, (value) => value * 10) // { a: 10, b: 20 }
 * ```
 */
export function mapValues<V, R>(
  obj: readonly V[] | null | undefined,
  valueOf: (value: V, key: string, obj: readonly V[]) => R
): Record<number, R>
/** {@link mapValues} for an object: the result keeps its own enumerable string keys. */
export function mapValues<T extends object, R>(
  obj: T | null | undefined,
  valueOf: (value: T[keyof T], key: keyof T & string, obj: T) => R
): { [K in keyof T as K extends symbol ? never : K]: R }
export function mapValues(
  obj: object | null | undefined,
  valueOf: (value: never, key: never, obj: never) => unknown
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (obj === null || obj === undefined) return out
  const valueOfEntry = valueOf as (value: unknown, key: string, obj: object) => unknown
  const record = obj as Record<string, unknown>
  for (const key of Object.keys(record)) {
    writeKey(out, key, valueOfEntry(record[key], key, obj))
  }
  return out
}
