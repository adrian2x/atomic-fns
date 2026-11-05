/**
 * Lodash-style partial deep matching.
 */

import { isHugeSparse, walkArray } from '../internal/arrayKeys.js'
import { enterNesting, exitNesting, guardNesting } from '../internal/nesting.js'
import { DeepEqualSession, deepEqualInSession } from '../operators/equality.js'
import { eq } from '../operators/index.js'
import { hasHook } from '../operators/multiset.js'
import { isPlainObject } from './object.js'

/** A hard stop: past the memo bound work can multiply per level, and a page must not hang. */
const MAX_MATCH_VISITS = 2 ** 25
const VISITS_ERROR = `matches exceeded ${String(MAX_MATCH_VISITS)} comparisons`

/** Keys read per extra visit, so a wide row walked again weighs what it reads. */
const KEYS_PER_VISIT = 16

const MAX_SETTLED_PAIRS = 2 ** 20

/** Records all field indexes of one call may hold; a shape element past it scans instead. */
const MAX_FIELD_INDEX_ENTRIES = 2 ** 22

/** A field that leaves this few candidates needs no help from the shape element's other fields. */
const FEW_CANDIDATES = 8

/** Keys in the longest path searched for a primitive field. */
const MAX_FIELD_PATH = 4

/** Plain objects searched per shape element, so a wide shared shape cannot multiply the paths. */
const MAX_FIELD_SEARCH = 32

/** Where `Set` and `Map` stop growing, with a native error. */
const MAX_HASHED_ENTRIES = 2 ** 24

/** Positions in {@link ArrayView.elements} that can equal a primitive. */
interface ValueIndex {
  readonly byValue: Map<unknown, number[]>
  /** Positions a lookup cannot rule out: hooks `eq` may equate, and reads that threw. */
  readonly unsure: number[]
}

/** What one call knows about an array: built once, however many depths the array is met at. */
interface ArrayView {
  /** Present elements, in order. */
  readonly elements: unknown[]
  readonly arrays: number[]
  /** Positions of non-array objects. */
  readonly records: number[]
  readonly holes: number
  readonly hugeSparse: boolean
  everything?: number[]
  primitives?: ValueIndex
  fields?: Map<string, ValueIndex>
}

/** What one walk of a shape array has taken from its target. */
interface Claims {
  /** Taken positions, in chunks that each fit in a `Set`. */
  readonly taken: (Set<number> | undefined)[]
  /** Taken positions leading each candidate list, so a run of duplicates stays linear. */
  readonly skip: Map<number[], number>
  holes: number
}

/** State of one matches call. */
interface MatchSession {
  /** Pairs on the active match path, with the depth each was entered at (cycle handling). */
  readonly pending: WeakMap<object, Map<object, number>>
  /** Remembered `(shape, value)` results. */
  readonly settled: WeakMap<object, WeakMap<object, boolean>>
  settledCount: number
  /** Settled successes still resting on a pending pair. */
  readonly tentative: [shape: object, obj: object][]
  /** Shallowest pending pair assumed true since the last final success. */
  assumedDepth: number
  /** Since the last final success, an assumed pair may have taken what a later element needed. */
  contested: boolean
  readonly views: WeakMap<unknown[], ArrayView>
  fieldIndexRoom: number
  visits: number
  /** One session for every leaf, so their work shares a budget and is not repeated. */
  leaves?: DeepEqualSession
}

function createMatchSession(): MatchSession {
  return {
    pending: new WeakMap(),
    settled: new WeakMap(),
    settledCount: 0,
    tentative: [],
    assumedDepth: Infinity,
    contested: false,
    views: new WeakMap(),
    fieldIndexRoom: MAX_FIELD_INDEX_ENTRIES,
    visits: 0
  }
}

function countVisit(session: MatchSession, keys = 0): void {
  session.visits += 1 + Math.floor(keys / KEYS_PER_VISIT)
  if (session.visits > MAX_MATCH_VISITS) throw new RangeError(VISITS_ERROR)
}

function isObjectValue(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object'
}

function isPrimitive(v: unknown): boolean {
  return v === null || (typeof v !== 'object' && typeof v !== 'function')
}

function viewOf(arr: unknown[], session: MatchSession): ArrayView {
  let view = session.views.get(arr)
  if (view === undefined) {
    const elements: unknown[] = []
    const arrays: number[] = []
    const records: number[] = []
    let holes = 0
    walkArray(arr, (ev) => {
      if (ev.kind === 'holeRun') {
        holes += ev.end - ev.start
        return
      }
      if (Array.isArray(ev.value)) arrays.push(elements.length)
      else if (isObjectValue(ev.value)) records.push(elements.length)
      elements.push(ev.value)
    })
    view = { elements, arrays, records, holes, hugeSparse: isHugeSparse(arr) }
    session.views.set(arr, view)
  }
  return view
}

function indexValues(positions: Iterable<number>, read: (position: number) => unknown): ValueIndex {
  const byValue = new Map<unknown, number[]>()
  const unsure: number[] = []
  for (const position of positions) {
    try {
      const value = read(position)
      if (hasHook(value)) {
        unsure.push(position)
      } else if (isPrimitive(value)) {
        const group = byValue.get(value)
        if (group === undefined) byValue.set(value, [position])
        else group.push(position)
      }
    } catch {
      // The walk surfaces this only if it gets here, as a scan that stops at a match would.
      unsure.push(position)
    }
  }
  return { byValue, unsure }
}

function readPath(record: unknown, path: string[]): unknown {
  let value = record
  for (const key of path) {
    if (!isObjectValue(value)) return undefined
    value = value[key]
  }
  return value
}

function fieldIndexOf(
  view: ArrayView,
  path: string[],
  session: MatchSession
): ValueIndex | undefined {
  view.fields ??= new Map()
  const pathKey = JSON.stringify(path)
  let index = view.fields.get(pathKey)
  if (index === undefined && view.records.length <= session.fieldIndexRoom) {
    session.fieldIndexRoom -= view.records.length
    const { elements } = view
    index = indexValues(view.records, (position) => readPath(elements[position], path))
    view.fields.set(pathKey, index)
  }
  return index
}

/** Candidates for primitive `value`, in target order so that claims stay greedy. */
function positionsOf(value: unknown, index: ValueIndex, session: MatchSession): number[] {
  const hits = index.byValue.get(value) ?? []
  if (index.unsure.length === 0) return hits
  countVisit(session, hits.length + index.unsure.length)
  return [...hits, ...index.unsure].sort((a, b) => a - b)
}

/**
 * The fewest candidates any primitive field of `item` leaves, shallowest first through plain
 * objects, or `undefined` when it has no such field. Records often open with a field every row
 * shares, so a field that leaves many candidates gives way to the next.
 */
function fieldCandidates(
  item: Record<string, unknown>,
  target: ArrayView,
  session: MatchSession
): number[] | undefined {
  const search: [record: Record<string, unknown>, path: string[]][] = [[item, []]]
  let fewest: number[] | undefined
  for (const [record, path] of search) {
    const keys = Object.keys(record)
    countVisit(session, keys.length)
    for (const key of keys) {
      const expected = record[key]
      const fieldPath = [...path, key]
      if (isPlainObject(expected)) {
        if (fieldPath.length < MAX_FIELD_PATH && search.length < MAX_FIELD_SEARCH) {
          search.push([expected, fieldPath])
        }
      } else if (expected !== undefined && isPrimitive(expected)) {
        const index = fieldIndexOf(target, fieldPath, session)
        if (index === undefined) return fewest
        const candidates = positionsOf(expected, index, session)
        if (fewest === undefined || candidates.length < fewest.length) fewest = candidates
        if (fewest.length <= FEW_CANDIDATES) return fewest
      }
    }
  }
  return fewest
}

/** The target positions shape element `item` can match, in target order. */
function candidatesOf(item: unknown, target: ArrayView, session: MatchSession): number[] {
  if (isPrimitive(item) && target.elements.length < MAX_HASHED_ENTRIES) {
    const { elements } = target
    target.primitives ??= indexValues(elements.keys(), (position) => elements[position])
    return positionsOf(item, target.primitives, session)
  }
  if (Array.isArray(item)) return target.arrays
  if (isPlainObject(item)) return fieldCandidates(item, target, session) ?? target.records
  target.everything ??= [...target.elements.keys()]
  return target.everything
}

/** A non-plain shape value against `obj`, charging what the comparison did to this call. */
function leafEqual(shape: object, obj: unknown, session: MatchSession): boolean {
  session.leaves ??= new DeepEqualSession()
  const room = session.leaves.visitRoom
  const equal = deepEqualInSession(shape, obj, session.leaves)
  session.visits += room - session.leaves.visitRoom
  return equal
}

function isTaken(claims: Claims, position: number): boolean {
  return claims.taken[Math.floor(position / MAX_HASHED_ENTRIES)]?.has(position) === true
}

function take(claims: Claims, position: number): void {
  const chunk = Math.floor(position / MAX_HASHED_ENTRIES)
  ;(claims.taken[chunk] ??= new Set()).add(position)
}

function claimFirst(
  item: unknown,
  positions: number[],
  target: ArrayView,
  claims: Claims,
  depth: number,
  session: MatchSession
): boolean {
  const { skip } = claims
  let start = skip.get(positions) ?? 0
  while (start < positions.length && isTaken(claims, positions[start])) start++
  if (start > 0) skip.set(positions, start)
  let contested = start > 0
  for (let i = start; i < positions.length; i++) {
    countVisit(session)
    const position = positions[i]
    if (isTaken(claims, position)) {
      contested = true
    } else if (matchDeep(item, target.elements[position], false, depth + 1, session)) {
      take(claims, position)
      return true
    }
  }
  session.contested ||= contested && session.assumedDepth !== Infinity
  return false
}

function claimHole(
  item: unknown,
  target: ArrayView,
  claims: Claims,
  depth: number,
  session: MatchSession
): boolean {
  if (claims.holes === target.holes) return false
  countVisit(session)
  if (!matchDeep(item, undefined, false, depth + 1, session)) return false
  claims.holes++
  return true
}

function matchArray(
  shape: unknown[],
  target: unknown[],
  depth: number,
  session: MatchSession
): boolean {
  const items = viewOf(shape, session)
  const elements = viewOf(target, session)
  const claims: Claims = { taken: [], skip: new Map(), holes: 0 }
  // A huge-sparse shape keeps its length for storage only: its holes ask for one `undefined`.
  const holeItems = items.hugeSparse ? Math.min(items.holes, 1) : items.holes
  const itemCount = items.elements.length + holeItems
  for (let i = 0; i < itemCount; i++) {
    // Past the present elements this reads `undefined`, which is what a hole asks for.
    const item = items.elements[i]
    const positions = candidatesOf(item, elements, session)
    if (
      !claimFirst(item, positions, elements, claims, depth, session) &&
      !claimHole(item, elements, claims, depth, session)
    ) {
      return false
    }
  }
  return true
}

function matchPlainObject(
  shape: Record<string, unknown>,
  obj: unknown,
  top: boolean,
  depth: number,
  session: MatchSession
): boolean {
  if (top ? obj == null : !isObjectValue(obj) || Array.isArray(obj)) {
    return top && Object.keys(shape).length === 0
  }
  const target = Object(obj) as Record<string, unknown>
  const shapeKeys = Object.keys(shape)
  countVisit(session, shapeKeys.length)
  for (const key of shapeKeys) {
    const expected = shape[key]
    if (expected === undefined && !Object.hasOwn(target, key)) return false
    if (!matchDeep(expected, target[key], false, depth + 1, session)) return false
  }
  return true
}

/**
 * Record a finished pair. A success is final once no pending pair above `depth` backs it; until
 * then it stays tentative, and any enclosing failure undoes it. A failure is final too: pending
 * pairs only ever answer true, so it holds without them. The one exception is a contested
 * failure, where a pair assumed true may have claimed the element a later shape element needed:
 * that is not remembered at all. A full memo keeps what it holds, and a pair that finds no room is
 * walked again.
 */
function settleMatch(
  session: MatchSession,
  shape: object,
  obj: object,
  ok: boolean,
  depth: number,
  tentativeMark: number
): void {
  const tentative = ok && session.assumedDepth < depth
  if (!ok) {
    for (const [tentativeShape, tentativeObj] of session.tentative.splice(tentativeMark)) {
      session.settled.get(tentativeShape)?.delete(tentativeObj)
      session.settledCount--
    }
    if (session.contested && session.assumedDepth <= depth) return
  } else if (!tentative) {
    session.assumedDepth = Infinity
    session.contested = false
    session.tentative.length = tentativeMark
  }
  if (session.settledCount === MAX_SETTLED_PAIRS) return
  session.settledCount++
  if (tentative) session.tentative.push([shape, obj])
  let results = session.settled.get(shape)
  if (results === undefined) {
    results = new WeakMap()
    session.settled.set(shape, results)
  }
  results.set(obj, ok)
}

// Stays one function with its shape branches: every wrapper adds a stack frame per nesting level.
function matchDeep(
  shape: unknown,
  obj: unknown,
  top: boolean,
  depth: number,
  session: MatchSession
): boolean {
  if (shape === null || typeof shape !== 'object') return eq(obj, shape)
  enterNesting()
  // The top level has its own rules, so only nested pairs share one remembered answer.
  const value = !top && isObjectValue(obj) ? obj : undefined
  const tentativeMark = session.tentative.length
  let partners: Map<object, number> | undefined
  try {
    if (value !== undefined) {
      const settled = session.settled.get(shape)?.get(value)
      if (settled !== undefined) return settled
      partners = session.pending.get(shape)
      const assumedAt = partners?.get(value)
      if (assumedAt !== undefined) {
        session.assumedDepth = Math.min(session.assumedDepth, assumedAt)
        return true
      }
      if (partners === undefined) {
        partners = new Map()
        session.pending.set(shape, partners)
      }
      partners.set(value, depth)
    }
    let ok: boolean
    if (Array.isArray(shape)) {
      ok =
        shape.length === 0
          ? top || Array.isArray(obj)
          : Array.isArray(obj) && matchArray(shape as unknown[], obj as unknown[], depth, session)
    } else if (isPlainObject(shape)) {
      ok = matchPlainObject(shape, obj, top, depth, session)
    } else {
      ok = leafEqual(shape, obj, session)
    }
    if (value !== undefined) settleMatch(session, shape, value, ok, depth, tentativeMark)
    return ok
  } finally {
    if (value !== undefined && partners?.get(value) === depth) partners.delete(value)
    exitNesting()
  }
}

/**
 * Creates a function that performs a Lodash-style partial deep comparison (`isMatch`) between a
 * given value and `shape`. A primitive shape compares with {@link eq}. A top-level empty plain
 * object or empty array matches any value; a nested empty `{}` matches any non-null non-array
 * object, and a nested empty `[]` matches any array (primitives, missing keys, and null never
 * match). A top-level plain-object shape reads its keys from the boxed value, so strings, functions
 * and arrays can match it; below the top level it needs a non-array object. Shape keys read
 * `value[key]`, so inherited and non-enumerable keys count, except that a key whose shape value is
 * `undefined` requires that own key on the target.
 * Arrays in the shape match as subsets. As in Lodash each target element serves at most one shape
 * element, claimed greedily in order, so `matches([1, 1])([1, 2])` is false; a hole reads as
 * `undefined`. Non-plain shape values (Date, RegExp, Map, Set, typed arrays, class instances)
 * compare with `deepEqual`. Nesting deeper than 1000 levels throws `RangeError`.
 * Unlike Lodash, a top-level array shape is a subset rather than compared by index, a
 * class-instance shape compares with `deepEqual` rather than key by key, a primitive shape
 * compares with {@link eq} rather than matching anything, an `undefined` shape value needs an own
 * key rather than any key, Map and Set leaves must be exact rather than subsets, and a nested `{}`
 * accepts a Date or RegExp.
 * Each array is indexed once per call, however deep it recurs. A primitive shape element is one
 * lookup. A plain-object shape element with a primitive field, up to 4 keys deep through plain
 * objects, reads that field once on every record to index them and then only walks the records it
 * selects; a record whose read throws is left for the walk, so its error surfaces only if a scan
 * would have reached it. Any other shape element scans the target, as does a primitive one against
 * an array past 2^24 elements, which costs O(shape x target) comparisons. A call remembers up to
 * 2^20 (shape, value) pairs and throws `RangeError` after 2^25 comparisons, `deepEqual`
 * leaves included, so memory and time stay bounded on any input. Untrusted shapes should be
 * size-limited.
 * @example
```js
const objects = [
  { a: 1, b: 2, c: 3 },
  { a: 4, b: 5, c: 6 }
]

filter(objects, matches({ a: 4, c: 6 }))
// [{ a: 4, b: 5, c: 6 }]

matches({ tags: ['b'] })({ tags: ['a', 'b'] })
// true

matches({ a: undefined })({})
// false
```
 * @param shape Partial shape to match against.
 * @returns Predicate that returns true when its argument matches `shape`.
 */
export function matches(shape: unknown): (obj: unknown) => boolean {
  return function (obj) {
    return guardNesting(() => matchDeep(shape, obj, true, 1, createMatchSession()))
  }
}
