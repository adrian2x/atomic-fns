/**
 * Math and algebraic operations.
 *
 * @module Math
 */
export declare function abs(x: number): any;
/**
 * Returns a tuple like (x / y, x % y)
 *
 * @param {number} x
 * @param {number} y
 * @return {number[]}
 */
export declare function divmod(x: number, y: number): number[];
export declare function log2(x: any): number;
export declare function logBase(x: any, y: any): number;
/** First argument can be a comparer func */
export declare function min(args: any): any;
/** First argument can be a comparer func */
export declare function max(args: any): any;
export declare function sum(args: any): number;
