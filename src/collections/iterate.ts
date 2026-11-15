/**
 * Iteration over every shape: `forEach`, `map`, `filter`, `find`, `some`, `reduce` and friends.
 */

import {
  type Collection,
  type CollectionCallback,
  type CollectionKey,
  type CollectionValue,
  eachEntry,
  eachIndex,
  entryList
} from './shape.ts'

type Callback = (value: unknown, key: unknown, collection: unknown) => unknown
type Reducer = (acc: unknown, value: unknown, key: unknown, collection: unknown) => unknown

/**
 * Call `callback` with `(value, key, collection)` for every entry of `collection`, in order. Like
 * the native `forEach`, it visits every entry and ignores what the callback returns; use
 * {@link some}, {@link every} or `for...of` to stop early.
 * @param collection The collection to walk.
 * @param callback Called once per entry.
 * @example
 * ```ts
 * forEach({ a: 1, b: 2 }, (value, key) => console.log(key, value))
 * // a 1
 * // b 2
 * ```
 */
export function forEach<C extends Collection>(
  collection: C,
  callback: CollectionCallback<C, unknown>
): void {
  const fn = callback as Callback
  eachEntry(collection, (value, key) => {
    fn(value, key, collection)
  })
}

/**
 * {@link forEach} from the last entry to the first.
 * @param collection The collection to walk.
 * @param callback Called once per entry.
 * @example
 * ```ts
 * forEachRight([1, 2], (value) => console.log(value))
 * // 2
 * // 1
 * ```
 */
export function forEachRight<C extends Collection>(
  collection: C,
  callback: CollectionCallback<C, unknown>
): void {
  const fn = callback as Callback
  const list = entryList(collection)
  for (let i = list.length - 1; i >= 0; i--) fn(list[i][1], list[i][0], collection)
}

/**
 * The results of `callback` for every entry of `collection`, as an array.
 * @param collection The collection to walk.
 * @param callback Maps one entry.
 * @returns A new array with one result per entry.
 * @example
 * ```ts
 * map({ a: 1, b: 2 }, (value) => value * 2) // [2, 4]
 * map(new Map([['x', 1]]), (value, key) => `${key}=${value}`) // ['x=1']
 * ```
 */
export function map<C extends Collection, R>(
  collection: C,
  callback: CollectionCallback<C, R>
): R[] {
  const fn = callback as Callback
  const out: unknown[] = []
  eachEntry(collection, (value, key) => {
    out.push(fn(value, key, collection))
  })
  return out as R[]
}

/**
 * {@link map}, then one level of flattening, as `Array.prototype.flatMap` does: an array result
 * is spread, anything else is kept as one element.
 * @param collection The collection to walk.
 * @param callback Maps one entry to an array or a value.
 * @returns A new flat array.
 * @example
 * ```ts
 * flatMap({ a: 1, b: 2 }, (value, key) => [key, value]) // ['a', 1, 'b', 2]
 * ```
 */
export function flatMap<C extends Collection, R>(
  collection: C,
  callback: CollectionCallback<C, R | readonly R[]>
): R[] {
  const fn = callback as Callback
  const out: unknown[] = []
  eachEntry(collection, (value, key) => {
    const result = fn(value, key, collection)
    if (Array.isArray(result)) {
      eachIndex(result, (item) => {
        out.push(item)
      })
    } else {
      out.push(result)
    }
  })
  return out as R[]
}

/**
 * The values of `collection` for which `predicate` is truthy, in order.
 * @param collection The collection to walk.
 * @param predicate Tests one entry.
 * @returns A new array of values.
 * @example
 * ```ts
 * filter({ a: 1, b: 2, c: 3 }, (value) => value % 2 === 1) // [1, 3]
 * filter(new Set(['x', 'yy']), (value) => value.length > 1) // ['yy']
 * ```
 */
export function filter<C extends Collection, S extends CollectionValue<C>>(
  collection: C,
  predicate: (value: CollectionValue<C>, key: CollectionKey<C>, collection: C) => value is S
): S[]
/** {@link filter} with a predicate that is not a type guard. */
export function filter<C extends Collection>(
  collection: C,
  predicate: CollectionCallback<C, unknown>
): CollectionValue<C>[]
export function filter<C extends Collection>(
  collection: C,
  predicate: CollectionCallback<C, unknown>
): CollectionValue<C>[] {
  const fn = predicate as Callback
  const out: unknown[] = []
  eachEntry(collection, (value, key) => {
    if (fn(value, key, collection)) out.push(value)
  })
  return out as CollectionValue<C>[]
}

/**
 * The values of `collection` for which `predicate` is falsy: the complement of {@link filter}.
 * @param collection The collection to walk.
 * @param predicate Tests one entry.
 * @returns A new array of values.
 * @example
 * ```ts
 * reject([1, 2, 3], (value) => value > 1) // [1]
 * ```
 */
export function reject<C extends Collection>(
  collection: C,
  predicate: CollectionCallback<C, unknown>
): CollectionValue<C>[] {
  return filter(collection, (value, key, c) => !predicate(value, key, c))
}

/**
 * The first value of `collection` for which `predicate` is truthy, or `undefined`. It stops at
 * that entry, so it works on an endless iterable that has a match.
 * @param collection The collection to search.
 * @param predicate Tests one entry.
 * @returns The value found, or `undefined`.
 * @example
 * ```ts
 * find({ a: 1, b: 2 }, (value) => value > 1) // 2
 * ```
 */
export function find<C extends Collection, S extends CollectionValue<C>>(
  collection: C,
  predicate: (value: CollectionValue<C>, key: CollectionKey<C>, collection: C) => value is S
): S | undefined
/** {@link find} with a predicate that is not a type guard. */
export function find<C extends Collection>(
  collection: C,
  predicate: CollectionCallback<C, unknown>
): CollectionValue<C> | undefined
export function find<C extends Collection>(
  collection: C,
  predicate: CollectionCallback<C, unknown>
): CollectionValue<C> | undefined {
  const fn = predicate as Callback
  let found: unknown
  eachEntry(collection, (value, key) => {
    if (!fn(value, key, collection)) return false
    found = value
    return true
  })
  return found as CollectionValue<C> | undefined
}

/**
 * {@link find} from the last entry to the first.
 * @param collection The collection to search.
 * @param predicate Tests one entry.
 * @returns The value found, or `undefined`.
 * @example
 * ```ts
 * findLast([1, 2, 3], (value) => value < 3) // 2
 * ```
 */
export function findLast<C extends Collection, S extends CollectionValue<C>>(
  collection: C,
  predicate: (value: CollectionValue<C>, key: CollectionKey<C>, collection: C) => value is S
): S | undefined
/** {@link findLast} with a predicate that is not a type guard. */
export function findLast<C extends Collection>(
  collection: C,
  predicate: CollectionCallback<C, unknown>
): CollectionValue<C> | undefined
export function findLast<C extends Collection>(
  collection: C,
  predicate: CollectionCallback<C, unknown>
): CollectionValue<C> | undefined {
  const fn = predicate as Callback
  const list = entryList(collection)
  for (let i = list.length - 1; i >= 0; i--) {
    if (fn(list[i][1], list[i][0], collection)) return list[i][1] as CollectionValue<C>
  }
  return undefined
}

/**
 * True when `predicate` is truthy for some entry; stops at the first one.
 * @param collection The collection to test.
 * @param predicate Tests one entry.
 * @returns Whether any entry passes. `false` for an empty collection.
 * @example
 * ```ts
 * some({ a: 1, b: -1 }, (value) => value < 0) // true
 * ```
 */
export function some<C extends Collection>(
  collection: C,
  predicate: CollectionCallback<C, unknown>
): boolean {
  const fn = predicate as Callback
  return eachEntry(collection, (value, key) => Boolean(fn(value, key, collection)))
}

/**
 * True when `predicate` is truthy for every entry; stops at the first that fails.
 * @param collection The collection to test.
 * @param predicate Tests one entry.
 * @returns Whether every entry passes. `true` for an empty collection.
 * @example
 * ```ts
 * every(new Set([2, 4]), (value) => value % 2 === 0) // true
 * ```
 */
export function every<C extends Collection>(
  collection: C,
  predicate: CollectionCallback<C, unknown>
): boolean {
  const fn = predicate as Callback
  return !eachEntry(collection, (value, key) => !fn(value, key, collection))
}

/** `(accumulator, value, key, collection)`, as `Array.prototype.reduce` passes them plus the key. */
export type CollectionReducer<C, A> = (
  accumulator: A,
  value: CollectionValue<C>,
  key: CollectionKey<C>,
  collection: C
) => A

function emptyReduceError(): TypeError {
  return new TypeError('reduce of an empty collection with no initial value')
}

/**
 * Fold the entries of `collection` into one value, as `Array.prototype.reduce` does. Without
 * `initial`, the first value starts the fold.
 * @param collection The collection to fold.
 * @param reducer Combines the accumulator with one entry.
 * @param initial The starting accumulator.
 * @returns The final accumulator.
 * @throws {TypeError} when `collection` is empty and no `initial` is given, as the native method does.
 * @example
 * ```ts
 * reduce({ a: 1, b: 2 }, (sum, value) => sum + value, 0) // 3
 * reduce(new Map([['x', 1]]), (out, value, key) => `${out}${key}${value}`, '') // 'x1'
 * ```
 */
export function reduce<C extends Collection, A>(
  collection: C,
  reducer: CollectionReducer<C, A>,
  initial: A
): A
/** {@link reduce} without `initial`: the first value starts the fold. */
export function reduce<C extends Collection>(
  collection: C,
  reducer: CollectionReducer<C, CollectionValue<C>>
): CollectionValue<C>
export function reduce<C extends Collection, A>(
  collection: C,
  reducer: CollectionReducer<C, A>,
  ...initial: [A?]
): A {
  const fn = reducer as Reducer
  let hasAcc = initial.length > 0
  let acc: unknown = initial[0]
  eachEntry(collection, (value, key) => {
    if (hasAcc) {
      acc = fn(acc, value, key, collection)
    } else {
      acc = value
      hasAcc = true
    }
  })
  if (!hasAcc) throw emptyReduceError()
  return acc as A
}

/**
 * {@link reduce} from the last entry to the first, as `Array.prototype.reduceRight` does.
 * @param collection The collection to fold.
 * @param reducer Combines the accumulator with one entry.
 * @param initial The starting accumulator.
 * @returns The final accumulator.
 * @throws {TypeError} when `collection` is empty and no `initial` is given.
 * @example
 * ```ts
 * reduceRight(['a', 'b', 'c'], (out, value) => out + value, '') // 'cba'
 * ```
 */
export function reduceRight<C extends Collection, A>(
  collection: C,
  reducer: CollectionReducer<C, A>,
  initial: A
): A
/** {@link reduceRight} without `initial`: the last value starts the fold. */
export function reduceRight<C extends Collection>(
  collection: C,
  reducer: CollectionReducer<C, CollectionValue<C>>
): CollectionValue<C>
export function reduceRight<C extends Collection, A>(
  collection: C,
  reducer: CollectionReducer<C, A>,
  ...initial: [A?]
): A {
  const fn = reducer as Reducer
  const list = entryList(collection)
  const hasInitial = initial.length > 0
  if (!hasInitial && list.length === 0) throw emptyReduceError()
  let i = list.length - 1
  let acc: unknown = hasInitial ? initial[0] : list[i--][1]
  for (; i >= 0; i--) acc = fn(acc, list[i][1], list[i][0], collection)
  return acc as A
}
