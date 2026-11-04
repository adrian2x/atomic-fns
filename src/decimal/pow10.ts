/**
 * Lazy power-of-ten caches for Decimal arithmetic and normalization.
 * Built on first use so importing decimal does not allocate ~20 MB of bigints.
 */

/** Cached `10^k` growing on demand. Index 0 is always `1n`. */
const POW10_TABLE: bigint[] = [1n]

/** Cached `10^(2^k)` for k = 0..13 (up to 10^8192), built once on first normalize. */
const POW10_SQUARE_TABLE: bigint[] = []

/** Bigint multiplications used to extend either cache (tests). */
let buildMuls = 0

/**
 * Return `10^k` for non-negative `k`, extending the linear cache as needed.
 * Negative exponents fall back to a one-off `10n ** BigInt(k)`.
 */
export function pow10(k: number): bigint {
  if (k < 0) return 10n ** BigInt(k)
  while (POW10_TABLE.length <= k) {
    const last = POW10_TABLE[POW10_TABLE.length - 1]
    POW10_TABLE.push(last * 10n)
    buildMuls++
  }
  return POW10_TABLE[k]
}

/**
 * Return the memoized `10^(2^k)` table (length 14). Built once; subsequent calls are free.
 */
export function pow10Squares(): readonly bigint[] {
  if (POW10_SQUARE_TABLE.length === 0) {
    POW10_SQUARE_TABLE.push(10n)
    for (let i = 0; i < 13; i++) {
      const last = POW10_SQUARE_TABLE[POW10_SQUARE_TABLE.length - 1]
      POW10_SQUARE_TABLE.push(last * last)
      buildMuls++
    }
  }
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
