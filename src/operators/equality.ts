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
import { multisetEqual } from './multiset.js'
import { eq, sameValueZero } from './order.js'
import { hasMethod, protocol } from './protocol.js'

/**
 * Unordered object pairs. Most objects meet one partner, so those cost a single `Map` entry; a
 * `Set` per object would take far more memory than the data being compared.
 */
class PairSet {
  readonly #first = new Map<object, object>()
  readonly #more = new Map<object, Set<object>>()

  add(a: object, b: object): void {
    const first = this.#first.get(a)
    if (first === undefined) {
      this.#first.set(a, b)
    } else if (first !== b) {
      let more = this.#more.get(a)
      if (more === undefined) {
        more = new Set()
        this.#more.set(a, more)
      }
      more.add(b)
    }
  }

  has(a: object, b: object): boolean {
    return this.#holds(a, b) || this.#holds(b, a)
  }

  delete(a: object, b: object): void {
    if (this.#first.get(a) === b) this.#first.delete(a)
    else this.#more.get(a)?.delete(b)
  }

  #holds(a: object, b: object): boolean {
    return this.#first.get(a) === b || this.#more.get(a)?.has(b) === true
  }
}

/**
 * Internal state shared by every comparison of one top-level call, collection hooks and Heap
 * matching included, so shared-reference subtrees are compared once. Not exported from any barrel.
 *
 * A pair on the active path is assumed equal, which a later failure of that pair can disprove.
 * In a plain walk that failure ends the call, but multiset matching catches it and tries the next
 * candidate, so proofs that may rest on the assumption are retracted (see `deepEqualInSession`).
 * Unequal answers are never retracted: every comparison is monotone in its parts, so a false
 * reached under an assumption also holds without it (multiset matching keeps this by answering
 * false only after an exact search). While the memos have room, a pair that walked far can
 * therefore fail only once, which bounds the retractions and keeps cyclic input polynomial.
 */
export interface DeepEqualSession {
  /** Pairs on the active path. */
  readonly pending: PairSet
  /** Pairs known equal. */
  readonly proven: PairSet
  /** Pairs known unequal. Created by the first remembered failure; most walks have none. */
  disproven?: PairSet
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
    pending: new PairSet(),
    proven: new PairSet(),
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

/** The session's settled answer for a pair, or `undefined` when it has none. */
function knownAnswer(a: object, b: object, session: DeepEqualSession): boolean | undefined {
  if (session.disproven?.has(a, b) === true) return false
  return session.proven.has(a, b) ? true : undefined
}

function countComparison(session: DeepEqualSession): void {
  if (session.visitRoom-- <= 0) throw new RangeError(COMPARISONS_ERROR)
}

/** Put a pair on the active path, or return `false` and assume it equal when it is already there. */
function enterPair(a: object, b: object, session: DeepEqualSession): boolean {
  if (session.pending.has(a, b)) {
    session.assumptions++
    return false
  }
  countComparison(session)
  session.pending.add(a, b)
  session.visits++
  return true
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
      session.proven.add(a, b)
      if (session.assumptions !== 0) session.provenLog.push([a, b])
    }
  } else if (
    session.failureRoom > 0 &&
    session.visits - visitsBefore >= MIN_VISITS_TO_REMEMBER_FAILURE
  ) {
    session.failureRoom--
    session.disproven ??= new PairSet()
    session.disproven.add(a, b)
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
    if (!enterPair(a, b, session)) return true
    const visitsBefore = session.visits
    try {
      const equal = withHookNesting(() => eq(a, b))
      return settle(a, b, session, equal, visitsBefore)
    } finally {
      session.pending.delete(a, b)
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
    if (!enterPair(a, b, session)) return true
    const visitsBefore = session.visits
    try {
      const equal = deepEqualChildren(a, b, session)
      return settle(a, b, session, equal, visitsBefore)
    } finally {
      session.pending.delete(a, b)
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
  if (a instanceof Map) return deepMapEqual(a, b as Map<unknown, unknown>, session)
  if (a instanceof Set) return deepSetEqual(a, b as Set<unknown>, session)
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

function isPrimitive(value: unknown): boolean {
  return value === null || (typeof value !== 'object' && typeof value !== 'function')
}

/**
 * Multiset equality under `deepEqual` in the walk's session; every candidate counts towards its
 * limit. A caller that is not a collection hook charges {@link withHookNesting} for the extra stack.
 * Internal: not exported from the public barrels.
 */
export function deepMultisetEqual(
  a: readonly unknown[],
  b: readonly unknown[],
  session: DeepEqualSession = walkSession(createDeepEqualSession)
): boolean {
  return multisetEqual(a, b, (x, y) => {
    countComparison(session)
    return deepEqualInSession(x, y, session)
  })
}

function deepSetEqual(a: Set<unknown>, b: Set<unknown>, session: DeepEqualSession): boolean {
  if (a.size !== b.size) return false
  return a.isSubsetOf(b) || withHookNesting(() => deepMultisetEqual([...a], [...b], session))
}

/** Same entries under `deepEqual`, in any order. Internal: not exported from the public barrels. */
export function deepMapEqual(
  a: Map<unknown, unknown>,
  b: Map<unknown, unknown>,
  session: DeepEqualSession = walkSession(createDeepEqualSession)
): boolean {
  if (a.size !== b.size) return false
  if (!a.keys().every(isPrimitive) || !b.keys().every(isPrimitive)) {
    return withHookNesting(() => deepMultisetEqual([...a], [...b], session))
  }
  for (const [k, v] of a) {
    if (!b.has(k)) return false
    if (!deepEqualInner(v, b.get(k), session)) return false
  }
  return true
}

/**
 * Deep structural equality with cycle handling.
 * Dispatches to `protocol.equals` when either side defines it. Boxed primitives compare by
 * `Object.is` on their primitive value. Set members and the entries of a Map with an object key
 * compare as multisets, also by `deepEqual`. Nesting past 1000 levels throws `RangeError` (the cap
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
    for (const [x, y] of retracted) session.proven.delete(x, y)
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
