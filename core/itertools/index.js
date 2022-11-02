/**
 * This module includes functions that deal with or produce iterators.
 *
 * @module Iterators
 */
import { call, isEmpty, isObject, notNull, ValueError } from '../globals/index.js';
import { add, bool, compare, eq, id } from '../operators/index.js';
/**
 * Make an iterator that returns accumulated sums, or accumulated results of other binary functions (specified via the optional `func` argument).
 * @param iterable The iterable to accumulate
 * @param func The accumulator function (default `add`).
 * @param initial Optional initial value (defaults to the first element in iterable)
 * @returns A sequence of accumulated values
 */
export function* accumulate(iterable, func = add, initial) {
    const it = iter(iterable);
    let total = initial;
    let head = it.next();
    if (initial == null)
        total = head.value;
    while (!head.done) {
        yield total;
        head = it.next();
        if (head.done)
            return;
        total = func(total, head.value);
    }
}
/**
 * Returns `true` when all of the items in iterable are truthy. An optional predicate function can be used to define what truthiness means for this specific collection.
 * @param iterable
 * @param fn
 * @returns `True` if all elements pass the test or are truthy else `false`.
 * @example
```js
all([0])
// true

all([1, 2, 3])
// true

all([2, 4, 6] => (n) => n > 1)
// true
```
@see {@link any}
 */
export const all = (iterable, fn = bool) => {
    for (const item of iterable) {
        if (!fn(item))
            return false;
    }
    return true;
};
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

any([1, 4, 5] => (n) => n % 2 === 0)
// true
```
@see {@link all}
 */
export const any = (iterable, fn = bool) => {
    for (const item of iterable) {
        if (fn(item))
            return true;
    }
    return false;
};
export function chain(...iterables) {
    return iflatten(iterables);
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

contains([1, 2, 3], 1, 2)
// false

contains({ 'a': 1, 'b': 2 }, 1)
// true

contains('abcd', 'bc')
// true
```
 *
 * @see {@link Collections.find}
 */
export function contains(collection, value) {
    if (!collection)
        return false;
    const includes = call(collection, 'includes', value);
    if (includes != null)
        return includes;
    return any(collection, (x) => eq(value, x));
}
const compKey = (compare, key) => (x, y) => compare(key(x), key(y));
/**
 * Returns a generator that drops elements from the iterable as long as the predicate is `true`; afterwards, returns every remaining element. Note, the generator does not produce any output until the predicate first becomes `false`.
 * @param iterable The iterable to inspect.
 * @param predicate A function invoked per element to check if it should be dropped.
 * @returns Elements
 */
export function* dropWhile(iterable, predicate) {
    const it = iter(iterable);
    while (true) {
        const head = it.next();
        if (!predicate(head.value)) {
            if (head.done)
                return head.value;
            yield head.value;
            break;
        }
    }
    while (true) {
        const head = it.next();
        if (head.done)
            return head.value;
        yield head.value;
    }
}
export function iforEach(iterable, fun) {
    for (const [index, value] of enumerate(iterable)) {
        if (fun(value, index, iterable) === false) {
            return;
        }
    }
}
export function IterableIterator(next) {
    const it = {
        next,
        [Symbol.iterator]() {
            return this;
        }
    };
    return it;
}
/**
 * Yields elements like `[index, item]` from an iterable. Index starts at zero by default.
 * @template T
 * @param iterable The iterable to inspect.
 * @param start The starting index.
 * @returns A generator with tuples like `[index, item]`.
 * @example
```js
console.log([...enumerate(['hello', 'world'])])
// [[0, 'hello'], [1, 'world']]

// Start with index `1`
console.log([...enumerate(['hello', 'world'], 1)])
// [[1, 'hello'], [2, 'world']]
```
 */
export function* enumerate(iterable, start = 0) {
    let index = start;
    for (const item of iterable) {
        yield [index++, item];
    }
}
/**
 * Returns the first element in an iterable.
 * @param iterable The iterable to inspect.
 * @returns The first element found or undefined if iterable is empty.
 */
export function first(iterable) {
    return iter(iterable).next().value;
}
/**
 * Creates a new generator that filters all falsy and empty values from iterable.
 * @param arr The array to compact
 * @returns A new array with the filtered values.
 * @example
```js
compact([0, 1, false, 2, '', 3])
// [1, 2, 3]
```
 */
export function* icompact(iterable) {
    for (const value of iterable) {
        if (!isEmpty(value))
            yield value;
    }
}
/**
 * Iterates over elements of collection, producing only those elements where predicate returns a `truthy` value.
 */
export function* ifilter(iterable, predicate) {
    for (const value of iterable) {
        if (predicate(value))
            yield value;
    }
}
export function* imap(iterable, mapFn) {
    for (const item of iterable) {
        yield mapFn(item);
    }
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
export function* iflatten(iterables) {
    for (const iterator of iterables) {
        for (const item of iterator) {
            yield item;
        }
    }
}
export function flatMap(iterable, mapFn = id) {
    return iflatten(imap(iterable, mapFn));
}
export function* islice(iterable, start, stop, step = 1) {
    if (stop != null && stop < 0)
        throw new ValueError(`stop parameter can't be negative`);
    if (start < 0)
        throw new ValueError(`start parameter can't be negative`);
    if (stop != null && start > stop)
        throw new ValueError(`start parameter can't be after stop`);
    if (step < 0)
        throw new ValueError(`step parameter can't be negative`);
    for (const [i, value] of enumerate(iterable)) {
        if (i === start) {
            if (stop && start + step > stop)
                return value;
            yield value;
            start += step;
        }
    }
}
export function* itake(n, iterable) {
    const it = iter(iterable);
    while (n-- > 0) {
        const item = it.next();
        if (!item.done)
            yield item.value;
        else
            return;
    }
}
/**
 * Returns an Iterator from the elements of a collection or the object keys.
 * @param obj The given collection to iterate over.
 * @returns An Iterator type.
 */
export function iter(obj) {
    const iterable = call(obj, Symbol.iterator);
    if (notNull(iterable))
        return iterable;
    return Object.keys(obj)[Symbol.iterator]();
}
export function partition(iterable, predicate) {
    const left = [];
    const right = [];
    for (const value of iterable) {
        if (predicate(value))
            left.push(value);
        else
            right.push(value);
    }
    return [left, right];
}
/**
 * Returns a generator for a sequence of numbers in the given range, starting from `start` (default 0) to `stop` (not-inclusive) in increments of `step` (default 1).
 *
 * `range(x)` is a shorthand for `range(0, x, 1)`.
 * @param args When called with a single argument, it is assigned to `stop` param. If two arguments are given, it will assign them to `(start, stop)`. When three arguments, it means `(start, stop, step)`.
 * @example
```js
range(5)
// [0, 1, 2, 3, 4]

range(2, 5)
// [2, 3, 4]

range(0, 5, 2)
// [0, 2, 4]

range(5, 0, -1)
// [5, 4, 3, 2, 1]

range(-3)
// []
```
 */
export function* range(...args) {
    let start = 0;
    let stop = 0;
    let step = 1;
    if (args.length === 1) {
        stop = args[0];
        if (stop < 0)
            step = -1;
    }
    else if (args.length === 2) {
        start = args[0];
        stop = args[1];
    }
    else {
        start = args[0];
        stop = args[1];
        step = args[2] || 1;
    }
    for (; step > 0 ? start < stop : start > stop; start += step) {
        yield start;
    }
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
export function reduce(iterable, reducer, initial) {
    const it = iter(iterable);
    let output = initial ?? it.next().value;
    for (const [index, value] of enumerate(it)) {
        output = reducer(output, value, index);
    }
    return output;
}
/**
 * Creates a new array with the elements from the iterable in reverse order.
 * @param iterable The iterable to inspect.
 * @returns A new array with the elements reversed.
 */
export function reversed(iterable) {
    return Array.from(iterable).reverse();
}
/**
 * Creates a new sorted list from the elements in the array. This can be called many ways:
 *   - sorted([...], true) => reverse order
 *   - sorted([...], fn = (x) => any) => using a key fn
 *   - sorted([...], fn = (x) => any, true) => reverse order using key
 *   - sorted([...], false, (x, y) => number) => using custom compare
 *   - sorted([...], fn = (x) => any, true, (x, y) => number) => custom key, reverse and compare
 *
 * If `args` is an Object, returns the sorted keys.
 *
 *
 * @param {(Array | Object)} args
 * @param {(boolean | Function)} [key]
 * @param {(boolean | Comparer)} [reverse]
 * @param {Comparer} [compareFn]
 * @return
 */
export function sorted(args, key, reverse, compareFn) {
    if (isObject(args))
        args = Object.keys(args);
    if (typeof key === 'boolean') {
        if (typeof reverse === 'function') {
            compareFn = reverse;
            reverse = false;
        }
        else {
            reverse = true;
        }
        key = id;
    }
    const copy = Array.from(args);
    const _compare = compKey(compareFn || compare, key || id);
    copy.sort(_compare);
    if (reverse)
        copy.reverse();
    return copy;
}
/**
 * Sort `args` in place. Can be called like this:
 *   - sort([...], true) => reverse order
 *   - sort([...], (x, y) => number) => using custom compare
 *   - sort([...], true, (x, y) => number) => reverse and using custom compare
 *
 * @param {any[]} args
 * @param {(boolean | Comparer)} [reverse]
 * @param {Comparer} [compareFn]
 * @return
 */
export function sort(args, reverse, compareFn) {
    if (typeof reverse === 'function') {
        compareFn = reverse;
        reverse = false;
    }
    args.sort(compareFn || compare);
    if (reverse === true)
        args.reverse();
    return args;
}
export function take(n, iterable) {
    return [...itake(n, iterable)];
}
/**
 * Returns a generator that takes elements from the iterable as long as the predicate is `true`.
 * @param iterable The iterable to inspect.
 * @param predicate A function invoked per element to check if it should be taken.
 * @returns Elements
 */
export function* takeWhile(iterable, predicate) {
    for (const value of iterable) {
        if (!predicate(value))
            return;
        yield value;
    }
}
/** Returns a generator that calls `fn(index)` for each index < n */
/**
 * Returns a generator that produces `fn(index)` for each `index < n`.
 * @param n The number of times to invoke `fn`.
 * @param fn A function used to produce the results.
 */
export function* times(n, fn) {
    for (let i = 0; i < n; i++)
        yield fn(i);
}
/**
 * Returns a generator that aggregates elements from the iterables producing tuples with the next element from each one.
 * @param args The iterables to zip
 * @returns Tuples with elements from each iterator
 * @example
```js
for item of zip([1, 2, 3], ['sugar', 'spice', 'nice'])
  console.log(item)
// [1, 'sugar']
// [2, 'spice']
// [3, 'nice']
```
 */
export function* zip(...args) {
    const iterables = args.map(iter);
    while (true) {
        const items = [];
        for (const iterator of iterables) {
            const { value, done } = iterator.next();
            if (done)
                return;
            items.push(value);
        }
        yield items;
    }
}
