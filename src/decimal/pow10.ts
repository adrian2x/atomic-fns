/**
 * Lazy power-of-ten caches for Decimal arithmetic and normalization.
 * Built on first use so importing decimal does not allocate large bigints.
 *
 * Bounded: a linear table only for k < 512, plus a 10^(2^k) squares table
 * persisted through 10^8192 (14 entries). Bit 14 (10^16384) is computed
 * ephemerally when needed so the cache stays under the digit budget. Larger
 * powers are built by binary decomposition and are never stored.
 */

/** Max exclusive exponent kept in the linear table. */
const LINEAR_MAX = 512

/** Highest square bit supported (10^(2^14) = 10^16384), ephemeral past persist. */
const MAX_SQUARE_BIT = 14

/**
 * Persist square-table indices 0..PERSIST_SQUARE_BITS-1 (through 10^8192).
 * Higher bits are multiplied on the fly and discarded.
 */
const PERSIST_SQUARE_BITS = 14

/** Cached `10^k` for k < LINEAR_MAX. Index 0 is always `1n`. Grows on demand. */
const POW10_TABLE: bigint[] = [1n]

/** Cached `10^(2^k)` for k = 0..PERSIST_SQUARE_BITS-1, built lazily. */
const POW10_SQUARE_TABLE: bigint[] = []

/** Bigint multiplications used to extend either cache (tests). */
let buildMuls = 0

/**
 * Ensure the persisted square table has at least `minLength` entries.
 * First entry is `10n` (10^(2^0)); each further entry squares the previous.
 */
function ensureSquares(minLength: number): void {
  if (minLength > PERSIST_SQUARE_BITS) {
    throw new RangeError('power-of-ten square table exhausted')
  }
  if (POW10_SQUARE_TABLE.length === 0 && minLength > 0) {
    POW10_SQUARE_TABLE.push(10n)
  }
  while (POW10_SQUARE_TABLE.length < minLength) {
    const last = POW10_SQUARE_TABLE[POW10_SQUARE_TABLE.length - 1]
    POW10_SQUARE_TABLE.push(last * last)
    buildMuls++
  }
}

/**
 * `10^(2^bit)`. Persisted through bit 13; bit 14 is ephemeral (not stored).
 */
function squareAt(bit: number): bigint {
  if (bit < 0 || bit > MAX_SQUARE_BIT) {
    throw new RangeError('power-of-ten square bit out of range')
  }
  if (bit < PERSIST_SQUARE_BITS) {
    ensureSquares(bit + 1)
    return POW10_SQUARE_TABLE[bit]
  }
  ensureSquares(PERSIST_SQUARE_BITS)
  let v = POW10_SQUARE_TABLE[PERSIST_SQUARE_BITS - 1]
  for (let i = PERSIST_SQUARE_BITS; i <= bit; i++) {
    v = v * v
  }
  return v
}

/**
 * Return `10^k` for non-negative `k`.
 * k < 512 uses the linear cache; larger k uses binary decomposition of the
 * squares table and does not store the product.
 */
export function pow10(k: number): bigint {
  if (k < LINEAR_MAX) {
    while (POW10_TABLE.length <= k) {
      const last = POW10_TABLE[POW10_TABLE.length - 1]
      POW10_TABLE.push(last * 10n)
      buildMuls++
    }
    return POW10_TABLE[k]
  }
  // Binary decomposition: 10^k = product of 10^(2^i) for each set bit i of k.
  let result = 1n
  let bit = 0
  let rem = k
  while (rem > 0) {
    if (rem & 1) {
      if (bit > MAX_SQUARE_BIT) {
        // Exponent needs a square beyond 10^16384 - fall back for that bit slice.
        result *= 10n ** BigInt(1 << bit)
      } else {
        result *= squareAt(bit)
      }
    }
    rem >>= 1
    bit++
  }
  return result
}

/**
 * Return the memoized `10^(2^k)` table (persisted through 10^8192).
 * Built once; subsequent calls are free.
 */
export function pow10Squares(): readonly bigint[] {
  // MAX_DIGITS trailing zeros need through 2^13 = 8192.
  ensureSquares(PERSIST_SQUARE_BITS)
  return POW10_SQUARE_TABLE
}

/** Length of the linear `10^k` cache (1 right after import). Not a public barrel export. */
export function getPow10CacheLength(): number {
  return POW10_TABLE.length
}

/** Length of the square `10^(2^k)` cache (0 right after import). Not a public barrel export. */
export function getPow10SquareCacheLength(): number {
  return POW10_SQUARE_TABLE.length
}

/** Table-build bigint mul count since last reset. Not a public barrel export. */
export function getPow10BuildMuls(): number {
  return buildMuls
}

/** Reset the table-build mul counter (tests). Not a public barrel export. */
export function resetPow10BuildMuls(): void {
  buildMuls = 0
}

/**
 * Total decimal digits across every cached power-of-ten bigint.
 * 10^e contributes e+1 digits. Not a public barrel export.
 */
export function getPow10CachedDigits(): number {
  let total = 0
  for (let i = 0; i < POW10_TABLE.length; i++) {
    total += i + 1
  }
  for (let j = 0; j < POW10_SQUARE_TABLE.length; j++) {
    total += (1 << j) + 1
  }
  return total
}
