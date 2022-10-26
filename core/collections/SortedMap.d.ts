import { Mapping } from './abc.js';
/**
 * A `SortedMap` is a map that holds key value pairs in sorted orders of keys. Any primitive value (and objects that implement a `compare` or `lt` methods) can be used as keys or values.
 * @see {@link Operators.compare}
 * @see {@link Operators.lt}
 * @template K, V
 */
export declare class SortedMap<K, V> extends Mapping<K, V> {
    private readonly store;
    /**
     * Creates a new `SortedMap` object.
     * @param {Iterable<[K, V]>} [iterable] Initialize the map with entries.
     * @param {Comparer} [compareFn] The `compare` function to sort keys.
     */
    constructor(iterable?: Iterable<[K, V]>, compareFn?: any);
    /**
     * Adds a new `key` with a `null` value, if the `key` doesn't exist.
     * @param {K} key
     * @returns {this} Returns the Map object.
     */
    add(key: K): this;
    /**
     * Returns the value associated with the `key` or `undefined`.
     * @param {K} key
     * @returns {?V} The key value or `undefined`.
     */
    get(key: K): any;
    /**
     * Sets the value for the given `key`.
     * @param {K} key
     * @param {V} value
     * @returns {this} Returns the Map object.
     */
    set(key: K, value: V): void;
    /**
     * Returns the smallest key in the tree.
     * @returns {?K}
     */
    min(): K | undefined;
    /**
     * Returns the largest key in the tree.
     * @returns {?K}
     */
    max(): K | undefined;
    /**
     * Returns `true` if the `key` existed in the map and was removed.
     * @param {K} key
     * @returns {boolean} `true` if key was removed, otherwise `false`.
     */
    delete(item: K): boolean;
    /**
     * Removes all key/value pairs in the tree.
     */
    clear(): void;
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
     * Returns `true` if the `key` exists in the map.
     * @param {K} key
     * @returns {boolean} `true` if key is found, otherwise `false`.
     */
    contains(key: K): boolean;
    /**
     * Returns `true` if the `key` exists in the map.
     * @param {K} key
     * @returns {boolean} `true` if key is found, otherwise `false`.
     */
    has(key: K): boolean;
    /**
     * Returns a new iterator of all **ordered** keys in the map.
     * @returns {Iterable<K>}
     */
    keys(): Iterable<K>;
    /**
     * Returns a new iterator of all values **ordered** by their keys.
     * @returns {Iterable<V>}
     */
    values(): Iterable<V>;
    /**
     * Returns a new iterator of all key value pairs **ordered** by their keys.
     * @returns {Iterable<[K, V]>}
     */
    entries(): Iterable<[K, V]>;
}
