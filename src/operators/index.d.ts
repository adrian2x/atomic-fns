/**
 * Generic operations for both values and objects.
 *
 * @module Operators
 */
export declare const id: (x: any) => any;
export declare const bool: (x: any) => boolean;
export declare const not: (x: any) => boolean;
export declare const isinstance: (x: any, y: any) => boolean;
/** Describes a function used to compare two values.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#parameters Array.sort()}
 */
export declare type Comparer<T = any> = (x: T, y: T) => number;
/**
 * Checks whether `x` is a comparable type and returns the result of `x.compare(y)`.
 * Otherwise the return value of the compare function checks if:
 *   - `x === y` or `x.lt(y)` returns `0`
 *   - `x < y` or `x.lt(y)` returns `-1`
 *   - otherwise returns `1`
 * @param {*} x An initial value
 * @param {*} y Other value to compare
 * @returns {-1 | 0 | 1} The comparison result
 */
export declare function compare(x: any, y: any): -1 | 0 | 1;
export declare function eq(x: any, y: any): any;
export declare function lt(x: any, y: any): any;
export declare function lte(x: any, y: any): any;
export declare function gt(x: any, y: any): any;
export declare function gte(x: any, y: any): any;
export declare function add(x: any, y: any): any;
export declare function sub(x: any, y: any): any;
export declare function mul(x: any, y: any): any;
export declare function div(x: any, y: any): any;
export declare function mod(x: any, y: any): any;
/**
 * Calculates `x` to the power of `y`. If `x` implements a custom `pow` operator
 * it will return `x.pow(y)`.
 *
 * @param {*} x
 * @param {*} y
 * @return `x` raised to the power `y`
 */
export declare function pow(x: any, y: any): any;
export declare function shallowEqual(obj: any, other: any): boolean;
export declare function deepEqual(obj: any, other: any, checker?: typeof eq): boolean;
