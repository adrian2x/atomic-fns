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

import { clone } from './collections.js'
import { isObject, len } from './globals.js'
import { comp, id } from './operators.js'

const compKey =
  (cmp = comp, key = id) =>
  (x, y) =>
    cmp(key(x), key(y))

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

export function reversed(iterable: Iterable<any>) {
  const arr = Array.from(iterable)
  arr.reverse()
  return arr
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

export function sorted(args: any[], key = id, reverse = false, cmp = comp) {
  if (isObject(args)) args = Object.keys(args)
  const compareFn = compKey(cmp, key)
  const copy = clone(args)
  copy.sort(compareFn)
  if (reverse) {
    copy.reverse()
  }
  return copy
}
