/**
 * Generic operations for both values and objects.
 *
 * @module Operators
 */
export declare const id: (x: any) => any;
export declare const bool: (x: any) => boolean;
export declare const not: (x: any) => boolean;
export declare const isinstance: (x: any, y: any) => boolean;
export declare function comp(x: any, y: any): any;
export declare function eq(x: any, y: any): any;
export declare function lt(x: any, y: any): any;
export declare function le(x: any, y: any): any;
export declare function gt(x: any, y: any): any;
export declare function ge(x: any, y: any): any;
export declare function add(x: any, y: any): any;
export declare function sub(x: any, y: any): any;
export declare function mult(x: any, y: any): any;
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
