/**
 * Deep multiset equality, shared by Heap items, Set members and Map entries.
 */

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

function primitiveHash(value: unknown): number {
  switch (typeof value) {
    case 'string':
      return hashString(value)
    case 'number':
      return (value | 0) === value ? value : hashString(String(value))
    case 'bigint':
      return Number(BigInt.asIntN(32, value))
    case 'boolean':
      return value ? 1 : 2
    default:
      return 0
  }
}

function hasHook(value: unknown): boolean {
  return hasMethod(value, protocol.equals) || hasMethod(value, protocol.compare)
}

/** Members in any order give one hash, because equal Sets and Maps need not agree on order. */
function membersHash(members: Map<unknown, unknown> | Set<unknown>, room: number): number {
  let sum = members.size
  if (members.size > room) return sum
  for (const [key, value] of members.entries()) {
    if (hasHook(key) || hasHook(value)) return HOOKED
    sum = (sum + mix(primitiveHash(key), primitiveHash(value))) | 0
  }
  return sum
}

/** Hash of `node` alone. Queues its children on `below`, in an order equal nodes agree on. */
function objectHash(node: object, room: number, below: unknown[]): number {
  const tag = Object.prototype.toString.call(node)
  let hash = hashString(tag)
  if (node instanceof Date) return mix(hash, primitiveHash(node.getTime()))
  if (node instanceof RegExp) return mix(hash, hashString(node.source))
  if (node instanceof ArrayBuffer || ArrayBuffer.isView(node)) return mix(hash, node.byteLength)
  if (node instanceof Map || node instanceof Set) {
    const members = membersHash(node, room)
    return members === HOOKED ? HOOKED : mix(hash, members)
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length && below.length < room; i++) below.push(node[i])
    return mix(hash, node.length)
  }
  if (tag !== '[object Object]') return hash

  const keys = Object.keys(node)
  hash = mix(hash, keys.length)
  if (below.length + keys.length > room) return hash
  for (const key of keys.sort()) {
    hash = mix(hash, hashString(key))
    below.push((node as Record<string, unknown>)[key])
  }
  return hash
}

/**
 * `deepEqual(a, b)` implies equal hashes unless one is {@link HOOKED}, as an item with a hook in
 * reach is: a hook can equal other kinds. Level by level, so an id counts before a deep subtree.
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
      if (hasHook(node)) return HOOKED
      const own =
        typeof node === 'object' && node !== null
          ? objectHash(node, room, below)
          : primitiveHash(node)
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
