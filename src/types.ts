/**
 * A generic function type with arbitrary arguments and return.
 */
export type AnyFunction<TReturn = unknown> = (...args: never[]) => TReturn

/**
 * An iteratee function used for collection methods such as filter, find, forEach, map, pick,
 * omit, uniq, sortedUniq, and groupBy.
 */
export type Iteratee<T = unknown, K = PropertyKey, TResult = unknown> = (
  value: T,
  key?: K,
  arr?: unknown
) => TResult

export type Predicate<T = unknown, TReturn = unknown> = (value: T) => TReturn
