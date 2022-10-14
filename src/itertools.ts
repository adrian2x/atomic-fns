import { isObject, len } from './globals.js'
import { comp, id } from './operators.js'

export type Comp = (x: any, y: any) => number

const compKey = (cmp: Comp, key) => (x, y) => cmp(key(x), key(y))

export function* range(...args: number[]) {
  if (args.length === 1) {
    const stop = args[0]
    for (let i = 0; i < stop; i++) {
      yield i
    }
  } else if (args.length === 2) {
    let [start, stop] = args
    for (; start < stop; start++) {
      yield start
    }
  } else {
    let [start, stop, step] = args
    for (; start < stop; start += step) {
      yield start
    }
  }
}

/** Creates a new list with the elements from the iterable in reverse order. */
export function reversed(iterable: Iterable<any>) {
  return Array.from(iterable).reverse()
}

export type Func = (x: any) => any
export function sorted(args: any[]): any[]
export function sorted(args: any[], reverse: boolean): any[]
export function sorted(args: any[], reverse: boolean, comp: Comp): any[]
export function sorted(args: any[], key: Func): any[]
export function sorted(args: any[], key: Func, reverse: boolean): any[]

/**
 * Creates a new list from `args` and sorts it. This can be called many ways:
 *   - sorted([...], true) => reverse order
 *   - sorted([...], fn = (x) => any) => using a key fn
 *   - sorted([...], fn = (x) => any, true) => reverse order using key
 *   - sorted([...], false, (x, y) => number) => using custom compare
 *   - sorted([...], fn = (x) => any, true, (x, y) => number) => custom key, reverse and compare
 *
 * If `args` is an object, returns the sorted keys.
 *
 * @export
 * @param {any[]} args
 * @param {(boolean | Func)} [key]
 * @param {(boolean | Comp)} [reverse]
 * @param {Comp} [compareFn]
 * @return
 */
export function sorted(
  args: any[],
  key?: boolean | Func,
  reverse?: boolean | Comp,
  compareFn?: Comp
) {
  if (isObject(args)) args = Object.keys(args)
  if (typeof key === 'boolean') {
    if (typeof reverse === 'function') {
      compareFn = reverse
      reverse = false
    } else {
      reverse = true
    }
    key = id
  }
  const copy = Array.from(args)
  const _compare = compKey(compareFn ?? comp, key ?? id)
  copy.sort(_compare)
  if (reverse) copy.reverse()
  return copy
}

export function sort(args: any[]): any[]
export function sort(args: any[], reverse: boolean): any[]
export function sort(args: any[], compareFn: Comp): any[]
export function sort(args: any[], reverse: boolean, compareFn: Comp): any[]

/**
 * Sort `args` in place. Can be called like this:
 *   - sort([...], true) => reverse order
 *   - sort([...], (x, y) => number) => using custom compare
 *   - sort([...], true, (x, y) => number) => reverse and using custom compare
 * @export
 * @param {any[]} args
 * @param {(boolean | Comp)} [reverse]
 * @param {Comp} [compareFn]
 * @return
 */
export function sort(args: any[], reverse?: boolean | Comp, compareFn?: Comp) {
  compareFn ??= comp
  if (typeof reverse === 'function') {
    compareFn = reverse
    reverse = false
  }
  args.sort(compareFn)
  if (reverse === true) args.reverse()
  return args
}

/** Returns a generator that calls `fn(index)` for each index < n */
export function* times(n: number, fn: (index: number) => any) {
  for (let i = 0; i < n; i++) yield fn(i)
}

export function* zip(...args) {
  const size = len(args[0])
  for (let i = 0; i < size; i++) {
    const tuple = [] as any
    for (let k = 0; k < args.length; k++) {
      const item = args[k][i]
      tuple.push(item)
    }
    yield tuple
  }
}
