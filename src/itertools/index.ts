/**
 * This module includes functions that deal with or produce iterators.
 *
 * @module itertools
 */

import { call, isEmpty, isIterable, isObject, notNull, ValueError } from '../globals/index.js'
import { arrayFromIterable } from '../internal/iterable.js'
import { add, bool, compare, eq, identity, type Comparer } from '../operators/index.js'
import type { Iteratee, Predicate } from '../types.js'

export interface SortOptions<T = unknown, K = unknown> {
  key?: (x: T) => K
  reverse?: boolean
  compare?: Comparer<K>
}

/**
 * Make an iterator that returns accumulated sums, or accumulated results of other binary functions (specified via the optional `func` argument).
 * @param iterable The iterable to accumulate
 * @param func The accumulator function (default `add`).
 * @param initial Optional initial value (defaults to the first element in iterable)
 * @returns A sequence of accumulated values
 */
export function accumulate<T>(
  iterable: Iterable<T>,
  func: (acc: unknown, value: T) => unknown = add,
  initial?: unknown
): IteratorObject<unknown> {
  const hasInitial = arguments.length >= 3
  return (function* () {
    const it = Iterator.from(iterable)
    let total: unknown
    if (hasInitial) {
      total = initial
      yield total
    } else {
      const first = it.next()
      if (first.done) return
      total = first.value
      yield total
    }
    for (const value of it) {
      total = func(total, value)
      yield total
    }
  })()
}

/**
 * Returns `true` when all of the items in iterable are truthy. An optional predicate function can be used to define what truthiness means for this specific collection.
 * @param iterable
 * @param fn
 * @returns `True` if all elements pass the test or are truthy else `false`.
 * @example
```js
all([0])
// false

all([1, 2, 3])
// true

all([2, 4, 6], n => n > 1)
// true
```
@see {@link any}
 */
export function all<T>(iterable: Iterable<T>, fn: Predicate<T> = bool): boolean {
  for (const item of iterable) {
    if (!fn(item)) return false
  }
  return true
}

/**
 * Returns true when any of the items in iterable are truthy. An optional predicate function can be used to define what truthiness means for this specific collection.
 * @param iterable
 * @param fn
 * @returns `True` if any element passes the test or is truthy else `false`.
 * @example
```js
any([0])
// false

any([0, 1, null, undefined])
// true

any([1, 4, 5], n => n % 2 === 0)
// true
```
@see {@link all}
 */
export function any<T>(iterable: Iterable<T>, fn: Predicate<T> = bool): boolean {
  for (const item of iterable) {
    if (fn(item)) return true
  }
  return false
}

export function chain<T>(...iterables: Iterable<T>[]): IteratorObject<T> {
  return iflatten(iterables)
}

/**
 * Checks if the `value` is in `collection`.
 * @param collection The collection to inspect.
 * @param value The value to search for.
 * @returns Returns `true` if value is found, else `false`.
 * @example
```js
contains([1, 2, 3], 1)
// true

contains({ 'a': 1, 'b': 2 }, 1)
// true

contains('abcd', 'bc')
// true
```
 *
 * @see {@link collections.find}
 */
export function contains(collection: unknown, value: unknown): boolean {
  if (collection == null) return false
  if (typeof collection === 'string') return collection.includes(value as string)
  if (isIterable(collection)) return any(collection, (x) => eq(x, value))
  if (isObject(collection)) return any(Object.values(collection), (x) => eq(x, value))
  return false
}

/**
 * Returns a generator that drops elements from the iterable as long as the predicate is `true`; afterwards, returns every remaining element. Note, the generator does not produce any output until the predicate first becomes `false`.
 * @param iterable The iterable to inspect.
 * @param predicate A function invoked per element to check if it should be dropped.
 * @returns Elements
 */
export function dropWhile<T>(iterable: Iterable<T>, predicate: Predicate<T>): IteratorObject<T> {
  let dropping = true
  return Iterator.from(iterable).filter((value) => {
    if (dropping && predicate(value)) return false
    dropping = false
    return true
  })
}

export function iforEach<T>(iterable: Iterable<T>, fun: Iteratee<T>) {
  for (const [index, value] of enumerate(iterable)) {
    if (fun(value, index, iterable) === false) {
      return
    }
  }
}

/**
 * Yields elements like `[index, item]` from an iterable. Index starts at zero by default.
 * @template T
 * @param iterable The iterable to inspect.
 * @param start The starting index.
 * @returns A generator with tuples like `[index, item]`.
 * @example
```js
[...enumerate(['hello', 'world'])]
// [[0, 'hello'], [1, 'world']]

[...enumerate(['hello', 'world'], 1)]
// [[1, 'hello'], [2, 'world']]
```
 */
export function enumerate<T>(iterable: Iterable<T>, start = 0): IteratorObject<[number, T]> {
  let index = start
  return Iterator.from(iterable).map((item) => [index++, item] as [number, T])
}

/**
 * Returns the first element in an iterable.
 * @param iterable The iterable to inspect.
 * @returns The first element found or undefined if iterable is empty.
 */
export function first<T>(iterable: Iterable<T>): T | undefined {
  const result = Iterator.from(iterable).next()
  return result.done ? undefined : result.value
}

/**
 * Creates a new generator that filters all falsy and empty values from iterable.
 * @param arr The array to compact
 * @returns A new array with the filtered values.
 * @example
```js
[...icompact([0, 1, false, 2, '', 3])]
// [1, 2, 3]
```
 */
export function icompact<T>(iterable: Iterable<T>): IteratorObject<T> {
  return Iterator.from(iterable).filter((value) => !isEmpty(value))
}

/**
 * Iterates over elements of collection, producing only those elements where predicate returns a `truthy` value.
 */
export function ifilter<T>(iterable: Iterable<T>, fn: (v: T) => unknown): IteratorObject<T> {
  return Iterator.from(iterable).filter((v) => fn(v))
}

export function imap<T, R>(iterable: Iterable<T>, fn: (v: T) => R): IteratorObject<R> {
  return Iterator.from(iterable).map((v) => fn(v))
}

/**
 * Returns a generator flattening one level of nesting in a list of lists.
 * @param iterables The iterable to flatten
 * @example
```js
[...iflatten([[0, 1], [2, 3]])]
// [0, 1, 2, 3]
```
 */
export function iflatten<T = unknown>(iterables: Iterable<Iterable<T>>): IteratorObject<T> {
  return (function* () {
    for (const iterator of iterables) {
      for (const item of iterator) {
        yield item
      }
    }
  })()
}

export function flatMap<T, R>(
  iterable: Iterable<T>,
  fn: (v: T) => Iterable<R> | Iterator<R>
): IteratorObject<R> {
  return Iterator.from(iterable).flatMap((v) => fn(v))
}

export function islice<T>(
  iterable: Iterable<T>,
  start: number,
  stop?: number,
  step = 1
): IteratorObject<T> {
  if (start < 0) throw new ValueError(`start parameter can't be negative`)
  if (stop != null && stop < 0) throw new ValueError(`stop parameter can't be negative`)
  if (step <= 0) throw new ValueError(`step parameter must be positive`)
  if (stop != null && start > stop) throw new ValueError(`start parameter can't be after stop`)
  let it = Iterator.from(iterable).drop(start)
  if (stop != null) it = it.take(stop - start)
  return it.filter((_, i) => i % step === 0)
}

export function itake<T>(n: number, iterable: Iterable<T>): IteratorObject<T> {
  return Iterator.from(iterable).take(n)
}

/**
 * Returns an Iterator from the elements of a collection or the object keys.
 * @param obj The given collection to iterate over.
 * @returns An Iterator type.
 */
export function iter<T>(obj: unknown): Iterator<T> {
  const iterable = call(obj, Symbol.iterator)
  if (notNull(iterable)) return iterable as Iterator<T>
  return Object.keys(obj as object)[Symbol.iterator]() as Iterator<T>
}

export function partition<T>(iterable: Iterable<T>, predicate: Predicate<T, boolean>): [T[], T[]] {
  const left = [] as T[]
  const right = [] as T[]
  for (const value of iterable) {
    if (predicate(value)) left.push(value)
    else right.push(value)
  }
  return [left, right]
}

/**
 * Returns a generator for a sequence of numbers in the given range, starting from `start` (default 0) to `stop` (not-inclusive) in increments of `step` (default 1).
 *
 * `range(x)` is a shorthand for `range(0, x, 1)`.
 * @param args When called with a single argument, it is assigned to `stop` param. If two arguments are given, it will assign them to `(start, stop)`. When three arguments, it means `(start, stop, step)`.
 * @example
```js
[...range(5)]
// [0, 1, 2, 3, 4]

[...range(2, 5)]
// [2, 3, 4]

[...range(0, 5, 2)]
// [0, 2, 4]

[...range(5, 0, -1)]
// [5, 4, 3, 2, 1]

[...range(-3)]
// []
```
 */
export function range(...args: number[]): IteratorObject<number> {
  return (function* () {
    const [start, stop, step] =
      args.length === 1 ? [0, args[0], 1] : [args[0], args[1], args[2] ?? 1]
    if ([start, stop, step].some((n) => Number.isNaN(n))) {
      throw new RangeError('range bounds must be numbers')
    }
    if (step === 0) throw new RangeError('range step must not be zero')
    const n = Math.ceil((stop - start) / step)
    for (let i = 0; i < n; i++) {
      const value = start + i * step
      // Fractional steps can accumulate error and land on or past `stop`.
      if (step > 0 ? !(value < stop) : !(value > stop)) return
      yield value
    }
  })()
}

/**
 * Applies a `reducer` function on each element of the iterable, in order, passing the return value from the operation on the previous element. The final result of running the reducer across all elements of the iterable is a single value.
 * @param iterable The collection to reduce.
 * @param reducer A reducer function that will be called per item.
 * @param initial Optional initial value (defaults to the first element in the iterable).
 * @returns The result of calling reducer on each item.
 * @example
```js
reduce([1, 2, 3, 4, 5], (x, y) => x + y, 0)
// 15
```
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce Array.reduce()}
 */
export function reduce<T>(iterable: Iterable<T>, fn: (acc: T, v: T, i: number) => T): T
export function reduce<T, A>(
  iterable: Iterable<T>,
  fn: (acc: A, v: T, i: number) => A,
  initial: A
): A
export function reduce(
  iterable: Iterable<unknown>,
  fn: (acc: unknown, v: unknown, i: number) => unknown,
  initial?: unknown
): unknown {
  const it = Iterator.from(iterable)
  if (arguments.length >= 3) return it.reduce(fn, initial)
  return it.reduce(fn)
}

/**
 * Creates a new array with the elements from the iterable in reverse order.
 * @param iterable The iterable to inspect.
 * @returns A new array with the elements reversed.
 */
export function reversed<T>(iterable: Iterable<T>): T[] {
  return arrayFromIterable<T>(iterable).reverse()
}

/**
 * Creates a new sorted list from the elements in the iterable.
 *
 * Call forms:
 *   - `sorted(it)` / `sorted(it, options)`
 *   - `sorted(it, reverse)`
 *   - `sorted(it, key)` / `sorted(it, key, reverse)`
 *   - `sorted(it, reverse, compare)`
 *
 * If `args` is a plain Object, returns the sorted values.
 */
export function sorted<T, K = T>(
  args: Iterable<T> | Record<string, T>,
  key?: boolean | Predicate<T> | SortOptions<T, K>
): T[]
export function sorted<T, K = T>(
  args: Iterable<T> | Record<string, T>,
  reverse: boolean,
  comp: Comparer<K>
): T[]
export function sorted<T, K = T>(
  args: Iterable<T> | Record<string, T>,
  key: (x: T) => K,
  reverse: boolean,
  compareFn?: Comparer<K>
): T[]
export function sorted<T, K = T>(
  args: Iterable<T> | Record<string, T>,
  key?: boolean | Predicate<T> | SortOptions<T, K>,
  reverse?: boolean | Comparer<K>,
  compareFn?: Comparer<K>
): T[] {
  const items: T[] = isIterable(args)
    ? arrayFromIterable<T>(args)
    : isObject(args)
      ? Object.values(args)
      : arrayFromIterable<T>(args)

  let keyFn: (x: T) => K = identity as (x: T) => K
  let rev = false
  let keyCmp: Comparer<K> | undefined

  if (key != null && typeof key === 'object') {
    const opts = key
    keyFn = (opts.key ?? identity) as (x: T) => K
    rev = opts.reverse ?? false
    keyCmp = opts.compare
  } else if (typeof key === 'boolean') {
    rev = key
    if (typeof reverse === 'function') {
      keyCmp = reverse
    }
  } else if (typeof key === 'function') {
    keyFn = key as (x: T) => K
    if (typeof reverse === 'boolean') rev = reverse
    if (typeof reverse === 'function') keyCmp = reverse
    if (typeof compareFn === 'function') keyCmp = compareFn
  }

  const decorated = items.map((item) => ({ item, k: keyFn(item) }))
  decorated.sort((a, b) => {
    const c = keyCmp ? keyCmp(a.k, b.k) : compare(a.k, b.k)
    return rev ? -c : c
  })
  return decorated.map((d) => d.item)
}

/**
 * Sort `args` in place. Can be called like this:
 *   - sort([...], true) - reverse order
 *   - sort([...], (x, y) => number) - using custom compare
 *   - sort([...], true, (x, y) => number) - reverse and using custom compare
 *
 * @param {any[]} args
 * @param {(boolean | Comparer)} [reverse]
 * @param {Comparer} [compareFn]
 * @return
 */
export function sort<T>(args: T[], reverse?: boolean | Comparer): T[]
export function sort<T>(args: T[], reverse: boolean, compareFn: Comparer): T[]
export function sort<T>(args: T[], reverse?: boolean | Comparer, compareFn?: Comparer): T[] {
  if (typeof reverse === 'function') {
    compareFn = reverse
    reverse = false
  }
  const cmp = compareFn ?? compare
  args.sort(reverse ? (a, b) => -cmp(a, b) : cmp)
  return args
}

export function take<T>(n: number, iterable: Iterable<T>): T[] {
  return itake(n, iterable).toArray()
}

/**
 * Returns a generator that takes elements from the iterable as long as the predicate is `true`.
 * @param iterable The iterable to inspect.
 * @param predicate A function invoked per element to check if it should be taken.
 * @returns Elements
 */
export function takeWhile<T>(iterable: Iterable<T>, predicate: Predicate<T>): IteratorObject<T> {
  return (function* () {
    for (const value of iterable) {
      if (!predicate(value)) return
      yield value
    }
  })()
}

/**
 * Returns a generator that produces `fn(index)` for each `index < n`.
 * @param n The number of times to invoke `fn`.
 * @param fn A function used to produce the results.
 */
export function times<T>(n: number, fn: (index: number) => T): IteratorObject<T> {
  return (function* () {
    for (let i = 0; i < n; i++) yield fn(i)
  })()
}

/**
 * Returns a generator that aggregates elements from the iterables producing tuples with the next element from each one.
 * @param args The iterables to zip
 * @returns Tuples with elements from each iterator
 * @example
```js
[...zip([1, 2, 3], ['sugar', 'spice', 'nice'])]
// [[1, 'sugar'], [2, 'spice'], [3, 'nice']]
```
 */
export function zip<T extends unknown[]>(
  ...args: { [K in keyof T]: Iterable<T[K]> }
): IteratorObject<T> {
  return (function* () {
    if (args.length === 0) return
    const iterables = (args as Iterable<unknown>[]).map((a) => Iterator.from(a))
    for (;;) {
      const items: unknown[] = []
      for (const iterator of iterables) {
        const result = iterator.next()
        if (result.done) return
        items.push(result.value)
      }
      yield items as T
    }
  })()
}
