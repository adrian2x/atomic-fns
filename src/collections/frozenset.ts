import { protocol } from '../operators/index.js'

/**
 * An immutable Set. Contents cannot change after construction.
 * `Set.prototype.add.call(fs, x)` still mutates (inherent Set subclass limit).
 *
 * @class FrozenSet
 * @extends {Set<T>}
 * @template T
 */
export class FrozenSet<T = unknown> extends Set<T> {
  constructor(iterable?: Iterable<T> | null) {
    super()
    for (const x of iterable ?? []) {
      super.add(x)
    }
  }

  /**
   * Rejected: FrozenSet is immutable.
   * @throws {TypeError}
   */
  override add(_v: T): this {
    throw new TypeError('FrozenSet is immutable')
  }

  /**
   * Rejected: FrozenSet is immutable.
   * @throws {TypeError}
   */
  override delete(_v: T): boolean {
    throw new TypeError('FrozenSet is immutable')
  }

  /**
   * Rejected: FrozenSet is immutable.
   * @throws {TypeError}
   */
  override clear(): void {
    throw new TypeError('FrozenSet is immutable')
  }

  /** A distinct `FrozenSet` with the same members. */
  [protocol.clone](): this {
    return new FrozenSet(this) as this
  }

  readonly [Symbol.toStringTag] = 'FrozenSet'
}
