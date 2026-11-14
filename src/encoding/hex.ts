import { bytesToHex, toBytes } from '../internal/bytes.ts'
import { decodeHex } from '../internal/codec.ts'

interface NativeHex {
  toHex?: (this: Uint8Array) => string
}
interface NativeFromHex {
  fromHex?: (text: string) => Uint8Array
}

const nativeToHex = (Uint8Array.prototype as NativeHex).toHex
const nativeFromHex = (Uint8Array as NativeFromHex).fromHex

/**
 * Lowercase hex of a byte array, a buffer, or a string's UTF-8 bytes. Uses the native
 * `Uint8Array.prototype.toHex` where present.
 * @param data A `Uint8Array` (or other typed array or `DataView`), an `ArrayBuffer`, or a string.
 * @returns Two hex digits per byte.
 * @example
 * ```ts
 * toHex(new Uint8Array([0, 255])) // '00ff'
 * toHex('hi') // '6869'
 * ```
 */
export function toHex(data: string | ArrayBuffer | ArrayBufferView): string {
  const bytes = toBytes(data)
  return nativeToHex !== undefined ? nativeToHex.call(bytes) : bytesToHex(bytes)
}

/**
 * Bytes of hex text, as `Uint8Array.fromHex` reads it (native where present): digits in either case,
 * an even count, nothing else; anything else throws `SyntaxError`, as the native method does.
 * @param text Hex text.
 * @returns The decoded bytes.
 * @example
 * ```ts
 * fromHex('00ff') // Uint8Array [0, 255]
 * ```
 */
export function fromHex(text: string): Uint8Array {
  if (typeof text !== 'string') throw new TypeError('fromHex expects a string')
  return nativeFromHex !== undefined ? nativeFromHex(text) : decodeHex(text)
}
