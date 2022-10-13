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

import { call, isFunc } from './globals.js'
import { comp } from './operators.js'

export function abs(x: number) {
  const op = call('abs', x)
  if (op != null) return op
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

/** First argument can be a comparer func */
export function min(args) {
  // Uses `le` by default
  let cmp = comp
  if (isFunc(args[0])) {
    cmp = args.shift()
  }
  let res = args[0]
  for (const x of args) {
    if (cmp(x, res) === -1) {
      res = x
    }
  }
  return res
}

/** First argument can be a comparer func */
export function max(args) {
  // Uses ge by default
  let cmp = comp
  if (isFunc(args[0])) {
    cmp = args.shift()
  }
  let res = args[0]
  for (const x of args) {
    if (cmp(x, res) === 1) {
      res = x
    }
  }
  return res
}

export function sum(args) {
  let total = 0
  for (const x of args) {
    total += x
  }
  return total
}
