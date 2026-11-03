/**
 * A generic function type with arbitrary arguments and return.
 */
export type AnyFunction<TReturn = unknown> = (...args: never[]) => TReturn

/**
 * An iteratee function used for collection methods.
 * @see {@link collections.filter}
 * @see {@link collections.find}
 * @see {@link collections.forEach}
 * @see {@link collections.index}
 * @see {@link collections.map}
 * @see {@link collections.pick}
 * @see {@link collections.omit}
 * @see {@link collections.uniq}
 * @see {@link collections.sortedUniq}
 * @see {@link collections.groupBy}
 */
export type Iteratee<T = unknown, K = PropertyKey, TResult = unknown> = (
  value: T,
  key?: K,
  arr?: unknown
) => TResult

export type Predicate<T = unknown, TReturn = unknown> = (value: T) => TReturn
