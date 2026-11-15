import { describe, expect, it, vi } from 'vitest'

describe('the power-of-ten cache behind Decimal', () => {
  it('is empty right after import', async () => {
    vi.resetModules()
    const [{ Decimal: FreshDecimal }, cache] = await Promise.all([
      import('../../src/decimal/index.ts'),
      import('../../src/decimal/internal/pow10.ts')
    ])
    expect(cache.getPow10CacheLength()).toBe(1)
    expect(cache.getPow10SquareCacheLength()).toBe(0)
    expect(new FreshDecimal('10.50').toString()).toBe('10.5')
    expect(new FreshDecimal('10.50').toString()).toBe('10.5')
  })
})
