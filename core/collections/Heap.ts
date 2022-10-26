import type { Comparer } from '../operators/index.js'
import { compare } from '../operators/index.js'
import { Collection } from './abc.js'

export class Heap<T> extends Collection {
  private readonly heap: T[]
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
      this.heap = container
    } else {
      this.heap = Array.from(container)
    }
    this.count = this.heap.length
    const halfLength = this.count >> 1
    // Heapify the items
    for (let parent = (this.count - 1) >> 1; parent >= 0; --parent) {
      heapifyDown(this.heap, parent, halfLength, this.compare)
    }
  }

  at(n: number) {
    return this.heap.at(n)
  }

  get size() {
    return this.count
  }

  clear() {
    this.count = 0
    this.heap.length = 0
  }

  /**
   * Push element into a container in order.
   * @param item The element to push.
   */
  add(item: T) {
    this.heap.push(item)
    heapifyUp(this.heap, this.count, this.compare)
    this.count += 1
  }

  /**
   * Removes the top element.
   */
  pop() {
    if (!this.count) return
    const value = this.heap[0]
    const last = this.heap.pop() as T
    this.count -= 1
    if (this.count) {
      this.heap[0] = last
      heapifyDown(this.heap, 0, this.count >> 1, this.compare)
    }
    return value
  }

  /**
   * Accesses the top element.
   */
  top() {
    if (!this.count) return
    return this.heap[0] as T | undefined
  }

  /**
   * Check if element is in heap.
   * @param item The item want to find.
   * @return `true` if element exists.
   */
  contains(item: T) {
    if (!this.count) return false
    return this.heap.includes(item)
  }

  /**
   * Remove specified item from heap.
   * @param item The item want to remove.
   * @return `true` if the item was removed.
   */
  remove(item: T) {
    const index = this.heap.indexOf(item)
    if (index < 0) return false
    if (index === 0) {
      this.pop()
    } else if (index === this.count - 1) {
      this.heap.pop()
      this.count -= 1
    } else {
      this.heap.splice(index, 1, this.heap.pop() as T)
      this.count -= 1
      heapifyUp(this.heap, index, this.compare)
      heapifyDown(this.heap, index, this.count >> 1, this.compare)
    }
    return true
  }

  /**
   * Returns an iterable with all the values in the heap.
   * @returns {Iterable<T>} The values in the heap.
   */
  values() {
    return this.heap[Symbol.iterator]()
  }
}

function heapifyDown(heap, i: number, halfLength: number, compareFn = compare) {
  const item = heap[i]
  while (i < halfLength) {
    let left = (i << 1) | 1
    const right = left + 1
    let minItem = heap[left]
    if (right < heap.length && compareFn(minItem, heap[right]) > 0) {
      left = right
      minItem = heap[right]
    }
    if (compareFn(minItem, item) >= 0) break
    heap[i] = minItem
    i = left
  }
  heap[i] = item
}

function heapifyUp(heap, i: number, compareFn) {
  const item = heap[i]
  while (i > 0) {
    const parent = (i - 1) >> 1
    const parentItem = heap[parent]
    if (compareFn(parentItem, item) <= 0) break
    heap[i] = parentItem
    i = parent
  }
  heap[i] = item
}

/**
 * Transform any array into a heap, in-place, in linear time.
 * @param {Array} heap
 * @param {Comparer} [compareFn=compare] Custom compare function
 */
export function heapify(heap, compareFn = compare) {
  const size = heap.length
  const halfLength = size >> 1
  for (let parent = (size - 1) >> 1; parent >= 0; --parent) {
    heapifyDown(heap, parent, halfLength, compareFn)
  }
}

/**
 * Push the value `item` onto the `heap`, maintaining the heap invariant.
 * @param {Array} heap
 * @param {*} item
 * @param {Comparer} [compareFn=compare] Custom compare function
 */
export function heappush<T>(heap: T[], item: T, compareFn = compare) {
  heap.push(item)
  heapifyUp(heap, heap.length - 1, compareFn)
}

/**
 * Pop and return the smallest item from the `heap`, maintaining the heap invariant.
 * @param {Array} heap
 * @param {Comparer} [compareFn=compare] Custom compare function
 */
export function heappop<T>(heap: T[], compareFn = compare) {
  const last = heap.pop() as T
  if (heap.length) {
    const item = heap[0]
    heap[0] = last
    heapifyDown(heap, 0, heap.length >> 1, compareFn)
    return item
  }
  return last
}
