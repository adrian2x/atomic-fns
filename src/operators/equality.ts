/**
 * Structural equality helpers.
 */

import { unbox } from '../globals/brand.js'
import { isHugeSparse, walkArray } from '../internal/arrayKeys.js'
import { enterNesting, exitNesting, guardNesting, withHookNesting } from '../internal/nesting.js'
import { bytesOf, kindOf, multisetEqual, type Kind } from './multiset.js'
import { eq, sameValueZero } from './order.js'
import { hasMethod, protocol, unitOf } from './protocol.js'

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

/** What a walk takes to be equal so far. */
interface Assumptions {
  /** Whether equality of `a` and `b` may be inferred through a third object. */
  readonly transitive: boolean
  /** Take `a` and `b` to be equal. Returns `false` when they already are. */
  assume(a: object, b: object): boolean
  /** A point to return to with {@link rollback}. */
  mark(): number
  rollback(mark: number): void
  /** The pair entered at `mark` is settled: drop what has no room to stay. */
  leave(mark: number): void
}

/** A `Map` holds at most 2^24 entries; objects past that go unremembered, which only costs time. */
const MAX_TRACKED_OBJECTS = 2 ** 24 - 2

/**
 * Hopcroft-Karp: a union-find over the objects met, so a walk stops at any pair already in one
 * class and makes at most one union per object. Union by rank without path compression, so a
 * failed candidate undoes each union in O(1).
 */
class EqualClasses implements Assumptions {
  readonly transitive = true
  readonly #ids = new Map<object, number>()
  readonly #parent: number[] = []
  readonly #rank: number[] = []
  /** Attached roots, oldest first, as `~root` when that union also raised a rank. */
  readonly #unions: number[] = []
  readonly #room: number

  constructor(room: number) {
    this.#room = room
  }

  assume(a: object, b: object): boolean {
    const [x, y] = [this.#root(a), this.#root(b)]
    if (x === undefined || y === undefined) return true
    if (x === y) return false
    const [low, high] = this.#rank[x] < this.#rank[y] ? [x, y] : [y, x]
    this.#parent[low] = high
    if (this.#rank[low] < this.#rank[high]) {
      this.#unions.push(low)
    } else {
      this.#rank[high]++
      this.#unions.push(~low)
    }
    return true
  }

  mark(): number {
    return this.#unions.length
  }

  rollback(mark: number): void {
    for (const union of this.#unions.splice(mark).reverse()) {
      const low = union < 0 ? ~union : union
      if (union < 0) this.#rank[this.#parent[low]]--
      this.#parent[low] = low
    }
  }

  leave(): void {
    // A class costs one slot per object, however many pairs built it.
  }

  #root(value: object): number | undefined {
    let id = this.#ids.get(value)
    if (id === undefined) {
      if (this.#ids.size >= this.#room) return undefined
      id = this.#parent.length
      this.#ids.set(value, id)
      this.#parent.push(id)
      this.#rank.push(0)
    }
    while (this.#parent[id] !== id) id = this.#parent[id]
    return id
  }
}

/** Settled pairs past this go unremembered, which only costs time. */
const MAX_REMEMBERED_PAIRS = 2 ** 21

/** The pairs themselves and nothing inferred from them, for a walk with an opaque hook. */
class EqualPairs implements Assumptions {
  readonly transitive = false
  readonly #pairs = new PairSet()
  readonly #added: [object, object][] = []
  readonly #room: number

  constructor(room: number) {
    this.#room = room
  }

  assume(a: object, b: object): boolean {
    if (this.#pairs.has(a, b)) return false
    this.#pairs.add(a, b)
    this.#added.push([a, b])
    return true
  }

  mark(): number {
    return this.#added.length
  }

  rollback(mark: number): void {
    for (const [a, b] of this.#added.splice(mark)) this.#pairs.delete(a, b)
  }

  leave(mark: number): void {
    if (mark >= this.#room) this.rollback(mark)
  }
}

/**
 * Internal state shared by every comparison of one outermost call, hooks and multiset matching
 * included, so shared references are compared once. Not exported from any barrel.
 *
 * Equality is the greatest bisimulation: a pair holds unless a difference can be reached from it.
 * A walk takes each pair it enters to be equal and looks for that difference. A difference ends a
 * plain walk, while multiset matching catches it and tries the next candidate, so a failed candidate
 * rolls back all it assumed. Unequal answers are never rolled back: taking more pairs to be equal
 * can only skip a difference, never add one, so a false reached under assumptions also holds without
 * them (multiset matching keeps this by answering false only after an exact search).
 *
 * Inferring a pair through a third object needs equality to be transitive. That holds for structure
 * and for scalars of one kind and unit, but not for what an opaque hook says or across units
 * (`USD 5 = 5 = JPY 5`), so such an answer abandons the walk, which then runs again on bare pairs.
 */
export interface DeepEqualSession {
  readonly assumed: Assumptions
  /** Pairs known unequal. Created by the first remembered failure; most walks have none. */
  disproven?: PairSet
  /** Pairs walked so far. */
  visits: number
  /** Comparisons the walk may still make before it gives up. */
  visitRoom: number
  /** Failures the session may still store. */
  failureRoom: number
  /** Calls hooks made back into this session. */
  reentries: number
  /** The answer no longer counts, because {@link Assumptions.transitive} proved false. */
  abandoned: boolean
}

/**
 * Pairs a failed comparison must have walked before it is remembered. A wide Heap fails most of
 * its k^2 candidate pairs: remembering the shallow ones saves nothing, while the walks that
 * multiply per level all pass this quickly.
 */
const MIN_VISITS_TO_REMEMBER_FAILURE = 32

/** A full memo stops adding: a pair that finds no room is only compared again. */
const MAX_REMEMBERED_FAILURES = 2 ** 20

/**
 * Comparisons one call may make, so candidates that pair all-to-all end in a catchable error.
 * Distinct pairs alone cannot reach it: 2^25 pairs would need more objects than a default heap holds.
 */
const MAX_COMPARISONS = 2 ** 25
const COMPARISONS_ERROR = `deepEqual exceeded ${String(MAX_COMPARISONS)} comparisons`

/** Create an empty session (nothing assumed or settled), inferring pairs when `transitive`. */
export function createDeepEqualSession(transitive = true, room?: number): DeepEqualSession {
  return {
    assumed: transitive
      ? new EqualClasses(room ?? MAX_TRACKED_OBJECTS)
      : new EqualPairs(room ?? MAX_REMEMBERED_PAIRS),
    visits: 0,
    visitRoom: MAX_COMPARISONS,
    failureRoom: MAX_REMEMBERED_FAILURES,
    reentries: 0,
    abandoned: false
  }
}

/** The session of the walk whose hook is running. Getters and other user code see none. */
let hookSession: DeepEqualSession | undefined

/**
 * Run `walk` in the session of the calling hook, or else in a new one, and again on bare pairs if
 * that one is abandoned.
 */
function inSession(walk: (session: DeepEqualSession) => boolean): boolean {
  const caller = hookSession
  if (caller !== undefined) {
    caller.reentries++
    hookSession = undefined
    try {
      return walk(caller)
    } finally {
      hookSession = caller
    }
  }
  const session = createDeepEqualSession()
  const equal = walk(session)
  return session.abandoned ? walk(createDeepEqualSession(false)) : equal
}

function isObject(v: unknown): v is object {
  return (typeof v === 'object' && v !== null) || typeof v === 'function'
}

function prototypeOf(v: object): object | null {
  return Object.getPrototypeOf(v) as object | null
}

function classNameOf(prototype: object): string | undefined {
  const name = (prototype as { constructor?: { name?: unknown } }).constructor?.name
  return typeof name === 'string' ? name : undefined
}

function isPlainPrototype(prototype: object | null): boolean {
  if (prototype === null) return true
  return prototypeOf(prototype) === null && classNameOf(prototype) === 'Object'
}

function areTwins(x: object, y: object): boolean {
  const name = classNameOf(x)
  return x !== y && name !== undefined && name === classNameOf(y)
}

/** One class, or its twin from another realm: two realms share no prototype, even at the root. */
function sameClass(a: object, b: object): boolean {
  let x = prototypeOf(a)
  let y = prototypeOf(b)
  if (x === y) return true
  if (isPlainPrototype(x) && isPlainPrototype(y)) return true
  while (x !== null && y !== null && areTwins(x, y)) {
    x = prototypeOf(x)
    y = prototypeOf(y)
  }
  return x === null && y === null
}

const FLOAT_ARRAY_TAGS = ['[object Float16Array]', '[object Float32Array]', '[object Float64Array]']

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i])
}

function viewsEqual(a: ArrayBufferView, b: ArrayBufferView): boolean {
  if (!FLOAT_ARRAY_TAGS.includes(Object.prototype.toString.call(a))) {
    return bytesEqual(bytesOf(a), bytesOf(b))
  }
  const [x, y] = [a as Float64Array, b as Float64Array]
  return x.length === y.length && x.every((value, i) => sameValueZero(value, y[i]))
}

function countComparison(session: DeepEqualSession): void {
  if (session.visitRoom-- <= 0) throw new RangeError(COMPARISONS_ERROR)
}

/** The answer a pair already has, or `undefined` once it is entered as a new one. */
function enterPair(a: object, b: object, session: DeepEqualSession): boolean | undefined {
  if (session.disproven?.has(a, b) === true) return false
  if (!session.assumed.assume(a, b)) return true
  countComparison(session)
  session.visits++
  return undefined
}

function settle(
  a: object,
  b: object,
  session: DeepEqualSession,
  equal: boolean,
  visitsBefore: number,
  mark: number
): boolean {
  session.assumed.leave(mark)
  if (
    !equal &&
    session.failureRoom > 0 &&
    session.visits - visitsBefore >= MIN_VISITS_TO_REMEMBER_FAILURE
  ) {
    session.failureRoom--
    session.disproven ??= new PairSet()
    session.disproven.add(a, b)
  }
  return equal
}

/** A value with `protocol.rank` 1 or 5 has no children to share and no cycle to close. */
function isScalar(v: unknown): boolean {
  const rank = (v as { [protocol.rank]?: unknown } | null | undefined)?.[protocol.rank]
  return rank === 1 || rank === 5
}

function hookAnswer(a: unknown, b: unknown, session: DeepEqualSession): boolean {
  const { reentries } = session
  hookSession = session
  try {
    // Half of HOOK_NESTING_COST at dispatch; collection hooks charge the other half in-method.
    const equal = withHookNesting(() => eq(a, b))
    const opaque = equal && a !== b && session.reentries === reentries
    if (opaque && session.assumed.transitive && !isSameScalar(a, b)) session.abandoned = true
    return equal
  } finally {
    hookSession = undefined
  }
}

function isSameScalar(a: unknown, b: unknown): boolean {
  if (!isScalar(a) || !isScalar(b)) return false
  return prototypeOf(a as object) === prototypeOf(b as object) && unitOf(a) === unitOf(b)
}

function hookEqual(a: unknown, b: unknown, session: DeepEqualSession): boolean {
  if (a === b || !isObject(a) || !isObject(b) || (isScalar(a) && isScalar(b))) {
    countComparison(session)
    return hookAnswer(a, b, session)
  }
  const mark = session.assumed.mark()
  const known = enterPair(a, b, session)
  if (known !== undefined) return known
  const visitsBefore = session.visits
  return settle(a, b, session, hookAnswer(a, b, session), visitsBefore, mark)
}

// The pair walk below stays inline: a shared wrapper adds stack frames per nesting level.
function deepEqualInner(a: unknown, b: unknown, session: DeepEqualSession): boolean {
  if (session.abandoned) return false
  if (hasMethod(a, protocol.equals) || hasMethod(b, protocol.equals)) {
    return hookEqual(a, b, session)
  }
  if (eq(a, b)) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false

  enterNesting()
  try {
    const kind = kindOf(a)
    if (kind !== kindOf(b) || !sameClass(a, b)) return false
    switch (kind) {
      case 'opaque':
        return false
      case 'boxed':
        return Object.is(unbox(a), unbox(b))
      case 'date':
        return sameValueZero((a as Date).getTime(), (b as Date).getTime())
      case 'regexp':
        return (
          (a as RegExp).source === (b as RegExp).source &&
          (a as RegExp).flags === (b as RegExp).flags
        )
      case 'error':
        return (
          (a as Error).name === (b as Error).name && (a as Error).message === (b as Error).message
        )
    }
    const mark = session.assumed.mark()
    const known = enterPair(a, b, session)
    if (known !== undefined) return known
    const visitsBefore = session.visits
    return settle(a, b, session, deepEqualChildren(a, b, kind, session), visitsBefore, mark)
  } finally {
    exitNesting()
  }
}

function enumerableKeys(v: object): (string | symbol)[] {
  const symbols = Object.getOwnPropertySymbols(v)
  if (symbols.length === 0) return Object.keys(v)
  return [...Object.keys(v), ...symbols.filter((key) => isEnumerableKey(v, key))]
}

function isEnumerableKey(v: object, key: PropertyKey): boolean {
  return Object.prototype.propertyIsEnumerable.call(v, key)
}

/** Reads own indices from `from` on, so holes cost nothing and read as `undefined`. */
function sparseArraysEqual(
  a: unknown[],
  b: unknown[],
  from: number,
  session: DeepEqualSession
): boolean {
  const ownEqual = (array: unknown[], skip?: unknown[]): boolean => {
    let equal = true
    walkArray(array, (ev) => {
      if (ev.kind !== 'value' || ev.index < from || (skip !== undefined && ev.index in skip)) return
      equal = deepEqualInner(a[ev.index], b[ev.index], session)
      return equal ? undefined : false
    })
    return equal
  }
  return ownEqual(a) && ownEqual(b, a)
}

function arraysEqual(a: unknown[], b: unknown[], session: DeepEqualSession): boolean {
  if (a.length !== b.length) return false
  const len = a.length
  let i = 0
  for (; i < len && i in a && i in b; i++) {
    if (!deepEqualInner(a[i], b[i], session)) return false
  }
  if (i < len && (isHugeSparse(a) || isHugeSparse(b))) {
    return sparseArraysEqual(a, b, i, session)
  }
  for (; i < len; i++) {
    if (!deepEqualInner(a[i], b[i], session)) return false
  }
  return true
}

function deepEqualChildren(a: object, b: object, kind: Kind, session: DeepEqualSession): boolean {
  switch (kind) {
    case 'view':
      return viewsEqual(a as ArrayBufferView, b as ArrayBufferView)
    case 'buffer':
      return bytesEqual(bytesOf(a as ArrayBuffer), bytesOf(b as ArrayBuffer))
    case 'map':
      return mapsEqual(a as Map<unknown, unknown>, b as Map<unknown, unknown>, session)
    case 'set':
      return setsEqual(a as Set<unknown>, b as Set<unknown>, session)
    case 'array':
      return arraysEqual(a as unknown[], b as unknown[], session)
  }
  const keys = enumerableKeys(a)
  if (keys.length !== enumerableKeys(b).length) return false
  for (const key of keys) {
    if (!isEnumerableKey(b, key)) return false
    const [x, y] = [a as Record<PropertyKey, unknown>, b as Record<PropertyKey, unknown>]
    if (!deepEqualInner(x[key], y[key], session)) return false
  }
  return true
}

function isPrimitive(value: unknown): boolean {
  return value === null || (typeof value !== 'object' && typeof value !== 'function')
}

function membersEqual(
  a: readonly unknown[],
  b: readonly unknown[],
  session: DeepEqualSession
): boolean {
  return multisetEqual(a, b, (x, y) => {
    countComparison(session)
    return deepEqualInSession(x, y, session)
  })
}

function setsEqual(a: Set<unknown>, b: Set<unknown>, session: DeepEqualSession): boolean {
  if (a.size !== b.size) return false
  return a.isSubsetOf(b) || withHookNesting(() => membersEqual([...a], [...b], session))
}

function mapsEqual(
  a: Map<unknown, unknown>,
  b: Map<unknown, unknown>,
  session: DeepEqualSession
): boolean {
  if (a.size !== b.size) return false
  if (!a.keys().every(isPrimitive) || !b.keys().every(isPrimitive)) {
    return withHookNesting(() => membersEqual([...a], [...b], session))
  }
  for (const [k, v] of a) {
    if (!b.has(k)) return false
    if (!deepEqualInner(v, b.get(k), session)) return false
  }
  return true
}

/**
 * Multiset equality under `deepEqual`, for a collection hook: every candidate counts towards the
 * session's limit. Internal: not exported from the public barrels.
 */
export function deepMultisetEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  return inSession((session) => membersEqual(a, b, session))
}

/** Same entries under `deepEqual`, in any order. Internal: not exported from the public barrels. */
export function deepMapEqual(a: Map<unknown, unknown>, b: Map<unknown, unknown>): boolean {
  return inSession((session) => mapsEqual(a, b, session))
}

/**
 * Deep structural equality with cycle handling, the greatest bisimulation over the values' kinds.
 * Dispatches to `protocol.equals` when either side defines it. Arrays, plain objects and class
 * instances compare by their own enumerable keys, symbols included; an explicit `undefined` equals
 * an array hole. Boxed primitives compare by `Object.is` on their primitive value, Dates by time
 * (invalid ones are equal), RegExps by source and flags, Errors by name and message, buffers and
 * views by bytes, and float typed arrays by element under SameValueZero. Set members and the entries
 * of a Map with an object key compare as multisets, also by `deepEqual`. A value of any other kind
 * (URL, Promise, WeakMap, Blob, generators, ...) equals only itself, as in Lodash `isEqual`.
 *
 * Both sides must be of one class, or that class's twin from another realm. Null-prototype and
 * `Object.prototype` objects are one plain kind.
 *
 * Each shared object is compared once, so memory and time stay proportional to the distinct objects
 * however they share, and two cycles of different lengths are compared in the sum of their lengths.
 * Hooks share that work; a hook that returns without calling back into `deepEqual` makes the call
 * run again without inferring pairs through a third object, since such an equality need not be
 * transitive, and a `protocol.equals` that does call back must be an equivalence. Nesting past 1000
 * levels throws `RangeError` (the cap is a security bound, not an implementation limit), counted only
 * for object pairs (after primitive checks), so a 1000-deep structure ending in a primitive is
 * accepted. Candidates that pair all-to-all stop at 2^25 comparisons with a `RangeError`.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  return inSession((session) => deepEqualInSession(a, b, session))
}

/**
 * `deepEqual` over a given session, undoing what a failed comparison assumed. Nesting is counted
 * through the shared nesting guard exactly as in `deepEqual`. Internal: not exported from the public
 * barrels.
 */
export function deepEqualInSession(a: unknown, b: unknown, session: DeepEqualSession): boolean {
  const mark = session.assumed.mark()
  const equal = guardNesting(() => deepEqualInner(a, b, session))
  if (!equal) session.assumed.rollback(mark)
  return equal
}

/**
 * Shallow equality of own enumerable string keys via SameValueZero, for arrays, plain objects and
 * class instances of one class. Any other object equals only itself.
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (sameValueZero(a, b)) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  const kind = kindOf(a)
  if ((kind !== 'keyed' && kind !== 'array') || kind !== kindOf(b) || !sameClass(a, b)) return false
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  const [x, y] = [a as Record<string, unknown>, b as Record<string, unknown>]
  return keys.every((key) => isEnumerableKey(b, key) && sameValueZero(x[key], y[key]))
}
