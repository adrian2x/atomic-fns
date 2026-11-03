/**
 * Object utilities: merge, pick, omit, clone.
 */

import { assertNestingDepth } from '../internal/nesting.js'
import { hasMethod, protocol } from '../operators/index.js'

/** Define an own enumerable writable configurable data property. */
export function defineData(target: object, key: PropertyKey, value: unknown): void {
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

function isSliceableView(v: unknown): v is ArrayBufferView & { slice(): unknown } {
  return ArrayBuffer.isView(v) && 'slice' in v && typeof v.slice === 'function'
}

function mergeKey(
  t: object,
  key: PropertyKey,
  sv: unknown,
  seen: WeakMap<object, object>,
  depth: number
): void {
  const tv = Object.hasOwn(t, key) ? (t as Record<PropertyKey, unknown>)[key] : undefined
  if (key === 'constructor' && typeof tv === 'function') return
  if (sv === undefined && tv !== undefined) return
  if (isPlainObject(sv) || Array.isArray(sv)) {
    if (seen.has(sv)) {
      defineData(t, key, seen.get(sv))
      return
    }
    // Same container kind: merge into target. Differing array vs plain object: source replaces.
    let base: object
    if (Array.isArray(sv)) {
      base = Array.isArray(tv) ? tv : []
    } else if (isPlainObject(tv)) {
      base = tv
    } else {
      base = {}
    }
    seen.set(sv, base)
    mergeInto(base, sv, seen, depth)
    seen.delete(sv)
    defineData(t, key, base)
  } else {
    defineData(t, key, sv)
  }
}

function mergeInto(t: object, s: object, seen: WeakMap<object, object>, depth: number): void {
  assertNestingDepth(depth)
  if (t === Object.prototype || t === Function.prototype) return
  for (const key of Object.keys(s)) {
    mergeKey(t, key, (s as Record<string, unknown>)[key], seen, depth + 1)
  }
  for (const sym of Object.getOwnPropertySymbols(s)) {
    const desc = Object.getOwnPropertyDescriptor(s, sym)
    if (!desc?.enumerable) continue
    mergeKey(t, sym, (s as Record<symbol, unknown>)[sym], seen, depth + 1)
  }
}

/**
 * Recursively merge own enumerable string and symbol keys of `sources` into `target`.
 * Writes via defineProperty. Skips undefined source values when the target already has a defined value.
 * Recurses when both sides are plain objects or both are arrays; when array and plain object
 * kinds differ, the source value replaces the target. Other values are assigned by reference.
 * Nesting deeper than 1000 levels throws `RangeError`; on throw, `target` may already hold a
 * partial merge of earlier keys at shallower levels.
 * @param target Destination object (mutated).
 * @param sources Source objects applied left to right.
 * @returns `target`
 */
export function merge<T extends object>(target: T, ...sources: (object | null | undefined)[]): T {
  const dest: unknown = target
  if (dest === null || typeof dest !== 'object') {
    throw new TypeError('merge target must be an object')
  }
  const seen = new WeakMap<object, object>()
  for (const s of sources) {
    if (s != null) mergeInto(target, s, seen, 1)
  }
  return target
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

/** Copy one own property via its descriptor without invoking other getters. */
function copyKeptProperty(src: object, dest: object, key: string): void {
  const desc = Object.getOwnPropertyDescriptor(src, key)
  if (!desc) return
  if (desc.get !== undefined || desc.set !== undefined) {
    Object.defineProperty(dest, key, desc)
  } else {
    defineData(dest, key, desc.value)
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
  defineData(cur, parts[parts.length - 1], value)
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

function omitWithTrie(value: unknown, trie: OmitTrie): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    const list = value as unknown[]
    const out: unknown[] = new Array(list.length)
    for (let i = 0; i < list.length; i++) {
      const child = trie.kids?.get(String(i))
      if (child?.drop) continue
      if (!child?.kids) {
        out[i] = list[i]
      } else {
        out[i] = omitWithTrie(list[i], child)
      }
    }
    return out
  }
  // Paths stop at non-plain objects (Date, Map, class instances, typed arrays): keep by reference.
  if (!isPlainObject(value)) return value
  return omitFromObject(value, trie)
}

function omitFromObject(src: object, trie: OmitTrie): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(src)) {
    const child = trie.kids?.get(key)
    if (child?.drop) continue
    if (!child?.kids) {
      copyKeptProperty(src, result, key)
    } else {
      defineData(result, key, omitWithTrie((src as Record<string, unknown>)[key], child))
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
  for (const path of paths) {
    const parts = normalizePath(path)
    const value = getAtPath(obj, parts)
    if (value === MISSING) continue
    setPickedPath(result, parts, value, obj, created)
  }
  return result
}

/**
 * Create a deep copy of `obj` with the given paths omitted, or keep values where the predicate is falsy.
 * Never mutates `obj`. Builds a path trie once so cost is O(keys + total path length). Never
 * invokes getters of omitted keys (copies kept keys via property descriptors). String paths
 * split on `.`; an array of segments addresses literal keys. An omit path that ends at an array
 * index leaves a hole (`delete` semantics) on the copy. Descent only continues through plain
 * objects and arrays; any other value is kept by reference.
 * @param obj Source object.
 * @param paths Property paths or a `(value, key)` predicate.
 */
export function omit<T extends object>(
  obj: T | null | undefined,
  paths: readonly PropertyPath[] | ((v: unknown, k: string) => boolean)
): Partial<T> {
  if (obj == null) return {}
  if (typeof paths === 'function') {
    return pick(obj, (v, k) => !paths(v, k))
  }
  const trie = buildOmitTrie(paths.map(normalizePath))
  if (isPlainObject(obj) || Array.isArray(obj)) {
    return omitWithTrie(obj, trie) as Partial<T>
  }
  return omitFromObject(obj, trie) as Partial<T>
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
 * deep-clone their values when `deep` is true (comparator-ordered keys stay by reference).
 * Deep nesting deeper than 1000 levels throws `RangeError`.
 * @param value Value to clone.
 * @param deep Deep clone when true.
 */
export function clone<T>(value: T, deep = false): T {
  return cloneInner(value, deep, new WeakMap(), 1) as T
}

function copyEnumerableSymbols(
  src: object,
  dest: object,
  deep: boolean,
  map: WeakMap<object, unknown>,
  depth: number
): void {
  for (const sym of Object.getOwnPropertySymbols(src)) {
    const desc = Object.getOwnPropertyDescriptor(src, sym)
    if (!desc?.enumerable) continue
    defineData(
      dest,
      sym,
      deep
        ? cloneInner((src as Record<symbol, unknown>)[sym], true, map, depth + 1)
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

function cloneInner(
  v: unknown,
  deep: boolean,
  map: WeakMap<object, unknown>,
  depth: number
): unknown {
  if (v === null || typeof v !== 'object') return v
  if (map.has(v)) return map.get(v)
  if (hasMethod(v, protocol.clone)) return v[protocol.clone](deep)
  if (deep) assertNestingDepth(depth)

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
      out.set(k, deep ? cloneInner(x, true, map, depth + 1) : x)
    }
    return out
  } else if (tag === '[object Set]') {
    const out = new Set()
    map.set(v, out)
    for (const x of v as Set<unknown>) {
      out.add(deep ? cloneInner(x, true, map, depth + 1) : x)
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
    for (let i = 0; i < v.length; i++) {
      if (i in v) out[i] = deep ? cloneInner(v[i], true, map, depth + 1) : v[i]
    }
    const arr = v as unknown[] & { index?: number; input?: string; groups?: unknown }
    if ('index' in arr) (out as { index?: number }).index = arr.index
    if ('input' in arr) (out as { input?: string }).input = arr.input
    if ('groups' in arr) {
      ;(out as { groups?: unknown }).groups = deep
        ? cloneInner(arr.groups, true, map, depth + 1)
        : arr.groups
    }
    copyEnumerableSymbols(v, out, deep, map, depth)
    return out
  }

  if (isPlainObject(v)) {
    const out = Object.create(Object.getPrototypeOf(v) as object | null) as Record<string, unknown>
    map.set(v, out)
    for (const k of Object.keys(v)) {
      defineData(out, k, deep ? cloneInner(v[k], true, map, depth + 1) : v[k])
    }
    copyEnumerableSymbols(v, out, deep, map, depth)
    return out
  }

  return v
}
