/**
 * Symbol protocol and truth helpers.
 */

/** Shared protocol symbols for operator dispatch. */
export const protocol = Object.freeze({
  compare: Symbol.for('atomic-fns.compare'),
  equals: Symbol.for('atomic-fns.equals'),
  rank: Symbol.for('atomic-fns.rank'),
  clone: Symbol.for('atomic-fns.clone'),
  add: Symbol.for('atomic-fns.add'),
  sub: Symbol.for('atomic-fns.sub'),
  mul: Symbol.for('atomic-fns.mul'),
  div: Symbol.for('atomic-fns.div'),
  mod: Symbol.for('atomic-fns.mod'),
  pow: Symbol.for('atomic-fns.pow'),
  abs: Symbol.for('atomic-fns.abs'),
  bool: Symbol.for('atomic-fns.bool')
} as const)

/** Values that participate in the total order via `protocol.compare`. */
export interface Comparable {
  [protocol.compare](other: unknown): number | undefined
  readonly [protocol.rank]?: Rank
}

/** Values that define semantic equality via `protocol.equals`. */
export interface Equatable {
  [protocol.equals](other: unknown): boolean
}

/** Declarable protocol ranks (1 numeric, 5 date-like, 6 object). */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/** True when `v` is an object or function with a callable `key` property. */
export function hasMethod(
  v: unknown,
  key: symbol
): v is Record<symbol, (...a: unknown[]) => unknown> {
  return (typeof v === 'object' && v !== null) || typeof v === 'function'
    ? typeof (v as Record<symbol, unknown>)[key] === 'function'
    : false
}

/** Returns its argument unchanged. */
export const identity = <T>(x: T): T => x

const PROTOCOL_NAMES = [
  'compare',
  'eq',
  'add',
  'sub',
  'mul',
  'div',
  'mod',
  'pow',
  'abs',
  'bool',
  'clone'
] as const

function defineCompareFromOrdering(proto: object): void {
  const p = proto as Record<string, unknown>
  const hasLt = typeof p.lt === 'function'
  const hasGt = typeof p.gt === 'function'
  if (!hasLt && !hasGt) return
  if ((proto as Record<symbol, unknown>)[protocol.compare] !== undefined) return

  if (hasLt) {
    Object.defineProperty(proto, protocol.compare, {
      value: function (o: unknown) {
        const self = this as Record<string, (...a: unknown[]) => unknown>
        if (typeof self.eq === 'function' && self.eq(o)) return 0
        if (self.lt(o)) return -1
        const greater =
          typeof self.gt === 'function'
            ? self.gt(o)
            : typeof (o as { lt?: (x: unknown) => unknown } | null)?.lt === 'function'
              ? (o as { lt: (x: unknown) => unknown }).lt(this)
              : false
        if (greater) return 1
        return typeof self.eq === 'function' ? undefined : 0
      },
      enumerable: false,
      configurable: true
    })
    return
  }

  Object.defineProperty(proto, protocol.compare, {
    value: function (o: unknown) {
      const self = this as Record<string, (...a: unknown[]) => unknown>
      if (typeof self.eq === 'function' && self.eq(o)) return 0
      if (self.gt(o)) return 1
      const lesser =
        typeof self.lt === 'function'
          ? self.lt(o)
          : typeof (o as { gt?: (x: unknown) => unknown } | null)?.gt === 'function'
            ? (o as { gt: (x: unknown) => unknown }).gt(this)
            : false
      if (lesser) return -1
      return typeof self.eq === 'function' ? undefined : 0
    },
    enumerable: false,
    configurable: true
  })
}

/**
 * Wires 1.x string-named protocol methods on `Class.prototype` to symbol keys.
 * Returns `Class`. Does not overwrite an existing symbol method.
 */
export function adaptProtocol<C extends abstract new (...args: never[]) => object>(Class: C): C {
  const proto = Class.prototype as object & Record<string | symbol, unknown>
  for (const name of PROTOCOL_NAMES) {
    if (typeof proto[name] !== 'function') continue
    const sym = name === 'eq' ? protocol.equals : protocol[name as keyof typeof protocol]
    if (proto[sym] !== undefined) continue
    const methodName = name
    Object.defineProperty(proto, sym, {
      value: function (...a: unknown[]) {
        return (this as Record<string, (...args: unknown[]) => unknown>)[methodName](...a)
      },
      enumerable: false,
      configurable: true
    })
  }
  if (typeof proto.compare !== 'function') {
    defineCompareFromOrdering(proto)
  }
  return Class
}

/**
 * Truth-value testing via `protocol.bool` when present, else `Boolean(x)`.
 */
export function bool(x: unknown): boolean {
  if (hasMethod(x, protocol.bool)) return Boolean(x[protocol.bool]())
  return Boolean(x)
}

/** Negation of {@link bool}. */
export function not(x: unknown): boolean {
  return !bool(x)
}
