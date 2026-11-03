import { deepEqual, protocol } from '../operators/index.js'

/** Pairs `(a, b)` whose `equals` is running, so a collection that contains itself terminates. */
const comparing = new WeakMap<object, Set<object>>()

/**
 * Collection equality: same constructor, same size, and pairwise `deepEqual` of the items in
 * iteration order. A pair already being compared is treated as equal.
 */
function sameItems<C extends { readonly size: number }>(
  a: C,
  b: unknown,
  items: (collection: C) => Iterator<unknown>
): boolean {
  if (a === b) return true
  if (typeof b !== 'object' || b?.constructor !== a.constructor) return false
  const other = b as C
  if (a.size !== other.size) return false
  let partners = comparing.get(a)
  if (partners?.has(other)) return true
  if (partners === undefined) {
    partners = new Set()
    comparing.set(a, partners)
  }
  partners.add(other)
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
    partners.delete(other)
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
   * Same constructor, same size, and pairwise `deepEqual` of the values in iteration order.
   * Constructor arguments such as comparators are not compared.
   */
  [protocol.equals](other: unknown): boolean {
    return sameItems(this, other, (c) => c.values())
  }

  /**
   * New instance of the same class holding the same values in iteration order. The copy is
   * shallow. Subclasses whose constructor needs more than the values override
   * {@link cloneFrom}.
   */
  [protocol.clone](): this {
    return this.cloneFrom(this.values())
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
    return Iterator.from(this.#entryPairs())
  }

  *#entryPairs(): Generator<[T, T]> {
    for (const v of this.values()) yield [v, v]
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
   * Same constructor, same size, and pairwise `deepEqual` of the entries in iteration order.
   * Constructor arguments such as comparators are not compared.
   */
  [protocol.equals](other: unknown): boolean {
    return sameItems(this, other, (c) => c.entries())
  }

  /**
   * New instance of the same class holding the same entries in iteration order. The copy is
   * shallow. Subclasses whose constructor needs more than the entries override
   * {@link cloneFrom}.
   */
  [protocol.clone](): this {
    return this.cloneFrom(this.entries())
  }

  /**
   * Build a new instance of this collection's class from `entries`. The default calls
   * `new this.constructor(entries)`.
   */
  protected cloneFrom(entries: Iterable<[K, V]>): this {
    return Reflect.construct(this.constructor, [entries]) as this
  }
}
