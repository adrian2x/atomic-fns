import { Iteratee } from '../globals/index.js';
import { Comparer } from '../operators/index.js';
import { Mapping } from './abc.js';
export declare class BTree<K = any, V = any> extends Mapping<K, V> {
    private root;
    count: number;
    _maxNodeSize: number;
    /**
     * provides a total order over keys (and a strict partial order over the type K)
     * @returns a negative value if a < b, 0 if a === b and a positive value if a > b
     */
    _compare: Comparer;
    /**
     * Initializes an empty B+ tree.
     * @param {?Iterable<[K, V]>} [entries] The initial key value pairs.
     * @param compareFn Custom function to compare pairs of elements in the tree.
     *   If not specified, defaultComparator will be used which is valid as long as K extends DefaultComparable.
     * @param entries A set of key-value pairs to initialize the tree
     * @param {number} [maxNodeSize=64] Branching factor (maximum items or children per node)
     *   Must be in range 4..256. If undefined or <4 then default is used; if >256 then 256.
     */
    constructor(entries?: Iterable<[K, V]>, compareFn?: Comparer, maxNodeSize?: number);
    /** Gets the number of key-value pairs in the tree. */
    get size(): number;
    /** Releases the tree so that its size is 0. */
    clear(): void;
    /**
     * Finds a pair in the tree and returns the associated value.
     * @param defaultValue a value to return if the key was not found.
     * @returns the value, or defaultValue if the key was not found.
     * @description Computational complexity: O(log size)
     */
    get(key: K, defaultValue?: V): V | undefined;
    /**
     * Adds or overwrites a key-value pair in the B+ tree.
     * @param key the key is used to determine the sort order of
     *        data in the tree.
     * @param value data to associate with the key (optional)
     * @returns true if a new key-value pair was added.
     * @description Computational complexity: O(log size)
     * Note: when overwriting a previous entry, the key is updated
     * as well as the value. This has no effect unless the new key
     * has data that does not affect its sort order.
     */
    set(key: K, value: V): boolean;
    add(key: K): boolean;
    /**
     * Returns true if the key exists in the B+ tree, false if not.
     * @param key Key to detect
     * @description Computational complexity: O(log size)
     */
    contains(key: K): boolean;
    /**
     * Removes a single key-value pair from the B+ tree.
     * @param key Key to find
     * @returns true if a pair was found and removed, false otherwise.
     * @description Computational complexity: O(log size)
     */
    remove(key: K): boolean;
    /** Returns an iterator that provides items in order (ascending order if
     *  the collection's comparator uses ascending order, as is the default.)
     *  @param lowestKey First key to be iterated, or undefined to start at
     *         minKey(). If the specified key doesn't exist then iteration
     *         starts at the next higher key (according to the comparator).
     *  @param reusedArray Optional array used repeatedly to store key-value
     *         pairs, to avoid creating a new array on every iteration.
     */
    entries(lowestKey?: K, reusedArray?: Array<K | V>): IterableIterator<[K, V]>;
    /** Returns an iterator that provides items in reversed order.
     *  @param highestKey Key at which to start iterating, or undefined to
     *         start at maxKey(). If the specified key doesn't exist then iteration
     *         starts at the next lower key (according to the comparator).
     *  @param reusedArray Optional array used repeatedly to store key-value
     *         pairs, to avoid creating a new array on every iteration.
     *  @param skipHighest Iff this flag is true and the highestKey exists in the
     *         collection, the pair matching highestKey is skipped, not iterated.
     */
    reversed(highestKey?: K, reusedArray?: Array<K | V>, skipHighest?: boolean): IterableIterator<[K, V]>;
    private findPath;
    /** Returns a new iterator for iterating the keys of each pair in ascending order.
     *  @param firstKey: Minimum key to include in the output. */
    keys(firstKey?: K): IterableIterator<K>;
    /** Gets the lowest key in the tree. Complexity: O(log size) */
    minKey(): K | undefined;
    /** Gets the highest key in the tree. Complexity: O(1) */
    maxKey(): K;
    /** Returns a new iterator for iterating the values of each pair in order by key.
     *  @param firstKey: Minimum key whose associated value is included in the output. */
    values(firstKey?: K): IterableIterator<V>;
    /** Returns the maximum number of children/values before nodes will split. */
    get maxNodeSize(): number;
    /** Performs a deep cloning of the tree, immediately duplicating any nodes that are
     *  not currently marked as shared, in order to avoid marking any
     *  additional nodes as shared.
     *  @param force Clone all nodes, even shared ones.
     */
    clone(force?: boolean): BTree<K, V>;
    /** Gets an array filled with the contents of the tree, sorted by key */
    toArray(): Array<[K, V]>;
    /** Gets a string representing the tree's data based on toArray(). */
    toString(): string;
    /** Returns the next pair whose key is larger than the specified key (or undefined if there is none).
     * If key === undefined, this function returns the lowest pair.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     * avoid creating a new array on every iteration.
     */
    lowerBound(key: K | undefined, reusedArray?: [K, V]): [K, V] | undefined;
    /** Returns the next key larger than the specified key, or undefined if there is none.
     *  Also, nextHigherKey(undefined) returns the lowest key.
     */
    /** Returns the next pair whose key is smaller than the specified key (or undefined if there is none).
     *  If key === undefined, this function returns the highest pair.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     *        avoid creating a new array each time you call this method.
     */
    upperBound(key: K | undefined, reusedArray?: [K, V]): [K, V] | undefined;
    /** Returns the next key smaller than the specified key, or undefined if there is none.
     *  Also, nextLowerKey(undefined) returns the highest key.
     */
    /** Returns the key-value pair associated with the supplied key if it exists
     *  or the pair associated with the next lower pair otherwise. If there is no
     *  next lower pair, undefined is returned.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     *        avoid creating a new array each time you call this method.
     * */
    floor(key: K, reusedArray?: [K, V]): [K, V] | undefined;
    /** Returns the key-value pair associated with the supplied key if it exists
     *  or the pair associated with the next lower pair otherwise. If there is no
     *  next lower pair, undefined is returned.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     *        avoid creating a new array each time you call this method.
     * */
    ceiling(key: K, reusedArray?: [K, V]): [K, V] | undefined;
    /**
     * Builds an array of pairs from the specified range of keys, sorted by key.
     * Each returned pair is also an array: pair[0] is the key, pair[1] is the value.
     * @param low The first key in the array will be greater than or equal to `low`.
     * @param high This method returns when a key larger than this is reached.
     * @param includeHigh If the `high` key is present, its pair will be included
     *        in the output if and only if this parameter is true. Note: if the
     *        `low` key is present, it is always included in the output.
     * @param maxLength Length limit. getRange will stop scanning the tree when
     *                  the array reaches this size.
     * @description Computational complexity: O(result.length + log size)
     */
    keysRange(low: K, high: K, includeHigh?: boolean, maxLength?: number): Array<[K, V]>;
    /** Adds all pairs from a list of key-value pairs.
     * @param entries Pairs to add to this tree. If there are duplicate keys,
     *        later pairs currently overwrite earlier ones (e.g. [[0,1],[0,7]]
     *        associates 0 with 7.)
     * @returns The number of pairs added to the collection.
     * @description Computational complexity: O(pairs.length * log(size + pairs.length))
     */
    extend(entries: Iterable<[K, V]>): number;
    /**
     * Scans the specified range of keys, in ascending order by key.
     * Note: the callback `onFound` must not insert or remove items in the
     * collection. Doing so may cause incorrect data to be sent to the
     * callback afterward.
     * @param low The first key scanned will be greater than or equal to `low`.
     * @param high Scanning stops when a key larger than this is reached.
     * @param includeHigh If the `high` key is present, `onFound` is called for
     *        that final pair if and only if this parameter is true.
     * @param onFound A function that is called for each key-value pair. This
     *        function can return {break:R} to stop early with result R.
     * @param initialCounter Initial third argument of onFound. This value
     *        increases by one each time `onFound` is called. Default: 0
     * @returns The number of values found, or R if the callback returned
     *        `{break:R}` to stop early.
     * @description Computational complexity: O(number of items scanned + log size)
     */
    rangeForEach<R = number>(low: K, high: K, includeHigh: boolean, onFound?: Iteratee<K, V>, initialCounter?: number): R | number;
    /**
     * Scans and potentially modifies values for a subsequence of keys.
     * Note: the callback `onFound` should ideally be a pure function.
     *   Specifically, it must not insert items, call clone(), or change
     *   the collection except via return value; out-of-band editing may
     *   cause an exception or may cause incorrect data to be sent to
     *   the callback (duplicate or missed items). It must not cause a
     *   clone() of the collection, otherwise the clone could be modified
     *   by changes requested by the callback.
     * @param low The first key scanned will be greater than or equal to `low`.
     * @param high Scanning stops when a key larger than this is reached.
     * @param includeHigh If the `high` key is present, `onFound` is called for
     *        that final pair if and only if this parameter is true.
     * @param onFound A function that is called for each key-value pair. This
     *        function can return `{value:v}` to change the value associated
     *        with the current key, `{delete:true}` to delete the current pair,
     *        `{break:R}` to stop early with result R, or it can return nothing
     *        (undefined or {}) to cause no effect and continue iterating.
     *        `{break:R}` can be combined with one of the other two commands.
     *        The third argument `counter` is the number of items iterated
     *        previously; it equals 0 when `onFound` is called the first time.
     * @returns The number of values scanned, or R if the callback returned
     *        `{break:R}` to stop early.
     * @description
     *   Computational complexity: O(number of items scanned + log size)
     *   Note: if the tree has been cloned with clone(), any shared
     *   nodes are copied before `onFound` is called. This takes O(n) time
     *   where n is proportional to the amount of shared data scanned.
     */
    rangeUpdate<R = V>(low: K, high: K, includeHigh: boolean, onFound: (k: K, v: V | undefined, counter: number) => any, initialCounter?: number): R | number;
    /**
     * Removes a range of key-value pairs from the B+ tree.
     * @param low The first key scanned will be greater than or equal to `low`.
     * @param high Scanning stops when a key larger than this is reached.
     * @param includeHigh Specifies whether the `high` key, if present, is deleted.
     * @returns The number of key-value pairs that were deleted.
     * @description Computational complexity: O(log size + number of items deleted)
     */
    removeRange(low: K, high: K, includeHigh: boolean): number;
    /** Removes a series of keys from the collection. */
    removeKeys(keys: K[]): number;
    /** Gets the height of the tree: the number of internal nodes between the
     *  BTree object and its leaf nodes (zero if there are no internal nodes). */
    get height(): number;
    /** Makes the object read-only to ensure it is not accidentally modified.
     *  Freezing does not have to be permanent; unfreeze() reverses the effect.
     *  This is accomplished by replacing mutator functions with a function
     *  that throws an Error. Compared to using a property (e.g. this.isFrozen)
     *  this implementation gives better performance in non-frozen BTrees.
     */
    freeze(): void;
    [Symbol.iterator](): IterableIterator<[K, V]>;
}
