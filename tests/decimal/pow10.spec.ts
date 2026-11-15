import { describe, expect, it, vi } from 'vitest'

type Pow10Module = typeof import('../../src/decimal/internal/pow10.ts')

/** A fresh copy of the module, so each test starts from empty tables whatever ran before. */
async function freshPow10(): Promise<Pow10Module> {
  vi.resetModules()
  return import('../../src/decimal/internal/pow10.ts')
}

describe('powers of ten', () => {
  it('start with empty tables', async () => {
    const m = await freshPow10()
    expect(m.getPow10CacheLength()).toBe(1)
    expect(m.getPow10SquareCacheLength()).toBe(0)
    expect(m.pow10(0)).toBe(1n)
    expect(m.pow10(32_767)).toBe(10n ** 32_767n)
  })

  it('matches repeated powers and square powers', async () => {
    const m = await freshPow10()
    expect(m.pow10(300)).toBe(10n ** 300n)
    expect(m.pow10(300)).toBe(10n ** 300n)
    expect(m.pow10Squares()[13]).toBe(10n ** 8192n)
  })

  it('match 10n ** k on boundaries and 100 seeded exponents', async () => {
    const m = await freshPow10()
    let state = 0xdec1a1
    const next = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state
    }
    for (let n = 0; n < 100; n++) {
      const k = next() % 32_768
      expect(m.pow10(k)).toBe(10n ** BigInt(k))
    }
  })

  it('keeps cached powers bounded', async () => {
    const m = await freshPow10()
    expect(m.pow10(20_000)).toBe(10n ** 20_000n)
    expect(m.pow10(16_384)).toBe(10n ** 16_384n)
    expect(m.pow10(32_767)).toBe(10n ** 32_767n)
    expect(m.getPow10CachedDigits()).toBeLessThan(44_000)
  })
})
