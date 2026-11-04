import { forEachArrayElement, isTypedArray } from '../internal/iterable.js'
import { withHookNesting } from '../internal/nesting.js'
import { deepMultisetEqual } from '../operators/equality.js'
import { protocol } from '../operators/index.js'
import { clone } from './object.js'

/**
 * An immutable Set. Contents cannot change after construction.
 * `Set.prototype.add.call(fs, x)`, and likewise `delete` and `clear`, still mutate (inherent Set
 * subclass limit). Inherited methods such as `union` return a plain, mutable `Set`.
 *
 * @class FrozenSet
 * @extends {Set<T>}
 * @template T
 */
export class FrozenSet<T = unknown> extends Set<T> {
  constructor(iterable?: Iterable<T> | null) {
    super()
    if (iterable == null) return
    if (isTypedArray<T>(iterable) && iterable[Symbol.iterator] === Array.prototype.values) {
      forEachArrayElement(iterable, (x) => {
        super.add(x)
        return undefined
      })
      return
    }
    for (const x of iterable) {
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

  /** Same members under `deepEqual`, regardless of insertion order. */
  [protocol.equals](other: unknown): boolean {
    return withHookNesting(() => {
      if (this === other) return true
      if (typeof other !== 'object' || other?.constructor !== this.constructor) return false
      const peer = other as FrozenSet<T>
      if (this.size !== peer.size) return false
      return this.isSubsetOf(peer) || deepMultisetEqual([...this], [...peer])
    })
  }

  /** A distinct `FrozenSet` with the same members (deep-clones values when `deep`). */
  [protocol.clone](deep = false): this {
    return withHookNesting(() => {
      const values = deep ? [...this].map((v) => clone(v, true)) : this
      return Reflect.construct(this.constructor, [values]) as this
    })
  }

  readonly [Symbol.toStringTag] = 'FrozenSet'
}
