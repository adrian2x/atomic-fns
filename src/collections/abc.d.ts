/**
 * A container type that provides contains().
 *
 *
 * @interface Container
 */
export interface Container {
    contains: (x: any) => boolean;
}
/**
 * Implements an equality check between two values.
 * @interface Ordered
 */
export interface Equals {
    eq: (other: any) => boolean;
}
/**
 * Implements an iterable that allows comparing two elements to determine ordering.
 * @interface Ordered
 */
export interface Comparable {
    compare: (other: any) => -1 | 1 | 0;
}
/**
 * Implements an iterable that allows sorting elements.
 * @interface Ordered
 */
export interface Ordered<T> {
    lt: (other: any) => boolean;
}
/**
 * Implements an iterable that allows backward iteration.
 * @interface Reversible
 */
export interface Reversible<T = unknown> {
    reversed: () => Iterable<T>;
}
/**
 * A `Collection` is an iterable {@link Container} type.
 * This is an abstract base class for user-defined collection types.
 *
 *
 * @abstract
 * @class Collection
 * @implements {Container}
 */
export declare abstract class Collection implements Container {
    /**
     * Adds a new item to the collection.
     * @param item - The item to add to the collection.
     */
    abstract add(item: any): any;
    /**
     * Checks if item is present in the collection.
     * @param item - The item to search for in the collection.
     * @returns `true` when the element is found, else `false`
     */
    abstract contains(item: any): boolean;
    /**
     * Remove all items from the collection
     */
    abstract clear(): any;
    /**
     * Returns the total number of elements in the collection.
     */
    abstract get size(): number;
    get length(): number;
    /**
     * Check if there are no items.
     * @returns {boolean} `true` if is empty.
     */
    empty(): boolean;
}
/**
 * A sequence is an iterable {@link Collection} type with efficient index-based access.
 * @abstract
 * @class Sequence
 * @extends {Collection}
 * @template V
 */
export declare abstract class Sequence<V = any, K = any> extends Collection {
    /**
     * Return the item at the given key or index
     * @param {K} key
     * @memberof Sequence
     */
    abstract get(key: K): any;
    /**
     * Set a new value at the given key or index
     *
     * @param {K} key
     * @param {V} value
     * @memberof Sequence
     */
    abstract set(key: K, value: V): any;
    /**
     * Adds a new item to the end of the sequence. Alias of {@link Collection.add}.
     *
     * @param {V} x
     * @memberof Sequence
     */
    abstract append(x: V | Iterable<V>): any;
    /**
     * Remove a given value from the collection if exists.
     * @returns the value that was removed or `undefined`.
     */
    abstract remove(x: V): any;
    /**
     * Returns an iterator of all the `keys` in order.
     */
    abstract keys(): Iterable<K>;
    /**
     * Returns an iterator of all the `values` in order.
     */
    abstract values(): Iterable<V>;
    /**
     * Returns an iterator of all the `[key, value]` pairs in order.
     */
    abstract entries(): Iterable<[K, V]>;
}
/**
 * A mapping is a {@link Collection} indexed by keys that may have associated values.
 * @abstract
 * @class Mapping
 * @extends {Collection}
 * @template K, V
 */
export declare abstract class Mapping<K, V> extends Collection {
    /**
     * Returns the value for the given key, or return `defaults` if not found.
     * @param {K} key
     * @param {*} [defaults]
     */
    abstract get(key: K, defaults?: any): V | undefined;
    /**
     * Sets the value for the given key.
     * @param {K} key
     */
    abstract set(key: K, value: V): any;
    /**
     * Returns an iterator of all the `keys` in the map.
     */
    abstract keys(): Iterable<K>;
    /**
     * Returns an iterator of all the `values` in the map.
     */
    abstract values(): Iterable<V>;
    /**
     * Returns an iterator of all the `[key, value]` pairs in the map.
     */
    abstract entries(): Iterable<[K, V]>;
}
