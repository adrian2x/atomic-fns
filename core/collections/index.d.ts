/**
 * This module includes classes and functions to work with Container types.
 *
 * @module Collections
 */
import { Iteratee } from '../globals/index.js';
export * from './abc.js';
export * from './BTree.js';
export * from './deque.js';
export * from './frozenset.js';
export * from './Heap.js';
export * from './LRUCache.js';
export * from './SortedSet.js';
export * from './SortedMap.js';
export * from './SortedTree.js';
export * from './SplayTree.js';
/**
 * Creates a new array with all falsy and empty values removed.
 * @param arr The array to compact
 * @returns A new array with the filtered values.
 * @example
```js
compact([0, 1, false, 2, '', 3])
// => [1, 2, 3]
```
 */
export declare function compact(arr: any[]): any;
export declare function compact(arr: Object): any;
export declare function count<T>(iterable: Iterable<T> | Object, func: Iteratee<T>): {};
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
export declare function namedtuple(...fields: string[]): (...args: any[]) => {};
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
export declare function filter(arr: any, fn?: Iteratee | PropertyKey | Object): any[] | undefined;
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
export declare function find(arr: any, fn: Iteratee | PropertyKey | Object): any;
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
export declare function findRight(arr: any, fn: Iteratee | PropertyKey | Object): any;
/**
 * Performs an efficient array insert operation in the given array. If the index or the array is invalid, it just returns the given array.
 *
 * @param {Array<*>} arr The given array to insert into
 * @param {number} index The index of the array insert operation.
 * @param {*} value The value to insert in the array at the given `index`.
 * @returns {Array<*>} The given array.
 */
export declare function insert(arr: any[], index: number, value: any): any[];
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
export declare const matches: (shape: any) => (obj: any) => boolean;
/**
 * Iterates over elements of collection and invokes `iteratee` for each element. The iteratee is invoked with three arguments: `(value, index|key, collection)`. Iteratee functions may exit iteration early by explicitly returning `false`.
 * @example
```js
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
export declare function forEach<T>(collection: T[], fn: Iteratee<T>): any;
export declare function forEach<T>(collection: Iterable<T>, fn: Iteratee<T>): any;
export declare function forEach<T>(collection: Object, fn: Iteratee<T>): any;
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
export declare function forEachRight(collection: any[] | Object, fn: Iteratee): Object;
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
export declare function flatten(arr: any[] | Object, depth?: boolean | number): Object;
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
export declare function map(arr: any, fn: Iteratee | PropertyKey): any[] | undefined;
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
export declare function pick(obj: Object, paths: Iteratee | PropertyKey[]): {};
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
export declare function omit(obj: Object, paths: Iteratee | PropertyKey[]): {};
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
export declare function index(obj: any, fn: Iteratee | string | Object, start?: number): number | undefined;
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
export declare function indexOf(obj: any, value: any, start?: number): any;
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
export declare function lastIndex(obj: any[], fn: string | Iteratee | Object, start?: any): any;
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
export declare function lastIndexOf(obj: any[], value: any, start?: any): any;
/**
 * Creates a shallow clone of `value`. If `deep` is `true` it will clone it recursively.
 * @param {*} value
 * @param {boolean} [deep=false]
 * @return The clone value
 * @see {@link cloneArray}
 * @see {@link cloneTypedArray}
 */
export declare function clone(value: any, deep?: boolean): any;
/**
 * Clones an array. If `deep` is `false` (default) the clone will be shallow. Otherwise {@link https://developer.mozilla.org/en-US/docs/Web/API/structuredClone structuredClone} is used.
 * @param arr The array to clone
 * @param [deep=false] Creates a deep clone using `structuredClone` if true.
 * @returns The new array
 * @see {@link clone}
 */
export declare function cloneArray(arr: any, deep?: boolean): any;
/**
 * Clones a typed array. If `deep` is `false` (default) the clone will be shallow. Otherwise {@link https://developer.mozilla.org/en-US/docs/Web/API/structuredClone structuredClone} is used.
 * @param arr The array to clone
 * @param [deep=false] Creates a deep clone using `structuredClone` if true.
 * @returns The new array
 * @see {@link clone}
 */
export declare function cloneTypedArray(typedArray: any, isDeep: any): any;
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
export declare function uniq<T = any>(arr: T[], fn?: PropertyKey | Iteratee): T[];
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
export declare function sortedUniq(arr: any, fn?: string | Iteratee): any[];
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
export declare function merge(object: any, ...sources: any[]): Object;
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
export declare function defaults(object: Object, ...sources: Object[]): Object;
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
export declare function difference(...args: Array<Iterable<any>>): Generator<any, void, unknown>;
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
export declare function intersection(...args: Array<Iterable<any>>): Generator<any, void, unknown>;
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
export declare function union(...args: Array<Iterable<any>>): Generator<unknown, void, unknown>;
/**
 * Creates an object composed of keys generated from the results of running each element of `arr` thru `func`. The order of grouped values is determined by the order they occur in `arr`. The corresponding value of each key is an array of elements responsible for generating the key.
 *
 * @param arr The collection to iterate over.
 * @param [func=id] The iteratee to transform keys.
 * @returns Returns the aggregated object.
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
export declare function groupBy(arr: Iterable<any> | Object, func?: Iteratee | PropertyKey): Object;
/**
 * Similar to {@link groupBy} but it returns a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map Map} object with the results.
 *
 * @param arr The collection to iterate over.
 * @param {Function | PropertyKey} [func=id] The iteratee to transform keys.
 * @returns {Map} Returns the aggregated map object.
 * @template K, V
 *
 * @example
```js
groupByMap([6.1, 4.2, 6.3], Math.floor)
// => Map { 4: [4.2], 6: [6.1, 6.3] }

// The `property` iteratee shorthand.
groupByMap(['one', 'two', 'three'], 'length')
// => Map { 3: ['one', 'two'], 5: ['three'] }
```
 */
export declare function groupByMap<K = any, V = any>(arr: Iterable<any> | Object, func?: Iteratee | PropertyKey): Map<K, V[]>;
/**
 * Removes all elements from array that `func` returns truthy for and returns an array of the removed elements.
 * @param arr The array to remove from.
 * @param func The function invoked per iteration or value(s) or value to remove.
 * @returns
 */
export declare function remove<T>(arr: T[], func: any): T[];
