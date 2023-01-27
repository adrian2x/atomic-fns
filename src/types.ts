/**
 * A generic function type with arbitrary arguments and return.
 */
export type Function<TReturn = any> = (...args: any) => TReturn

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
export type Iteratee<T = any, K = any, TResult = any> = (value: T, key?: K, arr?) => TResult

export type Predicate<T = any, TReturn = any> = (value: T) => TReturn
