/**
 * Deep multiset equality, shared by Heap items, Set members and Map entries.
 */

import { isDate, isError, isMap, isRegExp, isSet, unbox } from '../globals/brand.js'
import { isRank1 } from '../internal/rank1.js'
import { hasMethod, protocol, unitOf } from './protocol.js'

/** Most nodes and levels one hash reads, so its cost does not grow with the item. */
const MAX_NODES = 32
const MAX_DEPTH = 4
/** Characters read from each end of a string. */
const STRING_SAMPLE = 16

/** Outside the 32-bit hash range: the group of items that can equal items of any other group. */
const HOOKED = 2 ** 32
const NONE = -1

/** What `deepEqual` compares an object by. `opaque` is identity only. */
export type Kind = ReturnType<typeof kindOf>

/** The {@link Kind} of `value`, from internal slots, so it holds across realms. */
export function kindOf(value: object) {
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
  if (tag === '[object ArrayBuffer]' || tag === '[object SharedArrayBuffer]') return 'buffer'
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

/** By `Number`, which numbers of any kind share when equal, and by unit, which they must share. */
function numericHash(value: number, unit = ''): number {
  return mix(hashString(unit), (value | 0) === value ? value : hashString(String(value)))
}

function hasHook(value: unknown): boolean {
  return hasMethod(value, protocol.equals) || hasMethod(value, protocol.compare)
}

function hookHash(value: object): number {
  const { toNumber, [protocol.rank]: rank } = value as {
    toNumber?: unknown
    [protocol.rank]?: unknown
  }
  if (rank === 5) return numericHash(Number(value))
  if (!isRank1(value) || typeof toNumber !== 'function') return HOOKED
  return numericHash(Number(toNumber.call(value)), unitOf(value))
}

function scalarHash(value: unknown): number {
  switch (typeof value) {
    case 'string':
      return hashString(value)
    case 'number':
      return numericHash(value)
    case 'bigint':
      return numericHash(Number(value))
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
      return numericHash((node as Date).getTime())
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

/**
 * Whether every item of `a` can take its own partner in `b` under `equal`, which must bound the
 * work: items no bounded hash can tell apart pair all-to-all.
 */
export function multisetEqual<T>(
  a: readonly T[],
  b: readonly T[],
  equal: (x: T, y: T) => boolean
): boolean {
  if (a.length !== b.length) return false
  const partnerOfA = new Int32Array(a.length).fill(NONE)
  const partnerOfB = new Int32Array(b.length).fill(NONE)
  const pair = (i: number, j: number): void => {
    partnerOfA[i] = j
    partnerOfB[j] = i
  }
  const unpaired = (partners: Int32Array): number[] =>
    Array.from(partners.keys()).filter((index) => partners[index] === NONE)

  const identical = Map.groupBy(b.keys(), (j) => b[j])
  a.forEach((item, i) => {
    const j = identical.get(item)?.pop()
    if (j !== undefined) pair(i, j)
  })
  const open = unpaired(partnerOfA)
  if (open.length === 0) return true

  const hashA = a.map((item) => structuralHash(item))
  const hashB = b.map((item) => structuralHash(item))
  const byHash = (j: number): number => hashB[j]
  const groups = Map.groupBy(hashB.keys(), byHash)
  // Last index first: lists in the same order pair at the first try.
  const free = Map.groupBy(unpaired(partnerOfB).reverse(), byHash)
  const groupsFor = (i: number, within: Map<number, number[]>): Iterable<number> =>
    hashA[i] === HOOKED ? within.keys() : [hashA[i], HOOKED]

  const takeFree = (i: number): number => {
    for (const hash of groupsFor(i, free)) {
      const group = free.get(hash) ?? []
      const at = group.findLastIndex((j) => equal(a[i], b[j]))
      if (at === NONE) continue
      const [j] = group.splice(at, 1)
      if (group.length === 0) free.delete(hash)
      return j
    }
    return NONE
  }

  /**
   * Pair `start`, moving earlier pairs along an alternating path when no free partner is left. A
   * pair that held only under a failing assumption can spend the partner another item needs, and a
   * session remembers a false for good, so a false must not depend on that.
   */
  const augment = (start: number): boolean => {
    const reachedFrom: number[] = []
    const queue = [start]
    let unseen: Map<number, number[]> | undefined
    for (const i of queue) {
      let j = takeFree(i)
      for (let owner = i; j !== NONE; owner = reachedFrom[j]) {
        const displaced = partnerOfA[owner]
        pair(owner, j)
        if (displaced === NONE) return true
        j = displaced
      }
      unseen ??= new Map(groups)
      for (const hash of groupsFor(i, unseen)) {
        const rest = (unseen.get(hash) ?? []).filter((taken) => {
          const partner = partnerOfB[taken]
          if (partner === NONE || !equal(a[i], b[taken])) return true
          reachedFrom[taken] = i
          queue.push(partner)
          return false
        })
        if (rest.length === 0) unseen.delete(hash)
        else unseen.set(hash, rest)
      }
    }
    return false
  }

  return open.every(augment)
}
