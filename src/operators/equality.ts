/**
 * Structural equality helpers.
 */

import { eq, sameValueZero } from './order.js'

function tagOf(v: object): string {
  return Object.prototype.toString.call(v)
}

function bytesEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false
  const ua = new Uint8Array(a)
  const ub = new Uint8Array(b)
  for (let i = 0; i < ua.length; i++) {
    if (ua[i] !== ub[i]) return false
  }
  return true
}

function deepEqualInner(a: unknown, b: unknown, seen: WeakMap<object, object>): boolean {
  if (eq(a, b)) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false
  if (tagOf(a) !== tagOf(b)) return false

  const prior = seen.get(a)
  if (prior !== undefined) return prior === b
  seen.set(a, b)

  if (a instanceof Date) {
    return a.getTime() === (b as Date).getTime()
  }
  if (a instanceof RegExp) {
    return a.source === (b as RegExp).source && a.flags === (b as RegExp).flags
  }
  if (a instanceof ArrayBuffer) {
    return bytesEqual(a, b as ArrayBuffer)
  }
  if (ArrayBuffer.isView(a)) {
    const va = a
    const vb = b as ArrayBufferView
    if (va.byteLength !== vb.byteLength) return false
    const ua = new Uint8Array(va.buffer, va.byteOffset, va.byteLength)
    const ub = new Uint8Array(vb.buffer, vb.byteOffset, vb.byteLength)
    for (let i = 0; i < ua.length; i++) {
      if (ua[i] !== ub[i]) return false
    }
    return true
  }
  if (a instanceof Map) {
    const mb = b as Map<unknown, unknown>
    if (a.size !== mb.size) return false
    for (const [k, v] of a) {
      if (!mb.has(k)) return false
      if (!deepEqualInner(v, mb.get(k), seen)) return false
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
      if (!deepEqualInner(a[i], bb[i], seen)) return false
    }
    return true
  }

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false
    if (
      !deepEqualInner((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], seen)
    ) {
      return false
    }
  }
  return true
}

/**
 * Deep structural equality with cycle handling.
 * Never recurses unboundedly; a pair already under comparison is treated as equal.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  return deepEqualInner(a, b, new WeakMap())
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
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false
    if (!sameValueZero((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) {
      return false
    }
  }
  return true
}
