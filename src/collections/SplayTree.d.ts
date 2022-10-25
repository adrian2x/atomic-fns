import { Mapping } from './abc.js';
/**
 * Base SplayTree node class.
 * @private
 */
declare class Node<K = any, V = any> {
    key: K;
    value: V;
    left?: Node<K, V>;
    right?: Node<K, V>;
    constructor(key: K, value: V);
    traverse(): Generator<any, void, any>;
    get height(): any;
}
/**
 * A splay tree is a *self-balancing binary* search tree with the additional property that recently accessed elements are quick to access again.
 * Insertion, look-up and removal in O(log n) *amortized* time.
 * For many patterns of non-random operations splay trees can take better than logarithmic time, without requiring advance knowledge of the pattern.
 * @see {@link https://en.wikipedia.org/wiki/Splay_tree Splay tree}
 * @template {K, V}
 */
export declare class SplayTree<K, V = any> extends Mapping<K, V> {
    root?: Node<K, V>;
    count: number;
    size(): number;
    empty(): boolean;
    get height(): any;
    /**
     *  Returns the value for `key` or `undefined` if the key is not found.
     * @param key The key to find.
     * @returns {?V} The value for the key or `undefined`.
     */
    get(key: K): any;
    /**
     * Inserts the `key` and `value` in the tree if the `key` does not exist.
     * @param {K} key A key which can be any comparable value
     * @param {V} value A value associated with the key
     * @returns
     */
    set(key: K, value: V): void;
    /**
     * Removes a specified key from the tree if it exists in the tree. The removed value is returned. If the key is not found, a KeyError is thrown.
     * @param {K} key The key to remove.
     * @returns {V} The removed value associated with `key`.
     */
    remove(key: K): V;
    /**
     * Returns the minimum key in the tree or subtree.
     * @returns The minimum key.
     */
    min(root?: Node<K, V> | undefined): K | undefined;
    /**
     * Returns the maximum key in the tree or subtree.
     * @returns The maximum key.
     */
    max(root?: Node<K, V> | undefined): K | undefined;
    /**
     * Returns the largest key that is less than a given key.
     * @param key The given key
     * @returns The largest key found or `undefined`.
     */
    lowerBound(key: any): K | Node<K, V> | undefined;
    /**
     * This is the simplified top-down splaying method proposed by Sleator and Tarjan in {@link https://doi.org/10.1145%2F3828.3835 Self-Adjusting Binary Search Trees}.
     * @param key
     * @see {@link https://doi.org/10.1145%2F3828.3835 Self-Adjusting Binary Search Trees}
     */
    splay(key: any): void;
    add(key: K): void;
    /**
     * Returns `true` if the given key is in the tree.
     * @param {K} key The key to find.
     * @returns `true` if found.
     */
    contains(key: K): boolean;
    /** Alias of remove but just returns `true` instead of the deleted value. */
    delete(key: K): boolean;
    clear(): void;
    /**
     * Returns an ordered iterable of all the keys in the tree.
     * @returns {Iterable<K>} An iterable of keys in-order.
     */
    keys(): Iterable<K>;
    /**
     * Returns an ordered iterable of all the keys and values in the tree.
     * @returns {Iterable<[K,V]>} A iterable of `[key, value]` pairs sorted by key.
     */
    entries(): Iterable<[K, V]>;
    /**
     * Returns an ordered iterable of all the keys and values in the tree.
     * @returns {Iterable<V>} A iterable of `[key, value]` pairs sorted by key.
     */
    values(): Iterable<V>;
}
export {};
