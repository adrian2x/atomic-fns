import { Mapping } from './abc.js';
import { BTree } from './BTree.js';
/**
 * A `SortedTree` is a map that holds key value pairs in sorted orders of keys. Any primitive value (and objects that implement a `compare` or `lt` methods) can be used as keys or values.
 * @see {@link Operators.compare}
 * @see {@link Operators.lt}
 * @template K, V
 */
export class SortedTree extends Mapping {
    store;
    /**
     * Creates a new `SortedTree` object.
     * @param {Iterable<[K, V]>} [iterable] Initialize the tree with entries.
     * @param {Comparer} [compareFn] The `compare` function to sort keys.
     */
    constructor(iterable, compareFn) {
        super();
        this.store = new BTree(iterable, compareFn);
    }
    /**
     * Adds a new `key` with a `null` value.
     * @param {K} key
     * @returns {this} Returns the Tree object.
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
     * @returns {this} Returns the Tree object.
     */
    set(key, value) {
        this.store.set(key, value);
        return this;
    }
    /**
     * Returns the smallest key in the tree.
     * @returns {?K}
     */
    min() {
        return this.store.minKey();
    }
    /**
     * Returns the largest key in the tree.
     * @returns {?K}
     */
    max() {
        return this.store.maxKey();
    }
    /**
     * Returns `true` if the `key` existed in the tree and was removed.
     * @param {K} key
     * @returns {boolean} `true` if key was removed, otherwise `false`.
     */
    delete(key) {
        return this.store.remove(key);
    }
    /**
     * Removes all key/value pairs in the tree.
     */
    clear() {
        return this.store.clear();
    }
    /**
     * Freezes the tree which prevents adding, updating or removing any keys.
     * @returns {this}
     */
    freeze() {
        this.store.freeze();
        return this;
    }
    /**
     * Returns a new iterator of `[K, V]` pairs in reverse order of keys.
     * @returns {Iterable<[K, V]>}
     */
    reversed() {
        return this.store.reversed();
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
     * Returns `true` if the `key` exists in the tree.
     * @param {K} key
     * @returns {boolean} `true` if key is found, otherwise `false`.
     */
    contains(key) {
        return this.store.contains(key);
    }
    /**
     * Returns `true` if the `key` exists in the tree.
     * @param {K} key
     * @returns {boolean} `true` if key is found, otherwise `false`.
     */
    has(key) {
        return this.store.contains(key);
    }
    /**
     * Returns a new iterator of all **ordered** keys in the tree.
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
