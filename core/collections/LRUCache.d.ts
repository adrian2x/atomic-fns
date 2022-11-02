import { Mapping } from './abc.js';
/**
 * Implements a Least Recently Used fixed-capacity cache which supports updating, removing, and accessing keys in O(1).
 * @template K, V
 */
export declare class LRUCache<K = any, V = any> extends Mapping<K, V> {
    protected items: Map<K, V>;
    protected maxSize: number;
    /**
     * Creates a new instance of fixed size.
     * @param {number} capacity
     */
    constructor(capacity?: number);
    /**
     * Adds a new element with a specified `key` and `value` to the cache. If an element with the same key already exists, the element will be updated.
     * @param {K} key
     * @param {V} value
     * @returns {this}
     */
    set(key: K, value: V): this;
    /**
     * This is just an alias of {@link LRUCache.set}.
     * @param {K} key The key to add (note value will be `undefined`)
     * @returns {this}
     */
    add(key: K): this;
    /**
     * Returns `true` if the specified `key` is found on the cache.
     * @param {K} key
     * @returns {boolean}
     */
    contains(key: K): boolean;
    /**
     * Get the value associated with the specified `key`, or `undefined` it not found.
     * @param {K} key
     * @returns {?V} The associated value or `undefined`
     */
    get(key: K): V | undefined;
    /**
     * Removes all keys and values from the cache.
     * @returns {this}
     */
    clear(): this;
    /**
     * Removes a key from the cache and returns `true` if the key existed or `false` otherwise.
     * @param {K} key
     * @returns {boolean} `true` if the key existed and was removed
     */
    delete(key: K): boolean;
    /**
     * Removes the value associated with the specified `key` from the cache and returns the removed value if the key existed.
     * @param {K} key
     * @returns {?V} The value if it was removed or `undefined`.
     */
    remove(key: K): V | undefined;
    /**
     * Returns the total number of elements in the cache.
     */
    get size(): number;
    /**
     * Returns the total capacity of the cache.
     */
    get capacity(): number;
    /**
     * Returns an iterable of all the keys in the cache, in insertion order.
     * @returns {IterableIterator<K>}
     */
    keys(): IterableIterator<K>;
    /**
     * Returns an iterable of all the values in the cache, in insertion order.
     * @returns {IterableIterator<V>}
     */
    values(): IterableIterator<V>;
    /**
     * Returns an iterable of all the [key, value] pairs in the cache, in insertion order.
     * @returns {IterableIterator<[K, V]>}
     */
    entries(): IterableIterator<[K, V]>;
    [Symbol.iterator](): IterableIterator<[K, V]>;
}
