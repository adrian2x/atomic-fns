/** Bit length of a non-negative bigint (0 for 0n), read from its hex form, not its binary one. */
export function bitLength(n: bigint): number {
  if (n === 0n) return 0
  const hex = n.toString(16)
  return (hex.length - 1) * 4 + (32 - Math.clz32(parseInt(hex[0], 16)))
}
