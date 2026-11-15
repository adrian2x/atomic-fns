/**
 * Portable base64 and hex codecs, for runtimes without the native `Uint8Array` methods.
 */

/** The base64 alphabets, by the names the native methods take. */
export type Base64Alphabet = 'base64' | 'base64url'

const CHARACTERS: Record<Base64Alphabet, string> = {
  base64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
  base64url: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
}

/** For each alphabet, the 6-bit value of every ASCII code unit, or -1 outside the alphabet. */
const VALUES: Record<Base64Alphabet, Int8Array> = {
  base64: valuesOf(CHARACTERS.base64),
  base64url: valuesOf(CHARACTERS.base64url)
}

function valuesOf(characters: string): Int8Array {
  const values = new Int8Array(128).fill(-1)
  for (let value = 0; value < characters.length; value++) {
    values[characters.charCodeAt(value)] = value
  }
  return values
}

/** Base64 of `bytes` in `alphabet`. */
export function encodeBase64(
  bytes: Uint8Array,
  alphabet: Base64Alphabet,
  omitPadding: boolean
): string {
  const characters = CHARACTERS[alphabet]
  let out = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    out +=
      characters[n >> 18] +
      characters[(n >> 12) & 63] +
      characters[(n >> 6) & 63] +
      characters[n & 63]
  }
  const rest = bytes.length - i
  if (rest === 1) {
    const n = bytes[i] << 16
    out += characters[n >> 18] + characters[(n >> 12) & 63] + (omitPadding ? '' : '==')
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8)
    out += characters[n >> 18] + characters[(n >> 12) & 63] + characters[(n >> 6) & 63]
    out += omitPadding ? '' : '='
  }
  return out
}

/** Bytes of base64 `text` in `alphabet`, read as `Uint8Array.fromBase64` reads it. */
export function decodeBase64(text: string, alphabet: Base64Alphabet): Uint8Array {
  const values = VALUES[alphabet]
  let chars = text.replace(/[\t\n\f\r ]/g, '')
  if (chars.endsWith('=')) {
    if (chars.length % 4 !== 0) throw new SyntaxError('invalid base64 padding')
    chars = chars.replace(/={1,2}$/, '')
  }
  if (chars.length % 4 === 1) throw new SyntaxError('invalid base64 length')
  const out = new Uint8Array(Math.floor((chars.length * 3) / 4))
  let bits = 0
  let buffer = 0
  let written = 0
  for (let i = 0; i < chars.length; i++) {
    const code = chars.charCodeAt(i)
    const value = code < 128 ? values[code] : -1
    if (value < 0) throw new SyntaxError(`invalid base64 character: ${JSON.stringify(chars[i])}`)
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[written++] = (buffer >> bits) & 0xff
    }
  }
  return out
}

/** Bytes of hex `text`, read as `Uint8Array.fromHex` reads it. */
export function decodeHex(text: string): Uint8Array {
  if (text.length % 2 !== 0) throw new SyntaxError('hex text must have an even length')
  if (!/^[0-9a-fA-F]*$/.test(text)) throw new SyntaxError('invalid hex character')
  const out = new Uint8Array(text.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(text.slice(2 * i, 2 * i + 2), 16)
  return out
}
