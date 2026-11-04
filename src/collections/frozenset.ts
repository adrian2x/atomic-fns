import { forEachArrayElement, isTypedArray } from '../internal/iterable.js'
import { withHookNesting } from '../internal/nesting.js'
import { deepMultisetEqual } from '../operators/equality.js'
import { protocol } from '../operators/index.js'
import { clone, rememberDeepClone } from './object.js'

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

  /**
   * A distinct `FrozenSet` with the same members. When `deep`, an empty copy joins the clone memo
   * first and fills with deep-cloned values, so a cycle back here stays a cycle.
   */
  [protocol.clone](deep = false): this {
    return withHookNesting(() => {
      if (!deep) return Reflect.construct(this.constructor, [this]) as this
      const copy = Reflect.construct(this.constructor, []) as this
      rememberDeepClone(this, copy)
      for (const value of this) Set.prototype.add.call(copy, clone(value, true))
      return copy
    })
  }

  /** False when empty, as for Python collections. */
  [protocol.bool](): boolean {
    return this.size > 0
  }

  readonly [Symbol.toStringTag] = 'FrozenSet'
}
