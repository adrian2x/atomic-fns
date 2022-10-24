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
    super(iterable)
    return this.freeze()
  }

  /** @private */
  add() {
    throw TypeError('FrozenSet cannot be modified.')
    return this // eslint-disable-line
  }

  /** @private */
  delete() {
    throw TypeError('FrozenSet cannot be modified.')
    return false // eslint-disable-line
  }

  /** @private */
  clear() {
    throw TypeError('FrozenSet cannot be modified.')
    return this // eslint-disable-line
  }

  /** @private */
  freeze() {
    return Object.freeze(this)
  }
}
