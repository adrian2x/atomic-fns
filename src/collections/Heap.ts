import type { Comparer } from '../operators/index.js'
import { compare, sameValueZero } from '../operators/index.js'
import { ValueCollection } from './abc.js'

/**
 * Binary min-heap (or max-heap with a custom comparator).
 * Iteration order is heap order (not sorted). Equality for `has`/`delete` is SameValueZero.
 *
 * @template T
 */
export class Heap<T> extends ValueCollection<T> {
  readonly #heap: T[]
  readonly #compare: Comparer<T>

  /**
   * @param items Initial values (copied; the source array is not aliased).
   * @param compareFn Compare function. Defaults to smaller values first.
   */
  constructor(items: Iterable<T> = [], compareFn: Comparer<T> = compare) {
    super()
    this.#compare = compareFn
    this.#heap = Array.from(items)
    const n = this.#heap.length
    for (let parent = (n - 1) >> 1; parent >= 0; --parent) {
      siftDown(this.#heap, parent, n, this.#heap[parent], this.#compare)
    }
  }

  get size(): number {
    return this.#heap.length
  }

  protected override cloneFrom(values: Iterable<T>): this {
    return new Heap(values, this.#compare) as this
  }

  readonly [Symbol.toStringTag] = 'Heap'

  clear(): void {
    this.#heap.length = 0
  }

  /**
   * Push an element onto the heap.
   * @returns The new size.
   */
  push(item: T): number {
    const heap = this.#heap
    const i = heap.length
    heap.length = i + 1
    try {
      siftUp(heap, i, item, this.#compare)
    } catch (e) {
      heap.length = i
      throw e
    }
    return heap.length
  }

  /**
   * Remove and return the top element, or `undefined` when empty.
   */
  pop(): T | undefined {
    const heap = this.#heap
    if (heap.length === 0) return undefined
    const top = heap[0]
    if (heap.length === 1) {
      heap.pop()
      return top
    }
    const last = heap[heap.length - 1]
    siftDown(heap, 0, heap.length - 1, last, this.#compare)
    heap.pop()
    return top
  }

  /**
   * Access the top element without removing it.
   */
  peek(): T | undefined {
    return this.#heap[0]
  }

  /**
   * `true` when `item` is in the heap (SameValueZero).
   */
  has(item: T): boolean {
    return indexOfSVZ(this.#heap, item) >= 0
  }

  /**
   * Remove one occurrence of `item` (SameValueZero). Returns whether it was present.
   */
  delete(item: T): boolean {
    const heap = this.#heap
    const index = indexOfSVZ(heap, item)
    if (index < 0) return false
    if (index === 0) {
      this.pop()
      return true
    }
    const last = heap.pop() as T
    if (index === heap.length) return true
    const parent = (index - 1) >> 1
    if (index > 0 && this.#compare(heap[parent], last) > 0) {
      siftUp(heap, index, last, this.#compare)
    } else {
      siftDown(heap, index, heap.length, last, this.#compare)
    }
    return true
  }

  values(): IteratorObject<T> {
    return Iterator.from(this.#heap)
  }
}

function indexOfSVZ<T>(arr: readonly T[], item: T): number {
  for (let i = 0; i < arr.length; i++) {
    if (sameValueZero(arr[i], item)) return i
  }
  return -1
}

/**
 * Hole-based sift-up: comparisons only while finding the final index, then shifts + one place.
 */
function siftUp<T>(heap: T[], start: number, item: T, compareFn: Comparer<T>): void {
  const path: number[] = []
  let pos = start
  while (pos > 0) {
    const parent = (pos - 1) >> 1
    if (compareFn(heap[parent], item) <= 0) break
    path.push(parent)
    pos = parent
  }
  let hole = start
  for (const parent of path) {
    heap[hole] = heap[parent]
    hole = parent
  }
  heap[hole] = item
}

/**
 * Hole-based sift-down over `heap[0..end)` placing `item` at `start`.
 */
function siftDown<T>(heap: T[], start: number, end: number, item: T, compareFn: Comparer<T>): void {
  const path: number[] = []
  let pos = start
  const half = end >> 1
  while (pos < half) {
    let child = (pos << 1) | 1
    const right = child + 1
    if (right < end && compareFn(heap[child], heap[right]) > 0) {
      child = right
    }
    if (compareFn(heap[child], item) >= 0) break
    path.push(child)
    pos = child
  }
  let hole = start
  for (const child of path) {
    heap[hole] = heap[child]
    hole = child
  }
  heap[hole] = item
}

/**
 * Transform any array into a heap, in-place, in linear time.
 */
export function heapify<T>(heap: T[], compareFn: Comparer<T> = compare): void {
  const size = heap.length
  for (let parent = (size - 1) >> 1; parent >= 0; --parent) {
    siftDown(heap, parent, size, heap[parent], compareFn)
  }
}

/**
 * Push `item` onto `heap`, maintaining the heap invariant.
 */
export function heappush<T>(heap: T[], item: T, compareFn: Comparer<T> = compare): void {
  const i = heap.length
  heap.length = i + 1
  try {
    siftUp(heap, i, item, compareFn)
  } catch (e) {
    heap.length = i
    throw e
  }
}

/**
 * Pop and return the smallest item from `heap`, maintaining the heap invariant.
 */
export function heappop<T>(heap: T[], compareFn: Comparer<T> = compare): T | undefined {
  if (heap.length === 0) return undefined
  const top = heap[0]
  if (heap.length === 1) {
    heap.pop()
    return top
  }
  const last = heap[heap.length - 1]
  siftDown(heap, 0, heap.length - 1, last, compareFn)
  heap.pop()
  return top
}
