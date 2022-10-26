import { Comparer } from '../operators/index.js';
import { Mapping } from './abc.js';
/**
 * A `SortedTree` is a map that holds key value pairs ordered by keys. Any primitive value (and objects that implement {@link Comparable} or {@link Ordered} interfaces) can be used as keys or values.
 * @see {@link Compare}
 * @see {@link Ordered}
 * @template K, V
 */
export declare class SortedTree<K, V> extends Mapping<K, V> {
    private readonly store;
    /**
     * Creates a new `SortedTree` object.
     * @param {Iterable<[K, V]>} [iterable] Initialize the tree with entries.
     * @param {Comparer} [compareFn] The `compare` function to sort keys.
     */
    constructor(iterable?: Iterable<[K, V]>, compareFn?: Comparer);
    /**
     * Adds a new `key` with a `null` value.
     * @param {K} key
     * @returns {this} Returns the Tree object.
     */
    add(key: K): this;
    /**
     * Returns the value associated with the `key` or `undefined`.
     * @param {K} key
     * @returns {?V} The key value or `undefined`.
     */
    get(key: K): V | undefined;
    /**
     * Sets the value for the given `key`.
     * @param {K} key
     * @param {V} value
     * @returns {this} Returns the Tree object.
     */
    set(key: K, value: V): this;
    /**
     * Returns the smallest key in the tree.
     * @returns {?K}
     */
    min(): K | undefined;
    /**
     * Returns the largest key in the tree.
     * @returns {?K}
     */
    max(): K;
    /**
     * Returns `true` if the `key` existed in the tree and was removed.
     * @param {K} key
     * @returns {boolean} `true` if key was removed, otherwise `false`.
     */
    delete(key: K): boolean;
    /**
     * Removes all key/value pairs in the tree.
     */
    clear(): void;
    /**
     * Freezes the tree which prevents adding, updating or removing any keys.
     * @returns {this}
     */
    freeze(): this;
    /**
     * Returns a new iterator of `[K, V]` pairs in reverse order of keys.
     * @returns {Iterable<[K, V]>}
     */
    reversed(): IterableIterator<[K, V]>;
    /**
     * Returns the total key/value pairs in the tree.
     * @returns {number}
     */
    get size(): number;
    /**
     * Check if there are no key/value pairs in the tree.
     * @returns {boolean} `true` if is empty.
     */
    empty(): boolean;
    /**
     * Returns `true` if the `key` exists in the tree.
     * @param {K} key
     * @returns {boolean} `true` if key is found, otherwise `false`.
     */
    contains(key: K): boolean;
    /**
     * Returns `true` if the `key` exists in the tree.
     * @param {K} key
     * @returns {boolean} `true` if key is found, otherwise `false`.
     */
    has(key: K): boolean;
    /**
     * Returns a new iterator of all **ordered** keys in the tree.
     * @returns {Iterable<K>}
     */
    keys(): IterableIterator<K>;
    /**
     * Returns a new iterator of all values **ordered** by their keys.
     * @returns {Iterable<V>}
     */
    values(): IterableIterator<V>;
    /**
     * Returns a new iterator of all key value pairs **ordered** by their keys.
     * @returns {Iterable<[K, V]>}
     */
    entries(): IterableIterator<[K, V]>;
}
