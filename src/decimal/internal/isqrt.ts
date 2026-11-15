import { bitLength } from './bits.ts'

/**
 * Adjust `x` so `x*x <= n < (x+1)*(x+1)` (one +-1 step).
 * Returns the root and whether `x*x === n` (avoids a second full square in callers).
 */
function isqrtFix(x: bigint, n: bigint): { root: bigint; exact: boolean } {
  let y = x
  let y2 = y * y
  // Newton / Math.sqrt estimate is within 1 of the true floor root.
  if (y2 > n) {
    y--
    y2 = y * y
  } else if (y2 + ((y << 1n) + 1n) <= n) {
    y++
    y2 = y * y
  }
  return { root: y, exact: y2 === n }
}

/**
 * Floor integer square root via precision doubling.
 * Below 2^52 uses `Math.sqrt` with an exact fix-up; larger n recurse on
 * `n >> 2k` then one Newton step and one +-1 correction.
 */
export function isqrtRoot(n: bigint): { root: bigint; exact: boolean } {
  if (n <= 1n) return { root: n, exact: true }
  if (n < 1n << 52n) {
    return isqrtFix(BigInt(Math.floor(Math.sqrt(Number(n)))), n)
  }
  const k = Math.floor(bitLength(n) / 4)
  const r = isqrtRoot(n >> BigInt(2 * k)).root << BigInt(k)
  return isqrtFix((r + n / r) >> 1n, n)
}
