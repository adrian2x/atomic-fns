import { MapCollection } from './abc.js'

/**
 * Fixed-capacity Least Recently Used cache. `get` refreshes recency; `has` does not.
 *
 * @template K, V
 */
export class LRUCache<K = unknown, V = unknown> extends MapCollection<K, V> {
  readonly #items = new Map<K, V>()
  readonly #capacity: number

  /**
   * @param capacity Maximum number of entries; must be an integer >= 1.
   * @throws {RangeError} when capacity is not an integer >= 1.
   */
  constructor(capacity = 1024) {
    super()
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('capacity must be an integer >= 1')
    }
    this.#capacity = capacity
  }

  /**
   * Set `key` to `value`. Updating an existing key does not evict. Inserting a new key at
   * capacity evicts the least recently used entry.
   */
  set(key: K, value: V): this {
    if (this.#items.has(key)) {
      this.#items.delete(key)
      this.#items.set(key, value)
      return this
    }
    if (this.#items.size >= this.#capacity) {
      const oldest = this.#items.keys().next()
      if (!oldest.done) this.#items.delete(oldest.value)
    }
    this.#items.set(key, value)
    return this
  }

  has(key: K): boolean {
    return this.#items.has(key)
  }

  /**
   * Return the value for `key`, refreshing its recency. Missing keys return `undefined`.
   */
  get(key: K): V | undefined {
    if (!this.#items.has(key)) return undefined
    const value = this.#items.get(key) as V
    this.#items.delete(key)
    this.#items.set(key, value)
    return value
  }

  clear(): void {
    this.#items.clear()
  }

  delete(key: K): boolean {
    return this.#items.delete(key)
  }

  get size(): number {
    return this.#items.size
  }

  /** Maximum number of entries. */
  get capacity(): number {
    return this.#capacity
  }

  readonly [Symbol.toStringTag] = 'LRUCache'

  keys(): IteratorObject<K> {
    return Iterator.from(this.#items.keys())
  }

  values(): IteratorObject<V> {
    return Iterator.from(this.#items.values())
  }

  entries(): IteratorObject<[K, V]> {
    return Iterator.from(this.#items.entries())
  }
}
