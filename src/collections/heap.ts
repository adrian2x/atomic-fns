import { type Comparator, defaultCompare, sameValueZero } from './internal/compare.ts'
import { arrayFromIterable } from './internal/iterable.ts'

/**
 * Hole-based sift-up: compare while finding the final index, then shift and place once, so a
 * throwing comparator writes nothing.
 * @returns The index where `item` landed.
 */
function siftUp<T>(heap: T[], start: number, item: T, compareFn: Comparator<T>): number {
  let pos = start
  while (pos > 0) {
    const parent = (pos - 1) >> 1
    if (compareFn(heap[parent], item) <= 0) break
    pos = parent
  }
  let hole = start
  while (hole > pos) {
    const parent = (hole - 1) >> 1
    heap[hole] = heap[parent]
    hole = parent
  }
  heap[hole] = item
  return pos
}

/**
 * Undo the last `siftUp(heap, start, ...)`, whose item landed at `pos`: move each ancestor on the
 * path back down to its old slot and drop slot `start`. Makes no comparisons.
 */
function undoSiftUp<T>(heap: T[], start: number, pos: number): void {
  const path: number[] = []
  for (let index = start; index > pos; index = (index - 1) >> 1) path.push(index)
  path.push(pos)
  for (let k = path.length - 1; k > 0; --k) heap[path[k]] = heap[path[k - 1]]
  heap.length = start
}

/** Hole-based sift-down over `heap[0..end)`, placing `item` at `start`. */
function siftDown<T>(
  heap: T[],
  start: number,
  end: number,
  item: T,
  compareFn: Comparator<T>
): void {
  const path: number[] = []
  let pos = start
  const half = end >> 1
  while (pos < half) {
    let child = (pos << 1) | 1
    const right = child + 1
    if (right < end && compareFn(heap[child], heap[right]) > 0) child = right
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
 * A binary min-heap: `peek` and `pop` give the smallest item by the comparator, so a reversed
 * comparator makes a max-heap. Iteration is in heap order, not sorted order. `has` and `delete`
 * use SameValueZero, as `Set` does. A comparator that throws leaves the heap unchanged, and a `push`
 * of several items then adds none of them. With the default comparator, items are numbers, bigints
 * or strings, checked as they enter: `NaN` throws `RangeError`, and `null`, `undefined` and other
 * values throw `TypeError`; pass a comparator to order them.
 *
 * @example
 * ```ts
 * const heap = new Heap([5, 1, 3])
 * heap.push(2)
 * heap.pop() // 1
 * heap.peek() // 2
 * ```
 */
export class Heap<T> {
  readonly #heap: T[]
  readonly #compare: Comparator<T>
  readonly #checksItems: boolean

  /**
   * Build a heap from `items` in linear time.
   * @param items Initial items, copied. `null` means none.
   * @param compareFn Comparator; the smallest item comes out first. Defaults to the primitive
   * order (numbers, bigints and strings).
   * @throws {TypeError} when `items` is not iterable, `compareFn` is not a function, or the default
   * comparator cannot order an item.
   * @throws {RangeError} when `items` is a huge sparse array, or holds `NaN` under the default
   * comparator.
   */
  constructor(items?: Iterable<T> | null, compareFn?: ((a: T, b: T) => number) | null) {
    if (compareFn != null && typeof compareFn !== 'function') {
      throw new TypeError('comparator must be a function')
    }
    this.#compare = compareFn ?? defaultCompare
    this.#checksItems = compareFn == null
    const heap = arrayFromIterable<T>(items ?? [])
    if (this.#checksItems) for (const item of heap) defaultCompare(item, item)
    for (let parent = (heap.length - 1) >> 1; parent >= 0; --parent) {
      siftDown(heap, parent, heap.length, heap[parent], this.#compare)
    }
    this.#heap = heap
  }

  /** The number of items. */
  get size(): number {
    return this.#heap.length
  }

  /** `'Heap'`, for `Object.prototype.toString`. */
  get [Symbol.toStringTag](): string {
    return 'Heap'
  }

  /**
   * Add one or more items. When the comparator throws, none of them is added.
   * @returns The new size.
   * @throws {TypeError} when the default comparator cannot order an item.
   * @throws {RangeError} when an item is `NaN` under the default comparator.
   */
  push(...items: T[]): number {
    const heap = this.#heap
    const firstStart = heap.length
    const landed: number[] = []
    try {
      for (const item of items) {
        if (this.#checksItems) defaultCompare(item, item)
        landed.push(siftUp(heap, heap.length, item, this.#compare))
      }
    } catch (error) {
      for (let k = landed.length - 1; k >= 0; --k) undoSiftUp(heap, firstStart + k, landed[k])
      throw error
    }
    return heap.length
  }

  /** Remove and return the smallest item, or `undefined` when empty. */
  pop(): T | undefined {
    const heap = this.#heap
    if (heap.length === 0) return undefined
    const top = heap[0]
    siftDown(heap, 0, heap.length - 1, heap[heap.length - 1], this.#compare)
    heap.pop()
    return top
  }

  /** The smallest item without removing it, or `undefined` when empty. */
  peek(): T | undefined {
    return this.#heap[0]
  }

  /** Whether `item` is in the heap (SameValueZero). */
  has(item: T): boolean {
    return this.#heap.includes(item)
  }

  /**
   * Remove one occurrence of `item` (SameValueZero).
   * @returns Whether it was present.
   */
  delete(item: T): boolean {
    const heap = this.#heap
    const index = heap.findIndex((x) => sameValueZero(x, item))
    if (index < 0) return false
    if (index === 0) {
      this.pop()
      return true
    }
    const end = heap.length - 1
    if (index < end) {
      const last = heap[end]
      const parent = (index - 1) >> 1
      if (this.#compare(heap[parent], last) > 0) siftUp(heap, index, last, this.#compare)
      else siftDown(heap, index, end, last, this.#compare)
    }
    heap.pop()
    return true
  }

  /** Remove every item. */
  clear(): void {
    this.#heap.length = 0
  }

  /** The items, in heap order. */
  values(): IteratorObject<T> {
    return this.#heap.values()
  }

  /** The items, in heap order, as `Set.prototype.keys` gives them. */
  keys(): IteratorObject<T> {
    return this.values()
  }

  /** `[item, item]` pairs, in heap order, as `Set.prototype.entries` gives them. */
  entries(): IteratorObject<[T, T]> {
    return this.values().map((v): [T, T] => [v, v])
  }

  /** Call `callback(item, item, heap)` for each item, in heap order. */
  forEach(callback: (value: T, key: T, heap: this) => void, thisArg?: unknown): void {
    for (const v of this.values()) Reflect.apply(callback, thisArg, [v, v, this])
  }

  /** The items, in heap order. */
  [Symbol.iterator](): IteratorObject<T> {
    return this.values()
  }
}
