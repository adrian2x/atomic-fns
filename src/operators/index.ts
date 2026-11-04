/**
 * Generic operations for both values and objects.
 *
 * @module operators
 */

import { hasMethod, protocol } from './protocol.js'

export {
  protocol,
  adaptProtocol,
  identity,
  bool,
  not,
  hasMethod,
  unitOf,
  type Comparable,
  type Equatable,
  type Rank
} from './protocol.js'

export { compare, eq, lt, lte, gt, gte, sameValueZero, type Comparer } from './order.js'

export { deepEqual, shallowEqual } from './equality.js'

/**
 * Returns `true` if `x` is an instance of class `y`.
 */
export function isinstance(x: unknown, y: abstract new (...args: never[]) => object): boolean {
  return x instanceof y
}

/**
 * Runs the left operand's hook, else the right operand's with `reflected = true` as its second
 * argument, else the native operator.
 */
function dispatch(
  hook: symbol,
  x: unknown,
  y: unknown,
  native: (x: number, y: number) => unknown
): unknown {
  if (hasMethod(x, hook)) return x[hook](y)
  if (hasMethod(y, hook)) return y[hook](x, true)
  return native(x as number, y as number)
}

/**
 * The addition (+) operator. Dispatches on `protocol.add` of `x`, else of `y` with
 * `reflected = true`.
 */
export function add(x: unknown, y: unknown): unknown {
  return dispatch(protocol.add, x, y, (a, b) => a + b)
}

/**
 * The subtraction (-) operator. Dispatches on `protocol.sub` of `x`, else of `y` with
 * `reflected = true`, which asks the hook for `x - this`.
 */
export function sub(x: unknown, y: unknown): unknown {
  return dispatch(protocol.sub, x, y, (a, b) => a - b)
}

/**
 * The multiplication (*) operator. Dispatches on `protocol.mul` of `x`, else of `y` with
 * `reflected = true`.
 */
export function mul(x: unknown, y: unknown): unknown {
  return dispatch(protocol.mul, x, y, (a, b) => a * b)
}

/**
 * The division (/) operator. Dispatches on `protocol.div` of `x`, else of `y` with
 * `reflected = true`, which asks the hook for `x / this`.
 */
export function div(x: unknown, y: unknown): unknown {
  return dispatch(protocol.div, x, y, (a, b) => a / b)
}

/**
 * The modulo (%) operator. Dispatches on `protocol.mod` of `x`, else of `y` with
 * `reflected = true`. Decimal defines no `protocol.mod`, so a Decimal operand throws `TypeError`.
 */
export function mod(x: unknown, y: unknown): unknown {
  return dispatch(protocol.mod, x, y, (a, b) => a % b)
}

/**
 * The power (**) operator. Dispatches on `protocol.pow` of `x`, else of `y` with
 * `reflected = true`. Decimal defines no `protocol.pow`, so a Decimal operand throws `TypeError`.
 */
export function pow(x: unknown, y: unknown): unknown {
  return dispatch(protocol.pow, x, y, (a, b) => a ** b)
}
