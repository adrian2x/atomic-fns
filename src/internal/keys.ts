/**
 * Key lists shared by the deep walks.
 */

/** Whether `key` is an own enumerable property of `value`. */
export function isEnumerable(value: object, key: PropertyKey): boolean {
  return Object.prototype.propertyIsEnumerable.call(value, key)
}

/** The own enumerable keys of `value`: its string keys as `Object.keys` lists them, then symbols. */
export function enumerableKeys(value: object): (string | symbol)[] {
  const symbols = Object.getOwnPropertySymbols(value)
  if (symbols.length === 0) return Object.keys(value)
  return [...Object.keys(value), ...symbols.filter((key) => isEnumerable(value, key))]
}

/**
 * Location keys JavaScriptCore puts on every error as own enumerable properties, like `stack`, so
 * `isEqual` and `hash` leave them out of an error's content.
 */
export const ERROR_LOCATION_KEYS: ReadonlySet<PropertyKey> = new Set([
  'line',
  'column',
  'sourceURL'
])
