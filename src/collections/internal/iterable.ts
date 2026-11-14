import { assertNotHugeSparse, walkArray } from './arrayKeys.ts'

function isIterable(x: unknown): x is Iterable<unknown> {
  if (x == null) return false
  return typeof (x as Iterable<unknown>)[Symbol.iterator] === 'function'
}

/** Return `value` typed as an iterable; throw `TypeError` before allocating when it is not one. */
export function requireIterable<T>(value: unknown): Iterable<T> {
  if (!isIterable(value)) throw new TypeError('expected an iterable')
  return value as Iterable<T>
}

/**
 * True when `value` is an array that iterates with the built-in array iterator, so iterating it
 * visits every index up to `length`, holes included. An array with its own or a subclass's
 * `[Symbol.iterator]` iterates however that method says and is treated as any other iterable.
 */
export function iteratesAsArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value[Symbol.iterator] === Array.prototype.values
}

/**
 * Copy an iterable into a new plain array, as iterating it yields the values (holes read as
 * `undefined`). The copy never goes through `slice`, so an Array subclass's `Symbol.species`
 * cannot choose its class. Non-iterables throw `TypeError` and huge sparse arrays throw
 * `RangeError`, both before allocating.
 */
export function arrayFromIterable<T>(value: unknown): T[] {
  const it = requireIterable<T>(value)
  if (iteratesAsArray(it)) assertNotHugeSparse(it)
  const out: T[] = []
  for (const x of it) out.push(x)
  return out
}

/**
 * Map an iterable into a new array; non-iterables throw `TypeError` and huge sparse arrays throw
 * `RangeError`, both before allocating.
 */
export function arrayFromIterableMap<U>(
  value: unknown,
  mapFn: (item: unknown, index: number) => U
): U[] {
  const it = requireIterable(value)
  if (iteratesAsArray(it)) assertNotHugeSparse(it)
  const out: U[] = []
  let i = 0
  for (const x of it) {
    out.push(mapFn(x, i))
    i++
  }
  return out
}

/**
 * Visit array elements in own-element time: each own value, and each hole run once as
 * `undefined` at the run's start index. Return `false` from `visit` to stop.
 */
export function forEachArrayElement<T>(
  arr: T[],
  visit: (value: T, index: number) => boolean | undefined
): void {
  walkArray(arr, (ev) => {
    if (ev.kind === 'value') return visit(ev.value as T, ev.index)
    return visit(undefined as T, ev.start)
  })
}
