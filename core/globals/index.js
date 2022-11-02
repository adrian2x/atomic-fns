/**
 * This module includes global functions and constants.
 *
 * @module Globals
 */
/** This is just a noop function. */
export const noop = () => { };
/** A function that always returns `true`. */
export const True = () => true;
/** A function that always returns `false`. */
export const False = () => false;
/**
 * A custom error class that inherits from the Error object.
 * @class CustomError
 * @extends {Error}
 */
export class CustomError extends Error {
    /**
     * Returns a new CustomError with the specified message.
     * @param {string} message
     * @constructor
     */
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        }
        else {
            this.stack = new Error(message).stack;
        }
    }
}
/**
 * Custom error to signal an invalid index access.
 * @extends {CustomError}
 */
export class IndexError extends CustomError {
}
/**
 * Raised when a system function returns an I/O failure such as "file not found"
 * or "disk full".
 * @extends {CustomError}
 */
export class IOError extends CustomError {
}
/**
 * Custom error to signal an invalid key access.
 * @extends {CustomError}
 */
export class KeyError extends CustomError {
}
/**
 * Custom error to signal an invalid operation.
 * @extends {CustomError}
 */
export class NotImplementedError extends CustomError {
}
/**
 * Custom error to signal an invalid value.
 * @extends {CustomError}
 */
export class ValueError extends CustomError {
}
/**
 * Raised when the second argument of a division or modulo operation is zero.
 * @extends {CustomError}
 */
export class ZeroDivisionError extends CustomError {
}
/**
 * Returns the true type of any value with correct detection for null, Array,
 * Object, Promise, Symbol, and NaN. The correct values are inferred from {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toStringTag | Symbol.toStringTag} and the value's prototype.
 * @param value
 * @returns The value type.
 */
export function type(value) {
    const result = typeof value;
    if (result === 'object') {
        if (value) {
            if (value instanceof String)
                return 'string';
            if (value instanceof Boolean)
                return 'boolean';
            if (value instanceof Function)
                return 'function';
            if (value instanceof Array)
                return 'array';
            if (value instanceof Error)
                return 'error';
            if (value[Symbol.toStringTag])
                return value[Symbol.toStringTag];
            const className = str(value);
            if (className === '[object Window]')
                return 'object';
            if (className.endsWith('Array]') || Array.isArray(value)) {
                return 'array';
            }
            if (className.endsWith('Function]') || typeof value.call === 'function') {
                return 'function';
            }
            // Other primitive types
            if (className === '[object Promise]' || value instanceof Promise) {
                return 'Promise';
            }
        }
        else {
            return 'null';
        }
    }
    else if (result === 'function' && typeof value.call === 'undefined') {
        return 'object';
    }
    else if (Number.isNaN(value))
        return 'NaN';
    return result;
}
/**
 * Returns a string representing the object.
 * @param obj
 * @returns `obj.toString()` or `''` if `obj` is `null` or `undefined`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString | Object.toString }
 */
export const str = (obj) => (obj != null ? obj.toString() : '');
export function hasOwnProperty(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}
/** Check if value is a boolean type. */
export const isBool = (x) => type(x) === 'boolean';
/** Check if value is an `Error` type. */
export const isError = (x) => x instanceof Error;
/** Check if value is an iterable type. */
export const isIterable = (x) => {
    if (x == null)
        return false;
    return typeof x[Symbol.iterator] === 'function';
};
/** Check if value is a native `Date` type. */
export const isDate = (x) => x instanceof Date;
/** Check if value is an object type. */
export const isObject = (x) => type(x) === 'object';
/** Check if value is a string type. */
export const isString = (x) => type(x) === 'string';
/** Check if value is an Array type. */
export const isArray = (x) => Array.isArray(x);
/**
 * Check if value is Array-like type.
 * A value is considered array-like if it's not a function and has a `.length` number property.
 */
export const isArrayLike = (x) => {
    const T = type(x);
    return T === 'array' || (T === 'object' && isNumber(x.length));
};
/** Check if value is a number type. */
export const isNumber = (x) => type(x) === 'number';
/** Check if value is an integer number type. */
export const isInteger = (x) => type(x) === 'number' && Math.trunc(x) === x;
/** Check if value is a bigint type. */
export const isBigint = (x) => type(x) === 'bigint';
/** Check if value is NaN based on `Number.isNaN`. */
export const isNaN = (x) => Number.isNaN(x);
/** Check if value is a Promise type. */
export const isPromise = (x) => type(x) === 'Promise';
/** Check if value is a function type. */
export const isFunction = (x) => x?.constructor === Function;
/** Check if value is an async function type. */
export const isAsyncFunction = (x) => x?.constructor.name === 'AsyncFunction';
/** Check if value is a generator function type. */
export const isGenerator = (x) => {
    return x?.constructor.constructor?.name === 'GeneratorFunction';
};
/** Check if value is `null` or `undefined`. */
export const isNull = (x) => x == null;
/** Check if value === `undefined`. */
export const isUndefined = (x) => x === undefined;
/** Check if value is not `null` or `undefined`. */
export const notNull = (x) => x != null;
/** Returns `true` for objects without length or falsy values. */
export const isEmpty = (x) => (len(x) === 0 ? true : !x);
/** Check if value is a `RegExp` type */
export const isRegExp = (x) => x instanceof RegExp;
/** Check if value is a `Symbol` type */
export const isSymbol = (x) => type(x) === 'symbol';
/** Check if value is a `Set` type. */
export const isSet = (x) => x instanceof Set;
/** Check if value is a `Map` type. */
export const isMap = (x) => x instanceof Map;
/** Check if value is a `WeakSet` type. */
export const isWeakSet = (x) => x instanceof WeakSet;
/** Check if value is a `WeakMap` type. */
export const isWeakMap = (x) => x instanceof WeakMap;
/**
 * Returns the number of elements in a collection type.
 *
 * If `value.length` or `value.size()` is defined, this will be returned.
 * If `value` is an `Object`, it returns the number of keys.
 * @param value
 * @returns The number of elements in the collection or `undefined`.
 */
export function len(value) {
    if (value == null)
        return;
    if (isNumber(value.length)) {
        return value.length;
    }
    if (isFunction(value.size)) {
        return value.size();
    }
    if (isNumber(value.size)) {
        return value.size;
    }
    if (isObject(value)) {
        return Object.keys(value).length;
    }
}
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
export const uniqueId = (pre = '') => 
// @ts-expect-error
(pre || 0) + ((Math.random() * 1e10) >>> 0);
/**
 * Generates a monotonically increasing, pseudo-random based uuid-v4 string. These are sortable, url-friendly and are 100% unique if the IDs are generated more than 1 millisecond apart. If two IDs are generated at the same millisecond, the chance of collision is still pretty low (1 in 10^15).
 * @returns Returns a GUID formatted string.
 * @example
```js
uuid()
// => '183f8ef3-b8f0-4000-81f5-89234c836d00'
```
 */
export const uuid = () => {
    const u = Date.now().toString(16) + Math.random().toString(16) + '0'.repeat(16);
    return [u.substr(0, 8), u.substr(8, 4), '4000-8' + u.substr(13, 3), u.substr(16, 12)].join('-');
};
/**
 * Checks if `obj.key` is a function, and calls it with any given `args`.
 * @param {*} obj
 * @param {PropertyKey} key
 * @param {...any[]} args
 * @return `obj.key(...args)` or `undefined`.
 */
export function call(obj, key, ...args) {
    if (isFunction(get(key, obj))) {
        return obj[key](...args);
    }
}
/** Convert number to unicode character */
export const chr = (x) => String.fromCodePoint(x);
/** Convert character to Unicode code point */
export const ord = (x) => x.charCodeAt(0);
/**
 * Returns an array of the own enumerable property names of `object`.
 * @param object The given object.
 * @returns The array of object keys.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys Object.keys()}
 */
export const keys = (object) => Object.keys(object);
/**
 * Returns an array of the own enumerable property values of `object`.
 * @param object The given object.
 * @returns The array of object keys.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/values Object.values()}
 */
export const values = (object) => Object.values(object);
/**
 * Check if a given property is present in a given object.
 * @param obj The object to check.
 * @param attr A property key name.
 * @returns `true` if the object has the property name.
 */
export const has = (obj, attr) => obj && attr in obj;
/**
 * Check if the attribute is present in the object or return a default value instead.
 * @param {PropertyKey} key
 * @param {*} obj
 * @param {*} [value=undefined]
 * @return The property value or default value.
 */
export function get(key, obj, value = undefined) {
    if (obj == null)
        return value;
    let paths = Array.isArray(key) ? key : [key];
    if (typeof key === 'string') {
        paths = key.split('.');
    }
    try {
        let result = obj;
        for (const k of paths) {
            result = result[k];
        }
        return result === undefined ? value : result;
    }
    catch (error) {
        return value;
    }
}
/**
 * Deletes a given property key from an object.
 * @param attr The property name.
 * @param x The given object.
 * @returns The modified object.
 */
export function del(attr, x) {
    if (x != null)
        delete x[attr];
    return x;
}
/**
 * Adds a property to an object, or modifies the existing value.
 * @param attr The name or Symbol of the property to be defined or modified.
 * @param obj The container object.
 * @param value The value associated with the property
 * @param {boolean} [writable=false] If `true` the value may be changed later. Defaults to `false`.
 * @param {boolean} [enumerable=false] If `true` this property shows up during enumeration of the properties in the object. Defaults to `false`.
 * @returns
 */
export function set(attr, obj, value, writable = false, enumerable = false) {
    return Object.defineProperty(obj, attr, {
        value,
        enumerable,
        writable
    });
}
export const HASH_KEY = Symbol.for('HASH_KEY');
/**
 * Return a hash value for a given object. The hash will be the same for subsequent invocations.
 * @param obj The given object.
 * @returns The hash value.
 */
export function hash(obj) {
    if (typeof obj === 'string') {
        return hashCode(obj);
    }
    if (typeof obj === 'object') {
        if (get(HASH_KEY, obj) == null) {
            return obj[HASH_KEY];
        }
        obj[HASH_KEY] = uniqueId();
        return obj[HASH_KEY];
    }
    return obj;
}
/**
 * A hash value generator for strings.
 * @param {string} str The given string.
 * @returns {number} The hash value of the string.
 * @see {@link http://isthe.com/chongo/tech/comp/fnv/ FNV hash}
 */
export function hashCode(str) {
    const FNV1_32A_INIT = 0x811c9dc5;
    let hval = FNV1_32A_INIT;
    for (let i = 0; i < str.length; ++i) {
        hval ^= str.charCodeAt(i);
        hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
    }
    return hval >>> 0;
}
/**
 * Converts a number to a binary string.
 * @param n The given number.
 * @returns The binary string representation of `n`.
 */
export const bin = (n) => n.toString(2);
/**
 * Converts a number to a hexadecimal string.
 * @param n The given number.
 * @returns The hexadecimal string representation of `n`.
 */
export const hex = (n) => n.toString(16);
/**
 * Converts a number to an octal string.
 * @param n The given number.
 * @returns The octal string representation of `n`.
 */
export const oct = (n) => n.toString(8);
/**
 * Returns a floating point number constructed from a number or string `x`.
 * @param x The number or string.
 * @returns A floating point number parsed from the given value or `NaN`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseFloat parseFloat}
 */
export const float = (x) => parseFloat(x);
/**
 * Returns an integer number constructed from a number or string `x`.
 * @param x The number or string.
 * @returns An integer number parsed from the given value or `NaN`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt parseInt}
 */
export const int = (x, base = 10) => parseInt(x, base);
/**
 * Converts the value to an array using `Array.from()`.
 * @param value
 * @returns A new array value.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from Array.from()}
 */
export const list = (value) => (value ? Array.from(value) : []);
/**
 * Retrieve the next item from the iterator by calling its `next()` method.
 * @param iter The iterator.
 * @returns The next value from the iterator.
 */
export const next = (iter) => iter.next().value;
