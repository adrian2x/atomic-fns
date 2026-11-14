const OBJECT_SOURCE = Function.prototype.toString.call(Object)

/**
 * `Object.prototype` of this realm or of another one: its constructor has `Object`'s source.
 */
function isObjectPrototype(proto: object | null): boolean {
  if (proto === Object.prototype) return true
  if (proto === null || Object.getPrototypeOf(proto) !== null) return false
  const ctor: unknown = Object.getOwnPropertyDescriptor(proto, 'constructor')?.value
  return typeof ctor === 'function' && Function.prototype.toString.call(ctor) === OBJECT_SOURCE
}

/**
 * True when `value` is a plain object: an object literal, `Object.create(null)`, or either from
 * another realm (an iframe, a worker, `vm`). Class instances, arrays, `Math`, `JSON`, `arguments`
 * and objects with their own `Symbol.toStringTag` are not plain.
 * @param value Any value.
 * @returns Whether `value` is a plain object.
 * @example
 * ```ts
 * isPlainObject({ a: 1 }) // true
 * isPlainObject(Object.create(null)) // true
 * isPlainObject(new Date()) // false
 * isPlainObject(new (class Point {})()) // false
 * ```
 */
export function isPlainObject(value: unknown): value is Record<PropertyKey, unknown> {
  if (value === null || typeof value !== 'object') return false
  if (Object.prototype.toString.call(value) !== '[object Object]') return false
  const proto = Object.getPrototypeOf(value) as object | null
  return proto === null || isObjectPrototype(proto)
}
