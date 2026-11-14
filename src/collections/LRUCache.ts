import { Mapping } from './abc.js'

/**
 * Implements a Least Recently Used fixed-capacity cache which supports updating, removing, and accessing keys in O(1).
 * @template K, V
 */
export class LRUCache<K = any, V = any> extends Mapping<K, V> {
  protected items = new Map<K, V>()
  protected maxSize: number
  // A new iterator would rescan every deleted slot at the front of the Map on each eviction
  declare private eviction: { keys: Iterator<K>; writes: number }

  /**
   * Creates a new instance of fixed size.
   * @param {number} capacity
   */
  constructor(capacity = 1024) {
    super()
    this.maxSize = capacity
    // Not enumerable, so two caches compare by their items
    Object.defineProperty(this, 'eviction', { value: { keys: this.items.keys(), writes: 0 } })
  }

  /**
   * Adds a new element with a specified `key` and `value` to the cache. If an element with the same key already exists, the element will be updated.
   * @param {K} key
   * @param {V} value
   * @returns {this}
   */
  set(key: K, value: V): this {
    // Delete the previous key to update the new insertion order
    this.items.delete(key)
    this.items.set(key, value)
    this.wrote()
    if (this.items.size > this.maxSize) {
      // Because ES6 maps remember insertion order, we can evict the first key
      const lastKey = this.eviction.keys.next().value
      this.items.delete(lastKey)
    }
    return this
  }

  /** An idle Map iterator pins every hash table the Map has outgrown, so it cannot live forever. */
  private wrote() {
    const { eviction } = this
    if (++eviction.writes >= this.items.size) {
      eviction.writes = 0
      eviction.keys = this.items.keys()
    }
  }

  /**
   * This is just an alias of {@link LRUCache.set}.
   * @param {K} key The key to add (note value will be `undefined`)
   * @returns {this}
   */
  add(key: K): this {
    return this.set(key, undefined as V)
  }

  /**
   * Returns `true` if the specified `key` is found on the cache.
   * @param {K} key
   * @returns {boolean}
   */
  contains(key: K): boolean {
    return this.items.has(key)
  }

  /**
   * Get the value associated with the specified `key`, or `undefined` it not found.
   * @param {K} key
   * @returns {?V} The associated value or `undefined`
   */
  get(key: K): V | undefined {
    if (this.items.has(key)) {
      const value = this.items.get(key)
      // Delete the previous key to update the new insertion order
      this.items.delete(key)
      this.items.set(key, value)
      this.wrote()
      return value
    }
  }

  /**
   * Removes all keys and values from the cache.
   * @returns {this}
   */
  clear(): this {
    this.items.clear()
    return this
  }

  /**
   * Removes a key from the cache and returns `true` if the key existed or `false` otherwise.
   * @param {K} key
   * @returns {boolean} `true` if the key existed and was removed
   */
  delete(key: K): boolean {
    return this.items.delete(key)
  }

  /**
   * Removes the value associated with the specified `key` from the cache and returns the removed value if the key existed.
   * @param {K} key
   * @returns {?V} The value if it was removed or `undefined`.
   */
  remove(key: K): V | undefined {
    const value = this.items.get(key)
    this.items.delete(key)
    return value
  }

  /**
   * Returns the total number of elements in the cache.
   */
  get size(): number {
    return this.items.size
  }

  /**
   * Returns the total capacity of the cache.
   */
  get capacity(): number {
    return this.maxSize
  }

  /**
   * Returns an iterable of all the keys in the cache, from least to most recently used.
   * @returns {IterableIterator<K>}
   */
  keys(): IterableIterator<K> {
    // A snapshot: get and set re-insert keys, so a live Map iterator would never reach the end
    return [...this.items.keys()].values()
  }

  /**
   * Returns an iterable of all the values in the cache, from least to most recently used.
   * @returns {IterableIterator<V>}
   */
  values(): IterableIterator<V> {
    return [...this.items.values()].values()
  }

  /**
   * Returns an iterable of all the [key, value] pairs in the cache, from least to most recently used.
   * @returns {IterableIterator<[K, V]>}
   */
  entries(): IterableIterator<[K, V]> {
    return [...this.items.entries()].values()
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.entries()
  }
}
