/** Bit length of a non-negative bigint (0 for 0n). Hex path avoids a full binary string. */
function bitLength(n: bigint): number {
  if (n === 0n) return 0
  const hex = n.toString(16)
  return (hex.length - 1) * 4 + (32 - Math.clz32(parseInt(hex[0], 16)))
}

/**
 * Adjust `x` so `x*x <= N < (x+1)*(x+1)` (at most a couple of +-1 steps).
 * Returns the root and whether `x*x === N` (avoids a second full square in callers).
 */
function isqrtFix(x: bigint, N: bigint): { root: bigint; exact: boolean } {
  let y = x
  let y2 = y * y
  // Newton / Math.sqrt estimate is within 1 of the true floor root.
  if (y2 > N) {
    y--
    y2 = y * y
  } else if (y2 + ((y << 1n) + 1n) <= N) {
    y++
    y2 = y * y
  }
  return { root: y, exact: y2 === N }
}

/**
 * Floor integer square root via precision doubling.
 * Below 2^52 uses `Math.sqrt` with an exact fix-up; larger N recurse on
 * `N >> 2k` then one Newton step and at most a couple of +-1 corrections.
 */
export function isqrtRoot(N: bigint): { root: bigint; exact: boolean } {
  if (N <= 1n) return { root: N, exact: true }
  if (N < 1n << 52n) {
    return isqrtFix(BigInt(Math.floor(Math.sqrt(Number(N)))), N)
  }
  const k = Math.floor(bitLength(N) / 4)
  const r = isqrtRoot(N >> BigInt(2 * k)).root << BigInt(k)
  return isqrtFix((r + N / r) >> 1n, N)
}

/** Floor integer square root. Internal; not part of the public API. */
export function isqrt(N: bigint): bigint {
  if (N < 0n) throw new RangeError('isqrt of a negative number')
  return isqrtRoot(N).root
}
