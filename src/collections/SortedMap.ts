import type { Comparer } from '../operators/index.js'
import { MapCollection } from './abc.js'
import { BTree } from './BTree.js'

/**
 * Map whose keys stay ordered by {@link compare} (or a supplied comparator).
 * Backed by {@link BTree}. `set` on an existing key replaces the value and the stored key object.
 *
 * @template K, V
 */
export class SortedMap<K, V> extends MapCollection<K, V> {
  readonly #tree: BTree<K, V>

  /**
   * @param entries Initial key-value pairs.
   * @param compareFn Key comparator. Defaults to {@link compare}.
   */
  constructor(entries?: Iterable<[K, V]>, compareFn?: Comparer<K>) {
    super()
    this.#tree = new BTree(entries, compareFn)
  }

  get size(): number {
    return this.#tree.size
  }

  get [Symbol.toStringTag](): string {
    return 'SortedMap'
  }

  get(key: K): V | undefined {
    return this.#tree.get(key)
  }

  /**
   * Insert or overwrite `key`. Replaces the stored key object as well as the value.
   * @returns `this`
   */
  set(key: K, value: V): this {
    this.#tree.set(key, value)
    return this
  }

  has(key: K): boolean {
    return this.#tree.has(key)
  }

  delete(key: K): boolean {
    return this.#tree.delete(key)
  }

  clear(): void {
    this.#tree.clear()
  }

  /**
   * Smallest key, or `undefined` when empty.
   */
  min(): K | undefined {
    return this.#tree.minKey()
  }

  /**
   * Largest key, or `undefined` when empty.
   */
  max(): K | undefined {
    return this.#tree.maxKey()
  }

  /**
   * Entries in reverse key order.
   */
  entriesReversed(): IteratorObject<[K, V]> {
    return this.#tree.entriesReversed()
  }

  /**
   * Reject mutators until {@link unfreeze}.
   */
  freeze(): this {
    this.#tree.freeze()
    return this
  }

  /**
   * Clear the frozen flag set by {@link freeze}.
   */
  unfreeze(): this {
    this.#tree.unfreeze()
    return this
  }

  keys(): IteratorObject<K> {
    return this.#tree.keys()
  }

  values(): IteratorObject<V> {
    return this.#tree.values()
  }

  entries(): IteratorObject<[K, V]> {
    return this.#tree.entries()
  }
}
