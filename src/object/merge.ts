/**
 * Writing sources into a target: `merge`, `defaults`, `defaultsDeep`.
 */

import { isPlainObject } from '../is/isPlainObject.ts'
import { enumerableKeys } from '../internal/keys.ts'
import { assertNotHugeSparse, isCanonicalArrayIndex } from '../internal/sparse.ts'
import { enterDepth, exitDepth, guardDepth, RevisitBudget } from '../internal/walk.ts'
import { writeKey } from './parsePath.ts'

const MERGE_BUDGET = 500_000
const BUDGET_ERROR = `input repeats shared objects past ${String(MERGE_BUDGET)} units of work`

/** An index or `length` write that would grow an array past its end. */
function assertInRange(t: object, key: PropertyKey, value: unknown): void {
  if (!Array.isArray(t) || typeof key !== 'string') return
  const grows = key === 'length' && (Object(value) === value || Number(value) > t.length)
  if (grows || (isCanonicalArrayIndex(key) && Number(key) > t.length)) {
    throw new RangeError(`array index ${key} is past the end`)
  }
}

function assertTarget(target: unknown, name: string): asserts target is object {
  if (target === null || typeof target !== 'object') {
    throw new TypeError(`${name} target must be an object`)
  }
}

/** State of one deep walk over one source argument. */
interface WalkState {
  /** Sources on the active copy path and the object each is being copied into. */
  readonly copies: WeakMap<object, object>
  /** (source, target) pairs already walked within one source argument. */
  readonly pairs: WeakMap<object, WeakSet<object>>
  /** Shared by every source argument of one call. */
  readonly budget: RevisitBudget
}

/** Record the (source, target) pair, and say whether it was recorded already. */
function walkedBefore(state: WalkState, s: object, t: object): boolean {
  let targets = state.pairs.get(s)
  if (targets?.has(t)) return true
  if (targets === undefined) {
    targets = new WeakSet()
    state.pairs.set(s, targets)
  }
  targets.add(t)
  return false
}

/**
 * Write each key of source `s` into target `t` with `writeEntry`, one level deeper. An `existing`
 * target (one `target` already held, not a fresh copy) is walked once per source object. Charges
 * the revisit budget and grows an array target to an array source's length.
 */
function walkInto(
  t: object,
  s: object,
  state: WalkState,
  existing: boolean,
  writeEntry: (key: PropertyKey) => void
): void {
  if (existing && walkedBefore(state, s, t)) return
  const keys = enumerableKeys(s)
  state.budget.note(s, keys.length)
  enterDepth()
  try {
    if (Array.isArray(s) && Array.isArray(t)) {
      assertNotHugeSparse(s)
      if (t.length < s.length) t.length = s.length
    }
    for (const key of keys) writeEntry(key)
  } finally {
    exitDepth()
  }
}

/**
 * Copy `source` with `fill`, into an empty array or an object with the prototype of `source`.
 * While `fill` runs, `source` maps to the copy, so a cycle in `source` points back at the copy.
 */
function copyWith(state: WalkState, source: object, fill: (copy: object) => void): object {
  const copy: object = Array.isArray(source)
    ? []
    : (Object.create(Object.getPrototypeOf(source) as object | null) as object)
  state.copies.set(source, copy)
  try {
    fill(copy)
  } finally {
    state.copies.delete(source)
  }
  return copy
}

function mergeKey(t: object, s: object, key: PropertyKey, state: WalkState): void {
  const sv = (s as Record<PropertyKey, unknown>)[key]
  assertInRange(t, key, sv)
  const tv = Object.hasOwn(t, key) ? (t as Record<PropertyKey, unknown>)[key] : undefined
  if (key === 'constructor' && typeof tv === 'function' && sv !== null && typeof sv === 'object') {
    return
  }
  if (sv === undefined && key in t) return
  const svArray = Array.isArray(sv)
  if (!svArray && !isPlainObject(sv)) {
    writeKey(t, key, sv)
    return
  }
  const source = sv as object
  const same = svArray ? Array.isArray(tv) : isPlainObject(tv)
  if (same) {
    mergeInto(tv as object, source, state, true)
    return
  }
  const copy =
    state.copies.get(source) ??
    copyWith(state, source, (fresh) => mergeInto(fresh, source, state, false))
  writeKey(t, key, copy)
}

function mergeInto(t: object, s: object, state: WalkState, existing: boolean): void {
  walkInto(t, s, state, existing, (key) => mergeKey(t, s, key, state))
}

/**
 * Merge the own enumerable string and symbol keys of each source into `target`, deeply, and
 * return `target`, as lodash's `merge` does. A plain object merges into a plain object and an array
 * into an array; anything else, or a container of the other kind, is assigned in its place (a
 * plain object or array from a source is copied first, with its prototype, so `target` never
 * shares it). An `undefined` source value does not replace a key the target has. Keys are
 * assigned, so setters run; `__proto__`, `constructor` and `prototype` are defined as own data.
 * Replacing an own `constructor` function with an object is refused.
 * Each key gets its own copy of a source object it shares with another key.
 * @param target The object to change.
 * @param sources Objects to merge in, left to right; sources that are not objects are skipped.
 * @returns `target`.
 * @throws {TypeError} when `target` is not an object, or for a key of it that is read-only or
 * has only a getter.
 * @throws {RangeError} past 1000 levels of nesting, for an array index or `length` that would
 * grow an array past its end, for a huge sparse source array, or when shared objects would be
 * copied past 500000 units of work.
 * @example
 * ```ts
 * merge({ a: [{ b: 2 }], d: 1 }, { a: [{ c: 3 }] }) // { a: [{ b: 2, c: 3 }], d: 1 }
 * ```
 */
export function merge<T extends object>(target: T, ...sources: unknown[]): T {
  assertTarget(target, 'merge')
  const budget = new RevisitBudget(MERGE_BUDGET, BUDGET_ERROR)
  return guardDepth(() => {
    for (const source of sources) {
      if (source === null || typeof source !== 'object') continue
      mergeInto(target, source, { copies: new WeakMap(), pairs: new WeakMap(), budget }, true)
    }
    return target
  })
}

function descriptorAlongChain(obj: object, key: PropertyKey): PropertyDescriptor | undefined {
  for (let cur: object | null = obj; cur; cur = Object.getPrototypeOf(cur) as object | null) {
    const desc = Object.getOwnPropertyDescriptor(cur, key)
    if (desc) return desc
  }
  return undefined
}

/**
 * Whether `defaults` fills `key` of `target`: it reads `undefined`, or it is a string key only
 * `Object.prototype` has, and it is not a getter without a setter.
 */
function needsDefault(target: object, key: PropertyKey, value: unknown): boolean {
  const fill =
    value === undefined ||
    (typeof key !== 'symbol' &&
      !Object.hasOwn(target, key) &&
      value === (Object.prototype as Record<PropertyKey, unknown>)[key])
  if (!fill) return false
  if (key === '__proto__') return Object.getPrototypeOf(target) === null
  const desc = descriptorAlongChain(target, key)
  return !(desc && 'get' in desc && desc.set === undefined)
}

function writeDefault(target: object, key: PropertyKey, value: unknown): void {
  const desc = typeof key === 'symbol' ? Object.getOwnPropertyDescriptor(target, key) : undefined
  if (desc && 'value' in desc) {
    ;(target as Record<PropertyKey, unknown>)[key] = value
  } else {
    writeKey(target, key, value)
  }
}

/**
 * Fill each key of `target` that reads `undefined` with the first source that has it, and return
 * `target`, as lodash's `defaults` does. A string key only inherited from `Object.prototype`
 * (such as `toString`) also counts as missing; one inherited from a class does not. A key `target`
 * has only a getter for is left alone. Only the own enumerable string and symbol keys of each
 * source are considered.
 * Existing own symbol data properties keep their descriptors when filled.
 * @param target The object to fill.
 * @param sources Objects to read defaults from, left to right; sources that are not objects are
 * skipped.
 * @returns `target`.
 * @throws {TypeError} when `target` is not an object.
 * @throws {RangeError} for an array index past the end of an array `target`.
 * @example
 * ```ts
 * defaults({ a: 1 }, { a: 3, b: 2 }) // { a: 1, b: 2 }
 * ```
 */
export function defaults<T extends object>(target: T, ...sources: unknown[]): T {
  assertTarget(target, 'defaults')
  for (const source of sources) {
    if (source === null || typeof source !== 'object') continue
    const record = source as Record<PropertyKey, unknown>
    for (const key of enumerableKeys(record)) {
      if (!needsDefault(target, key, (target as Record<PropertyKey, unknown>)[key])) continue
      const value = record[key]
      assertInRange(target, key, value)
      writeDefault(target, key, value)
    }
  }
  return target
}

/** `value`, or a copy of it filled the way `defaultsDeep` fills, when it is a plain object or array. */
function copyOf(value: unknown, state: WalkState): unknown {
  if (!Array.isArray(value) && !isPlainObject(value)) return value
  return (
    state.copies.get(value) ?? copyWith(state, value, (copy) => fillInto(copy, value, state, false))
  )
}

function fillKey(t: object, s: object, key: PropertyKey, state: WalkState): void {
  const tv = (t as Record<PropertyKey, unknown>)[key]
  if (needsDefault(t, key, tv)) {
    const sv = (s as Record<PropertyKey, unknown>)[key]
    if (sv === undefined) return
    assertInRange(t, key, sv)
    writeDefault(t, key, copyOf(sv, state))
    return
  }
  if (!Object.hasOwn(t, key)) return
  const tvArray = Array.isArray(tv)
  if (!tvArray && !isPlainObject(tv)) return
  const sv = (s as Record<PropertyKey, unknown>)[key]
  const sameKind = tvArray ? Array.isArray(sv) : isPlainObject(sv)
  if (sameKind) fillInto(tv as object, sv as object, state, true)
}

function fillInto(t: object, s: object, state: WalkState, existing: boolean): void {
  walkInto(t, s, state, existing, (key) => fillKey(t, s, key, state))
}

/**
 * {@link defaults}, all the way down: where `target` and a source both hold a plain object (or
 * both an array) at a key, the source fills the missing keys inside it. A filled plain object or
 * array is copied, with its prototype, so `target` never shares it with a source; a cycle back to
 * a source itself points at `target`.
 * Filling `__proto__` is refused unless the target has a null prototype; `constructor` and
 * `prototype` are filled as own data, and inherited values are never descended into.
 * Only own enumerable string and symbol keys of each source are considered.
 * @param target The object to fill.
 * @param sources Objects to read defaults from, left to right; sources that are not objects are
 * skipped.
 * @returns `target`.
 * @throws {TypeError} when `target` is not an object.
 * @throws {RangeError} past 1000 levels of nesting, for an index past the end of an array, for a
 * huge sparse source array, or when shared objects would be copied past 500000 units of work.
 * @example
 * ```ts
 * defaultsDeep({ a: { b: 2 } }, { a: { b: 1, c: 3 } }) // { a: { b: 2, c: 3 } }
 * ```
 */
export function defaultsDeep<T extends object>(target: T, ...sources: unknown[]): T {
  assertTarget(target, 'defaultsDeep')
  const budget = new RevisitBudget(MERGE_BUDGET, BUDGET_ERROR)
  return guardDepth(() => {
    for (const source of sources) {
      if (source === null || typeof source !== 'object') continue
      const state: WalkState = {
        copies: new WeakMap([[source, target]]),
        pairs: new WeakMap(),
        budget
      }
      fillInto(target, source, state, true)
    }
    return target
  })
}
