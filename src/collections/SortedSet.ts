import type { Comparer } from '../operators/index.js'
import { SetCollection } from './abc.js'
import { BTree } from './BTree.js'

/**
 * Set whose values stay ordered by {@link compare} (or a supplied comparator).
 * Backed by {@link BTree}. `add` of an existing value is a no-op.
 *
 * @template T
 */
export class SortedSet<T> extends SetCollection<T> {
  readonly #tree: BTree<T, true>

  /**
   * @param values Initial values.
   * @param compareFn Value comparator. Defaults to {@link compare}.
   */
  constructor(values?: Iterable<T>, compareFn?: Comparer<T>) {
    super()
    this.#tree = new BTree<T, true>(undefined, compareFn)
    if (values) {
      for (const x of values) this.add(x)
    }
  }

  get size(): number {
    return this.#tree.size
  }

  get [Symbol.toStringTag](): string {
    return 'SortedSet'
  }

  /**
   * Insert `value` if absent. Existing values are left unchanged.
   * @returns `this`
   */
  add(value: T): this {
    if (!this.#tree.has(value)) this.#tree.set(value, true)
    return this
  }

  has(value: T): boolean {
    return this.#tree.has(value)
  }

  delete(value: T): boolean {
    return this.#tree.delete(value)
  }

  clear(): void {
    this.#tree.clear()
  }

  /**
   * Smallest value, or `undefined` when empty.
   */
  min(): T | undefined {
    return this.#tree.minKey()
  }

  /**
   * Largest value, or `undefined` when empty.
   */
  max(): T | undefined {
    return this.#tree.maxKey()
  }

  values(): IteratorObject<T> {
    return this.#tree.keys()
  }
}
