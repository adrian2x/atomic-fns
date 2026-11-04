/**
 * dos-38 / dos-39: pow10 caches stay empty at import and are built once.
 * Own file so the fork starts with a cold decimal module (vitest pool: forks).
 */
import { describe, expect, it } from 'vitest'
import { decimal } from '../src/decimal/index.js'
import {
  getPow10BuildMuls,
  getPow10CacheLength,
  getPow10SquareCacheLength,
  resetPow10BuildMuls
} from '../src/decimal/pow10.js'

describe('dos-38 / dos-39 lazy power-of-ten tables', () => {
  it('dos-39: pow10 tables are empty right after import', () => {
    // Linear cache holds only 10^0; square table not built until normalize needs it.
    expect(getPow10CacheLength()).toBe(1)
    expect(getPow10SquareCacheLength()).toBe(0)
  })

  it('dos-38: parsing 10.50 after warm-up does no further table-build muls', () => {
    // Warm the square table (and any linear entries this parse needs).
    expect(decimal('10.50').toString()).toBe('10.5')
    resetPow10BuildMuls()
    expect(decimal('10.50').toString()).toBe('10.5')
    expect(getPow10BuildMuls()).toBe(0)
  })
})
