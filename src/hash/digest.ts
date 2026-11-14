import { bytesToHex, isArrayBuffer, toBytes } from '../internal/bytes.ts'

/** The digest algorithms every `crypto.subtle` implementation supports. */
export type DigestAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'

/**
 * Cryptographic digest of `data` as a lowercase hex string, through `crypto.subtle.digest`. A
 * string is hashed as UTF-8, with each lone surrogate as U+FFFD as `TextEncoder` writes it, so
 * `'\uD800'` and `'\uDFFF'` hash alike; bytes on shared memory are copied first, since
 * `crypto.subtle` refuses them. Rejects with `TypeError` where `crypto.subtle` is missing (insecure
 * browser contexts) and for data that is neither a string nor bytes.
 * @param algorithm `'SHA-1'`, `'SHA-256'`, `'SHA-384'` or `'SHA-512'`.
 * @param data A string, an `ArrayBuffer` or `SharedArrayBuffer`, or a typed array or `DataView`.
 * @returns A promise of the hex digest.
 * @example
 * ```ts
 * await digest('SHA-256', 'abc')
 * // 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
 * ```
 */
export async function digest(
  algorithm: DigestAlgorithm,
  data: string | ArrayBuffer | SharedArrayBuffer | ArrayBufferView
): Promise<string> {
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle
  if (subtle === undefined) throw new TypeError('crypto.subtle is not available')
  const view = toBytes(data)
  const bytes = isArrayBuffer(view.buffer)
    ? new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
    : view.slice()
  return bytesToHex(new Uint8Array(await subtle.digest(algorithm, bytes)))
}
