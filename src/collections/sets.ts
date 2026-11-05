/**
 * Set-style helpers (`uniq`, `union`, `difference`, ...), `without`, `remove`, and `reject`.
 * The set-style helpers read a hole as `undefined`, as `new Set(arr)` does.
 */

import { walkArray } from '../internal/arrayKeys.js'
import { compare } from '../operators/index.js'
import type { Iteratee } from '../types.js'
import { filter } from './iterate.js'
import { toIteratee } from './iteratee.js'
import { forEachMember, toList } from './lists.js'

/** Normalize `-0` to `+0` (native Set / Lodash semantics). */
function normalizeZero<T>(x: T): T {
  return Object.is(x, -0) ? (0 as T) : x
}

function toSet<T>(input: unknown): Set<T> {
  const members = new Set<T>()
  forEachMember(toList<T>(input), (value) => {
    members.add(value)
  })
  return members
}

/**
 * Creates a duplicate-free version of an array, using SameValueZero equality on `iteratee` keys, keeping the first element for each key.
 * Results normalize `-0` to `+0`. Nullish input and values that are neither iterable nor array-like
 * give `[]`.
 * @param arr The array containing duplicated elements
 * @param fn The iteratee invoked per element.
 * @returns Returns the new duplicate free array.
 * @example
```js
uniq([2, 1, 2])
// [2, 1]

uniq([2.1, 1.2, 2.3], Math.floor)
// [2.1, 1.2]
```
 *
 * @see {@link sortedUniq}
 */
export function uniq<T>(
  arr: Iterable<T> | ArrayLike<T> | null | undefined,
  fn?: Iteratee<T> | object | PropertyKey | null
): T[] {
  const seen = new Set<unknown>()
  const result: T[] = []
  const it = toIteratee<T>(fn)
  forEachMember(toList<T>(arr), (x) => {
    const key = it(x)
    if (seen.has(key)) return
    seen.add(key)
    result.push(normalizeZero(x))
  })
  return result
}

/**
 * This method is like {@link uniq} except that it sorts the results in ascending order
 * @param arr The array containing duplicated elements
 * @param fn The iteratee invoked per element.
 * @returns Returns the new duplicate free array
 * @example
```js
sortedUniq([2, 1, 2])
// [1, 2]
```
 * @see {@link uniq}
 */
export function sortedUniq<T>(
  arr: Iterable<T> | ArrayLike<T> | null | undefined,
  fn?: Iteratee<T> | PropertyKey | null
): T[] {
  const values = uniq(arr, fn)
  values.sort(compare)
  return values
}

/**
 * Yield elements of `first` not present in any of `rest` (SameValueZero), in first-occurrence order.
 * Every input may be iterable or array-like; anything else counts as empty.
 * @param first Source iterable.
 * @param rest Exclusion iterables.
 * @see {@link union}
 * @see {@link intersection}
 */
export function difference<T>(
  first: Iterable<T> | ArrayLike<T> | null | undefined,
  ...rest: (Iterable<T> | ArrayLike<T> | null | undefined)[]
): IteratorObject<T> {
  const result = toSet<T>(first)
  for (const excluded of rest) {
    forEachMember(toList<T>(excluded), (value) => {
      result.delete(value)
    })
  }
  return result.values()
}

/**
 * Yield elements present in exactly one input (SameValueZero), in first-seen order.
 * Every input may be iterable or array-like; anything else counts as empty.
 * @param its Input iterables.
 */
export function symmetricDifference<T>(
  ...its: (Iterable<T> | ArrayLike<T> | null | undefined)[]
): IteratorObject<T> {
  const once = new Set<T>()
  const repeated = new Set<T>()
  for (const it of its) {
    for (const value of toSet<T>(it)) {
      if (repeated.has(value)) continue
      if (once.delete(value)) repeated.add(value)
      else once.add(value)
    }
  }
  return once.values()
}

/**
 * Yield elements present in every input iterable (SameValueZero), in first-seen order of the first.
 * Every input may be iterable or array-like; anything else counts as empty. The inputs are read at
 * the call, and results normalize `-0` to `+0`.
 * @param its Input iterables (at least one).
 * @see {@link difference}
 * @see {@link union}
 */
export function intersection<T>(
  ...its: (Iterable<T> | ArrayLike<T> | null | undefined)[]
): IteratorObject<T> {
  const result = toSet<T>(its[0])
  for (const it of its.slice(1)) {
    const other = toSet<T>(it)
    for (const value of result) {
      if (!other.has(value)) result.delete(value)
    }
  }
  return result.values()
}

/**
 * Yield all distinct elements from the inputs in first-seen order (SameValueZero).
 * Every input may be iterable or array-like; anything else counts as empty.
 * @param its Input iterables.
 * @see {@link difference}
 * @see {@link intersection}
 */
export function union<T>(
  ...its: (Iterable<T> | ArrayLike<T> | null | undefined)[]
): IteratorObject<T> {
  const result = new Set<T>()
  for (const it of its) {
    forEachMember(toList<T>(it), (value) => {
      result.add(value)
    })
  }
  return result.values()
}

/**
 * Remove every element for which `predicate` is truthy from `arr` in place; return the removed elements in original order.
 * As in Lodash, the predicate sees a hole as `undefined`, a matched hole is removed and returned,
 * and other holes keep their offset from their neighbours. A huge sparse array visits own elements
 * only. Nullish `arr` gives `[]`; anything else that is not an array throws
 * `TypeError('remove expects an array')`.
 * @param arr Array to mutate.
 * @param predicate Function, plain-object shape, or property path. Defaults to identity.
 */
export function remove<T>(
  arr: T[] | null | undefined,
  predicate?: ((value: T, index: number, coll: unknown) => unknown) | object | PropertyKey | null
): T[] {
  if (arr == null) return []
  if (!Array.isArray(arr)) throw new TypeError('remove expects an array')
  const pred = toIteratee<T>(predicate)
  const drop: number[] = []
  forEachMember(arr, (value, index) => {
    if (pred(value, index, arr)) drop.push(index)
  })
  if (drop.length === 0) return []
  const removed = drop.map((index) => arr[index])
  const keptIndices: number[] = []
  const keptValues: T[] = []
  let dropped = 0
  walkArray(arr, (ev) => {
    if (ev.kind !== 'value') return
    while (drop[dropped] < ev.index) dropped++
    if (drop[dropped] === ev.index) return
    keptIndices.push(ev.index - dropped)
    keptValues.push(ev.value as T)
  })
  const length = arr.length - drop.length
  arr.length = 0
  for (const [i, index] of keptIndices.entries()) arr[index] = keptValues[i]
  arr.length = length
  return removed
}

/**
 * Return a new array of elements for which `predicate` is falsy; does not mutate.
 * The complement of {@link filter}: the predicate gets the real key or index, and array holes are skipped.
 * @param collection Iterable or plain object.
 * @param predicate Function, plain-object shape, or property path. Defaults to identity.
 */
export function reject<T>(
  collection: Iterable<T> | Record<string, T> | null | undefined,
  predicate?: ((value: T, key: PropertyKey, coll: unknown) => unknown) | object | PropertyKey | null
): T[] {
  const pred = toIteratee<T>(predicate)
  return filter<T>(collection, (value, key) => !pred(value, key, collection))
}

/**
 * Return a new array excluding every element SameValueZero-equal to one of `values`.
 * Results normalize `-0` to `+0`. Nullish input and values that are neither iterable nor
 * array-like give `[]`.
 * @param array Source array (not mutated).
 * @param values Values to exclude.
 */
export function without<T>(
  array: Iterable<T> | ArrayLike<T> | null | undefined,
  ...values: T[]
): T[] {
  const exclude = new Set(values)
  const out: T[] = []
  forEachMember(toList<T>(array), (x) => {
    if (!exclude.has(x)) out.push(normalizeZero(x))
  })
  return out
}
