/**
 * Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 *     http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  call,
  isArray,
  isFunc,
  isNumber,
  isObject,
  isString,
  keys,
  list,
  NotImplementedError,
  notNull
} from './globals'

export const id = (x) => x

export const bool = (x) => Boolean(x)

const not = (x) => !x

const isinstance = (x, y) => x instanceof y

const notinstance = (x, y) => !(x instanceof y)

export const all = (...args) => args.every((x) => bool(x))

export const any = (...args) => args.some((x) => bool(x))

export const and = (...args) => all(...args)

export const or = (...args) => any(...args)

export const filter = (fn, ...args) => args.filter(fn)

export const map = (fn, ...args) => args.map(fn)

export const now = new Date().getTime()

export function lt(x, y) {
  const op = call('lt', x, y)
  if (notNull(op)) return op
  return x < y
}

export function le(x, y) {
  let op = call('le', x, y)
  if (notNull(op)) return op
  op = call('eq', x, y)
  if (op === true) return op
  op = call('lt', x, y)
  if (notNull(op)) return op
  return x <= y
}

export function eq(x, y) {
  const op = call('eq', x, y)
  if (notNull(op)) return op
  return x === y
}

const ne = (x, y) => !eq(x, y)

export function gt(x, y) {
  const op = call('gt', x, y)
  if (notNull(op)) return op
  return x > y
}

export function ge(x, y) {
  let op = call('ge', x, y)
  if (notNull(op)) return op
  op = call('eq', x, y)
  if (op === true) return op
  op = call('gt', x, y)
  if (notNull(op)) return op
  return x >= y
}

export function add(x, y) {
  const op = call('add', x, y)
  if (notNull(op)) return op
  return x + y
}

export function sub(x, y) {
  const op = call('sub', x, y)
  if (notNull(op)) return op
  return x - y
}

export function div(x, y) {
  const op = call('div', x, y)
  if (notNull(op)) return op
  return x / y
}

export function mult(x, y) {
  const op = call('mult', x, y)
  if (notNull(op)) return op
  return x * y
}

export function mod(x, y) {
  const op = call('mod', x, y)
  if (notNull(op)) return op
  return x % y
}

export function pow(x, y) {
  const op = call('pow', x, y)
  if (notNull(op)) return op
  return x ** y
}

export function abs(x: number) {
  const op = call('abs', x)
  if (notNull(op)) return op
  return Math.abs(x)
}

/**
 * Returns a tuple like (x / y, x % y)
 * @export
 * @param {number} x
 * @param {number} y
 * @return {number[]}
 */
export function divmod(x: number, y: number) {
  return [Math.floor(x / y), x % y]
}

export function log2(x) {
  if (x > 0) {
    return Math.log(x) * 1.442695
  }
  return Number.NaN
}

export function logBase(x, y) {
  if (x > 0 && y > 0) {
    return Math.log(y) / Math.log(x)
  }
  return Number.NaN
}

export function contains(arr, y) {
  const op = call('contains', arr, y)
  if (notNull(op)) return op
  return index(arr, y) >= 0
}

export function comp(x, y) {
  let op = call('compare', x, y)
  if (isNumber(op)) return op
  if (eq(x, y)) return 0
  op = le(x, y)
  if (op) return -1
  op = ge(x, y)
  if (op) return 1
  return 0
}

const compKey =
  (cmp = comp, key = id) =>
  (x, y) =>
    cmp(key(x), key(y))

export function sorted(args: any[], key = id, reverse = false, cmp = comp) {
  if (isObject(args)) args = Object.keys(args)
  const compareFn = compKey(cmp, key)
  args.sort(compareFn)
  if (reverse) {
    args.reverse()
  }
  return args
}

export function min(...args) {
  // Uses `le` by default
  let cmp = comp
  // First argument can be a comparer func
  if (isFunc(args[0])) {
    cmp = args.shift()
  }
  args.sort(cmp)
  return args[0]
}

export function max(...args) {
  // Uses ge by default
  let cmp = comp
  // First argument can be a comparer func
  if (isFunc(args[0])) {
    cmp = args.shift()
  }
  args.sort(cmp)
  return args[args.length - 1]
}

export function sum(...args) {
  let total = 0
  for (const x of args) {
    total += x
  }
  return total
}

export function len(x) {
  if (notNull(x.length)) {
    return x.length
  }
  if (isFunc(x?.size)) {
    return x.size()
  }
  if (isObject(x)) {
    return keys(x).length
  }
}

export function index(arr, x, start = 0) {
  const op = call('index', arr, x)
  if (notNull(op)) return op
  const length = arr.length
  if (start < 0) {
    start = Math.max(start + length, 0)
  }
  if (isString(arr)) {
    if (start >= length) return -1
    return arr.indexOf(x, start)
  }
  for (let i = start; i < length; i++) {
    if (arr[i] === x) return i
  }
  return -1
}

export function clone(obj, deep = false) {
  if (isArray(obj)) {
    return cloneArray(obj, deep)
  }
  if (isObject(obj)) {
    if (isFunc(obj.clone)) {
      return obj.clone()
    }
    const copy = {}
    for (const key of keys(obj)) {
      if (deep) {
        copy[key] = clone(obj[key], deep)
      } else {
        copy[key] = obj[key]
      }
    }
    return copy
  }
  return obj
}

export function cloneArray(arr, deep = false) {
  if (!deep) return list(arr)
  return arr.map((item) => clone(item, deep))
}

export const bind = (fn, self, ...args) => fn.bind(self, ...args)

export const partial = (fn, ...args) => bind(fn, {}, ...args)

export function* range(...args: number[]) {
  if (args.length === 1) {
    const stop = args[0]
    for (let i = 0; i < stop; i++) {
      yield i
    }
  } else if (args.length === 2) {
    let start = args[0]
    const stop = args[1]
    for (; start < stop; start++) {
      yield start
    }
  } else {
    let start = args[0]
    const stop = args[1]
    const step = args[2]
    for (; start < stop; start += step) {
      yield start
    }
  }
}

export function reversed(iterable: Iterable<any>) {
  let arr = Array.from(iterable)
  arr.reverse()
  return arr
}

export function zip() {
  throw new NotImplementedError('Not Implemented')
}
