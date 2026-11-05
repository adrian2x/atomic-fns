/**
 * Returns a new immutable Set object with elements from `iterable`. Its contents cannot be altered after it's created.
 *
 *
 * @class FrozenSet
 * @extends {Set<T>}
 * @template T
 */
export class FrozenSet<T = any> extends Set<T> {
  constructor(iterable: Iterable<T>) {
    super()
    // The Set constructor would call the no-op add below and drop every item
    for (const item of iterable ?? []) super.add(item)
    return this.freeze()
  }

  /** @private */
  add(): this {
    return this
  }

  /** @private */
  delete(): boolean {
    return false
  }

  /** @private */
  clear(): this {
    return this
  }

  /** @private */
  freeze(): Readonly<this> {
    return Object.freeze(this)
  }
}
