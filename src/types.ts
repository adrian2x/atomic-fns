/**
 * A generic function type with arbitrary arguments and return.
 */
export type Function<TReturn = any> = (...args: any) => TReturn

/**
 * An iteratee function used for collection methods.
 * @see {@link Collections.filter}
 * @see {@link Collections.find}
 * @see {@link Collections.forEach}
 * @see {@link Collections.index}
 * @see {@link Collections.map}
 * @see {@link Collections.pick}
 * @see {@link Collections.omit}
 * @see {@link Collections.uniq}
 * @see {@link Collections.sortedUniq}
 * @see {@link Collections.groupBy}
 */
export type Iteratee<T = any, K = any, TResult = any> = (value: T, key?: K, arr?) => TResult

export type Predicate<T = any, TReturn = any> = (value: T) => TReturn
