function isIterable(x: unknown): x is Iterable<unknown> {
  if (x == null) return false
  return typeof (x as Iterable<unknown>)[Symbol.iterator] === 'function'
}

/** Materialize an iterable; throw before allocating when the value is not iterable. */
export function requireIterable<T>(value: unknown): Iterable<T> {
  if (!isIterable(value)) throw new TypeError('expected an iterable')
  return value as Iterable<T>
}

/** Copy an iterable into a new array; non-iterables throw `TypeError` before allocating. */
export function arrayFromIterable<T>(value: unknown): T[] {
  const it = requireIterable<T>(value)
  const out: T[] = []
  for (const x of it) out.push(x)
  return out
}

/** Map an iterable into a new array; non-iterables throw `TypeError` before allocating. */
export function arrayFromIterableMap<U>(
  value: unknown,
  mapFn: (item: unknown, index: number) => U
): U[] {
  const it = requireIterable(value)
  const out: U[] = []
  let i = 0
  for (const x of it) {
    out.push(mapFn(x, i))
    i++
  }
  return out
}
