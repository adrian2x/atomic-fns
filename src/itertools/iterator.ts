/**
 * Builds a minimal iterable iterator from a `next` function.
 * Internal helper; not a public export (SPEC-R29).
 */
export function IterableIterator<T>(next: Iterator<T>['next']): Iterable<T> & Iterator<T> {
  return {
    next,
    [Symbol.iterator]() {
      return this
    }
  }
}
