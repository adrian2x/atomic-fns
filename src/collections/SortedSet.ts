import type { Comparer } from '../operators/index.js'
import { ValueCollection } from './abc.js'
import { BTree } from './BTree.js'

/**
 * Set whose values stay ordered by {@link compare} (or a supplied comparator).
 * Backed by {@link BTree}. `add` of an existing value is a no-op.
 *
 * @template T
 */
export class SortedSet<T> extends ValueCollection<T> {
  readonly #tree: BTree<T, true>
  readonly #compareFn: Comparer<T> | undefined

  /**
   * @param values Initial values.
   * @param compareFn Value comparator. Defaults to {@link compare}.
   */
  constructor(values?: Iterable<T>, compareFn?: Comparer<T>) {
    super()
    this.#compareFn = compareFn
    this.#tree = new BTree<T, true>(undefined, compareFn)
    if (values) {
      for (const x of values) this.add(x)
    }
  }

  get size(): number {
    return this.#tree.size
  }

  protected override cloneFrom(values: Iterable<T>): this {
    return new SortedSet(values, this.#compareFn) as this
  }

  readonly [Symbol.toStringTag] = 'SortedSet'

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

  /**
   * Values in descending order.
   */
  entriesReversed(): IteratorObject<[T, T]> {
    return this.#tree.entriesReversed().map(([k]): [T, T] => [k, k])
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
}
