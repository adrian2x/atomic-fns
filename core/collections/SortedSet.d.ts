import { Collection } from './abc.js';
export declare class SortedSet<T> extends Collection {
    private readonly store;
    /**
     * Creates a new `SortedSet` object.
     * @param {Iterable<T>} [iterable] Initialize the set with entries.
     * @param {Comparer} [compareFn] The `compare` function to sort keys.
     */
    constructor(iterable?: Iterable<T>, compareFn?: any);
    /**
     * Inserts a new value in order in the `Set`, if the value doesn't exist.
     * @param {T} value
     * @returns {this} Returns the Set object.
     */
    add(value: T): this;
    /**
     * Returns the smallest value in the set.
     * @returns {?T}
     */
    min(): T | undefined;
    /**
     * Returns the largest value in the set.
     * @returns {?T}
     */
    max(): T | undefined;
    /**
     * Removes the value from the set and returns `true` if the value was found and removed.
     * @param {T} value
     * @returns {boolean} `true` if the value was found and removed.
     */
    delete(value: T): boolean;
    /**
     * Removes all values in the set.
     */
    clear(): void;
    /**
     * Returns the total number of elements in the set.
     * @returns {number}
     */
    get size(): number;
    /**
     * Check if there are no values in the set.
     * @returns {boolean} `true` if is empty.
     */
    empty(): boolean;
    /**
     * Returns `true` if the `value` exists.
     * @param {T} value
     * @returns {boolean} `true` if value is found, otherwise `false`.
     */
    contains(value: T): boolean;
    /**
     * Returns `true` if the `value` exists.
     * @param {T} value
     * @returns {boolean} `true` if value is found, otherwise `false`.
     */
    has(value: T): boolean;
    /**
     * Returns a new iterator of all values **in-order**.
     * @returns {Iterable<T>}
     */
    values(): Iterable<T>;
}
