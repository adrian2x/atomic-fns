import { KeyError } from '../globals/index.js';
import { eq, gt, lt } from '../operators/index.js';
import { Mapping } from './abc.js';
/**
 * Base SplayTree node class.
 * @private
 */
class Node {
    key;
    value;
    left;
    right;
    constructor(key, value) {
        this.key = key;
        this.value = value;
    }
    *traverse() {
        let current = this;
        while (current) {
            const left = current.left;
            if (left)
                yield* left.traverse();
            yield current;
            current = current.right;
        }
    }
    get height() {
        if (this.left && this.right)
            return 1 + Math.max(this.right.height, this.left.height);
        if (this.right)
            return 1 + this.right.height;
        if (this.left)
            return 1 + this.left.height;
        return 0;
    }
}
/**
 * A splay tree is a *self-balancing binary* search tree with the additional property that recently accessed elements are quick to access again.
 * Insertion, look-up and removal in O(log n) *amortized* time.
 * For many patterns of non-random operations splay trees can take better than logarithmic time, without requiring advance knowledge of the pattern.
 * @see {@link https://en.wikipedia.org/wiki/Splay_tree Splay tree}
 * @template {K, V}
 */
export class SplayTree extends Mapping {
    root;
    count = 0;
    size() {
        return this.count;
    }
    empty() {
        return !this.root;
    }
    get height() {
        if (!this.root)
            return 0;
        return this.root.height;
    }
    /**
     *  Returns the value for `key` or `undefined` if the key is not found.
     * @param key The key to find.
     * @returns {?V} The value for the key or `undefined`.
     */
    get(key) {
        if (!this.root)
            return;
        // Note: deterministic splaying (always moves key to front):
        // this.splay(key)
        // if (eq(key, this.root.key)) return this.root.value
        // Randomized Splay Trees https://doi.org/10.1016%2Fs0020-0190%2801%2900230-7
        // The randomized idea is only moving accessed keys with a certain probability `p`.
        // Values of `p` closer to 1 tend to perform well.
        if (Math.random() <= 0.75) {
            this.splay(key);
            if (eq(key, this.root.key))
                return this.root.value;
            else
                return undefined;
        }
        // Lookup the node down the tree
        let current = this.root;
        while (current) {
            if (eq(key, current.key))
                return current.value;
            if (lt(key, current.key))
                current = current.left;
            else
                current = current.right;
        }
    }
    /**
     * Inserts the `key` and `value` in the tree if the `key` does not exist.
     * @param {K} key A key which can be any comparable value
     * @param {V} value A value associated with the key
     * @returns
     */
    set(key, value) {
        if (!this.root) {
            this.root = new Node(key, value);
            this.count += 1;
            return;
        }
        // Splay on the key to move the last node on the search path for
        // the key to the root of the tree.
        this.splay(key);
        if (eq(key, this.root.key))
            return;
        const node = new Node(key, value);
        if (gt(key, this.root.key)) {
            node.left = this.root;
            node.right = this.root.right;
            this.root.right = undefined;
        }
        else {
            node.right = this.root;
            node.left = this.root.left;
            this.root.left = undefined;
        }
        this.root = node;
        this.count += 1;
    }
    /**
     * Removes a specified key from the tree if it exists in the tree. The removed value is returned. If the key is not found, a KeyError is thrown.
     * @param {K} key The key to remove.
     * @returns {V} The removed value associated with `key`.
     */
    remove(key) {
        if (!this.root) {
            throw new KeyError('Key not found: ' + key);
        }
        this.splay(key);
        if (!eq(key, this.root.key)) {
            throw new KeyError('Key not found: ' + key);
        }
        const removed = this.root;
        if (!this.root.left) {
            this.root = this.root.right;
        }
        else {
            const right = this.root.right;
            this.root = this.root.left;
            //
            // Splay to make sure that the new root has an empty right child.
            //
            this.splay(key);
            //
            // Insert the original right child as the right child of the new
            // root.
            //
            this.root.right = right;
        }
        this.count -= 1;
        return removed.value;
    }
    //
    //  function find(key)
    //  @param {number} key Key to find in the tree.
    //  @return {SplayTree.Node} Node having the specified key.
    //
    //
    /**
     * Returns the minimum key in the tree or subtree.
     * @returns The minimum key.
     */
    min(root = this.root) {
        if (!root)
            return;
        while (root.left) {
            root = root.left;
        }
        return root.key;
    }
    /**
     * Returns the maximum key in the tree or subtree.
     * @returns The maximum key.
     */
    max(root = this.root) {
        if (!root)
            return;
        while (root.right) {
            root = root.right;
        }
        return root.key;
    }
    /**
     * Returns the largest key that is less than a given key.
     * @param key The given key
     * @returns The largest key found or `undefined`.
     */
    lowerBound(key) {
        if (!this.root)
            return;
        // Splay on the key to move the node with the given key or the last
        // node on the search path to the top of the tree.
        this.splay(key);
        // Now the result is either the root node or the greatest node in
        // the left subtree.
        if (lt(this.root.key, key)) {
            return this.root;
        }
        else if (this.root.left) {
            return this.max(this.root.left);
        }
    }
    /**
     * This is the simplified top-down splaying method proposed by Sleator and Tarjan in {@link https://doi.org/10.1145%2F3828.3835 Self-Adjusting Binary Search Trees}.
     * @param key
     * @see {@link https://doi.org/10.1145%2F3828.3835 Self-Adjusting Binary Search Trees}
     */
    splay(key) {
        if (!this.root)
            return;
        let stub, left, right;
        // eslint-disable-next-line
        stub = left = right = new Node(null, null);
        let root = this.root;
        while (true) {
            if (lt(key, root.key)) {
                if (!root.left) {
                    break;
                }
                if (lt(key, root.left.key)) {
                    // Rotate right.
                    const tmp = root.left;
                    root.left = tmp.right;
                    tmp.right = root;
                    root = tmp;
                    if (!root.left) {
                        break;
                    }
                }
                // Link right.
                right.left = root;
                right = root;
                root = root.left;
            }
            else if (gt(key, root.key)) {
                if (!root.right) {
                    break;
                }
                if (gt(key, root.right.key)) {
                    // Rotate left.
                    const tmp = root.right;
                    root.right = tmp.left;
                    tmp.left = root;
                    root = tmp;
                    if (!root.right) {
                        break;
                    }
                }
                // Link left.
                left.right = root;
                left = root;
                root = root.right;
            }
            else {
                break;
            }
        }
        // Assemble.
        left.right = root.left;
        right.left = root.right;
        root.left = stub.right;
        root.right = stub.left;
        this.root = root;
    }
    add(key) {
        return this.set(key, undefined);
    }
    /**
     * Returns `true` if the given key is in the tree.
     * @param {K} key The key to find.
     * @returns `true` if found.
     */
    contains(key) {
        return this.get(key) !== undefined;
    }
    /** Alias of remove but just returns `true` instead of the deleted value. */
    delete(key) {
        // since remove throws, this will throw too
        this.remove(key);
        return true;
    }
    clear() {
        if (!this.root)
            return;
        this.root.left = undefined;
        this.root.right = undefined;
        this.root = undefined;
        this.count = 0;
    }
    /**
     * Returns an ordered iterable of all the keys in the tree.
     * @returns {Iterable<K>} An iterable of keys in-order.
     */
    *keys() {
        if (!this.root)
            return [];
        for (const node of this.root.traverse()) {
            yield node.key;
        }
    }
    /**
     * Returns an ordered iterable of all the keys and values in the tree.
     * @returns {Iterable<[K,V]>} A iterable of `[key, value]` pairs sorted by key.
     */
    *entries() {
        if (!this.root)
            return [];
        for (const node of this.root.traverse()) {
            yield [node.key, node.value];
        }
    }
    /**
     * Returns an ordered iterable of all the keys and values in the tree.
     * @returns {Iterable<V>} A iterable of `[key, value]` pairs sorted by key.
     */
    *values() {
        if (!this.root)
            return [];
        for (const node of this.root.traverse()) {
            yield node.value;
        }
    }
}
