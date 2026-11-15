import { enumerableKeys, ERROR_LOCATION_KEYS } from '../internal/keys.ts'
import { bytesOf, contentKindOf, isFloatView, typedArrayName, unbox } from '../internal/kind.ts'
import { walkArrayIndices } from '../internal/sparse.ts'
import { hashString } from './hashString.ts'

/** Levels below the root a hash reads; deeper structure counts only by its kind. */
const UNFOLD_DEPTH = 8

/** Past this many objects a hash stops remembering them; only time grows, not memory. */
const MAX_TRACKED_OBJECTS = 2 ** 24

/** Seeds that keep the hash of one kind apart from another's. */
const Tag = {
  Undefined: 4097,
  Null: 4098,
  True: 4099,
  False: 4100,
  NaN: 4101,
  Number: 4102,
  BigInt: 4103,
  String: 4104,
  Symbol: 4105,
  Plain: 4106,
  Array: 4107,
  Map: 4108,
  Set: 4109,
  Date: 4110,
  RegExp: 4111,
  Buffer: 4112,
  View: 4113,
  Boxed: 4114,
  Error: 4115,
  Arguments: 4116,
  NoCause: 4117
} as const

function mix(state: number, value: number): number {
  const h = Math.imul(state ^ value, 0x5bd1e995)
  return h ^ (h >>> 15)
}

function finish(state: number): number {
  let h = state ^ (state >>> 16)
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

function canHoldSymbols(): boolean {
  try {
    new WeakMap<WeakKey, number>().set(Symbol(), 0)
    return true
  } catch {
    return false
  }
}

const ids = new WeakMap<WeakKey, number>()
const symbolsAreWeakKeys = canHoldSymbols()
let nextId = 1

function identityOf(value: WeakKey): number {
  let id = ids.get(value)
  if (id === undefined) ids.set(value, (id = nextId++))
  return id
}

/**
 * A registered symbol by its key; any other by identity where the runtime can hold it weakly, and
 * by its description where it cannot, so that hashing never keeps a symbol alive.
 */
function symbolHash(value: symbol): number {
  const key = Symbol.keyFor(value)
  if (key !== undefined) return mix(Tag.Symbol, hashString(key))
  if (!symbolsAreWeakKeys) return mix(Tag.Symbol, hashString(value.description ?? ''))
  return mix(Tag.Symbol, identityOf(value))
}

/** By SameValueZero: `0` and `-0` share a hash, and so do all NaNs. */
function numberHash(value: number): number {
  if (value !== value) return Tag.NaN
  return mix(Tag.Number, hashString(String(value === 0 ? 0 : value)))
}

/** Hash of a value compared by SameValueZero: a primitive by value, an object by identity. */
function memberHash(value: unknown): number {
  switch (typeof value) {
    case 'undefined':
      return Tag.Undefined
    case 'boolean':
      return value ? Tag.True : Tag.False
    case 'number':
      return numberHash(value)
    case 'bigint':
      return mix(Tag.BigInt, hashString(value.toString(16)))
    case 'string':
      return mix(Tag.String, hashString(value))
    case 'symbol':
      return symbolHash(value)
    default:
      return value === null ? Tag.Null : identityOf(value as object)
  }
}

function bytesHash(bytes: Uint8Array): number {
  let state = bytes.length
  for (const byte of bytes) state = mix(state, byte)
  return state
}

/** What a container hashes to once the levels a hash reads run out. */
const CONTAINER_TAGS = {
  plain: Tag.Plain,
  array: Tag.Array,
  arguments: Tag.Arguments,
  map: Tag.Map,
  error: Tag.Error
} as const

/** One `hash` call: hashes of shared objects, by how many levels were left below them. */
class Unfolding {
  readonly #memo = new Map<object, (number | undefined)[]>()

  of(value: unknown, levels: number): number {
    if (typeof value !== 'object' || value === null) return memberHash(value)
    let byLevel = this.#memo.get(value)
    const known = byLevel?.[levels]
    if (known !== undefined) return known
    const hashed = this.#object(value, levels)
    if (byLevel === undefined && this.#memo.size < MAX_TRACKED_OBJECTS) {
      this.#memo.set(value, (byLevel = []))
    }
    if (byLevel !== undefined) byLevel[levels] = hashed
    return hashed
  }

  #object(value: object, levels: number): number {
    const kind = contentKindOf(value)
    switch (kind) {
      case 'other':
        return identityOf(value)
      case 'set': {
        let sum = 0
        for (const v of Set.prototype.values.call(value)) sum = (sum + finish(memberHash(v))) | 0
        return mix(mix(Tag.Set, (value as Set<unknown>).size), sum)
      }
      case 'date':
        return mix(Tag.Date, numberHash(Date.prototype.getTime.call(value)))
      case 'regexp':
        return mix(
          mix(Tag.RegExp, hashString((value as RegExp).source)),
          hashString((value as RegExp).flags)
        )
      case 'buffer':
        return mix(Tag.Buffer, bytesHash(bytesOf(value as ArrayBuffer)))
      case 'view':
        return this.#view(value as ArrayBufferView)
      case 'boxed':
        return mix(Tag.Boxed, memberHash(unbox(value)))
      default:
        return levels === 0 ? CONTAINER_TAGS[kind] : this.#container(value, kind, levels - 1)
    }
  }

  /** The kinds that hold other values, read one level further down. */
  #container(value: object, kind: keyof typeof CONTAINER_TAGS, below: number): number {
    switch (kind) {
      case 'plain':
        return this.#record(value, below)
      case 'array':
        return this.#array(value as unknown[], below, Tag.Array)
      case 'arguments':
        return this.#array(value as unknown as unknown[], below, Tag.Arguments)
      case 'map': {
        let sum = 0
        for (const [k, v] of Map.prototype.entries.call(value)) {
          sum = (sum + finish(mix(memberHash(k), this.of(v, below)))) | 0
        }
        return mix(mix(Tag.Map, (value as Map<unknown, unknown>).size), sum)
      }
      case 'error':
        return this.#error(value as Error, below)
    }
  }

  /** Name, message, an own `cause` and own enumerable properties, as `isEqual` compares errors. */
  #error(value: Error, below: number): number {
    const cause = Object.hasOwn(value, 'cause') ? this.of(value.cause, below) : Tag.NoCause
    let state = mix(Tag.Error, this.of(value.name, below))
    state = mix(mix(state, this.of(value.message, below)), cause)
    return mix(state, this.#record(value, below, ERROR_LOCATION_KEYS))
  }

  #record(value: object, below: number, ignored?: ReadonlySet<PropertyKey>): number {
    const record = value as Record<PropertyKey, unknown>
    let sum = 0
    let count = 0
    for (const key of enumerableKeys(value)) {
      if (ignored?.has(key)) continue
      sum = (sum + finish(mix(memberHash(key), this.of(record[key], below)))) | 0
      count++
    }
    return mix(mix(Tag.Plain, count), sum)
  }

  /** `undefined` and holes add nothing, since `isEqual` takes a hole to equal `undefined`. */
  #array(value: unknown[], below: number, tag: number): number {
    let sum = 0
    let i = 0
    for (; i < value.length && i in value; i++) {
      const item = value[i]
      if (item !== undefined) sum = (sum + finish(mix(i, this.of(item, below)))) | 0
    }
    if (i === value.length) return mix(mix(tag, value.length), sum)
    walkArrayIndices(value, (ev) => {
      if (ev.kind !== 'index' || ev.index < i) return
      const item = value[ev.index]
      if (item !== undefined) sum = (sum + finish(mix(ev.index, this.of(item, below)))) | 0
    })
    return mix(mix(tag, value.length), sum)
  }

  #view(value: ArrayBufferView): number {
    const tag = mix(Tag.View, hashString(typedArrayName(value) ?? 'DataView'))
    if (!isFloatView(value)) return mix(tag, bytesHash(bytesOf(value)))
    const floats = value as Float64Array
    const length = floats.length
    let state = mix(tag, length)
    for (let i = 0; i < length; i++) state = mix(state, numberHash(floats[i]))
    return state
  }
}

/**
 * Structural hash, consistent with `isEqual`: whenever `isEqual(a, b)` is true, `hash(a)` equals
 * `hash(b)`, so values can be bucketed before they are compared. It reads the kinds `isEqual`
 * compares by content (plain objects, arrays, `Map`, `Set`, Dates, RegExps, buffers, typed arrays,
 * boxed primitives, errors, `arguments`), key order aside; class instances, functions,
 * unregistered symbols and `Map` keys or `Set` members that are objects hash by identity, which
 * holds only for the life of the process. Not cryptographic, and not resistant to keys crafted to
 * collide.
 *
 * It reads at most 8 levels below the root, and structure deeper than that counts only by its
 * kind. So cyclic values that `isEqual` equates hash alike, and `hash`, unlike the other deep walks,
 * never throws on deep input.
 * @param value Any value.
 * @returns An unsigned 32-bit integer.
 * @example
 * ```ts
 * hash({ a: [1, 2], b: 'x' }) === hash({ b: 'x', a: [1, 2] }) // true
 * hash(new Map([[1, NaN]])) === hash(new Map([[1, NaN]])) // true
 * hash(0) === hash(-0) // true
 * ```
 */
export function hash(value: unknown): number {
  if (typeof value !== 'object' || value === null) return finish(memberHash(value))
  return finish(new Unfolding().of(value, UNFOLD_DEPTH))
}
