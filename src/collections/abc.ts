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
}
