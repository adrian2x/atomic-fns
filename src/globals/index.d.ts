/**
 * This module includes global functions and constants.
 *
 * @module Globals
 */
/** Describes a function used to compare two values.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#description Array.sort()}
 */
export declare type Comp = (x: any, y: any) => -1 | 0 | 1;
/** This is just a noop function. */
export declare const _: () => void;
/**
 * A generic function type with arbitrary arguments and return.
 */
export declare type Function<T = any> = (...args: any) => T;
/**
 * An iteratee function used for collection methods.
 * @see {@link Collections.filter}
 * @see {@link Collections.find}
 * @see {@link Collections.forEach}
 * @see {@link Collections.index}
 * @see {@link Collections.map}
 * @see {@link Collections.pick}
 * @see {@link Collections.omit}
 * @see {@link Collections.uniq}
 * @see {@link Collections.sortedUniq}
 * @see {@link Collections.groupBy}
 */
export declare type Iteratee<T = any> = (value: T, key?: any, arr?: any) => any;
export declare type Predicate<T = any> = (value: T) => any;
/** A function that always returns `true`. */
export declare const True: () => boolean;
/** A function that always returns `false`. */
export declare const False: () => boolean;
/**
 * A custom error class that inherits from the Error object.
 * @class CustomError
 * @extends {Error}
 */
export declare class CustomError extends Error {
    /**
     * Returns a new CustomError with the specified message.
     * @param {string} message
     * @constructor
     */
    constructor(message?: string);
}
/**
 * Custom error to signal an invalid index access.
 * @extends {CustomError}
 */
export declare class IndexError extends CustomError {
}
/**
 * Raised when a system function returns an I/O failure such as "file not found"
 * or "disk full".
 * @extends {CustomError}
 */
export declare class IOError extends CustomError {
}
/**
 * Custom error to signal an invalid key access.
 * @extends {CustomError}
 */
export declare class KeyError extends CustomError {
}
/**
 * Custom error to signal an invalid operation.
 * @extends {CustomError}
 */
export declare class NotImplementedError extends CustomError {
}
/**
 * Custom error to signal an invalid value.
 * @extends {CustomError}
 */
export declare class ValueError extends CustomError {
}
/**
 * Raised when the second argument of a division or modulo operation is zero.
 * @extends {CustomError}
 */
export declare class ZeroDivisionError extends CustomError {
}
/**
 * Returns the true type of any value with correct detection for null, Array,
 * Object, Promise, Symbol, and NaN. The correct values are inferred from {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toStringTag | Symbol.toStringTag} and the value's prototype.
 * @param value
 * @returns The value type.
 */
export declare function type(value: any): any;
/**
 * Returns a string representing the object.
 * @param obj
 * @returns `obj.toString()` or `''` if `obj` is `null` or `undefined`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString | Object.toString }
 */
export declare const str: (obj: any) => any;
/** Check if value is a boolean type. */
export declare const isBool: (x: any) => x is boolean;
/** Check if value is an iterable type. */
export declare const isIterable: (x: any) => x is IterableIterator<any>;
/** Check if value is an object type. */
export declare const isObject: (x: any) => x is Object;
/** Check if value is a string type. */
export declare const isString: (x: any) => x is string;
/** Check if value is an Array type. */
export declare const isArray: (x: any) => x is any[];
/**
 * Check if value is Array-like type.
 * A value is considered array-like if it's not a function and has a `.length` number property.
 */
export declare const isArrayLike: (x: any) => boolean;
/** Check if value is a function type. */
export declare const isFunc: (x: any) => x is Function<any>;
/** Check if value is a number type. */
export declare const isNumber: (x: any) => x is number;
/** Check if value is a bigint type. */
export declare const isBigint: (x: any) => x is BigInt;
/** Check if value is NaN based on `Number.isNaN`. */
export declare const isNaN: (x: any) => x is number;
/** Check if value is a Promise type. */
export declare const isPromise: (x: any) => x is Promise<any>;
/** Check if value is an async function type. */
export declare const isAsync: (x: any) => boolean;
/** Check if value is a generator function type. */
export declare const isGenerator: (x: any) => x is Generator<unknown, any, unknown>;
/** Check if value is `null` or `undefined`. */
export declare const isNull: (x: any) => x is null | undefined;
/** Check if value is not `null` or `undefined`. */
export declare const notNull: (x: any) => boolean;
/** Returns `true` for objects without length or falsey values. */
export declare const isEmpty: (x: any) => boolean;
/** Check if value is a `Symbol` type */
export declare const isSymbol: (x: any) => x is symbol;
/**
 * Returns the number of elements in a collection type.
 *
 * If `value.length` or `value.size()` is defined, this will be returned.
 * If `value` is an `Object`, it returns the number of keys.
 * @param value
 * @returns The number of elements in the collection or `undefined`.
 */
export declare function len(value: any): any;
/**
 * Generates a unique ID using random numbers. If a prefix is given, the ID is appended to it and returned as a string.
 * @param {string} [pre=''] The id prefix.
 * @returns {number|string} Returns the numeric or string ID.
 * @example
```js
uniqueId()
// => 3445556877

uniqueId('user_')
// => 'user_1033763188'
```
 */
export declare const uniqueId: (pre?: string) => any;
/**
 * Generates a monotonically increasing, pseudo-random based uuid-v4 string. These are sortable, url-friendly and are 100% unique if the IDs are generated more than 1 millisecond apart. If two IDs are generated at the same millisecond, the chance of collision is still pretty low (1 in 10^15).
 * @returns Returns a GUID formatted string.
 * @example
```js
uuid()
// => '183f8ef3-b8f0-4000-81f5-89234c836d00'
```
 */
export declare const uuid: () => string;
/**
 * Checks if `obj.key` is a function, and calls it with any given `args`.
 * @param {*} obj
 * @param {PropertyKey} key
 * @param {...any[]} args
 * @return `obj.key(...args)` or `undefined`.
 */
export declare function call(obj: any, key: PropertyKey, ...args: any[]): any;
/** Convert number to unicode character */
export declare const chr: (x: number) => string;
/** Convert character to Unicode code point */
export declare const ord: (x: string) => number;
/**
 * Returns an array of the own enumerable property names of `object`.
 * @param object The given object.
 * @returns The array of object keys.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys Object.keys()}
 */
export declare const keys: (object: Object) => string[];
/**
 * Returns an array of the own enumerable property values of `object`.
 * @param object The given object.
 * @returns The array of object keys.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/values Object.values()}
 */
export declare const values: (object: any) => unknown[];
/**
 * Check if a given property is present in a given object.
 * @param obj The object to check.
 * @param attr A property key name.
 * @returns `true` if the object has the property name.
 */
export declare const has: (obj: any, attr: PropertyKey) => any;
/**
 * Check if the attribute is present in the object or return a default value instead.
 * @param {PropertyKey} key
 * @param {*} obj
 * @param {*} [value=undefined]
 * @return The property value or default value.
 */
export declare function get(key: PropertyKey | PropertyKey[], obj: any, value?: any): any;
/**
 * Deletes a given property key from an object.
 * @param attr The property name.
 * @param x The given object.
 * @returns The modified object.
 */
export declare function del(attr: PropertyKey, x: any): any;
/**
 * Adds a property to an object, or modifies the existing value.
 * @param attr The name or Symbol of the property to be defined or modified.
 * @param obj The container object.
 * @param value The value associated with the property
 * @param {boolean} [writable=false] If `true` the value may be changed later. Defaults to `false`.
 * @param {boolean} [enumerable=false] If `true` this property shows up during enumeration of the properties in the object. Defaults to `false`.
 * @returns
 */
export declare function set(attr: PropertyKey, obj: any, value: any, writable?: boolean, enumerable?: boolean): any;
export declare const HASH_KEY: unique symbol;
/**
 * Return a hash value for a given object. The hash will be the same for subsequent invocations.
 * @param obj The given object.
 * @returns The hash value.
 */
export declare function hash(obj: any): any;
/**
 * A hash value generator for strings.
 * @param {string} str The given string.
 * @returns {number} The hash value of the string.
 * @see {@link http://isthe.com/chongo/tech/comp/fnv/ FNV hash}
 */
export declare function hashCode(str: string): number;
/**
 * Converts a number to a binary string.
 * @param n The given number.
 * @returns The binary string representation of `n`.
 */
export declare const bin: (n: number) => string;
/**
 * Converts a number to a hexadecimal string.
 * @param n The given number.
 * @returns The hexadecimal string representation of `n`.
 */
export declare const hex: (n: number) => string;
/**
 * Converts a number to an octal string.
 * @param n The given number.
 * @returns The octal string representation of `n`.
 */
export declare const oct: (n: number) => string;
/**
 * Returns a floating point number constructed from a number or string `x`.
 * @param x The number or string.
 * @returns A floating point number parsed from the given value or `NaN`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseFloat parseFloat}
 */
export declare const float: (x: any) => number;
/**
 * Returns an integer number constructed from a number or string `x`.
 * @param x The number or string.
 * @returns An integer number parsed from the given value or `NaN`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt parseInt}
 */
export declare const int: (x: any, base?: number) => number;
/**
 * Converts the value to an array using `Array.from()`.
 * @param value
 * @returns A new array value.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from Array.from()}
 */
export declare const list: (value?: any) => unknown[];
/**
 * Retrieve the next item from the iterator by calling it's `next()` method.
 * @param iter The iterator.
 * @returns The next value from the iterator.
 */
export declare const next: (iter: Iterator<any> | Generator) => any;
