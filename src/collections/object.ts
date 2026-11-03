/**
 * Object utilities: merge, pick, omit, clone.
 */

import { walkArray } from '../internal/arrayKeys.js'
import {
  assertNestingDepth,
  enterNesting,
  exitNesting,
  guardNesting,
  guardSharedRevisits,
  noteExpanded,
  withHookNesting
} from '../internal/nesting.js'
import { truncateForError } from '../internal/truncate.js'
import { hasMethod, protocol } from '../operators/index.js'

const DEFINE_DATA_DANGEROUS = new Set<PropertyKey>(['__proto__', 'constructor', 'prototype'])

/** Define an own enumerable writable configurable data property. */
export function defineData(target: object, key: PropertyKey, value: unknown): void {
  // Safe string keys: assignment is an own data property and much faster than defineProperty.
  if (typeof key === 'string' && !DEFINE_DATA_DANGEROUS.has(key)) {
    ;(target as Record<string, unknown>)[key] = value
    return
  }
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true
  })
}

/** True when `x` is a plain object (`Object.prototype` or `null` prototype). */
export function isPlainObject(x: unknown): x is Record<string, unknown> {
  if (x === null || typeof x !== 'object') return false
  const proto: unknown = Object.getPrototypeOf(x)
  return proto === Object.prototype || proto === null
}

/** True when `toJSON` is an own function or an own accessor (getter/setter). */
function hasCallableOrAccessorToJSON(x: object): boolean {
  if (!Object.hasOwn(x, 'toJSON')) return false
  const desc = Object.getOwnPropertyDescriptor(x, 'toJSON')
  if (!desc) return false
  if (desc.get !== undefined || desc.set !== undefined) return true
  return typeof desc.value === 'function'
}

/** Array with prototype exactly `Array.prototype` and no callable/accessor `toJSON`. */
function isPlainArray(x: unknown): x is unknown[] {
  return (
    Array.isArray(x) &&
    Object.getPrototypeOf(x) === Array.prototype &&
    !hasCallableOrAccessorToJSON(x)
  )
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

function mergeKey(
  t: object,
  key: PropertyKey,
  sv: unknown,
  seen: WeakMap<object, object>,
  pairs: MergedPairs,
  depth: number
): void {
  const tv = Object.hasOwn(t, key) ? (t as Record<PropertyKey, unknown>)[key] : undefined
  if (key === 'constructor' && typeof tv === 'function') return
  if (sv === undefined && tv !== undefined) return
  if (isPlainObject(sv) || Array.isArray(sv)) {
    // Same container kind: merge into target. Differing array vs plain object: source replaces.
    const intoExisting =
      (Array.isArray(sv) && Array.isArray(tv)) || (isPlainObject(sv) && isPlainObject(tv))
    // Path-scoped cycle protection only: a hit means this source is already on the active path.
    if (!intoExisting && seen.has(sv)) {
      defineData(t, key, seen.get(sv))
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
    defineData(t, key, base)
  } else {
    defineData(t, key, sv)
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

    noteExpanded(s)
    assertNestingDepth(depth)
    if (t === Object.prototype || t === Function.prototype) return
    const rec = s as Record<string, unknown>
    for (const key of Object.keys(s)) {
      mergeKey(t, key, rec[key], seen, pairs, depth + 1)
    }
    const syms = Object.getOwnPropertySymbols(s)
    if (syms.length === 0) return
    for (const sym of syms) {
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
 * Writes via defineProperty. Skips undefined source values when the target already has a defined value.
 * Recurses when both sides are plain objects or both are arrays; when array and plain object
 * kinds differ, the source value replaces the target. Other values are assigned by reference.
 * Nesting deeper than 1000 levels throws `RangeError`. Each key gets its own fresh copy of a
 * shared source (the seen map is path-scoped for cycle protection only). Within one top-level
 * source argument, (source, target) pairs already merged are skipped (merging the same source
 * into the same target again changes nothing); each later source argument gets a fresh pair
 * cache so a source re-applied later is merged again. Re-expanding a shared source more than
 * 1000000 times throws `RangeError('input repeats shared objects more than 1000000 times')`.
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
        if (s != null) {
          // Fresh pair cache per top-level source so a later re-applied source is not skipped.
          const pairs: MergedPairs = new WeakMap()
          mergeInto(target, s, seen, pairs, 1, true)
        }
      }
      return target
    })
  )
}

const MISSING = Symbol('MISSING')

/** A dotted string path, or an array of literal key segments (no dot splitting). */
export type PropertyPath = string | readonly string[]

function normalizePath(path: PropertyPath): string[] {
  if (typeof path === 'string') return path.split('.')
  return path.map(String)
}

function getAtPath(obj: unknown, parts: string[]): unknown {
  let cur: unknown = obj
  for (const p of parts) {
    if (cur === null || (typeof cur !== 'object' && typeof cur !== 'function')) return MISSING
    if (!Object.hasOwn(cur, p)) return MISSING
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

/** Own enumerable string keys copied into a fresh plain object. */
function copyOwnEnumerable(src: object): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(src)) {
    defineData(out, key, (src as Record<string, unknown>)[key])
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
    defineData(dest, key, (src as Record<string, unknown>)[key])
  }
}

/**
 * Assign a picked leaf onto `root`, mirroring the source container kind (array vs plain object)
 * at each intermediate step. Containers already created for this pick are reused (copied once).
 */
function setPickedPath(
  root: object,
  parts: string[],
  value: unknown,
  source: object,
  created: WeakSet<object>
): void {
  let cur: object = root
  let srcCur: unknown = source
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    let next = Object.hasOwn(cur, p) ? (cur as Record<string, unknown>)[p] : undefined
    const srcNext =
      srcCur !== null &&
      (typeof srcCur === 'object' || typeof srcCur === 'function') &&
      Object.hasOwn(srcCur, p)
        ? (srcCur as Record<string, unknown>)[p]
        : undefined
    if (next !== undefined && created.has(next as object)) {
      cur = next as object
      srcCur = srcNext
      continue
    }
    if (next === undefined) {
      next = Array.isArray(srcNext) ? [] : {}
    } else if (Array.isArray(next)) {
      next = next.slice()
    } else if (isPlainObject(next)) {
      next = copyOwnEnumerable(next)
    } else {
      next = Array.isArray(srcNext) ? [] : {}
    }
    defineData(cur, p, next)
    created.add(next as object)
    cur = next as object
    srcCur = srcNext
  }
  let leaf = value
  if (Array.isArray(value)) {
    leaf = value.slice()
    created.add(leaf as object)
  } else if (isPlainObject(value)) {
    leaf = copyOwnEnumerable(value)
    created.add(leaf as object)
  }
  defineData(cur, parts[parts.length - 1], leaf)
}

/** Trie of omit paths: O(keys + total path length) walks. */
interface OmitTrie {
  drop?: boolean
  kids?: Map<string, OmitTrie>
}

function buildOmitTrie(paths: string[][]): OmitTrie {
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
      defineData(
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
 * String paths split on `.`; an array of segments addresses literal keys (including dots).
 * Intermediate containers mirror the source (array stays array). Keys are written with
 * defineProperty. Never mutates `obj` or any object reachable from it.
 * @param obj Source object.
 * @param paths Property paths or a `(value, key)` predicate.
 */
export function pick<T extends object>(
  obj: T | null | undefined,
  paths: readonly PropertyPath[] | ((v: unknown, k: string) => boolean)
): Partial<T> {
  const result: object = {}
  if (obj == null) return result
  if (typeof paths === 'function') {
    for (const key of Object.keys(obj)) {
      const v = (obj as Record<string, unknown>)[key]
      if (paths(v, key)) defineData(result, key, v)
    }
    return result
  }
  const created = new WeakSet<object>([result])
  const seen = new Set<string>()
  const pickedTrie: PickPathTrie = {}
  for (const path of paths) {
    const parts = normalizePath(path)
    const key = JSON.stringify(parts)
    if (seen.has(key)) continue
    if (hasPickedAncestor(parts, pickedTrie)) continue
    const value = getAtPath(obj, parts)
    if (value === MISSING) continue
    seen.add(key)
    setPickedPath(result, parts, value, obj, created)
    if (value !== null && typeof value === 'object') {
      markPickedObject(parts, pickedTrie)
    }
  }
  return result
}

/** Nested map of picked object paths; ancestor checks walk segment by segment. */
interface PickPathTrie {
  kids?: Map<string, PickPathTrie>
  object?: boolean
}

function hasPickedAncestor(parts: string[], root: PickPathTrie): boolean {
  let node = root
  for (let i = 0; i < parts.length - 1; i++) {
    const next = node.kids?.get(parts[i])
    if (!next) return false
    if (next.object) return true
    node = next
  }
  return false
}

function markPickedObject(parts: string[], root: PickPathTrie): void {
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
  node.object = true
}

/**
 * Create a deep copy of `obj` with the given paths omitted, or keep values where the predicate is falsy.
 * Never mutates `obj`. Builds a path trie once so cost is O(keys + total path length). Never
 * invokes getters of omitted keys. Kept own enumerable string-keyed data values are copied with a
 * normal `[[Get]]` read (Proxy get traps that mask values still apply); accessors are re-defined.
 * Symbol-keyed properties (e.g. `util.inspect.custom`) are not copied. String paths split on `.`;
 * an array of segments addresses literal keys. An omit path that ends at an array index leaves a
 * hole (`delete` semantics) on the copy. Top-level input and every descended container must be a
 * plain object (`Object.prototype` or `null` prototype) or a plain array (`Array.prototype`)
 * without a callable or accessor own `toJSON`. A function or accessor `toJSON`, Array subclass,
 * class instance, Map, Date, collection, or function throws
 * `TypeError('omit requires a plain object or array')` at the top level, or `TypeError` naming
 * the path when nested, before any output. A data property holding a non-function `toJSON` is
 * ordinary data. Primitives / null / undefined along a path are a no-op. Values not on any path
 * are kept by reference.
 * @param obj Source object.
 * @param paths Property paths or a `(value, key)` predicate.
 */
export function omit<T extends object>(
  obj: T | null | undefined,
  paths: readonly PropertyPath[] | ((v: unknown, k: string) => boolean)
): Partial<T> {
  return guardNesting((): Partial<T> => {
    if (obj == null) return {}
    if (!isOmitContainer(obj)) {
      throw new TypeError('omit requires a plain object or array')
    }
    if (typeof paths === 'function') {
      return pick(obj, (v, k) => !paths(v, k))
    }
    const trie = buildOmitTrie(paths.map(normalizePath))
    return omitWithTrie(obj, trie, []) as Partial<T>
  })
}

const BOXED_TAGS = new Set([
  '[object Number]',
  '[object String]',
  '[object Boolean]',
  '[object BigInt]',
  '[object Symbol]'
])

/**
 * Clone `value`. When `deep` is true, recurse into plain objects, arrays, Map and Set entries.
 * Own enumerable symbol keys are copied. Node `Buffer` is copied (not a shared view). `DataView`
 * keeps `byteOffset` / `byteLength` over a copy of the whole backing buffer. Deep `Map` clone
 * keeps key identity and deep-clones values. RegExp match arrays keep `index` / `input` /
 * `groups`. Class instances stay by reference. Symbol `protocol.clone` is honored and
 * receives the `deep` flag; a string-named `clone` method is ignored. Collection classes
 * deep-clone their values when `deep` is true (map-like keys stay by reference).
 * Deep nesting deeper than 1000 levels throws `RangeError`.
 * @param value Value to clone.
 * @param deep Deep clone when true.
 */
export function clone<T>(value: T, deep = false): T {
  return guardNesting(() => cloneInner(value, deep, new WeakMap()) as T)
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

function isNodeBuffer(v: unknown): v is Uint8Array {
  return (
    typeof Buffer !== 'undefined' &&
    typeof (Buffer as { isBuffer?: (x: unknown) => boolean }).isBuffer === 'function' &&
    (Buffer as { isBuffer: (x: unknown) => boolean }).isBuffer(v)
  )
}

function cloneInner(v: unknown, deep: boolean, map: WeakMap<object, unknown>): unknown {
  if (v === null || typeof v !== 'object') return v
  if (map.has(v)) return map.get(v)
  if (!deep) {
    if (hasMethod(v, protocol.clone)) return v[protocol.clone](false)
    return cloneShallow(v, map)
  }
  if (hasMethod(v, protocol.clone)) {
    // Half of HOOK_NESTING_COST at dispatch; collection clone hooks charge the other half.
    return withHookNesting(() => v[protocol.clone](true))
  }
  enterNesting()
  try {
    return cloneDeepBody(v, map)
  } finally {
    exitNesting()
  }
}

function cloneShallow(v: object, map: WeakMap<object, unknown>): unknown {
  const tag = Object.prototype.toString.call(v)
  let r: unknown

  if (tag === '[object Date]') {
    r = new Date((v as Date).getTime())
  } else if (tag === '[object RegExp]') {
    const re = v as RegExp
    r = new RegExp(re.source, re.flags)
    ;(r as RegExp).lastIndex = re.lastIndex
  } else if (tag === '[object Map]') {
    const out = new Map(v as Map<unknown, unknown>)
    map.set(v, out)
    return out
  } else if (tag === '[object Set]') {
    const out = new Set(v as Set<unknown>)
    map.set(v, out)
    return out
  } else if (tag === '[object ArrayBuffer]') {
    r = (v as ArrayBuffer).slice(0)
  } else if (tag === '[object DataView]') {
    const dv = v as DataView
    const buf = dv.buffer.slice(0)
    r = new DataView(buf, dv.byteOffset, dv.byteLength)
  } else if (isNodeBuffer(v)) {
    r = Buffer.from(v)
  } else if (isSliceableView(v)) {
    r = v.slice()
  } else if (BOXED_TAGS.has(tag)) {
    r = Object((v as { valueOf(): unknown }).valueOf())
  }

  if (r !== undefined) {
    map.set(v, r)
    return r
  }

  if (Array.isArray(v)) {
    const out = v.slice() as unknown[] & { index?: number; input?: string; groups?: unknown }
    map.set(v, out)
    const arr = v as unknown[] & { index?: number; input?: string; groups?: unknown }
    if ('index' in arr) out.index = arr.index
    if ('input' in arr) out.input = arr.input
    if ('groups' in arr) out.groups = arr.groups
    copyEnumerableSymbols(v, out, false, map)
    return out
  }

  if (isPlainObject(v)) {
    const out = Object.create(Object.getPrototypeOf(v) as object | null) as Record<string, unknown>
    map.set(v, out)
    for (const k of Object.keys(v)) {
      defineData(out, k, v[k])
    }
    copyEnumerableSymbols(v, out, false, map)
    return out
  }

  return v
}

function cloneDeepBody(v: object, map: WeakMap<object, unknown>): unknown {
  const tag = Object.prototype.toString.call(v)
  let r: unknown

  if (tag === '[object Date]') {
    r = new Date((v as Date).getTime())
  } else if (tag === '[object RegExp]') {
    const re = v as RegExp
    r = new RegExp(re.source, re.flags)
    ;(r as RegExp).lastIndex = re.lastIndex
  } else if (tag === '[object Map]') {
    const out = new Map()
    map.set(v, out)
    for (const [k, x] of v as Map<unknown, unknown>) {
      // Deep clone keeps Map key identity (Lodash); values are deep-cloned.
      out.set(k, cloneInner(x, true, map))
    }
    return out
  } else if (tag === '[object Set]') {
    const out = new Set()
    map.set(v, out)
    for (const x of v as Set<unknown>) {
      out.add(cloneInner(x, true, map))
    }
    return out
  } else if (tag === '[object ArrayBuffer]') {
    r = (v as ArrayBuffer).slice(0)
  } else if (tag === '[object DataView]') {
    const dv = v as DataView
    const buf = dv.buffer.slice(0)
    r = new DataView(buf, dv.byteOffset, dv.byteLength)
  } else if (isNodeBuffer(v)) {
    r = Buffer.from(v)
  } else if (isSliceableView(v)) {
    r = v.slice()
  } else if (BOXED_TAGS.has(tag)) {
    r = Object((v as { valueOf(): unknown }).valueOf())
  }

  if (r !== undefined) {
    map.set(v, r)
    return r
  }

  if (Array.isArray(v)) {
    const out: unknown[] = new Array(v.length)
    map.set(v, out)
    const len = v.length
    if (len > 1024) {
      walkArray(v, (ev) => {
        if (ev.kind === 'value') out[ev.index] = cloneInner(ev.value, true, map)
      })
    } else {
      for (let i = 0; i < len; i++) {
        if (i in v) out[i] = cloneInner(v[i], true, map)
      }
    }
    const arr = v as unknown[] & { index?: number; input?: string; groups?: unknown }
    if ('index' in arr) (out as { index?: number }).index = arr.index
    if ('input' in arr) (out as { input?: string }).input = arr.input
    if ('groups' in arr) {
      ;(out as { groups?: unknown }).groups = cloneInner(arr.groups, true, map)
    }
    copyEnumerableSymbols(v, out, true, map)
    return out
  }

  if (isPlainObject(v)) {
    const out = Object.create(Object.getPrototypeOf(v) as object | null) as Record<string, unknown>
    map.set(v, out)
    for (const k of Object.keys(v)) {
      defineData(out, k, cloneInner(v[k], true, map))
    }
    copyEnumerableSymbols(v, out, true, map)
    return out
  }

  return v
}
