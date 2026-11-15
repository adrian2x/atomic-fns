const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

/** One byte into an FNV-1a state. */
function step(state: number, byte: number): number {
  return Math.imul(state ^ byte, FNV_PRIME)
}

/**
 * 32-bit FNV-1a hash of the UTF-8 bytes of `str`, so it matches FNV-1a in other languages. Lone
 * surrogates count as U+FFFD, as `TextEncoder` writes them. Fast and well spread, but not
 * cryptographic.
 * @param str The string to hash.
 * @returns An unsigned 32-bit integer.
 * @example
 * ```ts
 * hashString('') // 2166136261
 * hashString('a') // 3826002220
 * ```
 */
export function hashString(str: string): number {
  if (typeof str !== 'string') throw new TypeError('hashString expects a string')
  let state = FNV_OFFSET
  // Encodes in place rather than through `TextEncoder`: `hash` calls this for every string and
  // number it meets, and an allocation per call made it about five times slower.
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const low = str.charCodeAt(i + 1)
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00)
        i++
      }
    }
    if (code >= 0xd800 && code <= 0xdfff) code = 0xfffd
    if (code < 0x80) {
      state = step(state, code)
    } else if (code < 0x800) {
      state = step(step(state, 0xc0 | (code >> 6)), 0x80 | (code & 0x3f))
    } else if (code < 0x10000) {
      state = step(
        step(step(state, 0xe0 | (code >> 12)), 0x80 | ((code >> 6) & 0x3f)),
        0x80 | (code & 0x3f)
      )
    } else {
      state = step(state, 0xf0 | (code >> 18))
      state = step(state, 0x80 | ((code >> 12) & 0x3f))
      state = step(state, 0x80 | ((code >> 6) & 0x3f))
      state = step(state, 0x80 | (code & 0x3f))
    }
  }
  return state >>> 0
}
