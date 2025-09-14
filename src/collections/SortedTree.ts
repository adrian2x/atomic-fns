import { Comparer } from '../operators/index.js'
import { Mapping } from './abc.js'
import { BTree } from './BTree.js'

/**
 * A `SortedTree` is a map that holds key value pairs ordered by keys. Any primitive value (and objects that implement {@link Comparable} or {@link Ordered} interfaces) can be used as keys or values.
 * @see {@link Comparable}
 * @see {@link Ordered}
 * @template K, V
 */
export class SortedTree<K, V> extends Mapping<K, V> {
  private readonly store: BTree<K, V>

  /**
   * Creates a new `SortedTree` object.
   * @param {Iterable<[K, V]>} [iterable] Initialize the tree with entries.
   * @param {Comparer} [compareFn] The `compare` function to sort keys.
   */
  constructor(iterable?: Iterable<[K, V]>, compareFn?: Comparer) {
    super()
    this.store = new BTree<K, V>(iterable, compareFn)
  }

  /**
   * Adds a new `key` with a `null` value.
   * @param {K} key
   * @returns {this} Returns the Tree object.
   */
  add(key: K): this {
    this.store.set(key, null as V)
    return this
  }

  /**
   * Returns the value associated with the `key` or `undefined`.
   * @param {K} key
   * @returns {?V} The key value or `undefined`.
   */
  get(key: K): V | undefined {
    return this.store.get(key)
  }

  /**
   * Sets the value for the given `key`.
   * @param {K} key
   * @param {V} value
   * @returns {this} Returns the Tree object.
   */
  set(key: K, value: V): this {
    this.store.set(key, value)
    return this
  }

  /**
   * Returns the smallest key in the tree.
   * @returns {?K}
   */
  min(): K | undefined {
    return this.store.minKey()
  }

  /**
   * Returns the largest key in the tree.
   * @returns {?K}
   */
  max(): K | undefined {
    return this.store.maxKey()
  }

  /**
   * Returns `true` if the `key` existed in the tree and was removed.
   * @param {K} key
   * @returns {boolean} `true` if key was removed, otherwise `false`.
   */
  delete(key: K): boolean {
    return this.store.remove(key)
  }

  /**
   * Removes all key/value pairs in the tree.
   */
  clear(): void {
    return this.store.clear()
  }

  /**
   * Freezes the tree which prevents adding, updating or removing any keys.
   * @returns {this}
   */
  freeze(): this {
    this.store.freeze()
    return this
  }

  /**
   * Returns a new iterator of `[K, V]` pairs in reverse order of keys.
   * @returns {IterableIterator<[K, V]>}
   */
  reversed(): IterableIterator<[K, V]> {
    return this.store.reversed()
  }

  /**
   * Returns the total key/value pairs in the tree.
   * @returns {number}
   */
  get size(): number {
    return this.store.size
  }

  /**
   * Check if there are no key/value pairs in the tree.
   * @returns {boolean} `true` if is empty.
   */
  empty(): boolean {
    return this.store.empty()
  }

  /**
   * Returns `true` if the `key` exists in the tree.
   * @param {K} key
   * @returns {boolean} `true` if key is found, otherwise `false`.
   */
  contains(key: K): boolean {
    return this.store.contains(key)
  }

  /**
   * Returns `true` if the `key` exists in the tree.
   * @param {K} key
   * @returns {boolean} `true` if key is found, otherwise `false`.
   */
  has(key: K): boolean {
    return this.store.contains(key)
  }

  /**
   * Returns a new iterator of all **ordered** keys in the tree.
   * @returns {IterableIterator<K>}
   */
  keys(): IterableIterator<K> {
    return this.store.keys()
  }

  /**
   * Returns a new iterator of all values **ordered** by their keys.
   * @returns {IterableIterator<V>}
   */
  values(): IterableIterator<V> {
    return this.store.values()
  }

  /**
   * Returns a new iterator of all key value pairs **ordered** by their keys.
   * @returns {IterableIterator<[K, V]>}
   */
  entries(): IterableIterator<[K, V]> {
    return this.store.entries()
  }
}
