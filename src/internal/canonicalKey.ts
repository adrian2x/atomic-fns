/**
 * Stable structural key agreeing with `deepEqual`: equal keys iff deepEqual is true,
 * for every value that has a key. Returns `undefined` for class instances, functions,
 * symbols, protocol-equality types (Decimal, collections), Invalid Dates, Map/Set with
 * non-primitive keys/elements, cyclic objects, Date/RegExp/typed-array subclasses
 * (deepEqual requires the exact built-in prototype), and other values that cannot be keyed
 * exactly. Within one session (one call by default), each object node's key is memoized.
 *
 * When the expanded key would exceed 64 KB (shared-reference DAGs), the key is replaced by a
 * fixed-size structural hash and marked `hashed`. Each node's hash is computed once from its
 * children's hashes, so shared subtrees are hashed once. deepEqual-equal values hash equal, but
 * equal hashes do not imply equality: a hashed key only groups candidates for pairwise matching.
 *
 * A key is "pure" when built only from JSON-shaped data (primitives including numbers and
 * bigints, arrays, plain objects) plus exact built-in Date/RegExp. Boxed primitives, typed
 * arrays, ArrayBuffer, Map, Set, and every hashed key yield impure keys: two pure items are
 * deepEqual iff their keys are equal, so cross-kind deepEqual matches always involve an impure
 * item.
 */

import { isHugeSparse, walkArray } from './arrayKeys.js'
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

/**
 * Result of a successful key. `hashed` keys replace an exact key that would exceed 64 KB with a
 * fixed-size structural hash; they are never pure and may collide, so equal hashed keys only
 * mean "candidates for deepEqual".
 */
export interface CanonicalKeyInfo {
  key: string
  /** True when built only from JSON-shaped data plus exact built-in Date/RegExp. */
  pure: boolean
  /** True when `key` is a structural hash instead of the exact expansion. */
  hashed: boolean
}

/** Key info plus the fixed-size token a parent mixes into its own hash. */
interface NodeInfo extends CanonicalKeyInfo {
  /** Leaf: the exact key. Composite or buffer: its structural hash. */
  token: string
}

/**
 * Memo shared by every `canonicalKeyInfo` call that receives it, so shared subtrees are keyed
 * and hashed once per session. Valid only while the keyed values are not mutated.
 */
export interface CanonicalKeySession {
  readonly memo: WeakMap<object, NodeInfo>
  readonly failed: WeakSet<object>
  readonly inProgress: WeakSet<object>
  /**
   * Shape-side descendant pure leaf-key sets for matches indexing. `false` means the node is
   * impure (cannot index). Valid only while the keyed values are not mutated.
   */
  readonly matchShapeLeafKeys: WeakMap<object, Set<string> | false>
  /** Target-side descendant pure leaf-key sets for matches posting lists. */
  readonly matchTargetLeafKeys: WeakMap<object, Set<string>>
}

/** Create an empty key session. */
export function createCanonicalKeySession(): CanonicalKeySession {
  return {
    memo: new WeakMap(),
    failed: new WeakSet(),
    inProgress: new WeakSet(),
    matchShapeLeafKeys: new WeakMap(),
    matchTargetLeafKeys: new WeakMap()
  }
}

/**
 * Per-process random seed so structural hashes cannot be precomputed against.
 * Created on first use: `globalThis.crypto` may be missing (Hermes without a polyfill) or throw
 * when read. Math.random fallback only weakens bucket-collision resistance, never correctness.
 */
let hashSeed: Uint32Array | undefined

function getHashSeed(): Uint32Array {
  if (hashSeed !== undefined) return hashSeed
  try {
    const c = globalThis.crypto as Partial<typeof globalThis.crypto> | undefined
    if (c && typeof c.getRandomValues === 'function') {
      hashSeed = c.getRandomValues(new Uint32Array(2))
      return hashSeed
    }
  } catch {
    // Throwing crypto getter / getRandomValues: fall through to Math.random.
  }
  hashSeed = new Uint32Array([
    (Math.random() * 0x100000000) >>> 0,
    (Math.random() * 0x100000000) >>> 0
  ])
  return hashSeed
}

/** Streaming 64-bit structural hash (two 32-bit multiply-xor lanes). Collisions only cost time. */
class StructuralHasher {
  #h1: number
  #h2: number

  constructor(label: string) {
    const seed = getHashSeed()
    this.#h1 = (0xdeadbeef ^ seed[0]) | 0
    this.#h2 = (0x41c6ce57 ^ seed[1]) | 0
    this.text(label)
  }

  #mix(code: number): void {
    this.#h1 = Math.imul(this.#h1 ^ code, 2654435761)
    this.#h2 = Math.imul(this.#h2 ^ code, 1597334677)
  }

  /** Mix a length-prefixed string, so adjacent fields cannot run together. */
  text(value: string): void {
    this.#mix(value.length)
    for (let i = 0; i < value.length; i++) this.#mix(value.charCodeAt(i))
  }

  /** Mix length-prefixed raw bytes. */
  bytes(value: Uint8Array): void {
    this.#mix(value.length)
    for (const byte of value) this.#mix(byte)
  }

  /** Fixed-size (16 hex chars) digest of everything mixed so far. */
  digest(): string {
    let h1 = this.#h1
    let h2 = this.#h2
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
  }
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

function bytesKey(v: Uint8Array): string {
  return Array.from(v, (b) => b.toString(16).padStart(2, '0')).join('')
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

function hashedInfo(token: string): NodeInfo {
  return { key: `H:${token}`, pure: false, hashed: true, token }
}

/** Exact leaf key, or a hashed key when the leaf alone exceeds the size limit. */
function leafInfo(label: string, key: string, pure: boolean): NodeInfo {
  if (key.length <= KEY_SIZE_LIMIT) return { key, pure, hashed: false, token: key }
  const hasher = new StructuralHasher(label)
  hasher.text(key)
  return hashedInfo(hasher.digest())
}

/**
 * Builds a composite key from child nodes while mixing their tokens into a structural hash.
 * Output length is tracked as parts are appended; once it passes the size limit no more parts
 * are kept (no huge string is ever built) and the result is a hashed key. The hash is a pure
 * function of the structure, so it is the same whether or not the exact key was kept.
 */
class CompositeBuilder {
  readonly #hasher: StructuralHasher
  readonly #parts: string[] = []
  #length = 0
  #overflow = false
  #pure = true

  constructor(label: string) {
    this.#hasher = new StructuralHasher(label)
  }

  /** Append `prefix + child.key` (prefix is also part of the hash). */
  add(prefix: string, child: NodeInfo): void {
    this.#hasher.text(prefix)
    this.#hasher.text(child.token)
    if (!child.pure) this.#pure = false
    if (this.#overflow) return
    if (child.hashed) {
      this.#overflow = true
      return
    }
    const part = prefix + child.key
    this.#length += part.length + 1
    if (this.#length > KEY_SIZE_LIMIT) {
      this.#overflow = true
      return
    }
    this.#parts.push(part)
  }

  finish(open: string, close: string): NodeInfo {
    const token = this.#hasher.digest()
    if (!this.#overflow) {
      const key = open + this.#parts.join(',') + close
      if (key.length <= KEY_SIZE_LIMIT) {
        return { key, pure: this.#pure, hashed: false, token }
      }
    }
    return hashedInfo(token)
  }
}

/** Key for a byte buffer: exact hex when small, hashed (streamed over the bytes) when large. */
function bufferInfo(label: string, prefix: string, data: Uint8Array): NodeInfo {
  const hasher = new StructuralHasher(label)
  hasher.bytes(data)
  const token = hasher.digest()
  if (prefix.length + data.length * 2 > KEY_SIZE_LIMIT) return hashedInfo(token)
  return { key: prefix + bytesKey(data), pure: false, hashed: false, token }
}

function accept(
  state: CanonicalKeySession,
  obj: object,
  info: NodeInfo | undefined
): NodeInfo | undefined {
  if (info === undefined) {
    state.failed.add(obj)
    return undefined
  }
  state.memo.set(obj, info)
  return info
}

function isBuiltinTypedArrayProto(proto: object): boolean {
  return TYPED_ARRAY_PROTOS.includes(proto)
}

function sortedByKey<T extends { kk: string }>(entries: T[]): T[] {
  return entries.sort((x, y) => (x.kk < y.kk ? -1 : x.kk > y.kk ? 1 : 0))
}

function canonicalKeyInner(value: unknown, state: CanonicalKeySession): NodeInfo | undefined {
  const prim = primitiveKey(value)
  if (prim !== undefined) return { key: prim, pure: true, hashed: false, token: prim }
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
    return accept(state, obj, leafInfo('Date', `Date:${String(time)}`, true))
  }
  if (obj instanceof RegExp) {
    if (Object.getPrototypeOf(obj) !== RegExp.prototype) return undefined
    return accept(state, obj, leafInfo('Re', `Re:${JSON.stringify(obj.source)}:${obj.flags}`, true))
  }

  const boxed = unboxed(obj)
  if (boxed !== NOT_BOXED) {
    // Boxed Number uses Object.is; other boxed primitives have no signed-zero issue.
    let bk: string | undefined
    if (typeof boxed === 'number') bk = boxedNumberKey(boxed)
    else bk = primitiveKey(boxed)
    if (bk === undefined) return undefined
    return accept(state, obj, leafInfo('box', `box:${tag}:${bk}`, false))
  }

  if (obj instanceof ArrayBuffer) {
    if (Object.getPrototypeOf(obj) !== ArrayBuffer.prototype) return undefined
    return accept(state, obj, bufferInfo('AB', 'AB:', bytes(obj)))
  }
  if (ArrayBuffer.isView(obj)) {
    const proto: unknown = Object.getPrototypeOf(obj)
    if (obj instanceof DataView) {
      if (proto !== DataView.prototype) return undefined
    } else if (typeof proto !== 'object' || proto === null || !isBuiltinTypedArrayProto(proto)) {
      return undefined
    }
    return accept(state, obj, bufferInfo(`view:${tag}`, `view:${tag}:`, bytes(obj)))
  }

  state.inProgress.add(obj)
  try {
    if (obj instanceof Map) {
      if (Object.getPrototypeOf(obj) !== Map.prototype) return undefined
      enterNesting()
      try {
        const entries: { kk: string; child: NodeInfo }[] = []
        for (const [k, v] of obj) {
          const kk = mapKeyPrimitive(k)
          if (kk === undefined) return accept(state, obj, undefined)
          const child = canonicalKeyInner(v, state)
          if (child === undefined) return accept(state, obj, undefined)
          entries.push({ kk, child })
        }
        const builder = new CompositeBuilder('Map')
        for (const { kk, child } of sortedByKey(entries)) builder.add(`${kk}=>`, child)
        const info = builder.finish('Map:{', '}')
        return accept(state, obj, { ...info, pure: false })
      } finally {
        exitNesting()
      }
    }

    if (obj instanceof Set) {
      if (Object.getPrototypeOf(obj) !== Set.prototype) return undefined
      enterNesting()
      try {
        const keys: string[] = []
        for (const v of obj) {
          const vk = mapKeyPrimitive(v)
          if (vk === undefined) return accept(state, obj, undefined)
          keys.push(vk)
        }
        const builder = new CompositeBuilder('Set')
        for (const vk of keys.toSorted()) {
          builder.add('', { key: vk, pure: true, hashed: false, token: vk })
        }
        const info = builder.finish('Set:{', '}')
        return accept(state, obj, { ...info, pure: false })
      } finally {
        exitNesting()
      }
    }

    if (Array.isArray(obj)) {
      const pt = protoTag(obj)
      if (pt === undefined) return undefined
      enterNesting()
      try {
        const builder = new CompositeBuilder(pt)
        if (isHugeSparse(obj)) {
          const flag = { failed: false }
          walkArray(obj, (ev) => {
            if (ev.kind !== 'value') return
            const child = canonicalKeyInner(obj[ev.index], state)
            if (child === undefined) {
              flag.failed = true
              return false
            }
            builder.add(`${String(ev.index)}:`, child)
          })
          if (flag.failed) return accept(state, obj, undefined)
        } else {
          for (const i of obj.keys()) {
            const child = canonicalKeyInner(obj[i], state)
            if (child === undefined) return accept(state, obj, undefined)
            builder.add('', child)
          }
        }
        return accept(state, obj, builder.finish(`${pt}[`, ']'))
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
      const builder = new CompositeBuilder(pt)
      for (const key of keys) {
        const child = canonicalKeyInner((obj as Record<string, unknown>)[key], state)
        if (child === undefined) return accept(state, obj, undefined)
        builder.add(`${JSON.stringify(key)}:`, child)
      }
      return accept(state, obj, builder.finish(`${pt}{`, '}'))
    } finally {
      exitNesting()
    }
  } finally {
    state.inProgress.delete(obj)
  }
}

/**
 * Canonical structural key plus purity and hashed flag, or `undefined` when the value cannot be
 * keyed to match deepEqual. Shared-reference DAGs whose tree-expanded key would exceed 64 KB get
 * a hashed key instead (see {@link CanonicalKeyInfo.hashed}): deepEqual-equal values hash equal,
 * unequal values may too, so a hashed key only groups candidates for pairwise `deepEqual`.
 * Pass one `session` across calls to key shared subtrees once.
 */
export function canonicalKeyInfo(
  value: unknown,
  session: CanonicalKeySession = createCanonicalKeySession()
): CanonicalKeyInfo | undefined {
  const info = guardNesting(() => canonicalKeyInner(value, session))
  if (info === undefined) return undefined
  return { key: info.key, pure: info.pure, hashed: info.hashed }
}

/**
 * Canonical structural key (a hashed key for oversized values), or `undefined` when the value
 * cannot be keyed to match deepEqual.
 */
export function canonicalKey(value: unknown): string | undefined {
  return canonicalKeyInfo(value)?.key
}
