/**
 * A container type that provides contains().
 * @interface Container
 */
export interface Container {
  contains: (x: unknown) => boolean
}

/**
 * Implements an equality check between two values.
 * @interface Equals
 */
export interface Equals {
  eq: (other: unknown) => boolean
}

/**
 * Implements an iterable that allows sorting elements.
 * @interface Ordered
 */
export interface Ordered<T> {
  lt: (other: T) => boolean
}

/**
 * Implements an iterable that allows backward iteration.
 * @interface Reversible
 */
export interface Reversible<T = any> {
  reversed: () => Iterable<T>
}

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

  keys(): IteratorObject<T> {
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

/** 1.x Collection base; kept until Deque/SplayTree/BTree/Sorted* migrate (M12). */
export abstract class LegacyCollection implements Container {
  abstract add(item: unknown): unknown
  abstract contains(item: unknown): boolean
  abstract clear(): void
  abstract get size(): number

  get length(): number {
    return this.size
  }

  empty(): boolean {
    return !this.size
  }
}

/** 1.x Sequence base; kept until Deque migrates (M12). */
export abstract class LegacySequence<V = unknown, K = unknown> extends LegacyCollection {
  abstract get(key: K): V | undefined
  abstract set(key: K, value: V): unknown
  abstract append(x: V | Iterable<V>): unknown
  abstract remove(x: V): unknown
  abstract keys(): Iterable<K>
  abstract values(): Iterable<V>
  abstract entries(): Iterable<[K, V]>
}

/** 1.x Mapping base; kept until SplayTree/BTree/Sorted* migrate (M9-M11). */
export abstract class LegacyMapping<K, V> extends LegacyCollection {
  abstract get(key: K, defaults?: V): V | undefined
  abstract set(key: K, value: V): unknown
  abstract keys(): Iterable<K>
  abstract values(): Iterable<V>
  abstract entries(): Iterable<[K, V]>
}
