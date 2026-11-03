import { canonicalKey } from '../internal/canonicalKey.js'
import { arrayFromIterable } from '../internal/iterable.js'
import { withHookNesting } from '../internal/nesting.js'
import type { Comparer } from '../operators/index.js'
import { compare, deepEqual, protocol, sameValueZero } from '../operators/index.js'
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
   * @param items Initial values (copied; the source array is not aliased).
   * @param compareFn Compare function. Defaults to smaller values first.
   */
  constructor(items: Iterable<T> = [], compareFn: Comparer<T> = compare) {
    super()
    this.#compare = compareFn
    this.#heap = arrayFromIterable<T>(items)
    heapify(this.#heap, this.#compare)
  }

  get size(): number {
    return this.#heap.length
  }

  protected override cloneFrom(values: Iterable<T>): this {
    return new Heap(values, this.#compare) as this
  }

  /**
   * Multiset equality: same size; after sorting both with the heap comparator (ties broken by a
   * canonical structural key when both sides have one), each maximal run of comparator-equal
   * items is compared pairwise for JSON-like values, or as a multiset for the rest (class
   * instances, functions, symbols, collections). Iteration / heap order is not part of equality.
   */
  override [protocol.equals](other: unknown): boolean {
    return withHookNesting(() => {
      if (this === other) return true
      if (typeof other !== 'object' || other?.constructor !== this.constructor) return false
      const o = other as Heap<T>
      if (this.size !== o.size) return false
      const a = sortHeapItems([...this.values()], this.#compare)
      const b = sortHeapItems([...o.values()], o.#compare)
      let i = 0
      let j = 0
      while (i < a.length && j < b.length) {
        if (this.#compare(a[i], b[j]) !== 0) return false
        let endA = i + 1
        while (endA < a.length && this.#compare(a[i], a[endA]) === 0) endA++
        let endB = j + 1
        while (endB < b.length && o.#compare(b[j], b[endB]) === 0) endB++
        if (endA - i !== endB - j) return false
        if (!tieRunEqual(a, i, endA, b, j, endB)) return false
        i = endA
        j = endB
      }
      return i === a.length && j === b.length
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
   * Push an element onto the heap.
   * @returns The new size.
   */
  push(item: T): number {
    heappush(this.#heap, item, this.#compare)
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
    return this.#heap.values()
  }
}

function sortHeapItems<T>(items: T[], compareFn: Comparer<T>): T[] {
  return items.sort((x, y) => {
    const c = compareFn(x, y)
    if (c !== 0) return c
    const kx = canonicalKey(x)
    const ky = canonicalKey(y)
    if (kx !== undefined && ky !== undefined) {
      if (kx < ky) return -1
      if (kx > ky) return 1
      return 0
    }
    // Unkeyed (or mixed) stay in their relative order; matched as a multiset later.
    if (kx !== undefined) return -1
    if (ky !== undefined) return 1
    return 0
  })
}

/** Compare one comparator-tie run: keyed items pairwise, unkeyed by multiset deepEqual. */
function tieRunEqual<T>(
  a: T[],
  startA: number,
  endA: number,
  b: T[],
  startB: number,
  endB: number
): boolean {
  const keyedA: T[] = []
  const keyedB: T[] = []
  const freeA: T[] = []
  const freeB: T[] = []
  for (let x = startA; x < endA; x++) {
    if (canonicalKey(a[x]) === undefined) freeA.push(a[x])
    else keyedA.push(a[x])
  }
  for (let y = startB; y < endB; y++) {
    if (canonicalKey(b[y]) === undefined) freeB.push(b[y])
    else keyedB.push(b[y])
  }
  if (keyedA.length !== keyedB.length || freeA.length !== freeB.length) return false
  for (let i = 0; i < keyedA.length; i++) {
    if (!deepEqual(keyedA[i], keyedB[i])) return false
  }
  const used = new Array<boolean>(freeB.length).fill(false)
  for (const item of freeA) {
    let found = false
    for (let y = 0; y < freeB.length; y++) {
      if (used[y]) continue
      if (deepEqual(item, freeB[y])) {
        used[y] = true
        found = true
        break
      }
    }
    if (!found) return false
  }
  return true
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
