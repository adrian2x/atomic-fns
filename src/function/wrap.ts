import { assertFunction } from './shared.ts'

type AnyFunction = (...args: never[]) => unknown

/**
 * A curried function over the parameters `A`: each call takes any leading slice of the parameters
 * still missing and returns the result once no required parameter is left, else another `Curried`.
 */
export type Curried<A extends unknown[], R> = <P extends Partial<A>>(
  ...args: P
) => A extends [...Extract<{ [K in keyof P]: unknown }, unknown[]>, ...infer Rest]
  ? [] extends Rest
    ? R
    : Curried<Rest, R>
  : R

/**
 * A function curried to an explicit arity, which the type system does not track: every call is
 * typed as returning another `LooseFunction`, so narrow the final result yourself.
 */
export type LooseFunction = (...args: unknown[]) => LooseFunction

/**
 * Creates a function that collects arguments until it has `arity` of them (default `fn.length`),
 * then calls `fn` with them and the `this` of the latest call. Each partial application can be
 * reused. Throws `RangeError` unless `arity` is a non-negative safe integer.
 * @param fn The function to curry.
 * @param arity How many arguments to wait for.
 * @returns The curried function.
 * @example
 * ```ts
 * const add = curry((a: number, b: number, c: number) => a + b + c)
 * add(1)(2)(3) // 6
 * add(1, 2, 3) // 6
 * ```
 */
export function curry<A extends unknown[], R>(
  fn: (...args: A) => R,
  arity?: undefined
): Curried<A, R>
/** Curries to an explicit arity, typed loosely. */
export function curry(fn: (...args: never[]) => unknown, arity: number): LooseFunction
export function curry(fn: AnyFunction, arity?: number): unknown {
  assertFunction(fn, 'fn')
  const required = arity ?? fn.length
  if (!Number.isSafeInteger(required) || required < 0) {
    throw new RangeError('arity must be a non-negative safe integer')
  }
  const curried = function (this: unknown, ...args: unknown[]): unknown {
    if (args.length >= required) return Reflect.apply(fn, this, args)
    return function (this: unknown, ...more: unknown[]): unknown {
      return Reflect.apply(curried, this, args.concat(more))
    }
  }
  return curried
}

/**
 * Flattens one level, as lodash `flow` does, and refuses anything but functions. Holes in a nested
 * array count as `undefined`, so they are refused too.
 */
function pipelineOf(fns: readonly (AnyFunction | readonly AnyFunction[])[]): AnyFunction[] {
  const pipeline: AnyFunction[] = []
  for (const entry of fns) {
    if (Array.isArray(entry)) pipeline.push(...Array.from(entry))
    // `Array.isArray` does not narrow a readonly array out of the union
    else pipeline.push(entry as AnyFunction)
  }
  for (const fn of pipeline) assertFunction(fn, 'each argument')
  return pipeline
}

function pipeThrough(thisArg: unknown, fns: readonly AnyFunction[], args: unknown[]): unknown {
  if (fns.length === 0) return args[0]
  let result = Reflect.apply(fns[0], thisArg, args)
  for (let i = 1; i < fns.length; i++) result = Reflect.apply(fns[i], thisArg, [result])
  return result
}

/**
 * Composes functions left to right: the first receives every argument, each later one the
 * previous result, and all run with the caller's `this`. With no functions it returns its first
 * argument. Arrays of functions flatten one level, as in lodash.
 * @returns The composed function.
 * @example
 * ```ts
 * const shout = flow((s: string) => s.trim(), (s: string) => s.toUpperCase())
 * shout(' hi ') // 'HI'
 * ```
 */
export function flow(): <T>(value: T) => T
/** Flow over these functions, typed from first to last. */
export function flow<A extends unknown[], R>(fn: (...a: A) => R): (...a: A) => R
/** Flow over these functions, typed from first to last. */
export function flow<A extends unknown[], B, C>(f1: (...a: A) => B, f2: (b: B) => C): (...a: A) => C
/** Flow over these functions, typed from first to last. */
export function flow<A extends unknown[], B, C, D>(
  f1: (...a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D
): (...a: A) => D
/** Flow over these functions, typed from first to last. */
export function flow<A extends unknown[], B, C, D, E>(
  f1: (...a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E
): (...a: A) => E
/** Flow over these functions, typed from first to last. */
export function flow<A extends unknown[], B, C, D, E, F>(
  f1: (...a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => F
): (...a: A) => F
/** Flow over these functions, typed from first to last. */
export function flow<A extends unknown[], B, C, D, E, F, G>(
  f1: (...a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => F,
  f6: (f: F) => G
): (...a: A) => G
/** Flow over any number of functions of one type, or arrays of them. */
export function flow<T>(
  ...fns: (((value: T) => T) | readonly ((value: T) => T)[])[]
): (value: T) => T
/** @param fns The functions to apply, left to right. */
export function flow(...fns: (AnyFunction | readonly AnyFunction[])[]): (...a: never[]) => unknown {
  const pipeline = pipelineOf(fns)
  return function (this: unknown, ...args: never[]): unknown {
    return pipeThrough(this, pipeline, args)
  }
}

/**
 * Composes functions right to left, as {@link flow} does left to right. Does not reverse an array
 * passed to it.
 * @returns The composed function.
 * @example
 * ```ts
 * const shout = compose((s: string) => s.toUpperCase(), (s: string) => s.trim())
 * shout(' hi ') // 'HI'
 * ```
 */
export function compose(): <T>(value: T) => T
/** Compose these functions, typed from last to first. */
export function compose<A extends unknown[], R>(fn: (...a: A) => R): (...a: A) => R
/** Compose these functions, typed from last to first. */
export function compose<A extends unknown[], B, C>(
  f2: (b: B) => C,
  f1: (...a: A) => B
): (...a: A) => C
/** Compose these functions, typed from last to first. */
export function compose<A extends unknown[], B, C, D>(
  f3: (c: C) => D,
  f2: (b: B) => C,
  f1: (...a: A) => B
): (...a: A) => D
/** Compose these functions, typed from last to first. */
export function compose<A extends unknown[], B, C, D, E>(
  f4: (d: D) => E,
  f3: (c: C) => D,
  f2: (b: B) => C,
  f1: (...a: A) => B
): (...a: A) => E
/** Compose these functions, typed from last to first. */
export function compose<A extends unknown[], B, C, D, E, F>(
  f5: (e: E) => F,
  f4: (d: D) => E,
  f3: (c: C) => D,
  f2: (b: B) => C,
  f1: (...a: A) => B
): (...a: A) => F
/** Compose these functions, typed from last to first. */
export function compose<A extends unknown[], B, C, D, E, F, G>(
  f6: (f: F) => G,
  f5: (e: E) => F,
  f4: (d: D) => E,
  f3: (c: C) => D,
  f2: (b: B) => C,
  f1: (...a: A) => B
): (...a: A) => G
/** Compose any number of functions of one type, or arrays of them. */
export function compose<T>(
  ...fns: (((value: T) => T) | readonly ((value: T) => T)[])[]
): (value: T) => T
/** @param fns The functions to apply, right to left. */
export function compose(
  ...fns: (AnyFunction | readonly AnyFunction[])[]
): (...a: never[]) => unknown {
  const reversed = pipelineOf(fns).reverse()
  return function (this: unknown, ...args: never[]): unknown {
    return pipeThrough(this, reversed, args)
  }
}

/** The store a memoized function reads and writes; a `Map` or anything with its interface. */
export interface MemoizeCache<K, V> {
  /** Returns the stored value for `key`. */
  get(key: K): V | undefined
  /** Stores `value` under `key`. */
  set(key: K, value: V): unknown
  /** Whether `key` is stored. */
  has(key: K): boolean
  /** Removes `key`. */
  delete(key: K): boolean
  /** Removes every key. */
  clear(): void
  /** How many keys are stored. */
  readonly size: number
}

/** A memoized function and its replaceable `cache`. */
export type Memoized<F extends (...args: never[]) => unknown> = ((
  this: ThisParameterType<F>,
  ...args: Parameters<F>
) => ReturnType<F>) & {
  /** The store lookups read; assign another `Map`-like store to replace it. */
  cache: MemoizeCache<unknown, ReturnType<F>>
}

/**
 * Creates a function that caches the result of `fn` per key. The key is the first argument, or
 * what `resolver` returns for the arguments. Both run with the caller's `this`. Lookups use `has`,
 * so `undefined` results are cached too. The cache never evicts: clear it with
 * `memoized.cache.clear()` or assign a bounded store to `memoized.cache`.
 * @param fn The function to memoize.
 * @param resolver Computes the cache key from the arguments.
 * @returns The memoized function.
 * @example
 * ```ts
 * const square = memoize((n: number) => n * n)
 * square(4) // 16, computed
 * square(4) // 16, from square.cache
 * ```
 */
export function memoize<F extends (...args: never[]) => unknown>(
  fn: F,
  resolver?: (...args: Parameters<F>) => unknown
): Memoized<F> {
  assertFunction(fn, 'fn')
  if (resolver != null) assertFunction(resolver, 'resolver')
  const cache: MemoizeCache<unknown, ReturnType<F>> = new Map()
  const memoized: Memoized<F> = Object.assign(
    function (this: ThisParameterType<F>, ...args: Parameters<F>): ReturnType<F> {
      const key = resolver ? Reflect.apply(resolver, this, args) : args[0]
      const store = memoized.cache
      // `has` said the key is stored, so `get` returns a stored `ReturnType<F>`
      if (store.has(key)) return store.get(key) as ReturnType<F>
      const value: ReturnType<F> = Reflect.apply(fn, this, args)
      store.set(key, value)
      return value
    },
    { cache }
  )
  return memoized
}

/**
 * Creates a function that calls `fn` once and returns that result on every later call. A call
 * made while `fn` is still running, or after it threw, returns `undefined` without calling it.
 * `fn` is released after its call.
 * @param fn The function to restrict.
 * @returns The restricted function.
 * @example
 * ```ts
 * const init = once(() => console.log('ready'))
 * init() // logs 'ready'
 * init() // does nothing
 * ```
 */
export function once<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R | undefined {
  assertFunction(fn, 'fn')
  let pending: ((...args: A) => R) | undefined = fn
  let value: R | undefined
  return function (this: unknown, ...args: A): R | undefined {
    if (pending) {
      const target = pending
      pending = undefined
      value = Reflect.apply(target, this, args)
    }
    return value
  }
}
