import { MapCollection } from './abc.js'

interface Entry<K, V> {
  readonly key: K
  value: V
  older?: Entry<K, V>
  newer?: Entry<K, V>
}

/**
 * Fixed-capacity Least Recently Used cache. `get` refreshes recency; `has` does not. Iterators and
 * `forEach` walk a snapshot taken when they start, so `get` and `set` inside a loop are safe.
 *
 * Recency lives in a linked list. Keeping it in a Map's insertion order would need a delete and a
 * set per hit, and V8 scans the slots those leave behind, so hot keys and evictions cost O(capacity).
 *
 * @template K, V
 */
export class LRUCache<K = unknown, V = unknown> extends MapCollection<K, V> {
  readonly #items = new Map<K, Entry<K, V>>()
  readonly #capacity: number
  #oldest?: Entry<K, V>
  #newest?: Entry<K, V>

  /**
   * @param capacity Maximum number of entries; must be an integer >= 1.
   * @throws {RangeError} when capacity is not an integer >= 1.
   */
  constructor(capacity = 1024) {
    super()
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('capacity must be an integer >= 1')
    }
    this.#capacity = capacity
  }

  /**
   * Set `key` to `value`. Updating an existing key does not evict. Inserting a new key at
   * capacity evicts the least recently used entry.
   */
  set(key: K, value: V): this {
    const entry = this.#items.get(key)
    if (entry !== undefined) {
      entry.value = value
      this.#refresh(entry)
      return this
    }
    const oldest = this.#oldest
    if (oldest !== undefined && this.#items.size >= this.#capacity) {
      this.#unlink(oldest)
      this.#items.delete(oldest.key)
    }
    const added: Entry<K, V> = { key, value }
    this.#items.set(key, added)
    this.#append(added)
    return this
  }

  has(key: K): boolean {
    return this.#items.has(key)
  }

  /**
   * Return the value for `key`, refreshing its recency. Missing keys return `undefined`.
   */
  get(key: K): V | undefined {
    const entry = this.#items.get(key)
    if (entry === undefined) return undefined
    this.#refresh(entry)
    return entry.value
  }

  clear(): void {
    this.#items.clear()
    this.#oldest = undefined
    this.#newest = undefined
  }

  delete(key: K): boolean {
    const entry = this.#items.get(key)
    if (entry === undefined) return false
    this.#unlink(entry)
    return this.#items.delete(key)
  }

  get size(): number {
    return this.#items.size
  }

  protected override cloneFrom(entries: Iterable<[K, V]>): this {
    const copy = Reflect.construct(this.constructor, [this.#capacity]) as this
    for (const [k, v] of entries) copy.set(k, v)
    return copy
  }

  /** Maximum number of entries. */
  get capacity(): number {
    return this.#capacity
  }

  readonly [Symbol.toStringTag] = 'LRUCache'

  keys(): IteratorObject<K> {
    return this.#snapshot()
      .map((entry) => entry.key)
      .values()
  }

  values(): IteratorObject<V> {
    return this.#snapshot()
      .map((entry) => entry.value)
      .values()
  }

  entries(): IteratorObject<[K, V]> {
    return this.#snapshot()
      .map((entry): [K, V] => [entry.key, entry.value])
      .values()
  }

  #snapshot(): Entry<K, V>[] {
    const entries: Entry<K, V>[] = []
    for (let entry = this.#oldest; entry !== undefined; entry = entry.newer) entries.push(entry)
    return entries
  }

  #refresh(entry: Entry<K, V>): void {
    if (entry === this.#newest) return
    this.#unlink(entry)
    this.#append(entry)
  }

  #unlink(entry: Entry<K, V>): void {
    const { older, newer } = entry
    if (older === undefined) this.#oldest = newer
    else older.newer = newer
    if (newer === undefined) this.#newest = older
    else newer.older = older
    entry.older = undefined
    entry.newer = undefined
  }

  #append(entry: Entry<K, V>): void {
    entry.older = this.#newest
    if (this.#newest === undefined) this.#oldest = entry
    else this.#newest.newer = entry
    this.#newest = entry
  }
}
