import { Collection } from './abc.js'
import { SplayTree } from './SplayTree.js'

export class SortedSet<T> extends Collection {
  private readonly store: SplayTree<T>
  /**
   * Creates a new `SortedSet` object.
   * @param {Iterable<T>} [iterable] Initialize the set with entries.
   * @param {Comparer} [compareFn] The `compare` function to sort keys.
   */
  constructor(iterable?: Iterable<T>, compareFn?) {
    super()
    this.store = new SplayTree(compareFn)
    if (iterable) {
      for (const key of iterable) {
        this.store.add(key)
      }
    }
  }

  /**
   * Inserts a new value in order in the `Set`, if the value doesn't exist.
   * @param {T} value
   * @returns {this} Returns the Set object.
   */
  add(value: T) {
    this.store.add(value)
    return this
  }

  /**
   * Returns the smallest value in the set.
   * @returns {?T}
   */
  min() {
    return this.store.min()
  }

  /**
   * Returns the largest value in the set.
   * @returns {?T}
   */
  max() {
    return this.store.max()
  }

  /**
   * Removes the value from the set and returns `true` if the value was found and removed.
   * @param {T} value
   * @returns {boolean} `true` if the value was found and removed.
   */
  delete(value: T) {
    return this.store.remove(value) !== undefined
  }

  /**
   * Removes all values in the set.
   */
  clear() {
    return this.store.clear()
  }

  /**
   * Returns the total number of elements in the set.
   * @returns {number}
   */
  get size() {
    return this.store.size
  }

  /**
   * Check if there are no values in the set.
   * @returns {boolean} `true` if is empty.
   */
  empty() {
    return this.store.empty()
  }

  /**
   * Returns `true` if the `value` exists.
   * @param {T} value
   * @returns {boolean} `true` if value is found, otherwise `false`.
   */
  contains(value: T) {
    return this.store.contains(value)
  }

  /**
   * Returns `true` if the `value` exists.
   * @param {T} value
   * @returns {boolean} `true` if value is found, otherwise `false`.
   */
  has(value: T) {
    return this.store.contains(value)
  }

  /**
   * Returns a new iterator of all values **in-order**.
   * @returns {Iterable<T>}
   */
  values() {
    return this.store.keys()
  }
}
