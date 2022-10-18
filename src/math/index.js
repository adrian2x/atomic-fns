/**
 * Math and algebraic operations.
 *
 * @module Math
 */
import { call } from '../globals/index.js';
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
