/**
 * Math and algebraic operations.
 *
 * @module Math
 */
import { call } from '../globals/index.js';
import { reduce } from '../itertools/index.js';
import { gt, id, lt } from '../operators/index.js';
/**
 * Returns the absolute value of a number. The argument may be a number or an object implementing the `abs()`.
 * @param x The value.
 * @returns The absolute value.
 */
export function abs(x) {
    const op = call(x, 'abs');
    if (op != null)
        return op;
    return Math.abs(x);
}
/**
 * Round `x` to the number of digits after the decimal point. If `digits` is
 * omitted, it returns the nearest integer to x.
 *
 * @param {number} x
 * @param {number} [digits=0]
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round Math.round()}
 */
export function round(x, digits = 0) {
    const base = 10 ** digits;
    return Math.round(x * base) / base;
}
/**
 * Rounds down and returns the largest integer less than or equal to a given number.
 * @param x A number.
 * @returns Nearest integer less than or equal to number.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/floor Math.floor()}
 */
export const floor = (x) => Math.floor(x);
/**
 * Rounds up and returns the largest integer greater than or equal to a given number.
 * @param x A number.
 * @returns Nearest integer greater than or equal to number.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/ceil Math.ceil()}
 */
export const ceil = (x) => Math.ceil(x);
/**
 * Returns a tuple like `[x / y, x % y]`.
 *
 * @param x
 * @param y
 * @returns
 */
export function divmod(x, y) {
    return [Math.floor(x / y), x % y];
}
export function log2(x) {
    if (x > 0) {
        return Math.log(x) * 1.442695;
    }
    return Number.NaN;
}
export function logBase(x, y) {
    if (x > 0 && y > 0) {
        return Math.log(y) / Math.log(x);
    }
    return Number.NaN;
}
export function min(iterable, key = id) {
    return reduce(iterable, (x, y) => (lt(key(x), key(y)) ? x : y));
}
export function max(iterable, key = id) {
    return reduce(iterable, (x, y) => (gt(key(x), key(y)) ? x : y));
}
export function mean(iterable, key = id) {
    let total = 0;
    let count = 0;
    for (const value of iterable) {
        total += key(value);
        count++;
    }
    return count !== 0 && total / count;
}
export function sum(args, key = id) {
    let initial = 0;
    for (const x of args) {
        initial += key(x);
    }
    return initial;
}
