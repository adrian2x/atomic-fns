/**
 * Object utilities: merge, pick, omit, clone.
 */

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

function mergeInto(t: object, s: object, seen: WeakMap<object, object>): void {
  if (t === Object.prototype || t === Function.prototype) return
  for (const key of Object.keys(s)) {
    const sv = (s as Record<string, unknown>)[key]
    const tv = Object.hasOwn(t, key) ? (t as Record<string, unknown>)[key] : undefined
    if (key === 'constructor' && typeof tv === 'function') continue
    if (sv === undefined && tv !== undefined) continue
    if (isPlainObject(sv) || Array.isArray(sv)) {
      if (seen.has(sv)) {
        defineData(t, key, seen.get(sv))
        continue
      }
      const base = Array.isArray(sv) ? (Array.isArray(tv) ? tv : []) : isPlainObject(tv) ? tv : {}
      seen.set(sv, base)
      mergeInto(base, sv, seen)
      seen.delete(sv)
      defineData(t, key, base)
    } else {
      defineData(t, key, sv)
    }
  }
}

/**
 * Recursively merge own enumerable string keys of `sources` into `target`.
 * Writes via defineProperty. Skips undefined source values when the target already has a defined value.
 * Recurses for plain objects and arrays; other values are assigned by reference.
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
    if (s != null) mergeInto(target, s, seen)
  }
  return target
}

const MISSING = Symbol('MISSING')

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

/** Assign a picked leaf onto `root`, copying every intermediate container. */
function setPickedPath(root: object, parts: string[], value: unknown): void {
  let cur: object = root
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    let next = Object.hasOwn(cur, p) ? (cur as Record<string, unknown>)[p] : undefined
    if (Array.isArray(next)) {
      next = next.slice()
    } else if (isPlainObject(next)) {
      next = copyOwnEnumerable(next)
    } else {
      next = {}
    }
    defineData(cur, p, next)
    cur = next as object
  }
  defineData(cur, parts[parts.length - 1], value)
}

function omitClone(value: unknown, omitPaths: string[][]): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    const list = value as unknown[]
    const out: unknown[] = []
    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      const nested = omitPaths.filter((p) => p[0] === String(i)).map((p) => p.slice(1))
      if (nested.some((p) => p.length === 0) || nested.length === 0) {
        out.push(item)
      } else {
        out.push(omitClone(item, nested))
      }
    }
    return out
  }
  if (!isPlainObject(value)) {
    return omitFromPlain(copyOwnEnumerable(value), omitPaths)
  }
  return omitFromPlain(value, omitPaths)
}

function omitFromPlain(
  src: Record<string, unknown>,
  omitPaths: string[][]
): Record<string, unknown> {
  const dropTop = new Set(omitPaths.filter((p) => p.length === 1).map((p) => p[0]))
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(src)) {
    if (dropTop.has(key)) continue
    const nested = omitPaths.filter((p) => p[0] === key && p.length > 1).map((p) => p.slice(1))
    if (nested.length === 0) {
      defineData(result, key, src[key])
    } else {
      defineData(result, key, omitClone(src[key], nested))
    }
  }
  return result
}

/**
 * Create an object with only the selected paths or predicate matches from `obj`.
 * Dotted paths produce nested output. Keys are written with defineProperty.
 * Never mutates `obj` or any object reachable from it.
 * @param obj Source object.
 * @param paths Property paths or a `(value, key)` predicate.
 */
export function pick<T extends object>(
  obj: T | null | undefined,
  paths: readonly string[] | ((v: unknown, k: string) => boolean)
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
  for (const path of paths) {
    const parts = path.split('.')
    const value = getAtPath(obj, parts)
    if (value === MISSING) continue
    setPickedPath(result, parts, value)
  }
  return result
}

/**
 * Create a deep copy of `obj` with the given paths omitted, or keep values where the predicate is falsy.
 * Never mutates `obj`. Non-plain inputs become fresh plain objects along modified paths.
 * @param obj Source object.
 * @param paths Property paths or a `(value, key)` predicate.
 */
export function omit<T extends object>(
  obj: T | null | undefined,
  paths: readonly string[] | ((v: unknown, k: string) => boolean)
): Partial<T> {
  if (obj == null) return {}
  if (typeof paths === 'function') {
    return pick(obj, (v, k) => !paths(v, k))
  }
  const omitPaths = paths.map((path) => path.split('.'))
  if (isPlainObject(obj) || Array.isArray(obj)) {
    return omitClone(obj, omitPaths) as Partial<T>
  }
  return omitFromPlain(copyOwnEnumerable(obj), omitPaths) as Partial<T>
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
 * `groups`. Class instances stay by reference. Symbol `protocol.clone` is honored; a
 * string-named `clone` method is ignored.
 * @param value Value to clone.
 * @param deep Deep clone when true.
 */
export function clone<T>(value: T, deep = false): T {
  return cloneInner(value, deep, new WeakMap()) as T
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
    defineData(dest, sym, deep ? cloneInner((src as Record<symbol, unknown>)[sym], true, map) : (src as Record<symbol, unknown>)[sym])
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
  if (hasMethod(v, protocol.clone)) return v[protocol.clone]()

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
      out.set(k, deep ? cloneInner(x, true, map) : x)
    }
    return out
  } else if (tag === '[object Set]') {
    const out = new Set()
    map.set(v, out)
    for (const x of v as Set<unknown>) {
      out.add(deep ? cloneInner(x, true, map) : x)
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
      if (i in v) out[i] = deep ? cloneInner(v[i], true, map) : v[i]
    }
    const arr = v as unknown[] & { index?: number; input?: string; groups?: unknown }
    if ('index' in arr) (out as { index?: number }).index = arr.index
    if ('input' in arr) (out as { input?: string }).input = arr.input
    if ('groups' in arr) {
      ;(out as { groups?: unknown }).groups = deep
        ? cloneInner(arr.groups, true, map)
        : arr.groups
    }
    copyEnumerableSymbols(v, out, deep, map)
    return out
  }

  if (isPlainObject(v)) {
    const out = Object.create(Object.getPrototypeOf(v) as object | null) as Record<string, unknown>
    map.set(v, out)
    for (const k of Object.keys(v)) {
      defineData(out, k, deep ? cloneInner(v[k], true, map) : v[k])
    }
    copyEnumerableSymbols(v, out, deep, map)
    return out
  }

  return v
}
