import type { Comparer } from '../operators/index.js'
import { compare } from '../operators/index.js'
import { Collection } from './abc.js'

export class Heap<T> extends Collection {
  private readonly items: T[]
  private readonly compare: Comparer
  private count: number = 0

  /**
   * Initializes a new Heap instance.
   *
   * **Note:** When constructing the heap from an array, it will operate directly on this array. For other iterables, it will create a new array.
   *
   * @param {Iterable<T>} [container=[]] The initial values.
   * @param {Comparer} [cmp=compare] Compare function. Defaults to smaller values first.
   */
  constructor(container: Iterable<T> = [], cmp: Comparer = compare) {
    super()
    this.compare = cmp
    if (Array.isArray(container)) {
      // use the provided array to avoid copying.
      this.items = container
    } else {
      this.items = Array.from(container)
    }
    this.count = this.items.length
    const halfLength = this.count >> 1
    // Heapify the items
    for (let parent = (this.count - 1) >> 1; parent >= 0; --parent) {
      this.heapifyDown(parent, halfLength)
    }
  }

  get size() {
    return this.count
  }

  clear() {
    this.count = 0
    this.items.length = 0
  }

  /**
   * Push element into a container in order.
   * @param item The element to push.
   */
  add(item: T) {
    this.items.push(item)
    this.heapifyUp(this.count)
    this.count += 1
  }

  /**
   * Removes the top element.
   */
  pop() {
    if (!this.count) return
    const value = this.items[0]
    const last = this.items.pop() as T
    this.count -= 1
    if (this.count) {
      this.items[0] = last
      this.heapifyDown(0, this.count >> 1)
    }
    return value
  }

  /**
   * Accesses the top element.
   */
  top() {
    return this.items[0] as T | undefined
  }

  /**
   * Check if element is in heap.
   * @param item The item want to find.
   * @return `true` if element exists.
   */
  contains(item: T) {
    return this.items.includes(item)
  }

  /**
   * Remove specified item from heap.
   * @param item The item want to remove.
   * @return `true` if the item was removed.
   */
  remove(item: T) {
    const index = this.items.indexOf(item)
    if (index < 0) return false
    if (index === 0) {
      this.pop()
    } else if (index === this.count - 1) {
      this.items.pop()
      this.count -= 1
    } else {
      this.items.splice(index, 1, this.items.pop() as T)
      this.count -= 1
      this.heapifyUp(index)
      this.heapifyDown(index, this.count >> 1)
    }
    return true
  }

  values() {
    return this.items[Symbol.iterator]()
  }

  private heapifyUp(pos: number) {
    const item = this.items[pos]
    while (pos > 0) {
      const parent = (pos - 1) >> 1
      const parentItem = this.items[parent]
      if (this.compare(parentItem, item) <= 0) break
      this.items[pos] = parentItem
      pos = parent
    }
    this.items[pos] = item
  }

  private heapifyDown(pos: number, halfLength: number) {
    const item = this.items[pos]
    while (pos < halfLength) {
      let left = (pos << 1) | 1
      const right = left + 1
      let minItem = this.items[left]
      if (right < this.count && this.compare(minItem, this.items[right]) > 0) {
        left = right
        minItem = this.items[right]
      }
      if (this.compare(minItem, item) >= 0) break
      this.items[pos] = minItem
      pos = left
    }
    this.items[pos] = item
  }
}
