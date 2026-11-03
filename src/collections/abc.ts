import { withHookNesting } from '../internal/nesting.js'
import { deepEqual, protocol } from '../operators/index.js'
import { clone } from './object.js'

/** Pairs `(a, b)` whose `equals` is running, so a collection that contains itself terminates. */
const comparing = new WeakMap<object, Set<object>>()

function beginCompare(a: object, b: object): boolean {
  let partners = comparing.get(a)
  if (partners?.has(b)) return true
  if (partners === undefined) {
    partners = new Set()
    comparing.set(a, partners)
  }
  partners.add(b)
  return false
}

function endCompare(a: object, b: object): void {
  comparing.get(a)?.delete(b)
}

/**
 * Collection equality: same constructor, same size, and pairwise `deepEqual` of the items in
 * iteration order. A pair already being compared is treated as equal.
 */
function sameItems<C extends object & { readonly size: number }>(
  a: C,
  b: unknown,
  items: (collection: C) => Iterator<unknown>
): boolean {
  if (a === b) return true
  if (typeof b !== 'object' || b?.constructor !== a.constructor) return false
  const other = b as C
  if (a.size !== other.size) return false
  if (beginCompare(a, other)) return true
  try {
    const ia = items(a)
    const ib = items(other)
    for (;;) {
      const x = ia.next()
      const y = ib.next()
      if (x.done || y.done) return Boolean(x.done) === Boolean(y.done)
      if (!deepEqual(x.value, y.value)) return false
    }
  } finally {
    endCompare(a, other)
  }
}

/**
 * Set equality: same constructor, same size, every value of one is `has` in the other.
 */
export function sameSetMembers<
  C extends object & { readonly size: number; has(value: unknown): boolean }
>(a: C, b: unknown, values: (collection: C) => Iterable<unknown>): boolean {
  if (a === b) return true
  if (typeof b !== 'object' || b?.constructor !== a.constructor) return false
  const other = b as C
  if (a.size !== other.size) return false
  if (beginCompare(a, other)) return true
  try {
    for (const v of values(a)) {
      if (!other.has(v)) return false
    }
    return true
  } finally {
    endCompare(a, other)
  }
}

/**
 * Map equality: same constructor, same size, every key present, values `deepEqual`.
 * Built from `entries` so side-effecting `get` (e.g. LRUCache recency) is not invoked.
 */
function sameMapEntries<C extends object & { readonly size: number }>(
  a: C,
  b: unknown,
  entries: (collection: C) => Iterable<[unknown, unknown]>
): boolean {
  if (a === b) return true
  if (typeof b !== 'object' || b?.constructor !== a.constructor) return false
  const other = b as C
  if (a.size !== other.size) return false
  if (beginCompare(a, other)) return true
  try {
    const otherMap = new Map(entries(other))
    for (const [k, v] of entries(a)) {
      if (!otherMap.has(k)) return false
      if (!deepEqual(v, otherMap.get(k))) return false
    }
    return true
  } finally {
    endCompare(a, other)
  }
}

/** Sequence equality helper for ordered collections (Deque, SortedMap, SortedSet, BTree). */
export function sameSequenceItems<C extends object & { readonly size: number }>(
  a: C,
  b: unknown,
  items: (collection: C) => Iterator<unknown>
): boolean {
  return sameItems(a, b, items)
}

/**
 * Ordered map entry-sequence equality without boxing each pair as an array (avoids an extra
 * nesting charge per entry so self-nested SortedMaps hit the documented 125-level hook cap).
 */
export function sameEntrySequence<C extends object & { readonly size: number }>(
  a: C,
  b: unknown,
  entries: (collection: C) => Iterator<[unknown, unknown]>
): boolean {
  if (a === b) return true
  if (typeof b !== 'object' || b?.constructor !== a.constructor) return false
  const other = b as C
  if (a.size !== other.size) return false
  if (beginCompare(a, other)) return true
  try {
    const ia = entries(a)
    const ib = entries(other)
    for (;;) {
      const x = ia.next()
      const y = ib.next()
      if (x.done || y.done) return Boolean(x.done) === Boolean(y.done)
      const [kx, vx] = x.value
      const [ky, vy] = y.value
      if (!deepEqual(kx, ky) || !deepEqual(vx, vy)) return false
    }
  } finally {
    endCompare(a, other)
  }
}

abstract class BaseCollection {
  abstract get size(): number
  abstract clear(): void
  abstract get [Symbol.toStringTag](): string
}

/**
 * Set-like collection base: iteration yields values.
 * `K` is the key type for `keys`/`entries`/`forEach` (defaults to `T`; Deque uses indices).
 */
export abstract class SetCollection<T, K = T> extends BaseCollection implements Iterable<T> {
  abstract has(value: T): boolean
  abstract values(): IteratorObject<T>
  abstract keys(): IteratorObject<K>
  abstract entries(): IteratorObject<[K, T]>

  forEach(cb: (value: T, key: K, coll: this) => void, thisArg?: unknown): void {
    for (const [k, v] of this.entries()) {
      cb.call(thisArg, v, k, this)
    }
  }

  [Symbol.iterator](): IteratorObject<T> {
    return this.values()
  }

  /**
   * Same constructor, same size, and pairwise `deepEqual` of the values in iteration order
   * (order is part of equality for ordered collections such as Deque and SortedSet).
   * Constructor arguments such as comparators are not compared.
   */
  [protocol.equals](other: unknown): boolean {
    return withHookNesting(() => sameItems(this, other, (c) => c.values()))
  }

  /**
   * New instance of the same class holding the same values in iteration order.
   * When `deep` is true, values are deep-cloned via {@link clone}; otherwise the copy is shallow.
   * Subclasses whose constructor needs more than the values override {@link cloneFrom}.
   */
  [protocol.clone](deep = false): this {
    return withHookNesting(() => {
      if (!deep) return this.cloneFrom(this.values())
      return this.cloneFrom([...this.values()].map((v) => clone(v, true)))
    })
  }

  /**
   * Build a new instance of this collection's class from `values`. The default calls
   * `new this.constructor(values)`.
   */
  protected cloneFrom(values: Iterable<T>): this {
    return Reflect.construct(this.constructor, [values]) as this
  }
}

/**
 * Set-like collection whose keys are the values (`K = T`), matching `Set` semantics.
 */
export abstract class ValueCollection<T> extends SetCollection<T, T> {
  keys(): IteratorObject<T> {
    return this.values()
  }

  entries(): IteratorObject<[T, T]> {
    return this.values().map((v): [T, T] => [v, v])
  }
}

/**
 * Map-like collection base: iteration yields entries.
 */
export abstract class MapCollection<K, V> extends BaseCollection implements Iterable<[K, V]> {
  abstract has(key: K): boolean
  abstract get(key: K): V | undefined
  abstract set(key: K, value: V): this
  abstract delete(key: K): boolean
  abstract keys(): IteratorObject<K>
  abstract values(): IteratorObject<V>
  abstract entries(): IteratorObject<[K, V]>

  forEach(cb: (value: V, key: K, coll: this) => void, thisArg?: unknown): void {
    for (const [k, v] of this.entries()) {
      cb.call(thisArg, v, k, this)
    }
  }

  [Symbol.iterator](): IteratorObject<[K, V]> {
    return this.entries()
  }

  /**
   * Same constructor, same size, every key present, values `deepEqual` (order-independent).
   * Ordered map subclasses whose iteration order is part of equality override this.
   * Constructor arguments such as comparators are not compared.
   */
  [protocol.equals](other: unknown): boolean {
    return withHookNesting(() => sameMapEntries(this, other, (c) => c.entries()))
  }

  /**
   * New instance of the same class holding the same entries.
   * When `deep` is true, keys are kept by reference and values are deep-cloned via {@link clone}
   * (matching native Map deep clone); otherwise the copy is shallow.
   * Subclasses whose constructor needs more than the entries override {@link cloneFrom}.
   */
  [protocol.clone](deep = false): this {
    return withHookNesting(() => {
      if (!deep) return this.cloneFrom(this.entries())
      return this.cloneFrom([...this.entries()].map(([k, v]): [K, V] => [k, clone(v, true)]))
    })
  }

  /**
   * Build a new instance of this collection's class from `entries`. The default calls
   * `new this.constructor(entries)`.
   */
  protected cloneFrom(entries: Iterable<[K, V]>): this {
    return Reflect.construct(this.constructor, [entries]) as this
  }
}
