/**
 * Set operations on arrays: values in order of first appearance, duplicates removed, compared
 * with SameValueZero (as `Set` and `includes` do) unless a key or equality function is given.
 */

type KeyOf<T> = (value: T) => unknown
type Equals<T> = (a: T, b: T) => unknown

const same = <T>(value: T): T => value

function splitLast<T, F>(rest: readonly unknown[], what: string): [Iterable<T>[], F] {
  const fn = rest[rest.length - 1]
  if (typeof fn !== 'function') {
    throw new TypeError(`the last argument must be ${what}, got ${typeof fn}`)
  }
  // TypeScript cannot split a tuple whose rest element comes first, so the halves are cast.
  return [rest.slice(0, -1) as Iterable<T>[], fn as F]
}

function uniqueBy<T>(
  lists: Iterable<Iterable<T>>,
  keyOf: (value: T) => unknown,
  keep: (key: unknown) => boolean
): T[] {
  const seen = new Set<unknown>()
  const out: T[] = []
  for (const list of lists) {
    for (const value of list) {
      const key = keyOf(value)
      if (seen.has(key)) continue
      seen.add(key)
      if (keep(key)) out.push(value)
    }
  }
  return out
}

function keySet<T>(list: Iterable<T>, keyOf: (value: T) => unknown): Set<unknown> {
  const keys = new Set<unknown>()
  for (const value of list) keys.add(keyOf(value))
  return keys
}

function uniqueWith<T>(
  lists: Iterable<Iterable<T>>,
  equals: (a: T, b: T) => unknown,
  keep: (value: T) => boolean
): T[] {
  const out: T[] = []
  for (const list of lists) {
    for (const value of list) {
      if (out.some((kept) => equals(value, kept)) || !keep(value)) continue
      out.push(value)
    }
  }
  return out
}

/**
 * `array` with the later elements that give the same key as an earlier one removed.
 * `[...new Set(array)]` is the plain `uniq`.
 * @param array The array to read.
 * @param keyOf Returns the key of one element, compared with SameValueZero.
 * @returns A new array of the first element for each key.
 * @example
 * ```ts
 * uniqBy([2.1, 1.2, 2.3], Math.floor) // [2.1, 1.2]
 * ```
 */
export function uniqBy<T>(array: Iterable<T>, keyOf: (value: T) => unknown): T[] {
  return uniqueBy([array], keyOf, () => true)
}

/**
 * `array` with the later elements that `equals` matches to an earlier one removed. It costs one
 * comparison per pair of kept elements.
 * @param array The array to read.
 * @param equals Returns truthy when two elements count as the same; it gets the element under test
 *   first and the kept element second.
 * @returns A new array of the first element of each group.
 * @example
 * ```ts
 * uniqWith([{ x: 1 }, { x: 1 }], (a, b) => a.x === b.x) // [{ x: 1 }]
 * ```
 */
export function uniqWith<T>(array: Iterable<T>, equals: (a: T, b: T) => unknown): T[] {
  return uniqueWith([array], equals, () => true)
}

/**
 * The distinct values of `array` that none of `others` holds.
 * @param array The array to keep values from.
 * @param others The arrays whose values to leave out.
 * @returns A new array, in the order of `array`.
 * @example
 * ```ts
 * difference([2, 1, 2, 3], [2]) // [1, 3]
 * ```
 */
export function difference<T>(array: Iterable<T>, ...others: Iterable<T>[]): T[] {
  return differenceBy(array, ...others, same)
}

/**
 * {@link difference} by the key `keyOf` gives each value; the key function comes last.
 * @param array The array to keep values from.
 * @param rest The arrays to leave out, then the key function.
 * @returns A new array, in the order of `array`.
 * @throws {TypeError} when the last argument is not a function.
 * @example
 * ```ts
 * differenceBy([2.1, 1.2], [2.3], Math.floor) // [1.2]
 * ```
 */
export function differenceBy<T>(
  array: Iterable<T>,
  ...rest: [...others: Iterable<T>[], keyOf: (value: T) => unknown]
): T[] {
  const [others, keyOf] = splitLast<T, KeyOf<T>>(rest, 'a key function')
  const excluded = new Set<unknown>()
  for (const other of others) for (const value of other) excluded.add(keyOf(value))
  return uniqueBy([array], keyOf, (key) => !excluded.has(key))
}

/**
 * {@link difference} with `equals` deciding which values match; the function comes last.
 * @param array The array to keep values from.
 * @param rest The arrays to leave out, then the equality function, which gets the element under
 *   test first and the kept or excluded element second.
 * @returns A new array, in the order of `array`.
 * @throws {TypeError} when the last argument is not a function.
 * @example
 * ```ts
 * differenceWith([{ x: 1 }, { x: 2 }], [{ x: 1 }], (a, b) => a.x === b.x) // [{ x: 2 }]
 * ```
 */
export function differenceWith<T>(
  array: Iterable<T>,
  ...rest: [...others: Iterable<T>[], equals: (a: T, b: T) => unknown]
): T[] {
  const [others, equals] = splitLast<T, Equals<T>>(rest, 'an equality function')
  const excluded = others.flatMap((other) => [...other])
  return uniqueWith([array], equals, (value) => !excluded.some((other) => equals(value, other)))
}

/**
 * The distinct values of the first array that every other array holds.
 * @param arrays The arrays to intersect.
 * @returns A new array, in the order of the first array; `[]` with no arrays.
 * @example
 * ```ts
 * intersection([2, 1, 2], [2, 3], [4, 2]) // [2]
 * ```
 */
export function intersection<T>(...arrays: Iterable<T>[]): T[] {
  return intersectionBy(...arrays, same)
}

/**
 * {@link intersection} by the key `keyOf` gives each value; the key function comes last.
 * @param rest The arrays to intersect, then the key function.
 * @returns A new array, in the order of the first array.
 * @throws {TypeError} when the last argument is not a function.
 * @example
 * ```ts
 * intersectionBy([2.1, 1.2], [2.3], Math.floor) // [2.1]
 * ```
 */
export function intersectionBy<T>(
  ...rest: [...arrays: Iterable<T>[], keyOf: (value: T) => unknown]
): T[] {
  const [arrays, keyOf] = splitLast<T, KeyOf<T>>(rest, 'a key function')
  if (arrays.length === 0) return []
  const others = arrays.slice(1).map((other) => keySet(other, keyOf))
  return uniqueBy([arrays[0]], keyOf, (key) => others.every((keys) => keys.has(key)))
}

/**
 * The distinct values of all `arrays`, in order of first appearance.
 * @param arrays The arrays to join.
 * @returns A new array.
 * @example
 * ```ts
 * union([2], [1, 2], [3]) // [2, 1, 3]
 * ```
 */
export function union<T>(...arrays: Iterable<T>[]): T[] {
  return uniqueBy(arrays, same, () => true)
}

/**
 * {@link union} by the key `keyOf` gives each value; the key function comes last.
 * @param rest The arrays to join, then the key function.
 * @returns A new array of the first value for each key.
 * @throws {TypeError} when the last argument is not a function.
 * @example
 * ```ts
 * unionBy([2.1], [1.2, 2.3], Math.floor) // [2.1, 1.2]
 * ```
 */
export function unionBy<T>(...rest: [...arrays: Iterable<T>[], keyOf: (value: T) => unknown]): T[] {
  const [arrays, keyOf] = splitLast<T, KeyOf<T>>(rest, 'a key function')
  return uniqueBy(arrays, keyOf, () => true)
}

/**
 * The distinct values that exactly one of `arrays` holds (for two arrays, the symmetric
 * difference), in order of first appearance.
 * @param arrays The arrays to compare.
 * @returns A new array.
 * @example
 * ```ts
 * xor([2, 1], [2, 3]) // [1, 3]
 * xor([1], [1], [1]) // []
 * ```
 */
export function xor<T>(...arrays: Iterable<T>[]): T[] {
  return xorBy(...arrays, same)
}

/**
 * {@link xor} by the key `keyOf` gives each value; the key function comes last.
 * @param rest The arrays to compare, then the key function.
 * @returns A new array of the first value for each key only one array holds.
 * @throws {TypeError} when the last argument is not a function.
 * @example
 * ```ts
 * xorBy([2.1, 1.2], [2.3], Math.floor) // [1.2]
 * ```
 */
export function xorBy<T>(...rest: [...arrays: Iterable<T>[], keyOf: (value: T) => unknown]): T[] {
  const [arrays, keyOf] = splitLast<T, KeyOf<T>>(rest, 'a key function')
  const lists = arrays.map((array) => Array.from(array, (value) => [value, keyOf(value)] as const))
  const keyOfPair = ([, key]: readonly [T, unknown]) => key
  const holders = new Map<unknown, number>()
  for (const list of lists) {
    for (const key of keySet(list, keyOfPair)) holders.set(key, (holders.get(key) ?? 0) + 1)
  }
  return uniqueBy(lists, keyOfPair, (key) => holders.get(key) === 1).map(([value]) => value)
}
