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

/**
 * Shared protocol symbols for operator dispatch.
 *
 * Arithmetic hooks (`add`, `sub`, `mul`, `div`, `mod`, `pow`) take `(other, reflected)`. The
 * operators call the left operand's hook; when only the right operand has one it runs with
 * `reflected = true`, so `sub(1, v)` calls `v[protocol.sub](1, true)` and must return `1 - v`.
 */
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

/**
 * Values that participate in the total order via `protocol.compare`. Returning `undefined`
 * declines: `compare` falls back to its kind tie-break, and the relational checks treat the pair
 * as incomparable. A rank-1 hook should answer for every number and bigint: its `undefined` orders
 * the pair by kind instead of by amount, and `compare` is then not transitive across those values.
 */
export interface Comparable {
  [protocol.compare](other: unknown): number | undefined
  readonly [protocol.rank]?: Rank
}

/** Values that define semantic equality via `protocol.equals`. */
export interface Equatable {
  [protocol.equals](other: unknown): boolean
}

/**
 * Declarable protocol ranks (1 numeric, 5 date-like, 6 object). A rank-5 hook returning `0` makes
 * two values equal even across classes, as a Date and an IntlDate at one instant are.
 */
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

/** Descriptor of `key` on `proto` or the nearest prototype above it, read without running it. */
function lookup(proto: object, key: PropertyKey): PropertyDescriptor | undefined {
  for (let p: object | null = proto; p; p = Object.getPrototypeOf(p) as object | null) {
    const desc = Object.getOwnPropertyDescriptor(p, key)
    if (desc) return desc
  }
  return undefined
}

function hasMethodOn(proto: object, name: string): boolean {
  return typeof lookup(proto, name)?.value === 'function'
}

function defineCompareFromOrdering(proto: object): void {
  const hasLt = hasMethodOn(proto, 'lt')
  const hasGt = hasMethodOn(proto, 'gt')
  if (!hasLt && !hasGt) return
  if (lookup(proto, protocol.compare) !== undefined) return

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
 * Also wires a string-named `unit` on the prototype or a parent's (getter or data) to
 * `protocol.unit`. When no prototype has a `unit`, falls back to reading an own instance `unit`
 * property (string), so `constructor(public amount, public unit)` classes adapt without a prototype
 * accessor. Returns `Class`. Does not overwrite an existing symbol method or unit hook.
 * Reads descriptors only, so accessors are skipped and never run against the bare prototype.
 * Hook arguments pass through: a `sub` or `div` method also receives `reflected` (see
 * {@link protocol}) and computes the wrong direction if it ignores it.
 */
export function adaptProtocol<C extends abstract new (...args: never[]) => object>(Class: C): C {
  const proto = Class.prototype as object
  for (const name of PROTOCOL_NAMES) {
    if (!hasMethodOn(proto, name)) continue
    const sym = name === 'eq' ? protocol.equals : protocol[name as keyof typeof protocol]
    if (lookup(proto, sym) !== undefined) continue
    const methodName = name
    Object.defineProperty(proto, sym, {
      value: function (...a: unknown[]) {
        return (this as Record<string, (...args: unknown[]) => unknown>)[methodName](...a)
      },
      enumerable: false,
      configurable: true
    })
  }
  if (lookup(proto, protocol.unit) === undefined) {
    const unitDesc = lookup(proto, 'unit')
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
  if (!hasMethodOn(proto, 'compare')) {
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
 * Truth-value testing via `protocol.bool` when present, else `Boolean(x)`, so an object with no
 * hook is true however empty, unlike Python.
 */
export function bool(x: unknown): boolean {
  if (hasMethod(x, protocol.bool)) return Boolean(x[protocol.bool]())
  return Boolean(x)
}

/** Negation of {@link bool}. */
export function not(x: unknown): boolean {
  return !bool(x)
}
