/**
 * Random numbers and draws: `random`, `randomInt`, `sample`, `sampleSize` and `shuffle`. Every
 * function uses `Math.random` unless given `{ random }`, a function that returns numbers in
 * `[0, 1)`. `Math.random` is not cryptographically secure, so do not draw tokens, keys or anything
 * secret with it: use `fns/id` or `crypto.getRandomValues` for those.
 * @module random
 */
import { values } from '../collections/entries.ts'
import type { Collection, CollectionValue } from '../collections/shape.ts'
import { isEnumerable } from '../internal/keys.ts'
import { typedArrayLength } from '../internal/kind.ts'

/** The random source option every function in `fns/random` takes. */
export interface RandomOptions {
  /** Returns numbers in `[0, 1)`, as `Math.random` does (the default). */
  random?: () => number
}

/** Options for {@link random}. */
export interface RandomNumberOptions extends RandomOptions {
  /** Return a float in `[min, max)` even when both bounds are integers. */
  float?: boolean
}

const TWO_32 = 2 ** 32
const TWO_53 = 2 ** 53

/** Redraws before accepting that a stubbed source keeps repeating a rejected draw. */
const MAX_DRAWS = 64

function isRandomNumberOptions(x: unknown): x is RandomNumberOptions {
  return typeof x === 'object' && x !== null
}

/** The source `options` names, checked on every draw against the `[0, 1)` contract. */
function sourceOf(options: RandomOptions | undefined): () => number {
  const source = options?.random ?? Math.random
  if (typeof source !== 'function') throw new TypeError('random must be a function')
  return () => {
    const r: unknown = source()
    if (typeof r !== 'number') throw new TypeError('random must return a number')
    if (!(r >= 0 && r < 1)) throw new RangeError('random must return a number in [0, 1)')
    return r
  }
}

/** The top 32 bits of one draw, which every source with at least 32 bits of precision fills. */
function draw32(source: () => number): number {
  return Math.floor(source() * TWO_32)
}

/** 53 random bits from two 32-bit chunks, so no bit depends on the precision of the source. */
function draw53(source: () => number): number {
  const high21 = Math.floor(draw32(source) / 2 ** 11)
  return high21 * TWO_32 + draw32(source)
}

function uniformInt(min: number, max: number, source: () => number): number {
  // A span of up to 2^32 values takes one 32-bit draw, a wider one a 53-bit draw, and a span wider
  // than 2^53 adds a coin flip for the top bit.
  const narrow = max - min < TWO_32
  const wide = max - min >= TWO_53
  const range = narrow ? TWO_32 : TWO_53
  const span = wide ? TWO_53 : max - min + 1
  const bucket = (range - (range % span)) / span
  for (let draws = 0; draws < MAX_DRAWS; draws++) {
    const draw = narrow ? draw32(source) : draw53(source)
    const top = wide && source() >= 0.5 ? TWO_53 : 0
    const value = min + top + (draw - (draw % bucket)) / bucket
    if (value <= max) return value
  }
  return max
}

/** Moves `size` uniformly drawn items to the front of `items` (Fisher-Yates) and keeps those. */
function drawInPlace<T>(items: T[], size: number, source: () => number): T[] {
  for (let i = 0; i < size && i < items.length - 1; i++) {
    const j = uniformInt(i, items.length - 1, source)
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  items.length = size
  return items
}

function indexedLength(collection: Collection): number | undefined {
  if (Array.isArray(collection)) return collection.length
  if (typeof collection === 'object' && collection !== null) return typedArrayLength(collection)
  return undefined
}

function drawIndices(
  collection: object,
  length: number,
  size: number,
  source: () => number
): number[] | undefined {
  const indices: number[] = []
  const displaced = new Map<number, number>()
  for (let i = 0; i < size; i++) {
    const j = i < length - 1 ? uniformInt(i, length - 1, source) : i
    const index = displaced.get(j) ?? j
    if (Array.isArray(collection) && !isEnumerable(collection, index)) {
      return undefined
    }
    displaced.set(j, displaced.get(i) ?? i)
    indices.push(index)
  }
  return indices
}

/**
 * Returns a uniform random integer from `min` to `max`, both included, across any span of safe
 * integers.
 * @param min The lower bound (included).
 * @param max The upper bound (included).
 * @param options `random`, the source of randomness.
 * @returns The integer.
 * @throws {TypeError} when a bound is not a number, `random` is not a function or it returns a
 *   value that is not a number.
 * @throws {RangeError} when a bound is not a safe integer, `max < min`, or `random` returns a
 *   number outside `[0, 1)`.
 * @example
 * ```ts
 * randomInt(1, 6) // a die roll
 * ```
 */
export function randomInt(min: number, max: number, options?: RandomOptions): number {
  if (typeof min !== 'number' || typeof max !== 'number') {
    throw new TypeError('min and max must be numbers')
  }
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
    throw new RangeError('min and max must be safe integers')
  }
  if (max < min) throw new RangeError('max must be >= min')
  return uniformInt(min, max, sourceOf(options))
}

/**
 * Returns a random number from `min` (default 0) to `max` (default 1), as lodash does: an integer
 * with both bounds included, or a float in `[min, max)` when `float` is set or a bound is not a
 * safe integer. One number is `max`.
 * @param min The lower bound, or `max` when it is the only number.
 * @param max The upper bound.
 * @param options `float` and `random`.
 * @returns The random number.
 * @throws {TypeError} when a bound is not a number, `random` is not a function or it returns a
 *   value that is not a number.
 * @throws {RangeError} when a bound is not finite, `max < min`, or `random` returns a number
 *   outside `[0, 1)`.
 * @example
 * ```ts
 * random(5) // an integer from 0 to 5
 * random(1.5, 2.5) // a float in [1.5, 2.5)
 * random(0, 1, { float: true }) // a float in [0, 1)
 * ```
 */
export function random(options?: RandomNumberOptions): number
/** A random number from 0 to `max`. */
export function random(max: number, options?: RandomNumberOptions): number
/** A random number from `min` to `max`. */
export function random(min: number, max: number, options?: RandomNumberOptions): number
/**
 * @param first `min`, `max`, or the options.
 * @param second `max`, or the options.
 * @param third The options.
 */
export function random(
  first?: number | RandomNumberOptions,
  second?: number | RandomNumberOptions,
  third?: RandomNumberOptions
): number {
  const options = [first, second, third].find(isRandomNumberOptions)
  const bounds: number[] = []
  for (const bound of [first, second]) {
    if (bound === undefined || isRandomNumberOptions(bound)) continue
    if (typeof bound !== 'number') throw new TypeError('min and max must be numbers')
    bounds.push(bound)
  }
  const [min, max] = bounds.length === 2 ? bounds : [0, bounds[0] ?? 1]
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new RangeError('min and max must be finite')
  }
  if (max < min) throw new RangeError('max must be >= min')
  const source = sourceOf(options)
  if (!options?.float && Number.isSafeInteger(min) && Number.isSafeInteger(max)) {
    return uniformInt(min, max, source)
  }
  const r = source()
  const value = min * (1 - r) + max * r
  return value >= min && value < max ? value : min
}

/**
 * Returns a random value of a collection, or `undefined` when it has none. Collections follow the
 * fns/collection shapes: an object gives its own enumerable values, an array its elements (holes
 * skipped), a string its code points, a `Map` or `Set` its values, and any other iterable its
 * items. Arrays and typed arrays read only selected positions unless an array hole triggers a
 * full scan. Sparse arrays may consume extra draws, so their seeded results can differ from
 * sampling their collected values.
 * @param collection The collection to draw from.
 * @param options `random`, the source of randomness.
 * @returns The value drawn.
 * @throws {TypeError} when `random` is not a function or returns a value that is not a number.
 * @throws {RangeError} when `random` returns a number outside `[0, 1)`.
 * @example
 * ```ts
 * sample([1, 2, 3]) // 1, 2 or 3
 * sample({ a: 1, b: 2 }) // 1 or 2
 * ```
 */
export function sample<C extends Collection>(
  collection: C,
  options?: RandomOptions
): CollectionValue<C> | undefined {
  const source = sourceOf(options)
  const length = indexedLength(collection)
  if (length !== undefined) {
    if (length === 0) return undefined
    const index = uniformInt(0, length - 1, source)
    if (!Array.isArray(collection) || isEnumerable(collection, index)) {
      return (collection as ArrayLike<CollectionValue<C>>)[index]
    }
  }
  const items = values(collection)
  if (items.length === 0) return undefined
  return items[uniformInt(0, items.length - 1, source)]
}

/**
 * Returns `n` values of a collection at distinct positions, in random order, or every value when
 * it has fewer than `n`. Sampling follows {@link sample}, including its collection shapes and
 * sparse-array behavior. Full samples, and samples of at least five values covering at least half
 * an array or typed array, copy its values before drawing. Smaller partial samples read only
 * selected positions unless a missing position triggers a full scan. An `n` of 0 reads no values.
 * @param collection The collection to draw from.
 * @param n How many values to draw.
 * @param options `random`, the source of randomness.
 * @returns The values drawn.
 * @throws {TypeError} when `n` is not a number, `random` is not a function or it returns a value
 *   that is not a number.
 * @throws {RangeError} when `n` is not a non-negative integer or `random` returns a number outside
 *   `[0, 1)`.
 * @example
 * ```ts
 * sampleSize([1, 2, 3], 2) // two of them, such as [3, 1]
 * sampleSize([1, 2, 3], 4) // all three, shuffled
 * ```
 */
export function sampleSize<C extends Collection>(
  collection: C,
  n: number,
  options?: RandomOptions
): CollectionValue<C>[] {
  if (typeof n !== 'number') throw new TypeError('n must be a number')
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError('n must be a non-negative integer')
  const source = sourceOf(options)
  if (n === 0) return []
  const length = indexedLength(collection)
  if (length !== undefined && n < length && (n < 5 || n < length / 2)) {
    const indices = drawIndices(collection as object, length, Math.min(n, length), source)
    if (indices !== undefined) {
      const items = collection as ArrayLike<CollectionValue<C>>
      return indices.map((index) => items[index])
    }
  }
  const items = values(collection)
  return drawInPlace(items, Math.min(n, items.length), source)
}

/**
 * Returns the values of a collection in random order, with a Fisher-Yates shuffle. It never
 * changes `collection`; collections follow the shapes of {@link sample}.
 * @param collection The collection to shuffle.
 * @param options `random`, the source of randomness.
 * @returns A new array of the values.
 * @throws {TypeError} when `random` is not a function or returns a value that is not a number.
 * @throws {RangeError} when `random` returns a number outside `[0, 1)`.
 * @example
 * ```ts
 * shuffle([1, 2, 3, 4]) // such as [3, 1, 4, 2]
 * ```
 */
export function shuffle<C extends Collection>(
  collection: C,
  options?: RandomOptions
): CollectionValue<C>[] {
  const source = sourceOf(options)
  const items = values(collection)
  return drawInPlace(items, items.length, source)
}
