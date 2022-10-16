/**
 * This module includes classes and functions to work with Container types.
 *
 * @module Collections
 */
import { partial } from '../functools/index.js';
import { call, get, isArray, isArrayLike, isBool, isEmpty, isFunc, isNull, isNumber, isObject, isString, NotImplementedError, set } from '../globals/index.js';
import { comp, eq, id } from '../operators/index.js';
/**
 * A `Collection` is an iterable {@link Container} type.
 * This is an abstract base class for user-defined collection types.
 *
 *
 * @abstract
 * @class Collection
 * @implements {Container}
 */
export class Collection {
    /**
     * Returns an iterator for the container items
     * @return {Iterator}
     */
    [Symbol.iterator]() {
        return this;
    }
    /**
     * Implements the iterator protocol and returns the next item in the iterable.
     */
    next() { }
    /**
     * Adds a new item to the container.
     * @param item - The item to add to the collection.
     */
    add(item) { }
    /**
     * Checks if item is present in the container.
     * @param item - The item to search for in the collection.
     * @returns `true` when the element is found, else `false`
     */
    contains(item) {
        return false;
    }
    /**
     * Returns the total number of elements in the container.
     */
    size() {
        throw new NotImplementedError();
    }
    /**
     * Remove the first item from the container where `item == x`
     * @returns `true` when the element is found and removed, else `false`
     */
    remove(x) {
        return false;
    }
    /**
     * Retrieve and remove the item at index `i`.
     * @returns the item or undefined if not found.
     */
    pop(i) { }
    /**
     * Remove all items from the container
     */
    clear() { }
}
/**
 * A sequence is an iterable {@link Collection} type with efficient index-based access.
 * @abstract
 * @class Sequence
 * @extends {Collection}
 * @template T
 */
export class Sequence extends Collection {
    /**
     * Return the item at the given key or index
     * @param {*} key
     * @memberof Sequence
     */
    get(key) {
        throw new NotImplementedError();
    }
    /**
     * Set a new value at the given key or index
     *
     * @param {*} key
     * @param {T} val
     * @memberof Sequence
     */
    set(key, val) {
        throw new NotImplementedError();
    }
    /**
     * Deletes the given key or index, and its value.
     * Raises ValueError if not key is found.
     *
     * @param {*} key
     * @memberof Sequence
     */
    delete(key) {
        throw new NotImplementedError();
    }
    /**
     * Adds a new item to the end of the sequence.
     *
     * @param {T} x
     * @memberof Sequence
     */
    append(x) { }
    /**
     * Append all the items to the sequence.
     *
     * @param {Iterable<T>} iter
     * @memberof Sequence
     */
    extend(iter) { }
    /**
     * Return the index of x in the sequence, or undefined if not found.
     *
     * @param {T} item
     * @return {(number | undefined)}
     * @memberof Sequence
     */
    indexOf(item) {
        throw new NotImplementedError();
    }
    size() {
        return 0;
    }
    reversed() {
        throw new NotImplementedError();
    }
}
/**
 * Returns a new immutable Set object with elements from `iterable`. Its contents cannot be altered after it's created.
 *
 *
 * @class FrozenSet
 * @extends {Set<T>}
 * @template T
 */
export class FrozenSet extends Set {
    constructor(iterable) {
        super(iterable);
        return this.freeze();
    }
    /** @private */
    add() {
        throw TypeError('FrozenSet cannot be modified.');
        return this; // eslint-disable-line
    }
    /** @private */
    delete() {
        throw TypeError('FrozenSet cannot be modified.');
        return false; // eslint-disable-line
    }
    /** @private */
    clear() {
        throw TypeError('FrozenSet cannot be modified.');
        return this; // eslint-disable-line
    }
    /** @private */
    freeze() {
        return Object.freeze(this);
    }
}
/**
 * Creates a new array with all `falsey` and empty values removed.
 * @param arr The array to compact
 * @returns A new array with the filtered values.
 * @example
```
compact([0, 1, false, 2, '', 3])
// => [1, 2, 3]
```
 */
export const compact = (arr) => arr.filter((x) => !isEmpty(x));
/**
 * Creates a function that can be used to create named tuple-like objects.
 * @example
```
 * let Point = namedtuple('x', 'y', 'z')
 * let userObj = User(0, 0, 0)
 * // => {x: 0, y: 0, z: 0}
```
 * @param fields - A list of field names
 * @returns A function that can be called with the field values
 */
export function namedtuple(...fields) {
    return (...args) => fields.reduce((prev, f, i) => set(f, prev, args[i], false, true), {});
}
/**
 * Iterates over elements of collection, returning an array of all elements where predicate returns truthy value.
 *
 * The predicate is invoked with three arguments: `(value, index|key, arr)`.
 *
 * @example
```
 * let users = [
  { 'user': 'barney', 'age': 36, 'active': true },
  { 'user': 'fred',   'age': 40, 'active': false }
]

filter(users, o => !o.active)
 // => objects for ['fred']

// The shape iteratee shorthand.
filter(users, { age: 36, active: true })
// => objects for ['barney']

// The property iteratee shorthand.
filter(users, 'active')
// => objects for ['barney']
```
 * @param {Array} arr The collection to iterate over
 * @param {Function} fn The predicate function invoked for each item
 * @returns {Array} The new filtered array
 */
export function filter(arr, fn = isNull) {
    if (Array.isArray(arr)) {
        if (typeof fn === 'function')
            return arr.filter(fn);
        if (typeof fn === 'string')
            return arr.filter((x) => get(fn, x));
        if (isObject(fn))
            return arr.filter(matches(fn));
    }
}
/**
 * Iterates over elements of collection, returning the first element where predicate returns truthy value. The predicate is invoked with three arguments: `(value, index|key, collection)`.
 * @example
```
 let users = [
  { 'user': 'barney',  'age': 36, 'active': true },
  { 'user': 'fred',    'age': 40, 'active': false },
  { 'user': 'pebbles', 'age': 1,  'active': true }
]

find(users, (o) => o.age < 40)
// => object for 'barney'

// The shape iteratee shorthand.
find(users, { 'age': 1, 'active': true })
// => object for 'pebbles'

// The `property` iteratee shorthand.
find(users, 'active')
// => object for 'barney'
```
 * @param {Array} arr The collection to iterate over.
 * @param {Function} fn The function invoked per iteration.
 * @returns {*} The matched element, else `undefined`.
 * @see {@link findRight}
 */
export function find(arr, fn) {
    if (Array.isArray(arr)) {
        if (typeof fn === 'function')
            return arr.find(fn);
        if (typeof fn === 'string')
            return arr.find((x) => x?.[fn]);
        if (isObject(fn))
            return arr.find(matches(fn));
    }
}
/**
 * This method is like {@link find} except that it iterates from right to left.
 * @example
```
findRight([1, 2, 3, 4], (n) => n % 2 === 1)
//  => 3
```
 * @param {Array} arr The collection to iterate over.
 * @param {Function} fn The function invoked per iteration.
 * @returns {*} The matched element, else `undefined`.
 * @see {@link find}
 */
export function findRight(arr, fn) {
    if (Array.isArray(arr)) {
        for (let i = arr.length - 1; i >= 0; i--) {
            const x = arr[i];
            if (typeof fn === 'function') {
                if (fn(x))
                    return x;
            }
            else if (typeof fn === 'string') {
                if (x?.[fn])
                    return x;
            }
            else if (isObject(fn)) {
                if (matches(fn)(x))
                    return x;
            }
        }
    }
}
/**
 * Creates a function that performs a partial deep comparison between a given object and `shape`, returning `true` if the given object has equivalent property values, else `false`.
 * @example
```
let objects = [
  { a: 1, b: 2, c: 3 },
  { a: 4, b: 5, c: 6 }
]

filter(objects, matches({ a: 4, c: 6 }))
// => [{ a: 4, b: 5, c: 6 }]
```
 * @param shape
 * @returns
 */
export const matches = (shape) => (obj) => {
    if (!shape || !obj)
        return false;
    for (const key in shape) {
        if (!eq(obj[key], shape[key]))
            return false;
    }
    return true;
};
/**
 * Iterates over elements of collection and invokes `iteratee` for each element. The iteratee is invoked with three arguments: `(value, index|key, collection)`. Iteratee functions may exit iteration early by explicitly returning `false`.
 * @example
```
forEach([1, 2], (value) => {
  console.log(value)
})
// => Logs `1` then `2`.

forEach({ 'a': 1, 'b': 2 }, (value, key) => {
  console.log(key)
})
// => Logs 'a' then 'b' (iteration order is not guaranteed).
```
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Iteratee} fn The function invoked per iteration.
 * @returns {*} Returns `collection`.
 * @see {@link forEachRight}
 * @see {@link filter}
 * @see {@link map}
 */
export function forEach(collection, fn) {
    if (Array.isArray(collection)) {
        for (let i = 0; i < collection.length; i++) {
            const value = collection[i];
            const res = fn(value, i, collection);
            if (res === false)
                return collection;
        }
    }
    else if (isObject(collection)) {
        const keys = Object.keys(collection);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = collection[key];
            const res = fn(value, key, collection);
            if (res === false)
                return collection;
        }
    }
}
/**
 * This method is like {@link forEach} except that it iterates over the collection from right to left.

 * @example
```
forEachRight([1, 2], (value) => {
  console.log(value)
})
// => Logs `2` then `1`.
```
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Iteratee} fn The function invoked per iteration.
 * @returns {*} Returns `collection`.
 * @see {@link forEach}
 * @see {@link filter}
 * @see {@link map}
 */
export function forEachRight(collection, fn) {
    if (Array.isArray(collection)) {
        for (let i = collection.length - 1; i >= 0; i--) {
            const value = collection[i];
            const res = fn(value, i, collection);
            if (res === false)
                return collection;
        }
    }
    else if (isObject(collection)) {
        const keys = Object.keys(collection);
        for (let i = keys.length - 1; i >= 0; i--) {
            const key = keys[i];
            const value = collection[key];
            const res = fn(value, i, collection);
            if (res === false)
                return collection;
        }
    }
    return collection;
}
/**
 * Flattens an array or object. Arrays will be flattened recursively up to `depth` times. Objects will be flattened recursively.
 * @example
```
flatten([1, [2, [3, [4]], 5]])
// => [1, 2, [3, [4]], 5]

flatten({
  dates: {
    expiry_date: '30 sep 2018',
    available: '30 sep 2017',
    min_contract_period: [
      {
        id: 1,
        name: '1 month'
      }
    ]
  },
  price: {
    currency: 'RM',
    value: 1500
  }
})
// => {
  'dates.expiry_date': '30 sep 2018',
  'dates.available': '30 sep 2017',
  'dates.min_contract_period[0].id': 1,
  'dates.min_contract_period[0].name': '1 month',
  'price.currency': 'RM',
  'price.value': 1500
}
```
 * @param {Array|Object} arr The array or object to flatten.
 * @param {number} [depth=1] The max recursion depth.
 * @returns {*} The new flattened array or object.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat Array.flat()}
 */
export function flatten(arr, depth = 1) {
    if (!depth)
        return arr;
    if (Array.isArray(arr))
        return flattenArray(arr, depth, []);
    if (isObject(arr))
        return flattenObj(arr);
    return arr;
}
function flattenArray(arr, depth = 1, result = []) {
    for (const value of arr) {
        if (depth && Array.isArray(value)) {
            flattenArray(value, typeof depth === 'number' ? depth - 1 : depth, result);
        }
        else {
            result.push(value);
        }
    }
    return result;
}
function flattenObj(o, prefix = '', result = {}, keepNull = false) {
    if (isString(o) || isNumber(o) || isBool(o) || (keepNull && isNull(o))) {
        result[prefix] = o;
        return result;
    }
    if (isArray(o) || isObject(o)) {
        for (const i in o) {
            let pref = prefix;
            if (isArray(o)) {
                pref = pref + `[${i}]`;
            }
            else {
                if (isEmpty(prefix)) {
                    pref = i;
                }
                else {
                    pref = prefix + '.' + i;
                }
            }
            flattenObj(o[i], pref, result, keepNull);
        }
        return result;
    }
    return result;
}
/**
 * Creates an array of values by running each element in collection thru iteratee. The iteratee is invoked with three arguments: `(value, index|key, collection)`.
 * @example
```
function square(n) {
  return n * n
}

map([4, 8], square)
// => [16, 64]

map({ a: 4, b: 8 }, square)
// => [16, 64] (iteration order is not guaranteed)

let users = [
  { user: 'barney' },
  { user: 'fred' }
]

// The `property` iteratee shorthand.
map(users, 'user')
// => ['barney', 'fred']
```
 * @param {Array|Object} arr The collection to iterate over.
 * @param {Iteratee|PropertyKey} fn The function invoked per iteration.
 * @returns Returns the new mapped array.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map Array.map()}
 */
export function map(arr, fn) {
    if (Array.isArray(arr)) {
        return arr.map((x, i) => {
            if (typeof fn === 'function')
                return fn(x, i, arr);
            return x?.[fn];
        });
    }
    if (isObject(arr)) {
        return Object.keys(arr).map((key) => {
            if (typeof fn === 'function')
                return fn(arr[key], key, arr);
            return get(fn, arr[key]);
        });
    }
}
/**
 * Creates an object composed of the picked object properties.
 * @param {Object} obj The source object.
 * @param {Iteratee|PropertyKey[]} paths The properties to pick. If `paths` is a function, it will be invoked per property with two values `(value, key)`.
 * @returns A new object with the properties.
 * @example
```
let object = { a: 1, b: '2', c: 3 }

pick(object, ['a', 'c'])
// => { a: 1, c: 3 }

pick(object, (x) => isNumber(x))
// => { a: 1, c: 3 }
```
 *
 * @see {@link omit}
 */
export function pick(obj, paths) {
    if (!obj)
        return {};
    const result = {};
    if (typeof paths === 'function') {
        for (const key in obj) {
            const value = obj[key];
            if (paths(value, key))
                result[key] = value;
        }
        return result;
    }
    for (const key of paths) {
        result[key] = get(key, obj);
    }
    return result;
}
/**
 * The opposite of {@link pick} - this method creates an object composed of the own and inherited enumerable property paths of `object` that are not omitted.
 * @example
```
let object = { 'a': 1, 'b': '2', 'c': 3 }

omit(object, ['a', 'c'])
// => { 'b': '2' }

omit(object, (x) => isNumber(x))
// => { 'b': '2' }
```
 * @param {Object} obj The source object.
 * @param {Iteratee|PropertyKey[]} paths The property paths to omit.
 * @returns {Object} Returns the new object.
 * @see {@link pick}
 */
export function omit(obj, paths) {
    if (!obj)
        return {};
    const result = {};
    if (typeof paths === 'function') {
        for (const key in obj) {
            if (!paths(obj[key], key)) {
                result[key] = obj[key];
            }
        }
        return result;
    }
    const pathset = new Set(paths);
    for (const key in obj) {
        if (!pathset.has(key)) {
            result[key] = obj[key];
        }
    }
    return result;
}
/**
 * Checks if the `value` is in `collection`.
 * @param {string|Array|Object} collection The collection to inspect.
 * @param value The value to search for.
 * @returns {boolean} Returns `true` if value is found, else `false`.
 * @example
```
contains([1, 2, 3], 1)
// => true

contains([1, 2, 3], 1, 2)
// => false

contains({ 'a': 1, 'b': 2 }, 1)
// => true

contains('abcd', 'bc')
// => true
```
 *
 * @see {@link find}
 * @see {@link indexOf}
 */
export function contains(collection, value) {
    if (!collection)
        return false;
    if (typeof collection === 'string')
        return collection.includes(value);
    if (Array.isArray(collection))
        return collection.includes(value);
    return Object.values(collection).includes(value);
}
/**
 * This method is like {@link find} except that it returns the index of the first element `predicate` returns truthy for instead of the element itself.
 * @param {Array} obj The array to inspect.
 * @param {string|Object|Iteratee} fn The predicate function
 * @param {number} [start=0] The index to search from.
 * @returns {number} The index of the found value, else -1
 * @example
```
let users = [
  { 'user': 'barney',  'active': false },
  { 'user': 'fred',    'active': false },
  { 'user': 'pebbles', 'active': true }
]

index(users, (o) => o.user == 'barney')
// => 0

// The `shape` iteratee shorthand.
index(users, { 'user': 'fred', 'active': false })
// => 1

// The `property` iteratee shorthand.
index(users, 'active')
// => 2
```
 * @see {@link indexOf}
 * @see {@link lastIndex}
 *
 */
export function index(obj, fn, start = 0) {
    if (obj == null)
        return;
    const length = obj.length;
    if (length && start < 0) {
        start = Math.max(start + length, 0);
    }
    if (!length || start >= length)
        return -1;
    if (isObject(fn)) {
        fn = matches(fn);
    }
    for (; start < length; start++) {
        if (typeof fn === 'function') {
            if (fn(obj[start], start, obj))
                return start;
        }
        else {
            if (obj[start]?.[fn])
                return start;
        }
    }
    return -1;
}
/**
 * This method is like {@link index} except that it searches for a given value directly, instead of using a predicate function.
 * @param {Array} obj The array to inspect.
 * @param {*} x The value to find
 * @param {number} [start=0] The index to search from.
 * @returns {number} The index of the found value, else -1
 * @example
```
indexOf([1, 2, 1, 2], 2)
// => 1

// Search from a `start` index.
indexOf([1, 2, 1, 2], 2, 2)
// => 3
```
 * @see {@link index}
 * @see {@link lastIndexOf}
 */
export function indexOf(obj, x, start = 0) {
    if (obj == null)
        return;
    const op = call(obj, 'indexOf', x, start);
    if (op != null)
        return op;
    const length = obj.length;
    if (length && start < 0) {
        start = Math.max(start + length, 0);
    }
    if (!length || start >= length)
        return -1;
    for (; start < length; start++) {
        if (eq(x, obj[start]))
            return start;
    }
    return -1;
}
/**
 * This method is like {@link index} except that it iterates the collection from right to left.
 * @param {Array} obj The array to inspect.
 * @param {string|Iteratee|Object} fn The function invoked per iteration.
 * @param {number} [start] The index to search from.
 * @returns {number} The index of the found value, else -1
 * @example
```
let users = [
  { 'user': 'barney',  'active': true },
  { 'user': 'fred',    'active': false },
  { 'user': 'pebbles', 'active': false }
]

findLastIndex(users, (o) => o.user == 'pebbles')
// => 2

// The `shape` iteratee shorthand.
findLastIndex(users, { 'user': 'barney', 'active': true })
// => 0

// The `property` iteratee shorthand.
findLastIndex(users, 'active')
// => 0
```
 * @see {@link index}
 * @see {@link lastIndexOf}
 */
export function lastIndex(obj, fn, start) {
    if (obj == null)
        return;
    const length = obj.length;
    if (start == null)
        start = length - 1;
    if (!length || start < 0)
        return -1;
    if (isObject(fn)) {
        fn = matches(fn);
    }
    for (; start >= 0; start--) {
        if (typeof fn === 'function') {
            if (fn(obj[start]))
                return start;
        }
        else {
            if (obj[start]?.[fn])
                return start;
        }
    }
    return -1;
}
/**
 * This method is like {@link indexOf} except that it iterates the collection from right to left.
 * @param {Array} obj The array to inspect.
 * @param {*} x The value to find
 * @param {number} [start] The index to search from.
 * @returns {number} The index of the found value, else -1
 * @example
```
lastIndexOf([1, 2, 1, 2], 2)
// => 3

// Search from the `fromIndex`.
lastIndexOf([1, 2, 1, 2], 2, 2)
// => 1
```
 * @see {@link lastIndex}
 * @see {@link indexOf}
 */
export function lastIndexOf(obj, x, start) {
    if (obj == null)
        return;
    const op = call(obj, 'lastIndexOf', x, start);
    if (op != null)
        return op;
    const length = obj.length;
    if (start == null)
        start = length - 1;
    if (!length || start < 0)
        return -1;
    for (; start >= 0; start--) {
        if (eq(x, obj[start]))
            return start;
    }
    return -1;
}
/**
 * Creates a shallow clone of `value`. If `deep` is `true` it will clone it recursively.
 * @param {*} value
 * @param {boolean} [deep=false]
 * @return The clone value
 * @see {@link cloneArray}
 * @see {@link cloneTypedArray}
 */
export function clone(value, deep = false) {
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
        return cloneTypedArray(value, deep);
    }
    if (isArray(value) || isArrayLike(value)) {
        return cloneArray(value, deep);
    }
    if (isObject(value)) {
        if (isFunc(value.clone)) {
            return value.clone();
        }
        const copy = {};
        for (const key in value) {
            if (deep) {
                copy[key] = clone(value[key], deep);
            }
            else {
                copy[key] = value[key];
            }
        }
        return copy;
    }
    return value;
}
/**
 * Clones an array. If `deep` is `false` (default) the clone will be shallow. Otherwise {@link https://developer.mozilla.org/en-US/docs/Web/API/structuredClone structuredClone} is used.
 * @param arr The array to clone
 * @param [deep=false] Creates a deep clone using `structuredClone` if true.
 * @returns The new array
 * @see {@link clone}
 */
export function cloneArray(arr, deep = false) {
    if (!deep)
        return Array.from(arr);
    return structuredClone(arr);
}
/**
 * Clones a typed array. If `deep` is `false` (default) the clone will be shallow. Otherwise {@link https://developer.mozilla.org/en-US/docs/Web/API/structuredClone structuredClone} is used.
 * @param arr The array to clone
 * @param [deep=false] Creates a deep clone using `structuredClone` if true.
 * @returns The new array
 * @see {@link clone}
 */
export function cloneTypedArray(typedArray, isDeep) {
    const buffer = isDeep ? structuredClone(typedArray) : typedArray.buffer;
    return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
}
/**
 * Creates a duplicate-free version of an array, using a `Set` for equality comparisons, in which only the first occurrence of each element is kept. The order of result values is not guaranteed.
 * @param arr The array containing duplicated elements
 * @param fn The iteratee invoked per element.
 * @returns Returns the new duplicate free array.
 * @example
```
uniq([2, 1, 2])
// => [2, 1]

uniq([2.1, 1.2, 2.3], Math.floor)
// => [2.1, 1.2]
```
 *
 * @see {@link sortedUniq}
 */
export function uniq(arr, fn = id) {
    const keys = new Set();
    let mapper = typeof fn === 'function' ? fn : (x) => x?.[fn];
    for (const x of arr) {
        keys.add(mapper(x));
    }
    return Array.from(keys.values());
}
/**
 * This method is like {@link uniq} except that it sorts the results in ascending order
 * @param arr The array containing duplicated elements
 * @param fn The iteratee invoked per element.
 * @returns Returns the new duplicate free array
 * @example
```
uniq([2, 1, 2])
// => [1, 2]
```
 * @see {@link uniq}
 */
export function sortedUniq(arr, fn = id) {
    const values = uniq(arr, fn);
    values.sort(comp);
    return values;
}
function baseMergeDeep(obj, source, key, stack) {
    const objValue = obj[key];
    const srcValue = source[key];
    const stacked = stack.get(srcValue);
    if (stacked && (objValue !== stacked || !(key in obj))) {
        obj[key] = stacked;
        return;
    }
    let newValue;
    let isCommon = newValue === undefined;
    const isArray = Array.isArray(srcValue);
    const isTyped = ArrayBuffer.isView(srcValue);
    if (isArray || isTyped) {
        if (Array.isArray(objValue)) {
            newValue = objValue;
        }
        else if (isArrayLike(objValue)) {
            newValue = Array.from(objValue);
        }
        else if (isTyped) {
            isCommon = false;
            newValue = cloneTypedArray(srcValue, true);
        }
        else {
            newValue = [];
        }
    }
    else if (isObject(srcValue)) {
        newValue = objValue;
        if (!isObject(objValue)) {
            newValue = srcValue;
        }
    }
    else {
        isCommon = false;
    }
    if (isCommon) {
        stack.set(srcValue, newValue);
        baseMerge(newValue, srcValue, stack);
        stack.delete(srcValue);
    }
    obj[key] = newValue;
}
function baseMerge(obj, source, stack) {
    if (obj === source)
        return obj;
    for (const key in source) {
        const srcValue = source[key];
        const objValue = obj[key];
        if (typeof srcValue === 'object' && srcValue !== null) {
            baseMergeDeep(obj, source, key, stack || new WeakMap());
        }
        else {
            if (objValue !== srcValue) {
                obj[key] = srcValue;
            }
        }
    }
}
/**
 * Recursively merges own and inherited enumerable string keyed properties of source objects into the destination object. Source properties that resolve to `undefined` are skipped if a destination value exists. Array and plain object properties are merged recursively. Other objects and value types are overridden by assignment. Source objects are applied from left to right. Subsequent sources overwrite property assignments of previous sources.
 *
 * Note: this method mutates `object`
 *
 *
 * @param {Object} object The destination object.
 * @param {...Object} sources The source objects.
 * @returns Returns `object`.
 *
 * @example
```
let object = {
  'a': [{ 'b': 2 }, { 'd': 4 }]
}

let other = {
  'a': [{ 'c': 3 }, { 'e': 5 }]
}

merge(object, other)
// => { 'a': [{ 'b': 2, 'c': 3 }, { 'd': 4, 'e': 5 }] }
```
 */
export function merge(object, ...sources) {
    for (const source of sources) {
        baseMerge(object, source);
    }
    return object;
}
/**
 * Returns a generator of array values not included in the other given arrays using a `Set` for equality comparisons. The order and references of result values are not guaranteed.
 * @param args The initial arrays
 * @example
```
[...difference([2, 1], [2, 3])]
// => [1]
```
 * @see {@link union}
 * @see {@link intersection}
 */
export function* difference(...args) {
    const sets = args.map((arr) => new Set(arr));
    const setA = sets[0];
    for (let i = 1; i < sets.length; i++) {
        for (const x of sets[i].values()) {
            if (!setA.delete(x))
                setA.add(x);
        }
    }
    for (const x of setA.values()) {
        yield x;
    }
}
/**
 * Creates a generator of unique values that are included in all given arrays.
 * @param args The arrays to inspect
 * @example
```
[...intersection([2, 1], [2, 3])]
// => [2]
```
* @see {@link difference}
 * @see {@link union}
 */
export function* intersection(...args) {
    const sets = args.map((arr) => new Set(arr));
    // build a counter map to find items in all
    const results = new Map();
    const total = sets.length;
    for (let i = 0; i < total; i++) {
        for (const x of sets[i].values()) {
            const count = results.get(x) || 0;
            results.set(x, count + 1);
        }
    }
    for (const [key, value] of results.entries()) {
        if (value === total)
            yield key;
    }
}
/**
 * Creates a generator of unique values from all given arrays using `Set` for equality comparisons.
 * @param args The arrays to perform union on.
 * @example
```
[...union([2], [1, 2])]
// => [2, 1]
```
 * @see {@link difference}
 * @see {@link intersection}
 */
export function* union(...args) {
    const results = new Set();
    for (const arr of args) {
        for (const item of arr) {
            results.add(item);
        }
    }
    for (const item of results.values()) {
        yield item;
    }
}
/**
 * Creates an object composed of keys generated from the results of running each element of `arr` thru `func`. The order of grouped values is determined by the order they occur in `arr`. The corresponding value of each key is an array of elements responsible for generating the key.
 *
 * @param arr The collection to iterate over.
 * @param [func=id] The iteratee to transform keys.
 * @returns Returns the composed aggregate object.
 *
 * @example
```
groupBy([6.1, 4.2, 6.3], Math.floor)
// => { '4': [4.2], '6': [6.1, 6.3] }

// The `property` iteratee shorthand.
groupBy(['one', 'two', 'three'], 'length')
// => { '3': ['one', 'two'], '5': ['three'] }
```
 */
export function groupBy(arr, func = id) {
    const results = {};
    let useKey = typeof func === 'function' ? func : partial(get, func);
    if (Array.isArray(arr)) {
        for (let i = 0; i < arr.length; i++) {
            const groupKey = useKey(arr[i]);
            const values = results[groupKey] || [];
            values.push(arr[i]);
            results[groupKey] = values;
        }
    }
    else {
        for (const k in arr) {
            const groupKey = useKey(arr[k]);
            const values = results[groupKey] || [];
            values.push(arr[k]);
            results[groupKey] = values;
        }
    }
    return results;
}
