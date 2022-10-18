/**
 * Generic operations for both values and objects.
 *
 * @module Operators
 */
import { call, isNumber, isObject } from '../globals/index.js';
export const id = (x) => x;
export const bool = (x) => !!x;
export const not = (x) => !x;
export const isinstance = (x, y) => x instanceof y;
export function comp(x, y) {
    const op = call(x, 'compare', y);
    if (isNumber(op))
        return op;
    if (eq(x, y))
        return 0;
    if (le(x, y))
        return -1;
    if (ge(x, y))
        return 1;
    return 0;
}
export function eq(x, y) {
    const op = call(x, 'eq', y);
    if (op != null)
        return op;
    return x === y;
}
export function lt(x, y) {
    const op = call(x, 'lt', y);
    if (op != null)
        return op;
    return x < y;
}
export function le(x, y) {
    let op = call(x, 'le', y);
    if (op != null)
        return op;
    op = call(x, 'eq', y);
    if (op === true)
        return op;
    op = call(x, 'lt', y);
    if (op != null)
        return op;
    return x <= y;
}
export function gt(x, y) {
    const op = call(x, 'gt', y);
    if (op != null)
        return op;
    return x > y;
}
export function ge(x, y) {
    let op = call(x, 'ge', y);
    if (op != null)
        return op;
    op = call(x, 'eq', y);
    if (op === true)
        return op;
    op = call(x, 'gt', y);
    if (op != null)
        return op;
    return x >= y;
}
export function add(x, y) {
    const op = call(x, 'add', y);
    if (op != null)
        return op;
    return x + y;
}
export function sub(x, y) {
    const op = call(x, 'sub', y);
    if (op != null)
        return op;
    return x - y;
}
export function mult(x, y) {
    const op = call(x, 'mult', y);
    if (op != null)
        return op;
    return x * y;
}
export function div(x, y) {
    const op = call(x, 'div', y);
    if (op != null)
        return op;
    return x / y;
}
export function mod(x, y) {
    const op = call(x, 'mod', y);
    if (op != null)
        return op;
    return x % y;
}
/**
 * Calculates `x` to the power of `y`. If `x` implements a custom `pow` operator
 * it will return `x.pow(y)`.
 *
 * @param {*} x
 * @param {*} y
 * @return `x` raised to the power `y`
 */
export function pow(x, y) {
    const op = call(x, 'pow', y);
    if (op != null)
        return op;
    return x ** y;
}
export function shallowEqual(obj, other) {
    if (obj === other)
        return true;
    if (!obj || !other)
        return false;
    if (Array.isArray(obj)) {
        // compare the arrays
        if (obj.length !== other.length)
            return false;
        for (let i = 0; i < obj.length; i++) {
            if (obj[i] !== other[i]) {
                return false;
            }
        }
        return true;
    }
    else if (isObject(obj)) {
        // compare the object keys
        const objKeys = Object.keys(obj);
        const otherKeys = Object.keys(other);
        if (objKeys.length !== otherKeys.length)
            return false;
        for (const key of objKeys) {
            if (!Object.prototype.hasOwnProperty.call(other, key) || obj[key] !== other[key]) {
                return false;
            }
        }
        return true;
    }
    return false;
}
export function deepEqual(obj, other, checker = eq) {
    if (checker(obj, other))
        return true;
    if (!obj || !other)
        return false;
    if (Array.isArray(obj)) {
        // compare the arrays
        if (obj.length !== other.length)
            return false;
        for (let i = 0; i < obj.length; i++) {
            if (!deepEqual(obj[i], other[i], checker)) {
                return false;
            }
        }
        return true;
    }
    else if (isObject(obj)) {
        // compare the object keys
        const objKeys = Object.keys(obj);
        const otherKeys = Object.keys(other);
        if (objKeys.length !== otherKeys.length)
            return false;
        for (const key of objKeys) {
            if (!Object.prototype.hasOwnProperty.call(other, key) ||
                !deepEqual(obj[key], other[key], checker)) {
                return false;
            }
        }
        return true;
    }
    return false;
}
