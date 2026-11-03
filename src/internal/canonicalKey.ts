/**
 * Stable structural key agreeing with `deepEqual`: equal keys iff deepEqual is true,
 * for every value that has a key. Returns `undefined` for class instances, functions,
 * symbols, protocol-equality types (Decimal, collections), Invalid Dates, Map/Set with
 * non-primitive keys/elements, cyclic objects, values whose expanded key exceeds 64 KB
 * (shared-reference DAGs fall back to pairwise matching), Date/RegExp/typed-array subclasses
 * (deepEqual requires the exact built-in prototype), and other values that cannot be keyed
 * exactly. Within one top-level call, each object node's key is memoized.
 *
 * A key is "pure" when built only from JSON-shaped data (primitives including numbers and
 * bigints, arrays, plain objects) plus exact built-in Date/RegExp. Boxed primitives, typed
 * arrays, ArrayBuffer, Map, and Set yield impure keys: two pure items are deepEqual iff their
 * keys are equal, so cross-kind deepEqual matches always involve an impure item.
 */

import { enterNesting, exitNesting, guardNesting } from './nesting.js'

const KEY_SIZE_LIMIT = 64 * 1024

const BOXED_PRIMITIVES = [Number, String, Boolean, BigInt, Symbol] as const
const NOT_BOXED = Symbol('not boxed')

const TYPED_ARRAY_PROTOS: object[] = [
  Int8Array.prototype,
  Uint8Array.prototype,
  Uint8ClampedArray.prototype,
  Int16Array.prototype,
  Uint16Array.prototype,
  Int32Array.prototype,
  Uint32Array.prototype,
  Float32Array.prototype,
  Float64Array.prototype,
  BigInt64Array.prototype,
  BigUint64Array.prototype
]

/** Result of a successful key: the key string and whether it is pure (JSON + Date/RegExp). */
export interface CanonicalKeyInfo {
  key: string
  pure: boolean
}

interface KeyState {
  memo: WeakMap<object, CanonicalKeyInfo>
  failed: WeakSet<object>
  inProgress: WeakSet<object>
}

function unboxed(v: object): unknown {
  for (const Ctor of BOXED_PRIMITIVES) {
    if (v instanceof Ctor) {
      try {
        return (Ctor.prototype.valueOf as (this: unknown) => unknown).call(v)
      } catch {
        return NOT_BOXED
      }
    }
  }
  return NOT_BOXED
}

function tagOf(v: object): string {
  return Object.prototype.toString.call(v)
}

function bytes(v: ArrayBuffer | ArrayBufferView): Uint8Array {
  return v instanceof ArrayBuffer
    ? new Uint8Array(v)
    : new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
}

function bytesKey(v: ArrayBuffer | ArrayBufferView): string {
  return Array.from(bytes(v), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** SameValueZero for bare numbers (match deepEqual / eq on primitives). */
function numberKey(n: number): string {
  if (Number.isNaN(n)) return 'n:NaN'
  if (n === 0) return 'n:0'
  return `n:${n.toString()}`
}

/** Object.is for boxed Number values (match deepEqual on boxed primitives). */
function boxedNumberKey(n: number): string {
  if (Number.isNaN(n)) return 'n:NaN'
  if (Object.is(n, -0)) return 'n:-0'
  if (n === 0) return 'n:0'
  return `n:${n.toString()}`
}

function primitiveKey(value: unknown): string | undefined {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  const t = typeof value
  if (t === 'boolean') return value === true ? 'b:true' : 'b:false'
  if (t === 'string') return `s:${JSON.stringify(value)}`
  if (t === 'number') return numberKey(value as number)
  if (t === 'bigint') return `bi:${(value as bigint).toString()}`
  return undefined
}

/** Map/Set membership uses SameValueZero; only primitives (and null) key safely. */
function mapKeyPrimitive(value: unknown): string | undefined {
  if (typeof value === 'symbol' || typeof value === 'function') return undefined
  if (value !== null && typeof value === 'object') return undefined
  return primitiveKey(value)
}

function protoTag(obj: object): string | undefined {
  const p: unknown = Object.getPrototypeOf(obj)
  if (p === Object.prototype) return 'O'
  if (p === null) return 'N'
  if (p === Array.prototype) return 'A'
  return undefined
}

function accept(
  state: KeyState,
  obj: object,
  info: CanonicalKeyInfo | undefined
): CanonicalKeyInfo | undefined {
  if (info === undefined || info.key.length > KEY_SIZE_LIMIT) {
    state.failed.add(obj)
    return undefined
  }
  state.memo.set(obj, info)
  return info
}

function isBuiltinTypedArrayProto(proto: object): boolean {
  return TYPED_ARRAY_PROTOS.includes(proto)
}

function canonicalKeyInner(value: unknown, state: KeyState): CanonicalKeyInfo | undefined {
  const prim = primitiveKey(value)
  if (prim !== undefined) return { key: prim, pure: true }
  const t = typeof value
  if (t === 'symbol' || t === 'function') return undefined
  if (t !== 'object' || value === null) return undefined

  const obj = value as object
  if (state.failed.has(obj)) return undefined
  const hit = state.memo.get(obj)
  if (hit !== undefined) return hit
  // Cycle: cannot expand without breaking key/deepEqual agreement with tree forms.
  if (state.inProgress.has(obj)) return undefined

  const tag = tagOf(obj)

  if (obj instanceof Date) {
    if (Object.getPrototypeOf(obj) !== Date.prototype) return undefined
    const time = obj.getTime()
    if (Number.isNaN(time)) return undefined
    return accept(state, obj, { key: `Date:${String(time)}`, pure: true })
  }
  if (obj instanceof RegExp) {
    if (Object.getPrototypeOf(obj) !== RegExp.prototype) return undefined
    return accept(state, obj, {
      key: `Re:${JSON.stringify(obj.source)}:${obj.flags}`,
      pure: true
    })
  }

  const boxed = unboxed(obj)
  if (boxed !== NOT_BOXED) {
    // Boxed Number uses Object.is; other boxed primitives have no signed-zero issue.
    let bk: string | undefined
    if (typeof boxed === 'number') bk = boxedNumberKey(boxed)
    else bk = primitiveKey(boxed)
    if (bk === undefined) return undefined
    return accept(state, obj, { key: `box:${tag}:${bk}`, pure: false })
  }

  if (obj instanceof ArrayBuffer) {
    if (Object.getPrototypeOf(obj) !== ArrayBuffer.prototype) return undefined
    return accept(state, obj, { key: `AB:${bytesKey(obj)}`, pure: false })
  }
  if (ArrayBuffer.isView(obj)) {
    const proto: unknown = Object.getPrototypeOf(obj)
    if (obj instanceof DataView) {
      if (proto !== DataView.prototype) return undefined
    } else if (typeof proto !== 'object' || proto === null || !isBuiltinTypedArrayProto(proto)) {
      return undefined
    }
    return accept(state, obj, { key: `view:${tag}:${bytesKey(obj)}`, pure: false })
  }

  state.inProgress.add(obj)
  try {
    if (obj instanceof Map) {
      if (Object.getPrototypeOf(obj) !== Map.prototype) return undefined
      enterNesting()
      try {
        const parts: string[] = []
        for (const [k, v] of obj) {
          const kk = mapKeyPrimitive(k)
          if (kk === undefined) return accept(state, obj, undefined)
          const vk = canonicalKeyInner(v, state)
          if (vk === undefined) return accept(state, obj, undefined)
          parts.push(`${kk}=>${vk.key}`)
        }
        parts.sort()
        return accept(state, obj, { key: `Map:{${parts.join(',')}}`, pure: false })
      } finally {
        exitNesting()
      }
    }

    if (obj instanceof Set) {
      if (Object.getPrototypeOf(obj) !== Set.prototype) return undefined
      enterNesting()
      try {
        const parts: string[] = []
        for (const v of obj) {
          const vk = mapKeyPrimitive(v)
          if (vk === undefined) return accept(state, obj, undefined)
          parts.push(vk)
        }
        parts.sort()
        return accept(state, obj, { key: `Set:{${parts.join(',')}}`, pure: false })
      } finally {
        exitNesting()
      }
    }

    if (Array.isArray(obj)) {
      const pt = protoTag(obj)
      if (pt === undefined) return undefined
      enterNesting()
      try {
        const parts: string[] = []
        let pure = true
        for (const i of obj.keys()) {
          const k = canonicalKeyInner(obj[i], state)
          if (k === undefined) return accept(state, obj, undefined)
          parts.push(k.key)
          if (!k.pure) pure = false
        }
        return accept(state, obj, { key: `${pt}[${parts.join(',')}]`, pure })
      } finally {
        exitNesting()
      }
    }

    const pt = protoTag(obj)
    if (pt === undefined) return undefined
    if (tag !== '[object Object]') return undefined

    enterNesting()
    try {
      const keys = Object.keys(obj).toSorted()
      const parts: string[] = []
      let pure = true
      for (const key of keys) {
        const k = canonicalKeyInner((obj as Record<string, unknown>)[key], state)
        if (k === undefined) return accept(state, obj, undefined)
        parts.push(`${JSON.stringify(key)}:${k.key}`)
        if (!k.pure) pure = false
      }
      return accept(state, obj, { key: `${pt}{${parts.join(',')}}`, pure })
    } finally {
      exitNesting()
    }
  } finally {
    state.inProgress.delete(obj)
  }
}

function freshState(): KeyState {
  return {
    memo: new WeakMap(),
    failed: new WeakSet(),
    inProgress: new WeakSet()
  }
}

/**
 * Canonical structural key plus purity, or `undefined` when the value cannot be keyed to match
 * deepEqual. Deviation for shared-reference DAGs: when the tree-expanded key would exceed 64 KB,
 * returns `undefined` (no key) so Heap equality falls back to pairwise `deepEqual`, preserving
 * the key/deepEqual agreement property for every value that does receive a key.
 */
export function canonicalKeyInfo(value: unknown): CanonicalKeyInfo | undefined {
  return guardNesting(() => canonicalKeyInner(value, freshState()))
}

/**
 * Canonical structural key, or `undefined` when the value cannot be keyed to match deepEqual.
 */
export function canonicalKey(value: unknown): string | undefined {
  return canonicalKeyInfo(value)?.key
}
