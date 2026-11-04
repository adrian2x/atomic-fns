import { assertNotHugeSparse } from '../internal/arrayKeys.js'
import { isTypedArray, requireIterable } from '../internal/iterable.js'
import { truncateForError } from '../internal/truncate.js'
import { sameValueZero } from '../operators/index.js'
import { SetCollection } from './abc.js'

const MIN_CAPACITY = 8

/**
 * Double-ended queue backed by a ring buffer.
 * Grows by doubling when unbounded; with `maxlen`, evicts from the opposite end (Python deque).
 *
 * @template T
 */
export class Deque<T> extends SetCollection<T, number> {
  #buf: { [i: number]: T; length: number }
  #cap: number
  #head = 0
  #size = 0
  readonly #maxlen: number | undefined
  readonly #arrType: (new (n: number) => { [i: number]: T; length: number }) | undefined
  readonly #empty: T

  /**
   * @param items Initial elements, read one at a time. When longer than `maxlen`, only the last
   * `maxlen` remain.
   * @param options.maxlen Maximum size; overflow evicts from the opposite end. `0` makes push/unshift
   * no-ops. `null`, `undefined` and `Infinity` mean unbounded.
   * @param options.arrType Typed-array (or similar) constructor used for storage.
   * @throws {RangeError} when `maxlen` is negative, not an integer, or above
   * `Number.MAX_SAFE_INTEGER`.
   */
  constructor(
    items?: Iterable<T> | null,
    options?: {
      maxlen?: number | null
      arrType?: new (n: number) => { [i: number]: T; length: number }
    }
  ) {
    super()
    const maxlen = options?.maxlen ?? undefined
    if (
      maxlen !== undefined &&
      maxlen !== Infinity &&
      (!Number.isInteger(maxlen) || maxlen < 0 || maxlen > Number.MAX_SAFE_INTEGER)
    ) {
      throw new RangeError(
        'maxlen must be a non-negative integer <= Number.MAX_SAFE_INTEGER or Infinity'
      )
    }
    this.#maxlen = maxlen
    this.#arrType = options?.arrType
    this.#empty = this.#alloc(1)[0]

    const source = requireIterable<T>(items ?? [])
    const isArray = isTypedArray(source)
    if (isArray) assertNotHugeSparse(source)
    const known = isArray ? source.length : 0
    const bound = maxlen === undefined || maxlen === Infinity ? known : Math.min(known, maxlen)
    this.#cap = Math.max(MIN_CAPACITY, capacityFor(bound, maxlen))
    this.#buf = this.#alloc(this.#cap)

    for (const x of source) {
      this.#pushOne(x)
    }
  }

  get size(): number {
    return this.#size
  }

  protected override cloneFrom(values: Iterable<T>): this {
    const options = { maxlen: this.#maxlen, arrType: this.#arrType }
    return Reflect.construct(this.constructor, [values, options]) as this
  }

  protected override cloneInsert(value: T): void {
    this.push(value)
  }

  /**
   * Maximum size when constructed with `maxlen`, otherwise `undefined`.
   */
  get maxlen(): number | undefined {
    return this.#maxlen
  }

  readonly [Symbol.toStringTag] = 'Deque'

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
   * The index coerces as in `Array.prototype.at`, so `NaN` and non-numbers mean `0`.
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
      throw new RangeError(`index ${truncateForError(i)} out of range`)
    }
    this.#buf[this.#phys(idx)] = v
    return this
  }

  has(value: T): boolean {
    return this.includes(value)
  }

  /**
   * `true` when `x` is present (SameValueZero).
   */
  includes(x: T): boolean {
    return this.values().some((v) => sameValueZero(v, x))
  }

  /**
   * First element for which `fn` is truthy, or `undefined`.
   */
  find(fn: (v: T, i: number) => unknown): T | undefined {
    return this.values().find((v, i) => fn(v, i))
  }

  override forEach(cb: (value: T, key: number, coll: this) => void, thisArg?: unknown): void {
    for (let i = 0; i < this.#size; i++) {
      cb.call(thisArg, this.#buf[this.#phys(i)], i, this)
    }
  }

  /**
   * Copy of the elements in order.
   */
  toArray(): T[] {
    return this.values().toArray()
  }

  /**
   * Copy of the elements in reverse order.
   */
  toReversed(): T[] {
    return this.values().toArray().toReversed()
  }

  override keys(): IteratorObject<number> {
    return Iterator.from(this.#keys())
  }

  values(): IteratorObject<T> {
    return Iterator.from(this.#values())
  }

  override entries(): IteratorObject<[number, T]> {
    return Iterator.from(this.#entries())
  }

  *#keys(): Generator<number> {
    for (let i = 0; i < this.#size; i++) yield i
  }

  *#values(): Generator<T> {
    for (let i = 0; i < this.#size; i++) yield this.#buf[this.#phys(i)]
  }

  *#entries(): Generator<[number, T]> {
    for (let i = 0; i < this.#size; i++) yield [i, this.#buf[this.#phys(i)]]
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

  #grow(): void {
    const needed = this.#size + 1
    let newCap = Math.max(this.#cap * 2, needed)
    if (this.#maxlen !== undefined && this.#maxlen !== Infinity) {
      if (this.#cap >= this.#maxlen) return
      newCap = Math.min(newCap, this.#maxlen)
    }
    if (newCap <= this.#cap) return
    const nb = this.#alloc(newCap)
    for (let i = 0; i < this.#size; i++) nb[i] = this.#buf[this.#phys(i)]
    this.#buf = nb
    this.#cap = newCap
    this.#head = 0
  }

  #pushOne(x: T): void {
    if (this.#maxlen !== undefined && this.#size === this.#maxlen) {
      if (this.#maxlen === 0) return
      this.shift()
    }
    if (this.#size === this.#cap) this.#grow()
    this.#buf[this.#phys(this.#size)] = x
    this.#size++
  }

  #unshiftOne(x: T): void {
    if (this.#maxlen !== undefined && this.#size === this.#maxlen) {
      if (this.#maxlen === 0) return
      this.pop()
    }
    if (this.#size === this.#cap) this.#grow()
    this.#head = (this.#head - 1 + this.#cap) % this.#cap
    this.#buf[this.#head] = x
    this.#size++
  }
}

/** Initial buffer capacity: enough for `bound` live slots, never above finite maxlen. */
function capacityFor(bound: number, maxlen: number | undefined): number {
  if (bound <= 1) return 1
  if (maxlen !== undefined && maxlen !== Infinity && bound >= maxlen) return maxlen
  if (bound > 2 ** 30) return bound
  return 1 << (32 - Math.clz32(bound - 1))
}
