/**
 * Symbol protocol and truth helpers.
 */

const compare: unique symbol = Symbol.for('atomic-fns.compare')
const equals: unique symbol = Symbol.for('atomic-fns.equals')
const rank: unique symbol = Symbol.for('atomic-fns.rank')
const clone: unique symbol = Symbol.for('atomic-fns.clone')
const add: unique symbol = Symbol.for('atomic-fns.add')
const sub: unique symbol = Symbol.for('atomic-fns.sub')
const mul: unique symbol = Symbol.for('atomic-fns.mul')
const div: unique symbol = Symbol.for('atomic-fns.div')
const mod: unique symbol = Symbol.for('atomic-fns.mod')
const pow: unique symbol = Symbol.for('atomic-fns.pow')
const abs: unique symbol = Symbol.for('atomic-fns.abs')
const boolKey: unique symbol = Symbol.for('atomic-fns.bool')
const unit: unique symbol = Symbol.for('atomic-fns.unit')

/** Shared protocol symbols for operator dispatch. */
export const protocol: {
  readonly compare: typeof compare
  readonly equals: typeof equals
  readonly rank: typeof rank
  readonly clone: typeof clone
  readonly add: typeof add
  readonly sub: typeof sub
  readonly mul: typeof mul
  readonly div: typeof div
  readonly mod: typeof mod
  readonly pow: typeof pow
  readonly abs: typeof abs
  readonly bool: typeof boolKey
  readonly unit: typeof unit
} = Object.freeze({
  compare,
  equals,
  rank,
  clone,
  add,
  sub,
  mul,
  div,
  mod,
  pow,
  abs,
  bool: boolKey,
  unit
})

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
export type Rank = 1 | 5 | 6

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

  const ahead = hasLt ? 'lt' : 'gt'
  const aheadVal = hasLt ? -1 : 1
  const behind = hasLt ? 'gt' : 'lt'
  const behindVal = hasLt ? 1 : -1

  Object.defineProperty(proto, protocol.compare, {
    value: function (o: unknown) {
      const self = this as Record<string, (...a: unknown[]) => unknown>
      if (typeof self.eq === 'function' && self.eq(o)) return 0
      if (self[ahead](o)) return aheadVal
      const opposite =
        typeof self[behind] === 'function'
          ? self[behind](o)
          : typeof (o as Record<string, unknown> | null)?.[ahead] === 'function'
            ? (o as Record<string, (...a: unknown[]) => unknown>)[ahead](this)
            : false
      if (opposite) return behindVal
      return typeof self.eq === 'function' ? undefined : 0
    },
    enumerable: false,
    configurable: true
  })
}

/**
 * Wires 1.x string-named protocol methods on `Class.prototype` to symbol keys.
 * Also wires a string-named `unit` on the prototype (getter or data) to `protocol.unit`.
 * When the prototype has no `unit`, falls back to reading an own instance `unit` property
 * (string), so `constructor(public amount, public unit)` classes adapt without a prototype
 * accessor. Returns `Class`. Does not overwrite an existing symbol method or unit hook.
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
  if (proto[protocol.unit] === undefined) {
    const unitDesc = Object.getOwnPropertyDescriptor(proto, 'unit')
    if (unitDesc !== undefined && (unitDesc.get !== undefined || 'value' in unitDesc)) {
      Object.defineProperty(proto, protocol.unit, {
        get: function (this: { unit: unknown }) {
          return this.unit
        },
        enumerable: false,
        configurable: true
      })
    } else {
      Object.defineProperty(proto, protocol.unit, {
        get: function (this: object) {
          if (!Object.hasOwn(this, 'unit')) return undefined
          const u = (this as { unit: unknown }).unit
          return typeof u === 'string' ? u : undefined
        },
        enumerable: false,
        configurable: true
      })
    }
  }
  if (typeof proto.compare !== 'function') {
    defineCompareFromOrdering(proto)
  }
  return Class
}

/**
 * Unit code of `v` via `protocol.unit`, or `''` when absent / not a string.
 * Used by rank-1 ordering and equality so operators stay currency-agnostic.
 */
export function unitOf(v: unknown): string {
  if ((typeof v !== 'object' && typeof v !== 'function') || v === null) return ''
  const u = (v as Record<symbol, unknown>)[protocol.unit]
  return typeof u === 'string' ? u : ''
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
