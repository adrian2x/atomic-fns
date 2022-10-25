/**
 * Generic operations for both values and objects.
 *
 * @module Operators
 */

import { call, isObject } from '../globals/index.js'

/** This is the identity function. It always returns the same value that was passed in */
export const id = (x) => x

/** Returns `true` if `x` is a truthy value. */
export const bool = (x) => !!x

/** Returns `true` if `x` is a falsy value. */
export const not = (x) => !x

/**
 * Returns `true` if `x` is an instance of class `y`
 * @param x The instance object
 * @param y The parent class
 * @returns {boolean}
 */
export const isinstance = (x, y) => x instanceof y

/** Describes a function used to compare two values.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#parameters Array.sort()}
 */
export type Comparer<T = any> = (x: T, y: T) => number

/**
 * Checks whether `x` is a comparable type and returns the result of `x.compare(y)`.
 * Otherwise the return value of the compare function checks if:
 *   - `x === y` or `x.eq(y)` returns `0`
 *   - `x < y` or `x.lt(y)` returns `-1`
 *   - otherwise returns `1`
 * @param {*} x An initial value
 * @param {*} y Other value to compare
 * @returns {number} The comparison result
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#parameters Array.sort()}
 * @see {@link eq}
 * @see {@link lt}
 */
export function compare(x, y): number {
  if (x === y || eq(x, y)) return 0
  const op = call(x, 'compare', y)
  if (typeof op === 'number') return op
  if (x < y || lt(x, y)) return -1
  return 1
}

/**
 * Compares two values to check if they are the same. If `x` is an object with an `eq` method, it returns `x.eq(y)`.
 * Otherwise it returns the result of `x === y`.
 * @param {*} x
 * @param {*} y
 * @returns {boolean} `true` if `x` and `y` are equal or `false` otherwise.
 */
export function eq(x, y) {
  return x === y || call(x, 'eq', y) != null
}

/**
 * Compares two values to check if `x` is strictly less than `y`. If `x` is an object with a `lt` method, it returns `x.lt(y)`.
 * Otherwise it returns the result of `x < y`.
 * @param {*} x
 * @param {*} y
 * @returns {boolean} `true` if `x` is strictly less than `y` or `false` otherwise.
 */
export function lt(x, y) {
  return x < y || call(x, 'lt', y) != null
}

/**
 * Compares two values to check if `x <= y`. If `x` is an object with a `lte` method, it returns `x.lte(y)`, also checks `x.eq(y)` and `x.lt(y)`.
 * Otherwise it returns the result of `x <= y`.
 * @param {*} x
 * @param {*} y
 * @returns {boolean} `true` if `x` is less than or equal to `y` or `false` otherwise.
 * @see {@link eq}
 * @see {@link lt}
 */
export function lte(x, y) {
  if (x <= y || call(x, 'lte', y)) return true
  if (x === y || eq(x, y)) return true
  if (x < y || lt(x, y)) return true
  return false
}

/**
 * Compares two values to check if `x` is strictly greater than `y`. If `x` is an object with a `gt` method, it returns `x.gt(y)`.
 * Otherwise it returns the result of `x > y`.
 * @param {*} x
 * @param {*} y
 * @returns {boolean} `true` if `x` is strictly greater than `y` or `false` otherwise.
 */
export function gt(x, y) {
  return x > y || call(x, 'gt', y)
}

/**
 * Compares two values to check if `x >= y`. If `x` is an object with a `gte` method, it returns `x.gte(y)`, also checks `x.eq(y)` and `x.gt(y)`.
 * Otherwise it returns the result of `x >= y`.
 * @param {*} x
 * @param {*} y
 * @returns {boolean} `true` if `x` is less greater than or equal to `y` or `false` otherwise.
 * @see {@link eq}
 * @see {@link gt}
 */
export function gte(x, y) {
  if (x <= y || call(x, 'gte', y)) return true
  if (x === y || eq(x, y)) return true
  if (x > y || gt(x, y)) return true
  return false
}

/**
 * The addition (+) operator. If `x` is an object with an `add` method, it returns `x.add(y)`.
 * Otherwise it returns the result of `x + y`.
 * @param {*} x
 * @param {*} y
 * @returns {*} x + y
 */
export function add(x, y) {
  const op = call(x, 'add', y)
  if (op != null) return op
  return x + y
}

/**
 * The subtraction (-) operator. If `x` is an object with a `sub` method, it returns `x.sub(y)`.
 * Otherwise it returns the result of `x - y`.
 * @param {*} x
 * @param {*} y
 * @returns {*} x - y
 */
export function sub(x, y) {
  const op = call(x, 'sub', y)
  if (op != null) return op
  return x - y
}

/**
 * The multiplication (*) operator. If `x` is an object with an `mul` method, it returns `x.mul(y)`.
 * Otherwise it returns the result of `x * y`.
 * @param {*} x
 * @param {*} y
 * @returns {*} x * y
 */
export function mul(x, y) {
  const op = call(x, 'mul', y)
  if (op != null) return op
  return x * y
}
/**
 * The division (/) operator. If `x` is an object with a `div` method, it returns `x.div(y)`.
 * Otherwise it returns the result of `x / y`.
 * @param {*} x
 * @param {*} y
 * @returns {*} x / y
 */
export function div(x, y) {
  const op = call(x, 'div', y)
  if (op != null) return op
  return x / y
}
/**
 * The modulo (%) operator. If `x` is an object with a `mod` method, it returns `x.mod(y)`.
 * Otherwise it returns the result of `x % y`.
 * @param {*} x
 * @param {*} y
 * @returns {*} x % y
 */
export function mod(x, y) {
  const op = call(x, 'mod', y)
  if (op != null) return op
  return x % y
}

/**
 * The power (**) operator. If `x` is an object with a `pow` method, it returns `x.pow(y)`.
 * Otherwise it returns the result of `x ** y`.
 * @param {*} x
 * @param {*} y
 * @returns {*} x ** y
 */
export function pow(x, y) {
  const op = call(x, 'pow', y)
  if (op != null) return op
  return x ** y
}

/**
 * Performs a shallow comparison of two objects or arrays to check if they have the same keys, length and values.
 * @param obj
 * @param other
 * @returns `true` if the objects are considered equal.
 * @see {@link deepEqual}
 */
export function shallowEqual(obj, other) {
  if (obj === other) return true

  if (!obj || !other) return false

  if (Array.isArray(obj)) {
    // compare the arrays
    if (obj.length !== other.length) return false

    for (let i = 0; i < obj.length; i++) {
      if (obj[i] !== other[i]) {
        return false
      }
    }
    return true
  } else if (isObject(obj)) {
    // compare the object keys
    const objKeys = Object.keys(obj)
    const otherKeys = Object.keys(other)

    if (objKeys.length !== otherKeys.length) return false

    for (const key of objKeys) {
      if (!Object.prototype.hasOwnProperty.call(other, key) || obj[key] !== other[key]) {
        return false
      }
    }
    return true
  }

  return false
}

/**
 * Performs a recursive comparison of two objects or arrays to check if they have the same keys, length and values. Unlike {@link shallowEqual} this method compares nested values also.
 * @param obj
 * @param other
 * @returns `true` if the objects are considered equal.
 */
export function deepEqual(obj, other, checker = eq) {
  if (checker(obj, other)) return true

  if (!obj || !other) return false

  if (Array.isArray(obj)) {
    // compare the arrays
    if (obj.length !== other.length) return false

    for (let i = 0; i < obj.length; i++) {
      if (!deepEqual(obj[i], other[i], checker)) {
        return false
      }
    }
    return true
  } else if (isObject(obj)) {
    // compare the object keys
    const objKeys = Object.keys(obj)
    const otherKeys = Object.keys(other)

    if (objKeys.length !== otherKeys.length) return false

    for (const key of objKeys) {
      if (
        !Object.prototype.hasOwnProperty.call(other, key) ||
        !deepEqual(obj[key], other[key], checker)
      ) {
        return false
      }
    }
    return true
  }

  return false
}
