abstract class BaseCollection {
  abstract get size(): number
  abstract clear(): void
  abstract get [Symbol.toStringTag](): string
}

/**
 * Set-like collection base: iteration yields values.
 */
export abstract class SetCollection<T> extends BaseCollection implements Iterable<T> {
  abstract has(value: T): boolean
  abstract values(): IteratorObject<T>

  keys(): IteratorObject<unknown> {
    return this.values()
  }

  entries(): IteratorObject<[unknown, T]> {
    return this.values().map((v) => [v, v])
  }

  forEach(cb: (value: T, key: unknown, coll: this) => void, thisArg?: unknown): void {
    for (const v of this.values()) {
      cb.call(thisArg, v, v, this)
    }
  }

  [Symbol.iterator](): IteratorObject<T> {
    return this.values()
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
