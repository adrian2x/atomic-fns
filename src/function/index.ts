/**
 * Function wrappers: `debounce`, `throttle`, `memoize`, `once`, `curry`, `flow` and `compose`.
 * @module function
 */
export {
  type DebounceOptions,
  type Debounced,
  debounce,
  type ThrottleOptions,
  throttle
} from './debounce.ts'
export {
  compose,
  type Curried,
  curry,
  flow,
  type LooseFunction,
  type MemoizeCache,
  type Memoized,
  memoize,
  once
} from './wrap.ts'
