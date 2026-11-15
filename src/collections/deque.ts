import { assertNotHugeSparse } from './internal/arrayKeys.ts'
import { sameValueZero } from './internal/compare.ts'
import { iteratesAsArray, requireIterable } from './internal/iterable.ts'

const MIN_CAPACITY = 8

/**
 * A double-ended queue on a ring buffer, with Array's method names: `push` and `pop` at the end,
 * `unshift` and `shift` at the front, `at` and `set` by index, all O(1) amortized. It grows by
 * doubling when unbounded; with `maxlen` it evicts from the opposite end, as Python's `deque` does.
 * `includes` uses SameValueZero.
 *
 * @example
 * ```ts
 * const recent = new Deque<number>([], { maxlen: 3 })
 * recent.push(1, 2, 3, 4)
 * ;[...recent] // [2, 3, 4]
 * recent.shift() // 2
 * ```
 */
export class Deque<T> {
  #buf: { [i: number]: T; length: number }
  #cap: number
  #head = 0
  #size = 0
  readonly #maxlen: number | undefined
  readonly #arrType: (new (n: number) => { [i: number]: T; length: number }) | undefined
  readonly #empty: T

  /**
   * Create a deque holding `items`, in order.
   * @param items Initial elements, read one at a time. When longer than `maxlen`, only the last
   * `maxlen` remain.
   * @param options.maxlen Maximum size; overflow evicts from the opposite end. `0` makes push/unshift
   * no-ops. `null`, `undefined` and `Infinity` mean unbounded.
   * @param options.arrType Typed-array (or similar) constructor used for storage.
   * @throws {TypeError} when `items` is not iterable, or `maxlen` is not a number, `null` or
   * `undefined`.
   * @throws {RangeError} when `maxlen` is negative, not an integer, or above
   * `Number.MAX_SAFE_INTEGER`, or when `items` is a huge sparse array.
   */
  constructor(
    items?: Iterable<T> | null,
    options?: {
      maxlen?: number | null
      arrType?: new (n: number) => { [i: number]: T; length: number }
    }
  ) {
    const maxlen = options?.maxlen ?? undefined
    if (maxlen !== undefined && typeof maxlen !== 'number') {
      throw new TypeError('maxlen must be a number')
    }
    if (
      maxlen !== undefined &&
      maxlen !== Infinity &&
      (!Number.isInteger(maxlen) || maxlen < 0 || maxlen > Number.MAX_SAFE_INTEGER)
    ) {
      throw new RangeError(
        'maxlen must be a non-negative integer <= Number.MAX_SAFE_INTEGER or Infinity'
      )
    }
    this.#maxlen = maxlen === Infinity ? undefined : maxlen
    this.#arrType = options?.arrType
    this.#empty = this.#alloc(1)[0]

    const source = requireIterable<T>(items ?? [])
    if (iteratesAsArray(source)) assertNotHugeSparse(source)
    this.#cap = MIN_CAPACITY
    this.#buf = this.#alloc(this.#cap)

    for (const x of source) {
      this.#pushOne(x)
    }
  }

  /** The number of elements. */
  get size(): number {
    return this.#size
  }

  /**
   * Maximum size when constructed with a finite `maxlen`, otherwise `undefined`.
   */
  get maxlen(): number | undefined {
    return this.#maxlen
  }

  /** `'Deque'`, for `Object.prototype.toString`. */
  get [Symbol.toStringTag](): string {
    return 'Deque'
  }

  /** Remove every element and give back the buffer a burst grew. */
  clear(): void {
    this.#cap = MIN_CAPACITY
    this.#buf = this.#alloc(this.#cap)
    this.#head = 0
    this.#size = 0
  }

  /**
   * Append one or more elements at the end.
   * @returns The new size.
   */
  push(...xs: T[]): number {
    for (const x of xs) this.#pushOne(x)
    return this.#size
  }

  /**
   * Insert one or more elements at the front, preserving argument order.
   * @returns The new size.
   */
  unshift(...xs: T[]): number {
    for (let i = xs.length - 1; i >= 0; i--) this.#unshiftOne(xs[i])
    return this.#size
  }

  /**
   * Remove and return the last element, or `undefined` when empty.
   */
  pop(): T | undefined {
    if (this.#size === 0) return undefined
    const j = this.#phys(this.#size - 1)
    const x = this.#buf[j]
    this.#buf[j] = this.#empty
    this.#size--
    return x
  }

  /**
   * Remove and return the first element, or `undefined` when empty.
   */
  shift(): T | undefined {
    if (this.#size === 0) return undefined
    const x = this.#buf[this.#head]
    this.#buf[this.#head] = this.#empty
    this.#head = (this.#head + 1) % this.#cap
    this.#size--
    return x
  }

  /**
   * Element at index `i` (negative from the end). Out of range or empty -> `undefined`.
   * The index coerces as in `Array.prototype.at`; values that coerce to `NaN` mean `0`.
   */
  at(i: number): T | undefined {
    const idx = this.#fromEnd(i)
    if (idx < 0 || idx >= this.#size) return undefined
    return this.#buf[this.#phys(idx)]
  }

  /**
   * Replace the element at index `i` (negative from the end). The index coerces as in {@link at}.
   * @returns `this`
   * @throws {RangeError} when the index is out of range.
   */
  set(i: number, v: T): this {
    const idx = this.#fromEnd(i)
    if (idx < 0 || idx >= this.#size) {
      throw new RangeError(`index ${String(i).slice(0, 40)} out of range`)
    }
    this.#buf[this.#phys(idx)] = v
    return this
  }

  /** Whether `value` is present (SameValueZero). */
  includes(value: T): boolean {
    return this.values().some((v) => sameValueZero(v, value))
  }

  /** Call `callback(element, index, deque)` for each element, front to back. */
  forEach(callback: (value: T, index: number, deque: this) => void, thisArg?: unknown): void {
    for (let i = 0; i < this.#size; i++) {
      Reflect.apply(callback, thisArg, [this.#buf[this.#phys(i)], i, this])
    }
  }

  /** The indices, front to back, as `Array.prototype.keys` gives them. */
  *keys(): Generator<number> {
    for (let i = 0; i < this.#size; i++) yield i
  }

  /** The elements, front to back. */
  *values(): Generator<T> {
    for (let i = 0; i < this.#size; i++) yield this.#buf[this.#phys(i)]
  }

  /** `[index, element]` pairs, front to back. */
  *entries(): Generator<[number, T]> {
    for (let i = 0; i < this.#size; i++) yield [i, this.#buf[this.#phys(i)]]
  }

  /** The elements, front to back. */
  [Symbol.iterator](): Generator<T> {
    return this.values()
  }

  /** Index `i` as `Array.prototype.at` reads it: truncated, `NaN` as `0`, negative from the end. */
  #fromEnd(i: number): number {
    const idx = Math.trunc(i) || 0
    return idx < 0 ? idx + this.#size : idx
  }

  #phys(i: number): number {
    return (this.#head + i) % this.#cap
  }

  #alloc(n: number): { [i: number]: T; length: number } {
    if (this.#arrType) return new this.#arrType(n)
    return new Array<T>(n)
  }

  /** Double the buffer, clamped to `maxlen`. Called only when full and below `maxlen`. */
  #grow(): void {
    let newCap = this.#cap * 2
    if (this.#maxlen !== undefined) newCap = Math.min(newCap, this.#maxlen)
    const nb = this.#alloc(newCap)
    for (let i = 0; i < this.#size; i++) nb[i] = this.#buf[this.#phys(i)]
    this.#buf = nb
    this.#cap = newCap
    this.#head = 0
  }

  // Both inserts write the new slot before they move `#head` or `#size`, so a value that typed
  // storage rejects leaves the deque as it was, the element it would evict included. At `maxlen`
  // with a full buffer the new slot is the one being evicted, so the write itself evicts it.

  #pushOne(x: T): void {
    if (this.#maxlen === 0) return
    const atMaxlen = this.#size === this.#maxlen
    if (!atMaxlen && this.#size === this.#cap) this.#grow()
    const j = this.#phys(this.#size)
    this.#buf[j] = x
    if (atMaxlen) {
      if (j !== this.#head) this.#buf[this.#head] = this.#empty
      this.#head = (this.#head + 1) % this.#cap
    } else {
      this.#size++
    }
  }

  #unshiftOne(x: T): void {
    if (this.#maxlen === 0) return
    const atMaxlen = this.#size === this.#maxlen
    if (!atMaxlen && this.#size === this.#cap) this.#grow()
    const j = (this.#head - 1 + this.#cap) % this.#cap
    this.#buf[j] = x
    if (atMaxlen) {
      const back = this.#phys(this.#size - 1)
      if (j !== back) this.#buf[back] = this.#empty
    } else {
      this.#size++
    }
    this.#head = j
  }
}
