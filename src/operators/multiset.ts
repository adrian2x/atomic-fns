/**
 * Deep multiset equality, shared by Heap items, Set members and Map entries.
 */

import { isDate, isError, isMap, isRegExp, isSet, unbox } from '../globals/brand.js'
import { isRank1 } from '../internal/rank1.js'
import { compare } from './order.js'
import { hasMethod, protocol } from './protocol.js'

/** Most nodes and levels one hash reads, so its cost does not grow with the item. */
const MAX_NODES = 32
const MAX_DEPTH = 4
/** Characters read from each end of a string. */
const STRING_SAMPLE = 16

/** Outside the 32-bit hash range: the group of items that can equal items of any other group. */
const HOOKED = 2 ** 32
const NONE = -1

/** What `deepEqual` compares an object by. `opaque` is identity only. */
export type Kind =
  | 'array'
  | 'boxed'
  | 'buffer'
  | 'date'
  | 'error'
  | 'keyed'
  | 'map'
  | 'opaque'
  | 'regexp'
  | 'set'
  | 'view'

const { SharedArrayBuffer: SharedBuffer } = globalThis as {
  SharedArrayBuffer?: SharedArrayBufferConstructor
}
const bufferPrototypes: object[] = [ArrayBuffer.prototype]
if (SharedBuffer !== undefined) bufferPrototypes.push(SharedBuffer.prototype)

function isBuffer(value: object, tag: string): boolean {
  if (tag !== '[object ArrayBuffer]' && tag !== '[object SharedArrayBuffer]') return false
  return bufferPrototypes.some((prototype) => {
    try {
      Reflect.getOwnPropertyDescriptor(prototype, 'byteLength')?.get?.call(value)
      return true
    } catch {
      return false
    }
  })
}

/** The {@link Kind} of `value`, from internal slots, so it holds across realms. */
export function kindOf(value: object): Kind {
  if (Array.isArray(value)) return 'array'
  const tag = Object.prototype.toString.call(value)
  const keyed = tag === '[object Object]' || tag === '[object Arguments]'
  if (keyed && !(Symbol.toStringTag in value)) return 'keyed'
  if (ArrayBuffer.isView(value)) return 'view'
  if (isDate(value)) return 'date'
  if (isRegExp(value)) return 'regexp'
  if (isMap(value)) return 'map'
  if (isSet(value)) return 'set'
  if (isError(value)) return 'error'
  if (isBuffer(value, tag)) return 'buffer'
  if (unbox(value) !== value) return 'boxed'
  return keyed ? 'keyed' : 'opaque'
}

/** The bytes of a buffer or view. A detached or out-of-bounds one has none. */
export function bytesOf(value: ArrayBuffer | SharedArrayBuffer | ArrayBufferView): Uint8Array {
  try {
    return ArrayBuffer.isView(value)
      ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      : new Uint8Array(value)
  } catch {
    return new Uint8Array(0)
  }
}

function mix(hash: number, value: number): number {
  return Math.imul(hash ^ value, 0x01000193)
}

function hashString(text: string): number {
  const head = Math.min(text.length, STRING_SAMPLE)
  const tail = Math.max(head, text.length - STRING_SAMPLE)
  let hash = text.length
  for (let i = 0; i < head; i++) hash = mix(hash, text.charCodeAt(i))
  for (let i = tail; i < text.length; i++) hash = mix(hash, text.charCodeAt(i))
  return hash
}

function numberHash(value: number): number {
  return (value | 0) === value ? value : hashString(String(value))
}

function hasHook(value: unknown): boolean {
  return hasMethod(value, protocol.equals) || hasMethod(value, protocol.compare)
}

/** Rank-1 values hash by `Number`: `eq` across kinds implies the same one. */
function hookHash(value: object): number {
  const { toNumber } = value as { toNumber?: unknown }
  if (!isRank1(value) || typeof toNumber !== 'function') return HOOKED
  return numberHash(Number(toNumber.call(value)))
}

function scalarHash(value: unknown): number {
  switch (typeof value) {
    case 'string':
      return hashString(value)
    case 'number':
      return numberHash(value)
    case 'bigint':
      return numberHash(Number(value))
    case 'boolean':
      return value ? 1 : 2
    default:
      return hasHook(value) ? hookHash(value as object) : 0
  }
}

/** Members in any order give one hash, because equal Sets and Maps need not agree on order. */
function membersHash(members: Map<unknown, unknown> | Set<unknown>, room: number): number {
  let sum = members.size
  if (members.size > room) return sum
  for (const [key, value] of members.entries()) {
    const [keyHash, valueHash] = [scalarHash(key), scalarHash(value)]
    if (keyHash === HOOKED || valueHash === HOOKED) return HOOKED
    sum = (sum + mix(keyHash, valueHash)) | 0
  }
  return sum
}

/** Hash of `node` alone. Queues its children on `below`, in an order equal nodes agree on. */
function objectHash(node: object, room: number, below: unknown[]): number {
  const kind = kindOf(node)
  let hash = hashString(kind)
  switch (kind) {
    case 'date':
      return mix(hash, numberHash((node as Date).getTime()))
    case 'regexp':
      return mix(hash, hashString((node as RegExp).source))
    case 'buffer':
    case 'view':
      return mix(hash, bytesOf(node as ArrayBufferView).length)
    case 'map':
    case 'set': {
      const members = membersHash(node as Set<unknown>, room)
      return members === HOOKED ? HOOKED : mix(hash, members)
    }
    case 'array': {
      const array = node as unknown[]
      for (let i = 0; i < array.length && below.length < room; i++) below.push(array[i])
      return mix(hash, array.length)
    }
    case 'keyed': {
      const keys = Object.keys(node)
      hash = mix(hash, keys.length)
      if (below.length + keys.length > room) return hash
      for (const key of keys.sort()) {
        hash = mix(hash, hashString(key))
        below.push((node as Record<string, unknown>)[key])
      }
      return hash
    }
    default:
      return hash
  }
}

/**
 * `deepEqual(a, b)` implies equal hashes unless one is {@link HOOKED}, as an item with a hook of no
 * numeric identity in reach is: a hook can equal other kinds. Level by level, so an id counts before
 * a deep subtree.
 */
function structuralHash(item: unknown): number {
  let hash = 0
  let room = MAX_NODES
  let level = [item]
  for (let depth = 0; depth < MAX_DEPTH && level.length > 0; depth++) {
    const below: unknown[] = []
    for (const node of level) {
      if (room === 0) return hash
      room--
      const walkable = typeof node === 'object' && node !== null && !hasHook(node)
      const own = walkable ? objectHash(node, room, below) : scalarHash(node)
      if (own === HOOKED) return HOOKED
      hash = mix(hash, own)
    }
    level = below
  }
  return hash
}

function addTo(groups: Map<number, number[]>, hash: number, index: number): void {
  const group = groups.get(hash)
  if (group === undefined) groups.set(hash, [index])
  else group.push(index)
}

/** A bipartite matching between two lists, grown until it is perfect or provably cannot be. */
class Matching<T> {
  readonly #a: readonly T[]
  readonly #b: readonly T[]
  readonly #equal: (x: T, y: T) => boolean
  readonly #partnerOfA: Int32Array
  readonly #partnerOfB: Int32Array
  #hashA: number[] = []
  #hashB: number[] = []
  /** Items of `b` by hash. */
  readonly #groups = new Map<number, number[]>()
  /** Unpaired items of `b` by hash. A group leaves once it is empty. */
  readonly #free = new Map<number, number[]>()

  constructor(a: readonly T[], b: readonly T[], equal: (x: T, y: T) => boolean) {
    this.#a = a
    this.#b = b
    this.#equal = equal
    this.#partnerOfA = new Int32Array(a.length).fill(NONE)
    this.#partnerOfB = new Int32Array(b.length).fill(NONE)
  }

  isPerfect(): boolean {
    this.#pairIdentical()
    if (!this.#partnerOfA.includes(NONE)) return true
    this.#hashA = this.#a.map((item) => structuralHash(item))
    this.#hashB = this.#b.map((item) => structuralHash(item))
    this.#pairSameIndex()
    this.#pairHookedInOrder()
    this.#hashB.forEach((hash, j) => {
      addTo(this.#groups, hash, j)
      if (this.#partnerOfB[j] === NONE) addTo(this.#free, hash, j)
    })
    return this.#unpaired(this.#partnerOfA).every((i) => this.#augment(i))
  }

  #pair(i: number, j: number): void {
    this.#partnerOfA[i] = j
    this.#partnerOfB[j] = i
  }

  #unpaired(partners: Int32Array): number[] {
    return Array.from(partners.keys()).filter((index) => partners[index] === NONE)
  }

  /** Primitives and shared references need no comparison. A later step may still re-pair them. */
  #pairIdentical(): void {
    const first = new Map<T, number>()
    const next = new Int32Array(this.#b.length)
    for (let j = this.#b.length - 1; j >= 0; j--) {
      next[j] = first.get(this.#b[j]) ?? NONE
      first.set(this.#b[j], j)
    }
    for (let i = 0; i < this.#a.length; i++) {
      const j = first.get(this.#a[i]) ?? NONE
      if (j === NONE) continue
      first.set(this.#a[i], next[j])
      this.#pair(i, j)
    }
  }

  #pairSameIndex(): void {
    for (const i of this.#unpaired(this.#partnerOfA)) {
      const related =
        this.#hashA[i] === this.#hashB[i] || this.#hashA[i] === HOOKED || this.#hashB[i] === HOOKED
      if (this.#partnerOfB[i] === NONE && related && this.#equal(this.#a[i], this.#b[i])) {
        this.#pair(i, i)
      }
    }
  }

  /** Hooked items share one group, so a walk in `compare` order keeps them from pairing all-to-all. */
  #pairHookedInOrder(): void {
    const hooked = (items: readonly T[], partners: Int32Array, hashes: number[]): number[] =>
      this.#unpaired(partners)
        .filter((index) => hashes[index] === HOOKED)
        .sort((x, y) => compare(items[x], items[y]))
    const left = hooked(this.#a, this.#partnerOfA, this.#hashA)
    const right = hooked(this.#b, this.#partnerOfB, this.#hashB)
    let p = 0
    let q = 0
    while (p < left.length && q < right.length) {
      const [i, j] = [left[p], right[q]]
      const order = compare(this.#a[i], this.#b[j])
      if (order <= 0) p++
      if (order >= 0) q++
      if (order === 0 && this.#equal(this.#a[i], this.#b[j])) this.#pair(i, j)
    }
  }

  #groupsFor(i: number, groups: Map<number, number[]>): Iterable<number> {
    return this.#hashA[i] === HOOKED ? groups.keys() : [this.#hashA[i], HOOKED]
  }

  #takeFree(i: number): number {
    for (const hash of this.#groupsFor(i, this.#free)) {
      const group = this.#free.get(hash) ?? []
      const at = group.findIndex((j) => this.#equal(this.#a[i], this.#b[j]))
      if (at === NONE) continue
      const j = group[at]
      group[at] = group[group.length - 1]
      group.pop()
      if (group.length === 0) this.#free.delete(hash)
      return j
    }
    return NONE
  }

  /**
   * Pair `start`, moving earlier pairs along an alternating path when no free partner is left. A
   * hook need not be transitive and an assumed pair may fail, so a greedy `false` would not be exact.
   */
  #augment(start: number): boolean {
    const reachedFrom: number[] = []
    const queue = [start]
    let unseen: Map<number, number[]> | undefined
    for (const i of queue) {
      const free = this.#takeFree(i)
      if (free !== NONE) {
        this.#flip(i, free, reachedFrom)
        return true
      }
      unseen ??= new Map(this.#groups)
      for (const hash of this.#groupsFor(i, unseen)) {
        const rest = (unseen.get(hash) ?? []).filter((j) => {
          const partner = this.#partnerOfB[j]
          if (partner === NONE || !this.#equal(this.#a[i], this.#b[j])) return true
          reachedFrom[j] = i
          queue.push(partner)
          return false
        })
        if (rest.length === 0) unseen.delete(hash)
        else unseen.set(hash, rest)
      }
    }
    return false
  }

  #flip(last: number, free: number, reachedFrom: number[]): void {
    let i = last
    let j = free
    for (;;) {
      const displaced = this.#partnerOfA[i]
      this.#pair(i, j)
      if (displaced === NONE) return
      j = displaced
      i = reachedFrom[j]
    }
  }
}

/**
 * Whether every item of `a` can take its own partner in `b` under `equal`, which need not be
 * transitive. `equal` must bound the work: items no bounded hash can tell apart pair all-to-all.
 */
export function multisetEqual<T>(
  a: readonly T[],
  b: readonly T[],
  equal: (x: T, y: T) => boolean
): boolean {
  return a.length === b.length && new Matching(a, b, equal).isPerfect()
}
