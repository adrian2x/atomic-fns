import { withHookNesting } from '../internal/nesting.js'
import { deepMapEqual } from '../operators/equality.js'
import { deepEqual, protocol } from '../operators/index.js'
import { clone, rememberDeepClone } from './object.js'

/**
 * Collection equality: same constructor, same size, and pairwise `deepEqual` of the items in
 * iteration order. `deepEqual` ends the walk of a collection that contains itself.
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
  const ia = items(a)
  const ib = items(other)
  try {
    for (;;) {
      const x = ia.next()
      const y = ib.next()
      if (x.done || y.done) return Boolean(x.done) === Boolean(y.done)
      if (!deepEqual(x.value, y.value)) return false
    }
  } finally {
    ia.return?.()
    ib.return?.()
  }
}

/**
 * Set equality: same constructor, same size, every value of one is `has` in the other. For values
 * that `has` can compare exactly, such as strings.
 */
export function sameSetMembers<
  C extends object & { readonly size: number; has(value: unknown): boolean }
>(a: C, b: unknown, values: (collection: C) => Iterable<unknown>): boolean {
  if (a === b) return true
  if (typeof b !== 'object' || b?.constructor !== a.constructor) return false
  const other = b as C
  if (a.size !== other.size) return false
  for (const v of values(a)) {
    if (!other.has(v)) return false
  }
  return true
}

/**
 * Map equality: same constructor and the same entries under `deepEqual`, as for a native Map.
 * Built from `entries` so side-effecting `get` (e.g. LRUCache recency) is not invoked.
 */
function sameMapEntries<C extends object & { readonly size: number }>(
  a: C,
  b: unknown,
  entries: (collection: C) => Iterable<[unknown, unknown]>
): boolean {
  if (a === b) return true
  if (typeof b !== 'object' || b?.constructor !== a.constructor) return false
  return deepMapEqual(new Map(entries(a)), new Map(entries(b as C)))
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
  const ia = entries(a)
  const ib = entries(other)
  try {
    for (;;) {
      const x = ia.next()
      const y = ib.next()
      if (x.done || y.done) return Boolean(x.done) === Boolean(y.done)
      const [kx, vx] = x.value
      const [ky, vy] = y.value
      if (!deepEqual(kx, ky) || !deepEqual(vx, vy)) return false
    }
  } finally {
    ia.return?.()
    ib.return?.()
  }
}

abstract class BaseCollection {
  abstract get size(): number
  abstract clear(): void
  abstract get [Symbol.toStringTag](): string

  /** False when empty, as for Python collections. */
  [protocol.bool](): boolean {
    return this.size > 0
  }
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
   * When `deep` is true, an empty copy joins the clone memo first and {@link cloneInsert} fills it
   * with values deep-cloned via {@link clone}, so a cycle back here stays a cycle; otherwise the
   * copy is shallow.
   * Subclasses whose constructor needs more than the values override {@link cloneFrom}.
   */
  [protocol.clone](deep = false): this {
    return withHookNesting(() => {
      if (!deep) return this.cloneFrom(this.values())
      const copy = this.cloneFrom([])
      rememberDeepClone(this, copy)
      for (const value of this.values()) copy.cloneInsert(clone(value, true))
      return copy
    })
  }

  /**
   * Build a new instance of this collection's class from `values`. The default calls
   * `new this.constructor(values)`.
   */
  protected cloneFrom(values: Iterable<T>): this {
    return Reflect.construct(this.constructor, [values]) as this
  }

  /** Add `value` to a copy that {@link cloneFrom} built, after the values already there. */
  protected abstract cloneInsert(value: T): void
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
   * Same constructor and the same entries under `deepEqual` (order-independent).
   * Ordered map subclasses whose iteration order is part of equality override this.
   * Constructor arguments such as comparators are not compared.
   */
  [protocol.equals](other: unknown): boolean {
    return withHookNesting(() => sameMapEntries(this, other, (c) => c.entries()))
  }

  /**
   * New instance of the same class holding the same entries.
   * When `deep` is true, an empty copy joins the clone memo first and `set` fills it, with keys
   * kept by reference and values deep-cloned via {@link clone} (matching native Map deep clone),
   * so a cycle back here stays a cycle; otherwise the copy is shallow.
   * Subclasses whose constructor needs more than the entries override {@link cloneFrom}.
   */
  [protocol.clone](deep = false): this {
    return withHookNesting(() => {
      if (!deep) return this.cloneFrom(this.entries())
      const copy = this.cloneFrom([])
      rememberDeepClone(this, copy)
      for (const [key, value] of this.entries()) copy.set(key, clone(value, true))
      return copy
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
