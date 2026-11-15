import { randomBytes } from '../internal/crypto.ts'

const URL_ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'
const URL_SYMBOLS = [...URL_ALPHABET]

/** Longest id {@link nanoid} makes, so a size from input cannot allocate without bound. */
const MAX_SIZE = 1024

/** Most code points an alphabet may hold, since each draw indexes it with one random byte. */
const MAX_SYMBOLS = 256

/** The code points of `alphabet`, or an error for an alphabet {@link nanoid} cannot draw from. */
function symbolsOf(alphabet: string): string[] {
  if (typeof alphabet !== 'string') throw new TypeError('alphabet must be a string')
  if (alphabet === URL_ALPHABET) return URL_SYMBOLS
  if (!alphabet.isWellFormed()) throw new RangeError('alphabet must not hold lone surrogates')
  const outOfRange = `alphabet must hold 2 to ${String(MAX_SYMBOLS)} distinct characters`
  // A code point is one or two UTF-16 units, so a longer string holds too many to spread.
  if (alphabet.length > 2 * MAX_SYMBOLS) throw new RangeError(outOfRange)
  const symbols = [...alphabet]
  if (
    symbols.length < 2 ||
    symbols.length > MAX_SYMBOLS ||
    new Set(symbols).size !== symbols.length
  ) {
    throw new RangeError(outOfRange)
  }
  return symbols
}

/**
 * A random id of `size` characters from `alphabet`, as the `nanoid` package makes them: each
 * character is drawn without bias through `crypto.getRandomValues`. The default is 21 URL-safe
 * characters, about as collision-resistant as a v4 UUID.
 * @param size Characters in the id, an integer from 1 to 1024 (default 21); else `TypeError` for a
 * non-number and `RangeError` for any other value.
 * @param alphabet Characters to draw from: a well-formed string of 2 to 256 distinct code points
 * (default `A-Za-z0-9_-`); else `TypeError` for a non-string and `RangeError` for any other value.
 * @returns The id.
 * @example
 * ```ts
 * nanoid() // 'V1StGXR8_Z5jdHi6B-myT'
 * nanoid(8, '0123456789') // '48105763'
 * ```
 */
export function nanoid(size = 21, alphabet: string = URL_ALPHABET): string {
  if (typeof size !== 'number') throw new TypeError('size must be a number')
  if (!Number.isInteger(size) || size < 1 || size > MAX_SIZE) {
    throw new RangeError(`size must be an integer from 1 to ${String(MAX_SIZE)}`)
  }
  const symbols = symbolsOf(alphabet)
  const mask = (2 << (31 - Math.clz32((symbols.length - 1) | 1))) - 1
  const batch = Math.ceil((1.6 * mask * size) / symbols.length)
  let id = ''
  let length = 0
  while (length < size) {
    for (const byte of randomBytes(batch)) {
      const index = byte & mask
      if (index < symbols.length) {
        id += symbols[index]
        if (++length === size) return id
      }
    }
  }
  return id
}
