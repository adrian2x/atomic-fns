import { Mapping } from './abc.js';
import { SplayTree } from './SplayTree.js';
/**
 * A `SortedMap` is a map that holds key value pairs in sorted orders of keys. Any primitive value (and objects that implement a `compare` or `lt` methods) can be used as keys or values.
 * @see {@link Operators.compare}
 * @see {@link Operators.lt}
 * @template K, V
 */
export class SortedMap extends Mapping {
    store;
    /**
     * Creates a new `SortedMap` object.
     * @param {Iterable<[K, V]>} [iterable] Initialize the map with entries.
     * @param {Comparer} [compareFn] The `compare` function to sort keys.
     */
    constructor(iterable, compareFn) {
        super();
        this.store = new SplayTree(compareFn);
        if (iterable) {
            for (const pair of iterable) {
                this.store.set(pair[0], pair[1] ?? null);
            }
        }
    }
    /**
     * Adds a new `key` with a `null` value, if the `key` doesn't exist.
     * @param {K} key
     * @returns {this} Returns the Map object.
     */
    add(key) {
        this.store.set(key, null);
        return this;
    }
    /**
     * Returns the value associated with the `key` or `undefined`.
     * @param {K} key
     * @returns {?V} The key value or `undefined`.
     */
    get(key) {
        return this.store.get(key);
    }
    /**
     * Sets the value for the given `key`.
     * @param {K} key
     * @param {V} value
     * @returns {this} Returns the Map object.
     */
    set(key, value) {
        return this.store.set(key, value);
    }
    /**
     * Returns the smallest key in the tree.
     * @returns {?K}
     */
    min() {
        return this.store.min();
    }
    /**
     * Returns the largest key in the tree.
     * @returns {?K}
     */
    max() {
        return this.store.max();
    }
    /**
     * Returns `true` if the `key` existed in the map and was removed.
     * @param {K} key
     * @returns {boolean} `true` if key was removed, otherwise `false`.
     */
    delete(item) {
        return this.store.remove(item) !== undefined;
    }
    /**
     * Removes all key/value pairs in the tree.
     */
    clear() {
        return this.store.clear();
    }
    /**
     * Returns the total key/value pairs in the tree.
     * @returns {number}
     */
    get size() {
        return this.store.size;
    }
    /**
     * Check if there are no key/value pairs in the tree.
     * @returns {boolean} `true` if is empty.
     */
    empty() {
        return this.store.empty();
    }
    /**
     * Returns `true` if the `key` exists in the map.
     * @param {K} key
     * @returns {boolean} `true` if key is found, otherwise `false`.
     */
    contains(key) {
        return this.store.contains(key);
    }
    /**
     * Returns `true` if the `key` exists in the map.
     * @param {K} key
     * @returns {boolean} `true` if key is found, otherwise `false`.
     */
    has(key) {
        return this.store.contains(key);
    }
    /**
     * Returns a new iterator of all **ordered** keys in the map.
     * @returns {Iterable<K>}
     */
    keys() {
        return this.store.keys();
    }
    /**
     * Returns a new iterator of all values **ordered** by their keys.
     * @returns {Iterable<V>}
     */
    values() {
        return this.store.values();
    }
    /**
     * Returns a new iterator of all key value pairs **ordered** by their keys.
     * @returns {Iterable<[K, V]>}
     */
    entries() {
        return this.store.entries();
    }
}
