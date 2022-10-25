import { KeyError } from '../globals/index.js';
import { compare } from '../operators/index.js';
import { Mapping } from './abc.js';
const Delete = { delete: true };
const DeleteRange = () => Delete;
const Break = { break: true };
const EmptyArray = [];
const ReusedArray = []; // assumed thread-local
// Optimization: this array of `undefined`s is used instead of a normal
// array of values in nodes where `undefined` is the only value.
// Its length is extended to max node size on first use; since it can
// be shared between trees with different maximums, its length can only
// increase, never decrease. Its type should be undefined[] but strangely
// TypeScript won't allow the comparison V[] === undefined[]. To prevent
// users from making this array too large, BTree has a maximum node size.
//
// FAQ: undefVals[i] is already undefined, so why increase the array size?
// Reading outside the bounds of an array is relatively slow because it
// has the side effect of scanning the prototype chain.
const undefVals = [];
/**
 * Leaf nodes and base class for internals.
 * Based on the `sorted-btree` implementation by David Piepgrass (MIT License).
 * @private
 */
class BNode {
    // If this is an internal node, _keys[i] is the highest key in children[i].
    keys;
    values;
    // True if this node might be within multiple `BTree`s (or have multiple parents).
    // If so, it must be cloned before being mutated to avoid changing an unrelated tree.
    // This is transitive: if it's true, children are also shared even if `isShared!=true`
    // in those children. (Certain operations will propagate isShared=true to children.)
    isShared;
    get isLeaf() {
        return this.children === undefined;
    }
    constructor(keys = [], values) {
        this.keys = keys;
        this.values = values || undefVals;
        this.isShared = undefined;
    }
    /// ////////////////////////////////////////////////////////////////////////
    // Shared methods /////////////////////////////////////////////////////////
    maxKey() {
        return this.keys[this.keys.length - 1];
    }
    // If key not found, returns i^failXor where i is the insertion index.
    // Callers that don't care whether there was a match will set failXor=0.
    indexOf(key, failXor, cmp) {
        const keys = this.keys;
        let lo = 0;
        let hi = keys.length;
        let mid = hi >> 1;
        while (lo < hi) {
            const c = cmp(keys[mid], key);
            if (c < 0)
                lo = mid + 1;
            else if (c > 0)
                hi = mid; // key < keys[mid]
            else if (c === 0)
                return mid;
            else {
                // c is NaN or otherwise invalid
                // eslint-disable-next-line
                if (key === key)
                    // at least the search key is not NaN
                    return keys.length;
                // eslint-disable-next-line
                else
                    throw new KeyError(`Btree found an invalid key: ${key}`);
            }
            mid = (lo + hi) >> 1;
        }
        return mid ^ failXor;
    }
    /// //////////////////////////////////////////////////////////////////////////
    // Leaf Node: misc //////////////////////////////////////////////////////////
    minKey() {
        return this.keys[0];
    }
    minPair(reusedArray) {
        if (this.keys.length === 0)
            return undefined;
        reusedArray[0] = this.keys[0];
        reusedArray[1] = this.values[0];
        return reusedArray;
    }
    maxPair(reusedArray) {
        if (this.keys.length === 0)
            return undefined;
        const lastIndex = this.keys.length - 1;
        reusedArray[0] = this.keys[lastIndex];
        reusedArray[1] = this.values[lastIndex];
        return reusedArray;
    }
    clone() {
        const v = this.values;
        return new BNode(this.keys.slice(0), v === undefVals ? v : v.slice(0));
    }
    greedyClone(force) {
        return this.isShared && !force ? this : this.clone();
    }
    get(key, defaultValue, tree) {
        const i = this.indexOf(key, -1, tree._compare);
        return i < 0 ? defaultValue : this.values[i];
    }
    getPairOrNextLower(key, compare, inclusive, reusedArray) {
        const i = this.indexOf(key, -1, compare);
        const indexOrLower = i < 0 ? ~i - 1 : inclusive ? i : i - 1;
        if (indexOrLower >= 0) {
            reusedArray[0] = this.keys[indexOrLower];
            reusedArray[1] = this.values[indexOrLower];
            return reusedArray;
        }
        return undefined;
    }
    getPairOrNextHigher(key, compare, inclusive, reusedArray) {
        const i = this.indexOf(key, -1, compare);
        const indexOrLower = i < 0 ? ~i : inclusive ? i : i + 1;
        const keys = this.keys;
        if (indexOrLower < keys.length) {
            reusedArray[0] = keys[indexOrLower];
            reusedArray[1] = this.values[indexOrLower];
            return reusedArray;
        }
        return undefined;
    }
    checkValid(depth, tree, baseIndex) {
        const kL = this.keys.length;
        const vL = this.values.length;
        assert(this.values === undefVals ? kL <= vL : kL === vL, 'keys/values length mismatch: depth', depth, 'with lengths', kL, vL, 'and baseIndex', baseIndex);
        // Note: we don't check for "node too small" because sometimes a node
        // can legitimately have size 1. This occurs if there is a batch
        // deletion, leaving a node of size 1, and the siblings are full so
        // it can't be merged with adjacent nodes. However, the parent will
        // verify that the average node size is at least half of the maximum.
        assert(depth === 0 || kL > 0, 'empty leaf at depth', depth, 'and baseIndex', baseIndex);
        return kL;
    }
    /// //////////////////////////////////////////////////////////////////////////
    // Leaf Node: set & node splitting //////////////////////////////////////////
    set(key, value, overwrite, tree) {
        let i = this.indexOf(key, -1, tree._compare);
        if (i < 0) {
            // key does not exist yet
            i = ~i;
            tree.count++;
            if (this.keys.length < tree._maxNodeSize) {
                return this.insertInLeaf(i, key, value, tree);
            }
            else {
                // This leaf node is full and must split
                const newRightSibling = this.splitOffRightSide();
                // eslint-disable-next-line
                let target = this;
                if (i > this.keys.length) {
                    i -= this.keys.length;
                    target = newRightSibling;
                }
                target.insertInLeaf(i, key, value, tree);
                return newRightSibling;
            }
        }
        else {
            // Key already exists
            if (overwrite !== false) {
                if (value !== undefined)
                    this.reifyValues();
                // usually this is a no-op, but some users may wish to edit the key
                this.keys[i] = key;
                this.values[i] = value;
            }
            return false;
        }
    }
    reifyValues() {
        if (this.values === undefVals)
            return (this.values = this.values.slice(0, this.keys.length));
        return this.values;
    }
    insertInLeaf(i, key, value, tree) {
        this.keys.splice(i, 0, key);
        if (this.values === undefVals) {
            while (undefVals.length < tree._maxNodeSize)
                undefVals.push(undefined);
            if (value === undefined) {
                return true;
            }
            else {
                this.values = undefVals.slice(0, this.keys.length - 1);
            }
        }
        this.values.splice(i, 0, value);
        return true;
    }
    takeFromRight(rhs) {
        // Reminder: parent node must update its copy of key for this node
        // assert: neither node is shared
        // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
        let v = this.values;
        if (rhs.values === undefVals) {
            if (v !== undefVals)
                v.push(undefined);
        }
        else {
            v = this.reifyValues();
            // eslint-disable-next-line
            v.push(rhs.values.shift());
        }
        // eslint-disable-next-line
        this.keys.push(rhs.keys.shift());
    }
    takeFromLeft(lhs) {
        // Reminder: parent node must update its copy of key for this node
        // assert: neither node is shared
        // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
        let v = this.values;
        if (lhs.values === undefVals) {
            if (v !== undefVals)
                v.unshift();
        }
        else {
            v = this.reifyValues();
            // eslint-disable-next-line
            v.unshift(lhs.values.pop());
        }
        // eslint-disable-next-line
        this.keys.unshift(lhs.keys.pop());
    }
    splitOffRightSide() {
        // Reminder: parent node must update its copy of key for this node
        const half = this.keys.length >> 1;
        const keys = this.keys.splice(half);
        const values = this.values === undefVals ? undefVals : this.values.splice(half);
        return new BNode(keys, values);
    }
    /// //////////////////////////////////////////////////////////////////////////
    // Leaf Node: scanning & deletions //////////////////////////////////////////
    forRange(low, high, includeHigh, editMode, tree, count, onFound) {
        const cmp = tree._compare;
        let iLow, iHigh;
        if (high === low) {
            if (!includeHigh)
                return count;
            iHigh = (iLow = this.indexOf(low, -1, cmp)) + 1;
            if (iLow < 0)
                return count;
        }
        else {
            iLow = this.indexOf(low, 0, cmp);
            iHigh = this.indexOf(high, -1, cmp);
            if (iHigh < 0)
                iHigh = ~iHigh;
            else if (includeHigh === true)
                iHigh++;
        }
        const keys = this.keys;
        const values = this.values;
        if (onFound !== undefined) {
            for (let i = iLow; i < iHigh; i++) {
                const key = keys[i];
                const result = onFound(key, values[i], count++);
                if (result !== undefined) {
                    if (editMode) {
                        if (key !== keys[i] || this.isShared === true)
                            throw new Error('BTree illegally changed or cloned in editRange');
                        if (result.delete) {
                            this.keys.splice(i, 1);
                            if (this.values !== undefVals)
                                this.values.splice(i, 1);
                            tree.count--;
                            i--;
                            iHigh--;
                        }
                        else if (result.value) {
                            values[i] = result.value;
                        }
                    }
                    if (result.break !== undefined)
                        return result;
                }
            }
        }
        else
            count += iHigh - iLow;
        return count;
    }
    /** Adds entire contents of right-hand sibling (rhs is left unchanged) */
    mergeSibling(rhs, _) {
        this.keys.push.apply(this.keys, rhs.keys);
        if (this.values === undefVals) {
            if (rhs.values === undefVals)
                return;
            this.values = this.values.slice(0, this.keys.length);
        }
        this.values.push.apply(this.values, rhs.reifyValues());
    }
}
const EmptyLeaf = new BNode();
EmptyLeaf.isShared = true;
function assert(exp, ...args) {
    if (!exp) {
        args.unshift('B+ tree'); // at beginning of message
        throw new Error(args.join(' '));
    }
}
export class BTree extends Mapping {
    root = EmptyLeaf;
    count = 0;
    _maxNodeSize;
    /**
     * provides a total order over keys (and a strict partial order over the type K)
     * @returns a negative value if a < b, 0 if a === b and a positive value if a > b
     */
    _compare;
    /**
     * Initializes an empty B+ tree.
     * @param compareFn Custom function to compare pairs of elements in the tree.
     *   If not specified, defaultComparator will be used which is valid as long as K extends DefaultComparable.
     * @param entries A set of key-value pairs to initialize the tree
     * @param {number} [maxNodeSize=64] Branching factor (maximum items or children per node)
     *   Must be in range 4..256. If undefined or <4 then default is used; if >256 then 256.
     */
    constructor(entries, compareFn, maxNodeSize = 64) {
        super();
        this._maxNodeSize = maxNodeSize >= 4 ? Math.min(maxNodeSize, 256) : 64;
        this._compare = compareFn || compare;
        if (entries)
            this.extend(entries);
    }
    /** Gets the number of key-value pairs in the tree. */
    size() {
        return this.count;
    }
    /** Releases the tree so that its size is 0. */
    clear() {
        this.root = EmptyLeaf;
        this.count = 0;
    }
    /** Runs a function for each key-value pair, in order from smallest to
     *  largest key. For compatibility with ES6 Map, the argument order to
     *  the callback is backwards: value first, then key. Call forEachPair
     *  instead to receive the key as the first argument.
     * @returns the number of values that were sent to the callback,
     *        or the R value if the callback returned {break:R}. */
    forEach(iteratee) {
        return this.forEachPair((k, v) => iteratee(v, k, this));
    }
    /** Runs a function for each key-value pair, in order from smallest to
     *  largest key. The callback can return {break:R} (where R is any value
     *  except undefined) to stop immediately and return R from forEachPair.
     * @param onFound A function that is called for each key-value pair. This
     *        function can return {break:R} to stop early with result R.
     *        The reason that you must return {break:R} instead of simply R
     *        itself is for consistency with editRange(), which allows
     *        multiple actions, not just breaking.
     * @param initialCounter This is the value of the third argument of
     *        `onFound` the first time it is called. The counter increases
     *        by one each time `onFound` is called. Default value: 0
     * @returns the number of pairs sent to the callback (plus initialCounter,
     *        if you provided one). If the callback returned {break:R} then
     *        the R value is returned instead. */
    forEachPair(callback, initialCounter) {
        const low = this.minKey();
        const high = this.maxKey();
        // eslint-disable-next-line
        return this.rangeForEach(low, high, true, callback, initialCounter);
    }
    /**
     * Finds a pair in the tree and returns the associated value.
     * @param defaultValue a value to return if the key was not found.
     * @returns the value, or defaultValue if the key was not found.
     * @description Computational complexity: O(log size)
     */
    get(key, defaultValue) {
        return this.root.get(key, defaultValue, this);
    }
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
    set(key, value) {
        if (this.root.isShared)
            this.root = this.root.clone();
        const result = this.root.set(key, value, true, this);
        if (result === true || result === false)
            return result;
        // Root node has split, so create a new root node.
        this.root = new BNodeInternal([this.root, result]);
        return true;
    }
    add(key) {
        return this.set(key, undefined);
    }
    /**
     * Returns true if the key exists in the B+ tree, false if not.
     * @param key Key to detect
     * @description Computational complexity: O(log size)
     */
    contains(key) {
        return this.get(key) !== undefined;
    }
    /**
     * Removes a single key-value pair from the B+ tree.
     * @param key Key to find
     * @returns true if a pair was found and removed, false otherwise.
     * @description Computational complexity: O(log size)
     */
    remove(key) {
        return this.rangeUpdate(key, key, true, DeleteRange) !== 0;
    }
    /** Returns an iterator that provides items in order (ascending order if
     *  the collection's comparator uses ascending order, as is the default.)
     *  @param lowestKey First key to be iterated, or undefined to start at
     *         minKey(). If the specified key doesn't exist then iteration
     *         starts at the next higher key (according to the comparator).
     *  @param reusedArray Optional array used repeatedly to store key-value
     *         pairs, to avoid creating a new array on every iteration.
     */
    entries(lowestKey, reusedArray) {
        const info = this.findPath(lowestKey);
        if (info === undefined)
            return iterator();
        let { nodequeue, nodeindex, leaf } = info;
        let state = reusedArray !== undefined ? 1 : 0;
        let i = lowestKey === undefined ? -1 : leaf.indexOf(lowestKey, 0, this._compare) - 1;
        return iterator(() => {
            // eslint-disable-next-line
            jump: while (true) {
                switch (state) {
                    case 0:
                        if (++i < leaf.keys.length)
                            return { done: false, value: [leaf.keys[i], leaf.values[i]] };
                        state = 2;
                        continue;
                    case 1:
                        if (++i < leaf.keys.length) {
                            // eslint-disable-next-line
                            reusedArray[0] = leaf.keys[i];
                            // eslint-disable-next-line
                            reusedArray[1] = leaf.values[i];
                            return { done: false, value: reusedArray };
                        }
                        state = 2;
                    // eslint-disable-next-line
                    case 2:
                        // Advance to the next leaf node
                        // eslint-disable-next-line
                        let level = -1;
                        while (true) {
                            if (++level >= nodequeue.length) {
                                state = 3;
                                // eslint-disable-next-line
                                continue jump;
                            }
                            if (++nodeindex[level] < nodequeue[level].length)
                                break;
                        }
                        for (; level > 0; level--) {
                            nodequeue[level - 1] = nodequeue[level][nodeindex[level]].children;
                            nodeindex[level - 1] = 0;
                        }
                        leaf = nodequeue[0][nodeindex[0]];
                        i = -1;
                        state = reusedArray !== undefined ? 1 : 0;
                        continue;
                    case 3:
                        return { done: true, value: undefined };
                }
            }
        });
    }
    /** Returns an iterator that provides items in reversed order.
     *  @param highestKey Key at which to start iterating, or undefined to
     *         start at maxKey(). If the specified key doesn't exist then iteration
     *         starts at the next lower key (according to the comparator).
     *  @param reusedArray Optional array used repeatedly to store key-value
     *         pairs, to avoid creating a new array on every iteration.
     *  @param skipHighest Iff this flag is true and the highestKey exists in the
     *         collection, the pair matching highestKey is skipped, not iterated.
     */
    reversed(highestKey, reusedArray, skipHighest) {
        if (highestKey === undefined) {
            highestKey = this.maxKey();
            skipHighest = undefined;
            if (highestKey === undefined)
                return iterator(); // collection is empty
        }
        // eslint-disable-next-line
        let { nodequeue, nodeindex, leaf } = this.findPath(highestKey) || this.findPath(this.maxKey());
        assert(!nodequeue[0] || leaf === nodequeue[0][nodeindex[0]], 'wat!');
        let i = leaf.indexOf(highestKey, 0, this._compare);
        if (!skipHighest && i < leaf.keys.length && this._compare(leaf.keys[i], highestKey) <= 0)
            i++;
        let state = reusedArray !== undefined ? 1 : 0;
        return iterator(() => {
            // eslint-disable-next-line
            jump: while (true) {
                switch (state) {
                    case 0:
                        if (--i >= 0)
                            return { done: false, value: [leaf.keys[i], leaf.values[i]] };
                        state = 2;
                        continue;
                    case 1:
                        if (--i >= 0) {
                            // eslint-disable-next-line
                            reusedArray[0] = leaf.keys[i];
                            // eslint-disable-next-line
                            reusedArray[1] = leaf.values[i];
                            return { done: false, value: reusedArray };
                        }
                        state = 2;
                    // eslint-disable-next-line
                    case 2:
                        // Advance to the next leaf node
                        // eslint-disable-next-line
                        let level = -1;
                        while (true) {
                            if (++level >= nodequeue.length) {
                                state = 3;
                                // eslint-disable-next-line
                                continue jump;
                            }
                            if (--nodeindex[level] >= 0)
                                break;
                        }
                        for (; level > 0; level--) {
                            nodequeue[level - 1] = nodequeue[level][nodeindex[level]].children;
                            nodeindex[level - 1] = nodequeue[level - 1].length - 1;
                        }
                        leaf = nodequeue[0][nodeindex[0]];
                        i = leaf.keys.length;
                        state = reusedArray !== undefined ? 1 : 0;
                        continue;
                    case 3:
                        return { done: true, value: undefined };
                }
            }
        });
    }
    /* Used by entries() and entriesReversed() to prepare to start iterating.
     * It develops a "node queue" for each non-leaf level of the tree.
     * Levels are numbered "bottom-up" so that level 0 is a list of leaf
     * nodes from a low-level non-leaf node. The queue at a given level L
     * consists of nodequeue[L] which is the children of a BNodeInternal,
     * and nodeindex[L], the current index within that child list, such
     * such that nodequeue[L-1] === nodequeue[L][nodeindex[L]].children.
     * (However inside this function the order is reversed.)
     * @private
     */
    findPath(key) {
        let nextnode = this.root;
        let nodequeue, nodeindex;
        if (nextnode.isLeaf) {
            // use preallocated empty
            nodequeue = EmptyArray;
            nodeindex = EmptyArray;
        }
        else {
            nodequeue = [];
            nodeindex = [];
            for (let d = 0; !nextnode.isLeaf; d++) {
                nodequeue[d] = nextnode.children;
                nodeindex[d] = key === undefined ? 0 : nextnode.indexOf(key, 0, this._compare);
                if (nodeindex[d] >= nodequeue[d].length)
                    return; // first key > maxKey()
                nextnode = nodequeue[d][nodeindex[d]];
            }
            nodequeue.reverse();
            nodeindex.reverse();
        }
        return { nodequeue, nodeindex, leaf: nextnode };
    }
    /** Returns a new iterator for iterating the keys of each pair in ascending order.
     *  @param firstKey: Minimum key to include in the output. */
    keys(firstKey) {
        const it = this.entries(firstKey, ReusedArray);
        return iterator(() => {
            const n = it.next();
            if (n.value)
                n.value = n.value[0];
            return n;
        });
    }
    /** Gets the lowest key in the tree. Complexity: O(log size) */
    minKey() {
        return this.root.minKey();
    }
    /** Gets the highest key in the tree. Complexity: O(1) */
    maxKey() {
        return this.root.maxKey();
    }
    /** Returns a new iterator for iterating the values of each pair in order by key.
     *  @param firstKey: Minimum key whose associated value is included in the output. */
    values(firstKey) {
        const it = this.entries(firstKey, ReusedArray);
        return iterator(() => {
            const n = it.next();
            if (n.value)
                n.value = n.value[1];
            return n;
        });
    }
    /// //////////////////////////////////////////////////////////////////////////
    // Additional methods ///////////////////////////////////////////////////////
    /** Returns the maximum number of children/values before nodes will split. */
    get maxNodeSize() {
        return this._maxNodeSize;
    }
    // /** Quickly clones the tree by marking the root node as shared.
    //  *  Both copies remain editable. When you modify either copy, any
    //  *  nodes that are shared (or potentially shared) between the two
    //  *  copies are cloned so that the changes do not affect other copies.
    //  *  This is known as copy-on-write behavior, or "lazy copying". */
    // clone(): BTree<K, V> {
    //   this.root.isShared = true
    //   let result = new BTree<K, V>(undefined, this._compare, this._maxNodeSize)
    //   result.root = this.root
    //   result.count = this.count
    //   return result
    // }
    /** Performs a deep cloning of the tree, immediately duplicating any nodes that are
     *  not currently marked as shared, in order to avoid marking any
     *  additional nodes as shared.
     *  @param force Clone all nodes, even shared ones.
     */
    clone(force = false) {
        const result = new BTree(undefined, this._compare, this._maxNodeSize);
        result.root = this.root.greedyClone(force);
        result.count = this.count;
        return result;
    }
    /** Gets an array filled with the contents of the tree, sorted by key */
    toArray() {
        const min = this.minKey();
        const max = this.maxKey();
        const maxLength = 2147483647;
        if (min !== undefined)
            return this.keysRange(min, max, true, maxLength);
        return [];
    }
    /** Gets a string representing the tree's data based on toArray(). */
    toString() {
        return this.toArray().toString();
    }
    /** Returns the next pair whose key is larger than the specified key (or undefined if there is none).
     * If key === undefined, this function returns the lowest pair.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     * avoid creating a new array on every iteration.
     */
    lowerBound(key, reusedArray) {
        reusedArray = reusedArray || [];
        if (key === undefined) {
            return this.root.minPair(reusedArray);
        }
        return this.root.getPairOrNextHigher(key, this._compare, false, reusedArray);
    }
    /** Returns the next key larger than the specified key, or undefined if there is none.
     *  Also, nextHigherKey(undefined) returns the lowest key.
     */
    // nextHigherKey(key: K | undefined): K | undefined {
    //   let p = this.after(key, ReusedArray as [K, V])
    //   return p && p[0]
    // }
    /** Returns the next pair whose key is smaller than the specified key (or undefined if there is none).
     *  If key === undefined, this function returns the highest pair.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     *        avoid creating a new array each time you call this method.
     */
    upperBound(key, reusedArray) {
        reusedArray = reusedArray || [];
        if (key === undefined) {
            return this.root.maxPair(reusedArray);
        }
        return this.root.getPairOrNextLower(key, this._compare, false, reusedArray);
    }
    /** Returns the next key smaller than the specified key, or undefined if there is none.
     *  Also, nextLowerKey(undefined) returns the highest key.
     */
    // nextLowerKey(key: K | undefined): K | undefined {
    //   let p = this.before(key, ReusedArray as [K, V])
    //   return p && p[0]
    // }
    /** Returns the key-value pair associated with the supplied key if it exists
     *  or the pair associated with the next lower pair otherwise. If there is no
     *  next lower pair, undefined is returned.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     *        avoid creating a new array each time you call this method.
     * */
    floor(key, reusedArray) {
        return this.root.getPairOrNextLower(key, this._compare, true, reusedArray || []);
    }
    /** Returns the key-value pair associated with the supplied key if it exists
     *  or the pair associated with the next lower pair otherwise. If there is no
     *  next lower pair, undefined is returned.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     *        avoid creating a new array each time you call this method.
     * */
    ceiling(key, reusedArray) {
        return this.root.getPairOrNextHigher(key, this._compare, true, reusedArray || []);
    }
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
    keysRange(low, high, includeHigh, maxLength = 0x3ffffff) {
        const results = [];
        this.root.forRange(low, high, includeHigh, false, this, 0, (k, v) => {
            results.push([k, v]);
            return results.length > maxLength ? Break : undefined;
        });
        return results;
    }
    /** Adds all pairs from a list of key-value pairs.
     * @param entries Pairs to add to this tree. If there are duplicate keys,
     *        later pairs currently overwrite earlier ones (e.g. [[0,1],[0,7]]
     *        associates 0 with 7.)
     * @returns The number of pairs added to the collection.
     * @description Computational complexity: O(pairs.length * log(size + pairs.length))
     */
    extend(entries) {
        let added = 0;
        for (let i = 0; i < entries.length; i++)
            if (this.set(entries[i][0], entries[i][1]))
                added++;
        return added;
    }
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
    rangeForEach(low, high, includeHigh, onFound, initialCounter) {
        const r = this.root.forRange(low, high, includeHigh, false, this, initialCounter || 0, onFound);
        return typeof r === 'number' ? r : r.break;
    }
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
    rangeUpdate(low, high, includeHigh, onFound, initialCounter) {
        let root = this.root;
        if (root.isShared)
            this.root = root = root.clone();
        try {
            const r = root.forRange(low, high, includeHigh, true, this, initialCounter || 0, onFound);
            return typeof r === 'number' ? r : r.break;
        }
        finally {
            let isShared;
            while (root.keys.length <= 1 && !root.isLeaf) {
                isShared ||= root.isShared;
                this.root = root =
                    root.keys.length === 0 ? EmptyLeaf : root.children[0];
            }
            // If any ancestor of the new root was shared, the new root must also be shared
            if (isShared) {
                root.isShared = true;
            }
        }
    }
    /**
     * Removes a range of key-value pairs from the B+ tree.
     * @param low The first key scanned will be greater than or equal to `low`.
     * @param high Scanning stops when a key larger than this is reached.
     * @param includeHigh Specifies whether the `high` key, if present, is deleted.
     * @returns The number of key-value pairs that were deleted.
     * @description Computational complexity: O(log size + number of items deleted)
     */
    removeRange(low, high, includeHigh) {
        return this.rangeUpdate(low, high, includeHigh, DeleteRange);
    }
    /** Removes a series of keys from the collection. */
    removeKeys(keys) {
        let r = 0;
        for (let i = 0; i < keys.length; i++)
            if (this.remove(keys[i]))
                r++;
        return r;
    }
    /** Gets the height of the tree: the number of internal nodes between the
     *  BTree object and its leaf nodes (zero if there are no internal nodes). */
    get height() {
        let node = this.root;
        let height = -1;
        while (node) {
            height++;
            node = node.isLeaf ? undefined : node?.children?.[0];
        }
        return height;
    }
    /** Makes the object read-only to ensure it is not accidentally modified.
     *  Freezing does not have to be permanent; unfreeze() reverses the effect.
     *  This is accomplished by replacing mutator functions with a function
     *  that throws an Error. Compared to using a property (e.g. this.isFrozen)
     *  this implementation gives better performance in non-frozen BTrees.
     */
    freeze() {
        const t = this;
        // Note: all other mutators ultimately call set() or editRange()
        //       so we don't need to override those others.
        t.clear = t.set = t.editRange = () => TypeError('Attempted to modify a frozen BTree');
    }
    [Symbol.iterator]() {
        return this.entries();
    }
}
function iterator(next = () => ({ done: true, value: undefined })) {
    return {
        next,
        [Symbol.iterator]() {
            return this;
        }
    };
}
/** Internal node (non-leaf node) ********************************************/
class BNodeInternal extends BNode {
    // Note: conventionally B+ trees have one fewer key than the number of
    // children, but I find it easier to keep the array lengths equal: each
    // keys[i] caches the value of children[i].maxKey().
    children;
    /**
     * This does not mark `children` as shared, so it is the responsibility of the caller
     * to ensure children are either marked shared, or aren't included in another tree.
     */
    constructor(children, keys) {
        if (!keys) {
            keys = [];
            for (let i = 0; i < children.length; i++)
                keys[i] = children[i].maxKey();
        }
        super(keys);
        this.children = children;
    }
    clone() {
        const children = this.children.slice(0);
        for (let i = 0; i < children.length; i++)
            children[i].isShared = true;
        return new BNodeInternal(children, this.keys.slice(0));
    }
    greedyClone(force) {
        if (this.isShared && !force)
            return this;
        const nu = new BNodeInternal(this.children.slice(0), this.keys.slice(0));
        for (let i = 0; i < nu.children.length; i++)
            nu.children[i] = nu.children[i].greedyClone(force);
        return nu;
    }
    minKey() {
        return this.children[0].minKey();
    }
    minPair(reusedArray) {
        return this.children[0].minPair(reusedArray);
    }
    maxPair(reusedArray) {
        return this.children[this.children.length - 1].maxPair(reusedArray);
    }
    get(key, defaultValue, tree) {
        const i = this.indexOf(key, 0, tree._compare);
        const children = this.children;
        return i < children.length ? children[i].get(key, defaultValue, tree) : undefined;
    }
    getPairOrNextLower(key, compare, inclusive, reusedArray) {
        const i = this.indexOf(key, 0, compare);
        const children = this.children;
        if (i >= children.length)
            return this.maxPair(reusedArray);
        const result = children[i].getPairOrNextLower(key, compare, inclusive, reusedArray);
        if (result === undefined && i > 0) {
            return children[i - 1].maxPair(reusedArray);
        }
        return result;
    }
    getPairOrNextHigher(key, compare, inclusive, reusedArray) {
        const i = this.indexOf(key, 0, compare);
        const children = this.children;
        const length = children.length;
        if (i >= length)
            return undefined;
        const result = children[i].getPairOrNextHigher(key, compare, inclusive, reusedArray);
        if (result === undefined && i < length - 1) {
            return children[i + 1].minPair(reusedArray);
        }
        return result;
    }
    checkValid(depth, tree, baseIndex) {
        const kL = this.keys.length;
        const cL = this.children.length;
        assert(kL === cL, 'keys/children length mismatch: depth', depth, 'lengths', kL, cL, 'baseIndex', baseIndex);
        assert(kL > 1 || depth > 0, 'internal node has length', kL, 'at depth', depth, 'baseIndex', baseIndex);
        let size = 0;
        const c = this.children;
        const k = this.keys;
        let childSize = 0;
        for (let i = 0; i < cL; i++) {
            size += c[i].checkValid(depth + 1, tree, baseIndex + size);
            childSize += c[i].keys.length;
            assert(size >= childSize, 'wtf', baseIndex); // no way this will ever fail
            assert(i === 0 || c[i - 1].constructor === c[i].constructor, 'type mismatch, baseIndex:', baseIndex);
            if (c[i].maxKey() !== k[i])
                assert(false, 'keys[', i, '] =', k[i], 'is wrong, should be ', c[i].maxKey(), 'at depth', depth, 'baseIndex', baseIndex);
            if (!(i === 0 || tree._compare(k[i - 1], k[i]) < 0))
                assert(false, 'sort violation at depth', depth, 'index', i, 'keys', k[i - 1], k[i]);
        }
        // 2020/08: BTree doesn't always avoid grossly undersized nodes,
        // but AFAIK such nodes are pretty harmless, so accept them.
        const toofew = childSize === 0; // childSize < (tree.maxNodeSize >> 1)*cL;
        if (toofew || childSize > tree.maxNodeSize * cL)
            assert(false, toofew ? 'too few' : 'too many', 'children (', childSize, size, ') at depth', depth, 'maxNodeSize:', tree.maxNodeSize, 'children.length:', cL, 'baseIndex:', baseIndex);
        return size;
    }
    /// //////////////////////////////////////////////////////////////////////////
    // Internal Node: set & node splitting //////////////////////////////////////
    set(key, value, overwrite, tree) {
        const c = this.children;
        const max = tree._maxNodeSize;
        const cmp = tree._compare;
        let i = Math.min(this.indexOf(key, 0, cmp), c.length - 1);
        let child = c[i];
        if (child.isShared)
            c[i] = child = child.clone();
        if (child.keys.length >= max) {
            // child is full; inserting anything else will cause a split.
            // Shifting an item to the left or right sibling may avoid a split.
            // We can do a shift if the adjacent node is not full and if the
            // current key can still be placed in the same node after the shift.
            let other;
            if (i > 0 && (other = c[i - 1]).keys.length < max && cmp(child.keys[0], key) < 0) {
                if (other.isShared)
                    c[i - 1] = other = other.clone();
                other.takeFromRight(child);
                this.keys[i - 1] = other.maxKey();
            }
            else if ((other = c[i + 1]) !== undefined &&
                other.keys.length < max &&
                cmp(child.maxKey(), key) < 0) {
                if (other.isShared)
                    c[i + 1] = other = other.clone();
                other.takeFromLeft(child);
                this.keys[i] = c[i].maxKey();
            }
        }
        const result = child.set(key, value, overwrite, tree);
        if (result === false)
            return false;
        this.keys[i] = child.maxKey();
        if (result === true)
            return true;
        // The child has split and `result` is a new right child... does it fit?
        if (this.keys.length < max) {
            // yes
            this.insert(i + 1, result);
            return true;
        }
        else {
            // no, we must split also
            const newRightSibling = this.splitOffRightSide();
            let target = this;
            if (cmp(result.maxKey(), this.maxKey()) > 0) {
                target = newRightSibling;
                i -= this.keys.length;
            }
            target.insert(i + 1, result);
            return newRightSibling;
        }
    }
    /**
     * Inserts `child` at index `i`.
     * This does not mark `child` as shared, so it is the responsibility of the caller
     * to ensure that either child is marked shared, or it is not included in another tree.
     */
    insert(i, child) {
        this.children.splice(i, 0, child);
        this.keys.splice(i, 0, child.maxKey());
    }
    /**
     * Split this node.
     * Modifies this to remove the second half of the items, returning a separate node containing them.
     */
    splitOffRightSide() {
        // assert !this.isShared;
        const half = this.children.length >> 1;
        return new BNodeInternal(this.children.splice(half), this.keys.splice(half));
    }
    takeFromRight(rhs) {
        // Reminder: parent node must update its copy of key for this node
        // assert: neither node is shared
        // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
        // eslint-disable-next-line
        this.keys.push(rhs.keys.shift());
        // eslint-disable-next-line
        this.children.push(rhs.children.shift());
    }
    takeFromLeft(lhs) {
        // Reminder: parent node must update its copy of key for this node
        // assert: neither node is shared
        // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
        // eslint-disable-next-line
        this.keys.unshift(lhs.keys.pop());
        // eslint-disable-next-line
        this.children.unshift(lhs.children.pop());
    }
    /// //////////////////////////////////////////////////////////////////////////
    // Internal Node: scanning & deletions //////////////////////////////////////
    // Note: `count` is the next value of the third argument to `onFound`.
    //       A leaf node's `forRange` function returns a new value for this counter,
    //       unless the operation is to stop early.
    forRange(low, high, includeHigh, editMode, tree, count, onFound) {
        const cmp = tree._compare;
        const keys = this.keys;
        const children = this.children;
        let iLow = this.indexOf(low, 0, cmp);
        let i = iLow;
        const iHigh = Math.min(high === low ? iLow : this.indexOf(high, 0, cmp), keys.length - 1);
        if (!editMode) {
            // Simple case
            for (; i <= iHigh; i++) {
                const result = children[i].forRange(low, high, includeHigh, editMode, tree, count, onFound);
                if (typeof result !== 'number')
                    return result;
                count = result;
            }
        }
        else if (i <= iHigh) {
            try {
                for (; i <= iHigh; i++) {
                    if (children[i].isShared)
                        children[i] = children[i].clone();
                    const result = children[i].forRange(low, high, includeHigh, editMode, tree, count, onFound);
                    // Note: if children[i] is empty then keys[i]=undefined.
                    //       This is an invalid state, but it is fixed below.
                    keys[i] = children[i].maxKey();
                    if (typeof result !== 'number')
                        return result;
                    count = result;
                }
            }
            finally {
                // Deletions may have occurred, so look for opportunities to merge nodes.
                const half = tree._maxNodeSize >> 1;
                if (iLow > 0)
                    iLow--;
                for (i = iHigh; i >= iLow; i--) {
                    if (children[i].keys.length <= half) {
                        if (children[i].keys.length !== 0) {
                            this.tryMerge(i, tree._maxNodeSize);
                        }
                        else {
                            // child is empty! delete it!
                            keys.splice(i, 1);
                            children.splice(i, 1);
                        }
                    }
                }
                if (children.length !== 0 && children[0].keys.length === 0)
                    assert(false, 'emptiness bug');
            }
        }
        return count;
    }
    /** Merges child i with child i+1 if their combined size is not too large */
    tryMerge(i, maxSize) {
        const children = this.children;
        if (i >= 0 && i + 1 < children.length) {
            if (children[i].keys.length + children[i + 1].keys.length <= maxSize) {
                if (children[i].isShared)
                    // cloned already UNLESS i is outside scan range
                    children[i] = children[i].clone();
                children[i].mergeSibling(children[i + 1], maxSize);
                children.splice(i + 1, 1);
                this.keys.splice(i + 1, 1);
                this.keys[i] = children[i].maxKey();
                return true;
            }
        }
        return false;
    }
    /**
     * Move children from `rhs` into this.
     * `rhs` must be part of this tree, and be removed from it after this call
     * (otherwise isShared for its children could be incorrect).
     */
    mergeSibling(rhs, maxNodeSize) {
        // assert !this.isShared;
        const oldLength = this.keys.length;
        this.keys.push.apply(this.keys, rhs.keys);
        const rhsChildren = rhs.children;
        this.children.push.apply(this.children, rhsChildren);
        if (rhs.isShared && !this.isShared) {
            // All children of a shared node are implicitly shared, and since their new
            // parent is not shared, they must now be explicitly marked as shared.
            for (let i = 0; i < rhsChildren.length; i++)
                rhsChildren[i].isShared = true;
        }
        // If our children are themselves almost empty due to a mass-delete,
        // they may need to be merged too (but only the oldLength-1 and its
        // right sibling should need this).
        this.tryMerge(oldLength - 1, maxNodeSize);
    }
}
