/**
 * Web Crypto access shared by the random ids.
 */

/** `length` bytes from `crypto.getRandomValues`, or a `TypeError` where the runtime has no Web Crypto. */
export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const crypto = globalThis.crypto as Crypto | undefined
  if (typeof crypto?.getRandomValues !== 'function') {
    throw new TypeError('crypto.getRandomValues is not available')
  }
  return crypto.getRandomValues(new Uint8Array(length))
}
