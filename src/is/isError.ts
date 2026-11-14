const nativeIsError = (Error as { isError?: (value: unknown) => boolean }).isError

/**
 * True for an error from any realm, as `Error.isError` decides. Where the runtime lacks
 * `Error.isError`, the object tag decides; `DOMException` is not recognized by this fallback.
 * Removed once `Error.isError` is Baseline.
 * @param value Any value.
 * @returns Whether `value` is an error.
 * @example
 * ```ts
 * isError(new TypeError('x')) // true
 * isError({ name: 'Error', message: 'x' }) // false
 * ```
 */
export function isError(value: unknown): value is Error {
  if (nativeIsError !== undefined) return nativeIsError(value)
  return Object.prototype.toString.call(value) === '[object Error]'
}
