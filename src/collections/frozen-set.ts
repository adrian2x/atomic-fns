import { forEachArrayElement, iteratesAsArray } from './internal/iterable.ts'

/**
 * A `Set` whose contents cannot change after construction: `add`, `delete` and `clear` throw
 * `TypeError`. Membership is SameValueZero, as for any `Set`, and every read method and the ES2025
 * set algebra (`union`, `intersection`, ...) are inherited; those return a plain, mutable `Set`.
 * `Set.prototype.add.call(frozen, x)`, `Set.prototype.delete.call(frozen, x)` and
 * `Set.prototype.clear.call(frozen)` still mutate, as with any `Set` subclass. Because it is a
 * `Set`, a FrozenSet type-checks wherever a `Set` is expected, and code there that mutates it
 * throws.
 *
 * @example
 * ```ts
 * const primaries = new FrozenSet(['red', 'green', 'blue'])
 * primaries.has('red') // true
 * primaries.add('pink') // throws TypeError
 * ```
 */
export class FrozenSet<T> extends Set<T> {
  /**
   * Create a frozen set holding `iterable`'s values. A plain array is walked in own-element time,
   * so a huge sparse array costs its elements, not its length.
   * @param iterable Initial values. `null` means none.
   * @throws {TypeError} when `iterable` is not iterable.
   */
  constructor(iterable?: Iterable<T> | null) {
    super()
    if (iterable == null) return
    if (iteratesAsArray(iterable)) {
      forEachArrayElement(iterable as T[], (x) => {
        super.add(x)
      })
      return
    }
    for (const x of iterable) {
      super.add(x)
    }
  }

  /**
   * Rejected: a FrozenSet cannot change.
   * @throws {TypeError}
   */
  override add(_value: T): this {
    throw new TypeError('FrozenSet is immutable')
  }

  /**
   * Rejected: a FrozenSet cannot change.
   * @throws {TypeError}
   */
  override delete(_value: T): boolean {
    throw new TypeError('FrozenSet is immutable')
  }

  /**
   * Rejected: a FrozenSet cannot change.
   * @throws {TypeError}
   */
  override clear(): void {
    throw new TypeError('FrozenSet is immutable')
  }

  /** `'FrozenSet'`, for `Object.prototype.toString`. */
  override get [Symbol.toStringTag](): string {
    return 'FrozenSet'
  }
}
