import { Mapping } from './abc.js'

/**
 * Implements a Least Recently Used fixed-capacity cache which supports updating, removing, and accessing keys in O(1).
 * @template K, V
 */
export class LRUCache<K = any, V = any> extends Mapping<K, V> {
  protected items = new Map<K, V>()
  protected maxSize: number

  /**
   * Creates a new instance of fixed size.
   * @param {number} capacity
   */
  constructor(capacity = 1024) {
    super()
    this.maxSize = capacity
  }

  /**
   * Adds a new element with a specified `key` and `value` to the cache. If an element with the same key already exists, the element will be updated.
   * @param {K} key
   * @param {V} value
   * @returns {this}
   */
  set(key: K, value: V) {
    if (this.items.size === this.maxSize) {
      // Because ES6 maps remember insertion order, we can evict the first key
      const lastKey = this.items.keys().next().value
      this.items.delete(lastKey)
    }
    // Delete the previous key to update the new insertion order
    this.items.delete(key)
    this.items.set(key, value)
    return this
  }

  /**
   * This is just an alias of {@link LRUCache.set}.
   * @param {K} key The key to add (note value will be `undefined`)
   * @returns {this}
   */
  add(key: K) {
    return this.set(key, undefined as V)
  }

  /**
   * Returns `true` if the specified `key` is found on the cache.
   * @param {K} key
   * @returns {boolean}
   */
  contains(key: K) {
    return this.items.has(key)
  }

  /**
   * Get the value associated with the specified `key`, or `undefined` it not found.
   * @param {K} key
   * @returns {?V} The associated value or `undefined`
   */
  get(key: K) {
    if (this.items.has(key)) {
      const value = this.items.get(key)
      // Delete the previous key to update the new insertion order
      this.items.delete(key)
      this.items.set(key, value as V)
      return value
    }
  }

  /**
   * Removes all keys and values from the cache.
   * @returns {this}
   */
  clear() {
    this.items.clear()
    return this
  }

  /**
   * Removes a key from the cache and returns `true` if the key existed or `false` otherwise.
   * @param {K} key
   * @returns {boolean} `true` if the key existed and was removed
   */
  delete(key: K) {
    return this.items.delete(key)
  }

  /**
   * Removes the value associated with the specified `key` from the cache and returns the removed value if the key existed.
   * @param {K} key
   * @returns {?V} The value if it was removed or `undefined`.
   */
  remove(key: K) {
    const value = this.items.get(key)
    this.items.delete(key)
    return value
  }

  /**
   * Returns the total number of elements in the cache.
   */
  get size() {
    return this.items.size
  }

  /**
   * Returns the total capacity of the cache.
   */
  get capacity() {
    return this.maxSize
  }

  /**
   * Returns an iterable of all the keys in the cache, in insertion order.
   * @returns {IterableIterator<K>}
   */
  keys() {
    return this.items.keys()
  }

  /**
   * Returns an iterable of all the values in the cache, in insertion order.
   * @returns {IterableIterator<V>}
   */
  values() {
    return this.items.values()
  }

  /**
   * Returns an iterable of all the [key, value] pairs in the cache, in insertion order.
   * @returns {IterableIterator<[K, V]>}
   */
  entries() {
    return this.items.entries()
  }

  [Symbol.iterator]() {
    return this.entries()
  }
}
