/// <reference path='globals.d.ts'/>

import { NotImplementedError } from './globals'

/**
 * Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 *     http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * A container type that provides contains().
 *
 * @export
 * @interface Container
 */
export interface Container {
  contains: (x) => boolean
}

/**
 * These are the "rich comparison" methods, as in Python.
 *
 * @export
 * @interface Comparable
 */
export interface Comparable {
  /** x < y: calls this.lt(other) reflection. */
  lt?: (other) => boolean
  /** x ≤ y: calls this.le(other) reflection. */
  le?: (other) => boolean
  /** x == y: calls this.eq(other) reflection. */
  eq: (other) => boolean
  /** x != y: calls this.ne(other) reflection. */
  ne: (other) => boolean
  /** x > y: calls this.gt(other) reflection. */
  gt?: (other) => boolean
  /** x ≥ y: calls this.ge(other) reflection. */
  ge?: (other) => boolean
}

/**
 * A Collection is an iterable container type.
 * This is an abstract base class for user-defined collection types.
 *
 * @export
 * @abstract
 * @class Collection
 * @implements {Container}
 */
export abstract class Collection implements Container {
  /**
   * Returns an iterator for the container items
   * @return {Iterator}
   */
  [Symbol.iterator]() {
    return this
  }

  /**
   * Implements the iterator protocol and returns the next item in the iterable.
   */
  next() {}

  /**
   * Adds a new item to the container.
   * @param item
   */
  add(item) {}

  /**
   * Checks if item is present in the container.
   * @param item
   */
  contains(item) {
    return false
  }

  /**
   * Returns the total number of elements in the container.
   */
  size(): number {
    throw new NotImplementedError()
  }

  /**
   * Remove the first item from the container where `item == x`
   * @raises ValueError when x is not found
   */
  remove(x) {}

  /**
   * Retrieve and remove the item at index `i`.
   * @returns the item or undefined if not found.
   */
  pop(i) {}

  /**
   * Remove all items from the container
   */
  clear() {}
}

/**
 * Implements an iterable that allows backward iteration.
 * @interface Reversible
 */
export interface Reversible<T = unknown> {
  reversed: () => Iterator<T>
}

/**
 * A sequence is an iterable type with efficient index-based access.
 *
 * @export
 * @abstract
 * @class Sequence
 * @extends {Collection}
 * @template T
 */
export abstract class Sequence<T> extends Collection implements Reversible<T> {
  /**
   * Return the item at the given key or index
   * @param {*} key
   * @memberof Sequence
   */
  getitem(key): T | undefined {
    throw new NotImplementedError()
  }

  /**
   * Set a new value at the given key or index
   *
   * @param {*} key
   * @param {T} val
   * @memberof Sequence
   */
  setitem(key, val: T) {
    throw new NotImplementedError()
  }

  /**
   * Deletes the given key or index, and its value.
   * Raises ValueError if not key is found.
   *
   * @param {*} key
   * @memberof Sequence
   */
  delitem(key) {
    throw new NotImplementedError()
  }

  /**
   * Adds a new item to the end of the sequence.
   *
   * @param {T} x
   * @memberof Sequence
   */
  append(x: T) {}

  /**
   * Append all the items to the sequence.
   *
   * @param {Iterable<T>} iter
   * @memberof Sequence
   */
  extend(iter: Iterable<T>) {}

  /**
   * Return the index of x in the sequence, or undefined if not found.
   *
   * @param {T} item
   * @return {(number | undefined)}
   * @memberof Sequence
   */
  index(item: T): number | undefined {
    throw new NotImplementedError()
  }

  size() {
    return 0
  }

  reversed(): Iterator<T> {
    throw new NotImplementedError()
  }
}

export class FrozenSet<T = any> extends Set<T> {
  add() {
    throw TypeError('A frozenset cannot be modified after created.')
    return this
  }
  delete() {
    throw TypeError('A frozenset cannot be modified after created.')
    return false
  }
  clear() {
    throw TypeError('A frozenset cannot be modified after created.')
    return this
  }
  freeze() {
    return Object.freeze(this)
  }
}

export function frozenset<T = any>(iterable: Iterable<any>) {
  return new FrozenSet<T>(iterable)
}

export function namedtuple(...fields: string[]) {
  return (...args) => fields.map((f, i) => [f, args[i]])
}
