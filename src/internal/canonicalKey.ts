/**
 * Stable structural key agreeing with `deepEqual`: equal keys iff deepEqual is true,
 * for every value that has a key. Returns `undefined` for class instances, functions,
 * symbols, protocol-equality types (Decimal, collections), Invalid Dates, Map/Set with
 * non-primitive keys/elements, and other values that cannot be keyed exactly.
 */

import { enterNesting, exitNesting, guardNesting } from './nesting.js'

const BOXED_PRIMITIVES = [Number, String, Boolean, BigInt, Symbol] as const
const NOT_BOXED = Symbol('not boxed')

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

function numberKey(n: number): string {
  // SameValueZero: -0 equals 0; NaN equals NaN (match deepEqual / eq).
  if (Number.isNaN(n)) return 'n:NaN'
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

function canonicalKeyInner(value: unknown): string | undefined {
  const prim = primitiveKey(value)
  if (prim !== undefined) return prim
  const t = typeof value
  if (t === 'symbol' || t === 'function') return undefined
  if (t !== 'object' || value === null) return undefined

  const obj = value as object
  const tag = tagOf(obj)

  if (obj instanceof Date) {
    const time = obj.getTime()
    if (Number.isNaN(time)) return undefined
    return `Date:${String(time)}`
  }
  if (obj instanceof RegExp) {
    return `Re:${JSON.stringify(obj.source)}:${obj.flags}`
  }

  const boxed = unboxed(obj)
  if (boxed !== NOT_BOXED) {
    const bk = primitiveKey(boxed)
    if (bk === undefined) return undefined
    return `box:${tag}:${bk}`
  }

  if (obj instanceof ArrayBuffer) {
    return `AB:${bytesKey(obj)}`
  }
  if (ArrayBuffer.isView(obj)) {
    return `view:${tag}:${bytesKey(obj)}`
  }

  if (obj instanceof Map) {
    if (Object.getPrototypeOf(obj) !== Map.prototype) return undefined
    enterNesting()
    try {
      const parts: string[] = []
      for (const [k, v] of obj) {
        const kk = mapKeyPrimitive(k)
        if (kk === undefined) return undefined
        const vk = canonicalKeyInner(v)
        if (vk === undefined) return undefined
        parts.push(`${kk}=>${vk}`)
      }
      parts.sort()
      return `Map:{${parts.join(',')}}`
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
        if (vk === undefined) return undefined
        parts.push(vk)
      }
      parts.sort()
      return `Set:{${parts.join(',')}}`
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
      for (const i of obj.keys()) {
        const k = canonicalKeyInner(obj[i])
        if (k === undefined) return undefined
        parts.push(k)
      }
      return `${pt}[${parts.join(',')}]`
    } finally {
      exitNesting()
    }
  }

  const pt = protoTag(obj)
  if (pt === undefined) return undefined
  // Only plain objects (Object.prototype or null); reject exotic tags.
  if (tag !== '[object Object]') return undefined

  enterNesting()
  try {
    const keys = Object.keys(obj).toSorted()
    const parts: string[] = []
    for (const key of keys) {
      const k = canonicalKeyInner((obj as Record<string, unknown>)[key])
      if (k === undefined) return undefined
      parts.push(`${JSON.stringify(key)}:${k}`)
    }
    return `${pt}{${parts.join(',')}}`
  } finally {
    exitNesting()
  }
}

/** Canonical structural key, or `undefined` when the value cannot be keyed to match deepEqual. */
export function canonicalKey(value: unknown): string | undefined {
  return guardNesting(() => canonicalKeyInner(value))
}
