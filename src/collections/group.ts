/**
 * Grouping: `count`, `groupBy`, `groupByMap`.
 */

import { isIterable } from '../globals/index.js'
import { arrayFromIterable } from '../internal/iterable.js'
import { guardNesting } from '../internal/nesting.js'
import type { Iteratee } from '../types.js'
import { forEach } from './iterate.js'
import { toIteratee } from './iteratee.js'
import { isPlainObject } from './object.js'

/**
 * Creates an object composed of keys from the results of running elements of `collection` thru `iteratee`. The corresponding value of each key is the number of times the key was returned by `iteratee`.
 * The result has a `null` prototype, so a key such as `__proto__` is ordinary data.
 * A key too deep to stringify throws `RangeError('nesting deeper than 1000 levels')`.
 * @param obj Collection to count.
 * @param func Iteratee or shorthand producing the group key. Defaults to identity.
 * @returns {Object} Returns an Object with the frequency values
 * @example
```js
count([6.1, 4.2, 6.3], Math.floor)
// { '4': 1, '6': 2 }

count(['one', 'two', 'three'], x => x.length)
// { '3': 2, '5': 1 }
```
 */
export function count<T>(
  obj: T[] | object | null | undefined,
  func?: Iteratee<T> | object | PropertyKey | null
): Record<string, number> {
  const it = toIteratee<T>(func)
  const counters = Object.create(null) as Record<string, number>
  guardNesting(() => {
    forEach(obj, (value, key) => {
      const result = String(it(value, key))
      counters[result] = (counters[result] ?? 0) + 1
    })
  })
  return counters
}

/**
 * Creates an object composed of keys generated from the results of running each element of `arr` thru `func`. The order of grouped values is determined by the order they occur in `arr`. The corresponding value of each key is an array of elements responsible for generating the key.
 * The result has a `null` prototype, as `Object.groupBy` gives. A key too deep to stringify throws
 * `RangeError('nesting deeper than 1000 levels')`. A huge sparse array throws
 * `RangeError('sparse array too large')`.
 *
 * @param coll The collection to iterate over.
 * @param fn Iteratee or shorthand producing the group key. Defaults to identity.
 * @returns Returns the aggregated object.
 *
 * @example
```js
groupBy([6.1, 4.2, 6.3], Math.floor)
// { '4': [4.2], '6': [6.1, 6.3] }

// The `property` iteratee shorthand.
groupBy(['one', 'two', 'three'], 'length')
// { '3': ['one', 'two'], '5': ['three'] }
```
 */
export function groupBy<T, K extends PropertyKey>(
  coll: Iterable<T> | Record<string, T> | null | undefined,
  fn?: ((v: T) => K) | object | PropertyKey | null
): Partial<Record<K, T[]>> {
  const values = toValues(coll)
  const it = toIteratee<T>(fn)
  return guardNesting(() => Object.groupBy<K, T>(values, (v) => it(v) as K))
}

/**
 * Similar to {@link groupBy} but it returns a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map Map} object with the results.
 *
 * @param coll The collection to iterate over.
 * @param fn Iteratee or shorthand producing the group key. Defaults to identity.
 * @returns {Map} Returns the aggregated map object.
 * @template K, V
 *
 * @example
```js
[...groupByMap([6.1, 4.2, 6.3], Math.floor)]
// [[6, [6.1, 6.3]], [4, [4.2]]]

[...groupByMap(['one', 'two', 'three'], 'length')]
// [[3, ['one', 'two']], [5, ['three']]]
```
 */
export function groupByMap<T, K>(
  coll: Iterable<T> | Record<string, T> | null | undefined,
  fn?: ((v: T) => K) | object | PropertyKey | null
): Map<K, T[]> {
  const values = toValues(coll)
  const it = toIteratee<T>(fn)
  return Map.groupBy(values, (v) => it(v) as K)
}

function toValues<T>(coll: Iterable<T> | Record<string, T> | null | undefined): T[] {
  if (coll == null) return []
  if (isPlainObject(coll)) return Object.values(coll)
  if (isIterable(coll)) return arrayFromIterable<T>(coll)
  return Object.values(coll)
}
