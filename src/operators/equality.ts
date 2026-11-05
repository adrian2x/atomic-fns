/**
 * Structural equality helpers.
 */

import { unbox } from '../globals/brand.js'
import { walkArray } from '../internal/arrayKeys.js'
import { enterNesting, exitNesting, guardNesting, withHookNesting } from '../internal/nesting.js'
import { bytesOf, isFloatView, kindOf, multisetEqual, type Kind } from './multiset.js'
import { eq, isNumericPrimitive, sameValueZero } from './order.js'
import { hasMethod, protocol, unitOf } from './protocol.js'

/** A `Map` holds at most 2^24 entries; objects past that go unremembered, which only costs time. */
const MAX_TRACKED_OBJECTS = 2 ** 24 - 2

/** Comparisons a failure must have cost before it is remembered; the rest are cheap to redo. */
const MIN_VISITS_TO_REMEMBER_FAILURE = 32
const MAX_REMEMBERED_FAILURES = 2 ** 20

/** Comparisons one call may repeat, so candidates that pair all-to-all end in a catchable error. */
const MAX_COMPARISONS = 2 ** 25
const COMPARISONS_ERROR = `deepEqual exceeded ${String(MAX_COMPARISONS)} comparisons`
/** What one comparison covers: bytes read one by one, and characters the engine compares in bulk. */
const BYTES_PER_COMPARISON = 32
const CHARS_PER_COMPARISON = 1024

/**
 * What one outermost call has taken to be equal, shared with its hooks and multiset matching.
 * Internal: not exported from the public barrels.
 *
 * Equality is the greatest bisimulation: a pair holds unless a difference can be reached from it.
 * A walk takes each pair it enters to be equal and looks for that difference (Hopcroft-Karp), so it
 * stops at any pair already in one class of a union-find and makes at most one union per object. A
 * difference ends a plain walk, while multiset matching catches it and tries the next candidate, so
 * a failed candidate rolls back its unions: union by rank without path compression makes that O(1)
 * each. A false is final, since taking more pairs to be equal can only skip a difference.
 *
 * So a plain walk repeats nothing and pays nothing, at any size. A trial, a comparison whose false
 * does not end the walk, is what can repeat: it pays its real cost as it goes. One that holds outside
 * any other gets back all but what failed inside it, as its unions stay and that work is never done
 * again.
 */
export class DeepEqualSession {
  /** Comparisons the walk may still repeat before it gives up. */
  visitRoom = MAX_COMPARISONS
  /** Trials running, one inside the other. */
  trials = 0
  /** Comparisons spent on trials that failed. */
  wasted = 0
  /** Key counts of the records a hash found too wide to read. */
  wideRecords?: Map<object, number>
  /** Failures the session may still store. */
  failureRoom = MAX_REMEMBERED_FAILURES
  /** Objects the session may still track. */
  trackingRoom = MAX_TRACKED_OBJECTS
  readonly #ids = new Map<object, number>()
  readonly #parent: number[] = []
  readonly #rank: number[] = []
  /** Attached roots, oldest first, as `~root` when that union also raised a rank. */
  readonly #unions: number[] = []
  /** Pairs of ids known unequal. */
  readonly #unequal = new Set<number>()

  /** Pay for work that can repeat, wherever it runs. */
  count(units = 1): void {
    this.visitRoom -= units
    if (this.visitRoom < 0) throw new RangeError(COMPARISONS_ERROR)
  }

  /** Pay for work only a trial can repeat. */
  charge(units = 1): void {
    if (this.trials > 0) this.count(units)
  }

  /** The answer a pair already has, or `undefined` once it is taken to be equal. */
  enter(a: object, b: object): boolean | undefined {
    const [idA, idB] = [this.#id(a), this.#id(b)]
    if (idA === undefined || idB === undefined) {
      this.count()
      return undefined
    }
    if (this.#unequal.has(pairKey(idA, idB))) return false
    const [x, y] = [this.#root(idA), this.#root(idB)]
    if (x === y) return true
    const [low, high] = this.#rank[x] < this.#rank[y] ? [x, y] : [y, x]
    const tied = this.#rank[low] === this.#rank[high]
    this.#parent[low] = high
    if (tied) this.#rank[high]++
    this.#unions.push(tied ? ~low : low)
    return undefined
  }

  /** Remember a failure that walked far since the room was `roomBefore`. */
  settle(a: object, b: object, equal: boolean, roomBefore: number): boolean {
    if (equal || roomBefore - this.visitRoom < MIN_VISITS_TO_REMEMBER_FAILURE) return equal
    const [idA, idB] = [this.#ids.get(a), this.#ids.get(b)]
    if (idA !== undefined && idB !== undefined && this.failureRoom > 0) {
      this.failureRoom--
      this.#unequal.add(pairKey(idA, idB))
    }
    return false
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

  #id(value: object): number | undefined {
    let id = this.#ids.get(value)
    if (id === undefined && this.#ids.size < this.trackingRoom) {
      id = this.#parent.length
      this.#ids.set(value, id)
      this.#parent.push(id)
      this.#rank.push(0)
    }
    return id
  }

  #root(id: number): number {
    while (this.#parent[id] !== id) id = this.#parent[id]
    return id
  }
}

/** Ids stay below 2^24, so a pair of them fits a double exactly. */
function pairKey(x: number, y: number): number {
  return Math.min(x, y) * 2 ** 24 + Math.max(x, y)
}

/** The session of the walk whose hook is running. Getters and other user code see none. */
let hookSession: DeepEqualSession | undefined

/** Run `walk` in the session of the calling hook, or else in a new one. */
function inSession(walk: (session: DeepEqualSession) => boolean): boolean {
  const caller = hookSession
  hookSession = undefined
  try {
    return walk(caller ?? new DeepEqualSession())
  } finally {
    hookSession = caller
  }
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

function areTwins(x: object, y: object): boolean {
  const name = classNameOf(x)
  return x !== y && name !== undefined && name === classNameOf(y)
}

/** One class, or its twin from another realm: two realms share no prototype, even at the root. */
function sameClass(a: object, b: object): boolean {
  let x: object | null = prototypeOf(a) ?? Object.prototype
  let y: object | null = prototypeOf(b) ?? Object.prototype
  if (x === y) return true
  while (x !== null && y !== null && areTwins(x, y)) {
    x = prototypeOf(x)
    y = prototypeOf(y)
  }
  return x === null && y === null
}

function bytesEqual(a: Uint8Array, b: Uint8Array, session: DeepEqualSession): boolean {
  if (a.length !== b.length) return false
  return a.every((byte, i) => {
    if (i % BYTES_PER_COMPARISON === 0) session.charge()
    return byte === b[i]
  })
}

function viewsEqual(a: ArrayBufferView, b: ArrayBufferView, session: DeepEqualSession): boolean {
  if (!isFloatView(a)) return bytesEqual(bytesOf(a), bytesOf(b), session)
  const floats = b as Float64Array
  if (a.length !== floats.length) return false
  return a.every((value, i) => {
    session.charge()
    return sameValueZero(value, floats[i])
  })
}

/** A value with `protocol.rank` 1 or 5 has no children to share and no cycle to close. */
function isScalar(v: unknown): boolean {
  const rank = (v as { [protocol.rank]?: unknown } | null | undefined)?.[protocol.rank]
  return rank === 1 || rank === 5
}

function callHook(a: unknown, b: unknown, session: DeepEqualSession): boolean {
  hookSession = session
  try {
    // Half of HOOK_NESTING_COST at dispatch; collection hooks charge the other half in-method.
    return withHookNesting(() => eq(a, b))
  } finally {
    hookSession = undefined
  }
}

function hookEqual(a: unknown, b: unknown, session: DeepEqualSession): boolean {
  if (a === b || !isObject(a) || !isObject(b) || (isScalar(a) && isScalar(b))) {
    return callHook(a, b, session)
  }
  const room = session.visitRoom
  return session.enter(a, b) ?? session.settle(a, b, callHook(a, b, session), room)
}

function sameFields(a: object, b: object, ...keys: string[]): boolean {
  const [x, y] = [a as Record<string, unknown>, b as Record<string, unknown>]
  return keys.every((key) => x[key] === y[key])
}

// The pair walk below stays inline: a shared wrapper adds stack frames per nesting level.
function deepEqualInner(a: unknown, b: unknown, session: DeepEqualSession): boolean {
  session.charge(typeof a === 'string' ? 1 + Math.floor(a.length / CHARS_PER_COMPARISON) : 1)
  if (unitOf(a) !== unitOf(b)) return false
  if (hasMethod(a, protocol.equals) || hasMethod(b, protocol.equals)) {
    return hookEqual(a, b, session)
  }
  if (eq(a, b)) return true
  if (isNumericPrimitive(a) && isNumericPrimitive(b)) return a == b
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
        return sameFields(a, b, 'source', 'flags')
      case 'error':
        return sameFields(a, b, 'name', 'message')
    }
    const room = session.visitRoom
    return session.enter(a, b) ?? session.settle(a, b, childrenEqual(a, b, kind, session), room)
  } finally {
    exitNesting()
  }
}

function isEnumerableKey(v: object, key: PropertyKey): boolean {
  return Object.prototype.propertyIsEnumerable.call(v, key)
}

function enumerableKeys(v: object): (string | symbol)[] {
  const symbols = Object.getOwnPropertySymbols(v)
  if (symbols.length === 0) return Object.keys(v)
  return [...Object.keys(v), ...symbols.filter((key) => isEnumerableKey(v, key))]
}

/** Reads own indices from `from` on, so holes cost nothing and read as `undefined`. */
function sparseArraysEqual(
  a: unknown[],
  b: unknown[],
  from: number,
  session: DeepEqualSession
): boolean {
  if (session.trials > 0) session.charge(Object.keys(a).length + Object.keys(b).length)
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
  return i === len || sparseArraysEqual(a, b, i, session)
}

function childrenEqual(a: object, b: object, kind: Kind, session: DeepEqualSession): boolean {
  switch (kind) {
    case 'view':
      return viewsEqual(a as ArrayBufferView, b as ArrayBufferView, session)
    case 'buffer':
      return bytesEqual(bytesOf(a as ArrayBuffer), bytesOf(b as ArrayBuffer), session)
    case 'map':
      return mapsEqual(a as Map<unknown, unknown>, b as Map<unknown, unknown>, session)
    case 'set':
      return setsEqual(a as Set<unknown>, b as Set<unknown>, session)
    case 'array':
      return arraysEqual(a as unknown[], b as unknown[], session)
  }
  const keys = enumerableKeys(a)
  if (keys.length !== enumerableKeys(b).length) return false
  session.charge(keys.length)
  for (const key of keys) {
    if (!isEnumerableKey(b, key)) return false
    const [x, y] = [a as Record<PropertyKey, unknown>, b as Record<PropertyKey, unknown>]
    if (!deepEqualInner(x[key], y[key], session)) return false
  }
  return true
}

function membersEqual(
  a: readonly unknown[],
  b: readonly unknown[],
  session: DeepEqualSession
): boolean {
  session.charge(a.length)
  const equal = (x: unknown, y: unknown): boolean => {
    session.count()
    return deepEqualInSession(x, y, session)
  }
  return multisetEqual(a, b, equal, session)
}

function setsEqual(a: Set<unknown>, b: Set<unknown>, session: DeepEqualSession): boolean {
  if (a.size !== b.size) return false
  session.charge(a.size)
  return a.isSubsetOf(b) || withHookNesting(() => membersEqual([...a], [...b], session))
}

/** A bigint key may equal a number key, and an object key anything: those need matching. */
function isLookupKey(key: unknown): boolean {
  return !isObject(key) && typeof key !== 'bigint'
}

function mapsEqual(
  a: Map<unknown, unknown>,
  b: Map<unknown, unknown>,
  session: DeepEqualSession
): boolean {
  if (a.size !== b.size) return false
  session.charge(a.size)
  if (!a.keys().every((key) => isLookupKey(key) && b.has(key))) {
    return withHookNesting(() => membersEqual([...a], [...b], session))
  }
  for (const [k, v] of a) {
    if (!deepEqualInner(v, b.get(k), session)) return false
  }
  return true
}

/** Multiset equality under `deepEqual`, for a collection hook. Internal, as is `deepMapEqual`. */
export function deepMultisetEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  return inSession((session) => membersEqual(a, b, session))
}

export function deepMapEqual(a: Map<unknown, unknown>, b: Map<unknown, unknown>): boolean {
  return inSession((session) => mapsEqual(a, b, session))
}

/**
 * Deep structural equality with cycle handling: the greatest bisimulation over the values' kinds,
 * an equivalence relation, so a `protocol.equals` hook it dispatches to must be one too.
 *
 * Numbers of any kind (number, bigint, Decimal) are equal when their exact values are, NaN equals
 * NaN and -0 equals 0. Units must match exactly: unlike `eq`, `deepEqual(new Currency(5, 'USD'), 5)`
 * is false. Arrays compare by index and ignore other keys, as in Lodash `isEqual`, and an explicit
 * `undefined` equals a hole. Plain objects and class instances compare by own enumerable keys,
 * symbols included. Boxed primitives compare by `Object.is`, Dates by time, RegExps by source and
 * flags, Errors by name and message, buffers and views by bytes, float typed arrays by element under
 * SameValueZero. Set members and Map entries compare as multisets. Other kinds (URL, Promise,
 * WeakMap, generators, ...) equal only themselves, as in Lodash `isEqual`. Both sides must be of one
 * class or its twin from another realm; null-prototype and `Object.prototype` objects are one plain
 * kind.
 *
 * Each shared object is compared once, so time and memory stay proportional to the distinct objects
 * however they share. Nesting past 1000 levels of object pairs throws `RangeError` (a security
 * bound), as do candidates that fail past 2^25 comparisons, which count what they read: each element
 * and key, every 32 bytes of a view and every 1024 characters of a string.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (hookSession !== undefined) return inSession((session) => deepEqualInSession(a, b, session))
  const session = new DeepEqualSession()
  return guardNesting(() => deepEqualInner(a, b, session))
}

/** `deepEqual` as a trial in a given session, undoing what a failed comparison assumed. Internal. */
export function deepEqualInSession(a: unknown, b: unknown, session: DeepEqualSession): boolean {
  const mark = session.mark()
  const [room, wasted] = [session.visitRoom, session.wasted]
  session.trials++
  try {
    const equal = guardNesting(() => deepEqualInner(a, b, session))
    if (!equal) {
      session.rollback(mark)
      session.wasted = wasted + room - session.visitRoom
    } else if (session.trials === 1) {
      session.visitRoom = room - (session.wasted - wasted)
    }
    return equal
  } finally {
    session.trials--
  }
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
