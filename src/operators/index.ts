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
  compare as compareKey,
  equals as equalsKey,
  rank as rankKey,
  clone as cloneKey,
  add as addKey,
  sub as subKey,
  mul as mulKey,
  div as divKey,
  mod as modKey,
  pow as powKey,
  abs as absKey,
  boolKey,
  unit as unitKey,
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
 * The addition (+) operator. Dispatches on `protocol.add` when present.
 */
export function add(x: unknown, y: unknown): unknown {
  if (hasMethod(x, protocol.add)) return x[protocol.add](y)
  return (x as number) + (y as number)
}

/**
 * The subtraction (-) operator. Dispatches on `protocol.sub` when present.
 */
export function sub(x: unknown, y: unknown): unknown {
  if (hasMethod(x, protocol.sub)) return x[protocol.sub](y)
  return (x as number) - (y as number)
}

/**
 * The multiplication (*) operator. Dispatches on `protocol.mul` when present.
 */
export function mul(x: unknown, y: unknown): unknown {
  if (hasMethod(x, protocol.mul)) return x[protocol.mul](y)
  return (x as number) * (y as number)
}

/**
 * The division (/) operator. Dispatches on `protocol.div` when present.
 */
export function div(x: unknown, y: unknown): unknown {
  if (hasMethod(x, protocol.div)) return x[protocol.div](y)
  return (x as number) / (y as number)
}

/**
 * The modulo (%) operator. Dispatches on `protocol.mod` when present.
 */
export function mod(x: unknown, y: unknown): unknown {
  if (hasMethod(x, protocol.mod)) return x[protocol.mod](y)
  return (x as number) % (y as number)
}

/**
 * The power (**) operator. Dispatches on `protocol.pow` when present.
 */
export function pow(x: unknown, y: unknown): unknown {
  if (hasMethod(x, protocol.pow)) return x[protocol.pow](y)
  return (x as number) ** (y as number)
}
