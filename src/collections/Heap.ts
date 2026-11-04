import { assertNotHugeSparse } from '../internal/arrayKeys.js'
import { arrayFromIterable } from '../internal/iterable.js'
import { withHookNesting } from '../internal/nesting.js'
import { deepMultisetEqual } from '../operators/equality.js'
import type { Comparer } from '../operators/index.js'
import { compare, protocol, sameValueZero } from '../operators/index.js'
import { ValueCollection } from './abc.js'
import { clone } from './object.js'

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
   * @param items Initial values (copied; the source array is not aliased). `null` means none.
   * @param compareFn Compare function. Defaults to smaller values first, also for `null`.
   */
  constructor(items?: Iterable<T> | null, compareFn?: Comparer<T> | null) {
    super()
    this.#compare = compareFn ?? compare
    this.#heap = arrayFromIterable<T>(items ?? [])
    heapify(this.#heap, this.#compare)
  }

  get size(): number {
    return this.#heap.length
  }

  protected override cloneFrom(values: Iterable<T>): this {
    return Reflect.construct(this.constructor, [values, this.#compare]) as this
  }

  /**
   * Multiset equality under `deepEqual`, independent of the heap comparator and of iteration order.
   * Shared references cancel without a comparison, items pair within groups of a bounded structural
   * hash, and a hook that is not transitive still gets an exact answer. The comparisons share the
   * walk's `deepEqual` session and its limit, which throws `RangeError`: only items that no bounded
   * hash can tell apart get near it, because they pair all-to-all.
   */
  override [protocol.equals](other: unknown): boolean {
    return withHookNesting(() => {
      if (this === other) return true
      if (typeof other !== 'object' || other?.constructor !== this.constructor) return false
      return deepMultisetEqual([...this.values()], [...(other as Heap<T>).values()])
    })
  }

  override [protocol.clone](deep = false): this {
    return withHookNesting(() => {
      if (!deep) return this.cloneFrom(this.values())
      return this.cloneFrom([...this.values()].map((v) => clone(v, true)))
    })
  }

  readonly [Symbol.toStringTag] = 'Heap'

  clear(): void {
    this.#heap.length = 0
  }

  /**
   * Push one or more elements onto the heap.
   * @returns The new size.
   */
  push(...items: T[]): number {
    for (const item of items) heappush(this.#heap, item, this.#compare)
    return this.#heap.length
  }

  /**
   * Remove and return the top element, or `undefined` when empty.
   */
  pop(): T | undefined {
    return heappop(this.#heap, this.#compare)
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
    return this.#heap.includes(item)
  }

  /**
   * Remove one occurrence of `item` (SameValueZero). Returns whether it was present.
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
      if (this.#compare(heap[parent], last) > 0) {
        siftUp(heap, index, last, this.#compare)
      } else {
        siftDown(heap, index, end, last, this.#compare)
      }
    }
    heap.pop()
    return true
  }

  values(): IteratorObject<T> {
    return this.#heap.values()
  }
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
 * @throws {RangeError} when `heap` is a huge sparse array.
 */
export function heapify<T>(heap: T[], compareFn: Comparer<T> = compare): void {
  assertNotHugeSparse(heap)
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
