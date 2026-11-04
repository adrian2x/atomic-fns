import { arrayFromIterable } from '../internal/iterable.js'
import { withHookNesting } from '../internal/nesting.js'
import { protocol, type Comparer } from '../operators/index.js'
import { ValueCollection } from './abc.js'
import { BTree } from './BTree.js'
import { clone } from './object.js'

/**
 * Set whose values stay ordered by the library total-order `compare` (or a supplied comparator).
 * Backed by {@link BTree}. `add` of an existing value is a no-op. Like native `Set`, it stores
 * `-0` as `+0`.
 *
 * @template T
 */
export class SortedSet<T> extends ValueCollection<T> {
  readonly #tree: BTree<T, true>
  readonly #compareFn: Comparer<T> | undefined

  /**
   * @param values Initial values; `null` means none, as for native `Set`.
   * @param compareFn Value comparator. Defaults to the library total-order `compare`.
   */
  constructor(values?: Iterable<T> | null, compareFn?: Comparer<T>) {
    super()
    this.#compareFn = compareFn
    this.#tree = new BTree<T, true>(undefined, compareFn)
    if (values == null) return
    for (const value of arrayFromIterable<T>(values)) this.#insert(value)
  }

  get size(): number {
    return this.#tree.size
  }

  get isFrozen(): boolean {
    return this.#tree.isFrozen
  }

  protected override cloneFrom(values: Iterable<T>): this {
    return Reflect.construct(this.constructor, [values, this.#compareFn]) as this
  }

  /**
   * Deep clone deep-clones values (nested collections must hit the nesting cap). Comparator key
   * identity for object values follows the cloned value.
   */
  override [protocol.clone](deep = false): this {
    return withHookNesting(() => {
      if (!deep) return this.cloneFrom(this.values())
      return this.cloneFrom([...this.values()].map((v) => clone(v, true)))
    })
  }

  readonly [Symbol.toStringTag] = 'SortedSet'

  /**
   * Insert `value` if absent. Existing values are left unchanged.
   * @returns `this`
   */
  add(value: T): this {
    this.#assertMutable()
    this.#insert(value)
    return this
  }

  has(value: T): boolean {
    return this.#tree.has(value)
  }

  delete(value: T): boolean {
    this.#assertMutable()
    return this.#tree.delete(value)
  }

  clear(): void {
    this.#assertMutable()
    this.#tree.clear()
  }

  /**
   * Smallest value, or `undefined` when empty.
   */
  min(): T | undefined {
    return this.#tree.firstKey()
  }

  /**
   * Largest value, or `undefined` when empty.
   */
  max(): T | undefined {
    return this.#tree.lastKey()
  }

  values(): IteratorObject<T> {
    return this.#tree.keys()
  }

  /**
   * Values in descending order as `[value, value]` pairs.
   */
  entriesDescending(): IteratorObject<[T, T]> {
    return this.#tree.entriesDescending().map(([k]): [T, T] => [k, k])
  }

  /**
   * Reject further mutators permanently (like `Object.freeze`).
   */
  freeze(): this {
    this.#tree.freeze()
    return this
  }

  /**
   * Value at `index` (Array.prototype.at rules), or `undefined` out of range.
   */
  at(index: number): T | undefined {
    const entry = this.#tree.at(index)
    return entry === undefined ? undefined : entry[0]
  }

  #insert(value: T): void {
    const stored = value === 0 ? (0 as T) : value
    if (!this.#tree.has(stored)) this.#tree.set(stored, true)
  }

  #assertMutable(): void {
    if (this.isFrozen) throw new TypeError('SortedSet is frozen')
  }
}
