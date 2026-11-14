/**
 * Grouping and ordering by key: `groupBy`, `countBy`, `keyBy`, `partition`, `sortBy`, `orderBy`,
 * `minBy`, `maxBy`, `sumBy`, `meanBy`.
 */

import { isNil } from '../is/isNil.ts'
import { compareKeys, type KeyKind, keyKind } from './order.ts'
import {
  type Collection,
  type CollectionCallback,
  type CollectionKey,
  type CollectionValue,
  eachEntry
} from './shape.ts'

type Callback = (value: unknown, key: unknown, collection: unknown) => unknown

/** A key a key helper can order: a number, a bigint, a string, or `null` / `undefined` (last). */
export type SortKey = number | bigint | string | null | undefined

/**
 * The values of `collection` grouped under the key `keyOf` returns for each, in a
 * `null`-prototype object, as `Object.groupBy` builds it.
 * @param collection The collection to group.
 * @param keyOf Returns the group key of one entry.
 * @returns An object from each key to its values, in order of first appearance.
 * @example
 * ```ts
 * groupBy([6.1, 4.2, 6.3], (n) => Math.floor(n)) // { 4: [4.2], 6: [6.1, 6.3] }
 * ```
 */
export function groupBy<C extends Collection, K extends PropertyKey>(
  collection: C,
  keyOf: CollectionCallback<C, K>
): Partial<Record<K, CollectionValue<C>[]>> {
  const fn = keyOf as Callback
  const out = Object.create(null) as Record<PropertyKey, unknown[]>
  eachEntry(collection, (value, key) => {
    const group = fn(value, key, collection) as PropertyKey
    ;(out[group] ??= []).push(value)
  })
  return out as Partial<Record<K, CollectionValue<C>[]>>
}

/**
 * How many values of `collection` fall under each key `keyOf` returns, in a `null`-prototype
 * object.
 * @param collection The collection to count.
 * @param keyOf Returns the key of one entry.
 * @returns An object from each key to its count.
 * @example
 * ```ts
 * countBy(['one', 'two', 'three'], (s) => s.length) // { 3: 2, 5: 1 }
 * ```
 */
export function countBy<C extends Collection, K extends PropertyKey>(
  collection: C,
  keyOf: CollectionCallback<C, K>
): Partial<Record<K, number>> {
  const fn = keyOf as Callback
  const out = Object.create(null) as Record<PropertyKey, number>
  eachEntry(collection, (value, key) => {
    const group = fn(value, key, collection) as PropertyKey
    out[group] = (out[group] ?? 0) + 1
  })
  return out as Partial<Record<K, number>>
}

/**
 * The values of `collection` under the key `keyOf` returns for each, in a `null`-prototype
 * object; a later value replaces an earlier one with the same key.
 * @param collection The collection to index.
 * @param keyOf Returns the key of one entry.
 * @returns An object from each key to the last value with it.
 * @example
 * ```ts
 * keyBy([{ id: 'a', n: 1 }], (row) => row.id) // { a: { id: 'a', n: 1 } }
 * ```
 */
export function keyBy<C extends Collection, K extends PropertyKey>(
  collection: C,
  keyOf: CollectionCallback<C, K>
): Partial<Record<K, CollectionValue<C>>> {
  const fn = keyOf as Callback
  const out = Object.create(null) as Record<PropertyKey, unknown>
  eachEntry(collection, (value, key) => {
    out[fn(value, key, collection) as PropertyKey] = value
  })
  return out as Partial<Record<K, CollectionValue<C>>>
}

/**
 * The values of `collection` split into those `predicate` passes and those it fails.
 * @param collection The collection to split.
 * @param predicate Tests one entry.
 * @returns `[pass, fail]`, each in order.
 * @example
 * ```ts
 * partition([1, 2, 3, 4], (n) => n % 2 === 0) // [[2, 4], [1, 3]]
 * ```
 */
export function partition<C extends Collection, S extends CollectionValue<C>>(
  collection: C,
  predicate: (value: CollectionValue<C>, key: CollectionKey<C>, collection: C) => value is S
): [pass: S[], fail: Exclude<CollectionValue<C>, S>[]]
/** {@link partition} with a predicate that is not a type guard. */
export function partition<C extends Collection>(
  collection: C,
  predicate: CollectionCallback<C, unknown>
): [pass: CollectionValue<C>[], fail: CollectionValue<C>[]]
export function partition<C extends Collection>(
  collection: C,
  predicate: CollectionCallback<C, unknown>
): [pass: CollectionValue<C>[], fail: CollectionValue<C>[]] {
  const fn = predicate as Callback
  const pass: unknown[] = []
  const fail: unknown[] = []
  eachEntry(collection, (value, key) => {
    ;(fn(value, key, collection) ? pass : fail).push(value)
  })
  return [pass, fail] as [CollectionValue<C>[], CollectionValue<C>[]]
}

/** `'asc'` or `'desc'`: the direction {@link orderBy} sorts one key in. */
export type SortOrder = 'asc' | 'desc'

function directionsOf(keyCount: number, orders: readonly unknown[]): (1 | -1)[] {
  if (!Array.isArray(orders)) throw new TypeError('orders must be an array of sort orders')
  if (orders.length > keyCount)
    throw new TypeError(`${orders.length} sort orders given for ${keyCount} key functions`)
  for (const order of orders) {
    if (order !== 'asc' && order !== 'desc')
      throw new TypeError(`unknown sort order ${String(order)}`)
  }
  return Array.from({ length: keyCount }, (_unused, i) => (orders[i] === 'desc' ? -1 : 1))
}

function sortEntries(
  collection: unknown,
  keyFns: readonly unknown[],
  orders: readonly unknown[]
): unknown[] {
  const directions = directionsOf(keyFns.length, orders)
  const kinds: (KeyKind | undefined)[] = []
  const rows: { value: unknown; keys: unknown[] }[] = []
  eachEntry(collection, (value, key) => {
    const keys = keyFns.map((fn, i) => {
      const k = (fn as Callback)(value, key, collection)
      if (!isNil(k)) {
        const kind = keyKind(k)
        if (kinds[i] === undefined) kinds[i] = kind
        else if (kinds[i] !== kind)
          throw new TypeError('cannot order a string key against a number key')
      }
      return k
    })
    rows.push({ value, keys })
  })
  rows.sort((x, y) => {
    for (let i = 0; i < directions.length; i++) {
      const c = compareKeys(x.keys[i], y.keys[i], directions[i])
      if (c !== 0) return c
    }
    return 0
  })
  return rows.map((row) => row.value)
}

/**
 * The values of `collection` in ascending order of the keys `keyOf` returns, compared with the
 * default key order: numbers and bigints by value, strings by UTF-16 code units, `null` and
 * `undefined` last. The sort is stable, and several key functions break ties in turn.
 * @param collection The collection to sort.
 * @param keyOf One key function, or a list of them.
 * @returns A new sorted array.
 * @throws {RangeError} when a key is `NaN`.
 * @throws {TypeError} when a key is a string against a number, or of any other type.
 * @example
 * ```ts
 * sortBy([{ n: 2 }, { n: 1 }], (row) => row.n) // [{ n: 1 }, { n: 2 }]
 * ```
 */
export function sortBy<C extends Collection>(
  collection: C,
  keyOf: CollectionCallback<C, SortKey> | readonly CollectionCallback<C, SortKey>[]
): CollectionValue<C>[] {
  const fns: readonly unknown[] = Array.isArray(keyOf) ? keyOf : [keyOf]
  return sortEntries(collection, fns, []) as CollectionValue<C>[]
}

/**
 * {@link sortBy} with a direction per key: `orders[i]` is `'asc'` (the default) or `'desc'` for
 * `keyOf[i]`. `null` and `undefined` keys stay last in either direction.
 * @param collection The collection to sort.
 * @param keyOf The key functions, in priority order.
 * @param orders The direction of each key.
 * @returns A new sorted array.
 * @throws {TypeError} when `keyOf` or `orders` is not an array, for an unknown order or more
 *   orders than key functions, or for a key {@link sortBy} cannot order.
 * @throws {RangeError} when a key is `NaN`.
 * @example
 * ```ts
 * const users = [{ name: 'b', age: 1 }, { name: 'a', age: 2 }, { name: 'b', age: 3 }]
 * orderBy(users, [(u) => u.name, (u) => u.age], ['asc', 'desc'])
 * // [{ name: 'a', age: 2 }, { name: 'b', age: 3 }, { name: 'b', age: 1 }]
 * ```
 */
export function orderBy<C extends Collection>(
  collection: C,
  keyOf: readonly CollectionCallback<C, SortKey>[],
  orders: readonly SortOrder[] = []
): CollectionValue<C>[] {
  if (!Array.isArray(keyOf)) throw new TypeError('keyOf must be an array of key functions')
  return sortEntries(collection, keyOf, orders) as CollectionValue<C>[]
}

function extremum(collection: unknown, keyOf: Callback, direction: 1 | -1): unknown {
  let best: unknown
  let bestKey: unknown
  eachEntry(collection, (value, key) => {
    const k = keyOf(value, key, collection)
    if (isNil(k)) return
    keyKind(k)
    if (bestKey === undefined || compareKeys(k, bestKey, direction) < 0) {
      best = value
      bestKey = k
    }
  })
  return best
}

/**
 * The value of `collection` with the smallest key, by the default key order; the first one on a
 * tie. Entries whose key is `null` or `undefined` are skipped.
 * @param collection The collection to search.
 * @param keyOf Returns the key of one entry.
 * @returns The value found, or `undefined` when no entry has a key.
 * @throws {RangeError} for a `NaN` key; {@link sortBy} lists the `TypeError` cases.
 * @example
 * ```ts
 * minBy([{ n: 2 }, { n: 1 }], (row) => row.n) // { n: 1 }
 * ```
 */
export function minBy<C extends Collection>(
  collection: C,
  keyOf: CollectionCallback<C, SortKey>
): CollectionValue<C> | undefined {
  return extremum(collection, keyOf as Callback, 1) as CollectionValue<C> | undefined
}

/**
 * The value of `collection` with the largest key, by the default key order; the first one on a
 * tie. Entries whose key is `null` or `undefined` are skipped.
 * @param collection The collection to search.
 * @param keyOf Returns the key of one entry.
 * @returns The value found, or `undefined` when no entry has a key.
 * @throws {RangeError} for a `NaN` key; {@link sortBy} lists the `TypeError` cases.
 * @example
 * ```ts
 * maxBy({ a: 3, b: 7 }, (n) => n) // 7
 * ```
 */
export function maxBy<C extends Collection>(
  collection: C,
  keyOf: CollectionCallback<C, SortKey>
): CollectionValue<C> | undefined {
  return extremum(collection, keyOf as Callback, -1) as CollectionValue<C> | undefined
}

function total(collection: unknown, valueOf: Callback): [sum: number, count: number] {
  let sum = 0
  let count = 0
  eachEntry(collection, (value, key) => {
    const n = valueOf(value, key, collection)
    if (typeof n !== 'number') throw new TypeError(`expected a number, got ${typeof n}`)
    sum += n
    count++
  })
  return [sum, count]
}

/**
 * The sum of the numbers `valueOf` returns for the entries of `collection`; `0` when empty.
 * @param collection The collection to add up.
 * @param valueOf Returns the number of one entry.
 * @returns The sum.
 * @throws {TypeError} when `valueOf` returns anything but a number.
 * @example
 * ```ts
 * sumBy([{ n: 4 }, { n: 2 }], (row) => row.n) // 6
 * ```
 */
export function sumBy<C extends Collection>(
  collection: C,
  valueOf: CollectionCallback<C, number>
): number {
  return total(collection, valueOf as Callback)[0]
}

/**
 * The mean of the numbers `valueOf` returns for the entries of `collection`; `NaN` when empty.
 * @param collection The collection to average.
 * @param valueOf Returns the number of one entry.
 * @returns The mean.
 * @throws {TypeError} when `valueOf` returns anything but a number.
 * @example
 * ```ts
 * meanBy([{ n: 4 }, { n: 2 }], (row) => row.n) // 3
 * ```
 */
export function meanBy<C extends Collection>(
  collection: C,
  valueOf: CollectionCallback<C, number>
): number {
  const [sum, count] = total(collection, valueOf as Callback)
  return sum / count
}
