/**
 * Generic operations for both values and objects.
 *
 * @module Operators
 */
/** This is the identity function. It always returns the same value that was passed in */
export declare const id: (x: any) => any;
/**
 * Called to implement truth value testing.
 * @param x
 * @returns {boolean} `x.bool()` if exists or `!!x`.
 */
export declare const bool: (x: any) => any;
/**
 * Returns `true` if `x` is a falsy value.
 * @see {@link bool}
 */
export declare const not: (x: any) => boolean;
/**
 * Returns `true` if `x` is an instance of class `y`
 * @param x The instance object
 * @param y The parent class
 * @returns {boolean}
 */
export declare const isinstance: (x: any, y: any) => boolean;
/** Describes a function used to compare two values.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#parameters Array.sort()}
 */
export declare type Comparer<T = any> = (x: T, y: T) => number;
/**
 * Checks whether `x` is a comparable type and returns the result of `x.compare(y)`.
 * Otherwise the return value of the compare function is equivalent to `obj === other ? 0 : obj < other ? -1 : 1`
 * @param {*} x An initial value
 * @param {*} y Other value to compare
 * @returns {number} The comparison result
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#parameters Array.sort()}
 * @see {@link eq}
 * @see {@link lt}
 */
export declare function compare(x: any, y: any): number;
/**
 * Compares two values to check if they are the same. If `x` is an object with an `eq` method, it returns `x.eq(y)`.
 * Otherwise it returns the result of `x === y`.
 * @param {*} x
 * @param {*} y
 * @returns {boolean} `true` if `x` and `y` are equal or `false` otherwise.
 */
export declare function eq(x: any, y: any): boolean;
/**
 * Compares two values to check if `x` is strictly less than `y`. If `x` is an object with a `lt` method, it returns `x.lt(y)`.
 * Otherwise it returns the result of `x < y`.
 * @param {*} x
 * @param {*} y
 * @returns {boolean} `true` if `x` is strictly less than `y` or `false` otherwise.
 */
export declare function lt(x: any, y: any): boolean;
/**
 * Compares two values to check if `x <= y`. If `x` is an object with a `lte` method, it returns `x.lte(y)`, also checks `x.eq(y)` and `x.lt(y)`.
 * Otherwise it returns the result of `x <= y`.
 * @param {*} x
 * @param {*} y
 * @returns {boolean} `true` if `x` is less than or equal to `y` or `false` otherwise.
 * @see {@link eq}
 * @see {@link lt}
 */
export declare function lte(x: any, y: any): boolean;
/**
 * Compares two values to check if `x` is strictly greater than `y`. If `x` is an object with a `gt` method, it returns `x.gt(y)`.
 * Otherwise it returns the result of `x > y`.
 * @param {*} x
 * @param {*} y
 * @returns {boolean} `true` if `x` is strictly greater than `y` or `false` otherwise.
 */
export declare function gt(x: any, y: any): any;
/**
 * Compares two values to check if `x >= y`. If `x` is an object with a `gte` method, it returns `x.gte(y)`, also checks `x.eq(y)` and `x.gt(y)`.
 * Otherwise it returns the result of `x >= y`.
 * @param {*} x
 * @param {*} y
 * @returns {boolean} `true` if `x` is less greater than or equal to `y` or `false` otherwise.
 * @see {@link eq}
 * @see {@link gt}
 */
export declare function gte(x: any, y: any): boolean;
/**
 * The addition (+) operator. If `x` is an object with an `add` method, it returns `x.add(y)`.
 * Otherwise it returns the result of `x + y`.
 * @param {*} x
 * @param {*} y
 * @returns {*} x + y
 */
export declare function add(x: any, y: any): any;
/**
 * The subtraction (-) operator. If `x` is an object with a `sub` method, it returns `x.sub(y)`.
 * Otherwise it returns the result of `x - y`.
 * @param {*} x
 * @param {*} y
 * @returns {*} x - y
 */
export declare function sub(x: any, y: any): any;
/**
 * The multiplication (*) operator. If `x` is an object with an `mul` method, it returns `x.mul(y)`.
 * Otherwise it returns the result of `x * y`.
 * @param {*} x
 * @param {*} y
 * @returns {*} x * y
 */
export declare function mul(x: any, y: any): any;
/**
 * The division (/) operator. If `x` is an object with a `div` method, it returns `x.div(y)`.
 * Otherwise it returns the result of `x / y`.
 * @param {*} x
 * @param {*} y
 * @returns {*} x / y
 */
export declare function div(x: any, y: any): any;
/**
 * The modulo (%) operator. If `x` is an object with a `mod` method, it returns `x.mod(y)`.
 * Otherwise it returns the result of `x % y`.
 * @param {*} x
 * @param {*} y
 * @returns {*} x % y
 */
export declare function mod(x: any, y: any): any;
/**
 * The power (**) operator. If `x` is an object with a `pow` method, it returns `x.pow(y)`.
 * Otherwise it returns the result of `x ** y`.
 * @param {*} x
 * @param {*} y
 * @returns {*} x ** y
 */
export declare function pow(x: any, y: any): any;
/**
 * Performs a shallow comparison of two objects or arrays to check if they have the same keys, length and values.
 * @param obj
 * @param other
 * @returns `true` if the objects are considered equal.
 * @see {@link deepEqual}
 */
export declare function shallowEqual(obj: any, other: any): boolean;
/**
 * Performs a recursive comparison of two objects or arrays to check if they have the same keys, length and values. Unlike {@link shallowEqual} this method compares nested values also.
 * @param obj
 * @param other
 * @returns `true` if the objects are considered equal.
 */
export declare function deepEqual(obj: any, other: any, checker?: typeof eq): boolean;
