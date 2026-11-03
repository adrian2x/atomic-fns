/**
 * Structural equality helpers.
 */

import { assertNestingDepth } from '../internal/nesting.js'
import { eq, sameValueZero } from './order.js'
import { hasMethod, protocol } from './protocol.js'

/** Pairs `(a, b)` currently being compared on the active path, keyed by `a`. */
type Pending = WeakMap<object, Set<object>>

const BOXED_PRIMITIVES = [Number, String, Boolean, BigInt, Symbol] as const
const NOT_BOXED = Symbol('not boxed')

/** Primitive wrapped by a boxed primitive, or `NOT_BOXED` for anything else. */
function unboxed(v: object): unknown {
  for (const Ctor of BOXED_PRIMITIVES) {
    if (v instanceof Ctor) {
      try {
        return (Ctor.prototype.valueOf as (this: unknown) => unknown).call(v)
      } catch {
        return NOT_BOXED
      }
    }
  }
  return NOT_BOXED
}

function tagOf(v: object): string {
  return Object.prototype.toString.call(v)
}

function bytes(v: ArrayBuffer | ArrayBufferView): Uint8Array {
  return v instanceof ArrayBuffer
    ? new Uint8Array(v)
    : new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
}

function bytesEqual(a: ArrayBuffer | ArrayBufferView, b: ArrayBuffer | ArrayBufferView): boolean {
  const ua = bytes(a)
  const ub = bytes(b)
  return ua.length === ub.length && ua.every((byte, i) => byte === ub[i])
}

function deepEqualInner(a: unknown, b: unknown, pending: Pending, depth: number): boolean {
  if (hasMethod(a, protocol.equals) || hasMethod(b, protocol.equals)) return eq(a, b)
  if (eq(a, b)) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  assertNestingDepth(depth)
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false
  if (tagOf(a) !== tagOf(b)) return false

  const boxed = unboxed(a)
  if (boxed !== NOT_BOXED) return Object.is(boxed, unboxed(b))

  // A pair on the current path is treated as equal. The pair is removed again after its
  // children are compared, so a shared sub-object may be paired with different partners.
  let partners = pending.get(a)
  if (partners?.has(b)) return true
  if (partners === undefined) {
    partners = new Set()
    pending.set(a, partners)
  }
  partners.add(b)
  try {
    return deepEqualChildren(a, b, pending, depth)
  } finally {
    partners.delete(b)
  }
}

function deepEqualChildren(a: object, b: object, pending: Pending, depth: number): boolean {
  if (a instanceof Date) {
    return a.getTime() === (b as Date).getTime()
  }
  if (a instanceof RegExp) {
    return a.source === (b as RegExp).source && a.flags === (b as RegExp).flags
  }
  if (a instanceof ArrayBuffer || ArrayBuffer.isView(a)) {
    return bytesEqual(a, b as ArrayBuffer | ArrayBufferView)
  }
  if (a instanceof Map) {
    const mb = b as Map<unknown, unknown>
    if (a.size !== mb.size) return false
    for (const [k, v] of a) {
      if (!mb.has(k)) return false
      if (!deepEqualInner(v, mb.get(k), pending, depth + 1)) return false
    }
    return true
  }
  if (a instanceof Set) {
    const sb = b as Set<unknown>
    if (a.size !== sb.size) return false
    for (const v of a) {
      if (!sb.has(v)) return false
    }
    return true
  }
  if (Array.isArray(a)) {
    const bb = b as unknown[]
    if (a.length !== bb.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqualInner(a[i], bb[i], pending, depth + 1)) return false
    }
    return true
  }

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const k of keysA) {
    if (!Object.hasOwn(b, k)) return false
    if (
      !deepEqualInner(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        pending,
        depth + 1
      )
    ) {
      return false
    }
  }
  return true
}

/**
 * Deep structural equality with cycle handling.
 * Dispatches to `protocol.equals` when either side defines it. Boxed primitives compare by
 * `Object.is` on their primitive value. Nesting deeper than 1000 levels throws `RangeError`; a
 * pair already under comparison on the current path is treated as equal.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  return deepEqualInner(a, b, new WeakMap(), 1)
}

/**
 * Shallow equality of own enumerable string keys via SameValueZero.
 * Returns false when exactly one argument is an array or prototypes differ.
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  const aArr = Array.isArray(a)
  const bArr = Array.isArray(b)
  if (aArr !== bArr) return false
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const k of keysA) {
    if (!Object.hasOwn(b, k)) return false
    if (!sameValueZero((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) {
      return false
    }
  }
  return true
}
