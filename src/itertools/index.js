/**
 * This module includes functions that deal with or produce iterators.
 *
 * @module Iterators
 */
import { call, isObject, len, notNull } from '../globals/index.js';
import { comp, id } from '../operators/index.js';
const compKey = (cmp, key) => (x, y) => cmp(key(x), key(y));
export function iter(obj) {
    const iterable = call(obj, Symbol.iterator);
    if (notNull(iterable))
        return iterable;
    return Object.entries(obj)[Symbol.iterator]();
}
export function* range(...args) {
    if (args.length === 1) {
        const stop = args[0];
        for (let i = 0; i < stop; i++) {
            yield i;
        }
    }
    else if (args.length === 2) {
        let [start, stop] = args;
        for (; start < stop; start++) {
            yield start;
        }
    }
    else {
        let [start, stop, step] = args;
        for (; start < stop; start += step) {
            yield start;
        }
    }
}
/** Creates a new list with the elements from the iterable in reverse order. */
export function reversed(iterable) {
    return Array.from(iterable).reverse();
}
/**
 * Creates a new list from `args` and sorts it. This can be called many ways:
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
 * @param {(boolean | Comp)} [reverse]
 * @param {Comp} [compareFn]
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
    const _compare = compKey(compareFn || comp, key || id);
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
 * @param {(boolean | Comp)} [reverse]
 * @param {Comp} [compareFn]
 * @return
 */
export function sort(args, reverse, compareFn) {
    if (typeof reverse === 'function') {
        compareFn = reverse;
        reverse = false;
    }
    args.sort(compareFn || comp);
    if (reverse === true)
        args.reverse();
    return args;
}
/** Returns a generator that calls `fn(index)` for each index < n */
export function* times(n, fn) {
    for (let i = 0; i < n; i++)
        yield fn(i);
}
export function* zip(...args) {
    const size = len(args[0]);
    for (let i = 0; i < size; i++) {
        const tuple = [];
        for (let k = 0; k < args.length; k++) {
            const item = args[k][i];
            tuple.push(item);
        }
        yield tuple;
    }
}
