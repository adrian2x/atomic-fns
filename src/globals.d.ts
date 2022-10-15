/**
 * Globals
 * @module
 */
export declare type Comp = (x: any, y: any) => number;
export declare type Function = (...args: any[]) => any;
export declare type Iteratee = (value: any, key?: any, arr?: any) => any;
export declare const True: () => boolean;
export declare const False: () => boolean;
/**
 * A custom error class that inherits from the Error object.
 *
 *
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
 * Object, Promise, Symbol, and NaN.
 *
 *
 * @param {*} value
 * @return
 */
export declare function type(value: any): "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function" | "array" | "promise" | "null" | "NaN";
/** Same as `x.toString()`. Returns `''` when x is null or undefined */
export declare const str: (x: any) => any;
/** Check if value is a boolean type */
export declare const isBool: (x: any) => boolean;
/** Check if value is an object type */
export declare const isObject: (x: any) => boolean;
/** Check if value is a string type */
export declare const isString: (x: any) => boolean;
/** Check if value is an Array type */
export declare const isArray: (x: any) => boolean;
/** Check if value is Array-like type.
 * A value is considered array-like if it's not a function and has a
 * `.length` number property.
 */
export declare const isArrayLike: (x: any) => boolean;
/** Check if value is a function type */
export declare const isFunc: (x: any) => boolean;
/** Check if value is a number type */
export declare const isNumber: (x: any) => boolean;
/** Check if value is a Bigint type */
export declare const isBigint: (x: any) => boolean;
/** Check if value is NaN based on `Number.isNaN` */
export declare const isNaN: (x: any) => boolean;
/** Check if value is a Promise type */
export declare const isPromise: (x: any) => boolean;
/** Check if value is an async function type */
export declare const isAsync: (x: any) => boolean;
/** Check if value is a generator function type */
export declare const isGenerator: (x: any) => boolean;
/** Check if value is null or undefined */
export declare const isNull: (x: any) => boolean;
/** Check if value is not null or undefined */
export declare const notNull: (x: any) => boolean;
export declare function len(x: any): any;
/** Returns true for objects without length or falsey values. */
export declare const isEmpty: (x: any) => boolean;
/** Check if value is a Symbol type */
export declare const isSymbol: (x: any) => boolean;
/**
 * Generates a unique ID using random numbers.
 * If prefix is given, the ID is appended to it
 */
export declare const uniqueId: (pre?: string) => any;
/**
 * Checks if `obj.key` is a function, and calls it with any `args`.
 *
 *
 * @param {*} obj
 * @param {PropertyKey} key
 * @param {...any[]} args
 * @return `obj.key(...args)`
 */
export declare function call(obj: any, key: PropertyKey, ...args: any[]): any;
/** Convert number to unicode character */
export declare const chr: (x: number) => string;
/** Convert character to Unicode code point */
export declare const ord: (x: string) => number;
/** `Object.keys(x)` */
export declare const keys: (x: any) => string[];
/** `Object.values(x)` */
export declare const values: (x: any) => unknown[];
/**
 * Round `x` to the number of digits after the decimal point. If `digits` is
 * omitted, it returns the nearest integer to x.
 *
 * @param {number} x
 * @param {number} [digits=0]
 */
export declare function round(x: number, digits?: number): number;
export declare const floor: (x: number) => number;
export declare const ceil: (x: number) => number;
/**
 * Yields elements like `[index, item]` from an iterable.
 *
 *
 * @template T
 * @param {Iterable<T>} iterable
 */
export declare function enumerate<T = unknown>(iterable: Iterable<T>): Generator<(number | T)[], void, unknown>;
export declare const has: (obj: any, attr: PropertyKey) => any;
/**
 * Check if the attribute is present in the object, or return optional default.
 *
 *
 * @param {*} obj
 * @param {PropertyKey} key
 * @param {*} [value=undefined]
 * @return The property value or default value
 */
export declare function get(obj: any, key: PropertyKey | PropertyKey[], value?: any): any;
export declare function del(x: any, attr: any): any;
export declare function set(self: any, attr: PropertyKey, value: any, writable?: boolean, enumerable?: boolean): any;
export declare const HASH_KEY: unique symbol;
export declare function hash(obj: any): any;
/**
 * A hash value generator for strings
 *
 * @param {string} str
 * @return {number}
 * @see http://isthe.com/chongo/tech/comp/fnv/
 */
export declare function hashCode(str: string): number;
export declare const bin: (n: number) => string;
export declare const hex: (n: number) => string;
export declare const oct: (n: number) => string;
export declare const float: (x: any) => number;
export declare const int: (x: any, base?: number) => number;
export declare const list: (arr?: any) => unknown[];
export declare const next: (iter: Iterator<unknown>) => any;
