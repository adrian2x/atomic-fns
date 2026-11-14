/**
 * `cloneDeep`: a structural copy that keeps prototypes, symbol keys, sharing and cycles.
 */

import { isEnumerable } from '../internal/keys.ts'
import { bytesOf, kindOf, typedArrayLength, typedArrayName, unbox } from '../internal/kind.ts'
import { isCanonicalArrayIndex, walkArray } from '../internal/sparse.ts'
import { enterDepth, exitDepth, guardDepth } from '../internal/walk.ts'

type Copies = Map<object, unknown>

const dateTime = Date.prototype.getTime
const mapEntries = Map.prototype.entries
const mapSet = Map.prototype.set
const setValues = Set.prototype.values
const setAdd = Set.prototype.add

type ViewConstructor = new (
  buffer: ArrayBufferLike,
  offset: number,
  length: number
) => ArrayBufferView

/** This realm's typed array constructors by `[[TypedArrayName]]`. */
const VIEW_CONSTRUCTORS = new Map<string, ViewConstructor>(
  [
    'Int8Array',
    'Uint8Array',
    'Uint8ClampedArray',
    'Int16Array',
    'Uint16Array',
    'Int32Array',
    'Uint32Array',
    'Float16Array',
    'Float32Array',
    'Float64Array',
    'BigInt64Array',
    'BigUint64Array'
  ].flatMap((name) => {
    const ctor = (globalThis as Record<string, unknown>)[name]
    return typeof ctor === 'function' ? [[name, ctor as ViewConstructor] as const] : []
  })
)

/** Which own enumerable keys {@link copyKeys} copies besides symbols. */
type StringKeys = 'all' | 'non-index' | 'none'

function defineValue(out: object, key: PropertyKey, value: unknown): void {
  Object.defineProperty(out, key, { value, enumerable: true, writable: true, configurable: true })
}

/**
 * Copy the own enumerable symbol keys of `src` onto `out`, and the string keys `strings` names,
 * cloning each value.
 */
function copyKeys(src: object, out: object, copies: Copies, strings: StringKeys): void {
  const record = src as Record<PropertyKey, unknown>
  if (strings !== 'none') {
    for (const key of Object.keys(src)) {
      if (strings === 'non-index' && isCanonicalArrayIndex(key)) continue
      defineValue(out, key, cloneValue(record[key], copies))
    }
  }
  for (const sym of Object.getOwnPropertySymbols(src)) {
    if (!isEnumerable(src, sym)) continue
    defineValue(out, sym, cloneValue(record[sym], copies))
  }
}

function withPrototype<T extends object>(out: T, src: object): T {
  const proto = Object.getPrototypeOf(src) as object | null
  if (Object.getPrototypeOf(out) !== proto) Object.setPrototypeOf(out, proto)
  return out
}

/** Record `out` as the copy of `src`, then copy the keys of `src` onto it. */
function finish<T extends object>(src: object, out: T, copies: Copies, strings: StringKeys): T {
  copies.set(src, out)
  copyKeys(src, out, copies, strings)
  return out
}

function cloneBuffer(src: ArrayBuffer | SharedArrayBuffer, copies: Copies): ArrayBufferLike {
  const known = copies.get(src)
  if (known !== undefined) return known as ArrayBufferLike
  const bytes = bytesOf(src)
  let out: ArrayBuffer | SharedArrayBuffer
  if (Object.prototype.toString.call(src) === '[object SharedArrayBuffer]') {
    const shared = src as SharedArrayBuffer
    out = new SharedArrayBuffer(
      bytes.length,
      shared.growable ? { maxByteLength: shared.maxByteLength } : undefined
    )
  } else {
    const buffer = src as ArrayBuffer
    out = new ArrayBuffer(
      bytes.length,
      buffer.resizable ? { maxByteLength: buffer.maxByteLength } : undefined
    )
  }
  new Uint8Array(out).set(bytes)
  return finish(src, withPrototype(out, src), copies, 'all')
}

function cloneView(src: ArrayBufferView, copies: Copies): unknown {
  const name = typedArrayName(src)
  const isDataView = name === undefined
  const buffer = cloneBuffer(src.buffer, copies)
  // The buffer's own keys can lead back to this view, which is then copied already.
  const known = copies.get(src)
  if (known !== undefined) return known
  let offset = 0
  let length = 0
  try {
    offset = src.byteOffset
    length = isDataView ? src.byteLength : (typedArrayLength(src) ?? 0)
  } catch {
    // Detached or out-of-bounds DataViews have no readable offset or length.
  }
  const ctor = isDataView ? (DataView as unknown as ViewConstructor) : VIEW_CONSTRUCTORS.get(name)
  if (ctor === undefined) throw new TypeError(`cannot copy a ${name ?? 'view'}`)
  return finish(src, withPrototype(new ctor(buffer, offset, length), src), copies, 'none')
}

function cloneObject(src: object, copies: Copies): unknown {
  switch (kindOf(src)) {
    case 'plain':
      return finish(src, Object.create(Object.getPrototypeOf(src) as object | null), copies, 'all')
    case 'array': {
      const list = src as unknown[]
      const out = withPrototype([] as unknown[], src)
      copies.set(src, out)
      out.length = list.length
      walkArray(list, (event) => {
        if (event.kind === 'value') out[event.index] = cloneValue(event.value, copies)
      })
      copyKeys(src, out, copies, 'non-index')
      return out
    }
    case 'map': {
      const out = withPrototype(new Map<unknown, unknown>(), src)
      copies.set(src, out)
      for (const [key, value] of mapEntries.call(src) as MapIterator<[unknown, unknown]>) {
        mapSet.call(out, key, cloneValue(value, copies))
      }
      copyKeys(src, out, copies, 'all')
      return out
    }
    case 'set': {
      const out = withPrototype(new Set<unknown>(), src)
      copies.set(src, out)
      for (const value of setValues.call(src) as SetIterator<unknown>) {
        setAdd.call(out, cloneValue(value, copies))
      }
      copyKeys(src, out, copies, 'all')
      return out
    }
    case 'date':
      return finish(src, withPrototype(new Date(dateTime.call(src)), src), copies, 'all')
    case 'regexp': {
      const re = src as RegExp
      const out = withPrototype(new RegExp(re.source, re.flags), src)
      out.lastIndex = (src as RegExp).lastIndex
      return finish(src, out, copies, 'all')
    }
    case 'buffer':
      return cloneBuffer(src as ArrayBuffer | SharedArrayBuffer, copies)
    case 'view':
      return cloneView(src as ArrayBufferView, copies)
    case 'boxed': {
      const primitive = unbox(src)
      const out = withPrototype(Object(primitive) as object, src)
      // A String wrapper lists one index key per character; only its symbol keys are copied.
      return finish(src, out, copies, typeof primitive === 'string' ? 'none' : 'all')
    }
    default:
      return src
  }
}

function cloneValue(value: unknown, copies: Copies): unknown {
  if (value === null || typeof value !== 'object') return value
  const known = copies.get(value)
  if (known !== undefined) return known
  enterDepth()
  try {
    return cloneObject(value, copies)
  } finally {
    exitDepth()
  }
}

/**
 * A deep copy of `value`. Plain objects, arrays, `Map`, `Set`, `Date`, `RegExp`, typed arrays,
 * `DataView`, `ArrayBuffer`, `SharedArrayBuffer` and boxed primitives are copied with their
 * prototype (a subclass stays a subclass) and their own enumerable symbol keys; all but typed
 * arrays, `DataView` and `String` wrappers also keep their own enumerable string keys, and arrays
 * keep their holes. `Map` keys keep their identity while values are copied. A subclass copy gets
 * the prototype only: its constructor does not run, so it has none of its private fields. A
 * resizable or growable buffer stays so, and a detached one copies as an empty buffer. Class
 * instances, functions, errors, promises and every other object are kept by reference:
 * `structuredClone` throws on them, and copying their fields would produce an object whose private
 * state and invariants are gone. An object reached twice is copied once, so shared references and
 * cycles stay shared and cyclic in the copy, and views over one buffer share one copied buffer.
 * @param value The value to copy.
 * @returns The copy.
 * @throws {RangeError} past 1000 levels of nesting.
 * @throws {TypeError} for a typed array kind this runtime has no constructor for.
 * @example
 * ```ts
 * const src = { when: new Date(0), tags: new Set(['a']), list: [{ id: 1 }] }
 * const copy = cloneDeep(src)
 * copy.list[0] === src.list[0] // false
 * copy.when.getTime() // 0
 * ```
 */
export function cloneDeep<T>(value: T): T {
  return guardDepth(() => cloneValue(value, new Map())) as T
}
