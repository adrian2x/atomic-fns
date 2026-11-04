import { withHookNesting } from '../internal/nesting.js'
import { protocol, type Comparer } from '../operators/index.js'
import { MapCollection, sameEntrySequence } from './abc.js'
import { BTree } from './BTree.js'
import { clone } from './object.js'

function positiveZero<K>(key: K): K {
  return key === 0 ? (0 as K) : key
}

/** Items that are not entries pass through for {@link BTree} to reject. */
function* withPositiveZeroKeys<K, V>(
  entries: Iterable<readonly [K, V]>
): Generator<readonly [K, V]> {
  for (const entry of entries) {
    yield (Object(entry) as typeof entry)[0] === 0 ? [positiveZero(entry[0]), entry[1]] : entry
  }
}

/**
 * Map whose keys stay ordered by the library total-order `compare` (or a supplied comparator).
 * Backed by {@link BTree}. `set` on an existing key replaces the value and the stored key object.
 * Like native `Map`, it stores a `-0` key as `+0`.
 *
 * @template K, V
 */
export class SortedMap<K, V> extends MapCollection<K, V> {
  readonly #tree: BTree<K, V>
  readonly #compareFn: Comparer<K> | undefined

  /**
   * @param entries Initial key-value pairs; `null` means none, as for native `Map`.
   * @param compareFn Key comparator. Defaults to the library total-order `compare`.
   */
  constructor(entries?: Iterable<readonly [K, V]> | null, compareFn?: Comparer<K>) {
    super()
    this.#compareFn = compareFn
    this.#tree = new BTree(entries == null ? entries : withPositiveZeroKeys(entries), compareFn)
  }

  get size(): number {
    return this.#tree.size
  }

  get isFrozen(): boolean {
    return this.#tree.isFrozen
  }

  protected override cloneFrom(entries: Iterable<readonly [K, V]>): this {
    return Reflect.construct(this.constructor, [entries, this.#compareFn]) as this
  }

  /** Sequence equality: key order is part of meaning. */
  override [protocol.equals](other: unknown): boolean {
    return withHookNesting(() => sameEntrySequence(this, other, (c) => c.entries()))
  }

  /** Deep clone keeps keys by reference (comparator owns key identity) and deep-clones values. */
  override [protocol.clone](deep = false): this {
    return withHookNesting(() => {
      if (!deep) return this.cloneFrom(this.entries())
      return this.cloneFrom([...this.entries()].map(([k, v]): [K, V] => [k, clone(v, true)]))
    })
  }

  readonly [Symbol.toStringTag] = 'SortedMap'

  get(key: K, defaultValue?: V): V | undefined {
    return this.#tree.get(key, defaultValue)
  }

  /**
   * Insert or overwrite `key`. Replaces the stored key object as well as the value.
   * @returns `this`
   */
  set(key: K, value: V): this {
    this.#assertMutable()
    this.#tree.set(positiveZero(key), value)
    return this
  }

  has(key: K): boolean {
    return this.#tree.has(key)
  }

  delete(key: K): boolean {
    this.#assertMutable()
    return this.#tree.delete(key)
  }

  clear(): void {
    this.#assertMutable()
    this.#tree.clear()
  }

  /**
   * Smallest key, or `undefined` when empty.
   */
  min(): K | undefined {
    return this.#tree.firstKey()
  }

  /**
   * Largest key, or `undefined` when empty.
   */
  max(): K | undefined {
    return this.#tree.lastKey()
  }

  /**
   * Entries in descending key order.
   */
  entriesDescending(): IteratorObject<[K, V]> {
    return this.#tree.entriesDescending()
  }

  /**
   * Reject further mutators permanently (like `Object.freeze`).
   */
  freeze(): this {
    this.#tree.freeze()
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

  /**
   * Entry at `index` (Array.prototype.at rules), or `undefined` out of range.
   */
  at(index: number): [K, V] | undefined {
    return this.#tree.at(index)
  }

  #assertMutable(): void {
    if (this.isFrozen) throw new TypeError('SortedMap is frozen')
  }
}
