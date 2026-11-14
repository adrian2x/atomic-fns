import { isMap, isSet, typedArrayLength } from '../internal/kind.ts'
import { walkArray } from '../internal/sparse.ts'

/** Any value the collection helpers accept: an object, a string, or `null` / `undefined` as empty. */
export type Collection = object | string | null | undefined

/**
 * The key a collection helper passes for `C`: an index for arrays, typed arrays, strings and other
 * iterables, the map key for a `Map`, the value for a `Set`, and an own string key otherwise.
 */
export type CollectionKey<C> = C extends string
  ? number
  : C extends ReadonlyMap<infer K, unknown>
    ? K
    : C extends ReadonlySet<infer V>
      ? V
      : C extends Iterable<unknown>
        ? number
        : C extends object
          ? string
          : never

/**
 * The value a collection helper passes for `C`: an element, a code point, a map value, a set
 * member, or an own property value.
 */
export type CollectionValue<C> = C extends string
  ? string
  : C extends ReadonlyMap<unknown, infer V>
    ? V
    : C extends Iterable<infer V>
      ? V
      : C extends object
        ? [keyof C] extends [never]
          ? unknown
          : C[keyof C]
        : never

const mapEntries = Map.prototype.entries
const setValues = Set.prototype.values

function isIterable(x: object): x is Iterable<unknown> {
  return typeof (x as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function'
}

/** A visitor of `(value, key)`; returning `true` stops the walk. */
export type Visit = (value: unknown, key: unknown) => boolean | undefined | void

/**
 * Visit the present elements of `arr` in index order until `visit` returns `true`; the cost
 * follows the elements, not `length`. Returns whether it stopped early.
 */
export function eachIndex(arr: readonly unknown[], visit: Visit): boolean {
  let stopped = false
  walkArray(arr, (event) => {
    if (event.kind === 'value' && visit(event.value, event.index) === true) {
      stopped = true
      return false
    }
  })
  return stopped
}

/**
 * Visit the entries of `collection` as `(value, key)`, by the shape rules of `fns/collection`,
 * until `visit` returns `true`. Returns whether it stopped early. A number, boolean, bigint or
 * symbol has no entries, as `Object.keys(5)` has none.
 */
export function eachEntry(collection: unknown, visit: Visit): boolean {
  if (collection === null || collection === undefined) return false
  if (typeof collection === 'string') {
    let i = 0
    for (const ch of collection) if (visit(ch, i++) === true) return true
    return false
  }
  if (typeof collection !== 'object' && typeof collection !== 'function') return false
  if (Array.isArray(collection)) return eachIndex(collection, visit)
  const length = typedArrayLength(collection)
  if (length !== undefined) {
    const view = collection as ArrayLike<unknown>
    for (let i = 0; i < length; i++) if (visit(view[i], i) === true) return true
    return false
  }
  if (isMap(collection)) {
    for (const [key, value] of mapEntries.call(collection) as MapIterator<[unknown, unknown]>) {
      if (visit(value, key) === true) return true
    }
    return false
  }
  if (isSet(collection)) {
    for (const value of setValues.call(collection) as SetIterator<unknown>) {
      if (visit(value, value) === true) return true
    }
    return false
  }
  if (isIterable(collection)) {
    let i = 0
    for (const value of collection) if (visit(value, i++) === true) return true
    return false
  }
  const record = collection as Record<string, unknown>
  for (const key of Object.keys(record)) if (visit(record[key], key) === true) return true
  return false
}
