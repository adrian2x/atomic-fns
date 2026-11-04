/**
 * Builtin checks that read internal slots, so they hold across realms and see through
 * `Symbol.toStringTag` in both directions.
 */

/**
 * With no `Symbol.toStringTag` in reach the object tag is exact; with one, only `probe` can tell.
 * `method` keeps objects that lack it off that path, because a failed probe throws, which is slow.
 */
function hasBrand(x: unknown, tag: string, method: string, probe: (x: never) => unknown): boolean {
  if (typeof x !== 'object' || x === null) return false
  try {
    if (!(Symbol.toStringTag in x)) return Object.prototype.toString.call(x) === tag
    if (typeof (x as Record<string, unknown>)[method] !== 'function') return false
    probe(x as never)
    return true
  } catch {
    return false
  }
}

const regExpSource = Object.getOwnPropertyDescriptor(RegExp.prototype, 'source')

/** Check if value is a native `Date`, from any realm. */
export function isDate(x: unknown): x is Date {
  return hasBrand(x, '[object Date]', 'getTime', (v) => Date.prototype.getTime.call(v))
}

/** Check if value is a native `RegExp`, from any realm. */
export function isRegExp(x: unknown): x is RegExp {
  return hasBrand(x, '[object RegExp]', 'exec', (v) => regExpSource?.get?.call(v))
}

/** Check if value is a `Map`, from any realm. */
export function isMap<K, V>(x: unknown): x is Map<K, V> {
  return hasBrand(x, '[object Map]', 'get', (v) => Map.prototype.has.call(v, 0))
}

/** Check if value is a `Set`, from any realm. */
export function isSet<T>(x: unknown): x is Set<T> {
  return hasBrand(x, '[object Set]', 'add', (v) => Set.prototype.has.call(v, 0))
}

/** Check if value is a `WeakMap`, from any realm. */
export function isWeakMap<K extends object, V>(x: unknown): x is WeakMap<K, V> {
  return hasBrand(x, '[object WeakMap]', 'get', (v) => WeakMap.prototype.has.call(v, {}))
}

/** Check if value is a `WeakSet`, from any realm. */
export function isWeakSet<T extends object>(x: unknown): x is WeakSet<T> {
  return hasBrand(x, '[object WeakSet]', 'add', (v) => WeakSet.prototype.has.call(v, {}))
}

/**
 * Check if value is an `Error`, from any realm. Uses `Error.isError`; on engines without it the
 * object tag decides, which a `Symbol.toStringTag` can spoof.
 */
export function isError(x: unknown): x is Error {
  return typeof Error.isError === 'function'
    ? Error.isError(x)
    : Object.prototype.toString.call(x) === '[object Error]'
}

const UNBOXERS = new Map<string, (box: never) => unknown>([
  ['[object Number]', (box) => Number.prototype.valueOf.call(box)],
  ['[object String]', (box) => String.prototype.valueOf.call(box)],
  ['[object Boolean]', (box) => Boolean.prototype.valueOf.call(box)],
  ['[object BigInt]', (box) => BigInt.prototype.valueOf.call(box)],
  ['[object Symbol]', (box) => Symbol.prototype.valueOf.call(box)]
])

/** The primitive inside a wrapper object such as `new Number(1)`; anything else unchanged. */
export function unbox(x: unknown): unknown {
  if (typeof x !== 'object' || x === null) return x
  try {
    return UNBOXERS.get(Object.prototype.toString.call(x))?.(x as never) ?? x
  } catch {
    return x
  }
}
