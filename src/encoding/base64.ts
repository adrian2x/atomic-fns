import { toBytes } from '../internal/bytes.ts'
import { type Base64Alphabet, decodeBase64, encodeBase64 } from '../internal/codec.ts'

/** Options for {@link toBase64}. */
export interface ToBase64Options {
  /** `'base64'` (`+` and `/`, the default) or `'base64url'` (`-` and `_`). */
  alphabet?: 'base64' | 'base64url'
  /** Leave out the trailing `=` padding (default `false`). */
  omitPadding?: boolean
}

/** Options for {@link fromBase64}. */
export interface FromBase64Options {
  /** `'base64'` (`+` and `/`, the default) or `'base64url'` (`-` and `_`). */
  alphabet?: 'base64' | 'base64url'
}

interface NativeBase64 {
  toBase64?: (this: Uint8Array, options?: ToBase64Options) => string
}
interface NativeFromBase64 {
  fromBase64?: (text: string, options?: FromBase64Options) => Uint8Array
}

const nativeToBase64 = (Uint8Array.prototype as NativeBase64).toBase64
const nativeFromBase64 = (Uint8Array as NativeFromBase64).fromBase64

function alphabetOf(options: ToBase64Options | FromBase64Options | undefined): Base64Alphabet {
  const alphabet = options?.alphabet ?? 'base64'
  if (alphabet === 'base64' || alphabet === 'base64url') return alphabet
  throw new TypeError(`unknown base64 alphabet: ${String(alphabet)}`)
}

/**
 * Base64 of a byte array, a buffer, or a string's UTF-8 bytes, with the `base64url` alphabet as an
 * option. Uses the native `Uint8Array.prototype.toBase64` where present.
 * @param data A `Uint8Array` (or other typed array or `DataView`), an `ArrayBuffer`, or a string.
 * @param options `alphabet` and `omitPadding`.
 * @returns The base64 text.
 * @example
 * ```ts
 * toBase64('hi') // 'aGk='
 * toBase64(new Uint8Array([251, 255]), { alphabet: 'base64url', omitPadding: true }) // '-_8'
 * ```
 */
export function toBase64(
  data: string | ArrayBuffer | ArrayBufferView,
  options?: ToBase64Options
): string {
  const alphabet = alphabetOf(options)
  const bytes = toBytes(data)
  const omitPadding = options?.omitPadding === true
  if (nativeToBase64 !== undefined) {
    return nativeToBase64.call(bytes, { alphabet, omitPadding })
  }
  return encodeBase64(bytes, alphabet, omitPadding)
}

/**
 * Bytes of base64 text, as `Uint8Array.fromBase64` reads it (native where present): ASCII
 * whitespace is skipped and padding is optional, but a character outside the alphabet or a broken
 * last chunk throws `SyntaxError`, as the native method does. Decode text with `TextDecoder`.
 * @param text Base64 text.
 * @param options `alphabet`.
 * @returns The decoded bytes.
 * @example
 * ```ts
 * fromBase64('aGk=') // Uint8Array [104, 105]
 * new TextDecoder().decode(fromBase64('aGk')) // 'hi'
 * ```
 */
export function fromBase64(text: string, options?: FromBase64Options): Uint8Array {
  if (typeof text !== 'string') throw new TypeError('fromBase64 expects a string')
  const alphabet = alphabetOf(options)
  if (nativeFromBase64 !== undefined) {
    return nativeFromBase64(text, { alphabet })
  }
  return decodeBase64(text, alphabet)
}
