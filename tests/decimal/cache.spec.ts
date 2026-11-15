import { describe, expect, it, vi } from 'vitest'
import { Decimal } from '../../src/decimal/index.ts'
import { getPow10CachedDigits } from '../../src/decimal/internal/pow10.ts'

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

  it('stays under 37,000 digits after arithmetic at the digit and exponent bounds', () => {
    expect(new Decimal('1e-9999').add(1).toPlainString()).toBe(`1.${'0'.repeat(9998)}1`)
    const q = new Decimal('1e9998').divide('9'.repeat(9999), { precision: 10_000 })
    expect(q.toPlainString()).toBe(`0.1${'0'.repeat(9998)}1`)
    expect(getPow10CachedDigits()).toBeLessThan(37_000)
  })
})
