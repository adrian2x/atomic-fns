/**
 * True for `null` and `undefined`.
 * @param value Any value.
 * @returns Whether `value` is `null` or `undefined`.
 * @example
 * ```ts
 * isNil(null) // true
 * isNil(undefined) // true
 * isNil(0) // false
 * ```
 */
export function isNil(value: unknown): value is null | undefined {
  return value == null
}
