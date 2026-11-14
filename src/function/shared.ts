/** Throws `TypeError('<name> must be a function')` unless `fn` is callable. */
export function assertFunction(fn: unknown, name: string): void {
  if (typeof fn !== 'function') throw new TypeError(`${name} must be a function`)
}
