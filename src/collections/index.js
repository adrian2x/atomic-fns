/**
 * This module includes classes and functions to work with Container types.
 *
 * @module Collections
 */
import { partial } from '../functools/index.js';
import { call, get, isArray, isArrayLike, isBool, isEmpty, isFunc, isIterable, isNull, isNumber, isObject, isString, isSymbol, keys, set } from '../globals/index.js';
import { enumerate } from '../itertools/index.js';
import { compare, eq, id } from '../operators/index.js';
export * from './abc.js';
export * from './deque.js';
export * from './frozenset.js';
export function compact(arr) {
    if (arr == null)
        return;
    if (Array.isArray(arr))
        return arr.filter((x) => !isEmpty(x));
    const result = {};
    for (const key of Object.keys(arr)) {
        if (!isEmpty(arr[key])) {
            result[key] = arr[key];
        }
    }
    return result;
}
export function count(iterable, func) {
    const counters = {};
    forEach(iterable, (value, key) => {
        const result = func(value, key);
        counters[result] = get(result, counters, 0) + 1;
    });
    return counters;
}
/**
 * Creates a function that can be used to create named tuple-like objects.
 * @example
```js
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
```js
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
        if (isFunc(fn))
            return arr.filter(fn);
        if (isNumber(fn) || isString(fn) || isSymbol(fn))
            return arr.filter((x) => get(fn, x));
        if (isObject(fn))
            return arr.filter(matches(fn));
    }
}
/**
 * Iterates over elements of collection, returning the first element where predicate returns truthy value. The predicate is invoked with three arguments: `(value, index|key, collection)`.
 * @example
```js
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
        if (isFunc(fn))
            return arr.find(fn);
        if (isNumber(fn) || isString(fn) || isSymbol(fn))
            return arr.find((x) => x?.[fn]);
        if (isObject(fn))
            return arr.find(matches(fn));
    }
}
/**
 * This method is like {@link find} except that it iterates from right to left.
 * @example
```js
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
```js
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
        if (obj[key] !== shape[key])
            return false;
    }
    return true;
};
export function forEach(collection, fn) {
    if (Array.isArray(collection)) {
        for (let i = 0; i < collection.length; i++) {
            const res = fn(collection[i], i, collection);
            if (res === false)
                return collection;
        }
    }
    else if (isIterable(collection)) {
        for (const [index, value] of enumerate(collection)) {
            const res = fn(value, index, collection);
            if (res === false)
                return collection;
        }
    }
    else {
        for (const key of keys(collection)) {
            const res = fn(collection[key], key, collection);
            if (res === false)
                return collection;
        }
    }
}
/**
 * This method is like {@link forEach} except that it iterates over the collection from right to left.

 * @example
```js
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
```js
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
function flattenObj(obj, prefix = '', result = {}, keepNull = false) {
    if (isString(obj) || isNumber(obj) || isBool(obj) || (keepNull && isNull(obj))) {
        result[prefix] = obj;
        return result;
    }
    if (isArray(obj) || isObject(obj)) {
        for (const i of Object.keys(obj)) {
            let pref = prefix;
            if (isArray(obj)) {
                pref = `${pref}[${i}]`;
            }
            else {
                if (prefix) {
                    pref = `${prefix}.${i}`;
                }
                else {
                    pref = i;
                }
            }
            flattenObj(obj[i], pref, result, keepNull);
        }
        return result;
    }
    return result;
}
/**
 * Creates an array of values by running each element in collection thru iteratee. The iteratee is invoked with three arguments: `(value, index|key, collection)`.
 * @example
```js
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
```js
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
        for (const key of Object.keys(obj)) {
            if (paths(obj[key], key)) {
                result[key] = obj[key];
            }
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
```js
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
        for (const key of Object.keys(obj)) {
            if (!paths(obj[key], key)) {
                result[key] = obj[key];
            }
        }
        return result;
    }
    Object.assign(result, obj);
    for (const key of paths) {
        delete result[key];
    }
    return result;
}
/**
 * This method is like {@link find} except that it returns the index of the first element `predicate` returns truthy for instead of the element itself.
 * @param {Array} obj The array to inspect.
 * @param {string|Object|Iteratee} fn The predicate function
 * @param {number} [start=0] The index to search from.
 * @returns {number} The index of the found value, else -1
 * @example
```js
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
 * @param {*} value The value to find
 * @param {number} [start=0] The index to search from.
 * @returns {number} The index of the found value, else -1
 * @example
```js
indexOf([1, 2, 1, 2], 2)
// => 1

// Search from a `start` index.
indexOf([1, 2, 1, 2], 2, 2)
// => 3
```
 * @see {@link index}
 * @see {@link lastIndexOf}
 */
export function indexOf(obj, value, start = 0) {
    if (obj == null)
        return;
    const op = call(obj, 'indexOf', value, start);
    if (op != null)
        return op;
    const length = obj.length;
    if (length && start < 0) {
        start = Math.max(start + length, 0);
    }
    if (!length || start >= length)
        return -1;
    for (; start < length; start++) {
        if (eq(value, obj[start]))
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
```js
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
 * @param {*} value The value to find
 * @param {number} [start] The index to search from.
 * @returns {number} The index of the found value, else -1
 * @example
```js
lastIndexOf([1, 2, 1, 2], 2)
// => 3

// Search from the `fromIndex`.
lastIndexOf([1, 2, 1, 2], 2, 2)
// => 1
```
 * @see {@link lastIndex}
 * @see {@link indexOf}
 */
export function lastIndexOf(obj, value, start) {
    if (obj == null)
        return;
    const op = call(obj, 'lastIndexOf', value, start);
    if (op != null)
        return op;
    const length = obj.length;
    if (start == null)
        start = length - 1;
    if (!length || start < 0)
        return -1;
    for (; start >= 0; start--) {
        if (eq(value, obj[start]))
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
```js
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
    const mapper = typeof fn === 'function' ? fn : (x) => x?.[fn];
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
```js
uniq([2, 1, 2])
// => [1, 2]
```
 * @see {@link uniq}
 */
export function sortedUniq(arr, fn = id) {
    const values = uniq(arr, fn);
    values.sort(compare);
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
    for (const key of Object.keys(source)) {
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
```js
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
 * Assigns own and inherited enumerable string keyed properties of source objects to the destination object for all destination properties that resolve to `undefined`. Source objects are applied from left to right. Once a property is set, additional values of the same property are ignored.
 * **Note:** This method mutates `object`.

 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @returns Returns `object`.
 * @example
```js
defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 })
// => { 'a': 1, 'b': 2 }
```
 */
export function defaults(object, ...sources) {
    for (const source of sources) {
        for (const key in source) {
            if (object[key] === undefined) {
                object[key] = source[key];
            }
        }
    }
    return object;
}
/**
 * Returns a generator of array values not included in the other given arrays using a `Set` for equality comparisons. The order and references of result values are not guaranteed.
 * @param args The initial arrays
 * @example
```js
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
```js
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
```js
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
```js
groupBy([6.1, 4.2, 6.3], Math.floor)
// => { '4': [4.2], '6': [6.1, 6.3] }

// The `property` iteratee shorthand.
groupBy(['one', 'two', 'three'], 'length')
// => { '3': ['one', 'two'], '5': ['three'] }
```
 */
export function groupBy(arr, func = id) {
    const results = {};
    const useKey = typeof func === 'function' ? func : partial(get, func);
    forEach(arr, (value) => {
        const groupKey = useKey(value);
        const values = results[groupKey] || [];
        values.push(value);
        results[groupKey] = values;
    });
    return results;
}
/**
 * Removes all elements from array that `func` returns truthy for and returns an array of the removed elements.
 * @param arr The array to remove from.
 * @param func The function invoked per iteration or value(s) or value to remove.
 * @returns
 */
export function remove(arr, func) {
    return arr.filter((x, i) => {
        if (isArray(func))
            return !func.includes(x);
        else if (isFunc(func))
            return !func(x, i, arr);
        return x !== func;
    });
}
// TODO: binary search utils
// TODO: heap/heapify
// TODO: deque
// TODO: Counter
// TODO: Skip list
// TODO: BST (BTree)
