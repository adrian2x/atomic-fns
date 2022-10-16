/**
 * Math and algebraic operations.
 *
 * @module Math
 */

import { call, Comp, isFunc } from '../globals/index.js'
import { comp } from '../operators/index.js'

/**
 * Returns the absolute value of a number. The argument may be a number or an object implementing the `abs()`.
 * @param x The value.
 * @returns The absolute value.
 */
export function abs(x): number {
  const op = call(x, 'abs')
  if (op != null) return op
  return Math.abs(x)
}

/**
 * Returns a tuple like `[x / y, x % y]`.
 *
 * @param x
 * @param y
 * @returns
 */
export function divmod(x: number, y: number) {
  return [Math.floor(x / y), x % y]
}

export function log2(x) {
  if (x > 0) {
    return Math.log(x) * 1.442695
  }
  return Number.NaN
}

export function logBase(x, y) {
  if (x > 0 && y > 0) {
    return Math.log(y) / Math.log(x)
  }
  return Number.NaN
}

export function min(comp: Comp, ...args): any

/**
 * Returns the smallest item of two or more arguments.
 * @param {Comp|any[]} args
 * @returns The minimum element from `args`.
 */
export function min(...args) {
  // Uses `le` by default
  let cmp = comp
  if (isFunc(args[0])) {
    cmp = args.shift()
  }
  let res = args[0]
  for (const x of args) {
    if (cmp(x, res) === -1) {
      res = x
    }
  }
  return res
}

export function max(comp: Comp, ...args): any

/**
 * Returns the largest item of two or more arguments.
 * @param {Comp|any[]} args
 * @returns The maximum element from `args`.
 */
export function max(args) {
  // Uses ge by default
  let cmp = comp
  if (isFunc(args[0])) {
    cmp = args.shift()
  }
  let res = args[0]
  for (const x of args) {
    if (cmp(x, res) === 1) {
      res = x
    }
  }
  return res
}

/**
 * Sums `initial` and the items of an iterable and returns the total.
 * @param args The elements to add to `initial`.
 * @param initial The initial value to add to.
 * @returns The total sum of initial and iterable elements.
 */
export function sum(args: Iterable<number>, initial = 0) {
  for (const x of args) {
    initial += x
  }
  return initial
}
