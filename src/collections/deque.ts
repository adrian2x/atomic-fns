import { truncateForError } from '../internal/truncate.js'
import { sameValueZero } from '../operators/index.js'
import { SetCollection } from './abc.js'

/**
 * Double-ended queue backed by a power-of-two ring buffer.
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
   * @param items Initial elements. When longer than `maxlen`, only the last `maxlen` remain.
   * @param options.maxlen Maximum size; overflow evicts from the opposite end. `0` makes push/unshift no-ops.
   * @param options.arrType Typed-array (or similar) constructor used for storage.
   * @throws {RangeError} when `maxlen` is negative or not an integer.
   */
  constructor(
    items?: Iterable<T> | null,
    options?: { maxlen?: number; arrType?: new (n: number) => { [i: number]: T; length: number } }
  ) {
    super()
    const maxlen = options?.maxlen
    if (maxlen !== undefined && (!Number.isInteger(maxlen) || maxlen < 0)) {
      throw new RangeError('maxlen must be a non-negative integer')
    }
    this.#maxlen = maxlen
    this.#arrType = options?.arrType
    this.#empty = (this.#arrType ? 0 : undefined) as T

    const list = items == null ? [] : Array.from(items)
    const bound = maxlen === undefined ? list.length : Math.min(list.length, maxlen)
    this.#cap = Math.max(8, nextPow2(bound))
    this.#buf = this.#alloc(this.#cap)

    for (const x of list) {
      this.#pushOne(x)
    }
  }

  get size(): number {
    return this.#size
  }

  protected override cloneFrom(values: Iterable<T>): this {
    return new Deque(values, { maxlen: this.#maxlen, arrType: this.#arrType }) as this
  }

  /**
   * Maximum size when constructed with `maxlen`, otherwise `undefined`.
   */
  get maxlen(): number | undefined {
    return this.#maxlen
  }

  readonly [Symbol.toStringTag] = 'Deque'

  clear(): void {
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
    this.#head = (this.#head + 1) & (this.#cap - 1)
    this.#size--
    return x
  }

  /**
   * Element at index `i` (negative from the end). Out of range or empty -> `undefined`.
   * `NaN` is treated as `0`.
   */
  at(i: number): T | undefined {
    let idx = Number.isNaN(i) ? 0 : Math.trunc(i)
    if (idx < 0) idx += this.#size
    if (idx < 0 || idx >= this.#size) return undefined
    return this.#buf[this.#phys(idx)]
  }

  /**
   * Replace the element at index `i` (negative from the end).
   * @returns `this`
   * @throws {RangeError} when the index is out of range.
   */
  set(i: number, v: T): this {
    let idx = Number.isNaN(i) ? 0 : Math.trunc(i)
    if (idx < 0) idx += this.#size
    if (idx < 0 || idx >= this.#size) {
      throw new RangeError(`index ${truncateForError(idx)} out of range`)
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

  #phys(i: number): number {
    return (this.#head + i) & (this.#cap - 1)
  }

  #alloc(n: number): { [i: number]: T; length: number } {
    if (this.#arrType) return new this.#arrType(n)
    return new Array<T>(n)
  }

  #grow(): void {
    if (this.#maxlen !== undefined && this.#cap >= nextPow2(this.#maxlen)) return
    const newCap = this.#cap * 2
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
    this.#head = (this.#head - 1) & (this.#cap - 1)
    this.#buf[this.#head] = x
    this.#size++
  }
}

function nextPow2(n: number): number {
  if (n <= 1) return 1
  return 1 << (32 - Math.clz32(n - 1))
}
