import { describe, expect, it } from 'vitest'
import { isqrtRoot } from '../../src/decimal/internal/isqrt.ts'

describe('isqrtRoot', () => {
  it('returns the exact floor root on edges and 2000 random bit lengths', () => {
    const check = (n: bigint) => {
      const { root, exact } = isqrtRoot(n)
      expect(root * root <= n && (root + 1n) * (root + 1n) > n).toBe(true)
      expect(exact).toBe(root * root === n)
    }
    for (const n of [0n, 1n, 2n, 3n, 4n, (1n << 52n) - 1n, 1n << 52n, (1n << 52n) + 1n]) check(n)
    for (let k = 1; k <= 512; k++) {
      check((1n << BigInt(2 * k)) - 1n)
      check(1n << BigInt(2 * k))
    }
    let state = 0xc0ffee42
    const rand = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0)
    for (let n = 0; n < 2000; n++) {
      const bits = 1 + (rand() % 3000)
      let value = 1n
      for (let b = 0; b < bits; b += 32) value = (value << 32n) | BigInt(rand())
      check(value & ((1n << BigInt(bits)) - 1n))
    }
  })
})
