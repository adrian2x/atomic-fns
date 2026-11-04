/**
 * This module includes functions that deal with or produce iterators.
 *
 * Arrays read like `[...arr]`, so each hole is `undefined`. The exception is {@link reduce}, which
 * follows `Array.prototype.reduce` and skips holes. Huge sparse arrays throw
 * `RangeError('sparse array too large')`, except in {@link all}, {@link any}, {@link contains},
 * {@link first}, {@link icompact} and {@link reduce}, which walk own elements instead.
 *
 * @module itertools
 */

import { call, isIterable, isObject, notNull, ValueError } from '../globals/index.js'
import { isHugeSparse, walkArray } from '../internal/arrayKeys.js'
import { isCompactEmpty } from '../internal/compactEmpty.js'
import {
  arrayElements,
  arrayFromIterable,
  assertArrayNotHugeSparse,
  closingIterator,
  drain,
  forEachArrayElement,
  isTypedArray,
  pull
} from '../internal/iterable.js'
import { add, bool, compare, eq, identity, type Comparer } from '../operators/index.js'
import type { Iteratee, Predicate } from '../types.js'

export type { Iteratee, Predicate } from '../types.js'

export interface SortOptions<T = unknown, K = unknown> {
  key?: (x: T) => K
  reverse?: boolean
  compare?: Comparer<K>
}

/** `Iterator.from` for walks that visit an array index by index. */
function iterate<T>(iterable: Iterable<T>): IteratorObject<T> {
  assertArrayNotHugeSparse(iterable)
  return Iterator.from(iterable)
}

/**
 * Make an iterator that returns accumulated sums, or accumulated results of other binary functions (specified via the optional `func` argument).
 * @param iterable The iterable to accumulate
 * @param func The accumulator function (default `add`).
 * @param initial Optional initial value (`undefined` means absent, so the first element seeds)
 * @returns A sequence of accumulated values
 */
export function accumulate<T>(
  iterable: Iterable<T>,
  func: (acc: unknown, value: T) => unknown = add,
  initial?: unknown
): IteratorObject<unknown> {
  const source = iterate(iterable)
  return closingIterator([source], function* (open) {
    let total = initial
    let seeded = initial !== undefined
    if (seeded) yield total
    for (const value of drain(open, source)) {
      total = seeded ? func(total, value) : value
      seeded = true
      yield total
    }
  })
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
  if (isTypedArray<T>(iterable)) {
    let ok = true
    forEachArrayElement(iterable, (item) => {
      if (!fn(item)) {
        ok = false
        return false
      }
      return undefined
    })
    return ok
  }
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
  if (isTypedArray<T>(iterable)) {
    let hit = false
    forEachArrayElement(iterable, (item) => {
      if (fn(item)) {
        hit = true
        return false
      }
      return undefined
    })
    return hit
  }
  for (const item of iterable) {
    if (fn(item)) return true
  }
  return false
}

/**
 * Yields each iterable in turn. Every iterable opens at the call, and any still unfinished closes
 * on an early exit.
 * @param iterables The iterables to chain.
 * @returns An iterator over all of their elements.
 */
export function chain<T>(...iterables: Iterable<T>[]): IteratorObject<T> {
  const sources = iterables.map(iterate)
  return closingIterator(sources, function* (open) {
    for (const source of sources) yield* drain(open, source)
  })
}

/**
 * Checks if the `value` is in `collection`. Strings check substrings, a `Map` checks keys, and a
 * plain object checks values.
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
  if (typeof collection === 'string') {
    return !(value instanceof RegExp) && collection.includes(value as string)
  }
  if (collection instanceof Map) return collection.has(value)
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
  return iterate(iterable).filter((value) => {
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
  return iterate(iterable).map((item) => [index++, item] as [number, T])
}

/**
 * Returns the first element in an iterable. A passed iterator closes, as with `break` in
 * `for...of`, so a generator is spent afterwards.
 * @param iterable The iterable to inspect.
 * @returns The first element found or undefined if iterable is empty.
 */
export function first<T>(iterable: Iterable<T>): T | undefined {
  if (isTypedArray<T>(iterable)) {
    let found: { v: T } | undefined
    forEachArrayElement(iterable, (v) => {
      found = { v }
      return false
    })
    return found === undefined ? undefined : found.v
  }
  const it = Iterator.from(iterable)
  const result = it.next()
  if (result.done) return undefined
  it.return?.()
  return result.value
}

/**
 * Creates a new iterator that filters all falsy and empty values from iterable (SPEC-R40).
 * Shares `isCompactEmpty` with `compact`; does not change `isEmpty`.
 * @param iterable The iterable to compact.
 * @returns An iterator over the kept values.
 * @example
```js
[...icompact([0, 1, false, 2, '', 3])]
// [1, 2, 3]
```
 */
export function icompact<T>(iterable: Iterable<T>): IteratorObject<T> {
  const source =
    isTypedArray(iterable) && isHugeSparse(iterable) ? arrayElements(iterable) : iterable
  return Iterator.from(source).filter((value) => !isCompactEmpty(value))
}

/**
 * Iterates over elements of collection, producing only those elements where predicate returns a `truthy` value.
 */
export function ifilter<T>(iterable: Iterable<T>, fn: (v: T) => unknown): IteratorObject<T> {
  return iterate(iterable).filter((v) => fn(v))
}

export function imap<T, R>(iterable: Iterable<T>, fn: (v: T) => R): IteratorObject<R> {
  return iterate(iterable).map((v) => fn(v))
}

/**
 * Returns an iterator flattening one level of nesting in a list of lists.
 * @param iterables The iterable to flatten
 * @example
```js
[...iflatten([[0, 1], [2, 3]])]
// [0, 1, 2, 3]
```
 */
export function iflatten<T = unknown>(iterables: Iterable<Iterable<T>>): IteratorObject<T> {
  return iterate(iterables).flatMap((inner) => iterate(inner))
}

/**
 * Maps each element and flattens one level: a non-string iterable result flattens, and anything
 * else is yielded as is, like Lodash `flatMap`.
 * @param iterable The iterable to map.
 * @param fn A function invoked per element.
 * @returns An iterator over the flattened results.
 */
export function flatMap<T, R>(
  iterable: Iterable<T>,
  fn: (v: T) => Iterable<R> | R
): IteratorObject<R> {
  return iterate(iterable).flatMap((v) => {
    const mapped = fn(v)
    return typeof mapped !== 'string' && isIterable(mapped) ? iterate(mapped) : [mapped]
  })
}

function assertSliceBound(value: number, name: string, minimum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new ValueError(`islice ${name} must be an integer of at least ${String(minimum)}`)
  }
}

/**
 * Python `islice`: `islice(iterable, stop)` or `islice(iterable, start, stop, step)`, where `null`
 * or `undefined` means the default (`start` 0, no `stop`, `step` 1). A `start` past `stop` is
 * empty. Reaching `stop` closes a passed iterator, as the native `take` does.
 * @param iterable The iterable to slice.
 * @param startOrStop `stop` when it is the only bound, else `start`.
 * @param stopBound The index to stop before.
 * @param step The stride between yielded elements.
 * @returns An iterator over the selected elements.
 * @throws {ValueError} when a bound is not a safe integer, or is negative, or `step` is below 1.
 */
export function islice<T>(
  iterable: Iterable<T>,
  startOrStop: number | null | undefined,
  stopBound?: number | null,
  step?: number | null
): IteratorObject<T> {
  const [start, stop] = arguments.length < 3 ? [0, startOrStop] : [startOrStop ?? 0, stopBound]
  const stride = step ?? 1
  assertSliceBound(start, 'start', 0)
  if (stop != null) assertSliceBound(stop, 'stop', 0)
  assertSliceBound(stride, 'step', 1)
  let it = iterate(iterable).drop(start)
  if (stop != null) it = it.take(Math.max(stop - start, 0))
  return it.filter((_, i) => i % stride === 0)
}

/**
 * Returns an iterator over the first `n` elements. `n` defaults to 1 and a negative `n` is empty.
 * Reaching `n` closes a passed iterator, as the native `take` does, so a generator is spent.
 * @param n The number of elements to take.
 * @param iterable The iterable to read.
 * @returns An iterator over at most `n` elements.
 */
export function itake<T>(n: number | undefined = 1, iterable: Iterable<T>): IteratorObject<T> {
  return iterate(iterable).take(Math.max(n, 0))
}

/**
 * Returns an Iterator from the elements of a collection or the object keys.
 * @param obj The given collection to iterate over.
 * @returns An Iterator type.
 * @throws {TypeError} when `obj` is neither iterable nor an object.
 */
export function iter<T>(obj: unknown): Iterator<T> {
  const iterable = call(obj, Symbol.iterator)
  if (notNull(iterable)) return iterable as Iterator<T>
  if (!isObject(obj)) throw new TypeError('expected an iterable or an object')
  return Object.keys(obj)[Symbol.iterator]() as Iterator<T>
}

export function partition<T>(iterable: Iterable<T>, predicate: Predicate<T, boolean>): [T[], T[]] {
  assertArrayNotHugeSparse(iterable)
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
  const [start, stop, step] = args.length === 1 ? [0, args[0], 1] : [args[0], args[1], args[2] ?? 1]
  if ([start, stop, step].some((n) => typeof n !== 'number' || Number.isNaN(n))) {
    throw new RangeError('range bounds must be numbers')
  }
  if (!Number.isFinite(start) || !Number.isFinite(step)) {
    throw new RangeError('range start and step must be finite')
  }
  if (step === 0) throw new RangeError('range step must not be zero')
  return (function* () {
    const n = Math.ceil((stop - start) / step)
    for (let i = 0; i < n; i++) {
      // Halves keep the offset finite when the span exceeds Number.MAX_VALUE.
      const value = Number.isFinite(i * step)
        ? start + i * step
        : start + i * (step / 2) + i * (step / 2)
      // Fractional steps can accumulate error and land on or past `stop`.
      if (step > 0 ? !(value < stop) : !(value > stop)) return
      yield value
    }
  })()
}

/**
 * Applies a reducer function on each element of the iterable, in order, passing the return value from the operation on the previous element. The final result of running the reducer across all elements of the iterable is a single value.
 * @example
```js
reduce([1, 2, 3, 4, 5], (x, y) => x + y, 0)
// 15
```
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce Array.reduce()}
 *
 * On arrays it follows `Array.prototype.reduce`: holes are skipped and the index is the real one.
 */
export function reduce<T>(iterable: Iterable<T>, fn: (acc: T, v: T, i: number) => T): T
export function reduce<T, A>(
  iterable: Iterable<T>,
  fn: (acc: A, v: T, i: number) => A,
  initial: A
): A
/**
 * @param iterable The collection to reduce.
 * @param fn A reducer function that will be called per item.
 * @param initial Optional initial value (defaults to the first element in the iterable).
 * @returns The result of calling the reducer on each item.
 */
export function reduce(
  iterable: Iterable<unknown>,
  fn: (acc: unknown, v: unknown, i: number) => unknown,
  initial?: unknown
): unknown {
  if (Array.isArray(iterable)) {
    let hasAcc = arguments.length >= 3
    let acc: unknown = initial
    walkArray(iterable, (event) => {
      if (event.kind === 'holeRun') return
      acc = hasAcc ? fn(acc, event.value, event.index) : event.value
      hasAcc = true
    })
    if (!hasAcc) {
      throw new TypeError('Reduce of empty iterable with no initial value')
    }
    return acc
  }
  const it = Iterator.from(iterable)
  if (arguments.length >= 3) return it.reduce(fn, initial)
  return it.reduce(fn)
}

/**
 * Creates a new array with the elements from the iterable in reverse order. An iterator is read to
 * its end first, so an infinite one never returns.
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
 * A `null` or `undefined` key means identity, so `sorted(it, null, true)` also reverses.
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
  key: ((x: T) => K) | null | undefined,
  reverse: boolean,
  compareFn?: Comparer<K>
): T[]
export function sorted<T, K = T>(
  args: Iterable<T> | Record<string, T>,
  key?: boolean | Predicate<T> | SortOptions<T, K> | null,
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
  } else {
    if (typeof key === 'function') keyFn = key as (x: T) => K
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
 */
export function sort<T>(args: T[], reverse?: boolean | Comparer): T[]
export function sort<T>(args: T[], reverse: boolean, compareFn: Comparer): T[]
/**
 * @param args Array to sort in place.
 * @param reverse Reverse order, or a compare function when arity is 2.
 * @param compareFn Compare function when `reverse` is a boolean.
 */
export function sort<T>(args: T[], reverse?: boolean | Comparer, compareFn?: Comparer): T[] {
  if (typeof reverse === 'function') {
    compareFn = reverse
    reverse = false
  }
  const cmp = compareFn ?? compare
  args.sort(reverse ? (a, b) => -cmp(a, b) : cmp)
  return args
}

/**
 * Returns an array of the first `n` elements; see {@link itake}.
 * @param n The number of elements to take.
 * @param iterable The iterable to read.
 * @returns At most `n` elements.
 */
export function take<T>(n: number | undefined, iterable: Iterable<T>): T[] {
  return itake(n, iterable).toArray()
}

/**
 * Returns an iterator that takes elements from the iterable as long as the predicate is `true`.
 * @param iterable The iterable to inspect.
 * @param predicate A function invoked per element to check if it should be taken.
 * @returns Elements
 */
export function takeWhile<T>(iterable: Iterable<T>, predicate: Predicate<T>): IteratorObject<T> {
  const source = iterate(iterable)
  return closingIterator([source], function* (open) {
    for (const value of drain(open, source)) {
      if (!predicate(value)) return
      yield value
    }
  })
}

/**
 * Returns a generator that produces `fn(index)` for each `index < n`. `n` truncates to an integer,
 * and `times(Infinity)` is a lazy infinite generator.
 * @param n The number of times to invoke `fn`.
 * @param fn A function used to produce the results (default identity).
 */
export function times<T = number>(
  n: number,
  fn: (index: number) => T = identity as (index: number) => T
): IteratorObject<T> {
  const count = Math.trunc(n)
  return (function* () {
    for (let i = 0; i < count; i++) yield fn(i)
  })()
}

/**
 * Returns an iterator that aggregates elements from the iterables producing tuples with the next element from each one.
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
  const sources = (args as Iterable<unknown>[]).map(iterate)
  return closingIterator(sources, function* (open) {
    if (sources.length === 0) return
    for (;;) {
      const items: unknown[] = []
      for (const source of sources) {
        const result = pull(open, source)
        if (result.done) return
        items.push(result.value)
      }
      yield items as T
    }
  })
}
