/**
 * Structural equality helpers.
 */

import { isHugeSparse, walkArray } from '../internal/arrayKeys.js'
import {
  enterNesting,
  exitNesting,
  guardNesting,
  walkSession,
  withHookNesting
} from '../internal/nesting.js'
import { eq, sameValueZero } from './order.js'
import { hasMethod, protocol } from './protocol.js'

/** Pairs `(a, b)` currently being compared on the active path, keyed by `a`. */
type Pending = WeakMap<object, Set<object>>

/** Pairs with a settled answer within one deepEqual session. */
type Settled = WeakMap<object, WeakSet<object>>

/**
 * Internal state shared by every comparison of one top-level call, collection hooks and Heap
 * matching included, so shared-reference subtrees are compared once. Not exported from any barrel.
 *
 * A pair on the active path is assumed equal, which a later failure of that pair can disprove.
 * In a plain walk that failure ends the call, but Heap matching catches it and tries the next
 * candidate, so proofs that may rest on the assumption are retracted (see `deepEqualInSession`).
 * Unequal answers are never retracted: every comparison is monotone in its parts, so a false
 * reached under an assumption also holds without it (Heap matching keeps this by leaving its
 * greedy pass once a pair was assumed). While the memos have room, a pair that walked far can
 * therefore fail only once, which bounds the retractions and keeps cyclic input polynomial.
 */
export interface DeepEqualSession {
  readonly pending: Pending
  readonly proven: Settled
  /** Created by the first remembered failure; most walks have none. */
  disproven?: Settled
  /** Pairs proven since the first assumption: the only proofs that can rest on one. */
  readonly provenLog: [object, object][]
  /** Times a pair on the active path was assumed equal. */
  assumptions: number
  /** Pairs put on the active path so far. */
  visits: number
  /** Comparisons the walk may still make before it gives up. */
  visitRoom: number
  /** Proofs the session may still store. */
  proofRoom: number
  /** Failures the session may still store. */
  failureRoom: number
}

/**
 * Pairs a failed comparison must have walked before it is remembered. A wide Heap fails most of
 * its k^2 candidate pairs: remembering the shallow ones saves nothing, while the walks that
 * multiply per level all pass this quickly.
 */
const MIN_VISITS_TO_REMEMBER_FAILURE = 32

/**
 * Bounds on what one session stores, so a walk's memory stays fixed however many pairs it meets.
 * A full memo keeps what it holds and stops adding: earlier pairs may be expensive, and a pair
 * that finds no room is only compared again, so answers do not change. Failures get their own
 * bound so that a flood of failed Heap candidates cannot take the room proofs need to keep shared
 * references linear.
 */
const MAX_REMEMBERED_PROOFS = 2 ** 21
const MAX_REMEMBERED_FAILURES = 2 ** 20

/**
 * Comparisons one call may make. Past the memo bounds repeated work can multiply per level, so
 * this turns a hang into a catchable error. Distinct pairs alone cannot reach it: 2^25 pairs
 * would need more objects than a default heap holds.
 */
const MAX_COMPARISONS = 2 ** 25
const COMPARISONS_ERROR = `deepEqual exceeded ${String(MAX_COMPARISONS)} comparisons`

/** Create an empty session (no pairs pending or settled). */
export function createDeepEqualSession(): DeepEqualSession {
  return {
    pending: new WeakMap(),
    proven: new WeakMap(),
    provenLog: [],
    assumptions: 0,
    visits: 0,
    visitRoom: MAX_COMPARISONS,
    proofRoom: MAX_REMEMBERED_PROOFS,
    failureRoom: MAX_REMEMBERED_FAILURES
  }
}

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

function remember(pairs: Settled, a: object, b: object): void {
  let set = pairs.get(a)
  if (set === undefined) {
    set = new WeakSet()
    pairs.set(a, set)
  }
  set.add(b)
}

function isRemembered(pairs: Settled, a: object, b: object): boolean {
  return pairs.get(a)?.has(b) === true || pairs.get(b)?.has(a) === true
}

/** The session's settled answer for a pair, or `undefined` when it has none. */
function knownAnswer(a: object, b: object, session: DeepEqualSession): boolean | undefined {
  if (session.disproven !== undefined && isRemembered(session.disproven, a, b)) return false
  return isRemembered(session.proven, a, b) ? true : undefined
}

function countComparison(session: DeepEqualSession): void {
  if (session.visitRoom-- <= 0) throw new RangeError(COMPARISONS_ERROR)
}

/**
 * Put a pair on the active path; delete `b` from the returned set to take it off again. A pair
 * already there is assumed equal instead, and `undefined` is returned.
 */
function enterPair(a: object, b: object, session: DeepEqualSession): Set<object> | undefined {
  let partners = session.pending.get(a)
  if (partners === undefined) {
    partners = new Set()
    session.pending.set(a, partners)
  } else if (partners.has(b)) {
    session.assumptions++
    return undefined
  }
  partners.add(b)
  session.visits++
  countComparison(session)
  return partners
}

function settle(
  a: object,
  b: object,
  session: DeepEqualSession,
  equal: boolean,
  visitsBefore: number
): boolean {
  if (equal) {
    if (session.proofRoom > 0) {
      session.proofRoom--
      remember(session.proven, a, b)
      if (session.assumptions !== 0) session.provenLog.push([a, b])
    }
  } else if (
    session.failureRoom > 0 &&
    session.visits - visitsBefore >= MIN_VISITS_TO_REMEMBER_FAILURE
  ) {
    session.failureRoom--
    session.disproven ??= new WeakMap()
    remember(session.disproven, a, b)
  }
  return equal
}

/** Only iterables can share work: a hook on a scalar (Decimal, IntlDate) has nothing to walk. */
function hasItems(v: unknown): v is object {
  return typeof v === 'object' && v !== null && Symbol.iterator in v
}

// The two pair walks below stay inline: a shared wrapper adds stack frames per nesting level.
function deepEqualInner(a: unknown, b: unknown, session: DeepEqualSession): boolean {
  if (hasMethod(a, protocol.equals) || hasMethod(b, protocol.equals)) {
    // Half of HOOK_NESTING_COST at dispatch; collection hooks charge the other half in-method.
    if (!hasItems(a) || !hasItems(b)) {
      countComparison(session)
      return withHookNesting(() => eq(a, b))
    }
    const known = knownAnswer(a, b, session)
    if (known !== undefined) return known
    const partners = enterPair(a, b, session)
    if (partners === undefined) return true
    const visitsBefore = session.visits
    try {
      const equal = withHookNesting(() => eq(a, b))
      return settle(a, b, session, equal, visitsBefore)
    } finally {
      partners.delete(b)
    }
  }
  if (eq(a, b)) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false

  enterNesting()
  try {
    if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false
    if (tagOf(a) !== tagOf(b)) return false

    const boxed = unboxed(a)
    if (boxed !== NOT_BOXED) return Object.is(boxed, unboxed(b))

    // A pair on the current path is treated as equal. The pair is removed again after its
    // children are compared, so a shared sub-object may be paired with different partners.
    const known = knownAnswer(a, b, session)
    if (known !== undefined) return known
    const partners = enterPair(a, b, session)
    if (partners === undefined) return true
    const visitsBefore = session.visits
    try {
      const equal = deepEqualChildren(a, b, session)
      return settle(a, b, session, equal, visitsBefore)
    } finally {
      partners.delete(b)
    }
  } finally {
    exitNesting()
  }
}

function deepEqualChildren(a: object, b: object, session: DeepEqualSession): boolean {
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
      if (!deepEqualInner(v, mb.get(k), session)) return false
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
    const len = a.length
    let i = 0
    for (; i < len && i in a && i in bb; i++) {
      if (!deepEqualInner(a[i], bb[i], session)) return false
    }
    if (i < len && (isHugeSparse(a) || isHugeSparse(bb))) {
      const keysA: number[] = []
      const keysB: number[] = []
      walkArray(a, (ev) => {
        if (ev.kind === 'value' && ev.index >= i) keysA.push(ev.index)
      })
      walkArray(bb, (ev) => {
        if (ev.kind === 'value' && ev.index >= i) keysB.push(ev.index)
      })
      if (keysA.length !== keysB.length) return false
      for (let k = 0; k < keysA.length; k++) {
        if (keysA[k] !== keysB[k]) return false
        if (!deepEqualInner(a[keysA[k]], bb[keysB[k]], session)) return false
      }
      return true
    }
    for (; i < len; i++) {
      if (!deepEqualInner(a[i], bb[i], session)) return false
    }
    return true
  }

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const k of keysA) {
    if (!Object.hasOwn(b, k)) return false
    if (
      !deepEqualInner((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], session)
    ) {
      return false
    }
  }
  return true
}

/**
 * Deep structural equality with cycle handling.
 * Dispatches to `protocol.equals` when either side defines it. Boxed primitives compare by
 * `Object.is` on their primitive value. Nesting past 1000 levels throws `RangeError` (the cap
 * is a security bound, not an implementation limit). A pair already under comparison on the
 * current path is treated as equal. Settled pairs are memoized for the rest of the top-level
 * call so shared-reference DAGs stay linear up to the memo bounds (2^20 failures, 2^21 proofs);
 * past them repeated work is recomputed, and a call that makes 2^25 comparisons throws
 * `RangeError`. Collection equality hooks re-enter this function,
 * continue the same nesting count and share that memo. Nesting is counted only for object pairs
 * (after primitive checks), so a 1000-deep structure ending in a primitive is accepted.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  return deepEqualInSession(a, b, walkSession(createDeepEqualSession))
}

/**
 * `deepEqual` over a given session. Pairs settled by earlier calls on the same session are
 * reused, and nesting is counted through the shared nesting guard exactly as in `deepEqual`. A
 * comparison that fails after assuming a pair retracts what it proved, because those proofs may
 * rest on the assumption that just failed. Internal: not exported from the public barrels.
 */
export function deepEqualInSession(a: unknown, b: unknown, session: DeepEqualSession): boolean {
  const proofsBefore = session.provenLog.length
  const assumptionsBefore = session.assumptions
  const equal = guardNesting(() => deepEqualInner(a, b, session))
  if (!equal && session.assumptions !== assumptionsBefore) {
    const retracted = session.provenLog.splice(proofsBefore)
    for (const [x, y] of retracted) session.proven.get(x)?.delete(y)
    session.proofRoom += retracted.length
  }
  return equal
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
