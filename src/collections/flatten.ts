/**
 * `flatten` for arrays and objects.
 */

import { isArrayLike, ValueError } from '../globals/index.js'
import { arrayOwnIndices, assertNotHugeSparse, isHugeSparse } from '../internal/arrayKeys.js'
import {
  assertNestingDepth,
  guardFlattenSharedRevisits,
  guardNesting,
  noteExpanded
} from '../internal/nesting.js'
import { truncateForError } from '../internal/truncate.js'
import { listOf, toInteger } from './lists.js'
import { assignData, isPlainObject } from './object.js'

const MAX_OUTPUT_KEY_CHARS = 2 ** 27

/** V8 hashes a longer string by length alone, so same-length keys collide on every insert. */
const MAX_HASHED_KEY_LENGTH = 2 ** 14 - 1

/** How many times a key past {@link MAX_HASHED_KEY_LENGTH} counts toward the cap. */
const UNHASHED_KEY_WEIGHT = 16

const CYCLE_ERROR = 'cyclic structure'

/**
 * Flattens an array or object. Arrays will be flattened recursively up to `depth` times; a fractional `depth` truncates. Objects will be flattened recursively.
 * Nullish input gives `[]`, and strings and array-likes spread into an array, as in Lodash. A plain
 * object stays an object even with a `length` key, and any other value returns unchanged.
 * Structural nesting deeper than 1000 levels throws `RangeError`. A cycle within `depth` throws
 * `ValueError('cyclic structure')`. Walking a shared container again costs one work unit per 16
 * keys, plus one once repeats outnumber the input's keys; past 250000 units it throws
 * `RangeError('input repeats shared objects beyond 250000 containers')` (flatten's own cap; merge
 * keeps 500000). Output keys over 2^27 characters in total throw `RangeError`, a key over 16383
 * characters counting 16 times. A `depth` of 0 or less copies the array, so a huge sparse array
 * throws `RangeError('sparse array too large')`.
 * @example
```js
flatten([1, [2, [3, [4]], 5]])
// [1, 2, [3, [4]], 5]

flatten({
  dates: {
    expiry_date: '30 sep 2018',
    available: '30 sep 2017',
    min_contract_period: [{ id: 1, name: '1 month' }]
  },
  price: { currency: 'RM', value: 1500 }
})
// {
//   'dates.expiry_date': '30 sep 2018',
//   'dates.available': '30 sep 2017',
//   'dates.min_contract_period[0].id': 1,
//   'dates.min_contract_period[0].name': '1 month',
//   'price.currency': 'RM',
//   'price.value': 1500
// }
```
 * @param {Array|Object} arr The array or object to flatten.
 * @param {number} [depth=1] The max recursion depth.
 * @returns {*} The new flattened array or object, or a non-plain `arr` as it is.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat Array.flat()}
 */
export function flatten<T>(arr: T[], depth?: boolean | number): T[]
export function flatten(arr: string, depth?: boolean | number): string[]
export function flatten(arr: null | undefined, depth?: boolean | number): []
export function flatten(arr: object, depth?: boolean | number): object
export function flatten(arr: unknown, depth: boolean | number = 1): unknown {
  return guardFlattenSharedRevisits(() =>
    guardNesting(() => {
      if (arr == null) return []
      if (isPlainObject(arr)) return flattenObj(arr)
      const items = typeof arr === 'string' || isArrayLike(arr) ? listOf(arr) : undefined
      if (items === undefined) return arr
      const d = depth === true ? Infinity : toInteger(depth)
      if (d > 0) return flattenArray(items, d)
      assertNotHugeSparse(items)
      return items.slice()
    })
  )
}

function flattenArray<T>(arr: T[], depth: number): T[] {
  interface Frame {
    items: T[]
    depthLeft: number
    nesting: number
    index: number
    sparseKeys: string[] | null
  }
  const onPath = new Set<unknown[]>()
  const stack: Frame[] = []

  const expand = (items: T[], depthLeft: number, nesting: number): void => {
    assertNestingDepth(nesting)
    if (onPath.has(items)) throw new ValueError(CYCLE_ERROR)
    const sparseKeys = isHugeSparse(items) ? arrayOwnIndices(items) : null
    noteExpanded(items, sparseKeys?.length ?? items.length)
    onPath.add(items)
    stack.push({ items, depthLeft, nesting, index: 0, sparseKeys })
  }

  expand(arr, depth, 1)
  const result: T[] = []
  while (stack.length > 0) {
    const frame = stack[stack.length - 1]
    const limit = frame.sparseKeys !== null ? frame.sparseKeys.length : frame.items.length
    if (frame.index >= limit) {
      stack.pop()
      onPath.delete(frame.items)
      continue
    }
    const i = frame.sparseKeys !== null ? Number(frame.sparseKeys[frame.index++]) : frame.index++
    if (frame.sparseKeys === null && !(i in frame.items)) {
      result.push(undefined as T)
      continue
    }
    const value = frame.items[i]
    if (frame.depthLeft > 0 && Array.isArray(value)) {
      expand(value as T[], frame.depthLeft - 1, frame.nesting + 1)
    } else {
      result.push(value)
    }
  }
  return result
}

function assertFlattenableKey(key: string): void {
  if (key === '' || key.includes('.') || key.includes('[') || key.includes(']')) {
    throw new TypeError(`flatten cannot represent key ${truncateForError(key)}`)
  }
}

function flattenObj(root: object): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  interface Frame {
    obj: object
    prefix: string
    nesting: number
    keys: string[]
    index: number
  }
  const onPath = new Set<object>()
  const stack: Frame[] = []
  let keyChars = 0

  const emit = (key: string, value: unknown): void => {
    keyChars += key.length * (key.length > MAX_HASHED_KEY_LENGTH ? UNHASHED_KEY_WEIGHT : 1)
    if (keyChars > MAX_OUTPUT_KEY_CHARS) {
      throw new RangeError(`flatten output keys exceed ${String(MAX_OUTPUT_KEY_CHARS)} characters`)
    }
    if (Object.hasOwn(result, key)) {
      throw new TypeError(`flatten produced duplicate key ${truncateForError(key)}`)
    }
    assignData(result, key, value)
  }

  const pushContainer = (obj: object, prefix: string, nesting: number): void => {
    assertNestingDepth(nesting)
    if (onPath.has(obj)) throw new ValueError(CYCLE_ERROR)
    if (!isPlainObject(obj) && !Array.isArray(obj)) {
      emit(prefix, obj)
      return
    }
    const keys = Object.keys(obj)
    noteExpanded(obj, keys.length)
    onPath.add(obj)
    stack.push({ obj, prefix, nesting, keys, index: 0 })
  }

  pushContainer(root, '', 1)

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]
    if (frame.index >= frame.keys.length) {
      stack.pop()
      onPath.delete(frame.obj)
      continue
    }
    const key = frame.keys[frame.index++]
    assertFlattenableKey(key)
    const child = (frame.obj as Record<string, unknown>)[key]
    const pref = Array.isArray(frame.obj)
      ? `${frame.prefix}[${key}]`
      : frame.prefix
        ? `${frame.prefix}.${key}`
        : key
    if (child !== null && typeof child === 'object') {
      pushContainer(child, pref, frame.nesting + 1)
    } else {
      emit(pref, child)
    }
  }
  return result
}
