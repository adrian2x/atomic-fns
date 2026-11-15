/**
 * Copies with some keys: `pick`, `omit`, `pickBy`, `omitBy`.
 */

import { isPlainObject } from '../is/isPlainObject.ts'
import { enumerableKeys, isEnumerable } from '../internal/keys.ts'
import { assertNotHugeSparse, isCanonicalArrayIndex, walkArrayIndices } from '../internal/sparse.ts'
import { enterDepth, exitDepth, guardDepth } from '../internal/walk.ts'
import { type Path, parsePath, writeKey } from './parsePath.ts'
import { reachesPrototype } from './path.ts'

/** One path or a list of them; in a list, each entry is a path or a single key. */
export type Paths = string | readonly (Path | PropertyKey)[]

/**
 * Keys for the precise {@link pick}/{@link omit} overloads, excluding arrays, index
 * signatures, and string keys containing path syntax (`.`, `[` or `]`).
 */
export type PlainKey<T> = T extends readonly unknown[]
  ? never
  : string extends keyof T
    ? never
    : number extends keyof T
      ? never
      : symbol extends keyof T
        ? never
        : Exclude<keyof T, `${string}${'.' | '[' | ']'}${string}`>

/**
 * What {@link pickBy} and {@link omitBy} return: a plain object, so an array's elements come back
 * under their index keys.
 */
export type PickedBy<T> = T extends readonly unknown[] ? Record<string, T[number]> : Partial<T>

function toPathList(paths: Paths): PropertyKey[][] {
  if (typeof paths === 'string') return [parsePath(paths)]
  if (!Array.isArray(paths))
    throw new TypeError(`expected a path or a list of paths, got ${typeof paths}`)
  assertNotHugeSparse(paths as unknown[])
  return Array.from(paths as readonly unknown[], (path) =>
    typeof path === 'string' || Array.isArray(path)
      ? parsePath(path as Path)
      : parsePath([path as PropertyKey])
  )
}

interface Trie {
  kids?: Map<PropertyKey, Trie>
  /** A path ends here. */
  leaf?: boolean
  /** The output node built for this trie node, by `pick`. */
  out?: object
}

function nodeAt(root: Trie, parts: readonly PropertyKey[]): Trie {
  let node = root
  for (const part of parts) {
    node.kids ??= new Map()
    let next = node.kids.get(part)
    if (next === undefined) {
      next = {}
      node.kids.set(part, next)
    }
    node = next
  }
  return node
}

/**
 * A new object with the values at `paths` in `obj`. Each path is read as {@link has} reads it:
 * own properties only, never through a prototype-reaching segment, and a path that is missing is
 * left out. The containers on the way are new, arrays where the source has an array and the next
 * segment is an index; the values at the end of each path are the source's own, not copies.
 * Tuples of individual plain keys have precise result types; union keys and index signatures
 * keep partial results.
 * @param obj The object to read.
 * @param paths A path, or a list of paths or keys.
 * @returns A new object.
 * @throws {TypeError} for a malformed path.
 * @example
 * ```ts
 * pick({ a: 1, b: 2, c: 3 }, ['a', 'c']) // { a: 1, c: 3 }
 * pick({ a: { b: 1, c: 2 } }, 'a.b') // { a: { b: 1 } }
 * pick({ list: [{ id: 1, x: 2 }] }, ['list[0].id']) // { list: [{ id: 1 }] }
 * ```
 */
export function pick<T extends object, const P extends readonly PlainKey<T>[]>(
  obj: T &
    (T extends readonly unknown[]
      ? never
      : string extends keyof T
        ? never
        : number extends keyof T
          ? never
          : symbol extends keyof T
            ? never
            : unknown),
  paths: P
): number extends P['length']
  ? Partial<Pick<T, P[number]>>
  : true extends {
        [I in keyof P]: P[I][] extends { [K in P[I]]: K[] }[P[I]] ? false : true
      }[number]
    ? Partial<T>
    : Pick<T, P[number]>
/** {@link pick} with paths or keys that cannot determine an exact set of properties. */
export function pick<T>(obj: T, paths: Paths): Partial<T>
export function pick<T>(obj: T, paths: Paths): Partial<T> {
  const list = toPathList(paths)
  const root: Trie = { out: {} }
  pathLoop: for (const parts of list) {
    if (parts.length === 0) continue
    let src: unknown = obj
    let node = root
    /** `nodes[i]` is the trie node for `parts[i]`, `sources[i]` the container it is read from. */
    const nodes: Trie[] = []
    const sources: unknown[] = []
    for (const key of parts) {
      sources.push(src)
      node = nodeAt(node, [key])
      nodes.push(node)
      if (node.leaf || src === null || src === undefined) continue pathLoop
      const base = Object(src) as object
      if (reachesPrototype(base, key) || !Object.hasOwn(base, key)) continue pathLoop
      src = (base as Record<PropertyKey, unknown>)[key]
    }
    node.leaf = true
    let parent = root
    for (let i = 0; i < parts.length - 1; i++) {
      const child = nodes[i]
      if (child.out === undefined) {
        const next = parts[i + 1]
        const index = typeof next === 'string' && isCanonicalArrayIndex(next)
        child.out = Array.isArray(sources[i + 1]) && index ? [] : {}
        writeKey(parent.out as object, parts[i], child.out)
      }
      parent = child
    }
    writeKey(parent.out as object, parts[parts.length - 1], src)
  }
  return root.out as Partial<T>
}

/** An array whose prototype is `Array.prototype` of this realm or of another one: not a subclass. */
function isUnsubclassedArray(x: unknown): x is unknown[] {
  if (!Array.isArray(x)) return false
  const proto: unknown = Object.getPrototypeOf(x)
  return (
    proto === Array.prototype ||
    (Array.isArray(proto) && isPlainObject(Object.getPrototypeOf(proto)))
  )
}

/** An own `toJSON` function or accessor, which a copy would lose or keep bound to the source. */
function hasOwnToJSON(x: object): boolean {
  const desc = Object.getOwnPropertyDescriptor(x, 'toJSON')
  if (desc === undefined) return false
  return desc.get !== undefined || desc.set !== undefined || typeof desc.value === 'function'
}

function isOmitContainer(x: unknown): x is object {
  return (isUnsubclassedArray(x) || isPlainObject(x)) && !hasOwnToJSON(x)
}

function omitIn(value: object, trie: Trie): object {
  enterDepth()
  try {
    let out: object
    let keys: (string | symbol)[]
    if (Array.isArray(value)) {
      const array: unknown[] = []
      array.length = value.length
      walkArrayIndices(value, (event) => {
        if (event.kind !== 'index') return
        const child = trie.kids?.get(String(event.index))
        if (child?.leaf) return
        const element = value[event.index]
        array[event.index] = child?.kids ? omitStep(element, child) : element
      })
      out = array
      keys = Object.getOwnPropertySymbols(value).filter((key) => isEnumerable(value, key))
    } else {
      out = Object.getPrototypeOf(value) === null ? Object.create(null) : {}
      keys = enumerableKeys(value)
    }
    const record = value as Record<PropertyKey, unknown>
    for (const key of keys) {
      const child = trie.kids?.get(key)
      if (child?.leaf) continue
      writeKey(out, key, child?.kids ? omitStep(record[key], child) : record[key])
    }
    return out
  } finally {
    exitDepth()
  }
}

function omitStep(value: unknown, trie: Trie): unknown {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value
  if (!isOmitContainer(value)) throw new TypeError('omit cannot copy a non-plain object')
  return omitIn(value, trie)
}

/**
 * A copy of `obj` without the values at `paths`. Copies own enumerable string and symbol keys
 * of an object; the elements and own enumerable symbol keys of an array. The plain objects and
 * arrays along each path are copied too, so `obj` is never changed; every other value is kept by
 * reference. A null-prototype object copies to a null-prototype object.
 * Tuples of individual plain keys have precise result types; union keys and index signatures
 * keep partial results.
 * @param obj A plain object or array.
 * @param paths A path, or a list of paths or keys.
 * @returns A new plain object or array.
 * @throws {TypeError} when `obj`, or a value a path walks into, is not a plain object or array, or
 * has its own `toJSON` function or accessor: copying a class instance into a plain object would
 * lose its prototype, and a copy would lose or misbind any `toJSON` that hides fields.
 * @throws {RangeError} for a path more than 1000 levels deep.
 * @example
 * ```ts
 * omit({ a: 1, b: 2, c: 3 }, ['a', 'c']) // { b: 2 }
 * omit({ user: { name: 'a', password: 'p' } }, 'user.password') // { user: { name: 'a' } }
 * ```
 */
export function omit<T extends object, const P extends readonly PlainKey<T>[]>(
  obj: T &
    (T extends readonly unknown[]
      ? never
      : string extends keyof T
        ? never
        : number extends keyof T
          ? never
          : symbol extends keyof T
            ? never
            : unknown),
  paths: P
): number extends P['length']
  ? Partial<Omit<T, P[number]>>
  : true extends {
        [I in keyof P]: P[I][] extends { [K in P[I]]: K[] }[P[I]] ? false : true
      }[number]
    ? Partial<T>
    : Omit<T, P[number]>
/** {@link omit} with paths or keys that cannot determine an exact set of properties. */
export function omit<T extends object>(obj: T | null | undefined, paths: Paths): Partial<T>
export function omit<T extends object>(obj: T | null | undefined, paths: Paths): Partial<T> {
  const list = toPathList(paths)
  if (obj === null || obj === undefined) return {} as Partial<T>
  if (!isOmitContainer(obj)) throw new TypeError('omit takes a plain object or array')
  const trie: Trie = {}
  for (const parts of list) if (parts.length > 0) nodeAt(trie, parts).leaf = true
  return guardDepth(() => omitIn(obj, trie)) as Partial<T>
}

/**
 * A new plain object with the own enumerable string keys of `obj` for which `predicate` is truthy.
 * @param obj The object to read.
 * @param predicate Called with `(value, key, obj)`.
 * @returns A new object.
 * @example
 * ```ts
 * pickBy({ a: 1, b: '2', c: 3 }, (value) => typeof value === 'number') // { a: 1, c: 3 }
 * ```
 */
export function pickBy<T extends object>(
  obj: T | null | undefined,
  predicate: (value: T[keyof T], key: keyof T & string, obj: T) => unknown
): PickedBy<T> {
  const out = {} as PickedBy<T>
  if (obj === null || obj === undefined) return out
  const record = obj as Record<string, unknown>
  for (const key of Object.keys(record)) {
    const value = record[key]
    if (predicate(value as T[keyof T], key as keyof T & string, obj)) writeKey(out, key, value)
  }
  return out
}

/**
 * A new plain object with the own enumerable string keys of `obj` for which `predicate` is falsy:
 * the complement of {@link pickBy}.
 * @param obj The object to read.
 * @param predicate Called with `(value, key, obj)`.
 * @returns A new object.
 * @example
 * ```ts
 * omitBy({ a: 1, b: undefined }, (value) => value === undefined) // { a: 1 }
 * ```
 */
export function omitBy<T extends object>(
  obj: T | null | undefined,
  predicate: (value: T[keyof T], key: keyof T & string, obj: T) => unknown
): PickedBy<T> {
  return pickBy(obj, (value, key, all) => !predicate(value, key, all))
}
