/**
 * What a collection holds: `keys`, `values`, `entries`, `size`, `isEmpty`, `includes`.
 */

import { isMap, isSet, mapSize, setSize, typedArrayLength } from '../internal/kind.ts'
import { type Collection, type CollectionKey, type CollectionValue, eachEntry } from './shape.ts'

/**
 * The keys of `collection`: indices of an array (holes skipped), typed array, string (one per code
 * point) or other iterable, the keys of a `Map`, the members of a `Set`, and the own enumerable
 * string keys of any other object. `null`, `undefined`, numbers, booleans, bigints and symbols
 * have none. Other iterables are consumed to obtain positions.
 * @param collection The collection to read.
 * @returns A new array of keys, in iteration order.
 * @example
 * ```ts
 * keys({ a: 1, b: 2 }) // ['a', 'b']
 * keys(new Map([['x', 1]])) // ['x']
 * keys('héllo') // [0, 1, 2, 3, 4]
 * ```
 */
export function keys<C extends Collection>(collection: C): CollectionKey<C>[] {
  const out: unknown[] = []
  eachEntry(collection, (_value, key) => {
    out.push(key)
  })
  return out as CollectionKey<C>[]
}

/**
 * The values of `collection`, in the order {@link keys} gives their keys.
 * @param collection The collection to read.
 * @returns A new array of values.
 * @example
 * ```ts
 * values({ a: 1, b: 2 }) // [1, 2]
 * values(new Map([['x', 1]])) // [1]
 * values('👍🏽!') // ['👍', '🏽', '!']
 * ```
 */
export function values<C extends Collection>(collection: C): CollectionValue<C>[] {
  const out: unknown[] = []
  eachEntry(collection, (value) => {
    out.push(value)
  })
  return out as CollectionValue<C>[]
}

/**
 * The `[key, value]` pairs of `collection`, as `Map.prototype.entries` gives them.
 * @param collection The collection to read.
 * @returns A new array of pairs.
 * @example
 * ```ts
 * entries({ a: 1 }) // [['a', 1]]
 * entries(['x', 'y']) // [[0, 'x'], [1, 'y']]
 * entries(new Set(['s'])) // [['s', 's']]
 * ```
 */
export function entries<C extends Collection>(
  collection: C
): [CollectionKey<C>, CollectionValue<C>][] {
  const out: [unknown, unknown][] = []
  eachEntry(collection, (value, key) => {
    out.push([key, value])
  })
  return out as [CollectionKey<C>, CollectionValue<C>][]
}

/**
 * How many entries `collection` has: the `size` of a `Map` or `Set`, the present elements of an
 * array (holes do not count), the length of a typed array, the code points of a string, the own
 * enumerable string keys of an object. An iterable that is none of these is read to its end to
 * count it, so a one-shot iterator such as a generator is exhausted.
 * @param collection The collection to measure.
 * @returns The number of entries.
 * @example
 * ```ts
 * size({ a: 1, b: 2 }) // 2
 * size([1, , 3]) // 2
 * size('👍🏽') // 2
 * ```
 */
export function size(collection: Collection): number {
  if (isMap(collection)) return mapSize(collection)
  if (isSet(collection)) return setSize(collection)
  if (typeof collection === 'object' && collection !== null) {
    const length = typedArrayLength(collection)
    if (length !== undefined) return length
  }
  let n = 0
  eachEntry(collection, () => {
    n++
  })
  return n
}

/**
 * True when `collection` has no entries, by the rules of {@link size}. An iterable is read only
 * until its first element, and is then closed, so a one-shot iterator such as a generator has
 * nothing left to give.
 * @param collection The collection to test.
 * @returns Whether it has no entries.
 * @example
 * ```ts
 * isEmpty({}) // true
 * isEmpty([, ,]) // true
 * isEmpty(new Map([[1, 2]])) // false
 * isEmpty(null) // true
 * ```
 */
export function isEmpty(collection: Collection): boolean {
  return !eachEntry(collection, () => true)
}

/**
 * True when `collection` holds `value`, compared with SameValueZero against its values (`NaN`
 * finds `NaN`, `0` finds `-0`). For a string, `value` is a substring, as
 * `String.prototype.includes` reads it. An iterable is read until the first match, where it is
 * closed, or to its end, so a one-shot iterator such as a generator is used up either way.
 * @param collection The collection to search.
 * @param value The value to look for.
 * @returns Whether it is there.
 * @example
 * ```ts
 * includes({ a: 1 }, 1) // true
 * includes(new Map([['k', NaN]]), NaN) // true
 * includes('hello', 'ell') // true
 * ```
 */
export function includes<C extends Collection>(
  collection: C,
  value: C extends string ? string : CollectionValue<C>
): boolean {
  if (typeof collection === 'string') return collection.includes(value as string)
  if (isSet(collection)) return Set.prototype.has.call(collection, value)
  return eachEntry(collection, (v) => v === value || (v !== v && value !== value))
}
