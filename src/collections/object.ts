/**
 * Object utilities: merge, defaults, pick, omit, clone.
 */

import { unbox } from '../globals/brand.js'
import { isDate, isMap, isRegExp, isSet } from '../globals/index.js'
import { assertNotHugeSparse, isCanonicalArrayIndex, walkArray } from '../internal/arrayKeys.js'
import {
  assertNestingDepth,
  enterNesting,
  exitNesting,
  guardNesting,
  guardSharedRevisits,
  noteExpanded,
  walkSession,
  withHookNesting
} from '../internal/nesting.js'
import { parsePath } from '../internal/path.js'
import { truncateForError } from '../internal/truncate.js'
import { hasMethod, protocol } from '../operators/index.js'

const UNASSIGNABLE_KEYS = new Set<PropertyKey>(['__proto__', 'constructor', 'prototype'])

/** Define an own enumerable writable configurable data property. */
export function defineData(target: object, key: PropertyKey, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true
  })
}

/**
 * Write `key` by plain assignment, much faster than {@link defineData}. On an object just created
 * here that is an own data property; on a `merge` target setters run. Keys that could reach a
 * prototype are defined instead.
 */
export function assignData(target: object, key: PropertyKey, value: unknown): void {
  if (typeof key === 'string' && !UNASSIGNABLE_KEYS.has(key)) {
    ;(target as Record<string, unknown>)[key] = value
  } else {
    defineData(target, key, value)
  }
}

const OBJECT_SOURCE = Function.prototype.toString.call(Object)

/** True for `Object.prototype` of any realm. */
function isObjectPrototype(proto: object | null): boolean {
  if (proto === Object.prototype) return true
  if (proto === null || Object.getPrototypeOf(proto) !== null) return false
  const ctor: unknown = Object.getOwnPropertyDescriptor(proto, 'constructor')?.value
  return typeof ctor === 'function' && Function.prototype.toString.call(ctor) === OBJECT_SOURCE
}

/**
 * True when `x` is a plain object: its tag is `[object Object]` and its prototype is `null` or
 * `Object.prototype` of any realm. `Math`, `JSON` and `arguments` are not plain, and neither is an
 * object with its own `Symbol.toStringTag`.
 */
export function isPlainObject(x: unknown): x is Record<string, unknown> {
  if (x === null || typeof x !== 'object') return false
  if (Object.prototype.toString.call(x) !== '[object Object]') return false
  const proto = Object.getPrototypeOf(x) as object | null
  return proto === null || isObjectPrototype(proto)
}

/** True for an array whose prototype is `Array.prototype` of any realm. */
function isUnsubclassedArray(x: unknown): x is unknown[] {
  if (!Array.isArray(x)) return false
  const proto = Object.getPrototypeOf(x) as object | null
  return (
    proto === Array.prototype ||
    (Array.isArray(proto) && isObjectPrototype(Object.getPrototypeOf(proto) as object | null))
  )
}

/** True when `toJSON` is an own function or an own accessor (getter/setter). */
function hasCallableOrAccessorToJSON(x: object): boolean {
  if (!Object.hasOwn(x, 'toJSON')) return false
  const desc = Object.getOwnPropertyDescriptor(x, 'toJSON')
  if (!desc) return false
  if (desc.get !== undefined || desc.set !== undefined) return true
  return typeof desc.value === 'function'
}

/** Array with an `Array.prototype` prototype and no callable/accessor `toJSON`. */
function isPlainArray(x: unknown): x is unknown[] {
  return isUnsubclassedArray(x) && !hasCallableOrAccessorToJSON(x)
}

/**
 * Plain object or plain array with no callable/accessor `toJSON` (omit may copy without losing
 * redaction). A data property holding a non-function `toJSON` is ordinary data.
 */
function isOmitContainer(x: unknown): boolean {
  if (isPlainArray(x)) return true
  return isPlainObject(x) && !hasCallableOrAccessorToJSON(x)
}

function isSliceableView(v: unknown): v is ArrayBufferView & { slice(): unknown } {
  return ArrayBuffer.isView(v) && 'slice' in v && typeof v.slice === 'function'
}

/** Pairs (source, target) already merged within one top-level source argument. */
type MergedPairs = WeakMap<object, WeakSet<object>>

function assertArrayWriteInRange(t: object, key: PropertyKey, sv: unknown): void {
  if (!Array.isArray(t) || typeof key !== 'string') return
  // Coercing an object to a length could run its valueOf or join a huge array, so objects are out.
  const growsLength = key === 'length' && (Object(sv) === sv || Number(sv) > t.length)
  const skipsIndices = isCanonicalArrayIndex(key) && Number(key) > t.length
  if (growsLength || skipsIndices) throw new RangeError('array index beyond length')
}

function mergeKey(
  t: object,
  key: PropertyKey,
  sv: unknown,
  seen: WeakMap<object, object>,
  pairs: MergedPairs,
  depth: number
): void {
  assertArrayWriteInRange(t, key, sv)
  const tv = Object.hasOwn(t, key) ? (t as Record<PropertyKey, unknown>)[key] : undefined
  if (key === 'constructor' && typeof tv === 'function' && sv !== null && typeof sv === 'object') {
    return
  }
  if (sv === undefined && key in t) return
  if (isPlainObject(sv) || Array.isArray(sv)) {
    // Same container kind: merge into target. Differing array vs plain object: source replaces.
    const intoExisting =
      (Array.isArray(sv) && Array.isArray(tv)) || (isPlainObject(sv) && isPlainObject(tv))
    // Path-scoped cycle protection only: a hit means this source is already on the active path.
    if (!intoExisting && seen.has(sv)) {
      assignData(t, key, seen.get(sv))
      return
    }
    let base: object
    if (Array.isArray(sv)) {
      base = Array.isArray(tv) ? tv : []
    } else if (isPlainObject(tv)) {
      base = tv
    } else {
      base = {}
    }
    if (!intoExisting) {
      seen.set(sv, base)
      try {
        // Fresh copy targets are unique - skip pair tracking (nothing can hit).
        mergeInto(base, sv, seen, pairs, depth, false)
      } finally {
        // Drop after this key so a sibling key with the same shared source gets its own copy.
        seen.delete(sv)
      }
    } else {
      mergeInto(base, sv, seen, pairs, depth, true)
    }
    assignData(t, key, base)
  } else {
    assignData(t, key, sv)
  }
}

function mergeInto(
  t: object,
  s: object,
  seen: WeakMap<object, object>,
  pairs: MergedPairs,
  depth: number,
  trackPairs: boolean
): void {
  enterNesting()
  try {
    if (trackPairs) {
      // Skip when this source was already merged into this pre-existing target.
      let targets = pairs.get(s)
      if (targets?.has(t)) return
      if (targets === undefined) {
        targets = new WeakSet<object>()
        pairs.set(s, targets)
      }
      targets.add(t)
    }

    const keys = Object.keys(s)
    noteExpanded(s, keys.length)
    assertNestingDepth(depth)
    if (t === Object.prototype) return
    if (Array.isArray(s) && Array.isArray(t)) {
      // Refuse huge sparse sources before extending the target (caller's array would hang on map/forEach).
      assertNotHugeSparse(s)
      // Extend first so source indices never trip the beyond-length rule; holes stay holes.
      if (t.length < s.length) t.length = s.length
    }
    const rec = s as Record<string, unknown>
    for (const key of keys) {
      mergeKey(t, key, rec[key], seen, pairs, depth + 1)
    }
    for (const sym of Object.getOwnPropertySymbols(s)) {
      const desc = Object.getOwnPropertyDescriptor(s, sym)
      if (!desc?.enumerable) continue
      mergeKey(t, sym, (s as Record<symbol, unknown>)[sym], seen, pairs, depth + 1)
    }
  } finally {
    exitNesting()
  }
}

/**
 * Recursively merge own enumerable string and symbol keys of `sources` into `target`.
 * Writes by assignment, so target setters run as in `_.merge`; `__proto__`, `constructor`,
 * `prototype` and symbol keys are defined as own data properties instead. An own function
 * `constructor` is never replaced by an object. Skips undefined source values when the key is in
 * the target, own or inherited. `target` must be a non-function object, else
 * `TypeError('merge target must be an object')`; nullish and scalar sources are skipped.
 * Recurses when both sides are plain objects or both are arrays; when array and plain object
 * kinds differ, the source value replaces the target. Other values are assigned by reference.
 * Array sources extend the target array to at least the source length (holes preserved) before
 * merging indices, so holey arrays copy cleanly. A huge sparse source array
 * (`length > 2^24` and `length > 2 * filled + 1024`) throws
 * `RangeError('sparse array too large')` before any extension, leaving the target unchanged for
 * that key. Non-array sources that write a canonical array-index key beyond the target array's
 * length throw `RangeError('array index beyond length')` (same rule as `set` / `defaults`). A
 * source `length` key on an array target may keep or shrink the array; one that would grow it, or
 * any object value, throws the same error.
 * Nesting deeper than 1000 levels throws `RangeError`. Each key gets its own fresh copy of a
 * shared source (the seen map is path-scoped for cycle protection only). Within one top-level
 * source argument, (source, target) pairs already merged are skipped (merging the same source
 * into the same target again changes nothing); each later source argument gets a fresh pair
 * cache so a source re-applied later is merged again. Expanding a source again costs one work unit
 * per 16 keys, plus one once repeats outnumber the input's keys, on a cycle as on a shared row; past
 * 500000 units it throws `RangeError('input repeats shared objects beyond 500000 copied nodes')`.
 * On either throw, `target` may already hold a partial merge of earlier keys at shallower levels.
 * @param target Destination object (mutated).
 * @param sources Source objects applied left to right.
 * @returns `target`
 */
export function merge<T extends object>(target: T, ...sources: (object | null | undefined)[]): T {
  return guardSharedRevisits(() =>
    guardNesting(() => {
      const dest: unknown = target
      if (dest === null || typeof dest !== 'object') {
        throw new TypeError('merge target must be an object')
      }
      const seen = new WeakMap<object, object>()
      for (const s of sources) {
        if (Object(s) === s) {
          // Fresh pair cache per top-level source so a later re-applied source is not skipped.
          const pairs: MergedPairs = new WeakMap()
          mergeInto(target, s as object, seen, pairs, 1, true)
        }
      }
      return target
    })
  )
}

function propertyDescriptorAlongChain(object: object, key: string): PropertyDescriptor | undefined {
  let cur: object | null = object
  while (cur) {
    const desc = Object.getOwnPropertyDescriptor(cur, key)
    if (desc) return desc
    cur = Object.getPrototypeOf(cur) as object | null
  }
  return undefined
}

/**
 * Assigns own enumerable string keyed properties of source objects onto the destination for keys
 * whose own value is `undefined`, or that are missing as own properties and whose current value
 * is exactly `Object.prototype[key]` (fills names like `toString` that are only inherited from
 * Object.prototype). Inherited getters and methods from a class prototype are never overridden.
 * `__proto__` is never filled on an ordinary target (its value is the prototype, not
 * `Object.prototype.__proto__`). Writes use plain assignment so inherited setters run, except
 * `__proto__` which is defined as an own data property (reachable only on null-prototype targets).
 * Source objects are applied from left to right, and nullish ones are skipped. Once a property is
 * set, additional values of the same property are ignored. A nullish or scalar `object` throws
 * `TypeError('defaults target must be an object')`.
 * When `object` is an array, a canonical array-index key from a non-array source beyond
 * `object.length` throws `RangeError('array index beyond length')` (e.g.
 * `defaults([], { 0: 1, 2: 3 })`). Unlike `merge`, `defaults` does not extend array length from
 * a holey array source.
 * **Note:** This method mutates `object`.

 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @returns Returns `object`.
 * @example
```js
defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 })
// { 'a': 1, 'b': 2 }
```
 */
export function defaults<T extends object>(
  object: T,
  ...sources: (object | null | undefined)[]
): T {
  if (Object(object) !== object) throw new TypeError('defaults target must be an object')
  const target = object as Record<string, unknown>
  for (const source of sources) {
    if (source == null) continue
    for (const key of Object.keys(source)) {
      if (Array.isArray(object) && isCanonicalArrayIndex(key)) {
        const idx = Number(key)
        if (idx > object.length) throw new RangeError('array index beyond length')
      }
      const value = target[key]
      const fill =
        value === undefined ||
        (!Object.hasOwn(object, key) &&
          value === (Object.prototype as Record<string, unknown>)[key])
      if (!fill) continue
      const desc = propertyDescriptorAlongChain(object, key)
      if (desc && 'get' in desc && desc.set === undefined) continue
      const srcVal = (source as Record<string, unknown>)[key]
      if (key === '__proto__') {
        defineData(target, key, srcVal)
      } else {
        target[key] = srcVal
      }
    }
  }
  return object
}

const MISSING = Symbol('MISSING')

/** A dotted string path, one number or symbol key, or an array of literal key segments. */
export type PropertyPath = PropertyKey | readonly PropertyKey[]

/** One path, or a list or Set of them, as segment arrays. */
function toPathList(paths: unknown): PropertyKey[][] {
  if (Array.isArray(paths) || paths instanceof Set) {
    return Array.from(paths as Iterable<unknown>, (path) => parsePath(path))
  }
  return [parsePath(paths)]
}

function getAtPath(obj: unknown, parts: PropertyKey[]): unknown {
  let cur: unknown = obj
  for (const p of parts) {
    if (cur === null || (typeof cur !== 'object' && typeof cur !== 'function')) return MISSING
    if (!Object.hasOwn(cur, p)) return MISSING
    cur = (cur as Record<PropertyKey, unknown>)[p]
  }
  return cur
}

/** Own enumerable string keys copied into a fresh plain object. */
function copyOwnEnumerable(src: object): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(src)) {
    assignData(out, key, (src as Record<string, unknown>)[key])
  }
  return out
}

/**
 * Copy one own enumerable string-keyed property. Accessors are re-defined; data values are read
 * with a normal `[[Get]]` so Proxy get traps that mask values still apply.
 */
function copyKeptProperty(src: object, dest: object, key: string): void {
  const desc = Object.getOwnPropertyDescriptor(src, key)
  if (!desc) return
  if (desc.get !== undefined || desc.set !== undefined) {
    Object.defineProperty(dest, key, desc)
  } else {
    assignData(dest, key, (src as Record<string, unknown>)[key])
  }
}

/**
 * Assign a picked leaf onto `root`, mirroring the source container kind (array vs plain object)
 * at each intermediate step. Containers already created for this pick are reused (copied once).
 */
function setPickedPath(
  root: object,
  parts: PropertyKey[],
  value: unknown,
  source: object,
  created: WeakSet<object>
): void {
  let cur: object = root
  let srcCur: unknown = source
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    const existing = Object.hasOwn(cur, p) ? (cur as Record<PropertyKey, unknown>)[p] : undefined
    const srcNext =
      srcCur !== null &&
      (typeof srcCur === 'object' || typeof srcCur === 'function') &&
      Object.hasOwn(srcCur, p)
        ? (srcCur as Record<PropertyKey, unknown>)[p]
        : undefined
    if (created.has(existing as object)) {
      cur = existing as object
    } else {
      const segment = parts[i + 1]
      const indexed = typeof segment === 'string' && isCanonicalArrayIndex(segment)
      const next = Array.isArray(srcNext) && indexed ? [] : {}
      assignData(cur, p, next)
      created.add(next)
      cur = next
    }
    srcCur = srcNext
  }
  let leaf = value
  if (Array.isArray(value)) {
    assertNotHugeSparse(value)
    leaf = value.slice()
    created.add(leaf as object)
  } else if (isPlainObject(value)) {
    leaf = copyOwnEnumerable(value)
    created.add(leaf as object)
  }
  assignData(cur, parts[parts.length - 1], leaf)
}

/** Trie of omit paths: O(keys + total path length) walks. */
interface OmitTrie {
  drop?: boolean
  kids?: Map<PropertyKey, OmitTrie>
}

function buildOmitTrie(paths: PropertyKey[][]): OmitTrie {
  const root: OmitTrie = {}
  for (const parts of paths) {
    let node = root
    for (const p of parts) {
      node.kids ??= new Map()
      let next = node.kids.get(p)
      if (!next) {
        next = {}
        node.kids.set(p, next)
      }
      node = next
    }
    node.drop = true
  }
  return root
}

function omitWithTrie(value: unknown, trie: OmitTrie, pathPrefix: string[]): unknown {
  if (value === null || typeof value !== 'object') return value
  enterNesting()
  try {
    if (isPlainArray(value)) {
      const list = value
      const out: unknown[] = new Array(list.length)
      const visit = (i: number): void => {
        const child = trie.kids?.get(String(i))
        if (child?.drop) return
        if (!child?.kids) {
          out[i] = list[i]
        } else {
          out[i] = omitWithTrie(list[i], child, pathPrefix.concat(String(i)))
        }
      }
      walkArray(list, (ev) => {
        if (ev.kind === 'value') visit(ev.index)
      })
      return out
    }
    if (isPlainObject(value) && !hasCallableOrAccessorToJSON(value)) {
      return omitFromObject(value, trie, pathPrefix)
    }
    throw new TypeError(
      `omit cannot descend into a non-plain object at ${truncateForError(pathPrefix.join('.'))}`
    )
  } finally {
    exitNesting()
  }
}

function omitFromObject(
  src: object,
  trie: OmitTrie,
  pathPrefix: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(src)) {
    const child = trie.kids?.get(key)
    if (child?.drop) continue
    if (!child?.kids) {
      copyKeptProperty(src, result, key)
    } else {
      assignData(
        result,
        key,
        omitWithTrie((src as Record<string, unknown>)[key], child, pathPrefix.concat(key))
      )
    }
  }
  return result
}

/**
 * Create an object with only the selected paths or predicate matches from `obj`.
 * `paths` is one path, a list or `Set` of paths, or a `(value, key)` predicate. A string path splits
 * on `.` and on numeric brackets (`a[0].b`); a number or symbol is one key; an array of segments
 * addresses literal keys (including dots). Anything else throws
 * `TypeError('path segments must be strings, numbers or symbols')`.
 * Paths read own properties only, so an inherited getter is not picked. Intermediate containers
 * mirror the source (array stays array) when the next segment is an index. Never mutates `obj` or
 * any object reachable from it. A path that copies a huge sparse array
 * (`length > 2^24` and `length > 2 * filled + 1024`) throws `RangeError('sparse array too large')`.
 * @param obj Source object.
 * @param paths Property paths or a `(value, key)` predicate.
 */
export function pick<T extends object>(
  obj: T | null | undefined,
  paths:
    | PropertyPath
    | readonly PropertyPath[]
    | ReadonlySet<PropertyPath>
    | ((v: unknown, k: string) => boolean)
): Partial<T> {
  const result: object = {}
  if (obj == null) return result
  if (typeof paths === 'function') {
    for (const key of Object.keys(obj)) {
      const v = (obj as Record<string, unknown>)[key]
      if (paths(v, key)) assignData(result, key, v)
    }
    return result
  }
  const created = new WeakSet<object>([result])
  const picked: PickPathTrie = {}
  for (const parts of toPathList(paths)) {
    if (parts.length === 0 || hasPickedAncestor(parts, picked)) continue
    const value = getAtPath(obj, parts)
    if (value === MISSING) continue
    const node = pickPathNode(parts, picked)
    if (node.picked) continue
    node.picked = true
    node.ancestor = Object(value) === value
    setPickedPath(result, parts, value, obj, created)
  }
  return result
}

/** Nested map of picked paths; ancestor checks walk segment by segment. */
interface PickPathTrie {
  kids?: Map<PropertyKey, PickPathTrie>
  picked?: boolean
  /** A picked object or function, which already holds everything below it. */
  ancestor?: boolean
}

function hasPickedAncestor(parts: PropertyKey[], root: PickPathTrie): boolean {
  let node = root
  for (let i = 0; i < parts.length - 1; i++) {
    const next = node.kids?.get(parts[i])
    if (!next) return false
    if (next.ancestor) return true
    node = next
  }
  return false
}

function pickPathNode(parts: PropertyKey[], root: PickPathTrie): PickPathTrie {
  let node = root
  for (const part of parts) {
    node.kids ??= new Map()
    let next = node.kids.get(part)
    if (!next) {
      next = {}
      node.kids.set(part, next)
    }
    node = next
  }
  return node
}

/**
 * Create a copy of `obj` with the given paths omitted, or keep values where the predicate is falsy.
 * Containers on a path are copied; values not on any path are kept by reference.
 * Never mutates `obj`. Builds a path trie once so cost is O(keys + total path length). With paths,
 * never invokes getters of omitted object keys, and kept accessors are re-defined; a predicate
 * reads every value, so its kept accessors become data. Kept own enumerable string-keyed data
 * values are copied with a normal `[[Get]]` read (Proxy get traps that mask values still apply).
 * Symbol-keyed properties (e.g. `util.inspect.custom`) are not copied. `paths` takes the same forms
 * as {@link pick}. An omit path that ends at an array index leaves a
 * hole (`delete` semantics) on the copy. Top-level input and every descended container must be a
 * plain object (`Object.prototype` or `null` prototype) or a plain array (`Array.prototype`)
 * without a callable or accessor own `toJSON`. A function or accessor `toJSON`, Array subclass,
 * class instance, Map, Date, collection, or function throws
 * `TypeError('omit requires a plain object or array')` at the top level, or `TypeError` naming
 * the path when nested, before any output. A data property holding a non-function `toJSON` is
 * ordinary data. Primitives / null / undefined along a path are a no-op. A path descending past
 * 1000 levels of nesting throws `RangeError`.
 * @param obj Source object.
 * @param paths Property paths or a `(value, key)` predicate.
 */
export function omit<T extends object>(
  obj: T | null | undefined,
  paths:
    | PropertyPath
    | readonly PropertyPath[]
    | ReadonlySet<PropertyPath>
    | ((v: unknown, k: string) => boolean)
): Partial<T> {
  return guardNesting((): Partial<T> => {
    if (obj == null) return {}
    if (!isOmitContainer(obj)) {
      throw new TypeError('omit requires a plain object or array')
    }
    if (typeof paths === 'function') {
      return pick(obj, (v, k) => !paths(v, k))
    }
    const trie = buildOmitTrie(toPathList(paths))
    return omitWithTrie(obj, trie, []) as Partial<T>
  })
}

/**
 * Clone `value`. When `deep` is true, recurse into plain objects, arrays, Map and Set entries.
 * Own enumerable symbol keys are copied. Node `Buffer` is copied (not a shared view). `DataView`
 * keeps `byteOffset` / `byteLength` over a copy of the whole backing buffer. Deep `Map` clone
 * keeps key identity and deep-clones values. RegExp match arrays keep `index` / `input` /
 * `groups`. A Date keeps its own enumerable keys. Class instances stay by reference, subclasses of
 * Map, Set, Date, RegExp, Array and the other builtins included, as does any object whose
 * `Symbol.toStringTag` claims a builtin it is not. Symbol `protocol.clone` is honored and
 * receives the `deep` flag; a string-named `clone` method is ignored. Collection classes
 * deep-clone their values when `deep` is true (map-like keys stay by reference). Within one
 * top-level deep clone, an object reached twice is copied once and stays shared in the result,
 * also through `protocol.clone` hooks, so a collection class in a cycle keeps the cycle. A custom
 * hook that clones its way around a cycle hits the cap.
 * Deep nesting deeper than 1000 levels throws `RangeError`. A shallow clone of a huge sparse array
 * (`length > 2^24` and `length > 2 * filled + 1024`) throws
 * `RangeError('sparse array too large')`; a deep clone walks own elements only and returns.
 * @param value Value to clone.
 * @param deep Deep clone when true.
 */
export function clone<T>(value: T, deep = false): T {
  return guardNesting(
    () => cloneInner(value, deep, deep ? walkSession(createCloneMemo) : new WeakMap()) as T
  )
}

function createCloneMemo(): WeakMap<object, unknown> {
  return new WeakMap()
}

/**
 * Record `copy` as the deep clone of `source` for the running walk. A `protocol.clone` hook calls
 * this before it clones the contents, so a cycle back to `source` lands on `copy`.
 */
export function rememberDeepClone(source: object, copy: object): void {
  walkSession(createCloneMemo).set(source, copy)
}

function copyEnumerableSymbols(
  src: object,
  dest: object,
  deep: boolean,
  map: WeakMap<object, unknown>
): void {
  for (const sym of Object.getOwnPropertySymbols(src)) {
    const desc = Object.getOwnPropertyDescriptor(src, sym)
    if (!desc?.enumerable) continue
    defineData(
      dest,
      sym,
      deep
        ? cloneInner((src as Record<symbol, unknown>)[sym], true, map)
        : (src as Record<symbol, unknown>)[sym]
    )
  }
}

function copyOwnKeys(
  src: object,
  dest: object,
  deep: boolean,
  map: WeakMap<object, unknown>
): void {
  const rec = src as Record<string, unknown>
  for (const key of Object.keys(rec)) {
    assignData(dest, key, deep ? cloneInner(rec[key], true, map) : rec[key])
  }
  copyEnumerableSymbols(src, dest, deep, map)
}

function isNodeBuffer(v: unknown): v is Uint8Array {
  return (
    typeof Buffer !== 'undefined' &&
    typeof (Buffer as { isBuffer?: (x: unknown) => boolean }).isBuffer === 'function' &&
    (Buffer as { isBuffer: (x: unknown) => boolean }).isBuffer(v)
  )
}

function isArrayBuffer(v: object): v is ArrayBuffer {
  if (Object.prototype.toString.call(v) !== '[object ArrayBuffer]') return false
  try {
    Reflect.get(ArrayBuffer.prototype, 'byteLength', v)
    return true
  } catch {
    return false
  }
}

/** False for a subclass instance: `Sub.prototype` sits between `v` and its builtin prototype. */
function isDirectInstance(v: object): boolean {
  const proto = Object.getPrototypeOf(v) as object | null
  return proto !== null && isObjectPrototype(Object.getPrototypeOf(proto) as object | null)
}

function cloneInner(v: unknown, deep: boolean, map: WeakMap<object, unknown>): unknown {
  if (v === null || typeof v !== 'object') return v
  if (map.has(v)) return map.get(v)
  if (!deep) {
    if (hasMethod(v, protocol.clone)) return v[protocol.clone](false)
    return cloneObject(v, false, map)
  }
  if (hasMethod(v, protocol.clone)) {
    // Half of HOOK_NESTING_COST at dispatch; collection clone hooks charge the other half.
    const copy = withHookNesting(() => v[protocol.clone](true))
    map.set(v, copy)
    return copy
  }
  enterNesting()
  try {
    return cloneObject(v, true, map)
  } finally {
    exitNesting()
  }
}

function cloneObject(v: object, deep: boolean, map: WeakMap<object, unknown>): unknown {
  if (Array.isArray(v)) return isUnsubclassedArray(v) ? cloneArray(v, deep, map) : v
  if (isPlainObject(v)) {
    const out = Object.create(Object.getPrototypeOf(v) as object | null) as object
    map.set(v, out)
    copyOwnKeys(v, out, deep, map)
    return out
  }
  const copy = cloneBuiltin(v, deep, map)
  map.set(v, copy)
  return copy
}

function cloneArray(v: unknown[], deep: boolean, map: WeakMap<object, unknown>): unknown[] {
  type MatchArray = unknown[] & { index?: number; input?: string; groups?: unknown }
  if (!deep) assertNotHugeSparse(v)
  const out: MatchArray = deep ? new Array(v.length) : v.slice()
  map.set(v, out)
  if (deep && v.length > 1024) {
    walkArray(v, (ev) => {
      if (ev.kind === 'value') out[ev.index] = cloneInner(ev.value, true, map)
    })
  } else if (deep) {
    for (let i = 0; i < v.length; i++) {
      if (i in v) out[i] = cloneInner(v[i], true, map)
    }
  }
  const match = v as MatchArray
  if ('index' in match) out.index = match.index
  if ('input' in match) out.input = match.input
  if ('groups' in match) out.groups = deep ? cloneInner(match.groups, true, map) : match.groups
  copyEnumerableSymbols(v, out, deep, map)
  return out
}

/** A copy of a builtin, or `v` itself when it is anything else. */
function cloneBuiltin(v: object, deep: boolean, map: WeakMap<object, unknown>): unknown {
  if (isNodeBuffer(v)) return Buffer.from(v)
  if (isSliceableView(v)) return v.slice()
  if (!isDirectInstance(v)) return v
  if (isDate(v)) {
    const out = new Date(v.getTime())
    map.set(v, out)
    copyOwnKeys(v, out, deep, map)
    return out
  }
  if (isRegExp(v)) {
    const out = new RegExp(v.source, v.flags)
    out.lastIndex = v.lastIndex
    return out
  }
  if (isMap<unknown, unknown>(v)) {
    const out = new Map<unknown, unknown>()
    map.set(v, out)
    // Deep clone keeps Map key identity (Lodash); values are deep-cloned.
    for (const [key, x] of v) out.set(key, deep ? cloneInner(x, true, map) : x)
    return out
  }
  if (isSet(v)) {
    const out = new Set<unknown>()
    map.set(v, out)
    for (const x of v) out.add(deep ? cloneInner(x, true, map) : x)
    return out
  }
  if (isArrayBuffer(v)) return v.slice(0)
  if (ArrayBuffer.isView(v)) return new DataView(v.buffer.slice(0), v.byteOffset, v.byteLength)
  const primitive = unbox(v)
  return primitive === v ? v : Object(primitive)
}
