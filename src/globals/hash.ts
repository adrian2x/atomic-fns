/**
 * Identity and string hashing.
 */

const hashes = new WeakMap<object | symbol, number>()
let hashCounter = 1

/**
 * 32-bit FNV-1a over UTF-16 code units.
 * @see {@link http://isthe.com/chongo/tech/comp/fnv/ FNV hash}
 */
export function hashCode(s: string): number {
  const FNV1_32A_INIT = 0x811c9dc5
  let hval = FNV1_32A_INIT
  for (let i = 0; i < s.length; ++i) {
    hval ^= s.charCodeAt(i)
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24)
  }
  return hval >>> 0
}

/**
 * Hash value for any input. Objects and unregistered symbols get a stable
 * per-identity id from a WeakMap; registered symbols use their key string.
 */
export function hash(x: unknown): number {
  if (x === null || x === undefined) return 0
  if (typeof x === 'string') return hashCode(x)
  if (typeof x === 'number' || typeof x === 'bigint' || typeof x === 'boolean') {
    return hashCode(String(x))
  }
  if (typeof x === 'symbol') {
    const key = Symbol.keyFor(x)
    if (key !== undefined) return hashCode('Symbol(' + key + ')')
    let h = hashes.get(x)
    if (h === undefined) {
      h = hashCounter++
      hashes.set(x, h)
    }
    return h
  }
  if (typeof x === 'object' || typeof x === 'function') {
    let h = hashes.get(x)
    if (h === undefined) {
      h = hashCounter++
      hashes.set(x, h)
    }
    return h
  }
  return 0
}
