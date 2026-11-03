import {
  canonicalKeyInfo,
  createCanonicalKeySession,
  type CanonicalKeySession
} from '../internal/canonicalKey.js'
import { arrayFromIterable } from '../internal/iterable.js'
import { withHookNesting } from '../internal/nesting.js'
import { createDeepEqualSession, deepEqualInSession } from '../operators/equality.js'
import type { DeepEqualSession } from '../operators/equality.js'
import type { Comparer } from '../operators/index.js'
import { compare, protocol, sameValueZero } from '../operators/index.js'
import { ValueCollection } from './abc.js'
import { clone } from './object.js'

interface HeapEqItem<T> {
  item: T
  key: string | undefined
  /** Key is a structural hash: equal keys only mean "candidates for deepEqual". */
  hashed: boolean
  pure: boolean
}

function classifyHeapItem<T>(item: T, keys: CanonicalKeySession): HeapEqItem<T> {
  const info = canonicalKeyInfo(item, keys)
  if (info === undefined) return { item, key: undefined, hashed: false, pure: false }
  return { item, key: info.key, hashed: info.hashed, pure: info.pure }
}

interface Buckets<T> {
  /** Exact keys: equal key iff deepEqual. */
  exact: Map<string, HeapEqItem<T>[]>
  /** Hashed keys: equal hash is only a candidate match. */
  hashed: Map<string, HeapEqItem<T>[]>
  unkeyed: HeapEqItem<T>[]
}

function bucketize<T>(side: HeapEqItem<T>[]): Buckets<T> {
  const exact = new Map<string, HeapEqItem<T>[]>()
  const hashed = new Map<string, HeapEqItem<T>[]>()
  const unkeyed: HeapEqItem<T>[] = []
  for (const entry of side) {
    if (entry.key === undefined) {
      unkeyed.push(entry)
      continue
    }
    const target = entry.hashed ? hashed : exact
    const list = target.get(entry.key)
    if (list === undefined) target.set(entry.key, [entry])
    else list.push(entry)
  }
  return { exact, hashed, unkeyed }
}

/**
 * Multiset equality leftovers after exact-key cancellation and hashed-group matching, then
 * pairwise matching for every leftover impure item (O(leftover_impure × leftovers)). Pure
 * leftovers may only be consumed by those matches. JSON-only heaps cancel entirely by key and
 * never take the pairwise path. Every pairwise comparison shares one deepEqual session, so
 * subtrees already proven equal are not compared again.
 */
function heapMultisetEqual<T>(aItems: Iterable<T>, bItems: Iterable<T>): boolean {
  const keys = createCanonicalKeySession()
  const session = createDeepEqualSession()
  const sideA = bucketize([...aItems].map((item) => classifyHeapItem(item, keys)))
  const sideB = bucketize([...bItems].map((item) => classifyHeapItem(item, keys)))

  const leftoverA: HeapEqItem<T>[] = [...sideA.unkeyed]
  const leftoverB: HeapEqItem<T>[] = [...sideB.unkeyed]

  for (const key of new Set([...sideA.exact.keys(), ...sideB.exact.keys()])) {
    const listA = sideA.exact.get(key) ?? []
    const listB = sideB.exact.get(key) ?? []
    const matched = Math.min(listA.length, listB.length)
    for (let i = matched; i < listA.length; i++) leftoverA.push(listA[i])
    for (let i = matched; i < listB.length; i++) leftoverB.push(listB[i])
  }

  for (const key of new Set([...sideA.hashed.keys(), ...sideB.hashed.keys()])) {
    matchHashedGroup(
      sideA.hashed.get(key) ?? [],
      sideB.hashed.get(key) ?? [],
      session,
      leftoverA,
      leftoverB
    )
  }

  if (leftoverA.length === 0 && leftoverB.length === 0) return true
  if (leftoverA.length !== leftoverB.length) return false

  const usedA = new Array<boolean>(leftoverA.length).fill(false)
  const usedB = new Array<boolean>(leftoverB.length).fill(false)

  const matchImpure = (fromA: boolean, index: number): boolean => {
    const mine = fromA ? leftoverA : leftoverB
    const theirs = fromA ? leftoverB : leftoverA
    const usedMine = fromA ? usedA : usedB
    const usedTheirs = fromA ? usedB : usedA
    if (usedMine[index]) return true
    const entry = mine[index]
    for (let j = 0; j < theirs.length; j++) {
      if (usedTheirs[j]) continue
      if (deepEqualInSession(entry.item, theirs[j].item, session)) {
        usedMine[index] = true
        usedTheirs[j] = true
        return true
      }
    }
    return false
  }

  for (let i = 0; i < leftoverA.length; i++) {
    if (leftoverA[i].pure) continue
    if (!matchImpure(true, i)) return false
  }
  for (let i = 0; i < leftoverB.length; i++) {
    if (leftoverB[i].pure) continue
    if (!matchImpure(false, i)) return false
  }

  for (let i = 0; i < leftoverA.length; i++) {
    if (!usedA[i]) return false
  }
  for (let i = 0; i < leftoverB.length; i++) {
    if (!usedB[i]) return false
  }
  return true
}

/**
 * Match items of one hash group pairwise in the shared session. A hash collision only costs
 * extra comparisons. Items left unmatched go to the leftover lists: a hashed item may still be
 * deepEqual to an unkeyed or impure item of the other side (cross-kind equality).
 */
function matchHashedGroup<T>(
  listA: HeapEqItem<T>[],
  listB: HeapEqItem<T>[],
  session: DeepEqualSession,
  leftoverA: HeapEqItem<T>[],
  leftoverB: HeapEqItem<T>[]
): void {
  const remainingB = [...listB]
  for (const entry of listA) {
    let matched = false
    for (let j = 0; j < remainingB.length; j++) {
      if (!deepEqualInSession(entry.item, remainingB[j].item, session)) continue
      // Swap-remove keeps equal-item groups O(1) per match.
      const last = remainingB.pop()
      if (last !== undefined && j < remainingB.length) remainingB[j] = last
      matched = true
      break
    }
    if (!matched) leftoverA.push(entry)
  }
  for (const entry of remainingB) leftoverB.push(entry)
}

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
   * Multiset equality under `deepEqual`, independent of the heap comparator. Same size.
   * Items with an exact canonical key cancel by key counts. Items are pure when their key is
   * built only from JSON-shaped data plus exact built-in Date/RegExp; otherwise impure (unkeyed,
   * hashed, or keyed with boxed primitives / typed arrays / Map / Set). Two pure items are
   * deepEqual iff their keys are equal, so cross-kind matches always involve an impure leftover.
   * Items whose exact key would exceed 64 KB carry a structural hash instead; they group by hash
   * and match pairwise within the group (a collision only costs time). After that, every
   * leftover impure item is matched pairwise by `deepEqual` against an unmatched leftover of the
   * other side (leftover pures may only be consumed by those matches); any unmatched leftover
   * yields false. All pairwise comparisons share one deepEqual session (proven pairs and nesting
   * counters), so shared-reference DAGs stay linear. JSON-only heaps never take the pairwise
   * path. Iteration / heap order is not part of equality.
   */
  override [protocol.equals](other: unknown): boolean {
    return withHookNesting(() => {
      if (this === other) return true
      if (typeof other !== 'object' || other?.constructor !== this.constructor) return false
      const o = other as Heap<T>
      if (this.size !== o.size) return false
      return heapMultisetEqual(this.values(), o.values())
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
