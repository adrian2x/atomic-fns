interface Entry<K, V> {
  readonly key: K
  value: V
  older: Entry<K, V> | undefined
  newer: Entry<K, V> | undefined
}

// Recency lives in a linked list. Keeping it in a Map's insertion order would need a delete and a
// set per hit, and V8 scans the slots those leave behind, so hot keys and evictions cost O(capacity).
// State lives in a plain non-enumerable property rather than `#private` fields, so a cache wrapped
// in a `Proxy` keeps working.
interface State<K, V> {
  readonly items: Map<K, Entry<K, V>>
  readonly capacity: number
  oldest: Entry<K, V> | undefined
  newest: Entry<K, V> | undefined
}

function refresh<K, V>(state: State<K, V>, entry: Entry<K, V>): void {
  if (entry === state.newest) return
  unlink(state, entry)
  append(state, entry)
}

function unlink<K, V>(state: State<K, V>, entry: Entry<K, V>): void {
  const { older, newer } = entry
  if (older === undefined) state.oldest = newer
  else older.newer = newer
  if (newer === undefined) state.newest = older
  else newer.older = older
  entry.older = undefined
  entry.newer = undefined
}

function append<K, V>(state: State<K, V>, entry: Entry<K, V>): void {
  entry.older = state.newest
  if (state.newest === undefined) state.oldest = entry
  else state.newest.newer = entry
  state.newest = entry
}

function snapshot<K, V>(state: State<K, V>): Entry<K, V>[] {
  const entries: Entry<K, V>[] = []
  for (let entry = state.oldest; entry !== undefined; entry = entry.newer) entries.push(entry)
  return entries
}

/**
 * A fixed-capacity least-recently-used cache with `Map`'s method names. `get` refreshes recency;
 * `has` does not. Keys compare with SameValueZero, as in `Map`. Iterators and `forEach` walk a
 * snapshot taken when they start, so `get` and `set` inside a loop are safe.
 *
 * @example
 * ```ts
 * const cache = new LRUCache<string, number>(2)
 * cache.set('a', 1).set('b', 2)
 * cache.get('a') // 1, so 'b' is now the least recent
 * cache.set('c', 3)
 * cache.has('b') // false
 * ```
 */
export class LRUCache<K = unknown, V = unknown> {
  declare private readonly state: State<K, V>

  /**
   * Create an empty cache.
   * @param capacity Maximum number of entries; must be an integer >= 1. Defaults to 1024.
   * @throws {TypeError} when capacity is not a number.
   * @throws {RangeError} when capacity is not an integer >= 1.
   */
  constructor(capacity = 1024) {
    if (typeof capacity !== 'number') throw new TypeError('capacity must be a number')
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('capacity must be an integer >= 1')
    }
    const state: State<K, V> = {
      items: new Map(),
      capacity,
      oldest: undefined,
      newest: undefined
    }
    Object.defineProperty(this, 'state', { value: state })
  }

  /**
   * Set `key` to `value`. Setting an existing key updates its value and makes it the most recent,
   * without evicting. Inserting a new key at capacity evicts the least recently used entry.
   */
  set(key: K, value: V): this {
    const { state } = this
    const entry = state.items.get(key)
    if (entry !== undefined) {
      entry.value = value
      refresh(state, entry)
      return this
    }
    const oldest = state.oldest
    if (oldest !== undefined && state.items.size >= state.capacity) {
      unlink(state, oldest)
      state.items.delete(oldest.key)
    }
    const added: Entry<K, V> = { key, value, older: undefined, newer: undefined }
    state.items.set(key, added)
    append(state, added)
    return this
  }

  /** Whether `key` is cached. Does not refresh its recency. */
  has(key: K): boolean {
    return this.state.items.has(key)
  }

  /**
   * Return the value for `key`, refreshing its recency. Missing keys return `undefined`.
   */
  get(key: K): V | undefined {
    const { state } = this
    const entry = state.items.get(key)
    if (entry === undefined) return undefined
    refresh(state, entry)
    return entry.value
  }

  /** Remove every entry. */
  clear(): void {
    const { state } = this
    state.items.clear()
    state.oldest = undefined
    state.newest = undefined
  }

  /**
   * Remove `key`.
   * @returns Whether it was present.
   */
  delete(key: K): boolean {
    const { state } = this
    const entry = state.items.get(key)
    if (entry === undefined) return false
    unlink(state, entry)
    return state.items.delete(key)
  }

  /** The number of entries. */
  get size(): number {
    return this.state.items.size
  }

  /** Maximum number of entries. */
  get capacity(): number {
    return this.state.capacity
  }

  /** `'LRUCache'`, for `Object.prototype.toString`. */
  get [Symbol.toStringTag](): string {
    return 'LRUCache'
  }

  /** The keys, least to most recently used. */
  keys(): IteratorObject<K> {
    return snapshot(this.state)
      .map((entry) => entry.key)
      .values()
  }

  /** The values, least to most recently used. */
  values(): IteratorObject<V> {
    return snapshot(this.state)
      .map((entry) => entry.value)
      .values()
  }

  /** `[key, value]` pairs, least to most recently used. */
  entries(): IteratorObject<[K, V]> {
    return snapshot(this.state)
      .map((entry): [K, V] => [entry.key, entry.value])
      .values()
  }

  /** Call `callback(value, key, cache)` for each entry, least to most recently used. */
  forEach(callback: (value: V, key: K, cache: this) => void, thisArg?: unknown): void {
    for (const [k, v] of this.entries()) Reflect.apply(callback, thisArg, [v, k, this])
  }

  /** `[key, value]` pairs, least to most recently used. */
  [Symbol.iterator](): IteratorObject<[K, V]> {
    return this.entries()
  }
}
