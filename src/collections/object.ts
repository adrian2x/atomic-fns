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
  const proto = Object.getPrototypeOf(x)
  return proto === Object.prototype || proto === null
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
export function merge<T extends object>(target: T, ...sources: object[]): T {
  if (target === null || typeof target !== 'object') {
    throw new TypeError('merge target must be an object')
  }
  const seen = new WeakMap<object, object>()
  for (const s of sources) {
    if (s != null) mergeInto(target, s, seen)
  }
  return target
}

function pathSegments(path: string): string[] {
  return path.split('.')
}

function getAtPath(obj: unknown, parts: string[]): unknown {
  let cur: unknown = obj
  for (const p of parts) {
    if (cur === null || (typeof cur !== 'object' && typeof cur !== 'function')) return undefined
    if (!Object.hasOwn(cur as object, p)) return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

function setAtPath(root: object, parts: string[], value: unknown): void {
  let cur: object = root
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    let next = Object.hasOwn(cur, p) ? (cur as Record<string, unknown>)[p] : undefined
    if (!isPlainObject(next) && !Array.isArray(next)) {
      next = {}
      defineData(cur, p, next)
    }
    cur = next as object
  }
  defineData(cur, parts[parts.length - 1], value)
}

function deleteAtPath(root: object, parts: string[]): void {
  let cur: unknown = root
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur === null || typeof cur !== 'object') return
    cur = (cur as Record<string, unknown>)[parts[i]]
  }
  if (cur !== null && typeof cur === 'object') {
    delete (cur as Record<string, unknown>)[parts[parts.length - 1]]
  }
}

function deepClonePlain(value: unknown): unknown {
  return clone(value, true)
}

/**
 * Create an object with only the selected paths or predicate matches from `obj`.
 * Dotted paths produce nested output. Keys are written with defineProperty.
 * @param obj Source object.
 * @param paths Property paths or a `(value, key)` predicate.
 */
export function pick<T extends object>(
  obj: T,
  paths: readonly string[] | ((v: unknown, k: string) => boolean)
): Partial<T> {
  const result: object = {}
  if (obj == null) return result as Partial<T>
  if (typeof paths === 'function') {
    for (const key of Object.keys(obj)) {
      const v = (obj as Record<string, unknown>)[key]
      if (paths(v, key)) defineData(result, key, v)
    }
    return result as Partial<T>
  }
  for (const path of paths) {
    const parts = pathSegments(path)
    if (!hasPath(obj, parts)) continue
    setAtPath(result, parts, getAtPath(obj, parts))
  }
  return result as Partial<T>
}

function hasPath(obj: unknown, parts: string[]): boolean {
  let cur: unknown = obj
  for (const p of parts) {
    if (cur === null || (typeof cur !== 'object' && typeof cur !== 'function')) return false
    if (!Object.hasOwn(cur as object, p)) return false
    cur = (cur as Record<string, unknown>)[p]
  }
  return true
}

/**
 * Create a deep copy of `obj` with the given paths omitted, or keep values where the predicate is falsy.
 * @param obj Source object.
 * @param paths Property paths or a `(value, key)` predicate.
 */
export function omit<T extends object>(
  obj: T,
  paths: readonly string[] | ((v: unknown, k: string) => boolean)
): Partial<T> {
  if (obj == null) return {}
  if (typeof paths === 'function') {
    const result: object = {}
    for (const key of Object.keys(obj)) {
      const v = (obj as Record<string, unknown>)[key]
      if (!paths(v, key)) defineData(result, key, v)
    }
    return result as Partial<T>
  }
  const result = deepClonePlain(obj) as object
  for (const path of paths) {
    deleteAtPath(result, pathSegments(path))
  }
  return result as Partial<T>
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
 * Symbol `protocol.clone` is honored; a string-named `clone` method is ignored.
 * @param value Value to clone.
 * @param deep Deep clone when true.
 */
export function clone<T>(value: T, deep = false): T {
  return cloneInner(value, deep, new WeakMap()) as T
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
      out.set(deep ? cloneInner(k, true, map) : k, deep ? cloneInner(x, true, map) : x)
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
    r = new DataView(dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength))
  } else if (ArrayBuffer.isView(v) && 'slice' in v && typeof v.slice === 'function') {
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
    return out
  }

  if (isPlainObject(v)) {
    const out = Object.create(Object.getPrototypeOf(v))
    map.set(v, out)
    for (const k of Object.keys(v)) {
      defineData(out, k, deep ? cloneInner((v as Record<string, unknown>)[k], true, map) : v[k])
    }
    return out
  }

  return v
}

/** Clone an array; equivalent to `clone(arr, deep)`. */
export function cloneArray<T>(arr: T[], deep = false): T[] {
  return clone(arr, deep)
}

/** Shallow clone a typed array via `slice()`. */
export function cloneTypedArray<T extends { slice(): T }>(ta: T): T {
  return ta.slice()
}
