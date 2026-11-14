/**
 * Partial deep matching: `isMatch`, `matches`.
 */

import { isPlainObject } from '../is/isPlainObject.ts'
import { enumerableKeys } from '../internal/keys.ts'
import { walkArray } from '../internal/sparse.ts'
import { enterDepth, exitDepth, guardDepth } from '../internal/walk.ts'
import { isEqual } from './isEqual.ts'

/** Steps one call may take before it throws, so no input can keep it running for long. */
const MAX_MATCH_STEPS = 2 ** 25

/** Message of the `RangeError` a call throws past {@link MAX_MATCH_STEPS}. */
const STEPS_ERROR = `matching took more than ${String(MAX_MATCH_STEPS)} steps`

/** Answers one call remembers; past this it stops remembering, so only time grows, not memory. */
const MAX_REMEMBERED_PAIRS = 2 ** 20

/** A pair found to match while it rested on an open pair, which may still turn out not to. */
interface Tentative {
  readonly shape: object
  readonly target: object
  /** Depth of the shallowest open pair the answer rests on. */
  low: number
}

/**
 * The state of one `isMatch` call. Matching is monotone (a pair taken to match never makes another
 * pair fail), so a pair met again while it is open is assumed to match, and a pair that fails under
 * such assumptions fails for good. A pair that matches is final once no pair above it was assumed;
 * until then it is {@link Tentative}, reused while the pairs it rests on stay open, and kept or
 * dropped with the shallowest of them. Every pair is thus answered once, however shared or cyclic.
 */
interface Pending {
  /** Pairs on the current path, by source shape and then target, with the depth each opened at. */
  readonly open: Map<object, Map<object, number>>
  /** Final answers, and tentative ones, by source shape and then target. */
  readonly answers: WeakMap<object, WeakMap<object, boolean | Tentative>>
  /** Tentative answers, in the order they were found. */
  readonly tentative: Tentative[]
  /** How many answers {@link answers} holds. */
  remembered: number
  /** Depth of the innermost open pair. */
  depth: number
  /** Depth of the shallowest open pair the innermost open pair's answer rests on so far. */
  low: number
  steps: number
}

function step(pending: Pending, count = 1): void {
  pending.steps += count
  if (pending.steps > MAX_MATCH_STEPS) throw new RangeError(STEPS_ERROR)
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

function remember(
  pending: Pending,
  shape: object,
  target: object,
  answer: boolean | Tentative
): boolean {
  if (pending.remembered >= MAX_REMEMBERED_PAIRS) return false
  let answers = pending.answers.get(shape)
  if (answers === undefined) pending.answers.set(shape, (answers = new WeakMap()))
  answers.set(target, answer)
  pending.remembered++
  return true
}

/** Settle the answer of a pair that opened at `depth` when the tentative list was `mark` long. */
function settle(
  pending: Pending,
  shape: object,
  target: object,
  ok: boolean,
  depth: number,
  mark: number,
  low: number
): void {
  const { tentative } = pending
  if (!ok || low >= depth) {
    for (let i = mark; i < tentative.length; i++) {
      const entry = tentative[i]
      const answers = pending.answers.get(entry.shape)
      if (ok) {
        answers?.set(entry.target, true)
      } else {
        answers?.delete(entry.target)
        pending.remembered--
      }
    }
    tentative.length = mark
    remember(pending, shape, target, ok)
    return
  }
  step(pending, tentative.length - mark)
  for (let i = mark; i < tentative.length; i++) tentative[i].low = low
  pending.low = Math.min(pending.low, low)
  const entry: Tentative = { shape, target, low }
  if (remember(pending, shape, target, entry)) pending.tentative.push(entry)
}

/** Match a plain-object or array `shape` against an object `target` below the top. */
function matchPair(target: object, shape: object, pending: Pending): boolean {
  const known = pending.answers.get(shape)?.get(target)
  if (known !== undefined) {
    if (typeof known === 'boolean') return known
    pending.low = Math.min(pending.low, known.low)
    return true
  }
  let partners = pending.open.get(shape)
  const openAt = partners?.get(target)
  if (openAt !== undefined) {
    pending.low = Math.min(pending.low, openAt)
    return true
  }
  if (partners === undefined) pending.open.set(shape, (partners = new Map()))
  const depth = ++pending.depth
  const outerLow = pending.low
  const mark = pending.tentative.length
  partners.set(target, depth)
  pending.low = Number.POSITIVE_INFINITY
  enterDepth()
  let ok: boolean
  try {
    ok = Array.isArray(shape)
      ? matchArray(target as unknown[], shape, pending)
      : matchObject(target, shape as Record<PropertyKey, unknown>, pending, false)
  } finally {
    exitDepth()
    partners.delete(target)
    pending.depth--
  }
  const low = pending.low
  pending.low = outerLow
  settle(pending, shape, target, ok, depth, mark, low)
  return ok
}

/**
 * Whether each shape in `wanted` can have a candidate of its own, by augmenting paths (Kuhn's
 * algorithm), so the answer does not depend on the order of either array.
 */
function assign(candidates: object[], wanted: object[], pending: Pending): boolean {
  const owner: number[] = new Array<number>(candidates.length).fill(-1)
  const seenBy: number[] = new Array<number>(candidates.length).fill(-1)
  const fits = (shape: number, candidate: number): boolean =>
    matchValue(candidates[candidate], wanted[shape], pending, false)
  const unplaced: number[] = []
  // First fit, where every candidate before `firstFree` is taken; augmenting paths repair the rest.
  let firstFree = 0
  for (let shape = 0; shape < wanted.length; shape++) {
    let placed = false
    for (let candidate = firstFree; candidate < candidates.length && !placed; candidate++) {
      if (owner[candidate] >= 0) step(pending)
      else if (fits(shape, candidate)) {
        owner[candidate] = shape
        placed = true
      }
    }
    while (firstFree < candidates.length && owner[firstFree] >= 0) firstFree++
    if (!placed) unplaced.push(shape)
  }
  for (const root of unplaced) {
    const path: { shape: number; next: number }[] = [{ shape: root, next: 0 }]
    const taken: number[] = []
    let placed = false
    while (path.length > 0 && !placed) {
      const frame = path[path.length - 1]
      if (frame.next === candidates.length) {
        path.pop()
        taken.pop()
        continue
      }
      const candidate = frame.next++
      if (seenBy[candidate] === root) {
        step(pending)
        continue
      }
      if (!fits(frame.shape, candidate)) continue
      seenBy[candidate] = root
      taken.push(candidate)
      if (owner[candidate] < 0) {
        for (let i = 0; i < path.length; i++) owner[taken[i]] = path[i].shape
        placed = true
      } else {
        path.push({ shape: owner[candidate], next: 0 })
      }
    }
    if (!placed) return false
  }
  return true
}

function matchArray(target: unknown[], source: unknown[], pending: Pending): boolean {
  const wantedValues = new Map<unknown, number>()
  const wantedShapes: object[] = []
  let unmet = 0
  walkArray(source, (event) => {
    if (event.kind !== 'value') return
    step(pending)
    if (isObject(event.value)) {
      wantedShapes.push(event.value)
    } else {
      wantedValues.set(event.value, (wantedValues.get(event.value) ?? 0) + 1)
      unmet++
    }
  })
  const candidates: object[] = []
  walkArray(target, (event) => {
    if (event.kind !== 'value') return
    step(pending)
    if (isObject(event.value)) {
      if (wantedShapes.length > 0) candidates.push(event.value)
      return
    }
    const count = wantedValues.get(event.value)
    if (count !== undefined && count > 0) {
      wantedValues.set(event.value, count - 1)
      unmet--
    }
  })
  if (unmet > 0 || wantedShapes.length > candidates.length) return false
  return assign(candidates, wantedShapes, pending)
}

function matchObject(
  target: unknown,
  source: Record<PropertyKey, unknown>,
  pending: Pending,
  top: boolean
): boolean {
  const keys = enumerableKeys(source)
  if (target === null || target === undefined) return keys.length === 0
  if (!top && Array.isArray(target)) return false
  const base = Object(target) as Record<PropertyKey, unknown>
  for (const key of keys) {
    const wanted = source[key]
    if (wanted === undefined) {
      if (!(key in base) || base[key] !== undefined) return false
    } else if (!matchValue(base[key], wanted, pending, false)) {
      return false
    }
  }
  return true
}

function matchValue(target: unknown, source: unknown, pending: Pending, top: boolean): boolean {
  step(pending)
  const isArray = Array.isArray(source)
  if (!isArray && !isPlainObject(source)) return isEqual(target, source)
  if (isArray && !Array.isArray(target)) return false
  if (top) {
    enterDepth()
    try {
      return isArray
        ? matchArray(target as unknown[], source, pending)
        : matchObject(target, source as Record<PropertyKey, unknown>, pending, true)
    } finally {
      exitDepth()
    }
  }
  if (!isObject(target)) return false
  return matchPair(target, source as object, pending)
}

/**
 * True when `obj` has every key of `source`, deeply, with an {@link isEqual} value, as lodash's
 * `isMatch` checks. A plain object in `source` matches an object with at least its own enumerable
 * keys, symbols included, and a key whose source value is `undefined` must be present with the
 * value `undefined`. An array in `source` matches an array that holds a match for each of its
 * elements, each element of `obj` serving one, so arrays match as subsets in any order. A hole is
 * not an element: it wants nothing in `source` and offers nothing in `obj`, as an absent key does.
 * Anything else in `source`, a `Date` or `Map` included, must be {@link isEqual} to the value found.
 * At the top, `obj` may be any value: a primitive is read as its boxed form, and `null` or
 * `undefined` matches only a `source` with no keys.
 *
 * Cycles are assumed to match, and each pair of objects is answered once.
 * @param obj The value to test.
 * @param source The partial shape to look for.
 * @returns Whether `obj` matches.
 * @throws {RangeError} past 1000 levels of nesting, or past 33554432 steps of work.
 * @example
 * ```ts
 * isMatch({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 2 } }) // true
 * isMatch({ tags: ['a', 'b', 'c'] }, { tags: ['c', 'a'] }) // true
 * isMatch({ a: 1 }, { a: undefined }) // false
 * isMatch({}, { a: {} }) // false
 * ```
 */
export function isMatch(obj: unknown, source: unknown): boolean {
  return guardDepth(() =>
    matchValue(
      obj,
      source,
      {
        open: new Map(),
        answers: new WeakMap(),
        tentative: [],
        remembered: 0,
        depth: 0,
        low: Number.POSITIVE_INFINITY,
        steps: 0
      },
      true
    )
  )
}

/**
 * A predicate that tells whether a value matches `source`, by the rules of {@link isMatch}; it is
 * lodash's `matches` shorthand as a function to pass to `filter`, `find` and the like.
 * @param source The partial shape to look for.
 * @returns `(obj) => isMatch(obj, source)`.
 * @example
 * ```ts
 * const users = [{ name: 'a', active: true }, { name: 'b', active: false }]
 * users.filter(matches({ active: true })) // [{ name: 'a', active: true }]
 * ```
 */
export function matches(source: unknown): (obj: unknown) => boolean {
  return (obj) => isMatch(obj, source)
}
