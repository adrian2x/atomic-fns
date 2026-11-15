/**
 * Lazy power-of-ten caches for Decimal arithmetic and normalization.
 * Built on first use so importing decimal does not allocate large bigints.
 *
 * Bounded: a linear table only for k < 512, plus a 10^(2^k) squares table
 * persisted through 10^16384 (15 entries) under Decimal's public bounds.
 * Larger powers are built by binary decomposition and are never stored.
 */

/** Max exclusive exponent kept in the linear table. */
const LINEAR_MAX = 512

/** Cached `10^k` for k < LINEAR_MAX. Index 0 is always `1n`. Grows on demand. */
const POW10_TABLE: bigint[] = [1n]

const POW10_SQUARE_TABLE: bigint[] = []

/**
 * Ensure the persisted square table has at least `minLength` entries.
 * First entry is `10n` (10^(2^0)); each further entry squares the previous.
 */
function ensureSquares(minLength: number): void {
  if (POW10_SQUARE_TABLE.length === 0 && minLength > 0) {
    POW10_SQUARE_TABLE.push(10n)
  }
  while (POW10_SQUARE_TABLE.length < minLength) {
    const last = POW10_SQUARE_TABLE[POW10_SQUARE_TABLE.length - 1]
    POW10_SQUARE_TABLE.push(last * last)
  }
}

function squareAt(bit: number): bigint {
  ensureSquares(bit + 1)
  return POW10_SQUARE_TABLE[bit]
}

/** Return `10^k` for a non-negative integer `k`. */
export function pow10(k: number): bigint {
  if (k < LINEAR_MAX) {
    while (POW10_TABLE.length <= k) {
      const last = POW10_TABLE[POW10_TABLE.length - 1]
      POW10_TABLE.push(last * 10n)
    }
    return POW10_TABLE[k]
  }
  // Binary decomposition: 10^k = product of 10^(2^i) for each set bit i of k.
  let result = 1n
  let bit = 0
  let rem = k
  while (rem > 0) {
    if (rem & 1) {
      result *= squareAt(bit)
    }
    rem >>= 1
    bit++
  }
  return result
}

/**
 * Return the memoized `10^(2^k)` table, with at least the powers through 10^8192.
 * Built once; subsequent calls are free.
 */
export function pow10Squares(): readonly bigint[] {
  // Stripping up to 10000 trailing zeros (Decimal's digit bound) needs squares through 2^13 = 8192.
  ensureSquares(14)
  return POW10_SQUARE_TABLE
}

/** Length of the linear `10^k` cache (1 right after import). For tests. */
export function getPow10CacheLength(): number {
  return POW10_TABLE.length
}

/** Length of the square `10^(2^k)` cache (0 right after import). For tests. */
export function getPow10SquareCacheLength(): number {
  return POW10_SQUARE_TABLE.length
}

/**
 * Total decimal digits across every cached power-of-ten bigint.
 * 10^e contributes e+1 digits. For tests.
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
