import { assertNotHugeSparse, walkArray } from './arrayKeys.js'

function isIterable(x: unknown): x is Iterable<unknown> {
  if (x == null) return false
  return typeof (x as Iterable<unknown>)[Symbol.iterator] === 'function'
}

/** Array.isArray as a typed guard (avoids `any[]` narrowing). */
export function isTypedArray<T>(x: Iterable<T>): x is T[] {
  return Array.isArray(x)
}

/** Materialize an iterable; throw before allocating when the value is not iterable. */
export function requireIterable<T>(value: unknown): Iterable<T> {
  if (!isIterable(value)) throw new TypeError('expected an iterable')
  return value as Iterable<T>
}

/** Copy an iterable into a new array; non-iterables throw `TypeError` before allocating. */
export function arrayFromIterable<T>(value: unknown): T[] {
  const it = requireIterable<T>(value)
  if (Array.isArray(it)) {
    assertNotHugeSparse(it)
    return (it as T[]).slice()
  }
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
  if (Array.isArray(it)) {
    assertNotHugeSparse(it)
  }
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

/**
 * Yield array elements in own-element time (hole runs as one `undefined` each).
 * Materializes the event list first so huge sparse arrays finish in own-element time.
 */
export function* arrayElements<T>(arr: T[]): Generator<T, void, undefined> {
  const out: T[] = []
  forEachArrayElement(arr, (v) => {
    out.push(v)
    return undefined
  })
  yield* out
}

/** Guard per-index array producers: reject absolute-length huge sparse arrays. */
export function assertArrayNotHugeSparse(value: unknown): void {
  if (Array.isArray(value)) assertNotHugeSparse(value as unknown[])
}

/** Sources a lazy helper has opened and still owes a `return()`. */
type OpenSources = Set<Iterator<unknown>>

/** Calls `return()` on every source, even after one throws, and hands back what was thrown. */
function closeAll(open: OpenSources): unknown[] {
  const failures: unknown[] = []
  for (const source of open) {
    try {
      source.return?.()
    } catch (error) {
      failures.push(error)
    }
  }
  open.clear()
  return failures
}

function closeOrThrow(open: OpenSources): void {
  const failures = closeAll(open)
  if (failures.length > 0) throw failures[0]
}

/** Advances `source`. One that finishes or throws leaves `open`, so nothing closes it again. */
export function pull<T>(open: OpenSources, source: Iterator<T>): IteratorResult<T> {
  open.delete(source)
  const result = source.next()
  if (!result.done) open.add(source)
  return result
}

/** Yields what is left of `source`. */
export function* drain<T>(open: OpenSources, source: Iterator<T>): Generator<T, void, undefined> {
  for (let result = pull(open, source); !result.done; result = pull(open, source)) {
    yield result.value
  }
}

/**
 * Runs `body` over `sources`, closing the unfinished ones on every exit, even the `return()` before
 * the first `next()` that a bare generator skips. An error in flight outranks a failing `return()`.
 */
export function closingIterator<T>(
  sources: Iterable<Iterator<unknown>>,
  body: (open: OpenSources) => Generator<T, void, undefined>
): IteratorObject<T> {
  const open = new Set(sources)
  const generator = body(open)
  return Iterator.from<T>({
    next() {
      let result: IteratorResult<T, void>
      try {
        result = generator.next()
      } catch (error) {
        closeAll(open)
        throw error
      }
      if (result.done) closeOrThrow(open)
      return result
    },
    return() {
      generator.return()
      closeOrThrow(open)
      return { done: true, value: undefined }
    }
  })
}
