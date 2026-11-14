import { arrayFromIterable } from './internal/iterable.ts'
import { SortedMap } from './sorted-map.ts'

/** `[value, true]` pairs from last to first, made one at a time so no pair outlives its read. */
function* entriesLastToFirst<T>(values: readonly T[]): Generator<[T, true]> {
  for (let i = values.length - 1; i >= 0; i--) yield [values[i], true]
}

/**
 * A set whose values stay sorted, on the same B+ tree as {@link SortedMap}. It has `Set`'s core
 * method names (`has`, `add`, `delete`, `keys`, ...), so it can be the argument of `Set`'s ES2025
 * set algebra (`union`, `intersection`, ...) but has none of those methods itself. It iterates in
 * order, and adds `first`, `last`, `lower`, `higher`, `floor`, `ceiling`, `at`, `rank` and range
 * queries in O(log n). Values the comparator calls equal are the same value: `add` of one keeps the
 * value already there. A `-0` is stored as `+0`, as `Set` does. With the default comparator, values
 * are numbers, bigints or strings: `NaN` throws `RangeError`, and `null`, `undefined` and other
 * values throw `TypeError`; pass a comparator to order them.
 *
 * Every lookup runs the comparator, so `has` of a value it cannot order throws instead of returning
 * `false`. The same goes for `Set` methods that call `has` on a `SortedSet` argument: with the
 * default comparator, `new Set(['x']).isSubsetOf(new SortedSet([1]))` throws `TypeError`.
 *
 * @example
 * ```ts
 * const ids = new SortedSet([30, 10, 20, 10])
 * ;[...ids] // [10, 20, 30]
 * ids.higher(10) // 20
 * ids.rank(25) // 2
 * ```
 */
export class SortedSet<T = unknown> {
  readonly #map: SortedMap<T, true>

  /**
   * Create a set holding `values`; when values repeat, the first one seen is kept.
   * @param values Initial values. `null` means none, as for `Set`.
   * @param compareFn Comparator. Defaults to the primitive order (numbers, bigints and strings).
   * @throws {TypeError} when `values` is not iterable or the comparator cannot order a value.
   * @throws {RangeError} when `values` is a huge sparse array, or holds `NaN` under the default
   * comparator.
   */
  constructor(values?: Iterable<T> | null, compareFn?: ((a: T, b: T) => number) | null) {
    if (values == null) {
      this.#map = new SortedMap<T, true>(undefined, compareFn)
      return
    }
    // SortedMap's bulk load keeps the last of equal keys, so loading back to front keeps the first.
    this.#map = new SortedMap<T, true>(entriesLastToFirst(arrayFromIterable<T>(values)), compareFn)
  }

  /** The number of values. */
  get size(): number {
    return this.#map.size
  }

  /** `'SortedSet'`, for `Object.prototype.toString`. */
  get [Symbol.toStringTag](): string {
    return 'SortedSet'
  }

  /**
   * Insert `value` unless an equal value is present. O(log n).
   * @returns `this`
   * @throws {TypeError} when the comparator cannot order `value`; the set is unchanged.
   */
  add(value: T): this {
    if (!this.#map.has(value)) this.#map.set(value, true)
    return this
  }

  /** Whether a value equal to `value` is present. O(log n). */
  has(value: T): boolean {
    return this.#map.has(value)
  }

  /**
   * Remove the value equal to `value`. O(log n).
   * @returns Whether it was present.
   */
  delete(value: T): boolean {
    return this.#map.delete(value)
  }

  /** Remove every value. */
  clear(): void {
    this.#map.clear()
  }

  /** The smallest value, or `undefined` when empty. */
  first(): T | undefined {
    return this.#map.firstKey()
  }

  /** The largest value, or `undefined` when empty. */
  last(): T | undefined {
    return this.#map.lastKey()
  }

  /** The greatest value below `value`, or `undefined`. */
  lower(value: T): T | undefined {
    return this.#map.lower(value)?.[0]
  }

  /** The least value above `value`, or `undefined`. */
  higher(value: T): T | undefined {
    return this.#map.higher(value)?.[0]
  }

  /** The greatest value at or below `value`, or `undefined`. */
  floor(value: T): T | undefined {
    return this.#map.floor(value)?.[0]
  }

  /** The least value at or above `value`, or `undefined`. */
  ceiling(value: T): T | undefined {
    return this.#map.ceiling(value)?.[0]
  }

  /**
   * The value at `index` in order, with `Array.prototype.at` rules, or `undefined` out of range.
   * O(log n).
   */
  at(index: number): T | undefined {
    return this.#map.at(index)?.[0]
  }

  /**
   * How many values sort before `value`: its index when present, else where it would go. O(log n).
   * @throws {TypeError} when the comparator cannot order `value`.
   */
  rank(value: T): number {
    return this.#map.rank(value)
  }

  /**
   * The values in `[from, to)`, or `[from, to]` with `inclusiveEnd`, in order.
   * @param options `inclusiveEnd` includes `to` (default false); `limit` caps how many values are
   * collected (a non-negative integer or `Infinity`, the default).
   * @throws {TypeError} when `options` is neither `undefined` nor an object, `limit` is not a
   * number, or the comparator cannot order `from` or `to`.
   * @throws {RangeError} when `limit` is a number but not a non-negative integer or `Infinity`.
   * @example
   * ```ts
   * new SortedSet([1, 2, 3, 4]).valuesBetween(2, 4) // [2, 3]
   * ```
   */
  valuesBetween(from: T, to: T, options?: { inclusiveEnd?: boolean; limit?: number }): T[] {
    return this.#map.entriesBetween(from, to, options).map(([v]) => v)
  }

  /** The values, largest first. */
  valuesDescending(): IteratorObject<T> {
    return this.#map.entriesDescending().map(([v]) => v)
  }

  /** The values, in order. */
  values(): IteratorObject<T> {
    return this.#map.keys()
  }

  /** The values, in order, as `Set.prototype.keys` gives them. */
  keys(): IteratorObject<T> {
    return this.#map.keys()
  }

  /** `[value, value]` pairs, in order, as `Set.prototype.entries` gives them. */
  entries(): IteratorObject<[T, T]> {
    return this.#map.keys().map((v): [T, T] => [v, v])
  }

  /** Call `callback(value, value, set)` for each value, in order. */
  forEach(callback: (value: T, key: T, set: this) => void, thisArg?: unknown): void {
    for (const v of this.values()) Reflect.apply(callback, thisArg, [v, v, this])
  }

  /** The values, in order. */
  [Symbol.iterator](): IteratorObject<T> {
    return this.values()
  }
}
