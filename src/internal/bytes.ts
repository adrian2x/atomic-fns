/**
 * Byte and text helpers shared by hashing, ids and encoding.
 */

import { viewBytes } from './kind.ts'

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'))

/** Lowercase hex of `bytes`, two digits per byte. */
export function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) out += HEX[byte]
  return out
}

/** UTF-8 bytes of `text`, with lone surrogates as U+FFFD, as `TextEncoder` writes them. */
export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

/** An `ArrayBuffer`, from any realm. */
export function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return Object.prototype.toString.call(value) === '[object ArrayBuffer]'
}

function isSharedArrayBuffer(value: unknown): value is SharedArrayBuffer {
  return Object.prototype.toString.call(value) === '[object SharedArrayBuffer]'
}

/** The bytes of a string (UTF-8), a buffer or a view, without copying a buffer or view. */
export function toBytes(
  data: string | ArrayBuffer | SharedArrayBuffer | ArrayBufferView
): Uint8Array {
  if (typeof data === 'string') return utf8(data)
  if (ArrayBuffer.isView(data)) return viewBytes(data)
  if (isArrayBuffer(data) || isSharedArrayBuffer(data)) return new Uint8Array(data)
  throw new TypeError('expected a string, an ArrayBuffer or a typed array')
}
