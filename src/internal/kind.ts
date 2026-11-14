/**
 * The built-in kinds a deep walk handles, including values from other realms.
 */

import { isError } from '../is/isError.ts'
import { isPlainObject } from '../is/isPlainObject.ts'

function getterOf(prototype: object, key: PropertyKey): (this: unknown) => unknown {
  const get = Object.getOwnPropertyDescriptor(prototype, key)?.get
  if (get === undefined) throw new TypeError(`no getter for ${String(key)}`)
  return get
}

/** A native `Map`, from any realm. */
export function isMap(x: unknown): x is Map<unknown, unknown> {
  return Object.prototype.toString.call(x) === '[object Map]'
}

/** A native `Set`, from any realm. */
export function isSet(x: unknown): x is Set<unknown> {
  return Object.prototype.toString.call(x) === '[object Set]'
}

/** An `arguments` object, from any realm. `kindOf` calls it `other`; `isEqual` reads it like an array. */
export function isArguments(x: unknown): x is IArguments {
  return Object.prototype.toString.call(x) === '[object Arguments]'
}

const UNBOXERS = new Map<string, (box: object) => unknown>([
  ['[object Number]', (box) => Reflect.apply(Number.prototype.valueOf, box, [])],
  ['[object String]', (box) => Reflect.apply(String.prototype.valueOf, box, [])],
  ['[object Boolean]', (box) => Reflect.apply(Boolean.prototype.valueOf, box, [])],
  ['[object BigInt]', (box) => Reflect.apply(BigInt.prototype.valueOf, box, [])],
  ['[object Symbol]', (box) => Reflect.apply(Symbol.prototype.valueOf, box, [])]
])

/** The primitive inside a wrapper object such as `new Number(1)`; ordinary non-wrappers unchanged. */
export function unbox(x: unknown): unknown {
  if (typeof x !== 'object' || x === null) return x
  return UNBOXERS.get(Object.prototype.toString.call(x))?.(x) ?? x
}

/**
 * The kinds a deep walk copies, compares or hashes by content. `other` covers class instances,
 * functions, errors, `arguments`, promises, weak collections and every other object: walks keep
 * those by reference. `isEqual` and `hash` also read errors and `arguments` by content; see
 * {@link isError} and {@link isArguments}.
 */
export type Kind =
  | 'plain'
  | 'array'
  | 'map'
  | 'set'
  | 'date'
  | 'regexp'
  | 'view'
  | 'buffer'
  | 'boxed'
  | 'other'

/** The {@link Kind} of `value`. */
export function kindOf(value: object): Kind {
  if (Array.isArray(value)) return 'array'
  if (isPlainObject(value)) return 'plain'
  if (ArrayBuffer.isView(value)) return 'view'
  const tag = Object.prototype.toString.call(value)
  switch (tag) {
    case '[object Date]':
      return 'date'
    case '[object RegExp]':
      return 'regexp'
    case '[object Map]':
      return 'map'
    case '[object Set]':
      return 'set'
    case '[object ArrayBuffer]':
    case '[object SharedArrayBuffer]':
      return 'buffer'
  }
  if (UNBOXERS.has(tag)) return 'boxed'
  return 'other'
}

/** {@link Kind}, with the two `other` kinds `isEqual` and `hash` also read by content. */
export type ContentKind = Kind | 'error' | 'arguments'

/** The {@link ContentKind} of `value`: what `isEqual` compares and `hash` hashes it by. */
export function contentKindOf(value: object): ContentKind {
  const kind = kindOf(value)
  if (kind !== 'other') return kind
  if (isError(value)) return 'error'
  return isArguments(value) ? 'arguments' : 'other'
}

/** `%TypedArray%.prototype`, which holds the getters every typed array shares. */
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object

/** `%TypedArray%.prototype[Symbol.toStringTag]`: a typed array's type name, else `undefined`. */
const TYPED_ARRAY_NAME = getterOf(TYPED_ARRAY_PROTOTYPE, Symbol.toStringTag)

/** The bytes a view covers, without copying. Throws for a detached or out-of-bounds view. */
export function viewBytes(view: ArrayBufferView): Uint8Array {
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
}

/** The bytes of a buffer or view. A detached or out-of-bounds one has none. */
export function bytesOf(value: ArrayBuffer | SharedArrayBuffer | ArrayBufferView): Uint8Array {
  try {
    return ArrayBuffer.isView(value) ? viewBytes(value) : new Uint8Array(value)
  } catch {
    return new Uint8Array(0)
  }
}

const FLOAT_ARRAY_NAMES: ReadonlySet<unknown> = new Set([
  'Float16Array',
  'Float32Array',
  'Float64Array'
])

/** Whether `view` holds floats, which compare by element (`0` equals `-0`) and not by byte. */
export function isFloatView(
  view: ArrayBufferView
): view is Float16Array | Float32Array | Float64Array {
  return FLOAT_ARRAY_NAMES.has(Reflect.apply(TYPED_ARRAY_NAME, view, []))
}

/**
 * A typed array's type name, such as `'Float64Array'`, from any realm, or `undefined` for anything
 * else, a `DataView` included. It never throws.
 */
export function typedArrayName(x: object): string | undefined {
  return Reflect.apply(TYPED_ARRAY_NAME, x, []) as string | undefined
}

/** A typed array's element count (0 when detached), or `undefined` for other objects. */
export function typedArrayLength(x: object): number | undefined {
  if (typedArrayName(x) === undefined) return undefined
  return (x as Uint8Array).length
}

export function mapSize(map: Map<unknown, unknown>): number {
  return map.size
}

export function setSize(set: Set<unknown>): number {
  return set.size
}

function classNameOf(prototype: object): string | undefined {
  const name = (prototype as { constructor?: { name?: unknown } }).constructor?.name
  return typeof name === 'string' ? name : undefined
}

function areTwins(x: object, y: object): boolean {
  const name = classNameOf(x)
  return x !== y && name !== undefined && name === classNameOf(y)
}

/**
 * Whether `a` and `b` share one prototype chain, or twin chains from two realms (each prototype
 * named like its counterpart). Null-prototype objects count as `Object.prototype`.
 */
export function sameClass(a: object, b: object): boolean {
  let x: object | null = (Object.getPrototypeOf(a) as object | null) ?? Object.prototype
  let y: object | null = (Object.getPrototypeOf(b) as object | null) ?? Object.prototype
  if (x === y) return true
  while (x !== null && y !== null && areTwins(x, y)) {
    x = Object.getPrototypeOf(x) as object | null
    y = Object.getPrototypeOf(y) as object | null
  }
  return x === null && y === null
}
